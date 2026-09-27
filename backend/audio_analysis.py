"""
Astrona audio analysis core.

This module keeps every measurement from the original Astrona script
(RMS, spectral brightness/bandwidth/rolloff, onset/beat strength, chroma,
zero-crossing rate) and adds two things that a simple "biggest chroma bin"
/ naive-peak-picking approach can't do reliably:

1. Key detection via the Krumhansl-Schmuckler key-profile algorithm —
   correlating the track's averaged chroma vector against the 24 major/minor
   tonal profiles derived from human key-perception experiments, instead of
   just picking the loudest pitch class.
2. BPM estimation using librosa's dynamic tempo estimation plus a confidence
   score derived from the tempogram, instead of a single static tempo guess.
"""

from __future__ import annotations

import io
import os
import tempfile
from typing import Any

import librosa
import numpy as np

try:
    import aubio

    _AUBIO_AVAILABLE = True
except Exception:  # aubio not installed, or failed to import for any reason
    _AUBIO_AVAILABLE = False

try:
    from madmom.features.beats import RNNBeatProcessor
    from madmom.features.tempo import TempoEstimationProcessor

    _MADMOM_AVAILABLE = True
except Exception:  # madmom not installed, or failed to import for any reason
    _MADMOM_AVAILABLE = False

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Krumhansl-Schmuckler key profiles (Krumhansl & Kessler, 1982)
MAJOR_PROFILE = np.array(
    [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
)
MINOR_PROFILE = np.array(
    [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
)

MAX_POINTS = 600  # cap on time-series points sent to the browser


def _downsample(values: np.ndarray, max_points: int = MAX_POINTS) -> np.ndarray:
    """Evenly downsample a 1D array so large tracks don't bloat the JSON payload."""
    if values.ndim != 1:
        values = values.reshape(-1)
    n = len(values)
    if n <= max_points:
        return values
    idx = np.linspace(0, n - 1, max_points).astype(int)
    return values[idx]


def _rows(matrix: np.ndarray, max_points: int = MAX_POINTS) -> np.ndarray:
    """Downsample a 2D matrix along its time axis (columns)."""
    n = matrix.shape[1]
    if n <= max_points:
        return matrix
    idx = np.linspace(0, n - 1, max_points).astype(int)
    return matrix[:, idx]


def detect_key(chroma: np.ndarray) -> dict[str, Any]:
    """Estimate musical key via Krumhansl-Schmuckler profile correlation.

    Returns the best-matching key, its mode, and the full ranked correlation
    table so the frontend can show runner-up candidates / confidence.
    """
    mean_chroma = chroma.mean(axis=1)
    # Normalize so track loudness doesn't skew the correlation
    if mean_chroma.sum() > 0:
        mean_chroma = mean_chroma / mean_chroma.sum()

    scores: list[dict[str, Any]] = []
    for shift in range(12):
        major_rot = np.roll(MAJOR_PROFILE, shift)
        minor_rot = np.roll(MINOR_PROFILE, shift)

        major_corr = float(np.corrcoef(mean_chroma, major_rot)[0, 1])
        minor_corr = float(np.corrcoef(mean_chroma, minor_rot)[0, 1])

        scores.append({"key": NOTE_NAMES[shift], "mode": "major", "score": major_corr})
        scores.append({"key": NOTE_NAMES[shift], "mode": "minor", "score": minor_corr})

    scores.sort(key=lambda s: s["score"], reverse=True)
    best = scores[0]

    # Turn the top few correlations into percentages that sum to 100, so the
    # UI can show "this key X%, that key Y%" instead of one hard guess.
    # A softmax over the raw correlations does this: candidates that are
    # close in score get similar percentages (genuine ambiguity), a clear
    # winner gets most of the weight. Because softmax is rank-preserving,
    # `best` above and `top[0]` below are always the same key — and the
    # headline confidence is set to that same top percentage, so the number
    # at the top of the card always matches the number on its own chip.
    top = scores[:5]
    raw = np.array([c["score"] for c in top])
    sharpness = 8.0  # higher = more winner-take-all; tuned for -1..1 correlations
    weights = np.exp((raw - raw.max()) * sharpness)
    weights = weights / weights.sum() * 100

    candidates = [
        {
            "key": c["key"],
            "mode": c["mode"],
            "label": f"{c['key']} {c['mode']}",
            "match_percent": round(float(w), 1),
        }
        for c, w in zip(top, weights)
    ]

    return {
        "key": best["key"],
        "mode": best["mode"],
        "label": f"{best['key']} {best['mode']}",
        "confidence": candidates[0]["match_percent"],
        "candidates": candidates,
    }



def _detect_bpm_aubio(y: np.ndarray, sr: int) -> dict[str, Any] | None:
    """Beat-synchronous BPM estimate via aubio's streaming tempo tracker.

    aubio ships pre-built wheels for Windows/Mac/Linux (no compiler needed,
    unlike madmom), so this is the first engine tried. It works directly on
    the in-memory samples — no temp file required. Returns None on any
    failure so the caller can fall back to the next engine.
    """
    if not _AUBIO_AVAILABLE:
        return None
    try:
        win_s = 1024
        hop_s = 512
        tempo_o = aubio.tempo("default", win_s, hop_s, sr)
        y32 = y.astype(np.float32)

        bpms: list[float] = []
        confidences: list[float] = []
        pos = 0
        while pos + hop_s <= len(y32):
            block = y32[pos : pos + hop_s]
            is_beat = tempo_o(block)
            if is_beat:
                bpms.append(float(tempo_o.get_bpm()))
                confidences.append(float(tempo_o.get_confidence()))
            pos += hop_s

        if not bpms:
            return None

        final_bpm = float(np.median(bpms))
        confidence = float(np.clip(np.mean(confidences) * 100, 5, 99))

        return {
            "bpm": round(final_bpm, 1),
            "static_estimate": round(final_bpm, 1),
            "confidence": round(confidence, 1),
            "engine": "aubio",
        }
    except Exception:
        return None


def _detect_bpm_madmom(file_bytes: bytes, suffix: str) -> dict[str, Any] | None:
    """Neural-network beat tracking via madmom, for a sharper BPM estimate.

    madmom's RNN + tempo-histogram pipeline is generally more accurate than
    onset-autocorrelation methods, especially on tracks with syncopation or
    a weak/ambiguous beat. It's an optional dependency: madmom can be
    finicky to install (it needs a C/C++ build toolchain on some platforms),
    so this returns None on any failure and the caller falls back to the
    always-available librosa-based estimate instead of crashing the request.
    """
    if not _MADMOM_AVAILABLE:
        return None

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix or ".wav", delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        activations = RNNBeatProcessor()(tmp_path)
        candidates = TempoEstimationProcessor(fps=100)(activations)  # [[bpm, strength], ...]

        if candidates is None or len(candidates) == 0:
            return None

        best_bpm, best_strength = float(candidates[0][0]), float(candidates[0][1])
        confidence = float(np.clip(best_strength * 100, 5, 99))

        return {
            "bpm": round(best_bpm, 1),
            "static_estimate": round(best_bpm, 1),
            "confidence": round(confidence, 1),
            "engine": "madmom",
        }
    except Exception:
        return None
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass


def _detect_bpm_librosa(y: np.ndarray, sr: int, hop_length: int = 512) -> dict[str, Any]:
    """Estimate tempo directly from the tempogram.

    Different librosa versions have moved the convenience `tempo()` function
    around (`librosa.beat.tempo` -> `librosa.feature.rhythm.tempo` and back),
    so instead of depending on that function's current location, this reads
    the tempo straight out of the tempogram — a lower-level piece of the API
    that has stayed stable across versions — and picks the per-frame BPM with
    the strongest periodicity. The spread across frames doubles as a
    confidence score: a steady beat agrees frame to frame, a shifting or weak
    beat doesn't.
    """
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length)

    try:
        tempogram = librosa.feature.tempogram(
            onset_envelope=onset_env, sr=sr, hop_length=hop_length
        )
        bpm_axis = librosa.tempo_frequencies(tempogram.shape[0], hop_length=hop_length, sr=sr)

        in_range = (bpm_axis >= 40) & (bpm_axis <= 220)
        bpm_axis = bpm_axis[in_range]
        tempogram = tempogram[in_range, :]

        if bpm_axis.size == 0 or tempogram.size == 0:
            raise ValueError("empty tempogram after range filtering")

        frame_best_idx = np.argmax(tempogram, axis=0)
        frame_bpms = bpm_axis[frame_best_idx]

        final_bpm = float(np.median(frame_bpms))
        std_bpm = float(np.std(frame_bpms))
        mean_profile = tempogram.mean(axis=1)
        static_bpm = float(bpm_axis[int(np.argmax(mean_profile))])

    except Exception:
        # Manual fallback: autocorrelate the onset envelope directly and read
        # the lag with the strongest periodicity in the 40-220 BPM window.
        ac = librosa.autocorrelate(onset_env, max_size=len(onset_env))
        frame_rate = sr / hop_length
        min_lag = max(int(frame_rate * 60 / 220), 1)
        max_lag = min(int(frame_rate * 60 / 40), len(ac) - 1)
        if max_lag <= min_lag:
            final_bpm = static_bpm = 120.0
            std_bpm = 40.0
        else:
            window = ac[min_lag:max_lag]
            peak_lag = int(np.argmax(window)) + min_lag
            final_bpm = static_bpm = float(frame_rate * 60 / peak_lag)
            std_bpm = 20.0  # unknown stability in the fallback path

    confidence = float(np.clip(100 - std_bpm * 2, 5, 99))

    return {
        "bpm": round(final_bpm, 1),
        "static_estimate": round(static_bpm, 1),
        "confidence": round(confidence, 1),
        "engine": "librosa",
    }


def _build_bpm_candidates(primary_bpm: float, primary_confidence: float, engine: str) -> list[dict[str, Any]]:
    """List the primary BPM plus its half/double-tempo alternates.

    Automatic tempo detectors frequently lock onto half or double the true
    tempo (e.g. reporting 80 for a track that's actually 160) — it's one of
    the most common failure modes in this field. Rather than silently
    picking one answer, surface all three so a human ear can pick the right
    one in a couple of seconds.
    """
    candidates = [
        {
            "bpm": round(primary_bpm, 1),
            "match_percent": round(primary_confidence, 1),
            "engine": engine,
            "label": "primary",
        }
    ]
    remaining = max(100 - primary_confidence, 10.0)
    # Cap so an alternate can outrank a *low-confidence* primary (which is
    # exactly when the true tempo is most likely the octave, not the
    # detector's first guess) without normally out-ranking a confident one.
    alt_share = min(remaining / 2, primary_confidence * 0.9)

    half, double = primary_bpm / 2, primary_bpm * 2
    if 40 <= half <= 220:
        candidates.append(
            {"bpm": round(half, 1), "match_percent": round(alt_share, 1), "engine": engine, "label": "half-tempo"}
        )
    if 40 <= double <= 220:
        candidates.append(
            {"bpm": round(double, 1), "match_percent": round(alt_share, 1), "engine": engine, "label": "double-tempo"}
        )
    return candidates


def detect_bpm(
    y: np.ndarray, sr: int, file_bytes: bytes | None = None, suffix: str | None = None
) -> dict[str, Any]:
    """BPM estimate, trying engines in order of preference:
    1. aubio (fast, installs cleanly on Windows/Mac/Linux via prebuilt wheels)
    2. madmom (neural network, more accurate but needs a C++ build toolchain)
    3. librosa tempogram (always available — the guaranteed fallback)

    Whichever engine wins, the result also includes half/double-tempo
    alternates as `candidates`, since octave errors are the most common way
    automatic tempo detection goes wrong. Candidates are sorted by
    percentage and the headline bpm/confidence is always set from whichever
    candidate is on top — so the number on the card and the number on its
    own chip never disagree.
    """
    result = _detect_bpm_aubio(y, sr)

    if result is None and file_bytes is not None:
        result = _detect_bpm_madmom(file_bytes, suffix)

    if result is None:
        result = _detect_bpm_librosa(y, sr)

    candidates = _build_bpm_candidates(result["bpm"], result["confidence"], result["engine"])
    candidates.sort(key=lambda c: c["match_percent"], reverse=True)

    top = candidates[0]
    result["bpm"] = top["bpm"]
    result["confidence"] = top["match_percent"]
    result["candidates"] = candidates
    return result


def detect_clipping(y: np.ndarray, sr: int, threshold: float = 0.99, min_gap_sec: float = 0.05) -> dict[str, Any]:
    """Flag where the waveform is hitting (or nearly hitting) full scale.

    Samples above `threshold` (on a -1..1 scale) are treated as clipped /
    distorted. Consecutive clipped samples closer together than
    `min_gap_sec` are merged into a single region so a burst of clipping
    reads as one event, not hundreds of 1-sample blips.
    """
    mask = np.abs(y) >= threshold
    total_samples = len(y)
    clipped_percent = float(mask.sum() / total_samples * 100) if total_samples else 0.0

    if not mask.any():
        return {"clipped_percent": 0.0, "region_count": 0, "regions": []}

    idx = np.where(mask)[0]
    gap_samples = max(int(min_gap_sec * sr), 1)

    regions: list[tuple[int, int]] = []
    start = prev = idx[0]
    for i in idx[1:]:
        if i - prev > gap_samples:
            regions.append((start, prev))
            start = i
        prev = i
    regions.append((start, prev))

    region_list = [
        {"start_sec": round(s / sr, 2), "end_sec": round(e / sr, 2)} for s, e in regions
    ]
    # If there are a lot of short regions, keep the longest ones so the
    # frontend list stays readable, but always report the true count.
    if len(region_list) > 30:
        region_list.sort(key=lambda r: r["end_sec"] - r["start_sec"], reverse=True)
        region_list = region_list[:30]
        region_list.sort(key=lambda r: r["start_sec"])

    return {
        "clipped_percent": round(clipped_percent, 3),
        "region_count": len(regions),
        "regions": region_list,
    }


def analyze_audio(file_bytes: bytes, filename: str | None = None) -> dict[str, Any]:
    """Run the full Astrona feature set on raw audio bytes and return JSON-ready data."""
    y, sr = librosa.load(io.BytesIO(file_bytes), sr=None, mono=True)
    duration = len(y) / sr

    suffix = os.path.splitext(filename)[1] if filename else ".wav"

    rms = librosa.feature.rms(y=y)[0]
    brightness = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)[0]
    rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
    beat_strength = librosa.onset.onset_strength(y=y, sr=sr)
    zcr = librosa.feature.zero_crossing_rate(y)[0]
    chroma = librosa.feature.chroma_stft(y=y, sr=sr)

    time_rms = librosa.times_like(rms, sr=sr)
    time_brightness = librosa.times_like(brightness, sr=sr)
    time_beat = librosa.times_like(beat_strength, sr=sr)

    key_info = detect_key(chroma)
    bpm_info = detect_bpm(y, sr, file_bytes=file_bytes, suffix=suffix)
    distortion_info = detect_clipping(y, sr)

    # Decibel readings. -80 dB floor avoids log(0) on true silence.
    eps = 1e-8
    peak_amplitude = float(np.max(np.abs(y))) if len(y) else 0.0
    peak_db = float(20 * np.log10(max(peak_amplitude, eps)))
    average_loudness_db = float(20 * np.log10(max(float(rms.mean()), eps)))
    rms_db_series = 20 * np.log10(np.maximum(rms, eps))

    chroma_ds = _rows(chroma)
    chroma_time = np.linspace(0, duration, chroma_ds.shape[1]).tolist()

    metrics = {
        "duration_sec": round(duration, 2),
        "sample_rate": sr,
        "rms_mean": float(rms.mean()),
        "rms_std": float(rms.std()),
        "peak_db": round(peak_db, 2),
        "average_loudness_db": round(average_loudness_db, 2),
        "brightness_mean_hz": float(brightness.mean()),
        "brightness_std": float(brightness.std()),
        "bandwidth_mean_hz": float(bandwidth.mean()),
        "bandwidth_std": float(bandwidth.std()),
        "rolloff_mean_hz": float(rolloff.mean()),
        "rolloff_std": float(rolloff.std()),
        "beat_strength_mean": float(beat_strength.mean()),
        "beat_strength_std": float(beat_strength.std()),
        "zcr_mean": float(zcr.mean()),
        "zcr_std": float(zcr.std()),
    }

    series = {
        "rms": {
            "time": _downsample(time_rms).tolist(),
            "values": _downsample(rms).tolist(),
        },
        "loudness_db": {
            "time": _downsample(time_rms).tolist(),
            "values": _downsample(rms_db_series).tolist(),
        },
        "brightness": {
            "time": _downsample(time_brightness).tolist(),
            "values": _downsample(brightness).tolist(),
        },
        "beat_strength": {
            "time": _downsample(time_beat).tolist(),
            "values": _downsample(beat_strength).tolist(),
        },
        "chroma": {
            "time": chroma_time,
            "notes": NOTE_NAMES,
            "matrix": chroma_ds.tolist(),
        },
    }

    return {
        "metrics": metrics,
        "key": key_info,
        "bpm": bpm_info,
        "distortion": distortion_info,
        "series": series,
    }
