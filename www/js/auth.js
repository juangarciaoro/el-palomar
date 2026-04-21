// ═══════════════════════════════════════════════════════
// AUTH — Firebase Authentication with Google
// ═══════════════════════════════════════════════════════

let firebaseUser      = null;
let userProfile       = null; // { displayName, email, photoURL, paletteIndex, createdAt }
let onboardPaletteIdx = 0;
let _loadingOnboard   = false; // guard contra doble ejecución de loadOrOnboard

// ─── PENDING INVITE (capturado antes de cualquier redirect) ──
const { _pendingInviteToken, _pendingInviteHogarId } = (function() {
  const params = new URLSearchParams(location.search);
  const token  = params.get('invite') || null;
  const hogar  = params.get('hogar')  || null;
  if (token) history.replaceState({}, '', location.pathname); // limpiar URL
  return { _pendingInviteToken: token, _pendingInviteHogarId: hogar };
})();

// ─── LOADING SCREEN ─────────────────────────────────────────
function showLoading() {
  const el = document.getElementById('loading-screen');
  if (el) el.style.display = 'flex';
}
function hideLoading() {
  const el = document.getElementById('loading-screen');
  if (el) el.style.display = 'none';
}

// ─── INIT AUTH ────────────────────────────────────────────
async function initAuth() {
  if (!CONFIGURED) { showLoginScreen(); return; }

  showLoading();
  // El listener cubre tanto web como nativo
  firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
      firebaseUser = user;
      await loadOrOnboard(user);
    } else {
      firebaseUser = null;
      userProfile  = null;
      currentUser  = null;
      hideLoading();
      showLoginScreen();
    }
  });
}

initAuth();

// ─── LOAD PROFILE OR ONBOARDING ───────────────────────────
async function loadOrOnboard(user) {
  if (_loadingOnboard) return;
  _loadingOnboard = true;
  try {
    const snap = await db.collection('users').doc(user.uid).get();
    if (snap.exists) {
      userProfile = snap.data();
      currentUser = userProfile.displayName;
      applyPalette(userProfile.paletteIndex || 0);

      // Procesar invitación pendiente antes de cargar el hogar habitual
      if (_pendingInviteToken) {
        const joined = await acceptInvite(_pendingInviteToken, user.uid, _pendingInviteHogarId);
        if (joined) { showApp(); return; }
      }

      const hogar = await window.getActiveHogar(user.uid);
      if (!hogar) {
        hideLoading();
        showNoHogarScreen();
        return;
      }
      showApp();
    } else {
      showOnboarding(user);
    }
  } catch (err) {
    console.error('Error loading profile:', err);
    showToast('Error al cargar el perfil');
    hideLoading();
    showLoginScreen();
  } finally {
    _loadingOnboard = false;
  }
}

