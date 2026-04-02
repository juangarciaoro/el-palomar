// ─── UI HELPERS ───────────────────────────────────────────

window.switchView = function(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  document.getElementById('nav-' + view).classList.add('active');
  if (view === 'dashboard') renderDashboard();
};

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
