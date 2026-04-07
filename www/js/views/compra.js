// ═══════════════════════════════════════════════════════
// COMPRA
// ═══════════════════════════════════════════════════════

const _catCheckedOpen = new Set();

function _renderShopItem(item) {
  return `
    <div class="shop-item ${item.checked ? 'checked' : ''}" id="shopitem-${item.id}">
      <div class="check-box ${item.checked ? 'checked' : ''}" onclick="toggleItem('${item.id}')">
        ${item.checked ? '✓' : ''}
      </div>
      <span class="item-name">${item.name}</span>
      <div class="item-units-stepper">
        <button onclick="changeUnits('${item.id}',-1)">−</button>
        <span>${item.units || 1}</span>
        <button onclick="changeUnits('${item.id}',1)">+</button>
      </div>
      <button class="item-delete" onclick="deleteItem('${item.id}')">✕</button>
    </div>`;
}

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
    const clearBar = document.getElementById('compra-clear-bar');
    if (clearBar) clearBar.style.display = 'none';
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="icons.svg#i-shopping-cart"></use></svg></div>
      <div class="empty-title">Lista vacía</div>
      <div class="empty-desc">Añade productos con el botón "+"</div>
    </div>`;
    return;
  }

  const clearBar = document.getElementById('compra-clear-bar');
  if (clearBar) clearBar.style.display = compraItems.filter(i=>i.checked).length > 0 ? '' : 'none';

  const total        = compraItems.length;
  const checkedCount = compraItems.filter(i => i.checked).length;
  const pct          = total ? Math.round(checkedCount / total * 100) : 0;

  const cats = {};
  compraItems.forEach(item => {
    if (!cats[item.cat]) cats[item.cat] = [];
    cats[item.cat].push(item);
  });

  container.innerHTML =
    `<div class="compra-progress"><div class="compra-progress-bar" style="width:${pct}%"></div></div>` +
    Object.entries(cats).map(([cat, items]) => {
      const catPending = items.filter(i => !i.checked);
      const catChecked = items.filter(i => i.checked);
      const isOpen     = _catCheckedOpen.has(cat);
      const safecat    = cat.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

      const catBadge = catPending.length
        ? `<span class="cat-pending-badge">${catPending.length}</span>`
        : `<span class="cat-all-done">✓</span>`;

      const checkedSection = catChecked.length ? `
        <div class="cat-checked-toggle" onclick="toggleCatChecked('${safecat}')">
          <span class="cat-checked-label">Ya cogido</span>
          <span class="cat-checked-count">${catChecked.length}</span>
          <svg class="icon cat-checked-chevron${isOpen ? ' open' : ''}" width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><use href="icons.svg#i-chevron-down"></use></svg>
        </div>
        <div class="cat-checked-list${isOpen ? ' open' : ''}">
          ${catChecked.map(item => _renderShopItem(item)).join('')}
        </div>` : '';

      return `
      <div class="card category-section">
        <div class="category-label">${cat}${catBadge}</div>
        ${catPending.map(item => _renderShopItem(item)).join('')}
        ${checkedSection}
      </div>`;
    }).join('');
}

window.toggleCatChecked = function(cat) {
  if (_catCheckedOpen.has(cat)) {
    _catCheckedOpen.delete(cat);
  } else {
    _catCheckedOpen.add(cat);
  }
  renderCompra();
};

let compraSugIndex = -1;

window.filterCompraSuggestions = function(val) {
  const q = val.trim().toLowerCase();
  const box = document.getElementById('compra-suggestions');
  if (!box) return;
  compraSugIndex = -1;
  if (!q) { box.style.display = 'none'; return; }

  // Pendientes en lista actual que coincidan
  const inList = compraItems
    .filter(i => !i.checked && i.name.toLowerCase().includes(q))
    .map(i => ({ name: i.name, cat: i.cat, inList: true }));

  // De masterIngredients (recetas), que no estén ya en inList
  const inListNames = new Set(inList.map(i => i.name.toLowerCase()));
  const fromRecetas = (window.masterIngredients || [])
    .filter(i => i.name.toLowerCase().includes(q) && !inListNames.has(i.name.toLowerCase()))
    .map(i => ({ name: i.name, cat: i.cat, inList: false }));

  const matches = [...inList, ...fromRecetas].slice(0, 8);
  if (!matches.length) { box.style.display = 'none'; return; }

  box.innerHTML = matches.map((m, idx) => {
    const badge = m.inList
      ? `<span style="font-size:0.7rem;background:var(--accent-pale);color:var(--accent);border-radius:4px;padding:1px 5px;flex-shrink:0">+1</span>`
      : `<span class="ing-sug-item-cat">${m.cat}</span>`;
    return `<div class="ing-sug-item" data-idx="${idx}" data-name="${m.name.replace(/"/g,'&quot;')}" data-cat="${m.cat.replace(/"/g,'&quot;')}" data-inlist="${m.inList}"
      onmousedown="pickCompraSuggestion('${m.name.replace(/'/g,"\\'").replace(/"/g,'&quot;')}','${m.cat.replace(/'/g,"\\'").replace(/"/g,'&quot;')}',${m.inList})">
      <span class="ing-sug-item-name">${m.name}</span>
      ${badge}
    </div>`;
  }).join('');
  box.style.display = 'block';
};

window.hideCompraSuggestions = function() {
  setTimeout(() => {
    const box = document.getElementById('compra-suggestions');
    if (box) box.style.display = 'none';
  }, 150);
};

window.filterQuickSuggestions = window.hideQuickSuggestions = window.pickQuickSuggestion = function() {};

window.pickCompraSuggestion = function(name, cat, inList) {
  const input = document.getElementById('item-name-input');
  const sel   = document.getElementById('item-cat-input');
  input.value = name;
  if (sel) {
    const opt = [...sel.options].find(o => o.value.trim() === cat.trim());
    if (opt) sel.value = opt.value;
  }
  document.getElementById('compra-suggestions').style.display = 'none';
  compraSugIndex = -1;
  // Reset units to 1 when a new product is picked
  const hidden = document.getElementById('item-units-input');
  const display = document.getElementById('item-units-display');
  if (hidden) hidden.value = '1';
  if (display) display.textContent = '1';
  input.focus();
};

window.onCompraKeydown = function(e) {
  if (e.key === 'Enter') { saveItem(); return; }
  const box = document.getElementById('compra-suggestions');
  if (!box || box.style.display === 'none') return;
  const items = box.querySelectorAll('.ing-sug-item');
  if (!items.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    compraSugIndex = Math.min(compraSugIndex + 1, items.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    compraSugIndex = Math.max(compraSugIndex - 1, 0);
  } else if (e.key === 'Escape' || e.key === 'Tab') {
    box.style.display = 'none'; return;
  } else { return; }
  items.forEach((el, i) => el.classList.toggle('active', i === compraSugIndex));
  if (compraSugIndex >= 0) {
    const el = items[compraSugIndex];
    pickCompraSuggestion(el.dataset.name, el.dataset.cat, el.dataset.inlist === 'true');
    setTimeout(() => filterCompraSuggestions(el.dataset.name), 0);
  }
};

window.inlineChangeUnits = function(delta) {
  const hidden = document.getElementById('item-units-input');
  const display = document.getElementById('item-units-display');
  const current = parseInt(hidden.value) || 1;
  const next = Math.max(1, current + delta);
  hidden.value = next;
  display.textContent = next;
};

window.openAddItem = function() {
  document.getElementById('item-name-input').focus();
};

window.saveItem = async function() {
  const name  = document.getElementById('item-name-input').value.trim();
  if (!name) { showToast('Escribe un producto'); return; }
  const units = parseInt(document.getElementById('item-units-input').value) || 1;
  const cat   = document.getElementById('item-cat-input').value;

  // Si ya está en la lista sin marcar, incrementar unidades
  const existing = compraItems.find(
    i => !i.checked && i.name.trim().toLowerCase() === name.toLowerCase()
  );
  if (existing) {
    const newUnits = (existing.units || 1) + units;
    if (CONFIGURED && db) {
      await db.collection('compra').doc(existing.id).update({ units: newUnits });
    } else {
      existing.units = newUnits;
      renderCompra();
    }
    document.getElementById('item-name-input').value = '';
    document.getElementById('item-units-input').value = '1';
    const d1 = document.getElementById('item-units-display'); if (d1) d1.textContent = '1';
    const s1 = document.getElementById('compra-suggestions'); if (s1) s1.style.display = 'none';
    document.getElementById('item-name-input').focus();
    showToast(`"${name}" → ${newUnits} unidades`);
    return;
  }

  const item = {
    name,
    units,
    cat,
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
  // Persistir en catálogo de productos
  if (window.upsertProducto) window.upsertProducto(name, cat);
  document.getElementById('item-name-input').value = '';
  document.getElementById('item-units-input').value = '1';
  const d2 = document.getElementById('item-units-display'); if (d2) d2.textContent = '1';
  const s2 = document.getElementById('compra-suggestions'); if (s2) s2.style.display = 'none';
  document.getElementById('item-name-input').focus();
  showToast(`"${name}" añadido`);
};

window.toggleItem = async function(id) {
  const item = compraItems.find(i => i.id === id);
  if (!item) return;
  if (navigator.vibrate) navigator.vibrate(30);
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

window.changeUnits = async function(id, delta) {
  const item = compraItems.find(i => i.id === id);
  if (!item) return;
  const newUnits = Math.max(1, (item.units || 1) + delta);
  if (CONFIGURED && db) {
    await db.collection('compra').doc(id).update({ units: newUnits });
  } else {
    item.units = newUnits;
    renderCompra();
  }
};

window.clearChecked = function() {
  const checked = compraItems.filter(i => i.checked);
  if (!checked.length) { showToast('No hay marcados'); return; }
  showConfirm({
    title: 'Limpiar marcados',
    message: `Se eliminarán ${checked.length} producto${checked.length>1?'s':''} de la lista. ¿Continuar?`,
    confirmText: 'Limpiar',
    onConfirm: async () => {
      if (CONFIGURED && db) {
        await Promise.all(checked.map(i => db.collection('compra').doc(i.id).delete()));
      } else {
        compraItems = compraItems.filter(i => !i.checked);
        renderCompra();
      }
      showToast(`${checked.length} producto${checked.length>1?'s':''} eliminado${checked.length>1?'s':''}`);
    }
  });
};
