// ─── UI HELPERS ───────────────────────────────────────────

const NAV_VIEWS = ['dashboard','compra','comidas','tareas','calendario','recetas','productos'];

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
    }, 350);
  }

  currentView = view;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('nav-' + view).classList.add('active');
  if (view === 'dashboard') renderDashboard();
};

// ─── SWIPE NAVIGATION ─────────────────────────────────────
(function() {
  let startX = 0, startY = 0;
  const THRESHOLD = 50;   // px mínimos para reconocer swipe
  const MAX_VERT  = 80;   // px máximos en vertical para no confundir con scroll

  document.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    // Ignore if a modal is open
    if (document.querySelector('.modal-overlay.open')) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) < THRESHOLD || Math.abs(dy) > MAX_VERT) return;
    const idx = NAV_VIEWS.indexOf(currentView);
    if (dx < 0 && idx < NAV_VIEWS.length - 1) switchView(NAV_VIEWS[idx + 1]); // swipe izquierda → siguiente
    if (dx > 0 && idx > 0)                    switchView(NAV_VIEWS[idx - 1]); // swipe derecha  → anterior
  }, { passive: true });
})();

window.openModal = function(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
};

window.closeModal = function(id, e) {
  if (e && e.target !== document.getElementById(id)) return;
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
};

window.showToast = function(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
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
    new Notification('🏡 El Palomar', {
      body: title,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🏡</text></svg>'
    });
  }, delay);
}
