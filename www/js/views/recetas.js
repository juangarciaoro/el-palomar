// ═══════════════════════════════════════════════════════
// RECETAS
// ═══════════════════════════════════════════════════════

let recetasData        = [];
let recetasSearchQ     = '';
let recetaPhotoFile    = null;
let recetaIngredients  = [];
let editingRecetaId    = null;  // null = nueva receta, string = edición
let ingSugIndex        = -1;    // índice de la sugerencia activa (teclado)

function normalizeRecetaLink(url) {
  const value = (url || '').trim();
  if (!value) return '';
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value)) return value;
  return `https://${value.replace(/^\/+/, '')}`;
}

// ─── Compress image to base64 via Canvas ────────────────────
function compressImage(file, maxPx = 800, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width > height) { height = Math.round(height * maxPx / width);  width = maxPx; }
        else                { width  = Math.round(width  * maxPx / height); height = maxPx; }
      }
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ─── Firestore listener ──────────────────────────────────
function initRecetas() {
  if (!db) return;
  const unsub = hogarCol('recetas')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      recetasData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderRecetas();
      // If dashboard is visible, refresh it so avatars can pick up newly-loaded photos
      try { if (typeof renderDashboard === 'function' && currentView === 'dashboard') renderDashboard(); } catch (e) { /* silent */ }
      // Refresh comidas avatars whenever recipe photos are (re)loaded
      try { if (typeof applyComidasAvatars === 'function') applyComidasAvatars(); } catch (e) { /* silent */ }
    }, err => console.warn('recetas listener:', err));
  if (window.unsubscribers) unsubscribers.push(unsub);
}

