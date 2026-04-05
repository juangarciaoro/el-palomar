// ─── UI HELPERS ───────────────────────────────────────────

const NAV_VIEWS = ['dashboard','compra','comidas','tareas','calendario','recetas'];

// ─── DARK MODE ────────────────────────────────────────────
(function() {
  function applyDark(on) {
    document.documentElement.classList.toggle('dark', on);
    const btn = document.getElementById('dark-toggle');
    if (btn) btn.classList.toggle('on', on);
  }
  applyDark(localStorage.getItem('darkMode') === '1');
  window.toggleDarkMode = function() {
    const on = !document.documentElement.classList.contains('dark');
    localStorage.setItem('darkMode', on ? '1' : '0');
    applyDark(on);
  };
  window.syncDarkToggle = function() {
    const btn = document.getElementById('dark-toggle');
    if (btn) btn.classList.toggle('on', document.documentElement.classList.contains('dark'));
  };
})();

window.switchView = function(view, direction) {
  if (view === currentView) return;
  const prevView = currentView;
  const prevIdx  = NAV_VIEWS.indexOf(prevView);
  const nextIdx  = NAV_VIEWS.indexOf(view);

  // Determinar dirección si no se pasa explícitamente
  if (direction === undefined) direction = nextIdx > prevIdx ? 'left' : 'right';

  const prevEl = document.getElementById('view-' + prevView);
  const nextEl = document.getElementById('view-' + view);

  // Preparar la vista entrante fuera de pantalla
  nextEl.classList.remove('active','slide-enter-left','slide-enter-right','slide-exit-left','slide-exit-right');
  nextEl.classList.add(direction === 'left' ? 'slide-enter-left' : 'slide-enter-right');

  // Forzar reflow para que la transición arranque
  nextEl.getBoundingClientRect();

  // Activar transición
  nextEl.classList.remove('slide-enter-left','slide-enter-right');
  nextEl.classList.add('active');

  // Salida de la vista anterior
  if (prevEl) {
    prevEl.classList.remove('active');
    prevEl.classList.add(direction === 'left' ? 'slide-exit-left' : 'slide-exit-right');
    setTimeout(() => {
      prevEl.classList.remove('slide-exit-left','slide-exit-right');
    }, 560);
  }

  currentView = view;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('nav-' + view).classList.add('active');
  if (view === 'dashboard') renderDashboard();
};

