import jsQR from "jsqr";

let nativeBarcodeDetector = null;
if (typeof window !== "undefined" && "BarcodeDetector" in window) {
  try {
    nativeBarcodeDetector = new window.BarcodeDetector({ formats: ["qr_code"] });
  } catch (e) {
    nativeBarcodeDetector = null;
  }
}

/**
 * Robust QR scanner that tries native BarcodeDetector first,
 * then falls back to optimized jsQR with center-crop and multi-resolution downsampling.
 */
export async function decodeQrFromCanvas(canvas) {
  if (!canvas) return null;

  // 1. Try native BarcodeDetector if available
  if (nativeBarcodeDetector) {
    try {
      const barcodes = await nativeBarcodeDetector.detect(canvas);
      if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
        return barcodes[0].rawValue;
      }
    } catch (e) {
      // Fall through to jsQR
    }
  }

  // 2. jsQR on direct canvas
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const w = canvas.width;
  const h = canvas.height;
  if (!w || !h) return null;

  try {
    const imgData = ctx.getImageData(0, 0, w, h);
    const code = jsQR(imgData.data, w, h, { inversionAttempts: "attemptBoth" });
    if (code?.data) return code.data;
  } catch (e) {
    // Continue to scaled attempts
  }

  // 3. If canvas is large (> 700px), downsample to 600px max
  if (w > 700 || h > 700) {
    const scale = 600 / Math.max(w, h);
    const sw = Math.round(w * scale);
    const sh = Math.round(h * scale);
    const scaledCanvas = document.createElement("canvas");
    scaledCanvas.width = sw;
    scaledCanvas.height = sh;
    const sctx = scaledCanvas.getContext("2d", { willReadFrequently: true });
    sctx.drawImage(canvas, 0, 0, sw, sh);
    const sData = sctx.getImageData(0, 0, sw, sh);
    const scode = jsQR(sData.data, sw, sh, { inversionAttempts: "attemptBoth" });
    if (scode?.data) return scode.data;
  }

  return null;
}

/**
 * Scan video frame for live camera.
 * Checks native BarcodeDetector on video, then checks center viewfinder crop,
 * then full frame downscaled.
 */
export async function scanVideoFrame(video, canvas) {
  if (!video || !canvas || video.readyState < 2) return null;

  // 1. Hardware accelerated native detector
  if (nativeBarcodeDetector) {
    try {
      const barcodes = await nativeBarcodeDetector.detect(video);
      if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
        return barcodes[0].rawValue;
      }
    } catch (e) {
      // Fall through
    }
  }

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  // 2. High-performance center crop (where the viewfinder box is aimed)
  // This solves high-density (Version 7+) QR codes failing on 1080p/4K camera frames
  const cropSize = Math.min(Math.min(vw, vh), 640);
  const cropX = Math.floor((vw - cropSize) / 2);
  const cropY = Math.floor((vh - cropSize) / 2);

  canvas.width = cropSize;
  canvas.height = cropSize;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(video, cropX, cropY, cropSize, cropSize, 0, 0, cropSize, cropSize);

  try {
    const cropData = ctx.getImageData(0, 0, cropSize, cropSize);
    const cropCode = jsQR(cropData.data, cropSize, cropSize, { inversionAttempts: "attemptBoth" });
    if (cropCode?.data) return cropCode.data;
  } catch (e) {
    // Continue to full frame
  }

  // 3. Fallback: Full downsampled frame (max 640px)
  const maxDim = 640;
  let dw = vw;
  let dh = vh;
  if (vw > maxDim || vh > maxDim) {
    const ratio = maxDim / Math.max(vw, vh);
    dw = Math.round(vw * ratio);
    dh = Math.round(vh * ratio);
  }

  canvas.width = dw;
  canvas.height = dh;
  ctx.drawImage(video, 0, 0, dw, dh);
  try {
    const fullData = ctx.getImageData(0, 0, dw, dh);
    const fullCode = jsQR(fullData.data, dw, dh, { inversionAttempts: "attemptBoth" });
    if (fullCode?.data) return fullCode.data;
  } catch (e) {}

  return null;
}

/**
 * Scan an uploaded Image object with multi-scale fallback.
 */
export async function decodeQrFromImage(img) {
  if (!img || !img.width || !img.height) return null;

  // 1. Native detector
  if (nativeBarcodeDetector) {
    try {
      const barcodes = await nativeBarcodeDetector.detect(img);
      if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
        return barcodes[0].rawValue;
      }
    } catch (e) {}
  }

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);

  return await decodeQrCanvasMultiScale(canvas);
}

async function decodeQrCanvasMultiScale(canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  // 1. Direct jsQR
  try {
    const imgData = ctx.getImageData(0, 0, w, h);
    const code = jsQR(imgData.data, w, h, { inversionAttempts: "attemptBoth" });
    if (code?.data) return code.data;
  } catch (e) {}

  // 2. Downscaled attempts if resolution is high
  const scales = [800, 500];
  for (const maxDim of scales) {
    if (w > maxDim || h > maxDim) {
      const ratio = maxDim / Math.max(w, h);
      const sw = Math.round(w * ratio);
      const sh = Math.round(h * ratio);
      const sc = document.createElement("canvas");
      sc.width = sw;
      sc.height = sh;
      const sctx = sc.getContext("2d", { willReadFrequently: true });
      sctx.drawImage(canvas, 0, 0, sw, sh);
      const sData = sctx.getImageData(0, 0, sw, sh);
      const scode = jsQR(sData.data, sw, sh, { inversionAttempts: "attemptBoth" });
      if (scode?.data) return scode.data;
    }
  }

  return null;
}
