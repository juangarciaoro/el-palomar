// ═══════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════

const WEEK_DAYS   = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const MONTHS_FULL = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function renderDashboard() {
  const now  = new Date();
  const hour = now.getHours();
  const greeting = hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  document.getElementById('dash-hi').textContent = greeting;
  document.getElementById('dash-user-name').textContent = currentUser;
  document.getElementById('dash-date').textContent =
    `${WEEK_DAYS[now.getDay()]}, ${now.getDate()} de ${MONTHS_FULL[now.getMonth()]} de ${now.getFullYear()}`;

  // Eventos próximos 7 días (Google Calendar)
  const allEvs = (typeof calEvents !== 'undefined') ? calEvents : [];
  const end7 = new Date(now); end7.setDate(now.getDate() + 7);
  const events7d = allEvs.filter(ev => {
    const d = ev.start.dateTime ? new Date(ev.start.dateTime) : new Date(ev.start.date + 'T00:00:00');
    return d >= now && d < end7;
  });

  // — Menú de hoy —
  const todayKey = dateKey(now);
  const todayMenu = comidasData[todayKey] || {};
  const comidaEl  = document.getElementById('dash-menu-comida');
  const cenaEl    = document.getElementById('dash-menu-cena');
  const dayEl     = document.getElementById('dash-menu-day');
  if (dayEl) dayEl.textContent = `${WEEK_DAYS[now.getDay()]}, ${now.getDate()} de ${MONTHS_FULL[now.getMonth()]}`;
  comidaEl.className = todayMenu.comida ? 'dash-menu-text' : 'dash-menu-empty';
  comidaEl.textContent = todayMenu.comida || 'Sin planear';
  cenaEl.className   = todayMenu.cena   ? 'dash-menu-text' : 'dash-menu-empty';
  cenaEl.textContent   = todayMenu.cena   || 'Sin planear';

  // Avatares (foto vinculada a la receta, si existe)
  const comidaAvatarEl = document.getElementById('dash-menu-comida-avatar');
  const cenaAvatarEl   = document.getElementById('dash-menu-cena-avatar');

  function applyAvatar(mealName, el) {
    if (!el) return;
    el.style.display = 'none';
    el.style.backgroundImage = '';
    el.onclick = null;
    el.onkeydown = null;
    el.removeAttribute('aria-label');
    el.setAttribute('aria-hidden', 'true');
    try { el.tabIndex = -1; } catch(e) {}
    if (!mealName) return;
    // Normalizar texto para comparaciones más tolerantes
    function norm(s) {
      if (!s) return '';
      return s.toString().trim().toLowerCase()
        .normalize('NFD').replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ');
    }
    const target = norm(mealName);
    let matched = null;
    if (typeof recetasData !== 'undefined' && recetasData && recetasData.length) {
      // 1) exact normalized match
      matched = recetasData.find(r => norm(r.name) === target);
      // 2) recipe name contains target or viceversa
      if (!matched) matched = recetasData.find(r => norm(r.name).includes(target) || target.includes(norm(r.name)));
      // 3) startsWith / endsWith
      if (!matched) matched = recetasData.find(r => norm(r.name).startsWith(target) || norm(r.name).endsWith(target));
    }
    if (matched) {
      console.debug && console.debug('dashboard: avatar matched', matched.id, matched.name, 'for', mealName);
      const photo = matched.photoData || matched.photoURL || null;
      if (photo) {
        // Limpia contenido previo e inserta una etiqueta <img> para mejor compatibilidad
        el.innerHTML = '';
        const img = document.createElement('img');
        img.className = 'dash-menu-avatar-img';
        img.alt = matched.name || 'Receta';
        img.loading = 'lazy';
        img.src = photo;
        el.appendChild(img);
        el.style.display = 'block';
        el.setAttribute('aria-hidden', 'false');
        el.setAttribute('aria-label', 'Ver receta ' + (matched.name || ''));
        try { el.tabIndex = 0; } catch(e) {}
        el.onclick = function(e) { e.stopPropagation(); if (typeof openRecetaDetail === 'function') openRecetaDetail(matched.id); };
        el.onkeydown = function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.onclick(e); } };
      }
    }
    else {
      console.debug && console.debug('dashboard: no avatar match for', mealName);
    }
  }

  applyAvatar(todayMenu.comida, comidaAvatarEl);
  applyAvatar(todayMenu.cena, cenaAvatarEl);

  // — Tareas prioritarias —
  const PRIO_ORDER = { alta:0, media:1, baja:2 };
  const topTareas = [...tareasData]
    .filter(t => !t.done)
    .sort((a,b) => (PRIO_ORDER[a.prio]||2) - (PRIO_ORDER[b.prio]||2))
    .slice(0, 4);
  const tareasEl = document.getElementById('dash-tareas-list');
  if (!topTareas.length) {
    tareasEl.innerHTML = `<div class="empty-state" style="padding:1.25rem">
      <div class="empty-desc">¡Todo al día! 🎉</div></div>`;
  } else {
    tareasEl.innerHTML = topTareas.map(t => `
      <div class="dash-card-row clickable dash-prio-${t.prio||'baja'}" onclick="switchView('tareas')">
        <div class="dash-row-body">
          <div class="dash-row-title">${t.name}</div>
          ${t.assigned ? `<div class="dash-row-sub">${t.assigned}</div>` : ''}
        </div>
        <span class="dash-prio-pill ${t.prio||'baja'}">${t.prio||'baja'}</span>
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
          <div class="dash-row-date-box">
            <div class="dash-row-date-day">${d.getDate()}</div>
            <div class="dash-row-date-mon">${d.toLocaleDateString('es-ES',{month:'short'})}</div>
          </div>
          <div class="dash-row-body">
            <div class="dash-row-title">${ev.summary || '(Sin título)'}</div>
            <div class="dash-row-sub">${WEEK_DAYS[d.getDay()]}${ev.start.dateTime ? ' · '+timeStr : ' · Todo el día'}</div>
          </div>
        </div>`;
      }).join('');
    }
  }

}
