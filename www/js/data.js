// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
const CONFIGURED = FIREBASE_CONFIG.apiKey !== "TU_API_KEY";

// Detecta si estamos dentro de Capacitor (Android/iOS nativo)
function isNative() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

let db = null;
let unsubscribers = [];

if (CONFIGURED) {
  firebase.initializeApp(FIREBASE_CONFIG);
  db = firebase.firestore();
  firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
}

let currentUser = null;
let currentView = 'compra';
let weekOffset  = 0;
let currentMealEdit = null;
let currentTareaFilter = 'todas';

// LOCAL DATA (fallback sin Firebase)
let compraItems   = [];
let comidasData   = {};
let tareasData    = [];

// ─── SYNC STATUS ──────────────────────────────────────────
function setSyncStatus(state) {
  const dot2 = document.getElementById('sync-dot2');
  const txt  = document.getElementById('sync-text');
  if (state === 'syncing') {
    dot2.classList.add('syncing');
    txt.textContent = 'Sincronizando…';
  } else if (state === 'ok') {
    dot2.classList.remove('syncing');
    dot2.style.background = 'var(--accent-light)';
    txt.textContent = 'Sincronizado';
  } else {
    dot2.classList.remove('syncing');
    dot2.style.background = 'var(--warning)';
    txt.textContent = 'Modo local (sin Firebase)';
  }
}

// ─── INIT DATA ─────────────────────────────────────────────
function initData() {
  setSyncStatus('syncing');

  if (CONFIGURED && db) {
    // Compra
    unsubscribers.push(db.collection('compra').orderBy('createdAt', 'asc').onSnapshot(snap => {
      compraItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderCompra();
      setSyncStatus('ok');
      if (currentView === 'dashboard') renderDashboard();
    }));

    // Comidas
    unsubscribers.push(db.collection('comidas').onSnapshot(snap => {
      comidasData = {};
      snap.docs.forEach(d => { comidasData[d.id] = d.data(); });
      renderComidas();
      if (currentView === 'dashboard') renderDashboard();
    }));

    // Tareas
    unsubscribers.push(db.collection('tareas').orderBy('createdAt', 'asc').onSnapshot(snap => {
      tareasData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTareas();
      if (currentView === 'dashboard') renderDashboard();
    }));

  } else {
    // Demo data
    compraItems = [
      { id: '1', name: 'Leche', qty: '2L', cat: '🥛 Lácteos', checked: false },
      { id: '2', name: 'Pan', qty: '1 barra', cat: '🍞 Panadería', checked: false },
      { id: '3', name: 'Tomates', qty: '1kg', cat: '🥦 Frescos', checked: true },
      { id: '4', name: 'Pollo', qty: '500g', cat: '🥩 Carnicería', checked: false },
    ];
    tareasData = [
      { id: 't1', name: 'Pasar la aspiradora', cat: 'limpiar', prio: 'alta', assigned: 'Papá', done: false },
      { id: 't2', name: 'Preparar el biberón', cat: 'bebé', prio: 'media', assigned: 'Mamá', done: false },
      { id: 't3', name: 'Sacar los cubos', cat: 'otros', prio: 'baja', assigned: '', done: true },
    ];
    setSyncStatus('local');
    renderCompra();
    renderComidas();
    renderTareas();
  }
}
