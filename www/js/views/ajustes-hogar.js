// ═══════════════════════════════════════════════════════
// AJUSTES DEL HOGAR
// ═══════════════════════════════════════════════════════

window.showAjustesHogarView = async function() {
  let view = document.getElementById('view-ajustes-hogar');
  if (!view) {
    view = document.createElement('div');
    view.id = 'view-ajustes-hogar';
    view.className = 'view';
    document.getElementById('main-content').appendChild(view);
  }

  view.innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title">Ajustes del hogar</div>
        <div class="section-sub" id="ajustes-hogar-sub">—</div>
      </div>
    </div>
    <div id="ajustes-hogar-body" style="padding-bottom:2rem">
      <div class="card" style="padding:1.25rem;text-align:center;color:var(--text-muted)">
        Cargando…
      </div>
    </div>`;

  await renderAjustesHogar();
};

async function renderAjustesHogar() {
  const hogar = window.activeHogar;
  if (!hogar) return;

  const sub = document.getElementById('ajustes-hogar-sub');
  if (sub) sub.textContent = hogar.nombre;

  // Cargar miembros
  let members = [];
  try {
    const snap = await db.collection('hogares').doc(hogar.id).collection('members').get();
    snap.forEach(doc => members.push({ uid: doc.id, ...doc.data() }));
  } catch(e) { console.warn('ajustes members:', e); }

  // Enriquecer con perfiles de usuario
  const memberProfiles = await Promise.all(members.map(async m => {
    try {
      const uSnap = await db.collection('users').doc(m.uid).get();
      return uSnap.exists ? { ...m, ...uSnap.data() } : m;
    } catch(e) { return m; }
  }));

  const isAdmin = members.find(m => m.uid === firebaseUser.uid)?.role === 'admin';

  // Cargar invitaciones pendientes (solo admin)
  let invitaciones = [];
  if (isAdmin) {
    try {
      const invSnap = await db.collection('hogares').doc(hogar.id)
        .collection('invitaciones')
        .where('used', '==', false)
        .get();
      invSnap.forEach(doc => invitaciones.push({ id: doc.id, ...doc.data() }));
    } catch(e) { console.warn('ajustes invitaciones:', e); }
  }

  const body = document.getElementById('ajustes-hogar-body');
  if (!body) return;

  body.innerHTML = `
    <!-- Nombre del hogar -->
    <div class="card" style="padding:1.25rem;margin-bottom:1rem">
      <div style="font-size:0.78rem;font-weight:600;color:var(--text-muted);margin-bottom:0.75rem;text-transform:uppercase;letter-spacing:.05em">Nombre del hogar</div>
      ${isAdmin
        ? `<div style="display:flex;gap:0.5rem;align-items:center">
            <input class="form-input" id="hogar-nombre-input" value="${hogar.nombre}" style="flex:1">
            <button class="btn-primary" style="padding:0.5rem 0.9rem;font-size:0.85rem" onclick="saveHogarNombre()">Guardar</button>
          </div>`
        : `<div style="font-size:1rem;font-weight:500;color:var(--text)">${hogar.nombre}</div>
           <div style="font-size:0.78rem;color:var(--text-muted);margin-top:0.25rem">Solo los administradores pueden cambiar el nombre.</div>`
      }
    </div>

    <!-- Google Calendar -->
    <div class="card" style="padding:1.25rem;margin-bottom:1rem">
      <div style="font-size:0.78rem;font-weight:600;color:var(--text-muted);margin-bottom:0.75rem;text-transform:uppercase;letter-spacing:.05em">Google Calendar</div>
      ${isAdmin
        ? `<div style="display:flex;gap:0.5rem;align-items:center">
            <input class="form-input" id="hogar-cal-input" value="${hogar.calendarId || ''}" placeholder="ID del calendario de Google" style="flex:1;font-size:0.82rem">
            <button class="btn-primary" style="padding:0.5rem 0.9rem;font-size:0.85rem" onclick="saveHogarCalendar()">Guardar</button>
          </div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.4rem">Encuentra el ID en Google Calendar → Configuración → ID del calendario.</div>`
        : `<div style="font-size:0.85rem;color:var(--text-muted)">${hogar.calendarId || 'No configurado'}</div>`
      }
    </div>

    <!-- Miembros -->
    <div class="card" style="padding:1.25rem;margin-bottom:1rem">
      <div style="font-size:0.78rem;font-weight:600;color:var(--text-muted);margin-bottom:0.75rem;text-transform:uppercase;letter-spacing:.05em">Miembros (${memberProfiles.length})</div>
      ${memberProfiles.map(m => `
        <div style="display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0;border-bottom:1px solid var(--border)">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:0.85rem;font-weight:600;color:#fff;flex-shrink:0;${m.photoURL ? `background-image:url(${m.photoURL});background-size:cover;background-position:center` : ''}">
            ${m.photoURL ? '' : (m.displayName || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:0.9rem;font-weight:500;color:var(--text)">${m.displayName || m.uid}</div>
            <div style="font-size:0.75rem;color:var(--text-muted)">${m.role === 'admin' ? 'Administrador' : 'Miembro'}${m.uid === hogar.ownerId ? ' · Propietario' : ''}</div>
          </div>
          ${isAdmin && m.uid !== firebaseUser.uid
            ? `<button class="btn-ghost-danger" style="font-size:0.78rem;padding:0.3rem 0.6rem" onclick="expulsarMiembro('${m.uid}','${(m.displayName||'').replace(/'/g,"\\'")}')">Expulsar</button>`
            : ''}
        </div>
      `).join('')}
    </div>

    <!-- Invitaciones -->
    ${isAdmin ? `
    <div class="card" style="padding:1.25rem;margin-bottom:1rem">
      <div style="font-size:0.78rem;font-weight:600;color:var(--text-muted);margin-bottom:0.75rem;text-transform:uppercase;letter-spacing:.05em">Invitaciones</div>
      <button class="btn-primary" style="width:100%;padding:0.75rem;margin-bottom:${invitaciones.length ? '0.75rem' : '0'}" onclick="generarInvitacion()">
        Generar enlace de invitación
      </button>
      ${invitaciones.map(inv => {
        const url = `${location.origin}${location.pathname}?invite=${inv.id}`;
        const exp = inv.expiresAt ? new Date(inv.expiresAt.seconds * 1000).toLocaleString('es-ES') : '—';
        return `<div style="background:var(--surface);border-radius:0.5rem;padding:0.6rem 0.75rem;margin-bottom:0.5rem;font-size:0.78rem">
          <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-muted)">${url}</span>
            <button class="btn-secondary" style="padding:0.25rem 0.5rem;font-size:0.75rem;flex-shrink:0" onclick="copiarEnlace('${url}')">Copiar</button>
            <button class="btn-ghost-danger" style="padding:0.25rem 0.5rem;font-size:0.75rem;flex-shrink:0" onclick="revocarInvitacion('${inv.id}')">Revocar</button>
          </div>
          <div style="color:var(--text-muted);margin-top:0.2rem">Expira: ${exp}</div>
        </div>`;
      }).join('')}
    </div>` : ''}

    <!-- Mis hogares -->
    <div id="ajustes-mis-hogares"></div>
    `;

  renderMisHogares();
}

