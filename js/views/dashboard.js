// ═══════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════

const WEEK_DAYS   = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const MONTHS_FULL = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function renderDashboard() {
  const now  = new Date();
  const hour = now.getHours();
  const greeting = hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  document.getElementById('dash-hi').textContent = `${greeting}, ${currentUser} 👋`;
  document.getElementById('dash-date').textContent =
    `${WEEK_DAYS[now.getDay()]}, ${now.getDate()} de ${MONTHS_FULL[now.getMonth()]} de ${now.getFullYear()}`;

  // — Widgets numéricos —
  const pendingCompra  = compraItems.filter(i => !i.checked).length;
  const pendingTareas  = tareasData.filter(t => !t.done).length;
  document.getElementById('dw-compra').textContent = pendingCompra;
  document.getElementById('dw-tareas').textContent = pendingTareas;

  // Eventos próximos 7 días (Google Calendar)
  const allEvs = (typeof calEvents !== 'undefined') ? calEvents : [];
  const end7 = new Date(now); end7.setDate(now.getDate() + 7);
  const events7d = allEvs.filter(ev => {
    const d = ev.start.dateTime ? new Date(ev.start.dateTime) : new Date(ev.start.date + 'T00:00:00');
    return d >= now && d < end7;
  });
  document.getElementById('dw-cal3d').textContent = events7d.length;

  // — Menú de hoy —
  const todayKey = dateKey(now);
  const todayMenu = comidasData[todayKey] || {};
  const comidaEl  = document.getElementById('dash-menu-comida');
  const cenaEl    = document.getElementById('dash-menu-cena');
  comidaEl.className = todayMenu.comida ? 'dash-menu-text' : 'dash-menu-empty';
  comidaEl.textContent = todayMenu.comida || 'Sin planear';
  cenaEl.className   = todayMenu.cena   ? 'dash-menu-text' : 'dash-menu-empty';
  cenaEl.textContent   = todayMenu.cena   || 'Sin planear';

  // — Tareas prioritarias —
  const PRIO_ORDER = { alta:0, media:1, baja:2 };
  const topTareas = [...tareasData]
    .filter(t => !t.done)
    .sort((a,b) => (PRIO_ORDER[a.prio]||2) - (PRIO_ORDER[b.prio]||2))
    .slice(0, 4);
  const PRIO_ICON = { alta:'🔴', media:'🟡', baja:'🟢' };
  const tareasEl = document.getElementById('dash-tareas-list');
  if (!topTareas.length) {
    tareasEl.innerHTML = `<div class="empty-state" style="padding:1.25rem">
      <div class="empty-desc">¡Todo al día! 🎉</div></div>`;
  } else {
    tareasEl.innerHTML = topTareas.map(t => `
      <div class="dash-card-row clickable" onclick="switchView('tareas')">
        <div class="dash-row-icon">${PRIO_ICON[t.prio]||'🟢'}</div>
        <div class="dash-row-body">
          <div class="dash-row-title">${t.name}</div>
          ${t.assigned ? `<div class="dash-row-sub">→ ${t.assigned}</div>` : ''}
        </div>
      </div>`).join('');
  }

  // — Eventos próximos 7 días —
  const cal3dEl = document.getElementById('dash-cal3d-list');
  if (cal3dEl) {
    if (!events7d.length) {
      cal3dEl.innerHTML = `<div class="empty-state" style="padding:1.25rem">
        <div class="empty-desc">Sin eventos en los próximos 7 días</div></div>`;
    } else {
      cal3dEl.innerHTML = events7d.map(ev => {
        const d = ev.start.dateTime ? new Date(ev.start.dateTime) : new Date(ev.start.date + 'T00:00:00');
        const dateStr = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
        const timeStr = ev.start.dateTime
          ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
          : 'Todo el día';
        return `<div class="dash-card-row clickable" onclick="switchView('calendario')">
          <div class="dash-row-icon">📅</div>
          <div class="dash-row-body">
            <div class="dash-row-title">${ev.summary || '(Sin título)'}</div>
            <div class="dash-row-sub">${dateStr}</div>
          </div>
          <div class="dash-row-right">${timeStr}</div>
        </div>`;
      }).join('');
    }
  }

  // — Progreso compra —
  const total   = compraItems.length;
  const checked = compraItems.filter(i => i.checked).length;
  const pct     = total > 0 ? Math.round(checked / total * 100) : 0;
  document.getElementById('dash-compra-label').textContent = `${checked} de ${total} productos`;
  document.getElementById('dash-compra-pct').textContent   = `${pct}%`;
  document.getElementById('dash-compra-fill').style.width  = `${pct}%`;
}
