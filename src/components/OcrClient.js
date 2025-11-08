// const OCR_API_KEY = "K84536728488957";

// export async function ocrImageDataUrl(dataUrl, opts = {}) {
//   if (!dataUrl) throw new Error("No image provided");

//   const { signal, timeoutMs = 30000 } = opts;

//   // If you passed raw base64, normalize to a data URL
//   if (!/^data:/i.test(dataUrl)) {
//     dataUrl = `data:image/png;base64,${dataUrl}`;
//   }

//   if (dataUrl.length > 2_500_000) {
//     console.warn("OCR: data URL looks large; consider JPEG at lower quality.");
//   }

//   const ctrl = new AbortController();
//   const timeoutId = setTimeout(() => ctrl.abort(new DOMException("Timeout", "AbortError")), timeoutMs);

//   if (signal) {
//     if (signal.aborted) ctrl.abort(signal.reason);
//     else signal.addEventListener("abort", () => ctrl.abort(signal.reason), { once: true });
//   }

//   try {
//     const form = new FormData();
//     form.append("apikey", OCR_API_KEY);
//     form.append("language", "eng");
//     form.append("isOverlayRequired", "false");
//     form.append("OCREngine", "2");
//     form.append("base64Image", dataUrl);

//     const res = await fetch("https://api.ocr.space/parse/image", {
//       method: "POST",
//       body: form,
//       signal: ctrl.signal,
//     });

//     // Network OK, parse body
//     const json = await res.json().catch(() => ({}));

//     // HTTP error?
//     if (!res.ok) {
//       const msg =
//         json?.ErrorMessage?.[0] ||
//         json?.ErrorMessage ||
//         json?.ErrorDetails ||
//         `OCR request failed (HTTP ${res.status})`;
//       throw new Error(msg);
//     }

//     // API-level error?
//     if (json?.IsErroredOnProcessing) {
//       const msg =
//         json?.ErrorMessage?.[0] ||
//         json?.ErrorMessage ||
//         json?.ErrorDetails ||
//         "OCR service errored on processing";
//       throw new Error(msg);
//     }

//     const text = (json?.ParsedResults || [])
//       .map(r => (r?.ParsedText || "").trim())
//       .join("\n")
//       .trim();

//     return text || "";
//   } catch (err) {
//     // "Failed to fetch" is a network/CORS/abort/timeout problem, NOT an exhausted key.
//     if (err?.name === "AbortError") {
//       throw new Error("OCR request was canceled or timed out");
//     }
//     // Surface original error message if present
//     throw new Error(err?.message || "OCR request failed");
//   } finally {
//     clearTimeout(timeoutId);
//   }
// }

// src/lib/ocrClient.js

export async function ocrImageDataUrl(dataUrl, { signal } = {}) {
  if (!dataUrl) throw new Error("No image provided");

  const res = await fetch("http://localhost:8080/textract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({ dataUrl })
  });

  if (!res.ok) {
    let msg;
    try { msg = await res.json(); } catch {
      //
    }
    throw new Error(msg?.error || `OCR request failed: ${res.status}`);
  }

  const json = await res.json();
  return json.text || "";  // return full joined text
}
