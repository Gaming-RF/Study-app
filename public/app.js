// === STATE ===
let state = {
  models: [],
  courses: [],
  materials: [],
  notes: [],
  exams: [],
  currentModel: localStorage.getItem('ollama_model') || '',
  currentCourseId: null,
  currentMaterialId: null,
  currentExam: null,
  speechSynth: window.speechSynthesis,
  isSpeaking: false
};

// === COLOR PICKER STATE & UTILITIES ===
let pickerState = { hue: 260, sat: 75, light: 50, hex: '#6C63FF' };

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60) { r=c; g=x; b=0; } else if (h < 120) { r=x; g=c; b=0; }
  else if (h < 180) { r=0; g=c; b=x; } else if (h < 240) { r=0; g=x; b=c; }
  else if (h < 300) { r=x; g=0; b=c; } else { r=c; g=0; b=x; }
  return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)];
}
function rgbToHex(r, g, b) { return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join(''); }
function hslToHex(h, s, l) { return rgbToHex(...hslToRgb(h, s, l)); }
function hexToHsl(hex) {
  const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s, l = (max+min)/2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    if (max === r) h = ((g-b)/d + (g < b ? 6 : 0))/6;
    else if (max === g) h = ((b-r)/d + 2)/6;
    else h = ((r-g)/d + 4)/6;
    h *= 360;
  }
  return [Math.round(h), Math.round(s*100), Math.round(l*100)];
}

function initColorWheel() {
  const canvas = document.getElementById('color-wheel');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const center = size / 2;
  const radius = center - 2;
  const slider = document.getElementById('color-brightness');
  const hexInput = document.getElementById('color-hex');
  const preview = document.getElementById('color-preview');
  let dragging = false;

  function draw() {
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - center, dy = y - center;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist <= radius) {
          const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
          const sat = (dist / radius) * 100;
          const [r, g, b] = hslToRgb(angle, sat, pickerState.light);
          const i = (y * size + x) * 4;
          img.data[i] = r; img.data[i+1] = g; img.data[i+2] = b; img.data[i+3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    // Border
    ctx.beginPath(); ctx.arc(center, center, radius, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.stroke();
    // Cursor
    const ca = pickerState.hue * Math.PI / 180;
    const cd = (pickerState.sat / 100) * radius;
    const cx = center + cd * Math.cos(ca), cy = center + cd * Math.sin(ca);
    ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI*2);
    ctx.fillStyle = pickerState.hex; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 8.5, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.stroke();
  }

  function pick(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (size / rect.width);
    const y = (e.clientY - rect.top) * (size / rect.height);
    const dx = x - center, dy = y - center;
    let dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > radius) dist = radius;
    pickerState.hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
    pickerState.sat = (dist / radius) * 100;
    pickerState.hex = hslToHex(pickerState.hue, pickerState.sat, pickerState.light);
    sync();
  }

  function sync() {
    hexInput.value = pickerState.hex;
    preview.style.backgroundColor = pickerState.hex;
    draw();
    document.querySelectorAll('#course-colors .color-swatch').forEach(s => {
      s.classList.toggle('selected', s.dataset.color.toLowerCase() === pickerState.hex.toLowerCase());
    });
  }

  canvas.addEventListener('mousedown', e => { dragging = true; pick(e); });
  canvas.addEventListener('mousemove', e => { if (dragging) pick(e); });
  window.addEventListener('mouseup', () => { dragging = false; });

  slider.addEventListener('input', e => {
    pickerState.light = parseInt(e.target.value);
    pickerState.hex = hslToHex(pickerState.hue, pickerState.sat, pickerState.light);
    sync();
  });

  hexInput.addEventListener('input', e => {
    const v = e.target.value;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      pickerState.hex = v;
      const [h, s, l] = hexToHsl(v);
      pickerState.hue = h; pickerState.sat = s; pickerState.light = l;
      slider.value = l;
      preview.style.backgroundColor = v;
      draw();
    }
  });

  document.querySelectorAll('#course-colors .color-swatch').forEach(s => {
    s.addEventListener('click', () => {
      pickerState.hex = s.dataset.color;
      const [h, sat, l] = hexToHsl(s.dataset.color);
      pickerState.hue = h; pickerState.sat = sat; pickerState.light = l;
      slider.value = l;
      sync();
    });
  });

  draw();
  sync();
}