// ─── Render grid ────────────────────────────────────────
function renderRecetas() {
  const q = recetasSearchQ.trim().toLowerCase();
  const filtered = q
    ? recetasData.filter(r => {
        const name = (r.name || '').toLowerCase();
        const ingredients = (r.ingredients || [])
          .map(ing => typeof ing === 'object' ? (ing.name || '') : (ing || ''))
          .join(' ')
          .toLowerCase();
        return name.includes(q) || ingredients.includes(q);
      })
    : recetasData;

  const sub = document.getElementById('recetas-sub');
  if (sub) {
    const totalText = `${recetasData.length} receta${recetasData.length !== 1 ? 's' : ''} guardada${recetasData.length !== 1 ? 's' : ''}`;
    sub.textContent = q ? `${filtered.length} de ${totalText}` : totalText;
  }

  const grid = document.getElementById('recetas-grid');
  if (!grid) return;

  buildMasterIngredients();

  if (!recetasData.length) {
    grid.innerHTML = `<div class="empty-state">
      <div class="empty-icon"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="icons.svg#i-chef-hat"></use></svg></div>
      <div class="empty-title">Sin recetas</div>
      <div class="empty-desc">Añade tu primera receta con el botón "+"</div>
    </div>`;
    return;
  }

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state">
      <div class="empty-icon"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="icons.svg#i-search"></use></svg></div>
      <div class="empty-title">Sin resultados</div>
      <div class="empty-desc">Prueba con otro nombre o ingrediente</div>
    </div>`;
    return;
  }

  grid.innerHTML = `<div class="recetas-grid">${filtered.map(r => {
    const numIng = (r.ingredients || []).length;
    const photo  = r.photoData || r.photoURL || null;
    return `<div class="receta-card" onclick="openRecetaDetail('${r.id}')">
      <div class="receta-photo-thumb" style="${photo ? `background-image:url('${photo}')` : ''}">
        ${!photo ? '<span class="receta-photo-empty"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="icons.svg#i-utensils"></use></svg></span>' : ''}
      </div>
      <div class="receta-card-body">
        <div class="receta-card-name">${r.name}</div>
        <div class="receta-card-meta">${numIng} ingrediente${numIng !== 1 ? 's' : ''}</div>
      </div>
      <button class="receta-edit-btn" onclick="event.stopPropagation();openEditReceta('${r.id}')" title="Editar"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="icons.svg#i-edit"></use></svg></button>
      <button class="receta-delete-btn" onclick="event.stopPropagation();deleteReceta('${r.id}')" title="Eliminar">✕</button>
    </div>`;
  }).join('')}</div>`;
}

window.filterRecetas = function(q) {
  recetasSearchQ = q || '';
  renderRecetas();
};

// ─── Master ingredients (derivado de todas las recetas) ──────
// Mantiene compatibilidad local cuando productos.js no está disponible
function buildMasterIngredients() {
  if (window.upsertProducto) {
    // Con Firestore: persistir ingredientes nuevos en 'productos', masterIngredients
    // se actualiza via el listener de initProductos()
    seedProductosFromRecipes();
  } else {
    // Fallback local sin Firebase
    const map = new Map();
    recetasData.forEach(r => {
      (r.ingredients || []).forEach(ing => {
        const name = typeof ing === 'object' ? ing.name : ing;
        const cat  = typeof ing === 'object' ? ing.cat  : '🧾 Varios';
        const key  = name.trim().toLowerCase();
        if (key && !map.has(key)) map.set(key, { name: name.trim(), cat });
      });
    });
    window.masterIngredients = [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }
}

function seedProductosFromRecipes() {
  recetasData.forEach(r => {
    (r.ingredients || []).forEach(ing => {
      const name = typeof ing === 'object' ? ing.name : ing;
      const cat  = typeof ing === 'object' ? ing.cat  : '🧾 Varios';
      if (name && name.trim()) window.upsertProducto(name, cat);
    });
  });
}

// ─── Autocomplete ────────────────────────────────────────
window.filterIngSuggestions = function(val) {
  const q = val.trim().toLowerCase();
  const box = document.getElementById('ing-suggestions');
  if (!box) return;
  ingSugIndex = -1;
  if (!q) { box.style.display = 'none'; return; }
  const matches = window.masterIngredients.filter(i => i.name.toLowerCase().includes(q)).slice(0, 8);
  if (!matches.length) { box.style.display = 'none'; return; }
  box.innerHTML = matches.map((m, idx) =>
    `<div class="ing-sug-item" data-idx="${idx}" data-name="${m.name}" data-cat="${m.cat}"
      onmousedown="pickIngSuggestion('${m.name.replace(/'/g, "\\'")}',' ${m.cat.replace(/'/g, "\\'")}')">
      <span class="ing-sug-item-name">${m.name}</span>
      <span class="ing-sug-item-cat">${m.cat}</span>
    </div>`
  ).join('');
  box.style.display = 'block';
};

window.hideIngSuggestions = function() {
  setTimeout(() => {
    const box = document.getElementById('ing-suggestions');
    if (box) box.style.display = 'none';
  }, 150);
};

window.pickIngSuggestion = function(name, cat) {
  const input = document.getElementById('receta-ing-input');
  const sel   = document.getElementById('receta-ing-cat');
  if (input) input.value = name;
  if (sel) {
    const opt = [...sel.options].find(o => o.value.trim() === cat.trim());
    if (opt) sel.value = opt.value;
  }
  const box = document.getElementById('ing-suggestions');
  if (box) box.style.display = 'none';
  ingSugIndex = -1;
  input && input.focus();
};

window.onIngKeydown = function(e) {
  if (e.key === 'Enter') { addIngredient(); return; }
  const box = document.getElementById('ing-suggestions');
  if (!box || box.style.display === 'none') return;
  const items = box.querySelectorAll('.ing-sug-item');
  if (!items.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    ingSugIndex = Math.min(ingSugIndex + 1, items.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    ingSugIndex = Math.max(ingSugIndex - 1, 0);
  } else if (e.key === 'Tab' || e.key === 'Escape') {
    box.style.display = 'none'; return;
  } else { return; }
  items.forEach((el, i) => el.classList.toggle('active', i === ingSugIndex));
  if (ingSugIndex >= 0) {
    const el = items[ingSugIndex];
    pickIngSuggestion(el.dataset.name, el.dataset.cat);
    // Keep dropdown open so user can keep navigating
    setTimeout(() => filterIngSuggestions(el.dataset.name), 0);
  }
};

// ─── Open add modal ──────────────────────────────────────
window.openAddReceta = function () {
  editingRecetaId   = null;
  recetaPhotoFile   = null;
  recetaIngredients = [];
  document.getElementById('receta-modal-title').textContent = 'Nueva receta';
  document.getElementById('receta-name-input').value = '';
  document.getElementById('receta-link-input').value = '';
  const prev = document.getElementById('receta-photo-preview');
  prev.src = ''; prev.style.display = 'none';
  document.getElementById('receta-photo-input').value  = '';
  document.getElementById('receta-camera-input').value = '';
  renderIngredientList();
  openModal('modal-receta');
  setTimeout(() => document.getElementById('receta-name-input').focus(), 300);
};

// ─── Open edit modal ─────────────────────────────────────
window.openEditReceta = function (id) {
  const r = recetasData.find(x => x.id === id);
  if (!r) return;
  editingRecetaId   = id;
  recetaPhotoFile   = null;
  recetaIngredients = [...(r.ingredients || [])].map(ing =>
    typeof ing === 'object' ? ing : { name: ing, cat: '🧾 Varios' }
  );
  document.getElementById('receta-modal-title').textContent = 'Editar receta';
  document.getElementById('receta-name-input').value = r.name;
  document.getElementById('receta-link-input').value = r.link || '';
  const photo = r.photoData || r.photoURL || null;
  const prev  = document.getElementById('receta-photo-preview');
  if (photo) { prev.src = photo; prev.style.display = 'block'; }
  else { prev.src = ''; prev.style.display = 'none'; }
  document.getElementById('receta-photo-input').value  = '';
  document.getElementById('receta-camera-input').value = '';
  renderIngredientList();
  closeModal('modal-receta-detail');
  openModal('modal-receta');
  setTimeout(() => document.getElementById('receta-name-input').focus(), 300);
};

// ─── Detail modal ────────────────────────────────────────
window.openRecetaDetail = function (id) {
  const r = recetasData.find(x => x.id === id);
  if (!r) return;

  document.getElementById('detail-receta-name').textContent = r.name;
  document.getElementById('detail-receta-id').value = id;

  const linkWrap = document.getElementById('detail-receta-link-wrap');
  const linkEl = document.getElementById('detail-receta-link');
  const normalizedLink = normalizeRecetaLink(r.link || '');
  if (normalizedLink) {
    linkEl.href = normalizedLink;
    linkEl.textContent = 'Abrir enlace';
    linkWrap.style.display = 'block';
  } else {
    linkEl.href = '#';
    linkWrap.style.display = 'none';
  }

  const img   = document.getElementById('detail-receta-photo');
  const photo = r.photoData || r.photoURL || null;
  if (photo) { img.src = photo; img.style.display = 'block'; }
  else        { img.style.display = 'none'; }

  const ings = r.ingredients || [];
  document.getElementById('detail-receta-ingredients').innerHTML = ings.length
    ? ings.map(ing => {
        const name = typeof ing === 'object' ? ing.name : ing;
        const cat  = typeof ing === 'object' ? ing.cat  : '';
        return '<div class="ingredient-row">'
          + '<span class="ingredient-dot">•</span>'
          + '<span style="flex:1">' + name + '</span>'
          + (cat ? '<span style="font-size:0.75rem;color:var(--text-muted)">' + cat + '</span>' : '')
          + '</div>';
      }).join('')
    : '<div style="color:var(--text-muted);font-size:0.85rem;padding:0.4rem 0">Sin ingredientes registrados</div>';

  openModal('modal-receta-detail');
};

// ─── Photo inputs ────────────────────────────────────────
window.onRecetaPhotoChange = function (input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) {
    showToast('La foto no puede superar 8 MB');
    input.value = '';
    return;
  }
  recetaPhotoFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    const prev = document.getElementById('receta-photo-preview');
    prev.src = e.target.result;
    prev.style.display = 'block';
  };
  reader.readAsDataURL(file);
};

window.triggerPhotoInput  = function () { document.getElementById('receta-photo-input').click(); };
window.triggerCameraInput = function () { document.getElementById('receta-camera-input').click(); };

// ─── Ingredients list ────────────────────────────────────
function renderIngredientList() {
  const list = document.getElementById('receta-ing-list');
  if (!list) return;
  list.innerHTML = recetaIngredients.map((ing, i) => {
    const name = typeof ing === 'object' ? ing.name : ing;
    const cat  = typeof ing === 'object' ? ing.cat  : '';
    return '<div class="receta-ing-row">' +
      '<span class="ingredient-dot">•</span>' +
      '<span style="flex:1;font-size:0.9rem">' + name + '</span>' +
      (cat ? '<span style="font-size:0.75rem;color:var(--text-muted);margin-right:0.4rem">' + cat + '</span>' : '') +
      '<button class="item-delete" style="position:static" onclick="removeIngredient(' + i + ')">✕</button>' +
    '</div>';
  }).join('');
}

window.addIngredient = function () {
  const input = document.getElementById('receta-ing-input');
  const sel   = document.getElementById('receta-ing-cat');
  const val   = input.value.trim();
  if (!val) return;
  recetaIngredients.push({ name: val, cat: sel ? sel.value : '🧾 Varios' });
  input.value = '';
  renderIngredientList();
  input.focus();
};

window.removeIngredient = function (i) {
  recetaIngredients.splice(i, 1);
  renderIngredientList();
};

// ─── Save (create or update) ─────────────────────────────
window.saveReceta = async function () {
  const name = document.getElementById('receta-name-input').value.trim();
  const link = document.getElementById('receta-link-input').value.trim();
  if (!name) { showToast('Escribe el nombre de la receta'); return; }

  const btn = document.getElementById('save-receta-btn');
  btn.disabled    = true;
  btn.textContent = 'Guardando…';

  try {
    // Keep existing photo unless a new file was selected
    let photoData = editingRecetaId
      ? (recetasData.find(r => r.id === editingRecetaId)?.photoData || null)
      : null;

    if (recetaPhotoFile) {
      btn.textContent = 'Comprimiendo foto…';
      photoData = await compressImage(recetaPhotoFile);
    }

    const data = {
      name,
      link,
      ingredients: [...recetaIngredients],
      photoData
    };

    if (editingRecetaId) {
      await hogarCol('recetas').doc(editingRecetaId).update(data);
      showToast('Receta actualizada ✓');
    } else {
      await hogarCol('recetas').add({
        ...data,
        addedBy:   currentUser || '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast('Receta guardada ✓');
    }

    // Persistir ingredientes nuevos en el catálogo
    recetaIngredients.forEach(ing => {
      const name = typeof ing === 'object' ? ing.name : ing;
      const cat  = typeof ing === 'object' ? ing.cat  : '🧾 Varios';
      if (window.upsertProducto) window.upsertProducto(name, cat);
    });

    closeModal('modal-receta');
  } catch (err) {
    console.error('saveReceta:', err);
    showToast('Error al guardar: ' + err.message);
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Guardar';
  }
};

// ─── Delete ──────────────────────────────────────────────
window.deleteReceta = function (id) {
  const receta = recetasData.find(r => r.id === id);
  const name = receta ? receta.name : 'esta receta';
  showConfirm({
    title: 'Eliminar receta',
    message: `¿Seguro que quieres eliminar "${name}"? Esta acción no se puede deshacer.`,
    confirmText: 'Eliminar',
    onConfirm: async () => {
      try {
        await hogarCol('recetas').doc(id).delete();
        showToast('Receta eliminada');
      } catch (err) {
        console.error('deleteReceta:', err);
        showToast('Error al eliminar');
      }
    }
  });
};