// ─── ACCEPT INVITE ────────────────────────────────────────
// hogarIdHint: hogarId de la URL (?hogar=...), evita depender del índice raíz
async function acceptInvite(token, uid, hogarIdHint) {
  try {
    let inv = null;
    let hogarId = hogarIdHint || null;

    // 1. Intentar leer desde la subcollección del hogar (fuente primaria si tenemos hogarId)
    if (hogarId) {
      const subSnap = await db.collection('hogares').doc(hogarId)
        .collection('invitaciones').doc(token).get();
      if (subSnap.exists) inv = subSnap.data();
    }

    // 2. Fallback: índice raíz (si el hogarId no venía en la URL o no se encontró)
    if (!inv) {
      const rootSnap = await db.collection('invitaciones').doc(token).get().catch(() => null);
      if (rootSnap && rootSnap.exists) {
        inv = rootSnap.data();
        hogarId = inv.hogarId;
      }
    }

    if (!inv || !hogarId) {
      showToast('Invitación no válida o no encontrada');
      return false;
    }
    if (inv.used) {
      showToast('Esta invitación ya fue utilizada');
      return false;
    }
    if (inv.expiresAt && inv.expiresAt.toDate() < new Date()) {
      showToast('La invitación ha caducado');
      return false;
    }

    const now = firebase.firestore.FieldValue.serverTimestamp();

    // Añadir como miembro (set con merge:true preserva rol admin si ya existía)
    // + marcar invite como usada + actualizar activeHogarId — todo en un batch
    const batch = db.batch();
    batch.set(
      db.collection('hogares').doc(hogarId).collection('members').doc(uid),
      { role: 'member', joinedAt: now },
      { merge: true }
    );
    batch.update(
      db.collection('hogares').doc(hogarId).collection('invitaciones').doc(token),
      { used: true, usedBy: uid, usedAt: now }
    );
    // Incluir también el hogar previo en hogarIds (por si venía de migración sin el campo)
    const prevHogarId = window.activeHogarId || null;
    const hogarIdsToAdd = [hogarId, prevHogarId].filter(Boolean);
    batch.update(db.collection('users').doc(uid), {
      activeHogarId: hogarId,
      hogarIds: firebase.firestore.FieldValue.arrayUnion(...hogarIdsToAdd)
    });
    await batch.commit();

    // Marcar índice raíz best-effort
    db.collection('invitaciones').doc(token)
      .update({ used: true, usedBy: uid, usedAt: now }).catch(() => {});

    const hogarSnap = await db.collection('hogares').doc(hogarId).get();
    window.activeHogar   = { id: hogarId, ...hogarSnap.data() };
    window.activeHogarId = hogarId;
    showToast(`¡Bienvenido/a a "${window.activeHogar.nombre}"!`);
    return true;
  } catch(e) {
    console.error('acceptInvite:', e);
    showToast('Error al procesar la invitación');
    return false;
  }
}

// ─── LOGIN WITH GOOGLE ────────────────────────────────────
window.loginWithGoogle = async function() {
  if (isNative()) {
    // En Android: usa el plugin nativo (diálogo de Google nativo)
    try {
      showLoading();
      const { FirebaseAuthentication } = window.Capacitor.Plugins;
      const result = await FirebaseAuthentication.signInWithGoogle({
        scopes: ['https://www.googleapis.com/auth/calendar']
      });
      // Guardar accessToken en localStorage ANTES de signInWithCredential
      const token = result.credential && result.credential.accessToken;
      if (token) {
        localStorage.setItem('gcal_token',     token);
        localStorage.setItem('gcal_token_exp', String(Date.now() + 3600 * 1000));
      }
      // signInWithCredential dispara onAuthStateChanged → loadOrOnboard() → showApp()
      const credential = firebase.auth.GoogleAuthProvider.credential(result.credential.idToken);
      await firebase.auth().signInWithCredential(credential);
      // Si el usuario ya tenía sesión activa, onAuthStateChanged no vuelve a disparar.
      // En ese caso llamamos loadOrOnboard manualmente (el guard evita doble ejecución).
      if (firebase.auth().currentUser && !userProfile) {
        firebaseUser = firebase.auth().currentUser;
        await loadOrOnboard(firebaseUser);
      }
      if (window.calInit) await window.calInit();
    } catch (err) {
      hideLoading();
      if (err.code !== 'SIGN_IN_CANCELLED') {
        showToast('Error al iniciar sesión');
        console.error(err);
      }
    }
  } else {
    // En navegador: usa popup (funciona en GitHub Pages y localhost)
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/calendar');
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      showLoading();
      const result = await firebase.auth().signInWithPopup(provider);
      const token = result.credential && result.credential.accessToken;
      if (token) {
        localStorage.setItem('gcal_token',     token);
        localStorage.setItem('gcal_token_exp', String(Date.now() + 3600 * 1000));
      }
    } catch (err) {
      hideLoading();
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        showToast('Error al iniciar sesión');
        console.error(err);
      }
    }
  }
};

// ─── LOGOUT ──────────────────────────────────────────────
window.logout = async function() {
  unsubscribers.forEach(u => u());
  unsubscribers.length = 0;
  sessionStorage.clear();
  localStorage.removeItem('gcal_token');
  localStorage.removeItem('gcal_token_exp');
  localStorage.removeItem('gcal_scope_granted');
  currentUser  = null;
  firebaseUser = null;
  userProfile  = null;
  _loadingOnboard = false;
  // Ocultar pantalla "sin hogar" si estaba visible
  const noHogar = document.getElementById('no-hogar-screen');
  if (noHogar) noHogar.style.display = 'none';
  try { await firebase.auth().signOut(); } catch(e) {}
  showLoginScreen();
};

