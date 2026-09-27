<div dir="rtl">

# 🚀 Astrona

### پلتفرم تحلیل موسیقی و سیگنال صوتی با Python

**Astrona** یک پروژه‌ی تحلیلی در حوزه‌ی **Music Information Retrieval (MIR)** و پردازش سیگنال صوتی است که با هدف ترکیب **موسیقی، برنامه‌نویسی و تحلیل داده** ساخته شده است.

ایده‌ی اصلی Astrona این است که یک فایل صوتی را دریافت کند، ویژگی‌های مختلف آن را استخراج و تحلیل کند و نتیجه را به شکل داده‌های قابل فهم و نمودارهای تحلیلی نمایش دهد.

---

## 🎯 هدف پروژه

هدف Astrona فقط ساخت یک Audio Analyzer ساده نیست.

این پروژه برای تجربه‌ی عملی در زمینه‌های زیر شکل گرفته است:

* 🎵 تحلیل و پردازش فایل‌های صوتی
* 📊 تحلیل داده و استخراج Feature
* 🧠 پردازش سیگنال صوتی
* 📈 مصورسازی داده‌ها
* 💻 توسعه‌ی Backend با Python
* 🌐 ساخت API و Web Application
* 🤖 ایجاد پایه برای Machine Learning و AI در آینده

Astrona در واقع نقطه‌ی اتصال دو علاقه‌ی اصلی من است:

**Music × Programming**

---

## 🔍 Astrona چه چیزهایی را تحلیل می‌کند؟

پس از دریافت فایل صوتی، Astrona می‌تواند مجموعه‌ای از ویژگی‌های موسیقی و صوتی را بررسی کند، از جمله:

* 🥁 **BPM / Tempo**
* 🎹 **Musical Key**
* ⚡ **Energy**
* 🔊 **Loudness**
* ✨ **Spectral Brightness**
* 💃 **Danceability**
* 🎼 **Chroma / Pitch Class**
* 📊 ویژگی‌های آماری سیگنال
* 📈 نمودارها و Visualizationهای تحلیلی

هدف این است که اطلاعات پیچیده‌ی موجود در یک فایل صوتی به داده‌هایی قابل بررسی و قابل فهم تبدیل شود.

---

## 🧠 تحلیل Key

برای تخمین Key، Astrona از پروفایل‌های مربوط به **Major و Minor** استفاده می‌کند و فضای ۲۴ گام موسیقایی را بررسی می‌کند.

این بخش بر پایه‌ی ایده‌های رایج در **Krumhansl–Schmuckler Key-Finding** طراحی شده است.

به این ترتیب سیستم می‌تواند بین:

**12 Major Keys + 12 Minor Keys**

مقایسه انجام دهد و مناسب‌ترین Key را به عنوان خروجی ارائه کند.

---

## 🥁 تحلیل BPM

Astrona برای تخمین Tempo از ابزارهای پردازش صوت استفاده می‌کند و BPM فایل را استخراج می‌کند.

در معماری پروژه امکان استفاده از ابزارهایی مانند:

* **Aubio**
* **Librosa**
* **Madmom** *(اختیاری)*

در نظر گرفته شده است.

---

## 📊 Data Analysis & Visualization

یکی از بخش‌های اصلی Astrona، تبدیل داده‌های صوتی به اطلاعات قابل مشاهده است.

برای این قسمت از ابزارهایی مانند:

* **NumPy** — Numerical Computing
* **Pandas** — Data Analysis
* **Matplotlib** — Data Visualization & Analytical Plots

استفاده شده است.

Matplotlib برای نمایش نمودارها و بررسی بصری ویژگی‌های استخراج‌شده از سیگنال صوتی به کار می‌رود.

---

## 🛠️ Tech Stack

### Backend

* 🐍 **Python**
* ⚡ **FastAPI**
* 🚀 **Uvicorn**
* 🎧 **Librosa**
* 🔢 **NumPy**
* 🐼 **Pandas**
* 📊 **Matplotlib**
* 🎵 **SoundFile**
* 🥁 **Aubio**

### Frontend

* 🌐 **HTML**
* 🎨 **CSS**
* ⚙️ **JavaScript**

### Core Concepts

* Audio Signal Processing
* Music Information Retrieval
* Feature Extraction
* Data Analysis
* Data Visualization
* Statistical Analysis
* REST API
* Web Development
* Machine Learning *(future direction)*
* Artificial Intelligence *(future direction)*

---

## 🏗️ Architecture

ساختار کلی Astrona به شکل زیر است:

```text
Audio File
    │
    ▼
Frontend
    │
    ▼
FastAPI Backend
    │
    ▼
Audio Analysis Engine
    │
    ├── Tempo / BPM
    ├── Key Detection
    ├── Energy
    ├── Loudness
    ├── Spectral Features
    ├── Chroma
    └── Statistical Features
    │
    ▼
Data Processing
    │
    ├── NumPy
    ├── Pandas
    └── Matplotlib
    │
    ▼
Analysis Results
```

