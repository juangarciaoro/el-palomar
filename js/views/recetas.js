// ═══════════════════════════════════════════════════════
// RECETAS
// ═══════════════════════════════════════════════════════

let recetasData        = [];
let recetaPhotoFile    = null;
let recetaIngredients  = [];
let editingRecetaId    = null;  // null = nueva receta, string = edición

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
  const unsub = db.collection('recetas')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      recetasData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderRecetas();
    }, err => console.warn('recetas listener:', err));
  if (window.unsubscribers) unsubscribers.push(unsub);
}

// ─── Render grid ────────────────────────────────────────
function renderRecetas() {
  const sub = document.getElementById('recetas-sub');
  if (sub) sub.textContent = `${recetasData.length} receta${recetasData.length !== 1 ? 's' : ''} guardada${recetasData.length !== 1 ? 's' : ''}`;

  const grid = document.getElementById('recetas-grid');
  if (!grid) return;

  if (!recetasData.length) {
    grid.innerHTML = `<div class="empty-state">
      <div class="empty-icon">👨‍🍳</div>
      <div class="empty-title">Sin recetas</div>
      <div class="empty-desc">Añade tu primera receta con el botón "+"</div>
    </div>`;
    return;
  }

  grid.innerHTML = `<div class="recetas-grid">${recetasData.map(r => {
    const numIng = (r.ingredients || []).length;
    const photo  = r.photoData || r.photoURL || null;
    return `<div class="receta-card" onclick="openRecetaDetail('${r.id}')">
      <div class="receta-photo-thumb" style="${photo ? `background-image:url('${photo}')` : ''}">
        ${!photo ? '<span class="receta-photo-empty">🍽️</span>' : ''}
      </div>
      <div class="receta-card-body">
        <div class="receta-card-name">${r.name}</div>
        <div class="receta-card-meta">${numIng} ingrediente${numIng !== 1 ? 's' : ''}</div>
      </div>
      <button class="receta-edit-btn" onclick="event.stopPropagation();openEditReceta('${r.id}')" title="Editar">✏️</button>
      <button class="receta-delete-btn" onclick="event.stopPropagation();deleteReceta('${r.id}')" title="Eliminar">✕</button>
    </div>`;
  }).join('')}</div>`;
}

// ─── Open add modal ──────────────────────────────────────
window.openAddReceta = function () {
  editingRecetaId   = null;
  recetaPhotoFile   = null;
  recetaIngredients = [];
  document.getElementById('receta-modal-title').textContent = 'Nueva receta';
  document.getElementById('receta-name-input').value = '';
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
      ingredients: [...recetaIngredients],
      photoData
    };

    if (editingRecetaId) {
      await db.collection('recetas').doc(editingRecetaId).update(data);
      showToast('Receta actualizada ✓');
    } else {
      await db.collection('recetas').add({
        ...data,
        addedBy:   currentUser || '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast('Receta guardada ✓');
    }

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
window.deleteReceta = async function (id) {
  try {
    await db.collection('recetas').doc(id).delete();
    showToast('Receta eliminada');
  } catch (err) {
    console.error('deleteReceta:', err);
    showToast('Error al eliminar');
  }
};
