
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