// ─── ONBOARDING ──────────────────────────────────────────
function showOnboarding(user) {
  hideLoading();
  const firstName = (user.displayName || '').split(' ')[0];
  document.getElementById('onboard-name').value = firstName;
  const img = document.getElementById('onboard-avatar');
  if (user.photoURL && img) {
    img.src = user.photoURL;
    img.style.display = 'block';
  } else if (img) {
    img.style.display = 'none';
  }
  onboardPaletteIdx = 0;
  applyPalette(0);
  renderColorSwatches('onboard-swatches', 0, 'onboardSelectPalette');
  openModal('modal-onboarding');
}

window.onboardSelectPalette = function(index) {
  onboardPaletteIdx = index;
  applyPalette(index);
  renderColorSwatches('onboard-swatches', index, 'onboardSelectPalette');
};

window.cancelOnboarding = async function() {
  closeModal('modal-onboarding');
  try { await firebase.auth().signOut(); } catch(e) {}
  firebaseUser  = null;
  userProfile   = null;
  document.getElementById('login-screen').style.display = '';
};

window.saveOnboarding = async function() {
  const name = document.getElementById('onboard-name').value.trim();
  if (!name) { showToast('Introduce tu nombre'); return; }
  const profile = {
    displayName:  name,
    email:        firebaseUser.email,
    photoURL:     firebaseUser.photoURL || '',
    paletteIndex: onboardPaletteIdx,
    createdAt:    new Date().toISOString()
  };
  try {
    await db.collection('users').doc(firebaseUser.uid).set(profile);
  } catch(e) {
    showToast('Error al guardar el perfil');
    console.error(e);
    return;
  }
  userProfile = profile;
  currentUser = name;
  applyPalette(onboardPaletteIdx);
  closeModal('modal-onboarding');

  // Si venía con invite, procesar antes de intentar hogar propio
  if (_pendingInviteToken) {
    const joined = await acceptInvite(_pendingInviteToken, firebaseUser.uid, _pendingInviteHogarId);
    if (joined) { showApp(); return; }
  }

  const hogar = await window.getActiveHogar(firebaseUser.uid);
  if (!hogar) {
    showNoHogarScreen();
    return;
  }
  showApp();
};

// ─── SHOW APP ─────────────────────────────────────────────
function showApp() {
  hideLoading();
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('topbar').classList.add('visible');
  document.getElementById('bottom-nav').classList.add('visible');
  document.getElementById('main-content').style.display = '';
  document.getElementById('topbar-user').textContent = currentUser;

  // Nombre dinámico del hogar en toda la UI
  if (window.activeHogar && window.activeHogar.nombre) {
    updateHogarName(window.activeHogar.nombre);
  }
  const navUN = document.getElementById('nav-user-name');
  const navUA = document.getElementById('nav-user-avatar');
  if (navUN) navUN.textContent = currentUser;
  if (navUA) {
    if (userProfile && userProfile.photoURL) {
      navUA.style.backgroundImage = `url(${userProfile.photoURL})`;
      navUA.style.backgroundSize  = 'cover';
      navUA.textContent = '';
    } else {
      const initials = currentUser.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      navUA.textContent = initials;
    }
  }
  populateAssignDropdown();
  // Activate dashboard view
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const dvDash = document.getElementById('view-dashboard');
  const nbDash = document.getElementById('nav-dashboard');
  if (dvDash) dvDash.classList.add('active');
  if (nbDash) nbDash.classList.add('active');
  currentView = 'dashboard';
  initData();
  if (window.initProductos) initProductos();
  if (window.initRecetas) initRecetas();
  if (window.initCategorias) initCategorias();
  renderDashboard();
  if (window.calInit) window.calInit();
}

