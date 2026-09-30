```python
# ============================================================
# ASTRONA AUDIO ANALYSIS
# ------------------------------------------------------------
# This script loads an audio file and extracts several
# important audio features using Librosa, NumPy, and Pandas.
#
# The extracted features describe different characteristics
# of the audio, including energy, spectral brightness,
# rhythmic activity, chroma, bandwidth, rolloff, and
# zero-crossing rate.
# ============================================================


# ------------------------------------------------------------
# IMPORT REQUIRED LIBRARIES
# ------------------------------------------------------------
# Librosa is used for audio loading and music/audio analysis.
# NumPy provides numerical operations and statistical tools.
# Pandas is used to organize extracted features into tables.
# Tkinter provides a simple graphical file-selection dialog.
# Matplotlib is used to visualize audio features over time.
# ------------------------------------------------------------

import librosa
import numpy as np
import pandas as pd
import tkinter
from tkinter import filedialog
import matplotlib.pyplot as plt


# ------------------------------------------------------------
# SELECT AND LOAD THE AUDIO FILE
# ------------------------------------------------------------
# A file-selection window allows the user to choose an audio
# file from the computer.
#
# librosa.load() returns:
#   y  -> the audio waveform as a numerical array
#   sr -> the sample rate of the audio
# ------------------------------------------------------------

file_path = filedialog.askopenfilename()
print(file_path)

y, sr = librosa.load(file_path)

print(f"your sample rate is = {sr}")
print("---------------------------")

print(len(y))
print("---------------------------")


# ------------------------------------------------------------
# RMS / AUDIO ENERGY
# ------------------------------------------------------------
# RMS (Root Mean Square) measures the average energy level
# of the audio signal over short time frames.
#
# Higher RMS values generally indicate stronger/louder
# sections of the audio, while lower values indicate
# quieter sections.
# ------------------------------------------------------------

rms = librosa.feature.rms(y=y)[0]

print(rms)
print("---------------------------")


# ------------------------------------------------------------
# MUSICAL NOTE NAMES
# ------------------------------------------------------------
# These twelve note names correspond to the twelve pitch
# classes used in Western chromatic music.
#
# They are later used as labels for the chroma feature table.
# ------------------------------------------------------------

notes = ['C', 'C#', 'D', 'D#', 'E', 'F',
         'F#', 'G', 'G#', 'A', 'A#', 'B']


# ------------------------------------------------------------
# SPECTRAL BRIGHTNESS
# ------------------------------------------------------------
# Spectral centroid is commonly used as a measure of the
# perceived brightness of a sound.
#
# It represents the weighted center of the frequencies
# present in each audio frame.
# Higher values generally correspond to a brighter sound.
# ------------------------------------------------------------

Brightness = librosa.feature.spectral_centroid(
    y=y,
    sr=sr
)[0]


# Create a time axis so the spectral brightness can be
# visualized according to the position in the audio.

time_brightness = librosa.times_like(
    Brightness,
    sr=sr
)


# ------------------------------------------------------------
# VISUALIZE SPECTRAL BRIGHTNESS
# ------------------------------------------------------------
# This graph shows how the spectral brightness changes
# throughout the audio file.
# ------------------------------------------------------------

plt.figure(figsize=(12, 4))
plt.plot(time_brightness, Brightness)

plt.title("Spectral Brightness Over Time")
plt.xlabel("Time (seconds)")
plt.ylabel("Frequency (Hz)")
plt.grid()

plt.show()


# ------------------------------------------------------------
# SPECTRAL BANDWIDTH
# ------------------------------------------------------------
# Spectral bandwidth describes how spread out the frequency
# content is around the spectral centroid.
#
# A larger bandwidth generally indicates that the audio
# contains a wider range of frequencies.
# ------------------------------------------------------------

spectral_bandwidth = librosa.feature.spectral_bandwidth(
    y=y,
    sr=sr
)


# ------------------------------------------------------------
# SPECTRAL ROLLOFF
# ------------------------------------------------------------
# Spectral rolloff estimates the frequency below which a
# specified percentage of the total spectral energy is found.
#
# It can be useful for describing how much high-frequency
# content exists in an audio signal.
# ------------------------------------------------------------

spectral_rolloff = librosa.feature.spectral_rolloff(
    y=y,
    sr=sr
)


# ------------------------------------------------------------
# RHYTHMIC ACTIVITY / ONSET STRENGTH
# ------------------------------------------------------------
# Onset strength estimates how strongly new musical events
# or transients occur over time.
#
# This can help describe rhythmic activity and changes in
# musical intensity.
# ------------------------------------------------------------

Beat_strength = librosa.onset.onset_strength(
    y=y,
    sr=sr
)


# Create a time axis for the onset-strength data.

time_beat = librosa.times_like(
    Beat_strength,
    sr=sr
)


# ------------------------------------------------------------
# VISUALIZE RHYTHMIC ACTIVITY
# ------------------------------------------------------------
# This graph shows how rhythmic/onset activity changes
# throughout the audio.
# ------------------------------------------------------------

plt.figure(figsize=(12, 4))
plt.plot(time_beat, Beat_strength)

plt.title("Rhythmic Activity Over Time")
plt.xlabel("Time (seconds)")
plt.ylabel("Onset Strength")
plt.grid()

plt.show()


# ------------------------------------------------------------
# CHROMA FEATURES
# ------------------------------------------------------------
# Chroma features represent the intensity of the twelve
# pitch classes (C through B), independent of octave.
#
# This makes chroma particularly useful for analyzing
# harmonic and tonal information in music.
# ------------------------------------------------------------

chroma = librosa.feature.chroma_stft(
    y=y,
    sr=sr
)


# Convert the chroma matrix into a Pandas DataFrame and
# label its twelve rows with musical note names.

df = pd.DataFrame(
    chroma,
    index=notes
)

print(df)
print("---------------------------")


# ------------------------------------------------------------
# SHORT-TIME FOURIER TRANSFORM (STFT)
# ------------------------------------------------------------
# STFT converts the audio waveform from the time domain
# into a time-frequency representation.
#
# It provides the foundation for many spectral audio
# analysis techniques.
# ------------------------------------------------------------

spectrogram = librosa.stft(y)


# ------------------------------------------------------------
# MEL SPECTROGRAM
# ------------------------------------------------------------
# A Mel spectrogram represents the frequency content of audio
# using the Mel scale, which is designed to approximate
# aspects of human pitch perception.
# ------------------------------------------------------------

mel_spectrogram = librosa.feature.melspectrogram(
    y=y,
    sr=sr
)


# ------------------------------------------------------------
# ZERO-CROSSING RATE (ZCR)
# ------------------------------------------------------------
# Zero-crossing rate measures how frequently the audio
# waveform changes sign.
#
# It can provide useful information about the texture and
# characteristics of a sound, especially for signals with
# stronger high-frequency or noisy components.
# ------------------------------------------------------------

zero_crossing_rate = librosa.feature.zero_crossing_rate(y)

print(zero_crossing_rate)


# ------------------------------------------------------------
# CREATE THE AUDIO FEATURE PROFILE
# ------------------------------------------------------------
# Here, the previously calculated audio measurements are
# summarized into a single dictionary.
#
# Mean values describe the average behavior of each feature,
# while standard deviation describes how much that feature
# varies throughout the audio.
# ------------------------------------------------------------

features = {
    "RMS Mean": rms.mean(),
    "RMS Std": rms.std(),

    "Brightness Mean": Brightness.mean(),
    "Brightness Std": Brightness.std(),

    "Bandwidth Mean": spectral_bandwidth.mean(),
    "Bandwidth Std": spectral_bandwidth.std(),

    "Rolloff Mean": spectral_rolloff.mean(),
    "Rolloff Std": spectral_rolloff.std(),

    "Beat Strength Mean": Beat_strength.mean(),
    "Beat Strength Std": Beat_strength.std(),

    "ZCR Mean": zero_crossing_rate.mean(),
    "ZCR Std": zero_crossing_rate.std(),

    # Duration is calculated from the number of audio samples
    # divided by the sample rate.
    "Duration": len(y) / sr
}


# ------------------------------------------------------------
# CONVERT FEATURES INTO A DATAFRAME
# ------------------------------------------------------------
# Pandas is used to organize the extracted audio profile
# into a structured table for easier analysis and future
# processing.
# ------------------------------------------------------------

df_features = pd.DataFrame([features])

print(df_features.T)


# ------------------------------------------------------------
# DISPLAY THE ASTRONA AUDIO PROFILE
# ------------------------------------------------------------
# The following section prints the main statistical
# characteristics of the analyzed audio in a readable format.
# ------------------------------------------------------------

print("\n" + "=" * 40)
print("          ASTRONA AUDIO PROFILE")
print("=" * 40)

print(f"Duration           : {features['Duration']:.2f} sec")
print(f"RMS Mean           : {features['RMS Mean']:.4f}")
print(f"RMS Std            : {features['RMS Std']:.4f}")
print(f"Brightness Mean    : {features['Brightness Mean']:.2f} Hz")
print(f"Brightness Std     : {features['Brightness Std']:.2f}")
print(f"Bandwidth Mean     : {features['Bandwidth Mean']:.2f} Hz")
print(f"Bandwidth Std      : {features['Bandwidth Std']:.2f}")
print(f"Rolloff Mean       : {features['Rolloff Mean']:.2f} Hz")
print(f"Rolloff Std        : {features['Rolloff Std']:.2f}")
print(f"Beat Strength Mean : {features['Beat Strength Mean']:.4f}")
print(f"Beat Strength Std  : {features['Beat Strength Std']:.4f}")
print(f"ZCR Mean           : {features['ZCR Mean']:.4f}")
print(f"ZCR Std            : {features['ZCR Std']:.4f}")


# ------------------------------------------------------------
# AUDIO ENERGY VISUALIZATION
# ------------------------------------------------------------
# A second RMS visualization is created here to show how
# the energy level of the audio changes over time.
# ------------------------------------------------------------

print("\n" + "=" * 40)
print("          ASTRONA AUDIO PROFILE")
print("=" * 40)

print("---------------------------")


# Create the time axis corresponding to the RMS frames.

time = librosa.times_like(
    rms,
    sr=sr
)


# ------------------------------------------------------------
# PLOT AUDIO ENERGY OVER TIME
# ------------------------------------------------------------
# This graph displays the RMS energy of the audio signal
# throughout its duration.
# ------------------------------------------------------------

plt.figure(figsize=(12, 4))
plt.plot(time, rms)

plt.title("Audio Energy Over Time")
plt.xlabel("Time (seconds)")
plt.ylabel("RMS")
plt.grid()

plt.show()
```
