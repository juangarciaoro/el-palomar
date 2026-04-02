// ═══════════════════════════════════════════════════════
// COMPRA
// ═══════════════════════════════════════════════════════

function renderCompra() {
  const container = document.getElementById('compra-list');
  const pending   = compraItems.filter(i => !i.checked);
  const badge     = document.getElementById('badge-compra');

  document.getElementById('compra-sub').textContent =
    `${pending.length} producto${pending.length !== 1 ? 's' : ''} pendiente${pending.length !== 1 ? 's' : ''}`;
  document.getElementById('compra-stats').textContent =
    `${compraItems.length} total · ${compraItems.filter(i=>i.checked).length} marcados`;

  if (pending.length > 0) {
    badge.textContent = pending.length;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }

  if (!compraItems.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🛒</div>
      <div class="empty-title">Lista vacía</div>
      <div class="empty-desc">Añade productos con el botón "+"</div>
    </div>`;
    return;
  }

  const cats = {};
  compraItems.forEach(item => {
    if (!cats[item.cat]) cats[item.cat] = [];
    cats[item.cat].push(item);
  });

  container.innerHTML = Object.entries(cats).map(([cat, items]) => `
    <div class="card category-section">
      <div class="category-label">${cat}</div>
      ${items.map(item => `
        <div class="shop-item ${item.checked ? 'checked' : ''}" id="shopitem-${item.id}">
          <div class="check-box ${item.checked ? 'checked' : ''}" onclick="toggleItem('${item.id}')">
            ${item.checked ? '✓' : ''}
          </div>
          <span class="item-name">${item.name}</span>
          ${item.qty ? `<span class="item-qty">${item.qty}</span>` : ''}
          <button class="item-delete" onclick="deleteItem('${item.id}')">✕</button>
        </div>
      `).join('')}
    </div>
  `).join('');
}

window.openAddItem = function() {
  openModal('modal-item');
  setTimeout(() => document.getElementById('item-name-input').focus(), 300);
};

window.saveItem = async function() {
  const name = document.getElementById('item-name-input').value.trim();
  if (!name) { showToast('Escribe un producto'); return; }
  const item = {
    name,
    qty:       document.getElementById('item-qty-input').value.trim(),
    cat:       document.getElementById('item-cat-input').value,
    checked:   false,
    addedBy:   currentUser,
    createdAt: firebase && CONFIGURED ? firebase.firestore.FieldValue.serverTimestamp() : Date.now()
  };
  if (CONFIGURED && db) {
    const id = `item_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    await db.collection('compra').doc(id).set(item);
  } else {
    item.id = 'l' + Date.now();
    compraItems.push(item);
    renderCompra();
  }
  document.getElementById('item-name-input').value = '';
  document.getElementById('item-qty-input').value = '';
  closeModal('modal-item');
  showToast(`"${name}" añadido`);
};

window.toggleItem = async function(id) {
  const item = compraItems.find(i => i.id === id);
  if (!item) return;
  const newVal = !item.checked;
  if (CONFIGURED && db) {
    await db.collection('compra').doc(id).update({ checked: newVal });
  } else {
    item.checked = newVal;
    renderCompra();
  }
};

window.deleteItem = async function(id) {
  if (CONFIGURED && db) {
    await db.collection('compra').doc(id).delete();
  } else {
    compraItems = compraItems.filter(i => i.id !== id);
    renderCompra();
  }
};

window.clearChecked = async function() {
  const checked = compraItems.filter(i => i.checked);
  if (!checked.length) { showToast('No hay marcados'); return; }
  if (CONFIGURED && db) {
    await Promise.all(checked.map(i => db.collection('compra').doc(i.id).delete()));
  } else {
    compraItems = compraItems.filter(i => !i.checked);
    renderCompra();
  }
  showToast(`${checked.length} producto${checked.length>1?'s':''} eliminado${checked.length>1?'s':''}`);
};
