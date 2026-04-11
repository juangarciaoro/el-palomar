// Vista de Productos de Temporada para la administración
// Código autocontenido
(function() {
  window.TemporadaWidget = (() => {
    const MESES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const CAT_LABEL = { frutas: 'Fruta', verduras: 'Verdura', pescados: 'Pescado' };
    let DATA = null;
    let mes  = new Date().getMonth() + 1;
    let tab  = 'todos';
    let filtro = 'todos';
    let root = null;
    function getEstado(p, m) {
      if (!p.meses.includes(m)) return null;
      if (p.optimo.includes(m)) return 'optimo';
      const prev = m === 1 ? 12 : m - 1;
      const next = m === 12 ? 1  : m + 1;
      if (!p.meses.includes(prev)) return 'inicio';
      if (!p.meses.includes(next)) return 'fin';
      return 'plena';
    }
    const BADGE_LABEL = { optimo: 'En su punto', inicio: 'Entrando', fin: 'Saliendo', plena: 'Temporada' };
    function mesesBar(p, cat) {
      return Array.from({ length: 12 }, (_, i) => {
        const m2  = i + 1;
        let cls = 'ts-m';
        if      (p.optimo.includes(m2)) cls += ` opt-${cat}`;
        else if (p.meses.includes(m2))  cls += ` on-${cat}`;
        if (m2 === mes) cls += ' now';
        return `<div class="${cls}" title="${MESES[m2]}"></div>`;
      }).join('');
    }
    function getProductos() {
      if (tab !== 'todos') return DATA[tab].map(p => ({ ...p, cat: tab }));
      return ['frutas', 'verduras', 'pescados']
        .flatMap(c => DATA[c].map(p => ({ ...p, cat: c })));
    }
    function render() {
      const todos = getProductos();
      const filtrados = todos.filter(p => {
        const e = getEstado(p, mes);
        if (filtro === 'todos')  return e !== null;
        if (filtro === 'optimo') return e === 'optimo';
        if (filtro === 'inicio') return e === 'inicio';
        if (filtro === 'plena')  return e === 'plena' || e === 'fin';
        if (filtro === 'fuera')  return e === null;
        return e !== null;
      });
      root.querySelector('.ts-count').textContent =
        `${filtrados.length} producto${filtrados.length !== 1 ? 's' : ''} ` +
        `${filtro === 'fuera' ? 'fuera de temporada' : 'de temporada'} en ${MESES[mes]}`;
      const grid = root.querySelector('.ts-grid');
      if (!filtrados.length) {
        grid.innerHTML = '<div class="ts-empty">Ningún producto coincide.</div>';
        return;
      }
      grid.innerHTML = filtrados.map(p => {
        const e       = getEstado(p, mes);
        const cat     = p.cat;
        const cardCls = e === 'optimo' ? `ts-card optimo-${cat}` : e ? `ts-card ${e}` : 'ts-card';
        const badgeCls = e === 'optimo' ? `ts-badge badge-optimo-${cat}` : `ts-badge badge-${e}`;
        return `
          <div class="${cardCls}">
            <div class="ts-card-top">
              <span class="ts-emoji">${p.emoji}</span>
              ${e ? `<span class="${badgeCls}">${BADGE_LABEL[e]}</span>` : ''}
            </div>
            <div class="ts-nombre">${p.nombre}</div>
            ${tab === 'todos' ? `<span class="ts-cat-pill pill-${cat}">${CAT_LABEL[cat]}</span>` : ''}
            <div class="ts-meses-bar">${mesesBar(p, cat)}</div>
          </div>`;
      }).join('');
    }
    function setTab(t) {
      tab = t;
      filtro = 'todos';
      root.querySelectorAll('.ts-tab').forEach(btn => {
        btn.className = 'ts-tab' + (btn.dataset.tab === t ? ` active-${t}` : '');
      });
      renderFilters();
      render();
    }
    function setFiltro(f) {
      filtro = f;
      renderFilters();
      render();
    }
    function renderFilters() {
      const items = [
        { id: 'todos',  label: 'Todos' },
        { id: 'optimo', label: 'En su punto' },
        { id: 'inicio', label: 'Entrando' },
        { id: 'plena',  label: 'Plena temporada' },
        { id: 'fuera',  label: 'Fuera de temporada' },
      ];
      root.querySelector('.ts-filter-row').innerHTML = items.map(f =>
        `<button class="ts-filter${filtro === f.id ? ' sel' : ''}" data-filtro="${f.id}">${f.label}</button>`
      ).join('');
      root.querySelectorAll('.ts-filter').forEach(btn => {
        btn.addEventListener('click', () => setFiltro(btn.dataset.filtro));
      });
    }
    function buildHTML() {
      root.innerHTML = `
        <div class="ts-header">
          <span class="ts-title">Productos de temporada</span>
          <div class="ts-mes-nav">
            <button class="ts-nav-btn" id="ts-btn-prev">&#8249;</button>
            <span class="ts-mes-lbl" id="ts-lbl-mes"></span>
            <button class="ts-nav-btn" id="ts-btn-next">&#8250;</button>
          </div>
        </div>
        <div class="ts-tabs">
          <button class="ts-tab" data-tab="todos">Todos</button>
          <button class="ts-tab" data-tab="frutas">Frutas</button>
          <button class="ts-tab" data-tab="verduras">Verduras</button>
          <button class="ts-tab" data-tab="pescados">Pescado y marisco</button>
        </div>
        <div class="ts-filter-row"></div>
        <div class="ts-count"></div>
        <div class="ts-grid"></div>`;
      root.querySelector('#ts-btn-prev').addEventListener('click', () => {
        mes = mes === 1 ? 12 : mes - 1;
        root.querySelector('#ts-lbl-mes').textContent = MESES[mes];
        render();
      });
      root.querySelector('#ts-btn-next').addEventListener('click', () => {
        mes = mes === 12 ? 1 : mes + 1;
        root.querySelector('#ts-lbl-mes').textContent = MESES[mes];
        render();
      });
      root.querySelectorAll('.ts-tab').forEach(btn => {
        btn.addEventListener('click', () => setTab(btn.dataset.tab));
      });
      root.querySelector('#ts-lbl-mes').textContent = MESES[mes];
    }
    async function init(selector, url = null, dataObj = null) {
      root = document.querySelector(selector);
      if (!root) { console.error(`TemporadaWidget: no se encontró el elemento "${selector}"`); return; }
      // Si no se pasa dataObj ni url, leer de Firestore
      if (!dataObj && !url && window.getProductosTemporada) {
        try {
          DATA = await window.getProductosTemporada();
        } catch (err) {
          console.error('Error al leer productos de temporada de Firestore', err);
          root.innerHTML = '<p style="color:#c00;padding:1rem">Error cargando datos de temporada.</p>';
          return;
        }
      } else if (dataObj) {
        DATA = dataObj;
      } else if (url) {
        try {
          const res = await fetch(url);
          DATA = await res.json();
        } catch (err) {
          console.error('TemporadaWidget: error al cargar el JSON de temporada', err);
          root.innerHTML = '<p style="color:#c00;padding:1rem">Error cargando datos de temporada.</p>';
          return;
        }
      } else {
        console.error('TemporadaWidget: debes proporcionar url o dataObj');
        return;
      }
      buildHTML();
      setTab('todos');
    }
    function getDeTemporada(categoria = 'todos', mesNum = null) {
      if (!DATA) return []; 
      const m = mesNum || new Date().getMonth() + 1;
      const cats = categoria === 'todos' ? ['frutas', 'verduras', 'pescados'] : [categoria];
      return cats.flatMap(c =>
        DATA[c].filter(p => p.meses.includes(m)).map(p => ({
          ...p,
          cat: c,
          estado: getEstado(p, m),
        }))
      );
    }
    function setMesActual() {
      mes = new Date().getMonth() + 1;
    }
    return { init, getDeTemporada, setMesActual };
  })();
  window.showProductosTemporadaView = function() {
    // Fuerza el mes actual cada vez que se abre la vista
    if (window.TemporadaWidget && window.TemporadaWidget.setMesActual) {
      window.TemporadaWidget.setMesActual();
    }
    const main = document.getElementById('main-content');
    let view = document.getElementById('view-productos-temporada');
    if (!view) {
      view = document.createElement('div');
      view.id = 'view-productos-temporada';
      view.className = 'view';
      view.innerHTML = `
        <div class="section-header">
          <div>
            <div class="section-title">Productos de temporada</div>
            <div class="section-sub">Consulta frutas, verduras y pescados según el mes</div>
          </div>
        </div>
        <div id="seccion-temporada"></div>
      `;
      main.appendChild(view);
    }
    // Llama a init sin url ni dataObj para que lea desde Firestore
    window.TemporadaWidget.init('#seccion-temporada');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    view.classList.add('active');
  };
})();
