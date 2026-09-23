/**
 * Universal File Download & Share helper (PDFs, Images, QR codes)
 * Works in Android WebView (via Native AndroidDownloader or Web Share) and standard mobile/desktop browsers.
 */
export async function downloadOrShareFile(fileOrData, filename = "file.pdf", mimeType = null) {
  if (!fileOrData) return false;

  // 1. Detect clean mimeType if not provided
  if (!mimeType) {
    const fn = filename.toLowerCase();
    if (fn.endsWith(".png")) {
      mimeType = "image/png";
    } else if (fn.endsWith(".jpg") || fn.endsWith(".jpeg")) {
      mimeType = "image/jpeg";
    } else {
      mimeType = "application/pdf";
    }
  } else {
    // Strip any parameters like ;charset=utf-8
    mimeType = mimeType.split(";")[0].trim();
  }

  // 2. Convert input to clean base64 and Blob
  let base64Data = null;
  let fileBlob = null;

  if (typeof fileOrData === "string" && fileOrData.startsWith("data:")) {
    const commaIdx = fileOrData.indexOf(",");
    if (commaIdx !== -1) {
      base64Data = fileOrData.substring(commaIdx + 1);
      const mimeMatch = fileOrData.substring(0, commaIdx).match(/:(.*?);/);
      if (mimeMatch) mimeType = mimeMatch[1].trim();
    } else {
      base64Data = fileOrData;
    }

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
    if (fileOrData.type) {
      mimeType = fileOrData.type.split(";")[0].trim();
    }
    try {
      const reader = new FileReader();
      base64Data = await new Promise((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result;
          if (typeof res === "string") {
            const idx = res.indexOf(",");
            resolve(idx !== -1 ? res.substring(idx + 1) : res);
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

  // 3. Android Native Downloader (via MainActivity JavascriptInterface)
  if (
    base64Data &&
    window.AndroidDownloader &&
    typeof window.AndroidDownloader.saveBase64File === "function"
  ) {
    try {
      console.log("Saving via native AndroidDownloader:", filename, mimeType);
      window.AndroidDownloader.saveBase64File(base64Data, filename, mimeType);
      return true;
    } catch (err) {
      console.warn("Native AndroidDownloader failed, falling back:", err);
    }
  }

  // 4. Standard Direct Browser Blob Download (Saves directly to device Downloads)
  // CRITICAL: NEVER set a.target = "_blank"! On Android Chrome and WebViews,
  // target="_blank" on blob URLs causes "Not allowed to navigate top frame to blob URL"
  // and completely kills the download silently!
  try {
    const blobToDownload =
      fileBlob ||
      (typeof fileOrData === "string" && !fileOrData.startsWith("data:")
        ? new Blob([fileOrData], { type: mimeType })
        : null);

    if (blobToDownload) {
      const url = window.URL.createObjectURL(blobToDownload);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = filename;
      // Do NOT set a.target = "_blank"
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        try {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        } catch (_) {}
      }, 3000);
      return true;
    }
  } catch (err) {
    console.warn("Standard anchor download failed, trying web share:", err);
  }

  // 5. Web Share API Fallback (for mobile browsers that block direct download)
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

