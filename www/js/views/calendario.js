// ═══════════════════════════════════════════════════════
// GOOGLE CALENDAR
// ═══════════════════════════════════════════════════════

const GCAL_SCOPES = 'https://www.googleapis.com/auth/calendar';

let gcalToken      = localStorage.getItem('gcal_token') || null;
let gcalTokenExp   = parseInt(localStorage.getItem('gcal_token_exp') || '0');
let calCurrentDate = new Date();
let calSelectedDate = new Date();
let calEvents      = [];

// ─── SILENT TOKEN REFRESH ────────────────────────────────
async function calSilentRefresh() {
  try {
    if (isNative()) {
      const { FirebaseAuthentication } = window.Capacitor.Plugins;
      const result = await FirebaseAuthentication.signInWithGoogle({ scopes: [GCAL_SCOPES] });
      const token = result.credential && result.credential.accessToken;
      if (token) {
        gcalToken    = token;
        gcalTokenExp = Date.now() + 3600 * 1000;
        localStorage.setItem('gcal_token',     token);
        localStorage.setItem('gcal_token_exp', String(gcalTokenExp));
        return true;
      }
    }
  } catch(e) {
    console.warn('Silent calendar refresh failed:', e);
  }
  return false;
}

// Muestra el calendario y auto-conecta si el token es valido
const _origSwitchView = window.switchView;
window.switchView = function(view) {
  _origSwitchView(view);
  if (view === 'calendario') {
    const hasCalendar = window.activeHogar && window.activeHogar.calendarId;
    if (!hasCalendar) {
      showCalNoConfig();
      return;
    }
    if (gcalToken && Date.now() < gcalTokenExp) {
      showCalMain();
    } else if (gcalToken) {
      // Token expirado: intentar refresco silencioso (nativo) o mostrar reconexión
      calSilentRefresh().then(ok => {
        if (ok) showCalMain();
        else {
          gcalToken = null;
          gcalTokenExp = 0;
          localStorage.removeItem('gcal_token');
          localStorage.removeItem('gcal_token_exp');
          showToast('Sesión de Google Calendar expirada. Vuelve a conectar.');
        }
      });
    }
  }
};

function showCalNoConfig() {
  const loginState = document.getElementById('cal-login-state');
  const mainState  = document.getElementById('cal-main-state');
  if (loginState) loginState.innerHTML = `
    <div class="card" style="padding:1.5rem;text-align:center">
      <div style="font-size:2.5rem;margin-bottom:0.75rem">&#128197;</div>
      <div style="font-weight:600;margin-bottom:0.4rem">Calendario no configurado</div>
      <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:1.25rem;line-height:1.5">
        Un administrador del hogar debe configurar el ID de Google Calendar en los Ajustes del hogar.
      </div>
      <button class="btn-secondary" style="width:100%;padding:0.85rem" onclick="closeUserDrawer(); showAjustesHogarView(); switchView('ajustes-hogar')">
        Ir a Ajustes del hogar
      </button>
    </div>`;
  if (loginState) loginState.style.display = 'block';
  if (mainState)  mainState.style.display  = 'none';
}

// --- REFRESCO DE TOKEN (usa Firebase Auth) ------------------
window.calLogin = async function() {
  if (isNative()) {
    try {
      const { FirebaseAuthentication } = window.Capacitor.Plugins;
      const result = await FirebaseAuthentication.signInWithGoogle({
        scopes: [GCAL_SCOPES]
      });
      const token = result.credential && result.credential.accessToken;
      if (token) {
        gcalToken    = token;
        gcalTokenExp = Date.now() + 3600 * 1000;
        localStorage.setItem('gcal_token',     token);
        localStorage.setItem('gcal_token_exp', String(gcalTokenExp));
        showCalMain();
      } else {
        showToast('No se pudo obtener acceso a Google Calendar');
      }
    } catch(err) {
      if (err.code !== 'SIGN_IN_CANCELLED') {
        showToast('Error al conectar con Google Calendar');
        console.error(err);
      }
    }
  } else {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope(GCAL_SCOPES);
    provider.setCustomParameters({ prompt: 'consent' });
    firebase.auth().signInWithPopup(provider)
      .then(result => {
        const token = result.credential && result.credential.accessToken;
        if (token) {
          gcalToken    = token;
          gcalTokenExp = Date.now() + 3600 * 1000;
          localStorage.setItem('gcal_token',        token);
          localStorage.setItem('gcal_token_exp',    String(gcalTokenExp));
          localStorage.setItem('gcal_scope_granted', '1');
          showCalMain();
        }
      })
      .catch(err => {
        if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
          showToast('Error al conectar con Google Calendar');
          console.error(err);
        }
      });
  }
};

