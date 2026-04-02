// ═══════════════════════════════════════════════════════
// TAREAS
// ═══════════════════════════════════════════════════════

function renderTareas() {
  const pending = tareasData.filter(t => !t.done).length;
  document.getElementById('tareas-sub').textContent =
    `${pending} tarea${pending!==1?'s':''} pendiente${pending!==1?'s':''}`;
  const badge = document.getElementById('badge-tareas');
  if (pending > 0) { badge.textContent = pending; badge.style.display = 'flex'; }
  else { badge.style.display = 'none'; }

  let filtered = [...tareasData];
  if (currentTareaFilter === 'pendientes') filtered = filtered.filter(t => !t.done);
  else if (currentTareaFilter === 'mias') filtered = filtered.filter(t => t.assigned === currentUser);
  else if (['limpiar','cocina','compras'].includes(currentTareaFilter))
    filtered = filtered.filter(t => t.cat === currentTareaFilter);

  const list = document.getElementById('tareas-list');
  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">✅</div>
      <div class="empty-title">Sin tareas</div>
      <div class="empty-desc">¡Todo al día!</div>
    </div>`;
    return;
  }

  const PRIO_EMOJI = { alta: '🔴', media: '🟡', baja: '🟢' };
  const CAT_EMOJI  = { limpiar:'🧹', cocina:'🍳', compras:'🛒', jardín:'🌿', admin:'📋', bebé:'👶', otros:'📦' };

  list.innerHTML = filtered.map(t => `
    <div class="tarea-item ${t.done ? 'done' : ''}">
      <div class="priority-dot p-${t.prio || 'baja'}"></div>
      <div class="check-box ${t.done ? 'checked' : ''}" onclick="toggleTarea('${t.id}')" style="flex-shrink:0">
        ${t.done ? '✓' : ''}
      </div>
      <div class="tarea-body">
        <div class="tarea-name">${t.name}</div>
        <div class="tarea-meta">
          <span class="tarea-tag">${CAT_EMOJI[t.cat]||'📦'} ${t.cat}</span>
          ${t.assigned ? `<span class="tarea-assigned">→ ${t.assigned}</span>` : ''}
          <span>${PRIO_EMOJI[t.prio]||'🟢'}</span>
        </div>
      </div>
      <button class="item-delete" onclick="deleteTarea('${t.id}')">✕</button>
    </div>
  `).join('');
}

window.filterTareas = function(f, btn) {
  currentTareaFilter = f;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  renderTareas();
};

window.openAddTarea = function() {
  openModal('modal-tarea');
  setTimeout(() => document.getElementById('tarea-name-input').focus(), 300);
};

window.saveTarea = async function() {
  const name = document.getElementById('tarea-name-input').value.trim();
  if (!name) { showToast('Escribe la tarea'); return; }
  const tarea = {
    name,
    cat:      document.getElementById('tarea-cat-input').value,
    prio:     document.getElementById('tarea-prio-input').value,
    assigned: document.getElementById('tarea-assign-input').value,
    done:     false,
    addedBy:  currentUser,
    createdAt: CONFIGURED ? firebase.firestore.FieldValue.serverTimestamp() : Date.now()
  };
  if (CONFIGURED && db) {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    await db.collection('tareas').doc(id).set(tarea);
  } else {
    tarea.id = 'lt' + Date.now();
    tareasData.push(tarea);
    renderTareas();
  }
  document.getElementById('tarea-name-input').value = '';
  closeModal('modal-tarea');
  showToast('Tarea añadida');
};

window.toggleTarea = async function(id) {
  const t = tareasData.find(x => x.id === id);
  if (!t) return;
  if (CONFIGURED && db) {
    await db.collection('tareas').doc(id).update({ done: !t.done });
  } else {
    t.done = !t.done;
    renderTareas();
  }
};

window.deleteTarea = async function(id) {
  if (CONFIGURED && db) {
    await db.collection('tareas').doc(id).delete();
  } else {
    tareasData = tareasData.filter(t => t.id !== id);
    renderTareas();
  }
};
