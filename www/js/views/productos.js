// ═══════════════════════════════════════════════════════
// PRODUCTOS — Catálogo persistente de productos
// ═══════════════════════════════════════════════════════

// Inicializar globalmenete para que compra.js y recetas.js puedan usarla
// antes de que initProductos sea llamado
window.masterIngredients = window.masterIngredients || [];

let productosSearchQ = '';

function initProductos() {
  if (!db) return;
  const unsub = db.collection('productos')
    .orderBy('name', 'asc')
    .onSnapshot(snap => {
      window.masterIngredients = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderProductos();
    }, err => console.warn('productos listener:', err));
  if (window.unsubscribers) unsubscribers.push(unsub);
}

// ─── Upsert (añade si no existe, no-op si ya está) ───────
window.upsertProducto = async function(name, cat) {
  if (!CONFIGURED || !db || !name || !name.trim()) return;
  const nameTrim = name.trim();
  const key = nameTrim.toLowerCase();
  // Si ya está en memoria, no hacer escritura
  if (window.masterIngredients.some(i => i.name.toLowerCase() === key)) return;
  // Usar doc ID determinístico para evitar duplicados en Firestore
  const docId = key.replace(/\//g, '_').replace(/\./g, '_').slice(0, 100);
  try {
    await db.collection('productos').doc(docId).set(
      { name: nameTrim, cat: cat || '🧾 Varios', createdAt: firebase.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
  } catch(e) {
    console.warn('upsertProducto:', e);
  }
};

// ─── Render lista ─────────────────────────────────────────
function renderProductos() {
  const sub = document.getElementById('productos-sub');
  if (sub) sub.textContent = `${window.masterIngredients.length} producto${window.masterIngredients.length !== 1 ? 's' : ''} en el catálogo`;

  const list = document.getElementById('productos-list');
  if (!list) return;

  const q = productosSearchQ.toLowerCase();
  const filtered = q
    ? window.masterIngredients.filter(p =>
        p.name.toLowerCase().includes(q) || (p.cat || '').toLowerCase().includes(q))
    : window.masterIngredients;

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="icons.svg#i-package"></use></svg></div>
      <div class="empty-title">${q ? 'Sin resultados' : 'Sin productos'}</div>
      <div class="empty-desc">${q ? 'Prueba con otro término' : 'Los productos se añaden automáticamente al guardar recetas o añadir a la compra'}</div>
    </div>`;
    return;
  }

  // Agrupar por categoría
  const cats = {};
  filtered.forEach(p => {
    const cat = p.cat || '🧾 Varios';
    if (!cats[cat]) cats[cat] = [];
    cats[cat].push(p);
  });

  const CAT_OPTIONS = window.getCatOptions ? window.getCatOptions() :
    ['🥦 Frescos','🥩 Carnicería','🐟 Pescadería','🥛 Lácteos','🍞 Panadería','🥫 Conservas','🧴 Limpieza','🧾 Varios'];

  list.innerHTML = Object.entries(cats).map(([cat, items]) => `
    <div class="card category-section" style="margin-bottom:0.75rem">
      <div class="category-label">${cat}</div>
      ${items.map(p => `
        <div class="shop-item" id="prod-${p.id}">
          <span class="item-name">${p.name}</span>
          <select class="compra-inline-cat prod-cat-select" onchange="updateProductoCat('${p.id}', this.value)">
            ${CAT_OPTIONS.map(o => `<option value="${o}"${o === (p.cat || '🧾 Varios') ? ' selected' : ''}>${o}</option>`).join('')}
          </select>
          <button class="item-delete" onclick="deleteProducto('${p.id}', '${p.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')">✕</button>
        </div>
      `).join('')}
    </div>
  `).join('');
}

window.filterProductos = function(q) {
  productosSearchQ = q;
  renderProductos();
};

// ─── Update categoría ─────────────────────────────────────
window.updateProductoCat = async function(id, newCat) {
  if (!CONFIGURED || !db) return;
  const producto = window.masterIngredients.find(p => p.id === id);
  if (!producto) return;
  try {
    // Actualizar en catálogo
    await db.collection('productos').doc(id).update({ cat: newCat });
    // Actualizar items de compra que coincidan por nombre
    const snap = await db.collection('compra')
      .where('cat', '==', producto.cat || '🧾 Varios')
      .get();
    const batch = db.batch();
    snap.docs.forEach(doc => {
      if (doc.data().name.toLowerCase() === producto.name.toLowerCase()) {
        batch.update(doc.ref, { cat: newCat });
      }
    });
    await batch.commit();
    showToast(`Categoría de "${producto.name}" actualizada`);
  } catch(e) {
    console.error('updateProductoCat:', e);
    showToast('Error al actualizar la categoría');
  }
};
window.deleteProducto = function(id, name) {
  showConfirm({
    title: 'Eliminar producto',
    message: `¿Eliminar "${name}" del catálogo? Seguirá apareciendo en las recetas que ya lo tienen.`,
    confirmText: 'Eliminar',
    onConfirm: async () => {
      try {
        await db.collection('productos').doc(id).delete();
        showToast(`"${name}" eliminado del catálogo`);
      } catch(e) {
        console.error('deleteProducto:', e);
        showToast('Error al eliminar');
      }
    }
  });
};
