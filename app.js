// =========================================
//   PROFERANK — app.js
//   Firebase Firestore + SPA logic
// =========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---- FIREBASE CONFIG ----
// 🔧 Reemplazá con tu configuración real de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB8JiRmUeSOsPvy3bMu6uOiqb6rakqnFac",
  authDomain: "symrank-3d60d.firebaseapp.com",
  projectId: "symrank-3d60d",
  storageBucket: "symrank-3d60d.firebasestorage.app",
  messagingSenderId: "890670128013",
  appId: "1:890670128013:web:1a9fa6c62f8b8af9d9bbc4"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// =========================================
//   ESTADO GLOBAL
// =========================================
let todasLasOpiniones = [];
let selectedStars = 0;

// =========================================
//   TEMA (LIGHT / DARK)
// =========================================
function toggleTheme(checkbox) {
  const theme = checkbox.checked ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("proferank-theme", theme);
}

// Restaurar tema guardado
(function initTheme() {
  const saved = localStorage.getItem("proferank-theme");
  if (saved === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    const sw = document.getElementById("theme-switch");
    if (sw) sw.checked = true;
  }
})();

// =========================================
//   NAVEGACIÓN SPA
// =========================================
function showView(viewName) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));

  document.getElementById(`view-${viewName}`).classList.add("active");
  document.getElementById(`btn-${viewName}`).classList.add("active");

  if (viewName === "leer") cargarOpiniones();
}

// =========================================
//   LEER OPINIONES
// =========================================
async function cargarOpiniones() {
  const spinner   = document.getElementById("loading-spinner");
  const container = document.getElementById("cards-container");
  const emptyState = document.getElementById("empty-state");
  const noResults  = document.getElementById("no-results");

  spinner.style.display = "block";
  container.innerHTML   = "";
  emptyState.classList.add("hidden");
  noResults.classList.add("hidden");
  document.getElementById("results-info").textContent = "";

  try {
    const q   = query(collection(db, "opiniones"), orderBy("fecha", "desc"));
    const snap = await getDocs(q);

    todasLasOpiniones = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    spinner.style.display = "none";

    if (todasLasOpiniones.length === 0) {
      emptyState.classList.remove("hidden");
      return;
    }

    renderOpiniones(todasLasOpiniones);

  } catch (err) {
    spinner.style.display = "none";
    container.innerHTML = `<p style="color:#ef4444;padding:20px">⚠️ Error al cargar opiniones: ${err.message}. Verificá la configuración de Firebase.</p>`;
    console.error("Firebase error:", err);
  }
}

function renderOpiniones(lista) {
  const container  = document.getElementById("cards-container");
  const noResults  = document.getElementById("no-results");
  const emptyState = document.getElementById("empty-state");
  const infoEl     = document.getElementById("results-info");

  container.innerHTML = "";

  if (lista.length === 0) {
    noResults.classList.remove("hidden");
    emptyState.classList.add("hidden");
    infoEl.textContent = "Sin resultados.";
    return;
  }

  noResults.classList.add("hidden");
  infoEl.textContent = `${lista.length} opinión${lista.length !== 1 ? "es" : ""} encontrada${lista.length !== 1 ? "s" : ""}`;

  lista.forEach((op, i) => {
    const card = document.createElement("div");
    card.className = "opinion-card";
    card.style.animationDelay = `${i * 40}ms`;

    const starsHtml = renderStars(op.puntuacion);
    const diaHorario = decodeDiaHorario(op.diaHorario);
    const fechaStr   = formatFecha(op.fecha);

    card.innerHTML = `
      <div class="card-header">
        <div class="card-profesor">👨‍🏫 ${escHtml(op.profesor)}</div>
        <div class="card-stars" title="${op.puntuacion}/5 estrellas">${starsHtml}</div>
      </div>
      <div>
        <span class="card-materia">📚 ${escHtml(op.materia)}</span>
      </div>
      <div class="card-meta">
        <span class="meta-tag">📅 ${escHtml(op.cuatrimestre)}er cuatrimestre ${op.anio}</span>
        <span class="meta-tag">🕐 ${diaHorario}</span>
      </div>
      <div class="card-descripcion">${escHtml(op.descripcion)}</div>
      <div class="card-fecha">Publicado el ${fechaStr}</div>
    `;

    container.appendChild(card);
  });
}

// ---- FILTRADO ----
function filtrarOpiniones() {
  const busqProf = document.getElementById("search-profesor").value.trim().toLowerCase();
  const busqMat  = document.getElementById("search-materia").value.trim().toLowerCase();

  const filtradas = todasLasOpiniones.filter(op => {
    const matchProf = !busqProf || op.profesor?.toLowerCase().includes(busqProf);
    const matchMat  = !busqMat  || op.materia?.toLowerCase().includes(busqMat);
    return matchProf && matchMat;
  });

  renderOpiniones(filtradas);
}

function limpiarBusqueda() {
  document.getElementById("search-profesor").value = "";
  document.getElementById("search-materia").value  = "";
  renderOpiniones(todasLasOpiniones);
}

// =========================================
//   ESCRIBIR OPINIÓN
// =========================================
async function submitOpinion(e) {
  e.preventDefault();

  if (!validarFormulario()) return;

  const dia     = parseInt(document.getElementById("f-dia").value);
  const horario = parseInt(document.getElementById("f-horario").value);
  const diaHorario = (dia * 1000) + horario;

  const data = {
    profesor:     document.getElementById("f-profesor").value.trim(),
    materia:      document.getElementById("f-materia").value,
    cuatrimestre: document.getElementById("f-cuatrimestre").value,
    anio:         parseInt(document.getElementById("f-anio").value),
    diaHorario,
    descripcion:  document.getElementById("f-descripcion").value.trim(),
    puntuacion:   selectedStars,
    fecha:        serverTimestamp()
  };

  setSubmitLoading(true);

  try {
    await addDoc(collection(db, "opiniones"), data);
    showToast("success");
    resetForm();
  } catch (err) {
    showToast("error");
    console.error("Error guardando opinión:", err);
  } finally {
    setSubmitLoading(false);
  }
}

