// =========================================
//   SYMRANK — app.js
//   Firebase Compat SDK
// =========================================

// ---- FIREBASE CONFIG ----
const firebaseConfig = {
  apiKey: "AIzaSyB8JiRmUeSOsPvy3bMu6uOiqb6rakqnFac",
  authDomain: "symrank-3d60d.firebaseapp.com",
  projectId: "symrank-3d60d",
  storageBucket: "symrank-3d60d.firebasestorage.app",
  messagingSenderId: "890670128013",
  appId: "1:890670128013:web:1a9fa6c62f8b8af9d9bbc4"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// =========================================
//   ESTADO GLOBAL
// =========================================
let todasLasOpiniones  = [];
let selectedStars      = 0;
let profesoresSet      = new Set();   // para autocompletado
let extraProfCount     = 0;           // cantidad de profesores extra agregados

// =========================================
//   TEMA (LIGHT / DARK)
// =========================================
function toggleTheme(checkbox) {
  const theme = checkbox.checked ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("symrank-theme", theme);
}

(function initTheme() {
  const saved = localStorage.getItem("symrank-theme");
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
  document.querySelectorAll(".view").forEach(function(v) { v.classList.remove("active"); });
  document.querySelectorAll(".nav-btn").forEach(function(b) { b.classList.remove("active"); });
  document.getElementById("view-" + viewName).classList.add("active");
  document.getElementById("btn-" + viewName).classList.add("active");
  if (viewName === "leer") cargarOpiniones();
}

// =========================================
//   CARGAR Y RENDERIZAR OPINIONES
// =========================================
async function cargarOpiniones() {
  var spinner    = document.getElementById("loading-spinner");
  var container  = document.getElementById("cards-container");
  var emptyState = document.getElementById("empty-state");
  var noResults  = document.getElementById("no-results");

  spinner.style.display = "block";
  container.innerHTML   = "";
  emptyState.classList.add("hidden");
  noResults.classList.add("hidden");
  document.getElementById("results-info").textContent = "";

  try {
    var snap = await db.collection("opiniones").orderBy("fecha", "desc").get();
    todasLasOpiniones = snap.docs.map(function(doc) {
      return Object.assign({ id: doc.id }, doc.data());
    });

    // Construir set de profesores para autocompletado
    profesoresSet = new Set();
    todasLasOpiniones.forEach(function(op) {
      if (op.profesor) profesoresSet.add(op.profesor.trim());
      if (Array.isArray(op.profesoresSecundarios)) {
        op.profesoresSecundarios.forEach(function(p) { if (p) profesoresSet.add(p.trim()); });
      }
    });

    spinner.style.display = "none";

    renderRanking(todasLasOpiniones);

    if (todasLasOpiniones.length === 0) {
      emptyState.classList.remove("hidden");
      return;
    }

    renderOpiniones(todasLasOpiniones);

  } catch (err) {
    spinner.style.display = "none";
    container.innerHTML = '<p style="color:#ef4444;padding:20px">Error al cargar: ' + err.message + '. Verificá la config de Firebase en app.js.</p>';
    console.error("Firebase error:", err);
  }
}

// ---- RENDERIZAR CARDS ----
function renderOpiniones(lista) {
  var container  = document.getElementById("cards-container");
  var noResults  = document.getElementById("no-results");
  var emptyState = document.getElementById("empty-state");
  var infoEl     = document.getElementById("results-info");

  container.innerHTML = "";

  if (lista.length === 0) {
    noResults.classList.remove("hidden");
    emptyState.classList.add("hidden");
    infoEl.textContent = "Sin resultados.";
    return;
  }

  noResults.classList.add("hidden");
  infoEl.textContent = lista.length + " opinión" + (lista.length !== 1 ? "es" : "") + " encontrada" + (lista.length !== 1 ? "s" : "");

  lista.forEach(function(op, i) {
    var card = document.createElement("div");
    card.className = "opinion-card";
    card.style.animationDelay = (i * 40) + "ms";

    var starsHtml  = renderStars(op.puntuacion);
    var diaHorario = decodeDiaHorario(op.diaHorario);
    var fechaStr   = formatFecha(op.fecha);

    // Profesores secundarios
    var secHtml = "";
    if (Array.isArray(op.profesoresSecundarios) && op.profesoresSecundarios.length > 0) {
      var secNames = op.profesoresSecundarios.filter(Boolean).map(escHtml).join(", ");
      if (secNames) {
        secHtml = '<div class="card-sec-prof">Acompañantes: ' + secNames + '</div>';
      }
    }

    card.innerHTML =
      '<div class="card-header">' +
        '<div class="card-profesor">' + escHtml(op.profesor) + '</div>' +
        '<div class="card-stars" title="' + op.puntuacion + '/5 estrellas">' + starsHtml + '</div>' +
      '</div>' +
      secHtml +
      '<div><span class="card-materia">' + escHtml(op.materia) + '</span></div>' +
      '<div class="card-meta">' +
        '<span class="meta-tag">' + escHtml(op.cuatrimestre) + ' cuatrimestre ' + op.anio + '</span>' +
        '<span class="meta-tag">' + diaHorario + '</span>' +
      '</div>' +
      '<div class="card-descripcion">' + escHtml(op.descripcion) + '</div>' +
      '<div class="card-fecha">Publicado el ' + fechaStr + '</div>';

    container.appendChild(card);
  });
}

// =========================================
//   FILTRADO CON ORDEN POR PROMEDIO
// =========================================
function filtrarOpiniones() {
  var busqProf = document.getElementById("search-profesor").value.trim().toLowerCase();
  var busqMat  = document.getElementById("search-materia").value.trim().toLowerCase();

  var filtradas = todasLasOpiniones.filter(function(op) {
    var matchProf = !busqProf || (op.profesor || "").toLowerCase().includes(busqProf);
    var matchMat  = !busqMat  || (op.materia  || "").toLowerCase().includes(busqMat);
    return matchProf && matchMat;
  });

  // Si hay búsqueda por materia, ordenar por promedio de puntuación del profesor (desc)
  if (busqMat) {
    // Calcular promedio por profesor dentro del filtro
    var promedios = {};
    filtradas.forEach(function(op) {
      var key = (op.profesor || "").toLowerCase();
      if (!promedios[key]) promedios[key] = { suma: 0, cant: 0 };
      promedios[key].suma += op.puntuacion || 0;
      promedios[key].cant += 1;
    });
    filtradas.sort(function(a, b) {
      var ka = (a.profesor || "").toLowerCase();
      var kb = (b.profesor || "").toLowerCase();
      var pa = promedios[ka] ? promedios[ka].suma / promedios[ka].cant : 0;
      var pb = promedios[kb] ? promedios[kb].suma / promedios[kb].cant : 0;
      return pb - pa; // mayor primero
    });
  }

  renderOpiniones(filtradas);
}

function limpiarBusqueda() {
  document.getElementById("search-profesor").value = "";
  document.getElementById("search-materia").value  = "";
  renderOpiniones(todasLasOpiniones);
}

// =========================================
//   RANKING TOP 5
// =========================================
function renderRanking(opiniones) {
  var rankingEl = document.getElementById("ranking-list");

  if (!opiniones || opiniones.length === 0) {
    rankingEl.innerHTML = '<p class="ranking-empty">Todavía no hay datos suficientes.</p>';
    return;
  }

  // Agrupar por profesor
  var mapa = {};
  opiniones.forEach(function(op) {
    var nombre = (op.profesor || "").trim();
    if (!nombre) return;
    if (!mapa[nombre]) mapa[nombre] = { suma: 0, cant: 0 };
    mapa[nombre].suma += op.puntuacion || 0;
    mapa[nombre].cant += 1;
  });

  // Convertir a array y ordenar
  var lista = Object.keys(mapa).map(function(nombre) {
    return {
      nombre: nombre,
      promedio: mapa[nombre].suma / mapa[nombre].cant,
      cantidad: mapa[nombre].cant
    };
  });

  lista.sort(function(a, b) { return b.promedio - a.promedio; });
  var top5 = lista.slice(0, 5);

  if (top5.length === 0) {
    rankingEl.innerHTML = '<p class="ranking-empty">Todavía no hay datos suficientes.</p>';
    return;
  }

  rankingEl.innerHTML = "";
  top5.forEach(function(item, i) {
    var medals = ["🥇", "🥈", "🥉", "4.", "5."];
    var prom   = item.promedio.toFixed(1);
    var stars  = renderStars(Math.round(item.promedio));
    var div    = document.createElement("div");
    div.className = "ranking-item";
    div.innerHTML =
      '<span class="ranking-pos">' + medals[i] + '</span>' +
      '<div class="ranking-info">' +
        '<span class="ranking-nombre">' + escHtml(item.nombre) + '</span>' +
        '<span class="ranking-stars">' + stars + '</span>' +
      '</div>' +
      '<div class="ranking-stats">' +
        '<span class="ranking-prom">' + prom + ' / 5</span>' +
        '<span class="ranking-cant">' + item.cantidad + ' opinión' + (item.cantidad !== 1 ? "es" : "") + '</span>' +
      '</div>';
    rankingEl.appendChild(div);
  });
}

// =========================================
//   AUTOCOMPLETADO DE PROFESORES
// =========================================
function onProfesorInput(input, listId) {
  var val  = input.value.trim().toLowerCase();
  var list = document.getElementById(listId);
  list.innerHTML = "";

  if (!val || val.length < 2) { list.style.display = "none"; return; }

  var matches = Array.from(profesoresSet).filter(function(p) {
    return p.toLowerCase().includes(val);
  }).slice(0, 6);

  if (matches.length === 0) { list.style.display = "none"; return; }

  matches.forEach(function(nombre) {
    var li = document.createElement("li");
    li.className = "autocomplete-item";
    li.textContent = nombre;
    li.addEventListener("mousedown", function() {
      input.value = nombre;
      list.style.display = "none";
    });
    list.appendChild(li);
  });

  list.style.display = "block";
}

function hideAC(listId) {
  setTimeout(function() {
    var list = document.getElementById(listId);
    if (list) list.style.display = "none";
  }, 150);
}

// =========================================
//   PROFESORES EXTRA
// =========================================
function addProfesorExtra() {
  if (extraProfCount >= 3) return;
  extraProfCount++;

  var idx       = extraProfCount; // 1, 2, 3
  var inputId   = "f-profesor" + (idx + 1); // f-profesor2, f-profesor3, f-profesor4
  var acId      = "ac-extra-" + idx;
  var container = document.getElementById("profesores-extra");

  var wrapper = document.createElement("div");
  wrapper.className = "extra-prof-row";
  wrapper.id = "extra-prof-row-" + idx;
  wrapper.style.position = "relative";
  wrapper.innerHTML =
    '<input type="text" id="' + inputId + '" class="form-input" placeholder="Profesor acompañante ' + idx + '"' +
    ' autocomplete="off" oninput="onProfesorInput(this, \'' + acId + '\')" onblur="hideAC(\'' + acId + '\')" />' +
    '<ul class="autocomplete-list" id="' + acId + '"></ul>' +
    '<button type="button" class="btn-remove-prof" onclick="removeProfesorExtra(' + idx + ')" title="Quitar">×</button>';

  container.appendChild(wrapper);

  if (extraProfCount >= 3) {
    document.getElementById("btn-add-prof").disabled = true;
    document.getElementById("btn-add-prof").style.opacity = "0.4";
  }
}

function removeProfesorExtra(idx) {
  var row = document.getElementById("extra-prof-row-" + idx);
  if (row) row.remove();
  extraProfCount--;
  var addBtn = document.getElementById("btn-add-prof");
  addBtn.disabled = false;
  addBtn.style.opacity = "1";
}

// =========================================
//   SUBMIT OPINIÓN
// =========================================
async function submitOpinion(e) {
  e.preventDefault();
  if (!validarFormulario()) return;

  var dia      = parseInt(document.getElementById("f-dia").value);
  var horario  = parseInt(document.getElementById("f-horario").value);
  var diaHorario = (dia * 1000) + horario;

  // Recolectar profesores secundarios
  var profesoresSecundarios = [];
  for (var i = 1; i <= 3; i++) {
    var inp = document.getElementById("f-profesor" + (i + 1));
    if (inp) {
      var val = inp.value.trim();
      if (val) profesoresSecundarios.push(val);
    }
  }

  var data = {
    profesor:              document.getElementById("f-profesor").value.trim(),
    profesoresSecundarios: profesoresSecundarios,
    materia:               document.getElementById("f-materia").value,
    cuatrimestre:          document.getElementById("f-cuatrimestre").value,
    anio:                  parseInt(document.getElementById("f-anio").value),
    diaHorario:            diaHorario,
    descripcion:           document.getElementById("f-descripcion").value.trim(),
    puntuacion:            selectedStars,
    fecha:                 firebase.firestore.FieldValue.serverTimestamp()
  };

  setSubmitLoading(true);
  try {
    await db.collection("opiniones").add(data);
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
  var ok = true;
  ["profesor","materia","cuatrimestre","anio","dia","horario","descripcion"].forEach(clearError);
  clearError("puntuacion");

  var profesor = document.getElementById("f-profesor").value.trim();
  if (!profesor) { showError("profesor", "El nombre del profesor es obligatorio."); ok = false; }

  var materia = document.getElementById("f-materia").value;
  if (!materia) { showError("materia", "Seleccioná una materia."); ok = false; }

  var cuatrimestre = document.getElementById("f-cuatrimestre").value;
  if (!cuatrimestre) { showError("cuatrimestre", "Seleccioná el cuatrimestre."); ok = false; }

  var anio = parseInt(document.getElementById("f-anio").value);
  if (!anio || anio < 2000 || anio > 2099) { showError("anio", "Ingresá un año válido (2000-2099)."); ok = false; }

  var dia = document.getElementById("f-dia").value;
  if (!dia) { showError("dia", "Seleccioná el día."); ok = false; }

  var horario = document.getElementById("f-horario").value;
  if (!horario) { showError("horario", "Seleccioná el horario."); ok = false; }

  var desc = document.getElementById("f-descripcion").value.trim();
  if (!desc) { showError("descripcion", "La descripción es obligatoria."); ok = false; }
  else if (desc.length > 1000) { showError("descripcion", "Máximo 1000 caracteres."); ok = false; }

  if (selectedStars < 1) { showError("puntuacion", "Seleccioná una puntuación."); ok = false; }

  return ok;
}

function showError(id, msg) {
  var el  = document.getElementById("err-" + id);
  var inp = document.getElementById("f-" + id);
  if (el)  el.textContent = msg;
  if (inp) inp.classList.add("error");
}

function clearError(id) {
  var el  = document.getElementById("err-" + id);
  var inp = document.getElementById("f-" + id);
  if (el)  el.textContent = "";
  if (inp) inp.classList.remove("error");
}

function resetForm() {
  document.getElementById("opinion-form").reset();
  selectedStars  = 0;
  extraProfCount = 0;
  document.getElementById("profesores-extra").innerHTML = "";
  var addBtn = document.getElementById("btn-add-prof");
  if (addBtn) { addBtn.disabled = false; addBtn.style.opacity = "1"; }
  updateStarUI(0);
  updateCharCounter();
  ["profesor","materia","cuatrimestre","anio","dia","horario","descripcion","puntuacion"].forEach(clearError);
}

function setSubmitLoading(loading) {
  var btn = document.getElementById("submit-btn");
  var txt = document.getElementById("submit-text");
  var ld  = document.getElementById("submit-loading");
  btn.disabled = loading;
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
  var stars  = document.querySelectorAll(".star");
  var labels = ["Sin calificación","Muy malo","Malo","Regular","Bueno","Excelente"];
  stars.forEach(function(s, i) {
    s.classList.toggle("filled", i < n);
    s.classList.toggle("active", i < n);
  });
  document.getElementById("star-label").textContent = labels[n] || "Sin calificación";
}

// =========================================
//   CONTADOR DE CARACTERES
// =========================================
function updateCharCounter() {
  var txt     = document.getElementById("f-descripcion").value;
  var len     = txt.length;
  var counter = document.getElementById("char-counter");
  counter.textContent = len + " / 1000";
  counter.className   = "char-counter";
  if (len > 900)  counter.classList.add("warn");
  if (len >= 1000) counter.classList.add("danger");
}

// =========================================
//   TOAST
// =========================================
function showToast(type) {
  var el = document.getElementById("toast-" + type);
  el.classList.remove("hidden");
  setTimeout(function() { el.classList.add("hidden"); }, 4000);
}

// =========================================
//   HELPERS
// =========================================
function renderStars(n) {
  var html = "";
  for (var i = 0; i < 5; i++) {
    html += '<span style="color:' + (i < n ? "#f59e0b" : "#c8e6c9") + '">' + (i < n ? "★" : "☆") + '</span>';
  }
  return html;
}

function decodeDiaHorario(code) {
  if (!code) return "—";
  var dias     = { 1:"Lunes", 2:"Martes", 3:"Miércoles", 4:"Jueves", 5:"Viernes", 6:"Sábado" };
  var horarios = { 300:"Mañana (08:00 - 12:00)", 600:"Tarde (14:00 - 18:00)", 900:"Noche (19:00 - 23:00)" };
  var dia      = Math.floor(code / 1000);
  var horario  = code % 1000;
  return (dias[dia] || "?") + " - " + (horarios[horario] || "?");
}

function formatFecha(ts) {
  if (!ts) return "—";
  var d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("es-AR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

function escHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ---- INIT ----
cargarOpiniones();
