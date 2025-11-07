import React, { useRef, useState } from "react";

const WS_URL = "ws://localhost:8080/transcribe";

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

const Home = () => {
  const [status, setStatus] = useState("idle"); // idle | connecting | connected | paused | error
  const [finalText, setFinalText] = useState("");
  const [partialText, setPartialText] = useState("");

  const wsRef = useRef(null);
  const mediaRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const audioCtxRef = useRef(null);
  const inputRateRef = useRef(null);

  const lastPartialRef = useRef("");
  const isPausedRef = useRef(false); // used inside onaudioprocess

  const start = async () => {
    if (status === "connected" || status === "paused" || status === "connecting") return;

    setFinalText("");
    setPartialText("");
    setStatus("connecting");

    // 1) WebSocket
    const ws = new WebSocket(WS_URL);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => setStatus("connected");
    ws.onclose = () => setStatus("idle");
    ws.onerror = () => setStatus("error");

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type !== "transcript") return;
        const incoming = msg.transcript || "";
        if (msg.isPartial) {
          if (incoming === lastPartialRef.current) return;
          lastPartialRef.current = incoming;
          setPartialText(incoming);
        } else {
          if (incoming.trim()) {
            setFinalText((prev) => prev + incoming + "\n");
          }
          setPartialText("");
          lastPartialRef.current = "";
        }
      } catch {}
    };

    // 2) Mic + Audio graph
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
        if (isPausedRef.current) return; // do not send mic while paused
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
    isPausedRef.current = true; // stop sending mic frames
    setStatus("paused");
    // tell backend to inject silence to keep AWS stream alive
    try { wsRef.current?.send(JSON.stringify({ type: "pause" })); } catch {}
    // optional: suspend audio context to stop pull & save CPU
    try {
      if (audioCtxRef.current?.state === "running") {
        await audioCtxRef.current.suspend();
      }
    } catch {}
  };

  const resume = async () => {
    if (status !== "paused") return;
    // resume audio context
    try {
      if (audioCtxRef.current?.state === "suspended") {
        await audioCtxRef.current.resume();
      }
    } catch {}
    isPausedRef.current = false;
    setStatus("connected");
    try { wsRef.current?.send(JSON.stringify({ type: "resume" })); } catch {}
  };

  const stop = async () => {
    // stop mic/graph
    try {
      if (processorRef.current) {
        try { processorRef.current.disconnect(); } catch {}
        processorRef.current.onaudioprocess = null;
        processorRef.current = null;
      }
      if (sourceRef.current) {
        try { sourceRef.current.disconnect(); } catch {}
        sourceRef.current = null;
      }
      if (mediaRef.current) {
        mediaRef.current.getTracks().forEach((t) => t.stop());
        mediaRef.current = null;
      }
      if (audioCtxRef.current) {
        try { await audioCtxRef.current.close(); } catch {}
        audioCtxRef.current = null;
      }
    } finally {
      isPausedRef.current = false;
    }

    // close WS
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ type: "stop" })); } catch {}
      try { ws.close(); } catch {}
    }
    wsRef.current = null;
    setStatus("idle");
  };

  return (
    <div style={{ padding: 16, fontFamily: "system-ui" }}>
      <h3>Interview Helper</h3>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={start} disabled={status === "connecting" || status === "connected" || status === "paused"}>
          Start
        </button>
        {status === "connected" && <button onClick={pause}>Pause</button>}
        {status === "paused" && <button onClick={resume}>Resume</button>}
        <button onClick={stop} disabled={status === "idle"}>Stop</button>
        <span style={{ marginLeft: 12 }}>Status: {status}</span>
      </div>

      <pre style={{ whiteSpace: "pre-wrap", border: "1px solid #ddd", padding: 12, minHeight: 200 }}>
        {finalText}
        {partialText && status !== "paused" && `${partialText} ▌`}
        {status === "paused" && "[Paused — not recording]"}
      </pre>
    </div>
  );
};

export default Home;
