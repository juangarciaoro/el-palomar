// ═══════════════════════════════════════════════════════
// GOOGLE CALENDAR
// ═══════════════════════════════════════════════════════

const GCAL_SCOPES = 'https://www.googleapis.com/auth/calendar';

let gcalToken      = sessionStorage.getItem('gcal_token') || null;
let gcalTokenExp   = parseInt(sessionStorage.getItem('gcal_token_exp') || '0');
let calCurrentDate = new Date();
let calSelectedDate = new Date();
let calEvents      = [];

// Muestra el calendario y auto-conecta si el token es valido
const _origSwitchView = window.switchView;
window.switchView = function(view) {
  _origSwitchView(view);
  if (view === 'calendario') {
    if (gcalToken && Date.now() < gcalTokenExp) {
      showCalMain();
    }
  }
};

// --- REFRESCO DE TOKEN (usa Firebase Auth) ------------------
window.calLogin = function() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope(GCAL_SCOPES);
  provider.setCustomParameters({ prompt: 'consent' });
  firebase.auth().signInWithPopup(provider)
    .then(result => {
      const token = result.credential && result.credential.accessToken;
      if (token) {
        gcalToken    = token;
        gcalTokenExp = Date.now() + 3600 * 1000;
        sessionStorage.setItem('gcal_token',        token);
        sessionStorage.setItem('gcal_token_exp',    String(gcalTokenExp));
        sessionStorage.setItem('gcal_scope_granted', '1');
        showCalMain();
      }
    })
    .catch(err => {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        showToast('Error al conectar con Google Calendar');
        console.error(err);
      }
    });
};

window.calLogout = function() {
  gcalToken = null;
  gcalTokenExp = 0;
  sessionStorage.removeItem('gcal_token');
  sessionStorage.removeItem('gcal_token_exp');
  sessionStorage.removeItem('gcal_scope_granted');
  document.getElementById('cal-login-state').style.display = 'block';
  document.getElementById('cal-main-state').style.display  = 'none';
  showToast('Desconectado de Google Calendar');
};

// Llamar desde showApp() tras guardar el token
window.calInit = async function() {
  const t = sessionStorage.getItem('gcal_token');
  const e = parseInt(sessionStorage.getItem('gcal_token_exp') || '0');
  if (t && Date.now() < e) {
    gcalToken    = t;
    gcalTokenExp = e;
    await fetchCalEvents();
    if (currentView === 'dashboard') renderDashboard();
  }
};

// ─── SHOW MAIN ────────────────────────────────────────────
async function showCalMain() {
  document.getElementById('cal-login-state').style.display = 'none';
  document.getElementById('cal-main-state').style.display  = 'block';
  await fetchCalEvents();
  renderCalUpcoming();
}

