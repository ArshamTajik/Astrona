\# 🚀 Astrona



\### Music Analysis \& Audio Signal Processing Platform



\*\*Astrona\*\* is a music analysis project built with \*\*Python, audio signal processing, data analysis, and web technologies\*\*.



The project was created to explore how musical and audio information can be transformed into meaningful data, analytical features, and visual insights.



At its core, Astrona brings together two major interests:



> \*\*Music × Programming\*\*



\---



\## 🎯 Project Goal



Astrona is designed to analyze an audio file, extract meaningful musical and acoustic features, process the resulting data, and present the results in an understandable way.



The project provides hands-on experience with:



\* 🎵 Music Information Retrieval (MIR)

\* 🎧 Audio Signal Processing

\* 📊 Data Analysis

\* 📈 Data Visualization

\* 💻 Python Backend Development

\* 🌐 REST APIs \& Web Applications

\* 🤖 Machine Learning \& AI — future development



Astrona is not intended to be just another audio analyzer.



It is an evolving project built as a bridge between \*\*music, programming, mathematics, data, and artificial intelligence\*\*.



\---



\## 🔍 What Does Astrona Analyze?



Astrona can extract and analyze a range of musical and audio features, including:



\* 🥁 \*\*BPM / Tempo\*\*

\* 🎹 \*\*Musical Key\*\*

\* ⚡ \*\*Energy\*\*

\* 🔊 \*\*Loudness\*\*

\* ✨ \*\*Spectral Brightness\*\*

\* 💃 \*\*Danceability\*\*

\* 🎼 \*\*Chroma / Pitch Class\*\*

\* 📊 \*\*Statistical Audio Features\*\*

\* 📈 \*\*Analytical Visualizations\*\*



The goal is to transform complex audio information into structured data that can be explored and understood.



\---



\## 🎹 Key Detection



Astrona uses \*\*Major and Minor key profiles\*\* to estimate the musical key of an audio recording.



The system evaluates:



\*\*12 Major Keys + 12 Minor Keys = 24 Key Profiles\*\*



The key-detection approach is based on concepts commonly associated with the \*\*Krumhansl–Schmuckler key-finding method\*\*.



This allows Astrona to compare the extracted pitch-class information against different tonal profiles and estimate the most likely musical key.



\---



\## 🥁 BPM \& Tempo Analysis



Astrona extracts the approximate tempo of an audio file using audio-analysis tools such as:



\* \*\*Aubio\*\*

\* \*\*Librosa\*\*

\* \*\*Madmom\*\* \*(optional)\*



The resulting BPM can then be used as one of the main analytical features of the track.



\---



\## 📊 Data Analysis \& Visualization



A major part of Astrona is turning audio signals into structured and visual information.



The project uses:



\* \*\*NumPy\*\* — Numerical Computing

\* \*\*Pandas\*\* — Data Analysis

\* \*\*Matplotlib\*\* — Data Visualization \& Analytical Plots



Matplotlib is used to visualize extracted features and make the analytical results easier to understand.



\---



\## 🛠️ Tech Stack



\### Backend



\* 🐍 \*\*Python\*\*

\* ⚡ \*\*FastAPI\*\*

\* 🚀 \*\*Uvicorn\*\*

\* 🎧 \*\*Librosa\*\*

\* 🔢 \*\*NumPy\*\*

\* 🐼 \*\*Pandas\*\*

\* 📊 \*\*Matplotlib\*\*

\* 🎵 \*\*SoundFile\*\*

\* 🥁 \*\*Aubio\*\*



\### Frontend



\* 🌐 \*\*HTML\*\*

\* 🎨 \*\*CSS\*\*

\* ⚙️ \*\*JavaScript\*\*



\### Core Concepts



\* Audio Signal Processing

\* Music Information Retrieval

\* Feature Extraction

\* Data Analysis

\* Data Visualization

\* Statistical Analysis

\* REST API

\* Web Development

\* Machine Learning

\* Artificial Intelligence



\---



\## 🏗️ Architecture



```text

Audio File

&#x20;   │

&#x20;   ▼

Frontend

&#x20;   │

&#x20;   ▼

FastAPI Backend

&#x20;   │

&#x20;   ▼

Audio Analysis Engine

&#x20;   │

&#x20;   ├── Tempo / BPM

&#x20;   ├── Key Detection

&#x20;   ├── Energy

&#x20;   ├── Loudness

&#x20;   ├── Spectral Features

&#x20;   ├── Chroma

&#x20;   └── Statistical Features

&#x20;   │

&#x20;   ▼

Data Processing

&#x20;   │

&#x20;   ├── NumPy

&#x20;   ├── Pandas

&#x20;   └── Matplotlib

&#x20;   │

&#x20;   ▼

Analysis Results

```



