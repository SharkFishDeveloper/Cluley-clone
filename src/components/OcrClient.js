// src/lib/ocrClient.js

const OCR_API_KEY = "K84536728488957"; // hardcoded per your request

export async function ocrImageDataUrl(dataUrl) {
  if (!dataUrl) throw new Error("No image provided");

  // ✅ Ensure proper format (fixes prefix issues automatically)
  if (!dataUrl.startsWith("data:")) {
    dataUrl = `data:image/png;base64,${dataUrl}`;
  }

  const form = new FormData();
  form.append("apikey", OCR_API_KEY);
  form.append("language", "eng");
  form.append("isOverlayRequired", "false");
  form.append("OCREngine", "2");
  form.append("base64Image", dataUrl);

  const res = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    body: form,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok || json?.IsErroredOnProcessing) {
    const msg =
      json?.ErrorMessage?.[0] ||
      json?.ErrorMessage ||
      json?.ErrorDetails ||
      `OCR request failed (HTTP ${res.status})`;
    throw new Error(msg);
  }

  const text = (json?.ParsedResults || [])
    .map(r => (r?.ParsedText || "").trim())
    .join("\n")
    .trim();

  return text || "";
}
