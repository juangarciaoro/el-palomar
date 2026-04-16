// ═══════════════════════════════════════════════════════
// CATEGORÍAS — Gestión de categorías de productos
// ═══════════════════════════════════════════════════════

const DEFAULT_CATS = [
  { emoji: '🥦', name: 'Frescos' },
  { emoji: '🥩', name: 'Carnicería' },
  { emoji: '🐟', name: 'Pescadería' },
  { emoji: '🥛', name: 'Lácteos' },
  { emoji: '🍞', name: 'Panadería' },
  { emoji: '🥫', name: 'Conservas' },
  { emoji: '🧴', name: 'Limpieza' },
  { emoji: '🧾', name: 'Varios' },
];

window.masterCategorias = [];

// Devuelve array de strings 'emoji nombre' para usar en <select>
window.getCatOptions = function() {
  if (window.masterCategorias.length === 0) {
    return DEFAULT_CATS.map(c => `${c.emoji} ${c.name}`);
  }
  return window.masterCategorias.map(c => `${c.emoji} ${c.name}`);
};

// Repopula todos los <select class="cat-select-dynamic">
window.populateCatSelects = function() {
  const options = window.getCatOptions();
  document.querySelectorAll('.cat-select-dynamic').forEach(sel => {
    const current = sel.value;
    sel.innerHTML = options.map(o => `<option value="${o}">${o}</option>`).join('');
    if (current && [...sel.options].some(o => o.value === current)) {
      sel.value = current;
    }
  });
};

function initCategorias() {
  if (!db) return;
  const unsub = hogarCol('categorias')
    .orderBy('name', 'asc')
    .onSnapshot(async snap => {
      if (snap.empty) {
        // Sembrar categorías por defecto la primera vez
        const batch = db.batch();
        DEFAULT_CATS.forEach((c, i) => {
          const ref = hogarCol('categorias').doc();
          batch.set(ref, {
            emoji: c.emoji,
            name: c.name,
            order: i,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });
        await batch.commit();
        return; // el listener volverá a dispararse con los datos sembrados
      }
      window.masterCategorias = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderCategorias();
      window.populateCatSelects();
    }, err => console.warn('categorias listener:', err));
  if (window.unsubscribers) unsubscribers.push(unsub);
}

// ─── Render lista ─────────────────────────────────────────
function renderCategorias() {
  const sub = document.getElementById('categorias-sub');
  if (sub) sub.textContent = `${window.masterCategorias.length} categoría${window.masterCategorias.length !== 1 ? 's' : ''}`;

  const list = document.getElementById('categorias-list');
  if (!list) return;

  if (!window.masterCategorias.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon" style="font-size:2.5rem">🏷️</div>
      <div class="empty-title">Sin categorías</div>
      <div class="empty-desc">Añade categorías para organizar los productos</div>
    </div>`;
    return;
  }

  list.innerHTML = `<div class="card">` +
    window.masterCategorias.map(c => `
      <div class="cat-mgmt-row" id="catrow-${c.id}">
        <span class="cat-mgmt-emoji">${c.emoji}</span>
        <span class="cat-mgmt-name">${c.name}</span>
        <div class="cat-mgmt-actions">
          <button class="cat-mgmt-btn" title="Editar"
            onclick="openEditCategoria('${c.id}', '${c.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', '${c.emoji}')">
            <svg class="icon" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <use href="icons.svg#i-edit-square"></use>
            </svg>
          </button>
          <button class="cat-mgmt-btn cat-mgmt-btn--danger" title="Eliminar"
            onclick="deleteCategoria('${c.id}', '${c.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')">
            <svg class="icon" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <use href="icons.svg#i-trash"></use>
            </svg>
          </button>
        </div>
      </div>
    `).join('') +
    `</div>`;
}

// ─── Modal ─────────────────────────────────────────────────
let _catEditId = null;

window.openAddCategoria = function() {
  _catEditId = null;
  document.getElementById('cat-modal-title').textContent = 'Nueva categoría';
  document.getElementById('cat-emoji-input').value = '';
  document.getElementById('cat-name-input').value = '';
  openModal('modal-categoria');
  setTimeout(() => document.getElementById('cat-emoji-input').focus(), 100);
};

window.openEditCategoria = function(id, name, emoji) {
  _catEditId = id;
  document.getElementById('cat-modal-title').textContent = 'Editar categoría';
  document.getElementById('cat-emoji-input').value = emoji;
  document.getElementById('cat-name-input').value = name;
  openModal('modal-categoria');
  setTimeout(() => document.getElementById('cat-name-input').focus(), 100);
};

window.saveCategoria = async function() {
  if (!CONFIGURED || !db) return;
  const emoji = document.getElementById('cat-emoji-input').value.trim();
  const name  = document.getElementById('cat-name-input').value.trim();
  if (!emoji) { showToast('El emoji es obligatorio'); return; }
  if (!name)  { showToast('El nombre es obligatorio'); return; }
  try {
    if (_catEditId) {
      await hogarCol('categorias').doc(_catEditId).update({ emoji, name });
      showToast('Categoría actualizada');
    } else {
      await hogarCol('categorias').add({
        emoji,
        name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast('Categoría añadida');
    }
    closeModal('modal-categoria');
  } catch(e) {
    console.error('saveCategoria:', e);
    showToast('Error al guardar la categoría');
  }
};

window.deleteCategoria = function(id, name) {
  showConfirm({
    title: 'Eliminar categoría',
    message: `¿Eliminar la categoría "${name}"? Los productos que la usan mantendrán su categoría actual.`,
    confirmText: 'Eliminar',
    onConfirm: async () => {
      try {
        await hogarCol('categorias').doc(id).delete();
        showToast(`Categoría "${name}" eliminada`);
      } catch(e) {
        console.error('deleteCategoria:', e);
        showToast('Error al eliminar');
      }
    }
  });
};