// ─── SWIPE NAVIGATION (drag-follow) ───────────────────────
(function() {
  const THRESHOLD = 60;
  const GAP = 20;          // px de separación visible entre vistas durante el arrastre

  let startX = 0, startY = 0;
  let dragging  = false;
  let animating = false;
  let dragDir   = null;
  let currentEl = null, candidateEl = null;
  let containerW = 0;
  let dx = 0;

  document.addEventListener('touchstart', e => {
    if (animating) return;
    startX      = e.touches[0].clientX;
    startY      = e.touches[0].clientY;
    dragging    = false;
    dragDir     = null;
    currentEl   = null;
    candidateEl = null;
    dx = 0;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (animating || document.querySelector('.modal-overlay.open')) return;

    const cx = e.touches[0].clientX;
    const cy = e.touches[0].clientY;
    dx = cx - startX;
    const dy = cy - startY;

    if (!dragging) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx) * 1.2)    return;

      const idx = NAV_VIEWS.indexOf(currentView);
      if (dx < 0 && idx >= NAV_VIEWS.length - 1) return;
      if (dx > 0 && idx <= 0)                    return;

      dragDir = dx < 0 ? 'left' : 'right';
      const nextName = dragDir === 'left' ? NAV_VIEWS[idx + 1] : NAV_VIEWS[idx - 1];

      currentEl   = document.getElementById('view-' + currentView);
      candidateEl = document.getElementById('view-' + nextName);
      containerW  = currentEl.offsetWidth;

      // Posicionar la candidata FUERA DE PANTALLA (con gap) antes de hacerla visible
      const initOff = (containerW + GAP) * (dragDir === 'left' ? 1 : -1);
      candidateEl.style.transition = 'none';
      candidateEl.style.transform  = `translateX(${initOff}px)`;
      candidateEl.style.opacity    = '1';
      currentEl.style.transition   = 'none';
      dragging = true;
    }

    e.preventDefault();

    const offscreen = (containerW + GAP) * (dragDir === 'left' ? 1 : -1);
    currentEl.style.transform   = `translateX(${dx}px)`;
    candidateEl.style.transform = `translateX(${offscreen + dx}px)`;
  }, { passive: false });

  document.addEventListener('touchend', () => {
    if (!dragging || !candidateEl) { dragging = false; return; }
    dragging  = false;
    animating = true;

    const W        = containerW + GAP;
    const eased    = 'transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)';
    const snapEase = 'transform 0.22s cubic-bezier(0.25,0.46,0.45,0.94)';

    if (Math.abs(dx) >= THRESHOLD) {
      // ── Confirmar cambio ─────────────────────────────────
      currentEl.style.transition   = eased;
      candidateEl.style.transition = eased;
      currentEl.style.transform    = `translateX(${dragDir === 'left' ? -W : W}px)`;
      candidateEl.style.transform  = 'translateX(0)';

      const outEl    = currentEl, inEl = candidateEl;
      const idx      = NAV_VIEWS.indexOf(currentView);
      const nextName = dragDir === 'left' ? NAV_VIEWS[idx + 1] : NAV_VIEWS[idx - 1];

      setTimeout(() => {
        // 1. Freeze CSS transitions so the class swap doesn't trigger them
        outEl.style.transition = 'none';
        inEl.style.transition  = 'none';
        outEl.getBoundingClientRect(); // flush

        // 2. Swap classes and clear inline styles while frozen → no flash
        outEl.classList.remove('active');
        inEl.classList.add('active');
        outEl.style.transform = '';
        outEl.style.opacity   = '';
        inEl.style.transform  = '';
        inEl.style.opacity    = '';
        inEl.getBoundingClientRect(); // flush

        // 3. Re-enable transitions (nothing pending to animate)
        outEl.style.transition = '';
        inEl.style.transition  = '';

        currentView = nextName;
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('nav-' + nextName).classList.add('active');
        if (nextName === 'dashboard') renderDashboard();
        animating = false;
      }, 285);
    } else {
      // ── Volver a posición original ────────────────────────
      const offscreen = (containerW + GAP) * (dragDir === 'left' ? 1 : -1);
      currentEl.style.transition   = snapEase;
      candidateEl.style.transition = snapEase;
      currentEl.style.transform    = 'translateX(0)';
      candidateEl.style.transform  = `translateX(${offscreen}px)`;

      const rc = currentEl, rk = candidateEl;
      setTimeout(() => {
        rc.style.transition = 'none';
        rk.style.transition = 'none';
        rc.getBoundingClientRect();
        rc.style.transform = '';
        rc.style.opacity   = '';
        rk.style.transform = '';
        rk.style.opacity   = '';
        rk.getBoundingClientRect();
        rc.style.transition = '';
        rk.style.transition = '';
        animating = false;
      }, 225);
    }

    currentEl = null; candidateEl = null;
  }, { passive: true });
})();

window.openModal = function(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
};

// ─── DOBLE RETROCESO PARA SALIR (Android) ─────────────────
(function() {
  let backPressedOnce = false;
  let backTimer       = null;

  function handleBack() {
    // Si hay un modal abierto, cerrarlo en lugar de salir
    const modal = document.querySelector('.modal-overlay.open');
    if (modal && modal.id) {
      closeModal(modal.id);
      return;
    }

    if (backPressedOnce) {
      clearTimeout(backTimer);
      Capacitor.Plugins.App.exitApp();
      return;
    }

    backPressedOnce = true;
    showToast('Pulsa atrás de nuevo para salir');
    backTimer = setTimeout(() => { backPressedOnce = false; }, 2200);
  }

  // Capacitor expone el evento backButton a través de su bridge
  window.addEventListener('load', () => {
    if (!window.Capacitor || !Capacitor.isNativePlatform()) return;
    Capacitor.Plugins.App.addListener('backButton', handleBack);
  });
})();

window.closeModal = function(id, e) {
  if (e && e.target !== document.getElementById(id)) return;
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
};

