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

  // 2. High-performance center crop (viewfinder target area)
  // Optimal 440px square cuts pixel processing time by >50% while easily resolving dense QR codes
  const cropSize = Math.min(Math.min(vw, vh), 440);
  const cropX = Math.floor((vw - cropSize) / 2);
  const cropY = Math.floor((vh - cropSize) / 2);

  canvas.width = cropSize;
  canvas.height = cropSize;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(video, cropX, cropY, cropSize, cropSize, 0, 0, cropSize, cropSize);

  try {
    const cropData = ctx.getImageData(0, 0, cropSize, cropSize);
    // UPI QR codes are standard dark-on-light; "dontInvert" doubles speed on mobile CPU
    const cropCode = jsQR(cropData.data, cropSize, cropSize, { inversionAttempts: "dontInvert" });
    if (cropCode?.data) return cropCode.data;
  } catch (e) {
    // Continue to full frame
  }

  // 3. Fallback: Full downsampled frame (max 440px)
  const maxDim = 440;
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
    const fullCode = jsQR(fullData.data, dw, dh, { inversionAttempts: "dontInvert" });
    if (fullCode?.data) return fullCode.data;
  } catch (e) {}

  return null;
}

/**
 * Scan an uploaded Image object with multi-scale fallback and center-crop.
 * Prevents memory exhaustion on 12MP-48MP mobile photos/screenshots and maximizes QR hit rate.
 */
export async function decodeQrFromImage(img) {
  if (!img) return null;
  const w = img.naturalWidth || img.videoWidth || img.width;
  const h = img.naturalHeight || img.videoHeight || img.height;
  if (!w || !h) return null;

  // 1. Try native BarcodeDetector directly on the source
  if (nativeBarcodeDetector) {
    try {
      const barcodes = await nativeBarcodeDetector.detect(img);
      if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
        return barcodes[0].rawValue;
      }
    } catch (e) {}
  }

  // 2. Multi-scale attempt: jsQR works best around 400px - 1000px.
  // Never attempt jsQR on 3000px+ images directly because it exhausts RAM and fails pattern checks.
  const targetScales = [
    Math.min(800, Math.max(w, h)),
    600,
    450,
    1000,
    320
  ];
  const uniqueScales = [...new Set(targetScales)];

  for (const maxDim of uniqueScales) {
    const ratio = Math.min(1, maxDim / Math.max(w, h));
    const sw = Math.round(w * ratio);
    const sh = Math.round(h * ratio);

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, sw, sh);

    if (nativeBarcodeDetector) {
      try {
        const barcodes = await nativeBarcodeDetector.detect(canvas);
        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
          return barcodes[0].rawValue;
        }
      } catch (e) {}
    }

    try {
      const imgData = ctx.getImageData(0, 0, sw, sh);
      const code = jsQR(imgData.data, sw, sh, { inversionAttempts: "attemptBoth" });
      if (code?.data) return code.data;
    } catch (e) {}
  }

  // 3. Center Crop attempt (for phone screenshots where QR is in the center 60%)
  const cropRatio = 0.65;
  const cw = Math.round(w * cropRatio);
  const ch = Math.round(h * cropRatio);
  const cx = Math.round((w - cw) / 2);
  const cy = Math.round((h - ch) / 2);

  for (const targetDim of [600, 450]) {
    const scale = targetDim / Math.max(cw, ch);
    const sw = Math.round(cw * scale);
    const sh = Math.round(ch * scale);

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, cx, cy, cw, ch, 0, 0, sw, sh);

    try {
      const imgData = ctx.getImageData(0, 0, sw, sh);
      const code = jsQR(imgData.data, sw, sh, { inversionAttempts: "attemptBoth" });
      if (code?.data) return code.data;
    } catch (e) {}
  }

  // 4. Contrast-boosted attempt (for low-contrast or screenshot QRs)
  try {
    const sw = Math.round(w * Math.min(1, 600 / Math.max(w, h)));
    const sh = Math.round(h * Math.min(1, 600 / Math.max(w, h)));
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, sw, sh);

    const imgData = ctx.getImageData(0, 0, sw, sh);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const val = gray < 128 ? Math.max(0, gray * 0.5) : Math.min(255, gray * 1.3);
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    }
    const code = jsQR(data, sw, sh, { inversionAttempts: "attemptBoth" });
    if (code?.data) return code.data;
  } catch (e) {}

  return null;
}