\---



\## 📁 Project Structure



```text

Astrona/

│

├── README.md

├── requirements.txt

├── requirements-optional-madmom.txt

│

├── backend/

│   ├── \_\_init\_\_.py

│   ├── main.py

│   └── audio\_analysis.py

│

└── frontend/

&#x20;   ├── index.html

&#x20;   ├── app.js

&#x20;   └── style.css

```



\---



\## ⚙️ Installation



Clone the repository:



```bash

git clone https://github.com/ArshamTajik/Astrona.git

cd Astrona

```



Install the required dependencies:



```bash

pip install -r requirements.txt

```



Run the FastAPI backend:



```bash

python -m uvicorn backend.main:app --reload

```



The application will then be available locally through the FastAPI server.



\---



\## 🎧 Supported Audio Formats



Astrona supports the following audio formats:



```text

WAV

MP3

FLAC

OGG

M4A

AIFF

AIF

```



\---



\## 🤖 AI \& Future Development



One of the main future directions of Astrona is the integration of \*\*Machine Learning, Deep Learning, and Artificial Intelligence\*\*.



Potential future capabilities include:



\* 🎼 \*\*Genre Classification\*\*

\* 🎭 \*\*Mood Detection\*\*

\* 🎻 \*\*Instrument Recognition\*\*

\* 🎹 \*\*Advanced Key Detection\*\*

\* 🥁 \*\*Beat \& Rhythm Analysis\*\*

\* 🎧 \*\*Music Similarity\*\*

\* 🧬 \*\*Audio Embeddings\*\*

\* 🧠 \*\*Deep Learning Audio Models\*\*

\* 🔎 \*\*Automatic Music Classification\*\*



The long-term goal is to evolve Astrona from a feature-extraction and analysis system into a more intelligent \*\*Music Analysis Platform\*\*.



\---



\## 🚀 Roadmap



\* \[x] Audio Upload

\* \[x] Audio Feature Extraction

\* \[x] BPM Analysis

\* \[x] Key Analysis

\* \[x] Statistical Analysis

\* \[x] Data Visualization

\* \[x] FastAPI Backend

\* \[x] Web Frontend

\* \[ ] Machine Learning Models

\* \[ ] Genre Prediction

\* \[ ] Advanced Music Classification

\* \[ ] Advanced Visualizations

\* \[ ] Audio Embedding Models

\* \[ ] Deep Learning

\* \[ ] Performance Optimization

\* \[ ] Automated Testing

\* \[ ] Expanded API



\---



\## 🌌 Why "Astrona"?



The name \*\*Astrona\*\* was inspired by the idea of exploration.



In astronomy, enormous amounts of data are collected from stars, planets, galaxies, and other objects and then analyzed to reveal hidden information.



Astrona follows a similar idea — but instead of exploring the universe through astronomical data, it explores \*\*sound through data\*\*.



> \*\*Exploring sound through data.\*\*



\---



\## 👤 About the Creator



<div align="center">



\### Arsham Tajik



\*\*Musician • Traditional Singer • Composer • Music Producer • Data Analyst • Python Developer\*\*



</div>



I am \*\*Arsham Tajik\*\*, a musician and traditional Iranian singer, composer, and music producer with a strong interest in programming and data analysis.



Alongside music, I am developing my skills in:



\*\*Python • Data Analysis • Machine Learning • Deep Learning • Artificial Intelligence\*\*



Astrona is one of the projects where these interests come together:



> \*\*Music + Programming + Data\*\*



\---



\## 🧠 AI Vision



The long-term vision of Astrona goes beyond analyzing a few audio features.



The goal is to gradually build systems capable of \*\*recognizing, comparing, classifying, and learning patterns within music\*\*.



The combination of:



\*\*Audio Processing × Data Analysis × Machine Learning × Deep Learning × AI\*\*



creates the foundation for a much more advanced music-analysis platform.



\---



\## 📌 Project Status



\*\*Astrona — Active Development 🚀\*\*



Astrona is an evolving project, and new analytical features, visualizations, and intelligent capabilities are planned for future versions.



\---



<div align="center">



\### 🎵 Music is data. Data tells a story.



\### 🚀 Astrona — Exploring Music Through Data



</div>