// ─── Guardar nombre del hogar ─────────────────────────────
window.saveHogarNombre = async function() {
  const input = document.getElementById('hogar-nombre-input');
  const nombre = input ? input.value.trim() : '';
  if (!nombre) { showToast('El nombre no puede estar vacío'); return; }
  try {
    await db.collection('hogares').doc(window.activeHogarId).update({ nombre });
    window.activeHogar.nombre = nombre;
    updateHogarName(nombre);
    showToast('Nombre guardado');
    const sub = document.getElementById('ajustes-hogar-sub');
    if (sub) sub.textContent = nombre;
  } catch(e) {
    console.error('saveHogarNombre:', e);
    showToast('Error al guardar el nombre');
  }
};

// ─── Guardar calendarId del hogar ─────────────────────────
window.saveHogarCalendar = async function() {
  const input = document.getElementById('hogar-cal-input');
  const calendarId = input ? input.value.trim() : '';
  try {
    await db.collection('hogares').doc(window.activeHogarId).update({ calendarId });
    window.activeHogar.calendarId = calendarId;
    showToast('Calendar ID guardado. Recarga la app para aplicarlo.');
  } catch(e) {
    console.error('saveHogarCalendar:', e);
    showToast('Error al guardar el Calendar ID');
  }
};

// ─── Invitaciones ─────────────────────────────────────────
window.generarInvitacion = async function() {
  try {
    const token = 'inv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const invData = {
      hogarId:   window.activeHogarId,
      createdBy: firebaseUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      expiresAt: firebase.firestore.Timestamp.fromDate(expiresAt),
      used: false
    };
    // Escritura principal en la subcollección del hogar
    await db.collection('hogares').doc(window.activeHogarId)
      .collection('invitaciones').doc(token).set(invData);
    // Índice raíz best-effort (para lookup sin conocer hogarId)
    db.collection('invitaciones').doc(token).set(invData).catch(() => {});

    // hogarId en la URL → acceptInvite puede leer la subcollección directamente
    const url = `${location.origin}${location.pathname}?invite=${token}&hogar=${window.activeHogarId}`;
    await copiarEnlace(url);
    showToast('Enlace copiado al portapapeles (válido 48h)');
    await renderAjustesHogar();
  } catch(e) {
    console.error('generarInvitacion:', e);
    showToast('Error al generar la invitación');
  }
};

