// ═══════════════════════════════════════════════════════
// COMIDAS
// ═══════════════════════════════════════════════════════

const DAYS_ES   = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function getWeekDates(offset) {
  const now    = new Date();
  const day    = now.getDay();
  const diff   = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff + offset * 7);
  return Array.from({length: 7}, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
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
    lbl.textContent = `${d.getDate()} ${MONTHS_ES[d.getMonth()]}`;
  }

  document.getElementById('comidas-grid').innerHTML = dates.map(d => {
    const key   = dateKey(d);
    const data  = comidasData[key] || {};
    return `
    <div class="day-card ${isToday(d) ? 'today' : ''}">
      <div class="day-header">
        <span class="day-name">${DAYS_ES[d.getDay()===0?6:d.getDay()-1]}</span>
        <span class="day-date">${d.getDate()} ${MONTHS_ES[d.getMonth()]}</span>
        ${isToday(d) ? '<span class="today-badge">Hoy</span>' : ''}
      </div>
      <div class="meals-row">
        <div class="meal-slot" onclick="openMealEdit('${key}','comida')">
          <div class="meal-type">🌞 Comida</div>
          ${data.comida
            ? `<div class="meal-text">${data.comida}</div>${data.comidaNotes?`<div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">${data.comidaNotes}</div>`:''}`
            : `<div class="meal-empty">Sin planear</div>`}
          <span class="meal-add-icon">✏️</span>
        </div>
        <div class="meal-slot" onclick="openMealEdit('${key}','cena')">
          <div class="meal-type">🌙 Cena</div>
          ${data.cena
            ? `<div class="meal-text">${data.cena}</div>${data.cenaNotes?`<div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">${data.cenaNotes}</div>`:''}`
            : `<div class="meal-empty">Sin planear</div>`}
          <span class="meal-add-icon">✏️</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

window.changeWeek = function(dir) { weekOffset += dir; renderComidas(); };

window.openMealEdit = function(date, slot) {
  currentMealEdit = { date, slot };
  const data = comidasData[date] || {};
  document.getElementById('modal-comida-title').textContent =
    slot === 'comida' ? '🌞 Editar comida' : '🌙 Editar cena';
  const mealName = data[slot] || '';
  document.getElementById('comida-input').value = mealName;
  document.getElementById('comida-notes').value = data[slot + 'Notes'] || '';

  // If the saved meal name matches a recipe, show its ingredients
  const matchedReceta = (typeof recetasData !== 'undefined' && mealName)
    ? recetasData.find(r => r.name.toLowerCase() === mealName.toLowerCase())
    : null;

  if (matchedReceta && (matchedReceta.ingredients || []).length) {
    const ings  = matchedReceta.ingredients;
    const list  = document.getElementById('comida-ings-list');
    const block = document.getElementById('comida-receta-ings');
    list.innerHTML = buildIngRows(ings);
    block.style.display = 'block';
  } else {
    document.getElementById('comida-receta-ings').style.display = 'none';
    document.getElementById('comida-ings-list').innerHTML = '';
  }

  openModal('modal-comida');
  setTimeout(() => document.getElementById('comida-input').focus(), 300);
};

window.saveMeal = async function() {
  if (!currentMealEdit) return;
  const { date, slot } = currentMealEdit;
  const val   = document.getElementById('comida-input').value.trim();
  const notes = document.getElementById('comida-notes').value.trim();
  if (CONFIGURED && db) {
    await db.collection('comidas').doc(date).set({
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
      + (photo ? '' : '🍽️')
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

  // Show ingredients block
  const ings = r.ingredients || [];
  const block = document.getElementById('comida-receta-ings');
  const list  = document.getElementById('comida-ings-list');
  if (!ings.length) { block.style.display = 'none'; return; }
  list.innerHTML = buildIngRows(ings);
  block.style.display = 'block';
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
      + '<button class="comida-ing-add-btn" id="' + safeId + '" onclick="addIngredientToCompra(\'' + safeName + '\',\'' + cat + '\',' + i + ')">🛒 Añadir</button>'
      + '</div>';
  }).join('');
}

window.addIngredientToCompra = async function (name, cat, idx) {
  const item = {
    name,
    qty: '',
    cat: cat || '🧾 Varios',
    checked: false,
    addedBy: currentUser || '',
    createdAt: CONFIGURED ? firebase.firestore.FieldValue.serverTimestamp() : Date.now()
  };
  if (CONFIGURED && db) {
    const id = 'item_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    await db.collection('compra').doc(id).set(item);
  } else {
    item.id = 'l' + Date.now();
    compraItems.push(item);
    renderCompra();
  }
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