// ---- VALIDACIÓN ----
function validarFormulario() {
  let ok = true;
  const campos = ["profesor", "materia", "cuatrimestre", "anio", "dia", "horario", "descripcion"];

  campos.forEach(id => clearError(id));
  clearError("puntuacion");

  const profesor = document.getElementById("f-profesor").value.trim();
  if (!profesor) { showError("profesor", "El nombre del profesor es obligatorio."); ok = false; }

  const materia = document.getElementById("f-materia").value;
  if (!materia) { showError("materia", "Seleccioná una materia."); ok = false; }

  const cuatrimestre = document.getElementById("f-cuatrimestre").value;
  if (!cuatrimestre) { showError("cuatrimestre", "Seleccioná el cuatrimestre."); ok = false; }

  const anio = parseInt(document.getElementById("f-anio").value);
  if (!anio || anio < 2000 || anio > 2099) {
    showError("anio", "Ingresá un año válido (2000-2099).");
    ok = false;
  }

  const dia = document.getElementById("f-dia").value;
  if (!dia) { showError("dia", "Seleccioná el día."); ok = false; }

  const horario = document.getElementById("f-horario").value;
  if (!horario) { showError("horario", "Seleccioná el horario."); ok = false; }

  const desc = document.getElementById("f-descripcion").value.trim();
  if (!desc) { showError("descripcion", "La descripción es obligatoria."); ok = false; }
  else if (desc.length > 1000) { showError("descripcion", "Máximo 1000 caracteres."); ok = false; }

  if (selectedStars < 1) { showError("puntuacion", "Seleccioná una puntuación."); ok = false; }

  return ok;
}

function showError(id, msg) {
  const el  = document.getElementById(`err-${id}`);
  const inp = document.getElementById(`f-${id}`);
  if (el)  el.textContent = msg;
  if (inp) inp.classList.add("error");
}

function clearError(id) {
  const el  = document.getElementById(`err-${id}`);
  const inp = document.getElementById(`f-${id}`);
  if (el)  el.textContent = "";
  if (inp) inp.classList.remove("error");
}

// ---- RESET ----
function resetForm() {
  document.getElementById("opinion-form").reset();
  selectedStars = 0;
  updateStarUI(0);
  updateCharCounter();
  ["profesor","materia","cuatrimestre","anio","dia","horario","descripcion","puntuacion"]
    .forEach(id => clearError(id));
}

// ---- SUBMIT STATE ----
function setSubmitLoading(loading) {
  const btn = document.getElementById("submit-btn");
  const txt = document.getElementById("submit-text");
  const ld  = document.getElementById("submit-loading");
  btn.disabled   = loading;
  txt.classList.toggle("hidden", loading);
  ld.classList.toggle("hidden", !loading);
}

// =========================================
//   ESTRELLAS
// =========================================
function setStars(n) {
  selectedStars = n;
  updateStarUI(n);
}

function updateStarUI(n) {
  const stars = document.querySelectorAll(".star");
  const labels = ["Sin calificación", "Muy malo", "Malo", "Regular", "Bueno", "Excelente"];
  stars.forEach((s, i) => {
    s.classList.toggle("filled", i < n);
    s.classList.toggle("active", i < n);
  });
  document.getElementById("star-label").textContent = labels[n] || "Sin calificación";
}

// =========================================
//   CONTADOR DE CARACTERES
// =========================================
function updateCharCounter() {
  const txt = document.getElementById("f-descripcion").value;
  const len = txt.length;
  const counter = document.getElementById("char-counter");
  counter.textContent = `${len} / 1000`;
  counter.className = "char-counter";
  if (len > 900)  counter.classList.add("warn");
  if (len >= 1000) counter.classList.add("danger");
}

// =========================================
//   TOAST
// =========================================
function showToast(type) {
  const el = document.getElementById(`toast-${type}`);
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 4000);
}

// =========================================
//   HELPERS
// =========================================
function renderStars(n) {
  return [...Array(5)].map((_, i) => `<span style="color:${i < n ? '#f59e0b' : '#c8e6c9'}">${i < n ? '★' : '☆'}</span>`).join("");
}

function decodeDiaHorario(code) {
  if (!code) return "—";
  const dias    = { 1:"Lunes", 2:"Martes", 3:"Miércoles", 4:"Jueves", 5:"Viernes", 6:"Sábado" };
  const horarios = { 300:"Mañana", 600:"Tarde", 900:"Noche" };
  const dia     = Math.floor(code / 1000);
  const horario = code % 1000;
  return `${dias[dia] || "?"} - ${horarios[horario] || "?"}`;
}

function formatFecha(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("es-AR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

// =========================================
//   EXPOSICIÓN GLOBAL
// =========================================
window.showView       = showView;
window.filtrarOpiniones = filtrarOpiniones;
window.limpiarBusqueda  = limpiarBusqueda;
window.submitOpinion    = submitOpinion;
window.resetForm        = resetForm;
window.setStars         = setStars;
window.updateCharCounter = updateCharCounter;
window.toggleTheme      = toggleTheme;

// ---- INIT ----
cargarOpiniones();