// ─── MODAL DRAG-TO-DISMISS (mobile handle) ───────────────────
(function() {
  let startY = 0, sheet = null, overlay = null;

  document.addEventListener('touchstart', e => {
    if (!e.target.closest('.modal-handle')) return;
    sheet   = e.target.closest('.modal-sheet');
    overlay = sheet?.closest('.modal-overlay');
    if (!sheet) return;
    startY = e.touches[0].clientY;
    sheet.classList.add('is-dragging');
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!sheet) return;
    const dy = e.touches[0].clientY - startY;
    if (dy < 0) return;
    sheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!sheet) return;
    const dy = e.changedTouches[0].clientY - startY;
    sheet.classList.remove('is-dragging');
    if (dy > 110 && overlay?.id) {
      sheet.style.transform = '';
      closeModal(overlay.id);
    } else {
      sheet.style.transform = '';
    }
    sheet = null; overlay = null;
  }, { passive: true });
})();

window.showToast = function(msg, type) {
  const t = document.getElementById('toast');
  const icons = { success: '✓', error: '✕', info: 'ℹ️', warn: '⚠️' };
  t.className = 'toast' + (type ? ' toast-' + type : '');
  t.innerHTML = type && icons[type]
    ? `<span class="toast-icon">${icons[type]}</span><span>${msg}</span>`
    : msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2600);
};

// Muestra un modal de confirmación genérico.
// showConfirm({ title, message, confirmText, onConfirm })
window.showConfirm = function({ title = '¿Estás seguro?', message = '', confirmText = 'Eliminar', onConfirm }) {
  document.getElementById('confirm-title').textContent   = title;
  document.getElementById('confirm-message').textContent = message;
  document.getElementById('confirm-ok-btn').textContent  = confirmText;
  document.getElementById('confirm-ok-btn').onclick = function() {
    closeModal('modal-confirm');
    onConfirm();
  };
  openModal('modal-confirm');
};

// ─── USER DRAWER ──────────────────────────────────────────
window.openUserDrawer = function() {
  const name  = (typeof userProfile !== 'undefined' && userProfile && userProfile.displayName)
                  || (typeof currentUser !== 'undefined' && currentUser) || '?';
  const email = (typeof firebaseUser !== 'undefined' && firebaseUser && firebaseUser.email) || '';
  const photo = (typeof firebaseUser !== 'undefined' && firebaseUser && firebaseUser.photoURL) || '';

  document.getElementById('drawer-name').textContent  = name;
  document.getElementById('drawer-email').textContent = email;

  const av = document.getElementById('drawer-avatar');
  if (photo) {
    av.innerHTML = `<img src="${photo}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  } else {
    av.textContent = name.charAt(0).toUpperCase();
  }

  const idx = (typeof userProfile !== 'undefined' && userProfile && userProfile.paletteIndex != null)
    ? userProfile.paletteIndex : 0;
  renderColorSwatches('drawer-swatches', idx, 'drawerSelectPalette');

  document.getElementById('drawer-overlay').classList.add('open');
  document.getElementById('user-drawer').classList.add('open');
  document.body.style.overflow = 'hidden';
  syncDarkToggle();
};

window.closeUserDrawer = function() {
  document.getElementById('drawer-overlay').classList.remove('open');
  document.getElementById('user-drawer').classList.remove('open');
  document.body.style.overflow = '';
};

window.drawerSelectPalette = async function(index) {
  applyPalette(index);
  if (typeof userProfile !== 'undefined' && userProfile) userProfile.paletteIndex = index;
  if (typeof db !== 'undefined' && db && typeof firebaseUser !== 'undefined' && firebaseUser) {
    try {
      await db.collection('users').doc(firebaseUser.uid).update({ paletteIndex: index });
    } catch(e) { /* silent */ }
  }
  renderColorSwatches('drawer-swatches', index, 'drawerSelectPalette');
  showToast('Color de acento actualizado ✓');
};

// ─── NOTIFICACIONES WEB PUSH ──────────────────────────────
async function scheduleNotification(title, time) {
  if (!('Notification' in window)) return;
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return;

  const [h, m] = time.split(':').map(Number);
  const now = new Date();
  const next = new Date();
  next.setHours(h, m, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const delay = next - now;

  setTimeout(() => {
    new Notification('El Palomar', {
      body: title,
      icon: 'favicon.svg'
    });
  }, delay);
}
