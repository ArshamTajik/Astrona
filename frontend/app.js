/* ---------- Ambient starfield (single orchestrated background effect) ---------- */

(function starfield() {
  const canvas = document.getElementById("starfield");
  const ctx = canvas.getContext("2d");
  let stars = [];
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const count = Math.floor((canvas.width * canvas.height) / 9000);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.2,
      drift: Math.random() * 0.15 + 0.02,
      twinkle: Math.random() * Math.PI * 2,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of stars) {
      s.twinkle += 0.015;
      const alpha = 0.35 + Math.sin(s.twinkle) * 0.25;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(243, 241, 255, ${Math.max(alpha, 0.08)})`;
      ctx.fill();
      if (!prefersReducedMotion) {
        s.y += s.drift;
        if (s.y > canvas.height) s.y = 0;
      }
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  resize();
  draw();
})();

/* ---------- Ambient hero waveform ---------- */

(function heroWave() {
  const canvas = document.getElementById("hero-wave");
  const ctx = canvas.getContext("2d");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let t = 0;

  function resize() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }

  function draw() {
    resize();
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const layers = [
      { amp: h * 0.05, freq: 0.006, speed: 0.4, color: "rgba(124, 92, 255, 0.35)" },
      { amp: h * 0.035, freq: 0.009, speed: -0.55, color: "rgba(53, 231, 215, 0.28)" },
      { amp: h * 0.02, freq: 0.013, speed: 0.7, color: "rgba(243, 241, 255, 0.12)" },
    ];

    for (const layer of layers) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const y =
          h * 0.55 +
          Math.sin(x * layer.freq + t * layer.speed) * layer.amp +
          Math.sin(x * layer.freq * 2.3 + t * layer.speed * 1.4) * layer.amp * 0.3;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = layer.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (!prefersReducedMotion) t += 0.02;
    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  draw();
})();

/* ---------- Upload + analysis ---------- */

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const statusLine = document.getElementById("status-line");
const dashboard = document.getElementById("dashboard");

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});
dropzone.setAttribute("tabindex", "0");
dropzone.setAttribute("role", "button");

["dragenter", "dragover"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  })
);
["dragleave", "drop"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
  })
);
dropzone.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

function setStatus(message, isError = false) {
  statusLine.textContent = message;
  statusLine.classList.toggle("is-error", isError);
}

async function handleFile(file) {
  setStatus(`Analyzing ${file.name}…`);
  dashboard.classList.add("hidden");

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("/api/analyze", { method: "POST", body: formData });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Analysis failed.");
    }

    setStatus(`Analyzed ${file.name}`);
    renderResults(data);
  } catch (err) {
    setStatus(err.message || "Something went wrong.", true);
  }
}

/* ---------- Rendering ---------- */

function renderResults(data) {
  document.getElementById("filename-label").textContent = data.filename || "";

  // The dashboard must be visible (not display:none) before we measure
  // canvas container widths, or the charts compute a width of 0 and draw
  // nothing. Un-hide first, then render.
  dashboard.classList.remove("hidden");

  renderReadouts(data.bpm, data.key);
  renderMetricGrid(data.metrics);
  renderDistortion(data.distortion);
  renderLineChart("chart-rms", data.series.rms, "#7c5cff");
  renderLineChart("chart-db", data.series.loudness_db, "#ff8a8a");
  renderLineChart("chart-brightness", data.series.brightness, "#35e7d7");
  renderLineChart("chart-beat", data.series.beat_strength, "#f3f1ff");
  renderChroma(data.series.chroma);

  dashboard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderReadouts(bpm, key) {
  document.getElementById("bpm-value").textContent = bpm.bpm.toFixed(1);
  const engineLabel = bpm.engine || "librosa";
  document.getElementById("bpm-confidence-text").textContent = `${bpm.confidence}% (${engineLabel})`;
  document.getElementById("key-value").textContent = key.label;
  document.getElementById("key-confidence-text").textContent = `${key.confidence}%`;

  renderCandidateChips("bpm-candidates", bpm.candidates, (c) => `${c.bpm} BPM · ${c.match_percent}%`);
  renderCandidateChips("key-candidates", key.candidates, (c) => `${c.label} · ${c.match_percent}%`);

  requestAnimationFrame(() => {
    document.getElementById("bpm-confidence-fill").style.width = `${bpm.confidence}%`;
    document.getElementById("key-confidence-fill").style.width = `${key.confidence}%`;
  });
}

function renderCandidateChips(containerId, candidates, labelFn) {
  const el = document.getElementById(containerId);
  el.innerHTML = "";
  if (!candidates || !candidates.length) return;
  candidates.forEach((c, i) => {
    const chip = document.createElement("span");
    chip.className = "candidate-chip" + (i === 0 ? " is-primary" : "");
    chip.textContent = labelFn(c);
    el.appendChild(chip);
  });
}

const METRIC_DEFS = [
  ["rms_mean", "RMS mean", ""],
  ["rms_std", "RMS variation", ""],
  ["peak_db", "Peak level", "dB"],
  ["average_loudness_db", "Average loudness", "dB"],
  ["brightness_mean_hz", "Brightness", "Hz"],
  ["brightness_std", "Brightness variation", "Hz"],
  ["bandwidth_mean_hz", "Bandwidth", "Hz"],
  ["rolloff_mean_hz", "Rolloff", "Hz"],
  ["beat_strength_mean", "Beat strength", ""],
  ["zcr_mean", "Zero-crossing rate", ""],
  ["duration_sec", "Duration", "s"],
];

function formatMetric(value, unit) {
  if (unit === "Hz") return `${Math.round(value).toLocaleString()}`;
  if (unit === "s") return value.toFixed(1);
  if (unit === "dB") return value.toFixed(1);
  return value.toFixed(4);
}

function renderMetricGrid(metrics) {
  const grid = document.getElementById("metric-grid");
  grid.innerHTML = "";
  for (const [key, label, unit] of METRIC_DEFS) {
    const card = document.createElement("div");
    card.className = "metric-card";
    card.innerHTML = `
      <p class="metric-label">${label}</p>
      <p class="metric-value">${formatMetric(metrics[key], unit)}<small>${unit}</small></p>
    `;
    grid.appendChild(card);
  }
}

function renderDistortion(distortion) {
  const summary = document.getElementById("distortion-summary");
  const regionsEl = document.getElementById("distortion-regions");
  regionsEl.innerHTML = "";

  if (!distortion || distortion.clipped_percent === 0) {
    summary.textContent = "No clipping detected — the waveform stays under full scale.";
    const clean = document.createElement("span");
    clean.className = "distortion-clean";
    clean.textContent = "0.0% of samples clipped";
    regionsEl.appendChild(clean);
    return;
  }

  summary.textContent = `${distortion.clipped_percent}% of samples are clipped, across ${distortion.region_count} region(s):`;

  distortion.regions.forEach((r) => {
    const chip = document.createElement("span");
    chip.className = "distortion-chip";
    chip.textContent = `${r.start_sec}s – ${r.end_sec}s`;
    regionsEl.appendChild(chip);
  });
}

// Small dependency-free line chart renderer (no CDN / internet required).
function renderLineChart(canvasId, series, color) {
  const canvas = document.getElementById(canvasId);
  const parent = canvas.parentElement;
  parent.style.height = "220px";

  const dpr = window.devicePixelRatio || 1;
  const cssWidth = parent.clientWidth;
  const cssHeight = 220;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  canvas.style.width = cssWidth + "px";
  canvas.style.height = cssHeight + "px";

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const values = series.values;
  const times = series.time;
  if (!values || !values.length) return;

  const pad = { left: 46, right: 10, top: 10, bottom: 20 };
  const w = cssWidth - pad.left - pad.right;
  const h = cssHeight - pad.top - pad.bottom;

  const maxV = Math.max(...values);
  const minV = Math.min(...values);
  const range = maxV - minV || 1;

  ctx.font = "10px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "#5b6284";
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;

  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const y = pad.top + (h / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + w, y);
    ctx.stroke();
    const val = maxV - (range / gridLines) * i;
    ctx.fillText(val.toFixed(2), 2, y + 3);
  }

  ctx.beginPath();
  values.forEach((v, i) => {
    const x = pad.left + (w / Math.max(values.length - 1, 1)) * i;
    const y = pad.top + h - ((v - minV) / range) * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = "round";
  ctx.stroke();

  if (times && times.length) {
    const lastIdx = times.length - 1;
    ctx.fillStyle = "#5b6284";
    ctx.fillText(`${times[0].toFixed(1)}s`, pad.left, cssHeight - 4);
    const mid = times[Math.floor(lastIdx / 2)];
    ctx.fillText(`${mid.toFixed(1)}s`, pad.left + w / 2 - 12, cssHeight - 4);
    ctx.fillText(`${times[lastIdx].toFixed(1)}s`, pad.left + w - 26, cssHeight - 4);
  }
}

function renderChroma(chroma) {
  const canvas = document.getElementById("chroma-canvas");
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  const ctx = canvas.getContext("2d");

  const notes = chroma.notes;
  const matrix = chroma.matrix; // notes x time
  const cols = matrix[0].length;
  const rows = notes.length;
  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;

  let max = 0;
  for (const row of matrix) for (const v of row) if (v > max) max = v;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = matrix[r][c] / (max || 1);
      const hue = 255 - v * 90; // violet -> cyan ramp
      ctx.fillStyle = `hsla(${hue}, 85%, ${35 + v * 30}%, ${0.25 + v * 0.75})`;
      ctx.fillRect(c * cellW, (rows - 1 - r) * cellH, cellW + 0.5, cellH + 0.5);
    }
  }

  ctx.font = "10px IBM Plex Mono";
  ctx.fillStyle = "#8892b0";
  notes.forEach((note, i) => {
    ctx.fillText(note, 4, (rows - 1 - i) * cellH + cellH * 0.7);
  });
}
