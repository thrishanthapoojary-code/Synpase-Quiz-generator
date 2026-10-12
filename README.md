# ▲ Synapse • Next-Gen AI Quiz Studio

A high-performance, intelligence-graded assessment application inspired by the **Next.js / Vercel** design system. Powered directly by **Google Gemini 3.8 Flash** with first-class **Dark & Light Mode**, instant client & server execution, and zero-downtime offline fallbacks.

---

## 🌟 Key Highlights

- **🧠 Google Gemini 3.8 Flash Integration**: Generates context-rich multiple-choice questions with full pedagogical explanations, authentic options, and correct answers.
- **🌗 First-Class Dark & Light Themes**: Inspired by Vercel's Geist design system with instant transitions, system preference auto-detection, and local persistence.
- **⚛ Dynamic Curriculum Chapter Boxes**: Curated topic cards across Physics, Chemistry, and Mathematics, plus freeform custom chapter inputs.
- **📊 Granular Question Volume**: Segmented selections for **5, 10, 20, 30, 60**, and custom counts from **1 to 100**.
- **🔊 Web Audio API Feedback**: Synthesized psychological positive reinforcement chimes and error tones without external audio dependencies.
- **⚡ High-Demand Offline Safeguard**: If Gemini API servers encounter rate quotas or outages, a 1-click fallback loads verified curriculum questions.
- **📱 Progressive Web App (PWA)**: Includes `manifest.json` and SVG vector icons for native installation on desktop and mobile.
- **🚀 Dual-Mode Execution**:
  1. **Server Mode**: Run with Node.js (`npm start` or `node server.js`) on `http://localhost:3000` with built-in API proxy.
  2. **Zero-Install Static Mode**: Double-click `index.html` to run directly in any browser without needing Node.js or web servers.

---

## 🏗 Project Architecture

```
/Users/thrishanthapoojary/Downloads/Boot/
├── index.html              # Next.js/Vercel style frontend layout
├── styles.css              # Dark & Light theme design system & grid lines
├── script.js               # Client controller, Gemini integration & audio FX
├── server.js               # Zero-dependency Node.js HTTP server & API proxy
├── package.json            # NPM project manifest and lifecycle scripts
├── .env                    # Environment configuration with Gemini API key
├── .env.example            # Environment configuration template
├── favicon.svg             # Vercel-style geometric SVG brand icon
├── manifest.json           # Progressive Web App (PWA) manifest
├── vercel.json             # Vercel cloud deployment specification
├── Dockerfile              # Production Docker container build
├── docker-compose.yml      # Multi-container orchestration config
├── .dockerignore           # Container build exclusions
├── .gitignore              # Git ignore rules
├── data/
│   └── curriculum.json     # Modular syllabus topics & metadata
└── README.md               # Complete documentation
```

---

## 🚀 Quick Start Guide

### Option 1: Run with Node.js (Recommended)

1. Open your terminal in the `Boot` directory:
   ```bash
   cd /Users/thrishanthapoojary/Downloads/Boot
   ```
2. Start the local server:
   ```bash
   npm start
   # or directly:
   node server.js
   ```
3. Open your browser at:
   ```
   http://localhost:3000
   ```

### Option 2: Standalone Browser Mode (No Server Needed)

Simply double-click or open [index.html](file:///Users/thrishanthapoojary/Downloads/Boot/index.html) in Chrome, Safari, Edge, or Firefox. The client directly executes requests using your configured Gemini Flash key.

### Option 3: Run with Docker

```bash
docker compose up -d
```
The application will be live at `http://localhost:3000`.

---

## 🔑 Gemini API Key Configuration

The Google Gemini API Key is already pre-configured in `.env` and `script.js`. If you wish to change or update it:

1. **In the Web Interface**: Click the **"API Connected"** button in the navigation bar to enter a new key in the modal.
2. **In the `.env` file**:
   ```env
   GEMINI_API_KEY=your_key_here
   ```
3. **In `script.js`**:
   ```javascript
   const DEFAULT_GEMINI_API_KEY = 'your_key_here';
   ```

---

## 📡 API Endpoints (when running `server.js`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/generate-quiz` | Proxies AI question synthesis to Gemini Flash with structured schema |
| `GET` | `/api/health` | Returns server health, engine version, and uptime stats |
| `GET` | `/*` | Static file server for frontend assets |

---

## 📜 License

MIT License. Engineered for maximum speed, pedagogical clarity, and human cognitive engagement.
