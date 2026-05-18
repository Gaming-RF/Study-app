const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// ─── DATA PATHS ────────────────────────────────────────────────────────────────
const USER_DATA = app.getPath('userData');
const UPLOADS_DIR = path.join(USER_DATA, 'uploads');
const DATA_DIR    = path.join(USER_DATA, 'data');

function ensureDirs() {
  [UPLOADS_DIR, DATA_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
}

// ─── JSON DB HELPERS ───────────────────────────────────────────────────────────
function db(name) {
  const file = path.join(DATA_DIR, `${name}.json`);
  return {
    load: () => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : [],
    save: (data) => fs.writeFileSync(file, JSON.stringify(data, null, 2))
  };
}

// ─── TEXT EXTRACTION ───────────────────────────────────────────────────────────
async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  // Code and plain text files
  const textFormats = ['.txt', '.md', '.csv', '.json', '.xml', '.css', '.js', '.py', '.java', '.c', '.cpp', '.h', '.cs', '.php', '.rb', '.go', '.rs', '.ts', '.sh', '.bat', '.ps1'];
  if (textFormats.includes(ext)) return fs.readFileSync(filePath, 'utf-8');

  // HTML
  if (ext === '.html' || ext === '.htm') {
    const { convert } = require('html-to-text');
    return convert(fs.readFileSync(filePath, 'utf-8'));
  }

  // PDF
  if (ext === '.pdf') {
    const pdfParse = require('pdf-parse');
    return (await pdfParse(fs.readFileSync(filePath))).text;
  }

  // Word Docs
  if (ext === '.docx') {
    const mammoth = require('mammoth');
    return (await mammoth.extractRawText({ path: filePath })).value;
  }

  // PowerPoint
  if (ext === '.pptx') {
    const officeParser = require('officeparser');
    try {
      return await officeParser.parseOfficeAsync(filePath);
    } catch (e) { return ''; }
  }

  // Excel
  if (ext === '.xlsx') {
    const xlsx = require('xlsx');
    const workbook = xlsx.readFile(filePath);
    let text = '';
    workbook.SheetNames.forEach(sheetName => {
      text += `--- ${sheetName} ---\n`;
      text += xlsx.utils.sheet_to_csv(workbook.Sheets[sheetName]) + '\n';
    });
    return text;
  }

  // ePub
  if (ext === '.epub') {
    const EPub = require('epub2').EPub;
    const { convert } = require('html-to-text');
    return await new Promise((resolve) => {
      const epub = new EPub(filePath, '/imagewebroot/', '/articlewebroot/');
      epub.on('end', async () => {
        let text = '';
        for (const chapter of epub.flow) {
          try {
            const chapText = await new Promise((res) => epub.getChapter(chapter.id, (err, txt) => res(txt || '')));
            text += convert(chapText) + '\n\n';
          } catch(e) {}
        }
        resolve(text);
      });
      epub.on('error', () => resolve(''));
      epub.parse();
    });
  }

  // Images (OCR)
  if (['.png', '.jpg', '.jpeg', '.bmp', '.webp'].includes(ext)) {
    const Tesseract = require('tesseract.js');
    try {
      const { data: { text } } = await Tesseract.recognize(filePath, 'eng');
      return text;
    } catch(e) { return ''; }
  }

  return '';
}

// ─── OLLAMA HELPER ─────────────────────────────────────────────────────────────
const OLLAMA_URL = 'http://localhost:11434';

async function ollamaChat(model, messages) {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false })
  });
  if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.message.content;
}

// ─── ELECTRON WINDOW ───────────────────────────────────────────────────────────
let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    frame: false,           // Custom titlebar
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0a12',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile(path.join(__dirname, 'public', 'index.html'));

  // Open DevTools in dev mode
  if (process.argv.includes('--dev')) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(() => {
  ensureDirs();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ─── WINDOW CONTROLS ───────────────────────────────────────────────────────────
ipcMain.on('win-minimize', () => win.minimize());
ipcMain.on('win-maximize', () => win.isMaximized() ? win.unmaximize() : win.maximize());
ipcMain.on('win-close',    () => win.close());

// ─── OLLAMA IPC ────────────────────────────────────────────────────────────────
ipcMain.handle('ollama-status', async () => {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!res.ok) throw new Error('not ok');
    const data = await res.json();
    const models = (data.models || []).map(m => ({
      name: m.name,
      size: m.size,
      modified: m.modified_at
    }));
    return { connected: true, models };
  } catch (e) {
    return { connected: false, models: [], error: e.message };
  }
});

