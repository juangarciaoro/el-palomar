// ═══════════════════════════════════════════════════════
// AUTH — Firebase Authentication with Google
// ═══════════════════════════════════════════════════════

let firebaseUser      = null;
let userProfile       = null; // { displayName, email, photoURL, paletteIndex, createdAt }
let onboardPaletteIdx = 0;

// Detecta si estamos dentro de Capacitor (app nativa Android/iOS)
const IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

// ─── INIT AUTH ────────────────────────────────────────────
async function initAuth() {
  if (!CONFIGURED) { showLoginScreen(); return; }

  // El listener cubre tanto web como nativo
  firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
      firebaseUser = user;
      await loadOrOnboard(user);
    } else {
      firebaseUser = null;
      userProfile  = null;
      currentUser  = null;
      showLoginScreen();
    }
  });
}

initAuth();

// ─── LOAD PROFILE OR ONBOARDING ───────────────────────────
async function loadOrOnboard(user) {
  try {
    const snap = await db.collection('users').doc(user.uid).get();
    if (snap.exists) {
      userProfile = snap.data();
      currentUser = userProfile.displayName;
      applyPalette(userProfile.paletteIndex || 0);
      showApp();
    } else {
      showOnboarding(user);
    }
  } catch (err) {
    console.error('Error loading profile:', err);
    showToast('Error al cargar el perfil');
    showLoginScreen();
  }
}

// ─── LOGIN WITH GOOGLE ────────────────────────────────────
window.loginWithGoogle = async function() {
  if (IS_NATIVE) {
    // En Android: usa el plugin nativo (diálogo de Google nativo)
    try {
      const { FirebaseAuthentication } = window.Capacitor.Plugins;
      const result = await FirebaseAuthentication.signInWithGoogle();
      // El plugin sincroniza automáticamente con Firebase Web SDK via idToken
      const credential = firebase.auth.GoogleAuthProvider.credential(result.credential.idToken);
      await firebase.auth().signInWithCredential(credential);
    } catch (err) {
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
      const result = await firebase.auth().signInWithPopup(provider);
      const token = result.credential && result.credential.accessToken;
      if (token) {
        sessionStorage.setItem('gcal_token',     token);
        sessionStorage.setItem('gcal_token_exp', String(Date.now() + 3600 * 1000));
      }
    } catch (err) {
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
  currentUser  = null;
  firebaseUser = null;
  userProfile  = null;
  try { await firebase.auth().signOut(); } catch(e) {}
};

// ─── ONBOARDING ──────────────────────────────────────────
function showOnboarding(user) {
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
  showApp();
};

// ─── SHOW APP ─────────────────────────────────────────────
function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('topbar').classList.add('visible');
  document.getElementById('bottom-nav').classList.add('visible');
  document.getElementById('main-content').style.display = '';
  document.getElementById('topbar-user').textContent = currentUser;
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
  renderDashboard();
  if (window.calInit) window.calInit();
}

async function populateAssignDropdown() {
  const group = document.getElementById('tarea-assign-group');
  if (!group) return;
  group.innerHTML = '';
  if (!db) return;
  try {
    const snap = await db.collection('users').get();
    snap.docs.forEach(d => {
      const name = d.data().displayName;
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
