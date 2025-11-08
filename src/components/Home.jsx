import React, { useRef, useState } from "react";
import { ocrImageDataUrl } from "./OcrClient";
const WS_URL = "ws://localhost:8080/transcribe";

// ---------- audio helpers ----------
function floatTo16BitPCM(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, s, true);
  }
  return new Uint8Array(buffer);
}
function resampleBuffer(buffer, inputSampleRate, outSampleRate) {
  if (inputSampleRate === outSampleRate) return buffer;
  const ratio = inputSampleRate / outSampleRate;
  const outLength = Math.round(buffer.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const idx = i * ratio;
    const idxL = Math.floor(idx);
    const idxH = Math.min(Math.ceil(idx), buffer.length - 1);
    const weight = idx - idxL;
    out[i] = buffer[idxL] * (1 - weight) + buffer[idxH] * weight;
  }
  return out;
}
function lastNWords(text, n = 100) {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  return words.slice(Math.max(0, words.length - n)).join(" ");
}

export default function Home() {
  const [status, setStatus] = useState("idle");
  const [finalText, setFinalText] = useState("");
  const [partialText, setPartialText] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [showTranscript, setShowTranscript] = useState(true);

  // Screenshots (dataURLs), newest first
  const [shots, setShots] = useState([]);
  const overlayRef = useRef(null);

  // OCR busy flag
  const [ocrBusy, setOcrBusy] = useState(false);

  const wsRef = useRef(null);
  const mediaRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const audioCtxRef = useRef(null);
  const inputRateRef = useRef(null);
  const lastPartialRef = useRef("");
  const isPausedRef = useRef(false);

  const start = async () => {
    if (status === "connected" || status === "paused" || status === "connecting") return;
    setFinalText(""); setPartialText(""); setAiAnswer(""); setStatus("connecting");

    const ws = new WebSocket(WS_URL);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;
    ws.onopen = () => setStatus("connected");
    ws.onclose = () => setStatus("idle");
    ws.onerror = () => setStatus("error");
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "transcript") {
          const incoming = msg.transcript || "";
          if (msg.isPartial) {
            if (incoming === lastPartialRef.current) return;
            lastPartialRef.current = incoming;
            setPartialText(incoming);
          } else {
            if (incoming.trim()) setFinalText((p) => p + incoming + "\n");
            setPartialText("");
            lastPartialRef.current = "";
          }
        }
        if (msg.type === "ai_answer") setAiAnswer(msg.text || "");
      } catch {}
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRef.current = stream;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      inputRateRef.current = audioCtx.sampleRate;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (evt) => {
        if (isPausedRef.current) return;
        const sock = wsRef.current;
        if (!sock || sock.readyState !== WebSocket.OPEN) return;
        const input = evt.inputBuffer.getChannelData(0);
        const resampled = resampleBuffer(input, inputRateRef.current, 16000);
        const pcm16 = floatTo16BitPCM(resampled);
        sock.send(pcm16.buffer);
      };

      source.connect(processor);
      try { processor.connect(audioCtx.destination); } catch {}
    } catch (e) {
      console.error("Mic setup error:", e);
      try { wsRef.current?.close(); } catch {}
      wsRef.current = null;
      setStatus("error");
    }
  };

  const pause = async () => {
    if (status !== "connected") return;
    isPausedRef.current = true; setStatus("paused");
    try { wsRef.current?.send(JSON.stringify({ type: "pause" })); } catch {}
    try { if (audioCtxRef.current?.state === "running") await audioCtxRef.current.suspend(); } catch {}
  };
  const resume = async () => {
    if (status !== "paused") return;
    try { if (audioCtxRef.current?.state === "suspended") await audioCtxRef.current.resume(); } catch {}
    isPausedRef.current = false; setStatus("connected");
    try { wsRef.current?.send(JSON.stringify({ type: "resume" })); } catch {}
  };
  const stop = async () => {
    try {
      if (processorRef.current) { try { processorRef.current.disconnect(); } catch {} processorRef.current.onaudioprocess = null; processorRef.current = null; }
      if (sourceRef.current) { try { sourceRef.current.disconnect(); } catch {} sourceRef.current = null; }
      if (mediaRef.current) { mediaRef.current.getTracks().forEach(t => t.stop()); mediaRef.current = null; }
      if (audioCtxRef.current) { try { await audioCtxRef.current.close(); } catch {} audioCtxRef.current = null; }
    } finally { isPausedRef.current = false; }
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ type: "stop" })); } catch {}
      try { ws.close(); } catch {}
    }
    wsRef.current = null; setStatus("idle");
  };

  const askAI = () => {
    const text = lastNWords(`${finalText} ${partialText}`, 100);
    setAiAnswer("…thinking…");
    try { wsRef.current?.send(JSON.stringify({ type: "ask_ai", text })); } catch (e) { console.error(e); }
  };

  // Capture exactly what's under the overlay window (your existing bridge)
  const captureUnderOverlay = async () => {
    try {
      const info = await window.electronAPI.getUnderlayCropInfo();
      const { sourceId, crop } = info;

      // eslint-disable-next-line no-undef
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: sourceId,
          },
        },
      });

      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      await new Promise((resolve) => {
        if (video.readyState >= 2) resolve();
        else video.onloadeddata = () => resolve();
      });

      const canvas = document.createElement("canvas");
      canvas.width = crop.width;
      canvas.height = crop.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(
        video,
        crop.x, crop.y, crop.width, crop.height, // src
        0, 0, crop.width, crop.height            // dst
      );

      // stop capture
      stream.getTracks().forEach((t) => t.stop());

      const dataUrl = canvas.toDataURL("image/png");
      setShots((prev) => [dataUrl, ...prev]);

      // ensure overlay has NO background image
      const el = overlayRef.current;
      if (el) {
        el.style.backgroundImage = "none";
        el.style.backgroundSize = "";
        el.style.backgroundPosition = "";
      }
    } catch (e) {
      console.error("Underlay capture failed:", e);
    }
  };

  // Clear the current image preview (only the newest one)
  const clearImage = () => {
    setShots((prev) => prev.slice(1));
  };

  // Clear all history (user transcript content)
  const clearHistory = () => {
    setFinalText("");
    setPartialText("");
  };

  // Run OCR on the latest image and append text into transcript
  const ocrCurrentImage = async () => {
    if (!shots[0] || ocrBusy) return;
    setOcrBusy(true);
    try {
      const text = await ocrImageDataUrl(shots[0]); // your OcrClient is hardcoded
      const stamped = text ? text : "[OCR returned empty text]";
      setFinalText((p) => p + (p.endsWith("\n") ? "" : "\n") + "Screenshot of problem\n" + stamped + "\n");
    } catch (err) {
      console.error(err);
      setFinalText((p) => p + (p.endsWith("\n") ? "" : "\n") + "[OCR FAILED] " + (err?.message || "Unknown error") + "\n");
    } finally {
      setOcrBusy(false);
    }
  };

  const isRecording = status === "connected";
  const isPaused = status === "paused";

  return (
    <div
     className="overlay-root no-drag"
      ref={overlayRef}
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onPaste={(e) => e.preventDefault()}
      style={{
        position: "fixed",
        inset: 16,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
        backdropFilter: "blur(6px)",
        backgroundColor: "rgba(20,20,20,0.6)",
        WebkitUserSelect: "none",
        userSelect: "none",
        cursor: "default",
        WebkitAppRegion: "drag", // whole shell draggable by default
      }}
    >

      <div
  className="drag-handle"
  style={{
    position: "absolute",
    top: 6,
    left: "50%",
    transform: "translateX(-50%)",
    width: 180,
    height: 28,
    borderRadius: 14,
    background: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(4px)",
    WebkitAppRegion: "drag",   // <- this makes it draggable
    cursor: "default",         // subtle (no “move” cursor)
    zIndex: 1000
  }}
  title=""   // no tooltip
/>

  
      {/* invisible but draggable strip; no icon/tooltip */}
      <div
        className="titlebar"
        style={{
          height: 8,
          WebkitAppRegion: "drag",
          cursor: "default",
        }}
      />

      <div
        className="window"
        role="group"
        aria-label="Voice overlay"
        style={{
          height: "calc(100% - 8px)",
          display: "flex",
          flexDirection: "column",
          WebkitAppRegion: "no-drag", // content must be interactive
        }}
      >
        <div
          className="controls"
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: 8,
            WebkitAppRegion: "no-drag",
          }}
        >
          <div className="left-controls" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn solid" style={{ cursor: "default" }} onClick={start} disabled={status === "connecting" || isRecording || isPaused}>
              Start
            </button>
            {isRecording && (
              <button className="btn" style={{ cursor: "default" }} onClick={pause}>
                Pause
              </button>
            )}
            {isPaused && (
              <button className="btn" style={{ cursor: "default" }} onClick={resume}>
                Resume
              </button>
            )}
            <button className="btn" style={{ cursor: "default" }} onClick={stop} disabled={status === "idle"}>
              Stop
            </button>
            <button className="btn" style={{ cursor: "default" }} onClick={askAI} disabled={!finalText.trim() && !partialText.trim()}>
              Ask AI
            </button>

            <button className="btn" style={{ cursor: "default" }} onClick={captureUnderOverlay}>
              Capture Under
            </button>
            <button className="btn" style={{ cursor: "default" }} onClick={ocrCurrentImage} disabled={!shots[0] || ocrBusy}>
              {ocrBusy ? "OCR…" : "OCR Image"}
            </button>
            <button className="btn" style={{ cursor: "default" }} onClick={clearImage} disabled={!shots[0]}>
              Clear Image
            </button>
            <button className="btn" style={{ cursor: "default" }} onClick={clearHistory} disabled={!finalText && !partialText}>
              Clear History
            </button>

            <span className="status" style={{ fontSize: 10, display: "flex", alignItems: "center" }}>
              {status.charAt(0).toUpperCase() + status.slice(1, 5)}
            </span>
          </div>

          <button
            className={`toggle ${showTranscript ? "on" : "off"}`}
            style={{ cursor: "default" }}
            onClick={() => setShowTranscript((s) => !s)}
            title="" // remove tooltip hint
          >
            {showTranscript ? "User" : "Off"}
          </button>
        </div>

        <div
          className="panes"
          style={{
            display: "grid",
            gridTemplateColumns: showTranscript ? "minmax(260px, 38%) 1fr" : "1fr",
            gap: 8,
            padding: 8,
            minHeight: 0,
            flex: 1,
            WebkitAppRegion: "no-drag",
          }}
        >
          {showTranscript && (
            <div className="pane" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div className="pane-title">Transcript</div>
              <div className="pane-body" style={{ overflow: "auto" }}>
                {/* TEXT (non-selectable) */}
                <pre className="pre-area" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                  {finalText}
                  {partialText && status !== "paused" && `${partialText} ▌`}
                  {status === "paused" && "[Paused — not recording]"}
                </pre>

                {/* IMAGE PREVIEW — ONLY in Transcript */}
                {shots[0] && (
                  <div style={{ marginTop: 12 }}>
                    <img
                      src={shots[0]}
                      alt="underlay capture"
                      style={{ width: "100%", borderRadius: 6, display: "block", pointerEvents: "none" }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="pane" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div className="pane-title">AI Answer</div>
            <div className="pane-body" style={{ overflow: "auto" }}>
              <pre className="pre-area" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                {aiAnswer || "Press Ask AI to get an answer based on the last 100 words."}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