// === DOM ELEMENTS ===
const els = {
  navBtns: document.querySelectorAll('.nav-btn'),
  views: document.querySelectorAll('.view'),
  modal: document.getElementById('modal-overlay'),
  loading: document.getElementById('loading-overlay'),
  toast: document.getElementById('toast-container'),
  ollamaBadge: document.getElementById('ollama-badge'),
  modelSelect: document.getElementById('model-select'),
  // Containers
  coursesGrid: document.getElementById('courses-grid'),
  materialsList: document.getElementById('materials-list'),
  notesList: document.getElementById('notes-list'),
  examsList: document.getElementById('exams-list'),
  statsGrid: document.getElementById('stats-grid'),
  recentMaterials: document.getElementById('recent-materials-list'),
  recentNotes: document.getElementById('recent-notes-list'),
  installedModelsList: document.getElementById('installed-models-list'),
  // Filters
  materialsCourseFilter: document.getElementById('materials-course-filter'),
  chatMaterialSelect: document.getElementById('chat-material-select')
};

// === INIT ===
async function init() {
  setupNavigation();
  setupEvents();
  setupWindowControls();
  await checkOllama();
  await loadAllData();
  switchView('dashboard');
}

function setupWindowControls() {
  document.getElementById('btn-minimize').addEventListener('click', () => window.api.minimize());
  document.getElementById('btn-maximize').addEventListener('click', () => window.api.maximize());
  document.getElementById('btn-close').addEventListener('click', () => window.api.close());
}

// === OLLAMA ===
async function checkOllama() {
  try {
    const data = await window.api.ollamaStatus();
    if (data.connected) {
      els.ollamaBadge.textContent = 'Online';
      els.ollamaBadge.className = 'badge online';
      state.models = data.models;
      
      const options = state.models.map(m => 
        `<option value="${m.name}" ${state.currentModel === m.name ? 'selected' : ''}>${m.name} (${(m.size/1024/1024/1024).toFixed(1)}GB)</option>`
      ).join('');
      els.modelSelect.innerHTML = options || '<option value="">No models installed</option>';
      
      if (!state.currentModel && state.models.length > 0) {
        state.currentModel = state.models[0].name;
        localStorage.setItem('ollama_model', state.currentModel);
      }
      renderModels();
    } else {
      throw new Error(data.error || 'Cannot connect');
    }
  } catch (err) {
    els.ollamaBadge.textContent = 'Offline';
    els.ollamaBadge.className = 'badge';
    els.modelSelect.innerHTML = '<option value="">Ollama Offline</option>';
    showToast('Could not connect to Ollama. Make sure it is running locally.', 'error');
  }
}

// === DATA LOADING ===
async function loadAllData() {
  try {
    const [courses, materials, notes, exams] = await Promise.all([
      window.api.getCourses(),
      window.api.getMaterials(),
      window.api.getNotes(),
      window.api.getExams()
    ]);
    state.courses = courses;
    state.materials = materials;
    state.notes = notes;
    state.exams = exams;
    
    updateFilters();
    renderDashboard();
    renderCourses();
    renderMaterials();
    renderNotes();
    renderExams();
  } catch (err) {
    console.error("Failed to load data", err);
  }
}

async function loadMaterials() {
  const filter = els.materialsCourseFilter.value;
  state.materials = await window.api.getMaterials({ courseId: filter || undefined });
  renderMaterials();
}

function updateFilters() {
  const options = '<option value="">All Courses</option>' + 
    state.courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  els.materialsCourseFilter.innerHTML = options;
  
  const chatOptions = '<option value="">General Chat (No Context)</option>' +
    state.materials.map(m => `<option value="${m.id}">${m.filename}</option>`).join('');
  els.chatMaterialSelect.innerHTML = chatOptions;
}

