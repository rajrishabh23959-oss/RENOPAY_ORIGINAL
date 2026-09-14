/**
 * Universal PDF Download & Share helper
 * Works in Android WebView (via Native AndroidDownloader or Web Share) and standard browsers.
 */
export async function downloadOrSharePdf(blob, filename = "statement.pdf") {
  if (!blob) return false;

  // 1. Android Native Downloader (via MainActivity JavascriptInterface)
  if (window.AndroidDownloader?.saveBase64File) {
    try {
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result;
          if (typeof res === "string") {
            const base64 = res.split(",")[1] || res;
            resolve(base64);
          } else {
            reject(new Error("Failed to read blob as base64"));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const base64Data = await base64Promise;
      window.AndroidDownloader.saveBase64File(base64Data, filename, "application/pdf");
      return true;
    } catch (err) {
      console.warn("Native AndroidDownloader failed, falling back:", err);
    }
  }

  // 2. Web Share API (native on mobile browsers that support sharing files)
  try {
    const file = new File([blob], filename, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: filename,
      });
      return true;
    }
  } catch (err) {
    if (err.name === "AbortError") {
      return true; // User intentionally dismissed the share sheet
    }
    console.warn("Web Share failed, falling back:", err);
  }

  // 3. Standard Browser Blob Download
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
    return true;
  } catch (err) {
    console.error("Browser blob download failed:", err);
    return false;
  }
}
