# StudyForge 📚

An AI-powered local study companion built with Electron and Ollama. Study smarter — without sending your data to the cloud.

![StudyForge](https://img.shields.io/badge/version-1.0.0-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey)

---

## ✨ Features

- 📂 **Upload Study Materials** — Supports PDF, DOCX, TXT, and Markdown files
- 🤖 **AI-Generated Notes** — Automatically generate structured study notes from your materials using a local AI model
- 🔍 **Smart Highlights** — Extract the most important concepts, definitions, and facts
- 📝 **Mock Exams** — Generate practice exams with multiple choice and other question types
- 💬 **AI Study Chat** — Ask questions about your materials in a conversational chat interface
- 🔒 **100% Local & Private** — Everything runs on your machine via [Ollama](https://ollama.com). No data leaves your computer.

---

## 🖥️ Prerequisites

Before running StudyForge, make sure you have the following installed:

1. **[Node.js](https://nodejs.org/)** (v18 or higher)
2. **[Ollama](https://ollama.com/)** — for the local AI backend

   After installing Ollama, pull a model to use (recommended):
   ```bash
   ollama pull llama3
   ```

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/Gaming-RF/Study-app.git
cd Study-app
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start the app
```bash
npm start
```

Or run in development mode (with DevTools open):
```bash
npm run dev
```

---

## 📦 Building an Installer

To package the app into a standalone Windows `.exe` installer:

```bash
npm run build
```

The installer will be generated in the `dist/` folder.

> **Note:** Windows may show a SmartScreen warning for unsigned executables. Click "More info" → "Run anyway" to proceed.

---

## 🗂️ Project Structure

```
Study-app/
├── main.js          # Electron main process — IPC handlers, file I/O, Ollama API
├── preload.js       # Electron preload script — secure bridge to renderer
├── package.json     # Project metadata and build configuration
├── public/
│   ├── index.html   # Main app UI
│   ├── app.js       # Renderer process logic
│   └── styles.css   # App styling
└── LICENSE
```

---

## ⚙️ How It Works

StudyForge talks to a locally running **Ollama** instance at `http://localhost:11434`. When you upload a study material, the text is extracted and stored locally. AI features (notes, highlights, exams, chat) send that text to your local Ollama model — no internet connection required for AI features.

---

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