window.calLogout = function() {
  gcalToken = null;
  gcalTokenExp = 0;
  localStorage.removeItem('gcal_token');
  localStorage.removeItem('gcal_token_exp');
  localStorage.removeItem('gcal_scope_granted');
  document.getElementById('cal-login-state').style.display = 'block';
  document.getElementById('cal-main-state').style.display  = 'none';
  showToast('Desconectado de Google Calendar');
};

// Llamar desde showApp() tras el login
window.calInit = async function() {
  // No inicializar si el hogar no tiene calendarId
  if (!window.activeHogar || !window.activeHogar.calendarId) return;
  const t = localStorage.getItem('gcal_token');
  const e = parseInt(localStorage.getItem('gcal_token_exp') || '0');
  if (t && Date.now() < e) {
    gcalToken    = t;
    gcalTokenExp = e;
    await fetchCalEvents();
    if (currentView === 'dashboard') renderDashboard();
  } else if (isNative()) {
    // Token expirado: silent refresh si esta cuenta ya concedió el scope
    const uid = firebase.auth().currentUser && firebase.auth().currentUser.uid;
    const scopeGranted = uid
      ? !!localStorage.getItem(`gcal_scope_granted_${uid}`)
      : !!localStorage.getItem('gcal_scope_granted');
    if (scopeGranted) {
      try {
        const { FirebaseAuthentication } = window.Capacitor.Plugins;
        const loginHint = localStorage.getItem('gcal_login_hint');
        const result = await FirebaseAuthentication.signInWithGoogle({
          scopes: ['https://www.googleapis.com/auth/calendar'],
          ...(loginHint && { loginHint })
        });
        const newToken = result.credential && result.credential.accessToken;
        if (newToken) {
          gcalToken    = newToken;
          gcalTokenExp = Date.now() + 3600 * 1000;
          localStorage.setItem('gcal_token',     newToken);
          localStorage.setItem('gcal_token_exp', String(gcalTokenExp));
          await fetchCalEvents();
          if (currentView === 'dashboard') renderDashboard();
        }
      } catch (_) {
        // Silent refresh falló (sin conexión, cuenta eliminada, etc.) — ignorar
      }
    }
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

  // Usar solo el calendarId del hogar activo — sin fallback a otras cuentas
  const calId = (window.activeHogar && window.activeHogar.calendarId)
    ? window.activeHogar.calendarId
    : null;
  if (!calId) {
    const syncText = document.getElementById('cal-sync-text');
    if (syncText) syncText.textContent = 'Sin calendario configurado';
    return;
  }

  document.getElementById('cal-sync-dot').classList.add('syncing');
  document.getElementById('cal-sync-text').textContent = 'Actualizando...';

  const now   = new Date();
  const start = now;
  const end   = new Date(now);
  end.setDate(now.getDate() + 15);

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?` +
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
      // Intentar refresco silencioso antes de desloguear
      const refreshed = await calSilentRefresh();
      if (refreshed) {
        const retryRes = await fetch(url, { headers: { Authorization: 'Bearer ' + gcalToken } });
        if (retryRes.ok) {
          const data = await retryRes.json();
          calEvents = data.items || [];
          document.getElementById('cal-sync-dot').classList.remove('syncing');
          document.getElementById('cal-sync-text').textContent = 'Sincronizado';
          return;
        }
      }
      calLogout();
      showToast(`Sesión de Google Calendar expirada. Vuelve a conectar.`);
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
    return `<div class="cal-upcoming-day">
      <div class="cal-upcoming-date">${label}</div>
      <div class="cal-upcoming-evs">
        ${evs.map(ev => renderEventItem(ev)).join('')}
      </div>
    </div>`;
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

  const createCalId = (window.activeHogar && window.activeHogar.calendarId)
    ? window.activeHogar.calendarId : null;
  if (!createCalId) { showToast('Este hogar no tiene un calendario configurado'); return; }

  document.getElementById('cal-sync-text').textContent = 'Creando evento...';
  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(createCalId)}/events`,
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