window.copiarEnlace = async function(url) {
  try {
    await navigator.clipboard.writeText(url);
    showToast('Enlace copiado');
  } catch(e) {
    showToast('No se pudo copiar: ' + url);
  }
};

window.revocarInvitacion = async function(tokenId) {
  showConfirm({
    title: 'Revocar invitación',
    message: '¿Desactivar este enlace de invitación?',
    confirmText: 'Revocar',
    onConfirm: async () => {
      try {
        // Borrar de la subcollección del hogar (operación principal)
        await db.collection('hogares').doc(window.activeHogarId)
          .collection('invitaciones').doc(tokenId).delete();
        // Borrar del índice raíz (best-effort: falla silenciosamente si las rules aún no están actualizadas)
        db.collection('invitaciones').doc(tokenId).delete().catch(() => {});
        showToast('Invitación revocada');
        await renderAjustesHogar();
      } catch(e) {
        console.error('revocarInvitacion:', e);
        showToast('Error al revocar');
      }
    }
  });
};

// ─── Expulsar miembro ─────────────────────────────────────
window.expulsarMiembro = async function(uid, nombre) {
  showConfirm({
    title: 'Expulsar miembro',
    message: `¿Expulsar a "${nombre}" del hogar? Perderá el acceso inmediatamente.`,
    confirmText: 'Expulsar',
    onConfirm: async () => {
      try {
        await db.collection('hogares').doc(window.activeHogarId)
          .collection('members').doc(uid).delete();
        showToast(`"${nombre}" ha sido expulsado`);
        await renderAjustesHogar();
      } catch(e) {
        showToast('Error al expulsar miembro');
      }
    }
  });
};

// ─── Selector de hogar (mis hogares) ─────────────────────
async function renderMisHogares() {
  const container = document.getElementById('ajustes-mis-hogares');
  if (!container || !firebaseUser) return;

  try {
    // Buscar en qué hogares es miembro el usuario actual
    const snap = await db.collectionGroup('members').where(
      firebase.firestore.FieldPath.documentId()
        ? '__name__' : '__name__', '>=', ''
    ).get().catch(() => null);

    // Alternativa: consulta directa porque collectionGroup puede requerir índice
    // Leemos los hogares desde el campo activeHogarId y cualquier hogarId en el perfil
    // Por simplicidad, listamos todos los hogares donde memberId == uid
    const hogaresSnap = await db.collection('hogares').get();
    const misHogares = [];
    for (const doc of hogaresSnap.docs) {
      try {
        const mSnap = await db.collection('hogares').doc(doc.id)
          .collection('members').doc(firebaseUser.uid).get();
        if (mSnap.exists) misHogares.push({ id: doc.id, ...doc.data() });
      } catch(e) { /* sin acceso = no miembro */ }
    }

    if (misHogares.length <= 1) return; // no mostrar si solo hay un hogar

    container.innerHTML = `
      <div class="card" style="padding:1.25rem;margin-bottom:1rem">
        <div style="font-size:0.78rem;font-weight:600;color:var(--text-muted);margin-bottom:0.75rem;text-transform:uppercase;letter-spacing:.05em">Mis hogares</div>
        ${misHogares.map(h => `
          <div style="display:flex;align-items:center;gap:0.75rem;padding:0.4rem 0;border-bottom:1px solid var(--border)">
            <div style="flex:1;font-size:0.9rem;color:var(--text)">${h.nombre}</div>
            ${h.id === window.activeHogarId
              ? `<span style="font-size:0.75rem;color:var(--accent);font-weight:600">Activo</span>`
              : `<button class="btn-secondary" style="font-size:0.78rem;padding:0.3rem 0.6rem" onclick="cambiarHogar('${h.id}')">Activar</button>`
            }
          </div>
        `).join('')}
        <button class="btn-secondary" style="width:100%;margin-top:0.75rem;padding:0.6rem" onclick="showCreateHogarFlow()">+ Crear nuevo hogar</button>
      </div>`;
  } catch(e) {
    console.warn('renderMisHogares:', e);
  }
}

window.cambiarHogar = async function(hogarId) {
  showToast('Cambiando de hogar…');
  unsubscribers.forEach(u => u());
  unsubscribers.length = 0;
  await window.setActiveHogar(hogarId);
  updateHogarName(window.activeHogar.nombre);
  initData();
  if (window.initProductos) initProductos();
  if (window.initRecetas) initRecetas();
  if (window.initCategorias) initCategorias();
  switchView('dashboard');
  showToast(`Hogar activo: ${window.activeHogar.nombre}`);
};