// === UI: NAVIGATION ===
function setupNavigation() {
  els.navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      els.navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      switchView(btn.dataset.view);
    });
  });
}

function switchView(viewId) {
  // Remove active from all views, then activate the target
  els.views.forEach(v => v.classList.remove('active'));
  const target = document.getElementById(`view-${viewId}`);
  if (target) target.classList.add('active');
  
  // Also update nav button highlighting for main views
  const navBtn = document.querySelector(`.nav-btn[data-view="${viewId}"]`);
  if (navBtn) {
    els.navBtns.forEach(b => b.classList.remove('active'));
    navBtn.classList.add('active');
  }
  
  if (viewId === 'dashboard') renderDashboard();
  if (viewId === 'courses') renderCourses();
  if (viewId === 'materials') renderMaterials();
  if (viewId === 'notes') renderNotes();
  if (viewId === 'exams') renderExams();
  if (viewId === 'models') checkOllama();
}

function setupEvents() {
  els.modelSelect.addEventListener('change', (e) => {
    state.currentModel = e.target.value;
    localStorage.setItem('ollama_model', state.currentModel);
  });
}

// === UI RENDERING (Dashboard, Courses, Materials, Notes, Exams) ===
// (Render functions adapted to use hidden instead of display:none where appropriate)

function renderDashboard() {
  els.statsGrid.innerHTML = `
    <div class="stat-card">
      <div class="stat-icon purple"><span class="material-symbols-rounded">school</span></div>
      <div><div class="stat-value">${state.courses.length}</div><div class="stat-label">Courses</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon pink"><span class="material-symbols-rounded">description</span></div>
      <div><div class="stat-value">${state.materials.length}</div><div class="stat-label">Materials</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon green"><span class="material-symbols-rounded">edit_note</span></div>
      <div><div class="stat-value">${state.notes.length}</div><div class="stat-label">Notes</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon orange"><span class="material-symbols-rounded">quiz</span></div>
      <div><div class="stat-value">${state.exams.length}</div><div class="stat-label">Exams</div></div>
    </div>
  `;

  const recentM = [...state.materials].sort((a,b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)).slice(0, 5);
  els.recentMaterials.innerHTML = recentM.length ? recentM.map(m => `
    <div class="material-item" style="padding: 10px;" onclick="viewMaterial('${m.id}')">
      <div class="material-icon ${m.type.replace('.','')}" style="width: 32px; height: 32px; font-size: 16px;">
        <span class="material-symbols-rounded">description</span>
      </div>
      <div class="material-info"><h4 style="font-size: 0.85rem; margin: 0;">${m.filename}</h4></div>
    </div>
  `).join('') : '<p class="text-muted" style="font-size: 0.85rem; padding: 10px;">No materials uploaded yet.</p>';

  const recentN = [...state.notes].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  els.recentNotes.innerHTML = recentN.length ? recentN.map(n => `
    <div class="material-item" style="padding: 10px;" onclick="viewNote('${n.id}')">
      <div class="material-icon txt" style="width: 32px; height: 32px; font-size: 16px;">
        <span class="material-symbols-rounded">edit_note</span>
      </div>
      <div class="material-info"><h4 style="font-size: 0.85rem; margin: 0;">${n.title}</h4></div>
    </div>
  `).join('') : '<p class="text-muted" style="font-size: 0.85rem; padding: 10px;">No notes generated yet.</p>';
}

