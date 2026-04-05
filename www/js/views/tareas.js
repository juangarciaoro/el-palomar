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
  else if (currentTareaFilter === 'mias') filtered = filtered.filter(t => {
    const assignees = Array.isArray(t.assignees) ? t.assignees : (t.assigned ? [t.assigned] : []);
    return assignees.includes(currentUser);
  });
  else if (['limpiar','cocina','compras'].includes(currentTareaFilter))
    filtered = filtered.filter(t => t.cat === currentTareaFilter);

  const list = document.getElementById('tareas-list');
  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div>
      <div class="empty-title">Sin tareas</div>
      <div class="empty-desc">¡Todo al día!</div>
    </div>`;
    return;
  }

  const CAT_EMOJI  = { limpiar:'🧹', cocina:'🍳', compras:'🛒', jardín:'🌿', admin:'📋', bebé:'👶', otros:'📦' };

  const renderItem = t => {
    const assignees = Array.isArray(t.assignees) ? t.assignees : (t.assigned ? [t.assigned] : []);
    return `
    <div class="tarea-item ${t.done ? 'done' : ''}">
      <div class="check-box ${t.done ? 'checked' : ''}" onclick="toggleTarea('${t.id}')" style="flex-shrink:0">
        ${t.done ? '✓' : ''}
      </div>
      <div class="tarea-body">
        <div class="tarea-name">${t.name}</div>
        <div class="tarea-meta">
          <span class="tarea-tag">${CAT_EMOJI[t.cat]||'📦'} ${t.cat}</span>
          ${assignees.length ? `<span class="tarea-assigned">→ ${assignees.join(', ')}</span>` : ''}
        </div>
      </div>
      <button class="item-edit" onclick="openEditTarea('${t.id}')">✎</button>
      <button class="item-delete" onclick="deleteTarea('${t.id}')">✕</button>
    </div>`;
  };

  const groupFilters = ['todas', 'pendientes'];
  if (groupFilters.includes(currentTareaFilter)) {
    const PRIO_LABEL = { alta: 'Alta prioridad', media: 'Prioridad media', baja: 'Sin urgencia' };
    const PRIO_COLOR = { alta: 'var(--danger)', media: 'var(--warning)', baja: 'var(--accent-light)' };
    const groups = { alta: [], media: [], baja: [] };
    filtered.forEach(t => { (groups[t.prio] || groups.baja).push(t); });
    list.innerHTML = Object.entries(groups).map(([prio, items]) => {
      if (!items.length) return '';
      return `
        <div class="tarea-group-header">
          <span class="tarea-group-dot" style="background:${PRIO_COLOR[prio]}"></span>
          <span>${PRIO_LABEL[prio]}</span>
          <span class="tarea-group-count">${items.length}</span>
        </div>
        ${items.map(renderItem).join('')}`;
    }).join('');
  } else {
    list.innerHTML = filtered.map(renderItem).join('');
  }
}

window.filterTareas = function(f, btn) {
  currentTareaFilter = f;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  renderTareas();
};

window.openAddTarea = function() {
  document.getElementById('tarea-edit-id').value = '';
  document.getElementById('tarea-modal-title').textContent = 'Nueva tarea';
  document.getElementById('tarea-name-input').value = '';
  document.getElementById('tarea-cat-input').value = 'limpiar';
  document.getElementById('tarea-prio-input').value = 'baja';
  document.querySelectorAll('#tarea-assign-group input[type="checkbox"]').forEach(cb => cb.checked = false);
  openModal('modal-tarea');
  setTimeout(() => document.getElementById('tarea-name-input').focus(), 300);
};

window.openEditTarea = function(id) {
  const t = tareasData.find(x => x.id === id);
  if (!t) return;
  document.getElementById('tarea-edit-id').value = id;
  document.getElementById('tarea-modal-title').textContent = 'Editar tarea';
  document.getElementById('tarea-name-input').value = t.name;
  document.getElementById('tarea-cat-input').value = t.cat || 'otros';
  document.getElementById('tarea-prio-input').value = t.prio || 'baja';
  const assignees = Array.isArray(t.assignees) ? t.assignees : (t.assigned ? [t.assigned] : []);
  document.querySelectorAll('#tarea-assign-group input[type="checkbox"]').forEach(cb => {
    cb.checked = assignees.includes(cb.value);
  });
  openModal('modal-tarea');
  setTimeout(() => document.getElementById('tarea-name-input').focus(), 300);
};

window.saveTarea = async function() {
  const name = document.getElementById('tarea-name-input').value.trim();
  if (!name) { showToast('Escribe la tarea'); return; }
  const assignees = Array.from(
    document.querySelectorAll('#tarea-assign-group input[type="checkbox"]:checked')
  ).map(cb => cb.value);
  const editId = document.getElementById('tarea-edit-id').value;
  const data = {
    name,
    cat:      document.getElementById('tarea-cat-input').value,
    prio:     document.getElementById('tarea-prio-input').value,
    assignees,
  };
  if (editId) {
    if (CONFIGURED && db) {
      await db.collection('tareas').doc(editId).update(data);
    } else {
      const t = tareasData.find(x => x.id === editId);
      if (t) Object.assign(t, data);
      renderTareas();
    }
    closeModal('modal-tarea');
    showToast('Tarea actualizada');
  } else {
    const tarea = {
      ...data,
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
    closeModal('modal-tarea');
    showToast('Tarea añadida');
  }
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

window.deleteTarea = function(id) {
  showConfirm({
    title: 'Eliminar tarea',
    message: '¿Seguro que quieres eliminar esta tarea?',
    confirmText: 'Eliminar',
    onConfirm: async () => {
      if (CONFIGURED && db) {
        await db.collection('tareas').doc(id).delete();
      } else {
        tareasData = tareasData.filter(t => t.id !== id);
        renderTareas();
      }
    }
  });
};
