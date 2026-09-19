/**
 * Universal File Download & Share helper (PDFs, Images, QR codes)
 * Works in Android WebView (via Native AndroidDownloader or Web Share) and standard browsers.
 */
export async function downloadOrShareFile(fileOrData, filename = "file.pdf", mimeType = null) {
  if (!fileOrData) return false;

  // Detect mimeType if not provided
  if (!mimeType) {
    if (filename.toLowerCase().endsWith(".png")) {
      mimeType = "image/png";
    } else if (filename.toLowerCase().endsWith(".jpg") || filename.toLowerCase().endsWith(".jpeg")) {
      mimeType = "image/jpeg";
    } else {
      mimeType = "application/pdf";
    }
  }

  // Convert input to base64 and Blob
  let base64Data = null;
  let fileBlob = null;

  if (typeof fileOrData === "string" && fileOrData.startsWith("data:")) {
    const parts = fileOrData.split(",");
    base64Data = parts[1];
    const mimeMatch = parts[0].match(/:(.*?);/);
    if (mimeMatch) mimeType = mimeMatch[1];
    // Convert DataURL to Blob for Web Share / browser fallback
    try {
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      fileBlob = new Blob([byteArray], { type: mimeType });
    } catch (_) {}
  } else if (fileOrData instanceof Blob) {
    fileBlob = fileOrData;
    if (fileOrData.type) mimeType = fileOrData.type;
    try {
      const reader = new FileReader();
      base64Data = await new Promise((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result;
          if (typeof res === "string") {
            resolve(res.split(",")[1] || res);
          } else {
            reject(new Error("Failed to read blob"));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(fileOrData);
      });
    } catch (e) {
      console.warn("Base64 conversion failed:", e);
    }
  }

  // 1. Android Native Downloader (via MainActivity JavascriptInterface)
  if (base64Data && window.AndroidDownloader && (typeof window.AndroidDownloader.saveBase64File === "function" || window.AndroidDownloader.saveBase64File)) {
    try {
      console.log("Saving via native AndroidDownloader:", filename, mimeType);
      window.AndroidDownloader.saveBase64File(base64Data, filename, mimeType);
      return true;
    } catch (err) {
      console.warn("Native AndroidDownloader failed, falling back:", err);
    }
  }

  // 2. Standard Direct Browser Blob Download (Saves to device Downloads)
  try {
    const blobToDownload = fileBlob || (typeof fileOrData === "string" && !fileOrData.startsWith("data:") ? new Blob([fileOrData], { type: mimeType }) : null);
    if (blobToDownload) {
      const url = URL.createObjectURL(blobToDownload);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = filename;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (_) {}
      }, 3000);
      return true;
    }
  } catch (err) {
    console.warn("Standard anchor download failed, trying web share:", err);
  }

  // 3. Web Share API Fallback
  if (fileBlob) {
    try {
      const file = new File([fileBlob], filename, { type: mimeType });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
        });
        return true;
      }
    } catch (err) {
      if (err.name === "AbortError") {
        return true; // User intentionally dismissed share sheet
      }
      console.warn("Web Share failed:", err);
    }
  }

  return false;
}

// Backward compatibility alias for PDF downloads
export const downloadOrSharePdf = downloadOrShareFile;