async function populateAssignDropdown() {
  const group = document.getElementById('tarea-assign-group');
  if (!group) return;
  group.innerHTML = '';
  if (!db) return;
  const hogarId = window.activeHogarId;
  if (!hogarId) return;
  try {
    const membersSnap = await db.collection('hogares').doc(hogarId).collection('members').get();
    const uids = membersSnap.docs.map(d => d.id);
    const profileSnaps = await Promise.all(uids.map(uid => db.collection('users').doc(uid).get()));
    profileSnaps.forEach(doc => {
      if (!doc.exists) return;
      const name = doc.data().displayName;
      if (!name) return;
      const chip = document.createElement('div');
      chip.className = 'assign-chip';
      chip.innerHTML = `<input type="checkbox" id="assign-${CSS.escape(name)}" value="${name}">` +
                       `<label for="assign-${CSS.escape(name)}">${name}</label>`;
      group.appendChild(chip);
    });
  } catch(e) { /* silent */ }
}

// ─── SHOW LOGIN ───────────────────────────────────────────
function showLoginScreen() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('topbar').classList.remove('visible');
  document.getElementById('bottom-nav').classList.remove('visible');
  document.getElementById('main-content').style.display = 'none';
}

// ─── NO HOGAR ─────────────────────────────────────────────
function showNoHogarScreen() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('topbar').classList.remove('visible');
  document.getElementById('bottom-nav').classList.remove('visible');
  document.getElementById('main-content').style.display = 'none';
  let el = document.getElementById('no-hogar-screen');
  if (!el) {
    el = document.createElement('div');
    el.id = 'no-hogar-screen';
    el.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;text-align:center;background:var(--bg,#f5f5f5);z-index:100';
    el.innerHTML = '<div style="font-size:3rem;margin-bottom:1rem">🏠</div>'
      + '<h2 style="margin:0 0 0.5rem;color:var(--text)">Sin hogar asignado</h2>'
      + '<p style="color:var(--text-muted);max-width:28rem;margin:0 0 1.5rem">Todavía no perteneces a ningún hogar. Crea uno nuevo o pide a alguien que te invite.</p>'
      + '<button class="btn btn-primary" onclick="showCreateHogarFlow()">Crear un hogar</button>'
      + '<button class="btn" style="margin-top:0.75rem" onclick="logout()">Cerrar sesión</button>';
    document.body.appendChild(el);
  } else {
    el.style.display = 'flex';
  }
}

window.showCreateHogarFlow = function() {
  const input = document.getElementById('crear-hogar-nombre');
  if (input) input.value = '';
  openModal('modal-crear-hogar');
  setTimeout(() => { if (input) input.focus(); }, 300);
};

window.confirmarCrearHogar = async function() {
  const input = document.getElementById('crear-hogar-nombre');
  const nombre = input ? input.value.trim() : '';
  if (!nombre) { showToast('Pon un nombre al hogar'); return; }
  if (!firebaseUser) return;

  const btn = document.querySelector('#modal-crear-hogar .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Creando…'; }

  try {
    const hogarRef = db.collection('hogares').doc();
    const hogarId  = hogarRef.id;
    const now      = firebase.firestore.FieldValue.serverTimestamp();

    await hogarRef.set({ nombre, ownerId: firebaseUser.uid, createdAt: now });
    await hogarRef.collection('members').doc(firebaseUser.uid).set({ role: 'admin', joinedAt: now });
    await db.collection('users').doc(firebaseUser.uid).update({
      activeHogarId: hogarId,
      hogarIds: firebase.firestore.FieldValue.arrayUnion(hogarId)
    });

    window.activeHogar   = { id: hogarId, nombre, ownerId: firebaseUser.uid };
    window.activeHogarId = hogarId;

    closeModal('modal-crear-hogar');

    // Ocultar pantalla de "sin hogar" si estaba visible
    const noHogar = document.getElementById('no-hogar-screen');
    if (noHogar) noHogar.style.display = 'none';

    updateHogarName(nombre);
    showApp();
    showToast(`Hogar "${nombre}" creado`);
  } catch(err) {
    console.error('confirmarCrearHogar:', err);
    showToast('Error al crear el hogar');
    if (btn) { btn.disabled = false; btn.textContent = 'Crear hogar →'; }
  }
};
