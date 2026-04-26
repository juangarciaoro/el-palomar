// ─── PALETAS DE COLOR ─────────────────────────────────────
const COLOR_PALETTES = [
  { name: 'Bosque',     accent: '#2d6a4f', light: '#52b788', pale: '#d8f3dc', dark: '#245e44' },
  { name: 'Océano',    accent: '#1055a5', light: '#4a9ede', pale: '#dbeeff', dark: '#0b3d7a' },
  { name: 'Ciruela',   accent: '#7b2d8b', light: '#b969c8', pale: '#f5e8f8', dark: '#5a1f67' },
  { name: 'Terracota', accent: '#c24c1a', light: '#e27652', pale: '#fde8df', dark: '#8b3009' },
  { name: 'Índigo',    accent: '#3730a3', light: '#6366f1', pale: '#e0e7ff', dark: '#1e1b6e' },
  { name: 'Ámbar',     accent: '#c07008', light: '#f5a623', pale: '#fff3d0', dark: '#7a4800' },
  { name: 'Rosa',      accent: '#be185d', light: '#ec4899', pale: '#fce7f3', dark: '#831843' },
  { name: 'Grafito',   accent: '#374151', light: '#6b7280', pale: '#e5e7eb', dark: '#1f2937' },
];

function applyPalette(index) {
  const p = COLOR_PALETTES[index] || COLOR_PALETTES[0];
  const r = document.documentElement;
  // Set brand semantic tokens so CSS design-tokens can drive the UI
  r.style.setProperty('--brand-accent',       p.accent);
  r.style.setProperty('--brand-accent-light', p.light);
  r.style.setProperty('--brand-accent-pale',  p.pale);
  r.style.setProperty('--brand-accent-dark',  p.dark);
  // Keep legacy vars for compatibility with older code
  r.style.setProperty('--accent',       p.accent);
  r.style.setProperty('--accent-light', p.light);
  r.style.setProperty('--accent-pale',  p.pale);
  r.style.setProperty('--accent-dark',  p.dark);
}

window.openColorPicker = function() {
  if (!currentUser) return;
  const idx = (typeof userProfile !== 'undefined' && userProfile && userProfile.paletteIndex != null)
    ? userProfile.paletteIndex : 0;
  renderColorSwatches('color-swatches-grid', idx, 'selectPalette');
  openModal('modal-color-picker');
};

function renderColorSwatches(gridId, selectedIndex, callbackFn) {
  document.getElementById(gridId).innerHTML = COLOR_PALETTES.map((p, i) =>
    `<div class="color-swatch ${i === selectedIndex ? 'selected' : ''}" style="--s:${p.accent}" onclick="${callbackFn}(${i})">
      <div class="color-swatch-circle" style="background:${p.accent}">
        <span class="color-swatch-check">✓</span>
      </div>
      <div class="color-swatch-label">${p.name}</div>
    </div>`
  ).join('');
}

window.selectPalette = async function(index) {
  applyPalette(index);
  if (typeof userProfile !== 'undefined' && userProfile) userProfile.paletteIndex = index;
  if (typeof db !== 'undefined' && db && typeof firebaseUser !== 'undefined' && firebaseUser) {
    try {
      await db.collection('users').doc(firebaseUser.uid).update({ paletteIndex: index });
    } catch(e) { /* silent */ }
  }
  renderColorSwatches('color-swatches-grid', index, 'selectPalette');
  if (typeof updateDrawerThemeRow === 'function') updateDrawerThemeRow(index);
  closeModal('modal-color-picker');
  showToast('Color de acento actualizado ✓');
};