// ─── FETCH EVENTS ─────────────────────────────────────────
async function fetchCalEvents() {
  if (!gcalToken) return;
  document.getElementById('cal-sync-dot').classList.add('syncing');
  document.getElementById('cal-sync-text').textContent = 'Actualizando...';

  const now   = new Date();
  const start = now;
  const end   = new Date(now);
  end.setDate(now.getDate() + 15);

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events?` +
    new URLSearchParams({
      timeMin:      start.toISOString(),
      timeMax:      end.toISOString(),
      singleEvents: 'true',
      orderBy:      'startTime',
      maxResults:   '100'
    });

  try {
    const res = await fetch(url, {
      headers: { Authorization: 'Bearer ' + gcalToken }
    });
    if (res.status === 401 || res.status === 403) {
      const errBody = await res.json().catch(() => ({}));
      const reason  = errBody?.error?.errors?.[0]?.reason || errBody?.error?.message || res.status;
      console.error('Google Calendar API error:', JSON.stringify(errBody));
      calLogout();
      showToast(`Error ${res.status}: ${reason}`);
      return;
    }
    const data = await res.json();
    calEvents = data.items || [];
    document.getElementById('cal-sync-dot').classList.remove('syncing');
    document.getElementById('cal-sync-text').textContent = 'Sincronizado';
  } catch(e) {
    document.getElementById('cal-sync-text').textContent = 'Error de red';
  }
}

// ─── UTILIDADES DE FECHA ──────────────────────────────────
const MONTHS_CAL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAYS_CAL   = ['L','M','X','J','V','S','D'];

const gcalColors = {
  '1':'#7986CB','2':'#33B679','3':'#8E24AA','4':'#E67C73',
  '5':'#F6BF26','6':'#F4511E','7':'#039BE5','8':'#616161',
  '9':'#3F51B5','10':'#0B8043','11':'#D50000'
};

function renderEventItem(ev) {
  let timeStr = 'Todo el dia';
  if (ev.start.dateTime) {
    const s = new Date(ev.start.dateTime);
    const e = new Date(ev.end.dateTime);
    timeStr = s.toLocaleTimeString('es', {hour:'2-digit',minute:'2-digit'}) +
              '<br>' + e.toLocaleTimeString('es', {hour:'2-digit',minute:'2-digit'});
  }
  const color = ev.colorId ? gcalColors[ev.colorId] : '#2d6a4f';
  return `<div class="cal-event-item">
    <div class="cal-event-color" style="background:${color}"></div>
    <div class="cal-event-time">${timeStr}</div>
    <div class="cal-event-body">
      <div class="cal-event-title">${ev.summary || '(Sin titulo)'}</div>
      ${ev.location ? `<div class="cal-event-loc">&#128205; ${ev.location}</div>` : ''}
    </div>
  </div>`;
}

// ─── PRÓXIMOS 15 DÍAS ─────────────────────────────────────
function renderCalUpcoming() {
  const now   = new Date();
  now.setHours(0,0,0,0);
  const end15 = new Date(now);
  end15.setDate(now.getDate() + 15);

  const upcoming = calEvents.filter(ev => {
    const d = ev.start.dateTime ? new Date(ev.start.dateTime) : new Date(ev.start.date + 'T00:00:00');
    return d >= now && d < end15;
  });

  const list = document.getElementById('cal-upcoming-list');
  if (!upcoming.length) {
    list.innerHTML = `<div class="empty-state" style="padding:1.25rem">
      <div class="empty-desc">Sin eventos proximos</div>
    </div>`;
    return;
  }

  const byDay = {};
  upcoming.forEach(ev => {
    const d = ev.start.dateTime ? new Date(ev.start.dateTime) : new Date(ev.start.date + 'T00:00:00');
    const key = d.toDateString();
    if (!byDay[key]) byDay[key] = { date: d, evs: [] };
    byDay[key].evs.push(ev);
  });

  list.innerHTML = Object.values(byDay).map(({ date, evs }) => {
    const isTodayFlag = date.toDateString() === new Date().toDateString();
    const label = isTodayFlag ? 'Hoy' :
      DAYS_CAL[(date.getDay() + 6) % 7] + ' ' + date.getDate() + ' ' + MONTHS_CAL[date.getMonth()].slice(0,3);
    return `<div class="cal-upcoming-date">${label}</div>` +
      evs.map(ev => renderEventItem(ev)).join('');
  }).join('');
}

// ─── CREAR EVENTO ─────────────────────────────────────────
window.openAddCalEvent = function() {
  if (!gcalToken) { calLogin(); return; }
  const d = new Date();
  const pad = n => String(n).padStart(2,'0');
  document.getElementById('cal-ev-date').value =
    `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  openModal('modal-cal-event');
  setTimeout(() => document.getElementById('cal-ev-title').focus(), 300);
};

window.saveCalEvent = async function() {
  const title    = document.getElementById('cal-ev-title').value.trim();
  if (!title) { showToast('Escribe un titulo'); return; }
  const dateVal  = document.getElementById('cal-ev-date').value;
  const timeVal  = document.getElementById('cal-ev-time').value;
  const duration = parseInt(document.getElementById('cal-ev-duration').value);
  const location = document.getElementById('cal-ev-location').value.trim();

  if (!dateVal) { showToast('Selecciona una fecha'); return; }

  let body;
  if (duration === 0) {
    body = { summary: title, start: { date: dateVal }, end: { date: dateVal } };
  } else {
    const start = new Date(`${dateVal}T${timeVal}:00`);
    const end   = new Date(start.getTime() + duration * 60000);
    const tz    = Intl.DateTimeFormat().resolvedOptions().timeZone;
    body = {
      summary: title,
      start: { dateTime: start.toISOString(), timeZone: tz },
      end:   { dateTime: end.toISOString(),   timeZone: tz }
    };
  }
  if (location) body.location = location;

  document.getElementById('cal-sync-text').textContent = 'Creando evento...';
  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + gcalToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );
    if (!res.ok) throw new Error(await res.text());
    showToast('Evento creado en Google Calendar');
    closeModal('modal-cal-event');
    document.getElementById('cal-ev-title').value = '';
    document.getElementById('cal-ev-location').value = '';
    await fetchCalEvents();
    renderCalUpcoming();
  } catch(e) {
    showToast('Error al crear el evento');
    console.error(e);
  }
};
