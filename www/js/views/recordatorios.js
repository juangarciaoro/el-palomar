// ═══════════════════════════════════════════════════════
// RECORDATORIOS
// ═══════════════════════════════════════════════════════

function renderRecordatorios() {
  const list = document.getElementById('recordatorios-list');
  const DAYS_SHORT    = ['L','M','X','J','V','S','D'];
  const DAYS_PATTERNS = {
    daily:    [1,1,1,1,1,1,1],
    weekdays: [1,1,1,1,1,0,0],
    weekends: [0,0,0,0,0,1,1],






































































































































































































































    weekly:   [1,0,0,0,0,0,0]
  };

  if (!recordatorios.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="icons.svg#i-bell"></use></svg></div>
      <div class="empty-title">Sin recordatorios</div>
      <div class="empty-desc">Crea avisos para toda la familia</div>
    </div>`;
    return;
  }

  list.innerHTML = recordatorios.map(r => {
    const [h,m] = (r.time||'09:00').split(':');
    const hour  = parseInt(h);
    const ampm  = hour >= 12 ? 'PM' : 'AM';
    const disp  = `${hour > 12 ? hour-12 : hour}:${m}`;
    const pat   = DAYS_PATTERNS[r.days] || DAYS_PATTERNS.daily;
    return `
    <div class="reminder-item">
      <div class="reminder-time-box">
        <div class="reminder-time">${disp}</div>
        <div class="reminder-ampm">${ampm}</div>
      </div>
      <div class="reminder-body">
        <div class="reminder-title">${r.title}</div>
        ${r.desc ? `<div class="reminder-desc">${r.desc}</div>` : ''}
        <div class="reminder-days" style="margin-top:0.3rem">
          ${DAYS_SHORT.map((d,i) => `<div class="day-dot ${pat[i]?'on':''}">${d}</div>`).join('')}
        </div>
      </div>
      <button class="item-delete" onclick="deleteRecordatorio('${r.id}')">✕</button>
    </div>`;
  }).join('');
}

window.openAddRecordatorio = function() {
  openModal('modal-recordatorio');
  setTimeout(() => document.getElementById('rec-title-input').focus(), 300);
};

window.saveRecordatorio = async function() {
  const title = document.getElementById('rec-title-input').value.trim();
  if (!title) { showToast('Escribe un título'); return; }
  const rec = {
    title,
    time:  document.getElementById('rec-time-input').value,
    days:  document.getElementById('rec-days-input').value,
    desc:  document.getElementById('rec-desc-input').value.trim(),
    addedBy: currentUser,
    createdAt: CONFIGURED ? firebase.firestore.FieldValue.serverTimestamp() : Date.now()
  };
  if (CONFIGURED && db) {
    const id = `r_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    await hogarCol('recordatorios').doc(id).set(rec);
  } else {
    rec.id = 'lr' + Date.now();
    recordatorios.push(rec);
    renderRecordatorios();
  }
  document.getElementById('rec-title-input').value = '';
  document.getElementById('rec-desc-input').value = '';
  closeModal('modal-recordatorio');
  showToast('Recordatorio guardado');
  scheduleNotification(rec.title, rec.time);
};

window.deleteRecordatorio = async function(id) {
  if (CONFIGURED && db) {
    await hogarCol('recordatorios').doc(id).delete();
  } else {
    recordatorios = recordatorios.filter(r => r.id !== id);
    renderRecordatorios();
  }
};
