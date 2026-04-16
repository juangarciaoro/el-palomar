// ═══════════════════════════════════════════════════════
// 🔧 CONFIGURACIÓN — reemplaza con tus credenciales Firebase
// ═══════════════════════════════════════════════════════
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD_U1sIbZakMwsAbdAE-m9CewJbM9N8q2o",
  authDomain: "el-palomar-abed2.firebaseapp.com",
  projectId: "el-palomar-abed2",
  storageBucket: "el-palomar-abed2.firebasestorage.app",
  messagingSenderId: "493810032587",
  appId: "1:493810032587:web:377ddf1acaa3d2c65d204e"
};

// ─── GOOGLE CALENDAR ──────────────────────────────────
// ID del calendario a usar (o 'primary' para el principal)
const GOOGLE_CALENDAR_ID = 'ovvtdfmk9lq9pqn2n3sl7cdtso@group.calendar.google.com';

// ─── MULTI-HOGAR ──────────────────────────────────────────
window.activeHogar   = null;  // objeto completo del hogar activo
window.activeHogarId = null;  // id del hogar activo (shorthand)

// Devuelve la referencia a una subcolección del hogar activo
window.hogarCol = function(name) {
  if (!db || !window.activeHogarId) return null;
  return db.collection('hogares').doc(window.activeHogarId).collection(name);
};

// Carga el hogar activo desde Firestore usando el activeHogarId del perfil del usuario
window.getActiveHogar = async function(uid) {
  if (!db) return null;
  try {
    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists) return null;
    const hogarId = userSnap.data().activeHogarId;
    if (!hogarId) return null;
    const hogarSnap = await db.collection('hogares').doc(hogarId).get();
    if (!hogarSnap.exists) return null;
    window.activeHogar   = { id: hogarId, ...hogarSnap.data() };
    window.activeHogarId = hogarId;
    return window.activeHogar;
  } catch (err) {
    console.error('getActiveHogar:', err);
    return null;
  }
};

// Actualiza todos los elementos del DOM que muestran el nombre del hogar
window.updateHogarName = function(nombre) {
  const safe = nombre || '';
  document.title = safe;
  const ids = ['login-hogar-nombre', 'loading-hogar-nombre', 'topbar-hogar-nombre', 'nav-hogar-nombre'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = safe;
  });
  // Actualizar GOOGLE_CALENDAR_ID si el hogar tiene calendarId
  // (se usa en calendario.js — solo si ya está inicializado evitamos re-init aquí)
};

// Cambia el hogar activo en Firestore y en memoria
window.setActiveHogar = async function(hogarId) {
  if (!db || !firebaseUser) return;
  try {
    await db.collection('users').doc(firebaseUser.uid).update({ activeHogarId: hogarId });
    const hogarSnap = await db.collection('hogares').doc(hogarId).get();
    if (!hogarSnap.exists) return;
    window.activeHogar   = { id: hogarId, ...hogarSnap.data() };
    window.activeHogarId = hogarId;
  } catch (err) {
    console.error('setActiveHogar:', err);
  }
};
