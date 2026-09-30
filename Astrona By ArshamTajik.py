import librosa
import numpy as np
import pandas as pd
import tkinter
from tkinter import filedialog
import matplotlib.pyplot as plt
file_path = filedialog.askopenfilename()
print(file_path)
y, sr = librosa.load(file_path)
print(f"your sample rate is = {sr}")
print("---------------------------")
print(len(y))
print("---------------------------")
rms = librosa.feature.rms(y = y)[0]
print(rms)
print("---------------------------")
notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
#print("---------------------------")
Brightness = librosa.feature.spectral_centroid(y = y, sr = sr)[0]

time_brightness = librosa.times_like(
    Brightness,
    sr=sr
)

plt.figure(figsize=(12, 4))
plt.plot(time_brightness, Brightness)

plt.title("Spectral Brightness Over Time")
plt.xlabel("Time (seconds)")
plt.ylabel("Frequency (Hz)")
plt.grid()

plt.show()
#print(Brightness)
#print("---------------------------")
spectral_bandwidth = librosa.feature.spectral_bandwidth(y = y, sr = sr)
#print(spectral_bandwidth)
#print("---------------------------")
spectral_rolloff = librosa.feature.spectral_rolloff(y = y, sr = sr)
#print(spectral_rolloff)
#print("---------------------------")
Beat_strength = librosa.onset.onset_strength(y = y, sr = sr)
time_beat = librosa.times_like(
    Beat_strength,
    sr=sr
)

plt.figure(figsize=(12, 4))
plt.plot(time_beat, Beat_strength)

plt.title("Rhythmic Activity Over Time")
plt.xlabel("Time (seconds)")
plt.ylabel("Onset Strength")
plt.grid()

plt.show()
#print(Beat_strength)
#print("---------------------------")
chroma = librosa.feature.chroma_stft(y = y, sr = sr)
df = pd.DataFrame(chroma, index = notes)
#pd.set_option = ('display.max_columns', None)
#pd.set_option = ('display.width', None)
#pd.set_option = ('display.max_rows', None)
print(df)
print("---------------------------")
spectrogram = librosa.stft(y)
#print(spectrogram)
#print("---------------------------")
mel_spectrogram = librosa.feature.melspectrogram(y = y, sr = sr)
#print(mel_spectrogram)
zero_crossing_rate = librosa.feature.zero_crossing_rate(y)
print(zero_crossing_rate)
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

    "Duration": len(y) / sr
}

df_features = pd.DataFrame([features])

print(df_features.T)
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

print("\n" + "=" * 40)
print("          ASTRONA AUDIO PROFILE")
print("=" * 40)
print("---------------------------")
# Time axis
time = librosa.times_like(rms, sr=sr)

# RMS / Energy
plt.figure(figsize=(12, 4))
plt.plot(time, rms)
plt.title("Audio Energy Over Time")
plt.xlabel("Time (seconds)")
plt.ylabel("RMS")
plt.grid()
plt.show()