ipcMain.handle('ollama-chat', async (_, { model, messages }) => {
  return await ollamaChat(model, messages);
});

ipcMain.handle('ollama-pull-model', async (event, { model }) => {
  // Stream pull progress back via event
  const res = await fetch(`${OLLAMA_URL}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: model, stream: true })
  });
  if (!res.ok) throw new Error(`Pull failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = decoder.decode(value).split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        event.sender.send('pull-progress', obj);
      } catch {}
    }
  }
  return { done: true };
});

// ─── FILE UPLOAD IPC ───────────────────────────────────────────────────────────
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Study Materials', extensions: ['pdf', 'docx', 'pptx', 'xlsx', 'epub', 'txt', 'md', 'csv', 'json', 'html', 'htm', 'png', 'jpg', 'jpeg', 'bmp', 'webp', 'js', 'py', 'java', 'cpp', 'cs'] }]
  });
  return result.filePaths;
});

ipcMain.handle('upload-files', async (_, { filePaths, courseId }) => {
  const materialsDb = db('materials');
  const materials = materialsDb.load();
  const uploaded = [];

  for (const srcPath of filePaths) {
    const ext = path.extname(srcPath).toLowerCase();
    const storedName = `${uuidv4()}${ext}`;
    const destPath = path.join(UPLOADS_DIR, storedName);
    fs.copyFileSync(srcPath, destPath);

    const text = await extractText(destPath);
    const mat = {
      id: uuidv4(),
      courseId,
      filename: path.basename(srcPath),
      storedName,
      size: fs.statSync(destPath).size,
      type: ext,
      text,
      uploadedAt: new Date().toISOString()
    };
    materials.push(mat);
    uploaded.push(mat);
  }

  materialsDb.save(materials);
  return uploaded;
});

// ─── COURSES IPC ───────────────────────────────────────────────────────────────
ipcMain.handle('get-courses', () => db('courses').load());
ipcMain.handle('create-course', (_, course) => {
  const d = db('courses');
  const courses = d.load();
  const newCourse = { id: uuidv4(), ...course, createdAt: new Date().toISOString() };
  courses.push(newCourse);
  d.save(courses);
  return newCourse;
});
ipcMain.handle('delete-course', (_, id) => {
  const cd = db('courses'); const md = db('materials');
  cd.save(cd.load().filter(c => c.id !== id));
  const mats = md.load().filter(m => m.courseId !== id);
  // Remove uploaded files too
  md.load().filter(m => m.courseId === id).forEach(m => {
    const fp = path.join(UPLOADS_DIR, m.storedName);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  });
  md.save(mats);
  return { success: true };
});