---

## 📁 Project Structure

```text
Astrona/
│
├── README.md
├── requirements.txt
├── requirements-optional-madmom.txt
│
├── backend/
│   ├── __init__.py
│   ├── main.py
│   └── audio_analysis.py
│
└── frontend/
    ├── index.html
    ├── app.js
    └── style.css
```

---

## ⚙️ Installation

ابتدا Repository را Clone کنید:

```bash
git clone https://github.com/ArshamTajik/Astrona.git
cd Astrona
```

سپس Dependencies را نصب کنید:

```bash
pip install -r requirements.txt
```

برای اجرای Backend:

```bash
python -m uvicorn backend.main:app --reload
```

پس از اجرای سرور، Web Application از طریق آدرس Local در دسترس خواهد بود.

---

## 🎧 Supported Audio Formats

Astrona برای فرمت‌های زیر طراحی شده است:

```text
WAV
MP3
FLAC
OGG
M4A
AIFF
AIF
```

---

## 🤖 AI & Future Development

یکی از مسیرهای اصلی توسعه‌ی Astrona، اضافه کردن **Machine Learning و Artificial Intelligence** به سیستم تحلیل موسیقی است.

در نسخه‌های آینده، قابلیت‌هایی مانند موارد زیر می‌توانند به پروژه اضافه شوند:

* 🎼 **Genre Classification**
* 🎭 **Mood Detection**
* 🎻 **Instrument Recognition**
* 🎹 **Advanced Key Detection**
* 🥁 **Beat & Rhythm Analysis**
* 🎧 **Music Similarity**
* 🧬 **Audio Embeddings**
* 🧠 **Deep Learning Audio Models**
* 🔎 **Automatic Music Classification**

هدف این بخش تبدیل Astrona از یک سیستم Feature Extraction و Analysis به یک **هوشمندتر Music Analysis Platform** است.

---

## 🚀 Future Roadmap

برنامه‌ی توسعه‌ی Astrona می‌تواند شامل موارد زیر باشد:

* [x] Audio Upload
* [x] Audio Feature Extraction
* [x] BPM Analysis
* [x] Key Analysis
* [x] Statistical Analysis
* [x] Data Visualization
* [x] FastAPI Backend
* [x] Web Frontend
* [ ] Machine Learning Models
* [ ] Genre Prediction
* [ ] Advanced Music Classification
* [ ] More Advanced Visualizations
* [ ] Audio Embedding Models
* [ ] Deep Learning
* [ ] Performance Optimization
* [ ] Automated Testing
* [ ] Expanded API

---

## 🌌 Why "Astrona"?

نام **Astrona** از فضای اکتشاف و تحلیل الهام گرفته شده است.

همان‌طور که در Astronomy داده‌های عظیمی از ستاره‌ها و اجرام آسمانی جمع‌آوری و تحلیل می‌شوند، Astrona تلاش می‌کند دنیای پیچیده‌ی یک فایل صوتی را به داده‌های قابل تحلیل تبدیل کند.

**Exploring sound through data.**

---

## 👤 About the Creator

<div align="center">

### Arsham Tajik

**Musician • Traditional Singer • Composer • Music Producer • Data Analyst • Python Developer**

</div>

من **Arsham Tajik** هستم؛ موسیقی و برنامه‌نویسی دو بخش مهم مسیر من هستند.

در موسیقی، به عنوان خواننده‌ی موسیقی سنتی ایرانی، نوازنده و آهنگساز فعالیت می‌کنم و در زمینه‌ی تولید موسیقی نیز کار می‌کنم.

در کنار موسیقی، مسیر برنامه‌نویسی و Data Analysis را دنبال می‌کنم و به حوزه‌های:

**Python • Data Analysis • Machine Learning • Deep Learning • Artificial Intelligence**

علاقه‌مندم.

Astrona نتیجه‌ی ترکیب این دو مسیر است:

> **Music + Programming + Data**

---

## 🧠 AI Vision

چشم‌انداز بلندمدت Astrona فقط تحلیل چند Feature صوتی نیست.

هدف این است که پروژه به مرور به سمت سیستم‌هایی حرکت کند که بتوانند **الگوهای موسیقی را درک، مقایسه و طبقه‌بندی کنند**.

ترکیب:

**Audio Processing × Data Analysis × Machine Learning × Deep Learning × AI**

می‌تواند مسیر Astrona را به سمت یک پلتفرم پیشرفته‌تر برای تحلیل موسیقی هدایت کند.

---

## 📌 Project Status

**Astrona — Active Development 🚀**

این پروژه همچنان در حال توسعه است و قابلیت‌های جدید در نسخه‌های آینده به آن اضافه خواهند شد.

---

<div align="center">

### 🎵 Music is data. Data tells a story.

### 🚀 Astrona — Exploring Music Through Data

</div>

</div>
