const { contextBridge, ipcRenderer } = require('electron');

// Expose safe IPC bridge to renderer
contextBridge.exposeInMainWorld('api', {
  // Window controls
  minimize: () => ipcRenderer.send('win-minimize'),
  maximize: () => ipcRenderer.send('win-maximize'),
  close:    () => ipcRenderer.send('win-close'),

  // Ollama
  ollamaStatus:   () => ipcRenderer.invoke('ollama-status'),
  ollamaChat:     (args) => ipcRenderer.invoke('ollama-chat', args),
  ollamaPull:     (args) => ipcRenderer.invoke('ollama-pull-model', args),
  onPullProgress: (cb)  => ipcRenderer.on('pull-progress', (_, data) => cb(data)),

  // Files
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  uploadFiles:    (args) => ipcRenderer.invoke('upload-files', args),

  // Courses
  getCourses:    () => ipcRenderer.invoke('get-courses'),
  createCourse:  (data) => ipcRenderer.invoke('create-course', data),
  deleteCourse:  (id) => ipcRenderer.invoke('delete-course', id),

  // Materials
  getMaterials:   (args) => ipcRenderer.invoke('get-materials', args),
  getMaterial:    (id) => ipcRenderer.invoke('get-material', id),
  deleteMaterial: (id) => ipcRenderer.invoke('delete-material', id),

  // Notes
  getNotes:   (args) => ipcRenderer.invoke('get-notes', args),
  saveNote:   (note) => ipcRenderer.invoke('save-note', note),
  deleteNote: (id) => ipcRenderer.invoke('delete-note', id),

  // Exams
  getExams:   (args) => ipcRenderer.invoke('get-exams', args),
  saveExam:   (exam) => ipcRenderer.invoke('save-exam', exam),
  deleteExam: (id) => ipcRenderer.invoke('delete-exam', id),

  // AI
  aiGenerateNotes: (args) => ipcRenderer.invoke('ai-generate-notes', args),
  aiHighlights:    (args) => ipcRenderer.invoke('ai-highlights', args),
  aiMockExam:      (args) => ipcRenderer.invoke('ai-mock-exam', args),
  aiChat:          (args) => ipcRenderer.invoke('ai-chat', args),
  
  // Settings / API Keys
  getApiKey:       () => ipcRenderer.invoke('get-api-key'),
  saveApiKey:      (key) => ipcRenderer.invoke('save-api-key', key),
});