// ─── MATERIALS IPC ─────────────────────────────────────────────────────────────
ipcMain.handle('get-materials', (_, { courseId } = {}) => {
  let mats = db('materials').load();
  if (courseId) mats = mats.filter(m => m.courseId === courseId);
  return mats.map(m => ({ ...m, text: m.text ? m.text.substring(0, 300) + '...' : '' }));
});
ipcMain.handle('get-material', (_, id) => {
  return db('materials').load().find(m => m.id === id) || null;
});
ipcMain.handle('delete-material', (_, id) => {
  const d = db('materials');
  const all = d.load();
  const mat = all.find(m => m.id === id);
  if (mat) {
    const fp = path.join(UPLOADS_DIR, mat.storedName);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  d.save(all.filter(m => m.id !== id));
  return { success: true };
});

// ─── NOTES IPC ─────────────────────────────────────────────────────────────────
ipcMain.handle('get-notes', (_, { courseId } = {}) => {
  let notes = db('notes').load();
  if (courseId) notes = notes.filter(n => n.courseId === courseId);
  return notes;
});
ipcMain.handle('save-note', (_, note) => {
  const d = db('notes');
  const notes = d.load();
  const newNote = { id: uuidv4(), ...note, createdAt: new Date().toISOString() };
  notes.push(newNote);
  d.save(notes);
  return newNote;
});
ipcMain.handle('delete-note', (_, id) => {
  const d = db('notes');
  d.save(d.load().filter(n => n.id !== id));
  return { success: true };
});

// ─── EXAMS IPC ─────────────────────────────────────────────────────────────────
ipcMain.handle('get-exams', (_, { courseId } = {}) => {
  let exams = db('exams').load();
  if (courseId) exams = exams.filter(e => e.courseId === courseId);
  return exams;
});
ipcMain.handle('save-exam', (_, exam) => {
  const d = db('exams');
  const exams = d.load();
  const newExam = { id: uuidv4(), ...exam, createdAt: new Date().toISOString() };
  exams.push(newExam);
  d.save(exams);
  return newExam;
});
ipcMain.handle('delete-exam', (_, id) => {
  const d = db('exams');
  d.save(d.load().filter(e => e.id !== id));
  return { success: true };
});

// ─── AI ACTIONS IPC ────────────────────────────────────────────────────────────
ipcMain.handle('ai-generate-notes', async (_, { materialId, model }) => {
  const mat = db('materials').load().find(m => m.id === materialId);
  if (!mat) throw new Error('Material not found');

  const textChunk = mat.text.substring(0, 8000);
  const prompt = `You are an expert study assistant. Analyze the following study material and create comprehensive, well-structured study notes.
Include:
- **Key Concepts** with clear explanations
- **Important Definitions** highlighted
- **Summary Points** as bullet points
- **Key Takeaways** at the end
Use markdown formatting.

Study Material:
"""
${textChunk}
"""`;

  const content = await ollamaChat(model, [
    { role: 'system', content: 'You are a helpful study assistant that creates detailed, well-organized study notes from academic materials.' },
    { role: 'user', content: prompt }
  ]);

  const d = db('notes');
  const notes = d.load();
  const note = { id: uuidv4(), materialId, courseId: mat.courseId, title: `Notes: ${mat.filename}`, content, createdAt: new Date().toISOString() };
  notes.push(note);
  d.save(notes);
  return note;
});

ipcMain.handle('ai-highlights', async (_, { materialId, model }) => {
  const mat = db('materials').load().find(m => m.id === materialId);
  if (!mat) throw new Error('Material not found');

  const textChunk = mat.text.substring(0, 8000);
  const prompt = `Extract the most important highlights from this study material. Return ONLY a JSON array:
[{"text":"highlight text","importance":"why important","category":"definition|concept|formula|fact|date"}]

Material:
"""
${textChunk}
"""`;

  const result = await ollamaChat(model, [
    { role: 'system', content: 'You are a study assistant. Always return valid JSON.' },
    { role: 'user', content: prompt }
  ]);

  let highlights = [];
  try {
    const match = result.match(/\[[\s\S]*\]/);
    if (match) highlights = JSON.parse(match[0]);
  } catch {}
  return { highlights };
});

ipcMain.handle('ai-mock-exam', async (_, { courseId, model, questionCount, questionTypes, difficulty }) => {
  const allMats = db('materials').load().filter(m => m.courseId === courseId);
  if (!allMats.length) throw new Error('No materials for this course');

  let context = allMats.map(m => `--- ${m.filename} ---\n${m.text.substring(0, 3000)}`).join('\n\n');

  const prompt = `Create a mock exam with ${questionCount} questions. Difficulty: ${difficulty}.
Types: ${questionTypes.join(', ')}.

Return ONLY valid JSON:
{
  "title": "Exam title",
  "questions": [
    {
      "id": 1,
      "type": "multiple_choice",
      "question": "...",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correctAnswer": "A",
      "explanation": "..."
    }
  ]
}

Study Materials:
"""
${context.substring(0, 10000)}
"""`;

  const result = await ollamaChat(model, [
    { role: 'system', content: 'You are an expert exam creator. Always return valid JSON only.' },
    { role: 'user', content: prompt }
  ]);

  const match = result.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Could not parse exam from AI. Try again.');
  const examData = JSON.parse(match[0]);

  const d = db('exams');
  const exams = d.load();
  const exam = { id: uuidv4(), courseId, ...examData, difficulty, questionCount: examData.questions?.length || 0, createdAt: new Date().toISOString() };
  exams.push(exam);
  d.save(exams);
  return exam;
});

ipcMain.handle('ai-chat', async (_, { materialId, model, message, history }) => {
  let context = '';
  if (materialId) {
    const mat = db('materials').load().find(m => m.id === materialId);
    if (mat) context = `Study Material (${mat.filename}):\n"""${mat.text.substring(0, 6000)}"""\n\n`;
  }

  const messages = [
    { role: 'system', content: `You are a helpful study tutor. ${context ? 'Use the provided material as context.' : ''}` }
  ];
  if (context) {
    messages.push({ role: 'user', content: context });
    messages.push({ role: 'assistant', content: "I've reviewed the material. How can I help you?" });
  }
  if (history?.length) messages.push(...history);
  messages.push({ role: 'user', content: message });

  const response = await ollamaChat(model, messages);
  return { response };
});