function renderCourses() {
  if (state.courses.length === 0) {
    els.coursesGrid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1">
        <span class="material-symbols-rounded">school</span>
        <h3>No courses yet</h3>
        <p>Create your first course to start organizing your study materials.</p>
        <button class="btn btn-primary" onclick="showCreateCourseModal()" style="margin-top: 16px;">Create Course</button>
      </div>`;
    return;
  }
  els.coursesGrid.innerHTML = state.courses.map(c => {
    const mCount = state.materials.filter(m => m.courseId === c.id).length;
    return `
    <div class="course-card" style="border-top-color: ${c.color}">
      <div class="course-actions">
        <button class="btn btn-ghost" onclick="deleteCourse('${c.id}', event)" style="padding: 4px;">
          <span class="material-symbols-rounded" style="font-size: 18px">delete</span>
        </button>
      </div>
      <h3>${c.name}</h3>
      <p>${c.description || 'No description'}</p>
      <div class="course-meta">
        <span><span class="material-symbols-rounded" style="font-size: 14px; vertical-align: text-bottom;">description</span> ${mCount} Materials</span>
      </div>
    </div>`
  }).join('');
}

function renderMaterials() {
  if (state.materials.length === 0) {
    els.materialsList.innerHTML = `
      <div class="empty-state">
        <span class="material-symbols-rounded">description</span>
        <h3>No materials found</h3>
        <p>Upload PDFs, Word docs, or Text files to study from.</p>
      </div>`;
    return;
  }
  els.materialsList.innerHTML = state.materials.map(m => {
    const course = state.courses.find(c => c.id === m.courseId);
    const ext = m.type.replace('.', '');
    return `
    <div class="material-item" onclick="viewMaterial('${m.id}')">
      <div class="material-icon ${ext}"><span class="material-symbols-rounded">${ext === 'pdf' ? 'picture_as_pdf' : ext === 'docx' ? 'article' : 'description'}</span></div>
      <div class="material-info">
        <h4>${m.filename}</h4>
        <span>${course ? course.name : 'Unknown Course'} • ${(m.size / 1024 / 1024).toFixed(2)} MB</span>
      </div>
      <button class="btn btn-danger" onclick="deleteMaterial('${m.id}', event)"><span class="material-symbols-rounded">delete</span></button>
    </div>`
  }).join('');
}

function renderNotes() {
  if (state.notes.length === 0) {
    els.notesList.innerHTML = `<div class="empty-state" style="grid-column: 1/-1"><span class="material-symbols-rounded">edit_note</span><h3>No notes found</h3><p>Generate notes from your study materials using AI.</p></div>`;
    return;
  }
  els.notesList.innerHTML = state.notes.map(n => {
    const course = state.courses.find(c => c.id === n.courseId);
    return `
    <div class="note-card" onclick="viewNote('${n.id}')">
      <h4>${n.title}</h4>
      <div class="note-preview">${n.content.replace(/#/g, '').substring(0, 150)}...</div>
      <div class="note-date">${new Date(n.createdAt).toLocaleDateString()} • ${course ? course.name : ''}</div>
    </div>`
  }).join('');
}

function renderExams() {
  if (state.exams.length === 0) {
    els.examsList.innerHTML = `<div class="empty-state" style="grid-column: 1/-1"><span class="material-symbols-rounded">quiz</span><h3>No mock exams</h3><p>Generate an AI mock exam based on your course materials.</p></div>`;
    return;
  }
  els.examsList.innerHTML = state.exams.map(e => {
    const course = state.courses.find(c => c.id === e.courseId);
    return `
    <div class="exam-card" onclick="takeExam('${e.id}')">
      <h4>${e.title}</h4>
      <div class="exam-meta"><span>${e.questionCount} Questions</span><span>•</span><span style="text-transform: capitalize;">${e.difficulty}</span></div>
      <div class="exam-meta" style="margin-top: 4px;"><span>${course ? course.name : ''}</span></div>
    </div>`
  }).join('');
}

// === MODELS VIEW ===
function renderModels() {
  if (!state.models.length) {
    els.installedModelsList.innerHTML = '<p class="text-muted">No models installed.</p>';
    return;
  }
  els.installedModelsList.innerHTML = state.models.map(m => `
    <div class="model-installed-item">
      <span class="material-symbols-rounded">smart_toy</span>
      <div class="model-name">${m.name}</div>
      <div class="model-size">${(m.size/1024/1024/1024).toFixed(1)} GB</div>
    </div>
  `).join('');
}

function openOllamaLibrary() {
  window.open('https://ollama.com/library', '_blank');
}

async function pullModel() {
  const input = document.getElementById('pull-model-input');
  const modelName = input.value.trim();
  if (!modelName) return showToast('Enter a model name', 'error');

  const progressArea = document.getElementById('pull-progress-area');
  progressArea.classList.remove('hidden');
  progressArea.textContent = `Starting pull for ${modelName}...`;

  window.api.onPullProgress((data) => {
    if (data.error) progressArea.textContent = `Error: ${data.error}`;
    else if (data.status) progressArea.textContent = `${data.status}${data.total ? ` (${Math.round((data.completed/data.total)*100)}%)` : ''}`;
  });

  try {
    await window.api.ollamaPull({ model: modelName });
    showToast(`Successfully downloaded ${modelName}!`);
    input.value = '';
    setTimeout(() => { progressArea.classList.add('hidden'); checkOllama(); }, 2000);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// === ACTIONS (IPC) ===
function showCreateCourseModal() {
  pickerState = { hue: 260, sat: 75, light: 50, hex: '#6C63FF' };
  showModal('Create Course', `
    <form id="create-course-form" onsubmit="createCourse(event)">
      <div class="form-group"><label>Course Name</label><input type="text" id="course-name" required></div>
      <div class="form-group"><label>Description</label><textarea id="course-desc" rows="2"></textarea></div>
      <div class="form-group"><label>Color</label>
        <div class="color-picker-container" id="color-picker">
          <div class="color-wheel-wrapper">
            <canvas class="color-wheel-canvas" id="color-wheel" width="360" height="360"></canvas>
          </div>
          <div class="color-brightness-row">
            <span class="material-symbols-rounded" style="font-size:16px;color:var(--text-muted)">dark_mode</span>
            <input type="range" class="color-brightness-slider" id="color-brightness" min="15" max="85" value="50">
            <span class="material-symbols-rounded" style="font-size:16px;color:var(--text-muted)">light_mode</span>
          </div>
          <div class="color-result-row">
            <div class="color-preview-swatch" id="color-preview" style="background:#6C63FF"></div>
            <input type="text" class="color-hex-input" id="color-hex" value="#6C63FF" maxlength="7" placeholder="#000000">
          </div>
          <div class="color-swatches" id="course-colors">
            <div class="color-swatch selected" style="background:#6C63FF" data-color="#6C63FF"></div>
            <div class="color-swatch" style="background:#00d4aa" data-color="#00d4aa"></div>
            <div class="color-swatch" style="background:#ff4d6a" data-color="#ff4d6a"></div>
            <div class="color-swatch" style="background:#ffb347" data-color="#ffb347"></div>
            <div class="color-swatch" style="background:#8b5cf6" data-color="#8b5cf6"></div>
            <div class="color-swatch" style="background:#3b82f6" data-color="#3b82f6"></div>
            <div class="color-swatch" style="background:#ef4444" data-color="#ef4444"></div>
            <div class="color-swatch" style="background:#10b981" data-color="#10b981"></div>
          </div>
        </div>
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%">Create Course</button>
    </form>
  `);
  initColorWheel();
}

async function createCourse(e) {
  e.preventDefault();
  const name = document.getElementById('course-name').value;
  const description = document.getElementById('course-desc').value;
  const color = pickerState.hex;

  try {
    const course = await window.api.createCourse({ name, description, color });
    state.courses.push(course);
    updateFilters(); renderCourses(); closeModal(); showToast('Course created');
  } catch(err){}
}

async function deleteCourse(id, e) {
  e.stopPropagation();
  if(!confirm('Delete this course and all its materials?')) return;
  try {
    await window.api.deleteCourse(id);
    state.courses = state.courses.filter(c => c.id !== id);
    state.materials = state.materials.filter(m => m.courseId !== id);
    updateFilters(); renderCourses(); renderMaterials(); showToast('Course deleted');
  } catch(err){}
}

function showUploadModal() {
  if (state.courses.length === 0) return showToast('Please create a course first', 'error');
  showModal('Upload Study Material', `
    <form id="upload-form" onsubmit="uploadFiles(event)">
      <div class="form-group"><label>Select Course</label>
        <select id="upload-course" required>${state.courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select>
      </div>
      <div class="form-group">
        <div class="upload-area" id="drop-zone" onclick="selectFiles()">
          <span class="material-symbols-rounded">cloud_upload</span>
          <p>Click to browse files (PDF, DOCX, TXT, MD)</p>
        </div>
        <div id="upload-files-list" class="upload-files-list"></div>
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%" id="upload-btn" disabled>Upload Files</button>
    </form>
  `);
}

let selectedFilePaths = [];
async function selectFiles() {
  const filePaths = await window.api.openFileDialog();
  if (!filePaths || filePaths.length === 0) return;
  selectedFilePaths = filePaths;
  document.getElementById('upload-btn').disabled = false;
  document.getElementById('upload-files-list').innerHTML = filePaths.map(p => `<div class="upload-file-item"><span>${p.split('\\').pop()}</span></div>`).join('');
}

async function uploadFiles(e) {
  e.preventDefault();
  const courseId = document.getElementById('upload-course').value;
  if (!selectedFilePaths.length) return;

  showLoading('Copying & parsing text...');
  try {
    const uploaded = await window.api.uploadFiles({ filePaths: selectedFilePaths, courseId });
    state.materials.push(...uploaded);
    updateFilters(); renderMaterials(); renderDashboard(); closeModal(); showToast('Files uploaded');
  } catch(err) {
    showToast(err.message, 'error');
  } finally { hideLoading(); }
}

async function deleteMaterial(id, e) {
  e.stopPropagation();
  if(!confirm('Delete this material?')) return;
  try {
    await window.api.deleteMaterial(id);
    state.materials = state.materials.filter(m => m.id !== id);
    renderMaterials(); showToast('Material deleted');
  } catch(err){}
}

async function viewMaterial(id) {
  try {
    showLoading('Loading material...');
    const material = await window.api.getMaterial(id);
    state.currentMaterialId = id;
    document.getElementById('material-detail-title').textContent = material.filename;
    document.getElementById('material-detail-content').textContent = material.text || "No text could be extracted.";
    document.getElementById('highlights-panel').classList.add('hidden');
    stopSpeaking(); switchView('material-detail');
  } catch(err) {} finally { hideLoading(); }
}

async function generateNotes() {
  if(!state.currentModel) return showToast('Please select an Ollama model', 'error');
  showLoading(`Generating notes with ${state.currentModel}...`);
  try {
    const note = await window.api.aiGenerateNotes({ materialId: state.currentMaterialId, model: state.currentModel });
    state.notes.push(note); showToast('Notes generated!'); viewNote(note.id);
  } catch(err) { showToast(err.message, 'error'); } finally { hideLoading(); }
}

async function generateHighlights() {
  if(!state.currentModel) return showToast('Please select a model', 'error');
  showLoading(`Finding highlights with ${state.currentModel}...`);
  try {
    const data = await window.api.aiHighlights({ materialId: state.currentMaterialId, model: state.currentModel });
    const panel = document.getElementById('highlights-panel');
    panel.innerHTML = `<h3>Key Highlights</h3>` + data.highlights.map(h => `
      <div class="highlight-item"><div class="hl-text">"${h.text}"</div><div class="hl-reason">${h.importance}</div><span class="hl-cat">${h.category}</span></div>
    `).join('');
    panel.classList.remove('hidden'); showToast('Highlights ready');
  } catch(err) { showToast(err.message, 'error'); } finally { hideLoading(); }
}

function viewNote(id) {
  const note = state.notes.find(n => n.id === id);
  if (!note) return;
  document.getElementById('note-detail-title').textContent = note.title;
  let html = note.content.replace(/^### (.*$)/gim, '<h3>$1</h3>').replace(/^## (.*$)/gim, '<h2>$1</h2>').replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>').replace(/\*(.*)\*/gim, '<em>$1</em>').replace(/^- (.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>').replace(/\n/g, '<br>');
  document.getElementById('note-detail-content').innerHTML = html;
  stopSpeaking(); switchView('note-detail');
}

function showCreateExamModal() {
  if (state.courses.length === 0) return showToast('Please create a course first', 'error');
  showModal('Generate Mock Exam', `
    <form id="create-exam-form" onsubmit="generateExam(event)">
      <div class="form-group"><label>Course</label><select id="exam-course" required>${state.courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div>
      <div class="form-group"><label>Number of Questions</label><input type="number" id="exam-count" min="3" max="20" value="10" required></div>
      <div class="form-group"><label>Difficulty</label><select id="exam-diff"><option value="easy">Easy</option><option value="medium" selected>Medium</option><option value="hard">Hard</option></select></div>
      <div class="form-group"><label>Question Types</label><div class="checkbox-group">
        <label class="checkbox-label"><input type="checkbox" value="multiple_choice" class="exam-types" checked> Multiple Choice</label>
        <label class="checkbox-label"><input type="checkbox" value="true_false" class="exam-types" checked> True / False</label>
        <label class="checkbox-label"><input type="checkbox" value="short_answer" class="exam-types"> Short Answer</label>
      </div></div>
      <button type="submit" class="btn btn-primary" style="width:100%">Generate AI Exam</button>
    </form>
  `);
}

async function generateExam(e) {
  e.preventDefault();
  if(!state.currentModel) return showToast('Please select a model', 'error');
  const courseId = document.getElementById('exam-course').value;
  const count = document.getElementById('exam-count').value;
  const diff = document.getElementById('exam-diff').value;
  const types = Array.from(document.querySelectorAll('.exam-types:checked')).map(cb => cb.value);
  if(!types.length) return showToast('Select at least one question type', 'error');

  showLoading(`AI is crafting your exam (${state.currentModel})...`);
  try {
    const exam = await window.api.aiMockExam({ courseId, model: state.currentModel, questionCount: count, difficulty: diff, questionTypes: types });
    state.exams.push(exam); renderExams(); closeModal(); showToast('Exam generated!'); takeExam(exam.id);
  } catch(err) { showToast(err.message, 'error'); } finally { hideLoading(); }
}

function takeExam(id) {
  const exam = state.exams.find(e => e.id === id);
  if(!exam) return;
  state.currentExam = exam;
  document.getElementById('exam-take-title').textContent = exam.title;
  document.getElementById('exam-results').classList.add('hidden');
  document.getElementById('submit-exam-btn').classList.remove('hidden');

  document.getElementById('exam-questions').innerHTML = exam.questions.map((q, i) => {
    let inputs = '';
    if (q.type === 'multiple_choice' && q.options) {
      inputs = `<div class="option-group" id="q-group-${i}">` + q.options.map((opt, j) => `<label class="option-label"><input type="radio" name="q-${i}" value="${opt.charAt(0)}"> ${opt}</label>`).join('') + '</div>';
    } else if (q.type === 'true_false') {
      inputs = `<div class="option-group" id="q-group-${i}"><label class="option-label"><input type="radio" name="q-${i}" value="true"> True</label><label class="option-label"><input type="radio" name="q-${i}" value="false"> False</label></div>`;
    } else {
      inputs = `<textarea class="q-answer-input" name="q-${i}" rows="3" placeholder="Type answer..."></textarea>`;
    }
    return `
      <div class="question-card" data-idx="${i}" data-type="${q.type}" data-correct="${q.correctAnswer}">
        <div class="q-num">Question ${i + 1}</div><div class="q-type">${q.type.replace('_', ' ')}</div><div class="q-text">${q.question}</div>${inputs}
        <div class="q-explanation hidden" id="exp-${i}"><strong>Explanation:</strong> ${q.explanation || 'None'}<div style="margin-top:8px;"><strong>Correct Answer:</strong> ${q.correctAnswer}</div></div>
      </div>`;
  }).join('');
  switchView('exam-take');
}

function submitExam() {
  if(!state.currentExam) return;
  let score = 0, totalMC = 0;
  document.querySelectorAll('.question-card').forEach((card, i) => {
    const type = card.dataset.type, correct = card.dataset.correct?.toLowerCase().trim();
    document.getElementById(`exp-${i}`).classList.remove('hidden');
    if (type === 'multiple_choice' || type === 'true_false') {
      totalMC++;
      const selected = document.querySelector(`input[name="q-${i}"]:checked`);
      const selectedVal = selected ? selected.value.toLowerCase().trim() : null;
      card.querySelectorAll('.option-label').forEach(lbl => {
        const input = lbl.querySelector('input'); input.disabled = true;
        const val = input.value.toLowerCase().trim();
        if (val === correct || (type==='true_false' && correct.includes(val))) lbl.classList.add('correct');
        else if (selected && selected === input) lbl.classList.add('wrong');
      });
      if (selectedVal === correct || (type==='true_false' && correct.includes(selectedVal))) score++;
    } else {
      const txt = card.querySelector('textarea'); if(txt) txt.disabled = true;
    }
  });

  document.getElementById('submit-exam-btn').classList.add('hidden');
  const resDiv = document.getElementById('exam-results');
  let resultHtml = `<h3>Exam Completed!</h3>`;
  if(totalMC > 0) {
    const perc = Math.round((score / totalMC) * 100);
    resultHtml += `<div class="score" style="color: ${perc>=80?'var(--success)':perc>=60?'var(--warning)':'var(--danger)'}">${score} / ${totalMC}</div><p>Objective Score: ${perc}%</p>`;
  }
  resDiv.innerHTML = resultHtml; resDiv.classList.remove('hidden');
  document.getElementById('main-content').scrollTo({top: 0, behavior: 'smooth'});
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input'), msg = input.value.trim();
  if(!msg) return;
  if(!state.currentModel) return showToast('Please select a model', 'error');

  const container = document.getElementById('chat-messages'), materialId = els.chatMaterialSelect.value;
  container.innerHTML += `<div class="chat-msg user">${escapeHtml(msg)}</div>`;
  input.value = ''; container.scrollTop = container.scrollHeight;

  const loaderId = 'chat-load-' + Date.now();
  container.innerHTML += `<div class="chat-msg assistant" id="${loaderId}"><span class="loader-spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;margin:0"></span> Thinking...</div>`;
  container.scrollTop = container.scrollHeight;

  try {
    const res = await window.api.aiChat({ materialId: materialId || null, model: state.currentModel, message: msg });
    document.getElementById(loaderId).remove();
    container.innerHTML += `<div class="chat-msg assistant markdown-body">${formatMarkdown(res.response)}</div>`;
  } catch(err) {
    document.getElementById(loaderId).textContent = "Error: " + err.message;
  }
  container.scrollTop = container.scrollHeight;
}

document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
});

// TTS
function speakText(text) {
  if (state.isSpeaking) stopSpeaking();
  if (!text) return;
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = speechSynthesis.getVoices().find(v => v.name.includes('Google') && v.lang.includes('en')) || speechSynthesis.getVoices()[0];
  if(voice) utterance.voice = voice;
  utterance.onend = () => { state.isSpeaking = false; document.getElementById('tts-stop-btn').classList.add('hidden'); };
  state.speechSynth.speak(utterance);
  state.isSpeaking = true;
  document.getElementById('tts-stop-btn').classList.remove('hidden');
}
function stopSpeaking() { if (state.speechSynth.speaking) state.speechSynth.cancel(); state.isSpeaking = false; document.getElementById('tts-stop-btn').classList.add('hidden'); }
function speakMaterial() { speakText(document.getElementById('material-detail-content').textContent); }
function speakNote() { speakText(document.getElementById('note-detail-content').innerText); }

// UTILS
function showModal(title, bodyHtml) { document.getElementById('modal-title').textContent = title; document.getElementById('modal-body').innerHTML = bodyHtml; els.modal.classList.add('show'); }
function closeModal() { els.modal.classList.remove('show'); }
function showLoading(text = 'Processing...') { document.getElementById('loading-text').textContent = text; els.loading.classList.remove('hidden'); }
function hideLoading() { els.loading.classList.add('hidden'); }
function showToast(msg, type = 'success') {
  const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = msg; els.toast.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}
function escapeHtml(str) { return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function formatMarkdown(str) { return str.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/`(.*?)`/g, '<code>$1</code>').replace(/\n/g, '<br>'); }

document.addEventListener('DOMContentLoaded', init);
