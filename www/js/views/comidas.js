// ═══════════════════════════════════════════════════════
// COMIDAS
// ═══════════════════════════════════════════════════════

const DAYS_ES   = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
let mealRecipeSugIndex = -1;

function _normMeal(s) {
  if (!s) return '';
  return s.toString().trim().toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

function applyComidasAvatars() {
  document.querySelectorAll(
    '#comidas-grid .meal-slot[data-meal], #comidas-grid .cm-day-slot[data-meal]'
  ).forEach(function(el) {
    const mealName = el.dataset.meal;
    el.style.backgroundImage = '';
    el.classList.remove('has-photo');
    if (!mealName) return;
    const target = _normMeal(mealName);
    let matched = null;
    if (typeof recetasData !== 'undefined' && recetasData && recetasData.length) {
      matched = recetasData.find(r => _normMeal(r.name) === target);
      if (!matched) matched = recetasData.find(r => _normMeal(r.name).includes(target) || target.includes(_normMeal(r.name)));
      if (!matched) matched = recetasData.find(r => _normMeal(r.name).startsWith(target) || _normMeal(r.name).endsWith(target));
    }
    if (!matched) return;
    const photo = matched.photoData || matched.photoURL || null;
    if (!photo) return;
    el.style.backgroundImage = 'url(' + photo + ')';
    el.classList.add('has-photo');
  });
}

function getWeekDates(offset) {
  const now = new Date();
  const day = now.getDay(); // 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb
  // Días desde el martes anterior (incluyendo hoy si es martes)
  const diffToTuesday = (day + 5) % 7; // Mar=0, Mié=1, …, Lun=6
  const tuesday = new Date(now);
  tuesday.setDate(now.getDate() - diffToTuesday + offset * 7);
  return Array.from({length: 8}, (_, i) => {
    const d = new Date(tuesday);
    d.setDate(tuesday.getDate() + i);
    return d;
  });
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function isToday(d) {
  const t = new Date();
  return d.getDate()===t.getDate() && d.getMonth()===t.getMonth() && d.getFullYear()===t.getFullYear();
}

function renderComidas() {
  const dates = getWeekDates(weekOffset);
  const lbl   = document.getElementById('week-label');
  if (weekOffset === 0)       lbl.textContent = 'Esta semana';
  else if (weekOffset === 1)  lbl.textContent = 'Próxima semana';
  else if (weekOffset === -1) lbl.textContent = 'Semana pasada';
  else {
    const d = dates[0];
    lbl.textContent = d.getDate() + ' ' + MONTHS_ES[d.getMonth()];
  }

  // ── MOBILE: día-cards apilados (estructura original) ─────────
  const mobileHtml = dates.map(function(d, idx) {
    const key        = dateKey(d);
    const data       = comidasData[key] || {};
    const showComida = idx > 0;
    const showCena   = idx < dates.length - 1;
    const dayName    = DAYS_ES[d.getDay()===0?6:d.getDay()-1];
    return '<div class="day-card ' + (isToday(d) ? 'today' : '') + '">' +
      '<div class="day-header">' +
        '<span class="day-name">' + dayName + '</span>' +
        '<span class="day-date">' + d.getDate() + ' ' + MONTHS_ES[d.getMonth()] + '</span>' +
        (isToday(d) ? '<span class="today-badge">Hoy</span>' : '') +
      '</div>' +
      '<div class="meals-row">' +
        (showComida
          ? '<div class="meal-slot" data-meal="' + (data.comida ? data.comida.replace(/"/g, '&quot;') : '') + '" onclick="openMealEdit(\'' + key + '\',\'comida\')">' 
              + '<div class="meal-slot-content">'
              + '<div class="meal-type">Almuerzo</div>'
              + (data.comida
                ? '<div class="meal-text">' + data.comida + '</div>' + (data.comidaNotes ? '<div class="meal-slot-notes">' + data.comidaNotes + '</div>' : '')
                : '<div class="meal-empty">Sin planear</div>')
              + '<span class="meal-add-icon"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="icons.svg#i-edit"></use></svg></span>'
              + '</div>'
              + '</div>'
          : '<div class="meal-slot meal-slot-blank"></div>') +
        (showCena
          ? '<div class="meal-slot" data-meal="' + (data.cena ? data.cena.replace(/"/g, '&quot;') : '') + '" onclick="openMealEdit(\'' + key + '\',\'cena\')">' 
              + '<div class="meal-slot-content">'
              + '<div class="meal-type">Cena</div>'
              + (data.cena
                ? '<div class="meal-text">' + data.cena + '</div>' + (data.cenaNotes ? '<div class="meal-slot-notes">' + data.cenaNotes + '</div>' : '')
                : '<div class="meal-empty">Sin planear</div>')
              + '<span class="meal-add-icon"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="icons.svg#i-edit"></use></svg></span>'
              + '</div>'
              + '</div>'
          : '<div class="meal-slot meal-slot-blank"></div>') +
      '</div></div>';
  }).join('');

  // ── DESKTOP: tarjetas verticales por día ───────
  const desktopHtml = '<div class="cm-week-list">' + dates.map(function(d, idx) {
    const key        = dateKey(d);
    const data       = comidasData[key] || {};
    const showComida = idx > 0;
    const showCena   = idx < dates.length - 1;
    const dayName    = DAYS_ES[d.getDay()===0?6:d.getDay()-1];
    const todayCls   = isToday(d) ? ' today' : '';

    const comidaSlot = showComida
      ? '<div class="cm-day-slot' + todayCls + '" data-meal="' + (data.comida ? data.comida.replace(/"/g, '&quot;') : '') + '" onclick="openMealEdit(\'' + key + '\',\'comida\')">' 
          + '<div class="cm-slot-content">'
          + '<span class="cm-day-slot-type"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="icons.svg#i-sun"></use></svg> Almuerzo</span>'
          + (data.comida
              ? '<div class="cm-meal-text">' + data.comida + '</div>' + (data.comidaNotes ? '<div class="cm-meal-notes">' + data.comidaNotes + '</div>' : '')
              : '<div class="cm-meal-empty">Sin planear</div>')
          + '<span class="meal-add-icon"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="icons.svg#i-edit"></use></svg></span>'
          + '</div>'
          + '</div>'
      : '<div class="cm-day-slot cm-day-slot-blank"></div>';

    const cenaSlot = showCena
      ? '<div class="cm-day-slot' + todayCls + '" data-meal="' + (data.cena ? data.cena.replace(/"/g, '&quot;') : '') + '" onclick="openMealEdit(\'' + key + '\',\'cena\')">' 
          + '<div class="cm-slot-content">'
          + '<span class="cm-day-slot-type"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="icons.svg#i-moon"></use></svg> Cena</span>'
          + (data.cena
              ? '<div class="cm-meal-text">' + data.cena + '</div>' + (data.cenaNotes ? '<div class="cm-meal-notes">' + data.cenaNotes + '</div>' : '')
              : '<div class="cm-meal-empty">Sin planear</div>')
          + '<span class="meal-add-icon"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="icons.svg#i-edit"></use></svg></span>'
          + '</div>'
      : '<div class="cm-day-slot cm-day-slot-blank"></div>';

    return '<div class="cm-day-card' + todayCls + '">'
      + '<div class="cm-day-card-header">'
          + '<span class="cm-day-name">' + dayName + '</span>'
          + '<span class="cm-day-date">' + d.getDate() + ' ' + MONTHS_ES[d.getMonth()] + '</span>'
          + (isToday(d) ? '<span class="today-badge">Hoy</span>' : '')
      + '</div>'
      + '<div class="cm-day-meals">' + comidaSlot + cenaSlot + '</div>'
      + '</div>';
  }).join('') + '</div>';

  document.getElementById('comidas-grid').innerHTML =
    '<div class="comidas-mobile">' + mobileHtml + '</div>' + desktopHtml;
  applyComidasAvatars();
}

window.changeWeek = function(dir) { weekOffset += dir; renderComidas(); };

window.openMealEdit = function(date, slot) {
  currentMealEdit = { date, slot };
  const data = comidasData[date] || {};
  document.getElementById('modal-comida-title').innerHTML =
    slot === 'comida'
      ? '<svg class="icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style="vertical-align:middle;margin-right:0.35rem"><use href="icons.svg#i-sun"></use></svg> Editar comida'
      : '<svg class="icon" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style="vertical-align:middle;margin-right:0.35rem"><use href="icons.svg#i-moon"></use></svg> Editar cena';
  const mealName = data[slot] || '';
  document.getElementById('comida-input').value = mealName;
  document.getElementById('comida-notes').value = data[slot + 'Notes'] || '';
  mealRecipeSugIndex = -1;
  updateMealRecipeIngredients(mealName);

  openModal('modal-comida');
  if (window.innerWidth >= 768) setTimeout(() => document.getElementById('comida-input').focus(), 300);
};

window.saveMeal = async function() {
  if (!currentMealEdit) return;
  const { date, slot } = currentMealEdit;
  const val   = document.getElementById('comida-input').value.trim();
  const notes = document.getElementById('comida-notes').value.trim();
  if (CONFIGURED && db) {
    await hogarCol('comidas').doc(date).set({
      [slot]: val,
      [slot+'Notes']: notes,
      updatedBy: currentUser,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } else {
    if (!comidasData[date]) comidasData[date] = {};
    comidasData[date][slot] = val;
    comidasData[date][slot+'Notes'] = notes;
    renderComidas();
  }
  closeModal('modal-comida');
  showToast('Menú guardado');
};

function updateMealRecipeIngredients(mealName) {
  const matchedReceta = (typeof recetasData !== 'undefined' && mealName)
    ? recetasData.find(r => r.name.toLowerCase() === mealName.trim().toLowerCase())
    : null;
  const block = document.getElementById('comida-receta-ings');
  const list  = document.getElementById('comida-ings-list');
  if (!block || !list) return;

  if (matchedReceta && (matchedReceta.ingredients || []).length) {
    list.innerHTML = buildIngRows(matchedReceta.ingredients);
    block.style.display = 'block';
  } else {
    block.style.display = 'none';
    list.innerHTML = '';
  }
}

window.filterMealRecipeSuggestions = function(val) {
  const box = document.getElementById('comida-recipe-suggestions');
  if (!box) return;

  const raw = (val || '').trim();
  const q = raw.toLowerCase();
  const all = (typeof recetasData !== 'undefined') ? recetasData : [];
  mealRecipeSugIndex = -1;
  updateMealRecipeIngredients(raw);

  if (!q) {
    box.style.display = 'none';
    return;
  }

  const matches = all.filter(r => r.name.toLowerCase().includes(q)).slice(0, 8);
  if (!matches.length) {
    box.style.display = 'none';
    return;
  }

  box.innerHTML = matches.map((r, idx) =>
    `<div class="ing-sug-item" data-idx="${idx}" data-id="${r.id}" data-name="${r.name.replace(/"/g, '&quot;')}"
      onmousedown="pickMealRecipeSuggestion('${r.id}')">
      <span class="ing-sug-item-name">${r.name}</span>
      <span class="ing-sug-item-cat">${(r.ingredients || []).length} ingrediente${(r.ingredients || []).length !== 1 ? 's' : ''}</span>
    </div>`
  ).join('');
  box.style.display = 'block';
};

window.hideMealRecipeSuggestions = function() {
  setTimeout(() => {
    const box = document.getElementById('comida-recipe-suggestions');
    if (box) box.style.display = 'none';
  }, 150);
};

window.pickMealRecipeSuggestion = function(id) {
  const receta = (typeof recetasData !== 'undefined') ? recetasData.find(r => r.id === id) : null;
  if (!receta) return;
  const input = document.getElementById('comida-input');
  const box = document.getElementById('comida-recipe-suggestions');
  if (input) input.value = receta.name;
  if (box) box.style.display = 'none';
  mealRecipeSugIndex = -1;
  updateMealRecipeIngredients(receta.name);
};

window.onMealInputKeydown = function(e) {
  const box = document.getElementById('comida-recipe-suggestions');
  const items = box ? box.querySelectorAll('.ing-sug-item') : [];

  if (box && box.style.display !== 'none' && items.length) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      mealRecipeSugIndex = Math.min(mealRecipeSugIndex + 1, items.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      mealRecipeSugIndex = Math.max(mealRecipeSugIndex - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const active = items[Math.max(mealRecipeSugIndex, 0)];
      if (active) {
        pickMealRecipeSuggestion(active.dataset.id);
        return;
      }
    } else if (e.key === 'Tab' || e.key === 'Escape') {
      box.style.display = 'none';
      return;
    } else {
      mealRecipeSugIndex = -1;
      return;
    }

    items.forEach((el, i) => el.classList.toggle('active', i === mealRecipeSugIndex));
    return;
  }

  if (e.key === 'Enter') saveMeal();
};

// ─── Recipe picker ────────────────────────────────────────
window.openRecetaPicker = function () {
  document.getElementById('receta-picker-search').value = '';
  renderRecetaPickerList('');
  openModal('modal-receta-picker');
  setTimeout(() => document.getElementById('receta-picker-search').focus(), 300);
};

window.filterRecetaPicker = function (q) {
  renderRecetaPickerList(q.trim().toLowerCase());
};

function renderRecetaPickerList(q) {
  const list = document.getElementById('receta-picker-list');
  if (!list) return;
  const all = (typeof recetasData !== 'undefined') ? recetasData : [];
  const filtered = q ? all.filter(r => r.name.toLowerCase().includes(q)) : all;

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state" style="padding:1rem">
      <div class="empty-desc">${all.length ? 'Sin resultados' : 'Todavía no hay recetas guardadas'}</div>
    </div>`;
    return;
  }

  list.innerHTML = filtered.map(r => {
    const photo  = r.photoData || r.photoURL || null;
    const numIng = (r.ingredients || []).length;
    const thumbStyle = photo ? 'background-image:url(\'' + photo + '\')' : '';
    return '<div class="receta-picker-row" onclick="pickReceta(\'' + r.id + '\')">'
      + '<div class="receta-picker-thumb" style="' + thumbStyle + '">'
      + (photo ? '' : '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="icons.svg#i-utensils"></use></svg>')
      + '</div>'
      + '<div class="receta-picker-info">'
      + '<div class="receta-picker-name">' + r.name + '</div>'
      + '<div class="receta-picker-meta">' + numIng + ' ingrediente' + (numIng !== 1 ? 's' : '') + '</div>'
      + '</div></div>';
  }).join('');
}

window.pickReceta = function (id) {
  const r = (typeof recetasData !== 'undefined') ? recetasData.find(x => x.id === id) : null;
  if (!r) return;
  document.getElementById('comida-input').value = r.name;
  closeModal('modal-receta-picker');
  updateMealRecipeIngredients(r.name);
};

// Build ingredient rows HTML — shared by pickReceta and openMealEdit
function buildIngRows(ings) {
  return ings.map((ing, i) => {
    const name = typeof ing === 'object' ? ing.name : ing;
    const cat  = typeof ing === 'object' ? ing.cat  : '🧾 Varios';
    const safeId = 'ing-btn-' + i;
    const safeName = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return '<div class="comida-ing-row" data-name="' + name + '" data-cat="' + cat + '">'
      + '<span class="ingredient-dot">•</span>'
      + '<span class="comida-ing-name">' + name + '</span>'
      + '<span style="font-size:0.72rem;color:var(--text-muted);margin-right:0.4rem">' + cat + '</span>'
      + '<button class="comida-ing-add-btn" id="' + safeId + '" onclick="addIngredientToCompra(\'' + safeName + '\',\'' + cat + '\',' + i + ')"><svg class="icon" width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><use href="icons.svg#i-shopping-cart"></use></svg> Añadir</button>'
      + '</div>';
  }).join('');
}

window.addIngredientToCompra = async function (name, cat, idx) {
  // Si el producto ya está en la lista (sin marcar), incrementar unidades
  const existing = compraItems.find(
    i => !i.checked && i.name.trim().toLowerCase() === name.trim().toLowerCase()
  );
  if (existing) {
    const newUnits = (existing.units || 1) + 1;
    if (CONFIGURED && db) {
      await hogarCol('compra').doc(existing.id).update({ units: newUnits });
    } else {
      existing.units = newUnits;
      renderCompra && renderCompra();
    }
    const btn = document.getElementById('ing-btn-' + idx);
    if (btn) { btn.textContent = '✓ Añadido'; btn.disabled = true; btn.style.opacity = '0.5'; }
    showToast('"' + name + '" (+1 unidad)');
    return;
  }
  const item = {
    name,
    qty: '',
    units: 1,
    cat: cat || '🧾 Varios',
    checked: false,
    addedBy: currentUser || '',
    createdAt: CONFIGURED ? firebase.firestore.FieldValue.serverTimestamp() : Date.now()
  };
  if (CONFIGURED && db) {
    const id = 'item_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    await hogarCol('compra').doc(id).set(item);
  } else {
    item.id = 'l' + Date.now();
    compraItems.push(item);
    renderCompra && renderCompra();
  }
  // Persistir en catálogo de productos
  if (window.upsertProducto) window.upsertProducto(name, cat || '🧾 Varios');
  // Mark button as added
  const btn = document.getElementById('ing-btn-' + idx);
  if (btn) { btn.textContent = '✓ Añadido'; btn.disabled = true; btn.style.opacity = '0.5'; }
  showToast('"' + name + '" añadido a la compra');
};

window.addAllIngredientsToCompra = async function () {
  const rows = document.querySelectorAll('#comida-ings-list .comida-ing-row');
  let count = 0;
  for (let i = 0; i < rows.length; i++) {
    const btn = document.getElementById('ing-btn-' + i);
    if (btn && !btn.disabled) {
      const name = rows[i].dataset.name;
      const cat  = rows[i].dataset.cat;
      await addIngredientToCompra(name, cat, i);
      count++;
    }
  }
  if (count === 0) showToast('Ya están todos añadidos');
};
