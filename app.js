/* Taller Les Borges del Camp — app autónoma. Todos los datos viven en el móvil (IndexedDB). */
(() => {
'use strict';
/* ---------- utilidades ---------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r2 = n => Math.round(((+n) || 0) * 100 + Number.EPSILON * 100) / 100;
const EUR = new Intl.NumberFormat('es-ES', {style:'currency', currency:'EUR'});
const eur = n => EUR.format(r2(n));
const numES = n => r2(n).toFixed(2).replace('.', ',');
const pad = (n, l = 2) => String(n).padStart(l, '0');
const isoOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const todayISO = () => isoOf(new Date());
const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return isoOf(d); };
const fdate = s => s ? s.slice(0, 10).split('-').reverse().join('/') : '';
const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const longDate = iso => { const d = parseISO(iso); return DOW[d.getDay()] + ' ' + d.getDate() + ' de ' + MES[d.getMonth()]; };
const newId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const normPlate = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const showPlate = s => { const p = normPlate(s); return /^\d{4}[A-Z]{3}$/.test(p) ? p.slice(0, 4) + ' ' + p.slice(4) : p; };
const plate = (s, lg) => `<span class="plate${lg ? ' lg' : ''}"><span class="plate-eu">E</span><span class="plate-num">${esc(showPlate(s) || '— — —')}</span></span>`;
const clone = o => JSON.parse(JSON.stringify(o));
const digits = s => String(s || '').replace(/\D/g, '');
const qOf = iso => Math.floor((+iso.slice(5, 7) - 1) / 3) + 1;
const parseNum = s => { let t = String(s ?? '').replace(/[\s€]/g, ''); if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.'); const n = parseFloat(t); return isNaN(n) ? 0 : n; };
const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const hm = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
const toMin = s => { const [h, m] = String(s || '0:0').split(':').map(Number); return h * 60 + (m || 0); };

const CATS = ['Recambios','Aceites y líquidos','Herramientas','Alquiler del local','Suministros (luz, agua, teléfono)','Seguros','Gestoría','Cuota autónomos','Combustible','Publicidad','Mantenimiento del local','Otros'];
const ESTADOS = {borrador:'Presupuesto', enviado:'Esperando respuesta', aceptado:'En el taller', facturado:'Por cobrar', cobrado:'Cobrado', rechazado:'Rechazado'};
const CITA_EST = {pendiente:'Sin confirmar', confirmada:'Confirmada', llego:'Ha llegado', novino:'No vino'};
const TIPOS = {mo:'Mano de obra', pieza:'Pieza', otro:'Otro'};
const METODOS = {tarjeta:'Tarjeta (enlace)', datafono:'Datáfono o tarjeta', efectivo:'Efectivo', bizum:'Bizum', transferencia:'Transferencia'};
const COMB = ['', 'Gasolina', 'Diésel', 'Híbrido', 'Híbrido enchufable', 'Eléctrico', 'GLP', 'GNC'];

const DEFAULT_CFG = {
  t:'cfg', taller:'Taller Les Borges del Camp', propietario:'', apellidos:'', registrado:false, nif:'', direccion:'',
  poblacion:'Les Borges del Camp (Tarragona)', telefono:'', email:'', iban:'',
  tarifa:45, iva:21, irpf:20, linkPago:'', bizum:'', validez:15, serieF:'F', serieP:'P', serieT:'T',
  dias:[1,2,3,4,5], m1:'08:30', m2:'13:30', t1:'15:30', t2:'19:00', sab:false, sab1:'09:00', sab2:'13:00', hueco:60,
  alquiler:false, trabajadores:false, presentados:{}, regcheck:'',
  conceptos:[
    {tipo:'mo', desc:'Diagnosis con máquina', cant:0.5, precio:45},
    {tipo:'mo', desc:'Cambio de aceite y filtro', cant:0.5, precio:45},
    {tipo:'pieza', desc:'Aceite motor 5W30 (litro)', cant:5, precio:9.5},
    {tipo:'pieza', desc:'Filtro de aceite', cant:1, precio:12},
    {tipo:'otro', desc:'Gestión de residuos', cant:1, precio:3}
  ]
};

/* ---------- almacenamiento local (IndexedDB) ---------- */
let docs = {};
const Store = {
  db:null, mode:'idb',
  open() {
    return new Promise((res, rej) => {
      if (!('indexedDB' in window)) return rej(new Error('sin indexedDB'));
      const r = indexedDB.open('taller-les-borges', 1);
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('docs'); d.createObjectStore('files'); };
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  tx(store, mode, fn) {
    return new Promise((res, rej) => {
      const t = this.db.transaction(store, mode); const os = t.objectStore(store);
      const out = fn(os); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  },
  async init() {
    try {
      await this.open();
      const [keys, vals] = await Promise.all([this.tx('docs', 'readonly', os => os.getAllKeys()), this.tx('docs', 'readonly', os => os.getAll())]);
      docs = {}; keys.forEach((k, i) => docs[k] = vals[i]);
    } catch (e) {
      this.mode = 'ls';
      try { docs = JSON.parse(localStorage.getItem('taller-lb') || '{}'); } catch (e2) { docs = {}; }
    }
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  },
  saveLS() { try { localStorage.setItem('taller-lb', JSON.stringify(docs)); } catch (e) { toast('No hay espacio para guardar. Haz una copia y borra fotos antiguas.'); } },
  async put(id, data) {
    docs = {...docs, [id]: data}; rebuild();
    try { if (this.mode === 'idb') await this.tx('docs', 'readwrite', os => os.put(data, id)); else this.saveLS(); }
    catch (e) { toast('No se pudo guardar en el móvil. Revisa el espacio libre.'); throw e; }
  },
  async putMany(map) {
    docs = {...docs, ...map}; rebuild();
    if (this.mode === 'idb') await this.tx('docs', 'readwrite', os => { Object.entries(map).forEach(([k, v]) => os.put(v, k)); }); else this.saveLS();
  },
  async del(id) {
    const n = {...docs}; delete n[id]; docs = n; rebuild();
    if (this.mode === 'idb') await this.tx('docs', 'readwrite', os => os.delete(id)); else this.saveLS();
  },
  async putFile(id, blob) { if (this.mode !== 'idb') return false; await this.tx('files', 'readwrite', os => os.put(blob, id)); return true; },
  async getFile(id) { if (this.mode !== 'idb' || !id) return null; try { return await this.tx('files', 'readonly', os => os.get(id)); } catch (e) { return null; } },
  async delFile(id) { if (this.mode === 'idb' && id) await this.tx('files', 'readwrite', os => os.delete(id)); },
  async allFiles() {
    if (this.mode !== 'idb') return {};
    const [keys, vals] = await Promise.all([this.tx('files', 'readonly', os => os.getAllKeys()), this.tx('files', 'readonly', os => os.getAll())]);
    const o = {}; keys.forEach((k, i) => o[k] = vals[i]); return o;
  },
  async clearAll() {
    docs = {};
    if (this.mode === 'idb') { await this.tx('docs', 'readwrite', os => os.clear()); await this.tx('files', 'readwrite', os => os.clear()); }
    else this.saveLS();
  }
};

/* ---------- estado derivado ---------- */
let S = {cfg:clone(DEFAULT_CFG), clientes:[], vehiculos:[], trabajos:[], gastos:[], proveedores:[], citas:[]};
function rebuild() {
  const all = Object.entries(docs).map(([id, d]) => ({...d, id}));
  S.cfg = {...clone(DEFAULT_CFG), ...(docs.cfg || {})};
  const of = t => all.filter(d => d.t === t);
  S.clientes = of('cliente').sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  S.vehiculos = of('vehiculo');
  S.trabajos = of('trabajo').sort((a, b) => (b.creado || '').localeCompare(a.creado || ''));
  S.gastos = of('gasto').sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  S.proveedores = of('proveedor').sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  S.citas = of('cita').sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  const bn = $('#brand-name'); if (bn) bn.textContent = (S.cfg.taller || '').replace(/^Taller\s+/i, '') || 'Mi taller';
  if (booted) render();
}
const byId = id => (id && docs[id]) ? {...docs[id], id} : null;
const cliOf = j => byId(j.clienteId) || {nombre: j.clienteNombre || j.nombre || 'Cliente'};
const vehOf = j => byId(j.vehiculoId) || {matricula: j.matricula || ''};
const carName = v => [v.marca, v.modelo, v.version].filter(Boolean).join(' ');

function totals(j) {
  const iva = j.iva ?? S.cfg.iva;
  if (j.totalFijo) { const total = r2(j.totalFijo); const base = r2(total / (1 + iva / 100)); return {base, iva, cuota:r2(total - base), total}; }
  const bruto = r2((j.lineas || []).reduce((s, l) => s + r2((+l.cant || 0) * (+l.precio || 0)), 0));
  const d = j.descuento; const dto = d ? r2(Math.min(bruto, d.tipo === 'pct' ? bruto * (+d.valor || 0) / 100 : +d.valor || 0)) : 0;
  const base = r2(bruto - dto); const cuota = r2(base * iva / 100);
  return {bruto, dto, base, iva, cuota, total:r2(base + cuota)};
}
const pagado = j => r2((j.pagos || []).reduce((s, p) => s + (+p.importe || 0), 0));
const pendiente = j => r2(Math.max(0, totals(j).total - pagado(j)));
function nextNum(kind) {
  const y = new Date().getFullYear();
  const serie = kind === 'F' ? (S.cfg.serieF || 'F') : kind === 'T' ? (S.cfg.serieT || 'T') : (S.cfg.serieP || 'P');
  const key = kind === 'P' ? 'numPresupuesto' : 'numFactura';
  const pre = serie.replace(/[^A-Za-z0-9]/g, '') + '-' + y + '-';
  let max = 0;
  S.trabajos.forEach(j => { if (j.ejemplo) return; const n = j[key] || ''; if (n.startsWith(pre)) max = Math.max(max, parseInt(n.slice(pre.length), 10) || 0); });
  return pre + pad(max + 1, kind === 'P' ? 3 : 4);
}
const facturas = () => S.trabajos.filter(j => j.numFactura);
const inRange = (iso, a, b) => iso && iso.slice(0, 10) >= a && iso.slice(0, 10) <= b;

/* Periodos para el resumen */
function periodRange(mode, anchor) {
  const d = parseISO(anchor);
  if (mode === 'dia') return {from:anchor, to:anchor, label: longDate(anchor)};
  if (mode === 'semana') { const wd = (d.getDay() + 6) % 7; const from = addDays(anchor, -wd); const to = addDays(from, 6); return {from, to, label:'Semana del ' + fdate(from).slice(0, 5) + ' al ' + fdate(to).slice(0, 5)}; }
  if (mode === 'mes') { const from = isoOf(new Date(d.getFullYear(), d.getMonth(), 1)); const to = isoOf(new Date(d.getFullYear(), d.getMonth() + 1, 0)); return {from, to, label: MES[d.getMonth()] + ' ' + d.getFullYear()}; }
  return {from:d.getFullYear() + '-01-01', to:d.getFullYear() + '-12-31', label:'Año ' + d.getFullYear()};
}
function shiftAnchor(mode, anchor, dir) {
  const d = parseISO(anchor);
  if (mode === 'dia') return addDays(anchor, dir);
  if (mode === 'semana') return addDays(anchor, 7 * dir);
  if (mode === 'mes') return isoOf(new Date(d.getFullYear(), d.getMonth() + dir, 1));
  return isoOf(new Date(d.getFullYear() + dir, 0, 1));
}
function caja(from, to) {
  const movs = [];
  S.trabajos.forEach(j => (j.pagos || []).forEach(p => { if (inRange(p.fecha, from, to)) movs.push({tipo:'in', fecha:p.fecha, importe:+p.importe || 0, metodo:p.metodo, txt:(cliOf(j).nombre || '') + (j.matricula ? ' · ' + showPlate(j.matricula) : ''), ref:j.numFactura || j.numPresupuesto, id:j.id}); }));
  S.gastos.forEach(g => { if (inRange(g.fecha, from, to)) movs.push({tipo:'out', fecha:g.fecha, importe:+g.total || 0, txt:g.proveedor || 'Gasto', ref:g.categoria, id:g.id}); });
  movs.sort((a, b) => b.fecha.localeCompare(a.fecha));
  const entradas = r2(movs.filter(m => m.tipo === 'in').reduce((s, m) => s + m.importe, 0));
  const salidas = r2(movs.filter(m => m.tipo === 'out').reduce((s, m) => s + m.importe, 0));
  const efectivo = r2(movs.filter(m => m.tipo === 'in' && m.metodo === 'efectivo').reduce((s, m) => s + m.importe, 0));
  const fac = facturas().filter(j => inRange(j.fechaFactura, from, to));
  const facBase = r2(fac.reduce((s, j) => s + totals(j).base, 0));
  const facIva = r2(fac.reduce((s, j) => s + totals(j).cuota, 0));
  const ded = S.gastos.filter(g => g.deducible !== false && inRange(g.fecha, from, to));
  const gasBase = r2(ded.reduce((s, g) => s + (+g.base || 0), 0));
  const gasIva = r2(ded.reduce((s, g) => s + (+g.cuota || 0), 0));
  const beneficio = r2(facBase - gasBase);
  const irpf = r2(Math.max(0, beneficio * (+S.cfg.irpf || 0) / 100));
  const ivaApartar = r2(facIva - gasIva);
  const presup = S.trabajos.filter(j => inRange(j.fecha, from, to));
  return {movs, entradas, salidas, saldo:r2(entradas - salidas), efectivo, fac, facBase, facIva, gasBase, gasIva, beneficio, irpf, ivaApartar, limpio:r2(beneficio - irpf), presup};
}

/* Modelos 303 y 130 por trimestre */
function report(y, q) {
  const em = facturas().filter(j => j.fechaFactura && +j.fechaFactura.slice(0, 4) === y && qOf(j.fechaFactura) === q);
  const re = S.gastos.filter(g => g.fecha && +g.fecha.slice(0, 4) === y && qOf(g.fecha) === q);
  const repercutido = {};
  em.forEach(j => { const t = totals(j); repercutido[t.iva] = repercutido[t.iva] || {base:0, cuota:0}; repercutido[t.iva].base = r2(repercutido[t.iva].base + t.base); repercutido[t.iva].cuota = r2(repercutido[t.iva].cuota + t.cuota); });
  const ded = re.filter(g => g.deducible !== false);
  const sopBase = r2(ded.reduce((s, g) => s + (+g.base || 0), 0));
  const sopCuota = r2(ded.reduce((s, g) => s + (+g.cuota || 0), 0));
  const repCuota = r2(Object.values(repercutido).reduce((s, v) => s + v.cuota, 0));
  const pagos = [];
  for (let k = 1; k <= q; k++) {
    const upTo = iso => iso && +iso.slice(0, 4) === y && qOf(iso) <= k;
    const ing = r2(facturas().filter(j => upTo(j.fechaFactura)).reduce((s, j) => s + totals(j).base, 0));
    const gas = r2(S.gastos.filter(g => g.deducible !== false && upTo(g.fecha)).reduce((s, g) => s + (+g.base || 0), 0));
    const rend = r2(ing - gas); const veinte = r2(Math.max(0, rend * 0.2));
    const anteriores = r2(pagos.reduce((s, p) => s + p.pago, 0));
    pagos.push({ing, gas, rend, veinte, anteriores, pago:r2(Math.max(0, veinte - anteriores))});
  }
  const alquiler = re.filter(g => g.categoria === 'Alquiler del local');
  const ret115 = r2(alquiler.reduce((s, g) => s + (+g.base || 0) * 0.19, 0));
  return {em, re, repercutido, repCuota, sopBase, sopCuota, res303:r2(repCuota - sopCuota), m130:pagos[q - 1], ret115};
}

/* Calendario fiscal de un autónomo en estimación directa */
function fiscalEvents(y) {
  const habil = iso => { let d = parseISO(iso); while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1); return isoOf(d); };
  const ev = [];
  const add = (key, fecha, modelos, desc) => ev.push({key, fecha:habil(fecha), modelos, desc});
  const prev = y - 1;
  add(prev + '-4T', y + '-01-30', '303 · 130', 'IVA e IRPF del 4.º trimestre de ' + prev);
  add(prev + '-390', y + '-01-30', '390', 'Resumen anual de IVA de ' + prev);
  if (S.cfg.alquiler) { add(prev + '-4T-115', y + '-01-20', '115', 'Retenciones del alquiler, 4.º trimestre de ' + prev); add(prev + '-180', y + '-01-31', '180', 'Resumen anual de retenciones del alquiler'); }
  if (S.cfg.trabajadores) { add(prev + '-4T-111', y + '-01-20', '111', 'Retenciones de trabajadores, 4.º trimestre de ' + prev); add(prev + '-190', y + '-01-31', '190', 'Resumen anual de retenciones de trabajadores'); }
  add(prev + '-347', isoOf(new Date(y, 2, 0)), '347', 'Clientes o proveedores con más de 3.005,06 € al año en ' + prev);
  add(prev + '-renta', y + '-06-30', 'Renta', 'Declaración de la renta de ' + prev + ' (campaña de abril a junio)');
  [['1T', '04-20'], ['2T', '07-20'], ['3T', '10-20']].forEach(([q, md]) => {
    add(y + '-' + q, y + '-' + md, '303 · 130', 'IVA e IRPF del ' + q.replace('T', '.º trimestre') + ' de ' + y);
    if (S.cfg.alquiler) add(y + '-' + q + '-115', y + '-' + md, '115', 'Retenciones del alquiler del local, ' + q);
    if (S.cfg.trabajadores) add(y + '-' + q + '-111', y + '-' + md, '111', 'Retenciones de trabajadores, ' + q);
  });
  return ev.sort((a, b) => a.fecha.localeCompare(b.fecha));
}
function nextDeadlines(n = 3) {
  const t = todayISO(); const y = new Date().getFullYear();
  return [...fiscalEvents(y), ...fiscalEvents(y + 1)].filter(e => e.fecha >= t && !(S.cfg.presentados || {})[e.key]).slice(0, n);
}
const daysTo = iso => Math.round((parseISO(iso) - parseISO(todayISO())) / 86400000);

/* Agenda: huecos libres según el horario */
function openRanges(iso) {
  const c = S.cfg; const wd = parseISO(iso).getDay();
  if (wd === 6) return c.sab ? [[toMin(c.sab1), toMin(c.sab2)]] : [];
  if (!(c.dias || []).includes(wd)) return [];
  const r = []; if (c.m1 && c.m2) r.push([toMin(c.m1), toMin(c.m2)]); if (c.t1 && c.t2) r.push([toMin(c.t1), toMin(c.t2)]);
  return r;
}
function slotsOf(iso) {
  const step = +S.cfg.hueco || 60; const out = [];
  const citas = S.citas.filter(c => c.fecha === iso && c.estado !== 'novino');
  openRanges(iso).forEach(([a, b]) => { for (let m = a; m + step <= b; m += step) {
    const busy = citas.find(c => { const s = toMin(c.hora), e = s + (+c.duracion || step); return s < m + step && e > m; });
    out.push({min:m, hora:hm(m), cita:busy && toMin(busy.hora) >= m && toMin(busy.hora) < m + step ? busy : null, busy:!!busy});
  }});
  citas.forEach(c => { if (!out.some(s => s.cita && s.cita.id === c.id)) out.push({min:toMin(c.hora), hora:c.hora, cita:c, busy:true}); });
  return out.sort((a, b) => a.min - b.min);
}
function freeSlots(fromIso, days, max) {
  const res = []; const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  for (let i = 0; i < days && res.length < max; i++) {
    const iso = addDays(fromIso, i);
    slotsOf(iso).forEach(s => { if (!s.busy && res.length < max && !(iso === todayISO() && s.min <= nowMin)) res.push({iso, hora:s.hora}); });
  }
  return res;
}

/* ---------- interfaz base ---------- */
let booted = false;
let tab = 'inicio', filtro = 'activos', qHome = '', qCli = '';
let agendaDay = todayISO();
const ICON = {
  wa:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 18.8z"/></svg>',
  edit:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  plus:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  cam:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  img:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
  cal:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/></svg>',
  search:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>',
  car:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 16V12l2-5h10l2 5v4"/><path d="M3 16h18v3H3z"/><circle cx="7.5" cy="16" r="1.4"/><circle cx="16.5" cy="16" r="1.4"/></svg>',
  chevL:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  chevR:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>'
};
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 3200); }

const sheetStack = [];
function openSheet(entry) { sheetStack.push(entry); renderSheet(true); }
function closeSheet() { const top = sheetStack.pop(); if (top && top.onClose) top.onClose(); renderSheet(true); }
function closeAll() { while (sheetStack.length) closeSheet(); }
function renderSheet(scrollTop) {
  const el = $('#sheet'); const top = sheetStack[sheetStack.length - 1];
  if (!top) { el.hidden = true; el.innerHTML = ''; document.body.style.overflow = ''; return; }
  const keep = el.scrollTop;
  const r = top.render();
  el.innerHTML = `<div class="sheet-top"><div class="wrap"><button class="iconbtn" data-a="back" aria-label="Volver">${ICON.chevL}</button><h2>${esc(r.title)}</h2>${r.right || ''}</div></div><div class="sheet-body"><div class="wrap stack">${r.body}</div></div>${r.foot ? `<div class="sheet-foot"><div class="wrap">${r.foot}</div></div>` : ''}`;
  el.hidden = false; document.body.style.overflow = 'hidden';
  el.scrollTop = scrollTop ? 0 : keep;
  if (top.after) top.after();
  hydratePhotos(el);
}
function render() {
  $$('.tab').forEach(b => b.classList.toggle('on', b.dataset.id === tab));
  const v = $('#view');
  v.innerHTML = ({inicio:vInicio, agenda:vAgenda, trabajos:vTrabajos, clientes:vClientes, mas:vMas})[tab]();
  hydratePhotos(v);
  const top = sheetStack[sheetStack.length - 1];
  if (top && top.live) renderSheet(false);
}
const pill = (e, map = ESTADOS) => `<span class="pill p-${e}">${esc(map[e] || e)}</span>`;
function jobItem(j) {
  const c = cliOf(j), v = vehOf(j); const t = totals(j);
  const amt = j.estado === 'facturado' && pagado(j) ? eur(pendiente(j)) : eur(t.total);
  return `<button class="item" data-a="job" data-id="${j.id}">${j.simplificada ? '<span class="plate"><span class="plate-eu">€</span><span class="plate-num" style="font-size:15px">TICKET</span></span>' : plate(v.matricula || j.matricula)}<div class="grow"><div class="t">${esc(c.nombre)} ${j.ejemplo ? '<span class="ex">ejemplo</span>' : ''}</div><div class="s">${esc(j.numFactura || j.numPresupuesto || '')}${carName(v) ? ' · ' + esc(carName(v)) : j.averia ? ' · ' + esc(j.averia) : ''}</div><div style="margin-top:4px">${pill(j.estado)}</div></div><div class="amt num">${amt}</div></button>`;
}
function citaItem(c) {
  return `<button class="item" data-a="cita" data-id="${c.id}"><span class="time num">${esc(c.hora)}</span><div class="grow"><div class="t">${esc(c.nombre || cliOf(c).nombre)} ${c.ejemplo ? '<span class="ex">ejemplo</span>' : ''}</div><div class="s">${c.matricula ? esc(showPlate(c.matricula)) + ' · ' : ''}${esc(c.motivo || '')}</div></div>${pill(c.estado || 'pendiente', CITA_EST)}</button>`;
}

/* ---------- búsqueda universal ---------- */
function cliMatches(c, q) {
  const f = fold(q).trim(); if (!f) return true; const d = digits(q), p = normPlate(q);
  const vs = S.vehiculos.filter(v => v.clienteId === c.id);
  const hay = fold([c.nombre, c.email, c.direccion, c.notas, c.nif, ...vs.map(v => [v.marca, v.modelo, v.version, v.color].join(' '))].join(' '));
  return f.split(/\s+/).every(w => hay.includes(w)) || (d.length >= 3 && digits(c.telefono).includes(d)) || (p.length >= 3 && (normPlate(c.nif).includes(p) || vs.some(v => normPlate(v.matricula).includes(p) || normPlate(v.bastidor).includes(p))));
}
function searchAll(q) {
  const f = fold(q).trim(); if (!f) return null;
  const p = normPlate(q); const d = digits(q);
  const vehs = S.vehiculos.filter(v => {
    const name = fold([v.marca, v.modelo, v.version, v.color, v.combustible].join(' '));
    return (p.length >= 3 && (normPlate(v.matricula).includes(p) || normPlate(v.bastidor).includes(p))) || (f.length >= 2 && f.split(/\s+/).every(w => name.includes(w)));
  });
  const clis = S.clientes.filter(c => cliMatches(c, q));
  vehs.forEach(v => { if (v.clienteId && !clis.some(c => c.id === v.clienteId)) { /* el cliente sale a través del coche */ } });
  const jobs = S.trabajos.filter(j => fold(j.numPresupuesto).includes(f) || fold(j.numFactura).includes(f) || (f.length >= 4 && fold(j.averia).includes(f)));
  return {vehs, clis, jobs, p};
}
function vehResult(v) {
  const c = byId(v.clienteId) || {}; const js = S.trabajos.filter(j => j.vehiculoId === v.id).slice(0, 3);
  return `<div class="list"><button class="item" data-a="veh" data-id="${v.id}">${plate(v.matricula)}<div class="grow"><div class="t">${esc(carName(v) || 'Coche sin modelo')}</div><div class="s">${esc(c.nombre || 'Sin cliente')}${c.telefono ? ' · ' + esc(c.telefono) : ''}${v.bastidor ? ' · …' + esc(v.bastidor.slice(-6)) : ''}</div></div></button>${js.map(jobItem).join('')}<div class="item static" style="gap:8px"><button class="btn sm" data-a="newjobveh" data-id="${v.id}">${ICON.plus}Presupuesto</button><button class="btn sm" data-a="newcitaveh" data-id="${v.id}">${ICON.cal}Cita</button>${c.telefono ? `<button class="btn sm" data-a="wa-cli" data-id="${c.id}">${ICON.wa}</button>` : ''}</div></div>`;
}
function vSearch() {
  const r = searchAll(qHome);
  const parts = [];
  r.vehs.forEach(v => parts.push(vehResult(v)));
  r.clis.forEach(c => { const vs = S.vehiculos.filter(v => v.clienteId === c.id); if (vs.length && vs.every(v => r.vehs.some(x => x.id === v.id))) return; parts.push(`<div class="list"><button class="item" data-a="cli" data-id="${c.id}"><div class="grow"><div class="t">${esc(c.nombre)}</div><div class="s">${esc(c.telefono || 'Sin teléfono')}${c.nif ? ' · ' + esc(c.nif) : ''}</div></div>${vs[0] ? plate(vs[0].matricula) : ''}</button>${S.trabajos.filter(j => j.clienteId === c.id).slice(0, 3).map(jobItem).join('')}</div>`); });
  if (r.jobs.length) parts.push(`<div class="list">${r.jobs.slice(0, 8).map(jobItem).join('')}</div>`);
  const plateLike = /^\d{4}[A-Z]{3}$/.test(r.p) || /^[A-Z]{1,2}\d{4}[A-Z]{0,2}$/.test(r.p);
  const vinLike = r.p.length === 17;
  return `<div class="stack">${parts.length ? `<div class="muted small">${r.vehs.length + r.clis.length + r.jobs.length} resultados</div>` + parts.join('') : `<div class="card empty"><div class="muted">Nada encontrado con «${esc(qHome)}».</div></div>`}
    ${(plateLike || vinLike) && !r.vehs.length ? `<button class="btn primary block" data-a="newjobplate" data-id="${esc(r.p)}">${ICON.plus}Nuevo presupuesto para ${esc(vinLike ? 'el bastidor' : showPlate(r.p))}</button>` : ''}</div>`;
}

/* ---------- vistas ---------- */
function vInicio() {
  const t = todayISO();
  const hoy = S.citas.filter(c => c.fecha === t && c.estado !== 'novino');
  const act = S.trabajos.filter(j => !['cobrado', 'rechazado'].includes(j.estado));
  const cobrar = act.filter(j => j.estado === 'facturado');
  const taller = act.filter(j => j.estado === 'aceptado');
  const esperando = act.filter(j => j.estado === 'borrador' || j.estado === 'enviado');
  const vacio = !S.trabajos.length && !S.gastos.length && !S.clientes.length && !S.citas.length;
  const dl = nextDeadlines(1)[0]; const dd = dl ? daysTo(dl.fecha) : 99;
  const tasks = [...autoTasks(), ...tareas().filter(x => !x.hecho && (!x.fecha || x.fecha <= t))];
  const sec = (title, arr, fn, extra, act2) => `<div class="section-h"><h2>${title}</h2>${act2 || `<span class="muted small">${extra || arr.length}</span>`}</div>${arr.length ? `<div class="list">${arr.map(fn).join('')}</div>` : ''}`;
  return `<div class="stack">
    <div class="search">${ICON.search}<input class="in" id="q-home" type="search" placeholder="Matrícula, bastidor, nombre, teléfono, coche…" value="${esc(qHome)}" autocomplete="off" enterkeyhint="search"></div>
    ${qHome.trim() ? vSearch() : `
    <div class="quick">
      <button class="qa main" data-a="newjob">${ICON.plus}Nuevo<br>presupuesto</button>
      <button class="qa" data-a="photo-menu">${ICON.cam}Foto</button>
      <button class="qa" data-a="newcita">${ICON.cal}Cita</button>
      <button class="qa" data-a="focus-search">${ICON.car}Buscar<br>coche</button>
    </div>
    ${licBanner()}
    ${dl && dd <= 15 ? `<button class="note ${dd <= 5 ? 'bad' : 'warn'}" data-a="hacienda"><b>Hacienda: modelo ${esc(dl.modelos)}</b> · ${dd === 0 ? 'hoy es el último día' : 'quedan ' + dd + ' días'} (hasta el ${fdate(dl.fecha)}).</button>` : ''}
    ${vacio ? `<div class="card empty"><h2>Bienvenido, ${esc(S.cfg.propietario || '')}</h2><div class="muted">Empieza con <b>Nuevo presupuesto</b> o carga unos datos de ejemplo para ver la app llena. Los ejemplos se borran desde <b>Gestión</b>.</div><button class="btn dark" data-a="seed">Cargar datos de ejemplo</button></div>` : ''}
    ${!vacio ? sec('Hoy', hoy, citaItem, hoy.length ? hoy.length + ' citas' : 'sin citas') : ''}
    ${!vacio && !hoy.length ? `<button class="btn block" data-a="tab" data-id="agenda">Ver la agenda</button>` : ''}
    ${tasks.length ? sec('Tareas', tasks.slice(0, 5), taskItem, '', `<button class="btn sm" data-a="tareas">Ver todas</button>`) : ''}
    ${cobrar.length ? sec('Por cobrar', cobrar, jobItem, '', `<button class="btn sm" data-a="impagados">Guía de cobro</button>`) : ''}
    ${taller.length ? sec('En el taller', taller, jobItem) : ''}
    ${esperando.length ? sec('Esperando respuesta', esperando, jobItem) : ''}
    ${!vacio && !S.cfg.nif ? `<button class="note warn" data-a="settings"><b>Falta tu NIF y la dirección del taller.</b> Salen en cada factura. Toca para rellenarlos.</button>` : ''}`}
  </div>`;
}

function vTrabajos() {
  const fs = {activos:'Activos', borrador:'Presupuestos', aceptado:'En taller', facturado:'Por cobrar', cobrado:'Cobrados', todos:'Todos'};
  const arr = S.trabajos.filter(j => {
    if (filtro === 'activos') return !['cobrado', 'rechazado'].includes(j.estado);
    if (filtro === 'borrador') return j.estado === 'borrador' || j.estado === 'enviado';
    if (filtro === 'todos') return true;
    return j.estado === filtro;
  });
  return `<div class="stack">
    <div class="row"><h1 class="grow">Trabajos</h1><button class="btn primary" data-a="newjob">${ICON.plus}Nuevo</button></div>
    <div class="chips">${Object.entries(fs).map(([k, v]) => `<button class="chip ${filtro === k ? 'on' : ''}" data-a="filtro" data-id="${k}">${v}</button>`).join('')}</div>
    ${arr.length ? `<div class="list">${arr.map(jobItem).join('')}</div>` : `<div class="card empty"><div class="muted">No hay trabajos en esta lista.</div></div>`}
  </div>`;
}

function vClientes() {
  const arr = S.clientes.filter(c => cliMatches(c, qCli));
  return `<div class="stack">
    <div class="row"><h1 class="grow">Clientes</h1><button class="btn" data-a="newcli">${ICON.plus}Cliente</button></div>
    <div class="search">${ICON.search}<input class="in" id="q-cli" type="search" placeholder="Cualquier dato: nombre, teléfono, NIF, matrícula, coche, notas…" value="${esc(qCli)}" autocomplete="off"></div>
    ${arr.length ? `<div class="list">${arr.map(c => { const vs = S.vehiculos.filter(v => v.clienteId === c.id); const dd = deudaDe(c.id); return `<button class="item" data-a="cli" data-id="${c.id}"><div class="grow"><div class="t">${esc(c.nombre)} ${c.ejemplo ? '<span class="ex">ejemplo</span>' : ''}</div><div class="s">${esc(c.telefono || 'Sin teléfono')} · ${vs.length} ${vs.length === 1 ? 'coche' : 'coches'}${dd.pend ? ' · <span class="neg">debe ' + eur(dd.pend) + '</span>' : ''}</div></div>${vs[0] ? plate(vs[0].matricula) : ''}</button>`; }).join('')}</div>` : `<div class="card empty"><div class="muted">${qCli.trim() ? 'Nadie coincide con esa búsqueda.' : 'Los clientes se crean solos al hacer el primer presupuesto o cita.'}</div></div>`}
  </div>`;
}

let agView = 'dia';
function vAgenda() {
  const head = `<div class="row"><h1 class="grow">Agenda</h1><button class="btn primary" data-a="newcita">${ICON.plus}Cita</button></div>
    <div class="seg" style="align-self:flex-start">${[['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes']].map(([k, v]) => `<button class="${agView === k ? 'on' : ''}" data-a="agview" data-id="${k}">${v}</button>`).join('')}</div>`;
  const d0 = parseISO(agendaDay);
  if (agView === 'mes') {
    const first = new Date(d0.getFullYear(), d0.getMonth(), 1); const lead = (first.getDay() + 6) % 7;
    const days = new Date(d0.getFullYear(), d0.getMonth() + 1, 0).getDate(); const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<div></div>');
    for (let n = 1; n <= days; n++) { const iso = isoOf(new Date(d0.getFullYear(), d0.getMonth(), n)); const k = S.citas.filter(c => c.fecha === iso && c.estado !== 'novino').length;
      cells.push(`<button class="mday ${iso === todayISO() ? 'today' : ''} ${openRanges(iso).length ? '' : 'closed'}" data-a="agday-go" data-id="${iso}"><b>${n}</b>${k ? `<span>${k}</span>` : ''}</button>`); }
    return `<div class="stack">${head}
      <div class="row"><button class="btn sm" data-a="agmes" data-id="-1" aria-label="Mes anterior">${ICON.chevL}</button><div class="grow" style="text-align:center;font-weight:700;text-transform:capitalize">${MES[d0.getMonth()]} ${d0.getFullYear()}</div><button class="btn sm" data-a="agmes" data-id="1" aria-label="Mes siguiente">${ICON.chevR}</button></div>
      <div class="mgrid">${['L','M','X','J','V','S','D'].map(x => `<div class="mh">${x}</div>`).join('')}${cells.join('')}</div>
      <div class="muted tiny">El número azul son las citas de ese día. Toca un día para verlo.</div></div>`;
  }
  const wd = (d0.getDay() + 6) % 7; const monday = addDays(agendaDay, -wd);
  const days = Array.from({length:7}, (_, i) => addDays(monday, i));
  const nav = `<div class="row"><button class="btn sm" data-a="agwk" data-id="-1" aria-label="Semana anterior">${ICON.chevL}</button><div class="grow" style="text-align:center;font-weight:700">${fdate(monday).slice(0, 5)} – ${fdate(days[6]).slice(0, 5)}</div><button class="btn sm" data-a="agwk" data-id="1" aria-label="Semana siguiente">${ICON.chevR}</button></div>`;
  if (agView === 'semana') {
    return `<div class="stack">${head}${nav}${days.map(d => { const cs = S.citas.filter(c => c.fecha === d && c.estado !== 'novino'); return `<div class="section-h"><h2 style="font-size:17px">${esc(longDate(d))}${d === todayISO() ? ' · hoy' : ''}</h2><button class="btn sm" data-a="agday-go" data-id="${d}">Abrir</button></div>${cs.length ? `<div class="list">${cs.map(citaItem).join('')}</div>` : `<div class="muted small">${openRanges(d).length ? 'Sin citas · ' + slotsOf(d).filter(s => !s.busy).length + ' huecos libres' : 'Cerrado'}</div>`}`; }).join('')}</div>`;
  }
  const slots = slotsOf(agendaDay); const isClosed = !openRanges(agendaDay).length;
  return `<div class="stack">${head}${nav}
    <div class="week">${days.map(d => { const n = S.citas.filter(c => c.fecha === d && c.estado !== 'novino').length; return `<button class="day ${d === agendaDay ? 'on' : ''} ${openRanges(d).length ? '' : 'closed'}" data-a="agday" data-id="${d}">${DOW[parseISO(d).getDay()]}<b>${parseISO(d).getDate()}</b>${n ? '<i></i>' : '<i style="visibility:hidden"></i>'}</button>`; }).join('')}</div>
    <div class="section-h"><h2>${esc(longDate(agendaDay))}${agendaDay === todayISO() ? ' · hoy' : ''}</h2></div>
    ${slots.length ? `<div class="list">${slots.map(s => s.cita ? citaItem(s.cita) : s.busy ? `<div class="slot"><span class="time num" style="color:var(--muted)">${s.hora}</span><div class="grow t muted small">Ocupado</div></div>` : `<button class="slot free" data-a="newcitaslot" data-id="${agendaDay}|${s.hora}"><span class="time num">${s.hora}</span><div class="grow t">Libre · toca para reservar</div></button>`).join('')}</div>` : `<div class="card empty"><div class="muted">${isClosed ? 'El taller está cerrado este día.' : 'No hay huecos.'}</div></div>`}
    <button class="btn block" data-a="ofrecer">${ICON.wa}Ofrecer huecos libres por WhatsApp</button>
  </div>`;
}

let installEvt = null;
function vMas() {
  const it = (a, title, sub, icon) => `<button class="item" data-a="${a}"><span style="color:var(--blue2)">${icon}</span><div class="grow"><div class="t">${title}</div><div class="s">${sub}</div></div>${ICON.chevR}</button>`;
  const dl = nextDeadlines(1)[0]; const pend = S.trabajos.filter(j => j.estado === 'facturado'); const st = licState();
  const ico = d => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  return `<div class="stack">
    <h1>Gestión</h1>
    ${licBanner()}
    <div class="eyebrow">Administración</div>
    <div class="list">
      ${it('admin', 'Administración e impuestos', dl ? 'Próximo: modelo ' + dl.modelos + ' hasta el ' + fdate(dl.fecha) : 'Modelos y obligaciones', ico('<path d="M3 10l9-6 9 6M5 10v9M19 10v9M9 10v9M15 10v9M3 21h18"/>'))}
      ${it('resumen', 'Resumen y caja', 'Entradas, salidas, beneficio e impuestos', ico('<path d="M4 20V11M10 20V5M16 20v-6M21 20H3"/>'))}
      ${it('gastos', 'Compras y gastos', S.gastos.length + ' facturas · foto de proveedor, alquiler, suministros, seguros', ICON.cam)}
      ${it('proveedores', 'Proveedores', S.proveedores.length + ' guardados', ico('<path d="M3 21V8l9-5 9 5v13"/><path d="M8 21v-7h8v7"/>'))}
    </div>
    <div class="eyebrow">Clientes y ventas</div>
    <div class="list">
      ${it('impagados', 'Cobros pendientes', pend.length ? pend.length + ' facturas · ' + eur(pend.reduce((s, j) => s + pendiente(j), 0)) : 'Todo cobrado', ico('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>'))}
      ${it('descuentos', 'Códigos de descuento', descuentos().length + ' códigos', ico('<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.5"/>'))}
      ${it('tareas', 'Tareas', autoTasks().length + tareas().filter(x => !x.hecho).length + ' pendientes', ico('<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>'))}
      ${it('brief', 'Resumen del día', 'El plan de hoy y los próximos días', ico('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>'))}
    </div>
    <div class="eyebrow">App</div>
    <div class="list">
      ${it('settings', 'Ajustes del taller', 'Tus datos, precios, horario, cobros', ico('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'))}
      ${it('licencia', 'Suscripción', st.modo === 'licencia' ? 'Activa hasta el ' + fdate(st.hasta) : 'Prueba gratuita · ' + st.dias + ' días', ico('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'))}
      ${it('backup', 'Copia de seguridad', 'Guarda o recupera todos los datos', ico('<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>'))}
    </div>
    ${installEvt ? `<button class="btn primary block" data-a="install">Instalar la app en este móvil</button>` : ''}
    <div class="note small">Los datos se guardan solo en este móvil. Haz una copia de seguridad cada semana y guárdala en tu Google Drive.</div>
    <button class="btn block" data-a="unseed">Borrar los datos de ejemplo</button>
  </div>`;
}

/* ---------- Resumen y caja ---------- */
let resMode = 'dia', resAnchor = todayISO();
function resumenSheet() {
  openSheet({live:true, render:() => {
    const pr = periodRange(resMode, resAnchor); const c = caja(pr.from, pr.to);
    const quien = {dia:'Hoy', semana:'Esta semana', mes:'Este mes', año:'Este año'}[resMode];
    const actual = pr.from <= todayISO() && pr.to >= todayISO();
    const lead = actual ? quien : 'En este periodo';
    const presAcept = c.presup.filter(j => !['borrador', 'enviado', 'rechazado'].includes(j.estado)).length;
    return {title:'Resumen', body:`
      <div class="seg" style="align-self:flex-start">${[['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes'], ['año', 'Año']].map(([k, v]) => `<button class="${resMode === k ? 'on' : ''}" data-a="resmode" data-id="${k}">${v}</button>`).join('')}</div>
      <div class="row"><button class="btn sm" data-a="resshift" data-id="-1" aria-label="Anterior">${ICON.chevL}</button><div class="grow" style="text-align:center;font-weight:700;text-transform:capitalize">${esc(pr.label)}</div><button class="btn sm" data-a="resshift" data-id="1" aria-label="Siguiente">${ICON.chevR}</button></div>
      <div class="card talk">${lead}, ${esc(S.cfg.propietario || '')}, has cobrado <b class="num">${eur(c.entradas)}</b> y has pagado <b class="num">${eur(c.salidas)}</b> en gastos. ${c.saldo >= 0 ? 'Te quedan' : 'Te faltan'} <b class="num ${c.saldo >= 0 ? 'pos' : 'neg'}">${eur(Math.abs(c.saldo))}</b> en caja.${c.efectivo ? ` En efectivo deberías tener <b class="num">${eur(c.efectivo)}</b>.` : ''}</div>
      <div class="card">
        <div class="eyebrow" style="margin-bottom:4px">Caja</div>
        <div class="kv"><span>Entradas (cobros)</span><span class="v pos">+ ${eur(c.entradas)}</span></div>
        <div class="kv"><span>Salidas (gastos)</span><span class="v neg">− ${eur(c.salidas)}</span></div>
        <div class="kv res"><span>Saldo</span><span class="v">${eur(c.saldo)}</span></div>
      </div>
      <div class="card">
        <div class="eyebrow" style="margin-bottom:4px">Beneficio</div>
        <div class="kv"><span>Facturado (sin IVA)</span><span class="v">${eur(c.facBase)}</span></div>
        <div class="kv"><span>Gastos del taller (sin IVA)</span><span class="v">− ${eur(c.gasBase)}</span></div>
        <div class="kv"><span>Beneficio antes de impuestos</span><span class="v">${eur(c.beneficio)}</span></div>
        <div class="kv res"><span>Beneficio limpio</span><span class="v ${c.limpio >= 0 ? 'pos' : 'neg'}">${eur(c.limpio)}</span></div>
        <div class="muted small">(Impuestos estimados: IRPF ${eur(c.irpf)} al ${S.cfg.irpf} % · además, aparta ${eur(Math.max(0, c.ivaApartar))} de IVA que no es tuyo)</div>
      </div>
      <div class="kpis"><div class="kpi"><div class="k">Facturas</div><div class="v num">${c.fac.length}</div></div><div class="kpi"><div class="k">Presupuestos</div><div class="v num">${c.presup.length}</div></div><div class="kpi"><div class="k">Aceptados</div><div class="v num">${presAcept}</div></div></div>
      <div class="section-h"><h2>Movimientos</h2><span class="muted small">${c.movs.length}</span></div>
      ${c.movs.length ? `<div class="list">${c.movs.slice(0, 60).map(m => `<button class="item" data-a="${m.tipo === 'in' ? 'job' : 'gasto'}" data-id="${m.id}"><div class="grow"><div class="t">${esc(m.txt)}</div><div class="s">${fdate(m.fecha)} · ${esc(m.tipo === 'in' ? METODOS[m.metodo] || m.metodo : m.ref)}${m.tipo === 'in' && m.ref ? ' · ' + esc(m.ref) : ''}</div></div><div class="amt num ${m.tipo === 'in' ? 'pos' : 'neg'}" style="font-size:18px">${m.tipo === 'in' ? '+' : '−'} ${eur(m.importe)}</div></button>`).join('')}</div>` : `<div class="muted small">Sin movimientos en este periodo.</div>`}
      <div class="muted tiny">El beneficio limpio descuenta una estimación del IRPF (el ${S.cfg.irpf} % que cambias en Ajustes). Tu gestor calcula la cifra exacta.</div>`};
  }});
}

/* ---------- Últimos presupuestos ---------- */
function ultimosSheet() {
  openSheet({live:true, render:() => {
    const arr = S.trabajos.filter(j => !j.simplificada).slice(0, 25);
    return {title:'Últimos presupuestos', right:`<button class="iconbtn" data-a="newjob" aria-label="Nuevo presupuesto">${ICON.plus}</button>`,
      body: arr.length ? `<div class="list">${arr.map(jobItem).join('')}</div>` : `<div class="card empty"><div class="muted">Aún no hay presupuestos.</div><button class="btn primary" data-a="newjob">Nuevo presupuesto</button></div>`};
  }});
}

/* ---------- Cobrar (teclado) ---------- */
let payAmt = '', payQ = '';
function cobroSheet(prefill) {
  payAmt = prefill ? numES(prefill) : ''; payQ = '';
  openSheet({live:false, render:() => ({title:'Cobrar', body:`
    <div class="card stack" style="gap:8px"><div class="amount" id="pay-amt">${payAmt ? esc(payAmt) + ' €' : '0 €'}</div>
    <div class="pad">${['1','2','3','4','5','6','7','8','9',',','0','⌫'].map(k => `<button data-a="padkey" data-id="${k}" aria-label="${k === '⌫' ? 'Borrar' : k}">${k}</button>`).join('')}</div></div>
    <button class="btn primary block" data-a="paydirect">Cobrar sin datos (ticket)</button>
    <div class="section-h"><h2>¿Es de un trabajo?</h2></div>
    <div class="search">${ICON.search}<input class="in" id="pay-q" type="search" placeholder="Matrícula, nombre o número" autocomplete="off"></div>
    <div id="pay-list"></div>`}),
    after:() => { payList(); $('#pay-q').addEventListener('input', e => { payQ = e.target.value; payList(); }); }});
}
function payList() {
  const box = $('#pay-list'); if (!box) return;
  const amt = parseNum(payAmt); const f = fold(payQ), p = normPlate(payQ);
  let arr = S.trabajos.filter(j => ['facturado', 'aceptado', 'enviado', 'borrador'].includes(j.estado));
  if (f) arr = arr.filter(j => fold(cliOf(j).nombre).includes(f) || (p.length >= 3 && normPlate(j.matricula).includes(p)) || fold(j.numFactura).includes(f) || fold(j.numPresupuesto).includes(f));
  const rank = j => (j.estado === 'facturado' ? 0 : j.estado === 'aceptado' ? 1 : 2) * 1e6 + (amt ? Math.abs(pendiente(j) - amt) : 0);
  arr.sort((a, b) => rank(a) - rank(b));
  box.innerHTML = arr.length ? `<div class="list">${arr.slice(0, 12).map(j => { const match = amt && Math.abs(pendiente(j) - amt) < 0.01; return `<button class="item" data-a="paypick" data-id="${j.id}">${plate(j.matricula)}<div class="grow"><div class="t">${esc(cliOf(j).nombre)}</div><div class="s">${esc(j.numFactura || j.numPresupuesto)} · ${esc(ESTADOS[j.estado])}${match ? ' · coincide' : ''}</div></div><div class="amt num" ${match ? 'style="color:var(--ok)"' : ''}>${eur(pendiente(j))}</div></button>`; }).join('')}</div>` : `<div class="muted small">No hay trabajos pendientes de cobro.</div>`;
}
function metodoSheet(opts) {
  // opts: {importe, jobId?, concepto?}
  openSheet({live:false, render:() => {
    const j = opts.jobId ? byId(opts.jobId) : null; const c = j ? cliOf(j) : null;
    return {title:'Cobrar ' + eur(opts.importe), body:`
      ${j ? `<div class="card row">${plate(j.matricula)}<div class="grow"><b>${esc(c.nombre)}</b><div class="muted small">${esc(j.numFactura || j.numPresupuesto)} · pendiente ${eur(pendiente(j))}</div></div></div>` : `<label class="f">Concepto <span class="h">Opcional. Sale en el ticket.</span><input class="in" id="pay-conc" placeholder="Servicio de taller" value="${esc(opts.concepto || '')}"></label>`}
      ${j && opts.importe < pendiente(j) - 0.004 ? `<div class="note warn small">Es menos de lo pendiente: se apunta como pago a cuenta y quedarán ${eur(pendiente(j) - opts.importe)} por cobrar.</div>` : ''}
      ${j && j.estado !== 'facturado' ? `<div class="note small">Al cobrar se crea la factura de este trabajo.</div>` : ''}
      <div class="eyebrow">¿Cómo paga?</div>
      <div class="grid2 keep">${Object.entries(METODOS).filter(([k]) => k !== 'tarjeta').map(([k, v]) => `<button class="btn" style="min-height:64px" data-a="payok" data-id="${k}">${v}</button>`).join('')}<button class="btn" style="min-height:64px" data-a="payok" data-id="tarjeta">Pagó con el enlace</button></div>
      ${S.cfg.linkPago && c && c.telefono ? `<button class="btn primary block" data-a="wa-pay" data-id="${j.id}">${ICON.wa}Enviarle el enlace de pago con tarjeta</button>` : ''}
      ${S.cfg.bizum ? `<div class="muted small">Bizum al ${esc(S.cfg.bizum)}</div>` : ''}`};
  }, opts});
}
async function registerPay(metodo) {
  const top = sheetStack[sheetStack.length - 1]; const o = top.opts; const today = todayISO(); const importe = r2(o.importe);
  if (o.jobId) {
    const j = clone(docs[o.jobId]);
    if (!j.numFactura) { j.numFactura = j.ejemplo ? 'EJ-' + nextNum('F').slice(-9) : nextNum('F'); j.fechaFactura = today; const cl = byId(j.clienteId) || {}; j.facturaCliente = {nombre:cl.nombre || j.clienteNombre || '', nif:cl.nif || '', direccion:cl.direccion || ''}; }
    j.pagos = [...(j.pagos || []), {importe, metodo, fecha:today}];
    j.estado = pagado(j) >= totals(j).total - 0.004 ? 'cobrado' : 'facturado';
    await Store.put(o.jobId, j);
    closeAll(); toast(j.estado === 'cobrado' ? 'Cobrado · ' + METODOS[metodo] : 'Pago a cuenta apuntado');
    openJob(o.jobId);
  } else {
    const conc = ($('#pay-conc') ? $('#pay-conc').value.trim() : '') || 'Servicio de taller';
    const id = newId('j_'); const num = nextNum('T');
    await Store.put(id, {t:'trabajo', simplificada:true, estado:'cobrado', numFactura:num, fechaFactura:today, fecha:today, clienteNombre:'Cliente de mostrador', lineas:[{tipo:'otro', desc:conc, cant:1, precio:r2(importe / (1 + S.cfg.iva / 100))}], totalFijo:importe, iva:S.cfg.iva, pagos:[{importe, metodo, fecha:today}], creado:new Date().toISOString()});
    closeAll(); toast('Ticket ' + num + ' cobrado · ' + METODOS[metodo]);
  }
}

/* ---------- Editor de presupuesto ---------- */
let D = null;
function jobEditor(job, preset) {
  D = job ? clone(job) : {t:'trabajo', estado:'borrador', lineas:[], iva:S.cfg.iva, fecha:todayISO(), averia:'', matricula:'', km:'', ...(preset || {})};
  D._veh = D.vehiculoId ? (byId(D.vehiculoId) || {}) : (D._veh || {});
  D._cli = D.clienteId ? (byId(D.clienteId) || {}) : (D._cli || {});
  if (!D.matricula && D._veh.matricula) D.matricula = D._veh.matricula;
  D._known = !!D.vehiculoId;
  openSheet({live:false, onClose:() => { D = null; }, render:() => ({
    title: job ? 'Editar ' + (job.numPresupuesto || '') : 'Nuevo presupuesto',
    body:`
      <label class="f">Matrícula<input class="in plate-in" id="ed-mat" value="${esc(showPlate(D.matricula))}" placeholder="1234 ABC" autocomplete="off" autocapitalize="characters"></label>
      <div id="ed-veh"></div>
      <label class="f">¿Qué le pasa al coche?<textarea class="in" id="ed-averia" placeholder="Ej.: ruido al frenar delante, cambio de aceite…">${esc(D.averia)}</textarea></label>
      <div id="ed-sug"></div>
      <button class="btn sm" data-a="catalogo">Ver todos los trabajos habituales</button>
      <div class="section-h"><h2>Trabajo y piezas</h2></div>
      <div id="ed-lines" class="stack"></div>
      <div class="row wrapr"><button class="btn sm" data-a="addline" data-id="mo">+ Horas</button><button class="btn sm" data-a="addline" data-id="pieza">+ Pieza</button><button class="btn sm" data-a="addline" data-id="otro">+ Otro</button></div>
      ${S.cfg.conceptos.length ? `<div><div class="eyebrow" style="margin-bottom:6px">Habituales</div><div class="chips">${S.cfg.conceptos.map((c, i) => `<button class="chip" data-a="addconc" data-id="${i}">${esc(c.desc)}</button>`).join('')}</div></div>` : ''}
      <div class="card stack" style="gap:8px"><div class="eyebrow">Código de descuento</div><div class="row"><input class="in grow num" id="ed-dto" placeholder="Código" value="${esc(D.descuento ? D.descuento.codigo : '')}" autocapitalize="characters" style="text-transform:uppercase"><button class="btn sm" data-a="dtoapply">${D.descuento ? 'Quitar' : 'Aplicar'}</button></div><div id="ed-dtomsg" class="small"></div></div>
      <div class="card"><div class="totals" id="ed-tot"></div></div>`,
    foot:`<button class="btn primary block" data-a="savejob">Guardar presupuesto</button>`
  }), after:() => {
    edVeh(); edLines(); edTot();
    $('#ed-mat').addEventListener('input', e => { D.matricula = normPlate(e.target.value); edMatch(); });
    $('#ed-averia').addEventListener('input', e => { D.averia = e.target.value; sugBox(); }); sugBox();
  }});
}
function edMatch() {
  const v = D.matricula.length >= 4 && S.vehiculos.find(v => normPlate(v.matricula) === D.matricula);
  if (v) { D.vehiculoId = v.id; D.clienteId = v.clienteId; D._veh = v; D._cli = byId(v.clienteId) || {}; D._known = true; edVeh(); }
  else if (D._known) { D.vehiculoId = null; D.clienteId = null; D._veh = {}; D._cli = {}; D._known = false; edVeh(); }
}
function edVeh() {
  const box = $('#ed-veh'); if (!box) return;
  if (D.vehiculoId && D._veh.id) {
    box.innerHTML = `<div class="card stack" style="gap:6px"><div class="eyebrow">Coche conocido</div><div><b>${esc(D._cli.nombre || '')}</b><div class="muted small">${esc(carName(D._veh))}${D._cli.telefono ? ' · ' + esc(D._cli.telefono) : ''}</div></div><label class="f">Kilómetros hoy<input class="in num" id="ed-km" inputmode="numeric" value="${esc(D.km)}" placeholder="148500"></label></div>`;
  } else {
    const opts = S.clientes.map(c => `<option value="${c.id}" ${D.clienteId === c.id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('');
    box.innerHTML = `<div class="card stack"><div class="eyebrow">Coche nuevo</div>
      <div class="grid2"><label class="f">Marca y modelo<input class="in" id="ed-modelo" value="${esc([D._veh.marca, D._veh.modelo].filter(Boolean).join(' '))}" placeholder="Seat León 1.6 TDI"></label><label class="f">Kilómetros<input class="in num" id="ed-km" inputmode="numeric" value="${esc(D.km)}" placeholder="148500"></label></div>
      <label class="f">Nº de bastidor <span class="h">Opcional. 17 caracteres, en la ficha técnica.</span><input class="in vin" id="ed-vin" maxlength="17" value="${esc(D._veh.bastidor || '')}" placeholder="VSSZZZ5FZJR000000"></label>
      ${S.clientes.length ? `<label class="f">Cliente<select class="in" id="ed-clisel"><option value="">— Cliente nuevo —</option>${opts}</select></label>` : ''}
      <div id="ed-newcli" class="grid2" ${D.clienteId ? 'hidden' : ''}><label class="f">Nombre del cliente<input class="in" id="ed-cli" value="${esc(D._cli.nombre || '')}" placeholder="Nombre y apellido"></label><label class="f">Teléfono (WhatsApp)<input class="in" id="ed-tel" type="tel" inputmode="tel" value="${esc(D._cli.telefono || '')}" placeholder="600 000 000"></label></div></div>`;
    const sel = $('#ed-clisel');
    if (sel) sel.addEventListener('change', e => { D.clienteId = e.target.value || null; D._cli = D.clienteId ? byId(D.clienteId) : {}; $('#ed-newcli').hidden = !!D.clienteId; });
    $('#ed-modelo').addEventListener('input', e => { const p = e.target.value.trim().split(/\s+/); D._veh.marca = p[0] || ''; D._veh.modelo = p.slice(1).join(' '); });
    $('#ed-vin').addEventListener('input', e => { D._veh.bastidor = normPlate(e.target.value); if (D._veh.bastidor.length === 17 && !$('#ed-modelo').value.trim()) { const v = decodeVinOffline(D._veh.bastidor); if (v.marca) { $('#ed-modelo').value = v.marca + ' '; D._veh.marca = v.marca; toast('Marca por el bastidor: ' + v.marca + (v.anio ? ' · ' + v.anio : '')); } } });
    const ci = $('#ed-cli'); if (ci) ci.addEventListener('input', e => D._cli.nombre = e.target.value);
    const ti = $('#ed-tel'); if (ti) ti.addEventListener('input', e => D._cli.telefono = e.target.value);
  }
  $('#ed-km').addEventListener('input', e => D.km = e.target.value.replace(/\D/g, ''));
}
function edLines() {
  const box = $('#ed-lines'); if (!box) return;
  if (!D.lineas.length) { box.innerHTML = `<div class="muted small">Añade horas de trabajo y piezas con los botones de abajo.</div>`; return; }
  box.innerHTML = D.lineas.map((l, i) => `<div class="line">
    <div class="line-h"><div class="seg">${Object.entries(TIPOS).map(([k, v]) => `<button class="${l.tipo === k ? 'on' : ''}" data-a="ltipo" data-id="${i}:${k}">${v}</button>`).join('')}</div><button class="btn sm danger" data-a="delline" data-id="${i}">Quitar</button></div>
    <input class="in" data-l="${i}" data-f="desc" value="${esc(l.desc)}" placeholder="${l.tipo === 'mo' ? 'Qué trabajo' : 'Qué pieza'}">
    <div class="line-n"><label class="f">${l.tipo === 'mo' ? 'Horas' : 'Cantidad'}<input class="in num" data-l="${i}" data-f="cant" inputmode="decimal" value="${esc(String(l.cant).replace('.', ','))}"></label><label class="f">${l.tipo === 'mo' ? '€ / hora' : '€ / unidad'}<input class="in num" data-l="${i}" data-f="precio" inputmode="decimal" value="${l.precio ? esc(String(l.precio).replace('.', ',')) : ''}" placeholder="0,00"></label><div class="tot num" id="lt-${i}">${eur((+l.cant || 0) * (+l.precio || 0))}</div></div>
  </div>`).join('');
}
function edTot() {
  const t = totals(D); const box = $('#ed-tot'); if (!box) return;
  const j = D; box.innerHTML = `${t.dto ? `<span class="muted">Importe</span><span>${eur(t.bruto)}</span><span class="muted">Descuento ${esc(j.descuento.codigo)}</span><span class="pos">− ${eur(t.dto)}</span>` : ''}<span class="muted">Base</span><span>${eur(t.base)}</span><span class="muted">IVA ${t.iva} %</span><span>${eur(t.cuota)}</span><b style="align-self:end">Total</b><span class="big">${eur(t.total)}</span>`;
}
async function ensureClientVehicle(o) {
  // crea cliente y coche si son nuevos; o = {clienteId, vehiculoId, _cli, _veh, matricula}
  const ts = new Date().toISOString();
  if (!o.clienteId) {
    const nombre = (o._cli.nombre || '').trim(); if (!nombre) return 'Escribe el nombre del cliente.';
    o.clienteId = newId('c_'); await Store.put(o.clienteId, {t:'cliente', nombre, telefono:(o._cli.telefono || '').trim(), nif:'', direccion:'', email:'', creado:ts});
  }
  if (!o.vehiculoId && o.matricula) {
    const ex = S.vehiculos.find(v => normPlate(v.matricula) === o.matricula);
    if (ex) o.vehiculoId = ex.id;
    else { o.vehiculoId = newId('v_'); const dv = o._veh.bastidor ? decodeVinOffline(o._veh.bastidor) : {}; await Store.put(o.vehiculoId, {t:'vehiculo', clienteId:o.clienteId, matricula:o.matricula, bastidor:o._veh.bastidor || '', marca:o._veh.marca || dv.marca || '', modelo:o._veh.modelo || '', anio:dv.anio || '', creado:ts}); }
  }
  return null;
}
async function saveJob() {
  if (!D.matricula || D.matricula.length < 4) { toast('Escribe la matrícula del coche.'); $('#ed-mat').focus(); return; }
  if (!D.lineas.length) { toast('Añade al menos una línea de trabajo o pieza.'); return; }
  const err = await ensureClientVehicle(D); if (err) { toast(err); const ci = $('#ed-cli'); if (ci) ci.focus(); return; }
  const ts = new Date().toISOString(); const cli = byId(D.clienteId) || {}; const id = D.id || newId('j_');
  const out = {t:'trabajo', estado:D.estado || 'borrador', numPresupuesto:D.numPresupuesto || nextNum('P'), fecha:D.fecha || todayISO(),
    clienteId:D.clienteId, vehiculoId:D.vehiculoId, clienteNombre:cli.nombre || '', matricula:D.matricula, km:D.km || '', averia:D.averia || '',
    lineas:D.lineas.map(l => ({tipo:l.tipo, desc:(l.desc || '').trim(), cant:+l.cant || 0, precio:+l.precio || 0})), iva:D.iva ?? S.cfg.iva, creado:D.creado || ts, modificado:ts};
  ['firma','aceptadoFecha','aceptadoVia','aceptadoNombre','enviadoFecha','numFactura','fechaFactura','facturaCliente','pagos','citaId','ejemplo','descuento','fotos','horas','piezasPedidas','recordatorios','mostrarGesto'].forEach(k => { if (D[k] !== undefined && D[k] !== null) out[k] = D[k]; });
  if (out.descuento && !out.descuento.contado) { const dd = descuentos().find(x => x.codigo === out.descuento.codigo); if (dd) await Store.put(dd.id, {...docs[dd.id], usos:(docs[dd.id].usos || 0) + 1}); out.descuento = {...out.descuento, contado:true}; }
  if (D.km && D.vehiculoId && docs[D.vehiculoId]) await Store.put(D.vehiculoId, {...docs[D.vehiculoId], km:D.km});
  await Store.put(id, out);
  if (D.citaId && docs[D.citaId]) await Store.put(D.citaId, {...docs[D.citaId], trabajoId:id, estado:'llego'});
  const fromEdit = !!D.id; closeSheet();
  if (!fromEdit) openJob(id); else renderSheet(false);
  toast('Presupuesto guardado');
}

/* ---------- Ficha de trabajo ---------- */
function openJob(id) {
  openSheet({live:true, render:() => {
    const j = byId(id); if (!j) return {title:'Trabajo', body:'<div class="muted">Este trabajo ya no existe.</div>'};
    const c = cliOf(j), v = vehOf(j), t = totals(j);
    if (j.simplificada) return {title:j.numFactura, body:`<div class="card stack" style="gap:6px"><div class="eyebrow">Ticket (factura simplificada)</div><div class="amount">${eur(t.total)}</div><div class="muted small">${fdate(j.fechaFactura)} · ${esc(j.lineas[0].desc)} · ${esc((j.pagos || []).map(p => METODOS[p.metodo]).join(', '))}</div></div><div class="card"><div class="totals"><span class="muted">Base</span><span>${eur(t.base)}</span><span class="muted">IVA ${t.iva} %</span><span>${eur(t.cuota)}</span></div></div><button class="btn block" data-a="doc" data-id="${id}:F">Ver ticket</button>`};
    const st = {borrador:1, enviado:1, rechazado:1, aceptado:2, facturado:3, cobrado:4}[j.estado] || 1;
    let acts = '';
    if (j.estado === 'borrador' || j.estado === 'enviado') acts = `
      <button class="btn primary block" data-a="wa-pres" data-id="${id}">${ICON.wa}Enviar presupuesto por WhatsApp</button>
      <button class="btn dark block" data-a="sign" data-id="${id}">El cliente firma aquí y acepta</button>
      <div class="grid2 keep"><button class="btn" data-a="accept-wa" data-id="${id}">Aceptó por WhatsApp</button><button class="btn" data-a="reject" data-id="${id}">No lo quiere</button></div>`;
    if (j.estado === 'aceptado') acts = `<button class="btn primary block" data-a="invoice" data-id="${id}">Trabajo terminado: hacer factura</button><button class="btn block" data-a="payjob" data-id="${id}">Cobrar ya ${eur(t.total)}</button>`;
    if (j.estado === 'facturado') acts = `<button class="btn ok block" data-a="payjob" data-id="${id}">Cobrar ${eur(pendiente(j))}</button><button class="btn block" data-a="wa-fac" data-id="${id}">${ICON.wa}Enviar factura por WhatsApp</button>`;
    if (j.estado === 'rechazado') acts = `<button class="btn block" data-a="reopen" data-id="${id}">Volver a abrir el presupuesto</button>`;
    return {
      title:j.numFactura || j.numPresupuesto || 'Trabajo',
      right:!j.numFactura ? `<button class="iconbtn" data-a="editjob" data-id="${id}" aria-label="Editar">${ICON.edit}</button>` : '',
      body:`
        <div class="card stack" style="gap:10px">
          <div class="row">${plate(v.matricula || j.matricula, true)}<div class="grow"></div>${pill(j.estado)}</div>
          <button class="row" data-a="${j.vehiculoId ? 'veh' : 'noop'}" data-id="${j.vehiculoId || ''}" style="border:0;background:none;padding:0;text-align:left;cursor:pointer"><div class="grow"><div style="font-weight:700;font-size:18px">${esc(c.nombre)} ${j.ejemplo ? '<span class="ex">ejemplo</span>' : ''}</div><div class="muted small">${esc(carName(v))}${j.km ? ' · ' + Number(j.km).toLocaleString('es-ES') + ' km' : ''}${c.telefono ? ' · ' + esc(c.telefono) : ''}</div></div>${ICON.chevR}</button>
          ${j.averia ? `<div class="small"><span class="muted">Avería:</span> ${esc(j.averia)}</div>` : ''}
          <div><div class="steps">${[1, 2, 3, 4].map(k => `<div class="step ${k <= st ? 'on' : ''}"></div>`).join('')}</div><div class="steps-l"><span>Presupuesto</span><span>Aceptado</span><span>Factura</span><span>Cobrado</span></div></div>
        </div>
        ${acts}
        <div class="list">${j.lineas.map(l => `<div class="item static"><div class="grow"><div class="t" style="white-space:normal">${esc(l.desc || TIPOS[l.tipo])}</div><div class="s">${TIPOS[l.tipo]} · ${String(l.cant).replace('.', ',')} ${l.tipo === 'mo' ? 'h' : 'ud'} × ${eur(l.precio)}</div></div><div class="amt num" style="font-size:18px">${eur(l.cant * l.precio)}</div></div>`).join('')}</div>
        <div class="card"><div class="totals">${t.dto ? `<span class="muted">Importe</span><span>${eur(t.bruto)}</span><span class="muted">Descuento ${esc(j.descuento.codigo)}</span><span class="pos">− ${eur(t.dto)}</span>` : ''}<span class="muted">Base</span><span>${eur(t.base)}</span><span class="muted">IVA ${t.iva} %</span><span>${eur(t.cuota)}</span><b style="align-self:end">Total</b><span class="big">${eur(t.total)}</span>${pagado(j) ? `<span class="muted">Pagado</span><span class="pos">${eur(pagado(j))}</span><b>Pendiente</b><b>${eur(pendiente(j))}</b>` : ''}</div></div>
        ${(j.pagos || []).length ? `<div class="card">${j.pagos.map(p => `<div class="kv"><span>${fdate(p.fecha)} · ${esc(METODOS[p.metodo] || p.metodo)}</span><span class="v pos">${eur(p.importe)}</span></div>`).join('')}</div>` : ''}
        ${jobExtras(j)}
        ${j.firma ? `<div class="card stack" style="gap:6px"><div class="eyebrow">Firma de aceptación</div><img src="${j.firma}" alt="Firma del cliente" style="background:#fff;border-radius:8px;max-height:120px;object-fit:contain"><div class="muted small">${esc(j.aceptadoNombre || c.nombre)} · ${fdate(j.aceptadoFecha)}</div></div>` : j.aceptadoFecha ? `<div class="muted small">Aceptado por WhatsApp o teléfono el ${fdate(j.aceptadoFecha)}.</div>` : ''}
        <div class="grid2 keep"><button class="btn" data-a="doc" data-id="${id}:P">Ver presupuesto</button>${j.numFactura ? `<button class="btn" data-a="doc" data-id="${id}:F">Ver factura</button>` : `<button class="btn" data-a="newcitajob" data-id="${id}">${ICON.cal}Dar cita</button>`}</div>
        ${!j.numFactura ? `<button class="btn danger block" data-a="deljob" data-id="${id}">Borrar presupuesto</button>` : `<div class="muted tiny">Una factura emitida no se borra. Si hay un error, tu gestor hace una factura rectificativa.</div>`}`
    };
  }});
}
function waLink(tel, text) { let d = digits(tel); if (d.length === 9) d = '34' + d; return 'https://wa.me/' + d + '?text=' + encodeURIComponent(text); }
function openURL(url) { const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); }
function presText(j) {
  const c = cliOf(j), v = vehOf(j), t = totals(j);
  const lines = j.lineas.map(l => `• ${l.desc || TIPOS[l.tipo]}: ${eur(l.cant * l.precio)}`).join('\n');
  return `Hola ${c.nombre || ''}, soy ${S.cfg.propietario} de ${S.cfg.taller}.\nPresupuesto ${j.numPresupuesto} para su ${carName(v) || 'vehículo'} (${showPlate(v.matricula || j.matricula)}):\n${lines}\nBase ${eur(t.base)} + IVA ${t.iva} % ${eur(t.cuota)}\n*Total: ${eur(t.total)}*\nVálido ${S.cfg.validez} días. Si le parece bien, responda *ACEPTO* y nos ponemos con ello.`;
}

let sigDirty = false;
function signSheet(id) {
  const j = byId(id); const c = cliOf(j);
  openSheet({live:false, render:() => ({title:'Firma del cliente', body:`
    <div class="card stack" style="gap:6px"><div class="muted small">${esc(j.numPresupuesto)}</div><div class="amount" style="font-size:40px;text-align:left">${eur(totals(j).total)}</div><div class="small">Acepto el presupuesto y autorizo la reparación de mi vehículo ${esc(showPlate(j.matricula))} por el importe indicado (IVA incluido).</div></div>
    <label class="f">Nombre de quien firma<input class="in" id="sg-name" value="${esc(c.nombre || '')}"></label>
    <div><div class="row" style="margin-bottom:6px"><b class="grow">Firme con el dedo</b><button class="btn sm" data-a="sigclear">Borrar</button></div><canvas class="sig" id="sig"></canvas></div>`,
    foot:`<button class="btn primary block" data-a="sigok" data-id="${id}">Confirmar aceptación</button>`}), after:initSig});
}
function initSig() {
  const cv = $('#sig'); const dpr = window.devicePixelRatio || 1; const rect = cv.getBoundingClientRect();
  cv.width = rect.width * dpr; cv.height = rect.height * dpr;
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr); ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0B2A66';
  sigDirty = false; let drawing = false;
  const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', e => { drawing = true; cv.setPointerCapture(e.pointerId); const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); });
  cv.addEventListener('pointermove', e => { if (!drawing) return; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); sigDirty = true; });
  ['pointerup', 'pointercancel'].forEach(ev => cv.addEventListener(ev, () => drawing = false));
}
function sigData() {
  const cv = $('#sig'); const out = document.createElement('canvas'); out.width = 480; out.height = Math.round(480 * cv.height / cv.width);
  const x = out.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, out.width, out.height); x.drawImage(cv, 0, 0, out.width, out.height);
  return out.toDataURL('image/jpeg', 0.7);
}
function invoiceSheet(id) {
  const j = byId(id); const c = byId(j.clienteId) || {};
  openSheet({live:false, render:() => ({title:'Hacer factura', body:`
    <div class="note">Se creará la factura <b>${esc(nextNum('F'))}</b> con fecha de hoy por <b>${eur(totals(j).total)}</b>. Revisa antes las líneas: una factura no se puede borrar.</div>
    <div class="card stack"><div class="eyebrow">Cliente en la factura</div>
    <label class="f">Nombre o empresa<input class="in" id="fx-nombre" value="${esc(c.nombre || j.clienteNombre || '')}"></label>
    <label class="f">NIF / DNI <span class="h">Obligatorio si es empresa o autónomo, o si el cliente lo pide</span><input class="in" id="fx-nif" value="${esc(c.nif || '')}" autocapitalize="characters"></label>
    <label class="f">Dirección<input class="in" id="fx-dir" value="${esc(c.direccion || '')}" placeholder="Calle, número, CP y población"></label></div>
    ${!S.cfg.nif ? `<div class="note warn small">Faltan tu NIF y tu dirección en Ajustes. Sin ellos la factura no es válida.</div>` : ''}`,
    foot:`<button class="btn primary block" data-a="invok" data-id="${id}">Crear factura</button>`})});
}

/* ---------- Documento y PDF ---------- */
function docHTML(j, kind) {
  const c = byId(j.clienteId) || {nombre:j.clienteNombre}; const v = vehOf(j); const t = totals(j); const cf = S.cfg; const isF = kind === 'F';
  const fc = isF && j.facturaCliente ? j.facturaCliente : c;
  const title = j.simplificada ? 'Factura simplificada' : isF ? 'Factura' : 'Presupuesto';
  return `<div class="doc">
    <div class="dh"><div class="row" style="align-items:flex-start"><img src="icons/logo.svg" alt="" width="48" height="48"><div><b style="font-size:15px">${esc(cf.taller)}</b><br>${esc(cf.propietario)}${cf.nif ? ' · NIF ' + esc(cf.nif) : ''}<br>${esc(cf.direccion)}${cf.direccion ? '<br>' : ''}${esc(cf.poblacion)}<br>${esc([cf.telefono, cf.email].filter(Boolean).join(' · '))}</div></div>
    <div style="text-align:right"><div class="dt">${title}</div><div>Nº <b>${esc(isF ? j.numFactura : j.numPresupuesto)}</b></div><div>Fecha: ${fdate(isF ? j.fechaFactura : j.fecha)}</div></div></div>
    ${j.simplificada ? '' : `<div class="boxes"><div class="box"><div class="lbl">Cliente</div><b>${esc(fc.nombre)}</b>${fc.nif ? '<br>NIF ' + esc(fc.nif) : ''}${fc.direccion ? '<br>' + esc(fc.direccion) : ''}</div><div class="box"><div class="lbl">Vehículo</div><b>${esc(showPlate(v.matricula || j.matricula))}</b><br>${esc(carName(v))}${v.bastidor ? '<br>Bastidor ' + esc(v.bastidor) : ''}${j.km ? '<br>' + Number(j.km).toLocaleString('es-ES') + ' km' : ''}</div></div>`}
    <table><thead><tr><th>Concepto</th><th class="r">Cant.</th><th class="r">Precio</th><th class="r">Importe</th></tr></thead><tbody>${j.lineas.map(l => `<tr><td>${esc(l.desc || TIPOS[l.tipo])}</td><td class="r">${String(l.cant).replace('.', ',')}${l.tipo === 'mo' ? ' h' : ''}</td><td class="r">${eur(j.totalFijo ? t.base : l.precio)}</td><td class="r">${eur(j.totalFijo ? t.base : l.cant * l.precio)}</td></tr>`).join('')}</tbody></table>
    <div class="tt">${t.dto ? `<div><span>Importe</span><span>${eur(t.bruto)}</span></div><div><span>Descuento ${esc(j.descuento.codigo)}</span><span>− ${eur(t.dto)}</span></div>` : ''}<div><span>Base imponible</span><span>${eur(t.base)}</span></div><div><span>IVA ${t.iva} %</span><span>${eur(t.cuota)}</span></div><div class="g"><span>Total</span><span>${eur(t.total)}</span></div></div>
    <div style="margin-top:14px;font-size:11.5px;color:#444">${isF ? ((j.pagos || []).length ? 'Pagado: ' + j.pagos.map(p => fdate(p.fecha) + ' ' + (METODOS[p.metodo] || '') + ' ' + eur(p.importe)).join(' · ') : (cf.iban ? 'Forma de pago: transferencia a ' + esc(cf.iban) + ' o tarjeta.' : '')) : 'Presupuesto válido ' + esc(cf.validez) + ' días.'}</div>
    ${j.mostrarGesto && gesto(j) ? `<div style="margin-top:10px;padding:8px 10px;border:1px dashed #0B3B8F;border-radius:6px;font-size:12px">Horas reales dedicadas: ${String(horasReales(j)).replace('.', ',')} h. Le cobramos ${String(horasCobradas(j)).replace('.', ',')} h: ${eur(gesto(j).valor)} de trabajo sin coste para usted.</div>` : ''}
    ${(j.fotos || []).length ? `<div class="lbl" style="margin-top:12px">Fotos del trabajo</div><div class="pgrid" style="margin-top:6px">${j.fotos.map(f => `<img class="pthumb" data-file="${f}" alt="Foto">`).join('')}</div>` : ''}
    ${!isF && j.firma ? `<div style="margin-top:10px"><div class="lbl">Aceptado por ${esc(j.aceptadoNombre || '')} · ${fdate(j.aceptadoFecha)}</div><img src="${j.firma}" alt="Firma" style="max-height:80px"></div>` : ''}
  </div>`;
}
function docSheet(id, kind) {
  openSheet({live:true, render:() => { const j = byId(id); return {
    title:(kind === 'F' ? (j.simplificada ? 'Ticket ' : 'Factura ') + j.numFactura : 'Presupuesto ' + j.numPresupuesto),
    body:docHTML(j, kind) + `<button class="btn primary block" data-a="pdf" data-id="${id}:${kind}">Descargar PDF</button><div class="muted tiny">El PDF se guarda en Descargas. Desde ahí lo adjuntas en WhatsApp o en un email.</div>`}; }});
}
let logoPng = null;
async function getLogo() {
  if (logoPng) return logoPng;
  const img = new Image(); img.src = 'icons/logo.svg';
  await new Promise(r => { img.onload = r; img.onerror = r; });
  const c = document.createElement('canvas'); c.width = c.height = 240;
  try { c.getContext('2d').drawImage(img, 0, 0, 240, 240); logoPng = c.toDataURL('image/png'); } catch (e) { logoPng = ''; }
  return logoPng;
}
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
async function makePDF(id, kind) {
  if (!window.jspdf) { toast('No se pudo preparar el PDF.'); return; }
  const j = byId(id); const c = byId(j.clienteId) || {nombre:j.clienteNombre}; const v = vehOf(j); const t = totals(j); const cf = S.cfg; const isF = kind === 'F';
  const fc = isF && j.facturaCliente ? j.facturaCliente : c;
  const doc = new window.jspdf.jsPDF({unit:'mm', format:'a4'}); const E = n => numES(n) + ' €';
  const BLUE = [11, 59, 143];
  doc.setFillColor(...BLUE); doc.rect(0, 0, 210, 6, 'F'); doc.setFillColor(255, 255, 255); doc.rect(0, 2, 210, 0.8, 'F');
  const lg = await getLogo(); if (lg) doc.addImage(lg, 'PNG', 15, 12, 22, 22);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(cf.taller || '', 41, 17);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  [cf.propietario + (cf.nif ? ' · NIF ' + cf.nif : ''), cf.direccion, cf.poblacion, [cf.telefono, cf.email].filter(Boolean).join(' · ')].filter(Boolean).forEach((l, i) => doc.text(l, 41, 22 + i * 4.2));
  doc.setTextColor(...BLUE); doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(j.simplificada ? 14 : 20);
  doc.text(j.simplificada ? 'FACTURA SIMPLIFICADA' : isF ? 'FACTURA' : 'PRESUPUESTO', 195, 18, {align:'right'}); doc.setTextColor(0);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text('Nº ' + (isF ? j.numFactura : j.numPresupuesto), 195, 24, {align:'right'}); doc.text('Fecha: ' + fdate(isF ? j.fechaFactura : j.fecha), 195, 29, {align:'right'});
  let y = 44;
  if (!j.simplificada) {
    doc.setDrawColor(190); doc.roundedRect(15, 40, 88, 28, 2, 2); doc.roundedRect(107, 40, 88, 28, 2, 2);
    doc.setFontSize(7.5); doc.setTextColor(110); doc.text('CLIENTE', 19, 45); doc.text('VEHÍCULO', 111, 45); doc.setTextColor(0);
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text(String(fc.nombre || ''), 19, 50.5); doc.text(showPlate(v.matricula || j.matricula), 111, 50.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    [fc.nif ? 'NIF ' + fc.nif : '', fc.direccion || ''].filter(Boolean).forEach((l, i) => doc.text(doc.splitTextToSize(l, 80)[0], 19, 55.5 + i * 4.5));
    [carName(v), v.bastidor ? 'Bastidor ' + v.bastidor : '', j.km ? Number(j.km).toLocaleString('es-ES') + ' km' : ''].filter(Boolean).forEach((l, i) => doc.text(l, 111, 55.5 + i * 4.5));
    y = 78;
  }
  const head = () => { doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text('CONCEPTO', 15, y); doc.text('CANT.', 135, y, {align:'right'}); doc.text('PRECIO', 162, y, {align:'right'}); doc.text('IMPORTE', 195, y, {align:'right'}); doc.setLineWidth(0.6); doc.setDrawColor(...BLUE); doc.line(15, y + 2, 195, y + 2); y += 7; doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); };
  head();
  j.lineas.forEach(l => {
    const d = doc.splitTextToSize(l.desc || TIPOS[l.tipo], 110);
    if (y + d.length * 4.5 > 262) { doc.addPage(); y = 20; head(); }
    const unit = j.totalFijo ? t.base : l.precio, imp = j.totalFijo ? t.base : l.cant * l.precio;
    doc.text(d, 15, y); doc.text(String(l.cant).replace('.', ',') + (l.tipo === 'mo' ? ' h' : ''), 135, y, {align:'right'});
    doc.text(E(unit), 162, y, {align:'right'}); doc.text(E(imp), 195, y, {align:'right'});
    y += d.length * 4.5 + 2; doc.setDrawColor(220); doc.setLineWidth(0.2); doc.line(15, y - 2.5, 195, y - 2.5);
  });
  if (y > 240) { doc.addPage(); y = 20; }
  y += 4; doc.setFontSize(10);
  if (t.dto) { doc.text('Importe', 140, y); doc.text(E(t.bruto), 195, y, {align:'right'}); y += 5.5; doc.text('Descuento ' + j.descuento.codigo, 140, y); doc.text('- ' + E(t.dto), 195, y, {align:'right'}); y += 5.5; }
  doc.text('Base imponible', 140, y); doc.text(E(t.base), 195, y, {align:'right'}); y += 5.5;
  doc.text('IVA ' + t.iva + ' %', 140, y); doc.text(E(t.cuota), 195, y, {align:'right'}); y += 3;
  doc.setLineWidth(0.7); doc.setDrawColor(...BLUE); doc.line(140, y, 195, y); y += 6;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('TOTAL', 140, y); doc.text(E(t.total), 195, y, {align:'right'});
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(70);
  const foot = isF ? ((j.pagos || []).length ? 'Pagado: ' + j.pagos.map(p => fdate(p.fecha) + ' ' + (METODOS[p.metodo] || '') + ' ' + E(p.importe)).join(' · ') : (cf.iban ? 'Forma de pago: transferencia a ' + cf.iban + ' o tarjeta.' : '')) : 'Presupuesto válido ' + cf.validez + ' días.';
  doc.text(doc.splitTextToSize(foot, 180), 15, y + 12);
  if (j.mostrarGesto && gesto(j)) { y += 6; doc.setTextColor(11, 59, 143); doc.text('Horas reales dedicadas: ' + String(horasReales(j)).replace('.', ',') + ' h. Le cobramos ' + String(horasCobradas(j)).replace('.', ',') + ' h: ' + E(gesto(j).valor) + ' de trabajo sin coste para usted.', 15, y + 12); doc.setTextColor(70); }
  if (!isF && j.firma) { doc.text('Aceptado por ' + (j.aceptadoNombre || '') + ' el ' + fdate(j.aceptadoFecha), 15, y + 20); try { doc.addImage(j.firma, 'JPEG', 15, y + 22, 50, 18); } catch (e) {} }
  const name = (j.simplificada ? 'Ticket_' + j.numFactura : isF ? 'Factura_' + j.numFactura : 'Presupuesto_' + j.numPresupuesto) + (j.matricula ? '_' + normPlate(j.matricula) : '') + '.pdf';
  if ((j.fotos || []).length) {
    doc.addPage(); doc.setTextColor(0); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('Fotos del trabajo · ' + (isF ? j.numFactura : j.numPresupuesto), 15, 20);
    let px = 15, py = 28;
    for (const f of j.fotos.slice(0, 6)) {
      const b = await Store.getFile(f); if (!b) continue;
      const url = await blobToData(b); const im = new Image(); im.src = url; await new Promise(r => { im.onload = r; im.onerror = r; });
      const w = 88, h = Math.min(75, w * (im.height || 3) / (im.width || 4));
      try { doc.addImage(url, 'JPEG', px, py, w, h); } catch (e) {}
      if (px === 15) px = 107; else { px = 15; py += 80; }
    }
  }
  saveBlob(doc.output('blob'), name);
}

/* ---------- Clientes ---------- */
function openCli(id) {
  openSheet({live:true, render:() => {
    const c = byId(id); if (!c) return {title:'Cliente', body:'<div class="muted">Este cliente ya no existe.</div>'};
    const vs = S.vehiculos.filter(v => v.clienteId === id); const js = S.trabajos.filter(j => j.clienteId === id);
    const total = js.filter(j => j.numFactura).reduce((s, j) => s + totals(j).total, 0);
    const deuda = js.filter(j => j.estado === 'facturado').reduce((s, j) => s + pendiente(j), 0);
    return {title:c.nombre, right:`<button class="iconbtn" data-a="editcli" data-id="${id}" aria-label="Editar cliente">${ICON.edit}</button>`, body:`
      <div class="card stack" style="gap:6px">
        <div class="row"><div class="grow"><div class="muted small">Teléfono</div><div style="font-weight:700;font-size:18px" class="num">${esc(c.telefono || '—')}</div></div>${c.telefono ? `<button class="btn sm" data-a="wa-cli" data-id="${id}">${ICON.wa}WhatsApp</button>` : ''}</div>
        ${c.nif ? `<div class="small"><span class="muted">NIF:</span> ${esc(c.nif)}</div>` : ''}${c.direccion ? `<div class="small"><span class="muted">Dirección:</span> ${esc(c.direccion)}</div>` : ''}${c.email ? `<div class="small"><span class="muted">Email:</span> ${esc(c.email)}</div>` : ''}
        <div class="small"><span class="muted">Facturado:</span> <b class="num">${eur(total)}</b>${deuda ? ` · <span class="neg">debe ${eur(deuda)}</span>` : ''}</div>
        ${c.notas ? `<div class="small" style="white-space:pre-wrap"><span class="muted">Notas:</span> ${esc(c.notas)}</div>` : ''}</div>
      ${deudaCard(id)}
      <div class="card stack" style="gap:8px"><div class="eyebrow">Fotos de la ficha</div>${photoGrid('cliente', id, c.fotos)}</div>
      <div class="section-h"><h2>Coches</h2><button class="btn sm" data-a="newveh" data-id="${id}">${ICON.plus}Coche</button></div>
      <div class="list">${vs.map(v => `<button class="item" data-a="veh" data-id="${v.id}">${plate(v.matricula)}<div class="grow"><div class="t">${esc(carName(v) || 'Sin modelo')}</div><div class="s">${S.trabajos.filter(j => j.vehiculoId === v.id).length} trabajos${v.km ? ' · ' + Number(v.km).toLocaleString('es-ES') + ' km' : ''}</div></div>${ICON.chevR}</button>`).join('') || '<div class="item static muted">Sin coches.</div>'}</div>
      <div class="grid2 keep"><button class="btn primary" data-a="newjobcli" data-id="${id}">${ICON.plus}Presupuesto</button><button class="btn" data-a="newcitacli" data-id="${id}">${ICON.cal}Cita</button></div>
      <div class="section-h"><h2>Historial</h2></div>
      ${js.length ? `<div class="list">${js.map(jobItem).join('')}</div>` : '<div class="muted small">Sin trabajos.</div>'}
      <button class="btn danger block" data-a="delcli" data-id="${id}">Eliminar este cliente</button>`};
  }});
}
function cliForm(id) {
  const c = id ? byId(id) : {nombre:'', telefono:'', nif:'', direccion:'', email:'', notas:''};
  openSheet({live:false, render:() => ({title:id ? 'Editar cliente' : 'Nuevo cliente', body:`
    <label class="f">Nombre o empresa<input class="in" id="cf-nombre" value="${esc(c.nombre)}"></label>
    <label class="f">Teléfono (WhatsApp)<input class="in" id="cf-tel" type="tel" inputmode="tel" value="${esc(c.telefono)}"></label>
    <div class="grid2"><label class="f">NIF / DNI<input class="in" id="cf-nif" value="${esc(c.nif)}" autocapitalize="characters"></label><label class="f">Email<input class="in" id="cf-email" type="email" value="${esc(c.email)}"></label></div>
    <label class="f">Dirección<input class="in" id="cf-dir" value="${esc(c.direccion)}"></label>
    <label class="f">Notas <span class="h">Lo que quieras recordar: cómo prefiere que le avisen, descuentos…</span><textarea class="in" id="cf-notas">${esc(c.notas || '')}</textarea></label>
    ${!id ? `<div class="card stack"><div class="eyebrow">Su coche (opcional)</div><div class="grid2"><label class="f">Matrícula<input class="in plate-in" id="cf-mat" placeholder="1234 ABC" autocapitalize="characters"></label><label class="f">Marca y modelo<input class="in" id="cf-mod"></label></div></div>` : ''}`,
    foot:`${id ? `<button class="btn danger" data-a="delcli" data-id="${id}">Borrar</button>` : ''}<button class="btn primary block" data-a="savecli" data-id="${id || ''}">Guardar cliente</button>`})});
}

/* ---------- Vehículos ---------- */
function openVeh(id) {
  openSheet({live:true, render:() => {
    const v = byId(id); if (!v) return {title:'Coche', body:'<div class="muted">Este coche ya no existe.</div>'};
    const c = byId(v.clienteId) || {}; const js = S.trabajos.filter(j => j.vehiculoId === id);
    const row = (k, val) => val ? `<div class="kv"><span class="muted">${k}</span><span class="v">${esc(val)}</span></div>` : '';
    return {title:showPlate(v.matricula), right:`<button class="iconbtn" data-a="editveh" data-id="${id}" aria-label="Editar coche">${ICON.edit}</button>`, body:`
      <div class="card stack" style="gap:8px"><div class="row">${plate(v.matricula, true)}</div><div style="font-weight:700;font-size:19px">${esc(carName(v) || 'Modelo sin rellenar')}</div>
        <div>${row('Bastidor', v.bastidor)}${row('Año', v.anio)}${row('Combustible', v.combustible)}${row('Motor', [v.cilindrada ? v.cilindrada + ' cc' : '', v.potencia ? v.potencia + ' CV' : ''].filter(Boolean).join(' · '))}${row('Color', v.color)}${row('Kilómetros', v.km ? Number(v.km).toLocaleString('es-ES') + ' km' : '')}${row('Origen de los datos', v.fuente)}</div></div>
      <button class="item card" data-a="cli" data-id="${c.id || ''}" style="border-radius:var(--r)"><div class="grow"><div class="muted small">Cliente</div><div class="t">${esc(c.nombre || 'Sin cliente')}</div><div class="s">${esc(c.telefono || '')}</div></div>${ICON.chevR}</button>
      <div class="grid2 keep"><button class="btn" data-a="vinlookup" data-id="${id}">Leer bastidor</button><button class="btn" data-a="platelookup" data-id="${id}">Datos por matrícula</button></div>
      <div class="grid2 keep"><button class="btn primary" data-a="newjobveh" data-id="${id}">${ICON.plus}Presupuesto</button><button class="btn" data-a="newcitaveh" data-id="${id}">${ICON.cal}Cita</button></div>
      <div class="card stack" style="gap:8px"><div class="eyebrow">Fotos del coche</div>${photoGrid('vehiculo', id, v.fotos)}</div>
      <div class="section-h"><h2>Historial del coche</h2></div>
      ${js.length ? `<div class="list">${js.map(jobItem).join('')}</div>` : '<div class="muted small">Sin trabajos todavía.</div>'}`};
  }});
}
function vehForm(id, clienteId) {
  const v = id ? byId(id) : {matricula:'', bastidor:'', marca:'', modelo:'', version:'', combustible:'', anio:'', potencia:'', cilindrada:'', color:'', km:'', clienteId};
  openSheet({live:false, render:() => ({title:id ? 'Editar coche' : 'Nuevo coche', body:`
    <label class="f">Matrícula<input class="in plate-in" id="vf-mat" value="${esc(showPlate(v.matricula))}" autocapitalize="characters"></label>
    <label class="f">Nº de bastidor (VIN)<input class="in vin" id="vf-vin" maxlength="17" value="${esc(v.bastidor)}" placeholder="17 caracteres"></label>
    <div class="grid2"><label class="f">Marca<input class="in" id="vf-marca" value="${esc(v.marca)}"></label><label class="f">Modelo<input class="in" id="vf-modelo" value="${esc(v.modelo)}"></label></div>
    <div class="grid2"><label class="f">Versión<input class="in" id="vf-version" value="${esc(v.version)}" placeholder="1.6 TDI 115 CV"></label><label class="f">Combustible<select class="in" id="vf-comb">${COMB.map(c => `<option ${c === v.combustible ? 'selected' : ''}>${c}</option>`).join('')}</select></label></div>
    <div class="grid3"><label class="f">Año<input class="in num" id="vf-anio" inputmode="numeric" value="${esc(v.anio)}"></label><label class="f">CV<input class="in num" id="vf-cv" inputmode="numeric" value="${esc(v.potencia)}"></label><label class="f">cc<input class="in num" id="vf-cc" inputmode="numeric" value="${esc(v.cilindrada)}"></label></div>
    <div class="grid2"><label class="f">Color<input class="in" id="vf-color" value="${esc(v.color)}"></label><label class="f">Kilómetros<input class="in num" id="vf-km" inputmode="numeric" value="${esc(v.km)}"></label></div>
    <label class="f">Cliente<select class="in" id="vf-cli"><option value="">— Sin cliente —</option>${S.clientes.map(c => `<option value="${c.id}" ${c.id === v.clienteId ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></label>`,
    foot:`${id ? `<button class="btn danger" data-a="delveh" data-id="${id}">Borrar</button>` : ''}<button class="btn primary block" data-a="saveveh" data-id="${id || ''}">Guardar coche</button>`})});
}

/* Bastidor: fabricante (WMI) y año de modelo sin conexión */
const WMI = {VSS:'Seat',VSE:'Suzuki',VS6:'Ford',VS7:'Citroën',VSK:'Nissan',VSX:'Opel',VSY:'Renault',VF1:'Renault',VF3:'Peugeot',VF7:'Citroën',VF8:'Matra',VR1:'DS',VR3:'Peugeot',VR7:'Citroën',VNK:'Toyota',VNV:'Nissan',UU1:'Dacia',UU6:'Dacia',WVW:'Volkswagen',WV1:'Volkswagen Comerciales',WV2:'Volkswagen Comerciales',WVG:'Volkswagen',WAU:'Audi',WUA:'Audi',WBA:'BMW',WBS:'BMW M',WBY:'BMW i',WMW:'MINI',WDB:'Mercedes-Benz',WDD:'Mercedes-Benz',WDC:'Mercedes-Benz',WDF:'Mercedes-Benz',W1K:'Mercedes-Benz',W1N:'Mercedes-Benz',W1V:'Mercedes-Benz',WME:'smart',W0L:'Opel',W0V:'Opel',WF0:'Ford',WP0:'Porsche',WP1:'Porsche',TMB:'Škoda',TMA:'Hyundai',TMP:'Škoda',TRU:'Audi',ZFA:'Fiat',ZFC:'Fiat',ZAR:'Alfa Romeo',ZLA:'Lancia',ZCF:'Iveco',ZFF:'Ferrari',ZHW:'Lamborghini',ZAM:'Maserati',YV1:'Volvo',YV4:'Volvo',YS3:'Saab',SAL:'Land Rover',SAJ:'Jaguar',SCC:'Lotus',SJN:'Nissan',SB1:'Toyota',SHH:'Honda',SHS:'Honda',SMT:'Triumph',TSM:'Suzuki',JTD:'Toyota',JTE:'Toyota',JTN:'Toyota',JTM:'Toyota',JTH:'Lexus',NMT:'Toyota',JN1:'Nissan',JN8:'Nissan',JMZ:'Mazda',JM1:'Mazda',JHM:'Honda',JHL:'Honda',JMB:'Mitsubishi',JMY:'Mitsubishi',JSA:'Suzuki',JS2:'Suzuki',JF1:'Subaru',JF2:'Subaru',KNA:'Kia',KNE:'Kia',KMH:'Hyundai',KMF:'Hyundai',U5Y:'Kia',U6Y:'Kia',MAL:'Hyundai',MA3:'Suzuki',NM0:'Ford',NLH:'Hyundai',LRW:'Tesla',XP7:'Tesla','5YJ':'Tesla','7SA':'Tesla',LSJ:'MG',LVV:'Chery',LGX:'BYD',SFA:'Ford',XMC:'Mitsubishi',VWV:'Volkswagen',VSA:'Mercedes-Benz',VR2:'Opel',VXK:'Opel',VXE:'Opel',W1W:'Mercedes-Benz',WAP:'Alpina'};
const VIN_YEAR = 'ABCDEFGHJKLMNPRSTVWXY123456789';
function decodeVinOffline(vin) {
  vin = normPlate(vin); const out = {};
  if (vin.length < 3) return out;
  out.marca = WMI[vin.slice(0, 3)] || WMI[vin.slice(0, 2) + '0'] || '';
  if (vin.length === 17) {
    const c = vin[9]; const i = VIN_YEAR.indexOf(c);
    if (i >= 0) { const base = 1980 + i; const cand = [base, base + 30].filter(y => y <= new Date().getFullYear() + 1); out.anio = String(cand[cand.length - 1] || ''); }
    out.valido = !/[IOQ]/.test(vin);
  }
  return out;
}
async function vinLookup(id) {
  const v = byId(id); const vin = normPlate(v.bastidor);
  if (vin.length !== 17) { toast('Primero escribe el bastidor completo (17 caracteres).'); vehForm(id); return; }
  const off = decodeVinOffline(vin); const upd = {};
  if (off.marca && !v.marca) upd.marca = off.marca;
  if (off.anio && !v.anio) upd.anio = off.anio;
  let online = false;
  try {
    const r = await fetch('https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/' + vin + '?format=json');
    const d = (await r.json()).Results[0];
    const val = s => s && s !== 'Not Applicable' && s !== '0' ? s : '';
    if (val(d.Make) && !v.marca) upd.marca = d.Make.charAt(0) + d.Make.slice(1).toLowerCase();
    if (val(d.Model) && !v.modelo) upd.modelo = d.Model;
    if (val(d.ModelYear) && !v.anio) upd.anio = d.ModelYear;
    if (val(d.DisplacementCC) && !v.cilindrada) upd.cilindrada = String(Math.round(+d.DisplacementCC));
    if (val(d.EngineHP) && !v.potencia) upd.potencia = String(Math.round(+d.EngineHP * 1.014));
    if (val(d.FuelTypePrimary) && !v.combustible) upd.combustible = /diesel/i.test(d.FuelTypePrimary) ? 'Diésel' : /gasoline/i.test(d.FuelTypePrimary) ? 'Gasolina' : /electric/i.test(d.FuelTypePrimary) ? 'Eléctrico' : '';
    online = true;
  } catch (e) { /* sin conexión: solo datos locales */ }
  if (Object.keys(upd).length) { upd.fuente = online ? 'Bastidor (base de datos NHTSA)' : 'Bastidor (sin conexión)'; await Store.put(id, {...docs[id], ...upd}); toast('Datos del bastidor añadidos: ' + Object.keys(upd).filter(k => k !== 'fuente').length); }
  else toast(off.marca ? 'El bastidor no aporta datos nuevos.' : 'No se reconoce este fabricante. Revisa el bastidor.');
}
async function plateLookup(id) {
  const v = byId(id); const user = (S.cfg.regcheck || '').trim();
  if (!user) {
    openSheet({live:false, render:() => ({title:'Datos por matrícula', body:`<div class="note">La DGT no ofrece una consulta gratuita y abierta de datos por matrícula. Para rellenar marca, modelo, motor y año automáticamente hace falta un servicio de pago por consulta.</div>
      <div class="card stack small"><b>Cómo activarlo</b><div>1. Crea una cuenta en el servicio de consulta de matrículas españolas (RegCheck / CarRegistrationAPI).</div><div>2. Pega tu nombre de usuario en Ajustes → Datos de vehículos.</div><div>3. Funciona con la app instalada en el móvil.</div></div>
      <div class="muted small">Mientras tanto: el bastidor (en la ficha técnica o el parabrisas) da marca y año sin coste con «Leer bastidor».</div>`})});
    return;
  }
  toast('Consultando la matrícula…');
  try {
    const r = await fetch('https://www.regcheck.org.uk/api/reg.asmx/CheckSpain?RegistrationNumber=' + encodeURIComponent(normPlate(v.matricula)) + '&username=' + encodeURIComponent(user));
    const xml = await r.text(); const m = xml.match(/<vehicleJson>([\s\S]*?)<\/vehicleJson>/);
    if (!m) throw new Error('sin datos');
    const txt = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    const d = JSON.parse(txt);
    const cur = o => o && (o.CurrentTextValue || o.CurrentValue) || '';
    const upd = {marca:cur(d.CarMake) || d.MakeDescription && cur(d.MakeDescription) || v.marca, modelo:cur(d.CarModel) || d.ModelDescription && cur(d.ModelDescription) || v.modelo, version:d.Variation || d.Variant || v.version || '', anio:String(d.RegistrationYear || v.anio || ''), cilindrada:String(d.EngineSize && cur(d.EngineSize) || d.EngineSize || v.cilindrada || ''), combustible:/diesel|di[eé]sel/i.test(d.Fuel || '') ? 'Diésel' : /gas/i.test(d.Fuel || '') ? 'Gasolina' : (v.combustible || ''), potencia:String(d.DynamicPower || v.potencia || '').replace(/\D/g, ''), bastidor:v.bastidor || d.VIN || '', fuente:'Consulta por matrícula'};
    await Store.put(id, {...docs[id], ...upd}); toast('Datos del coche añadidos');
  } catch (e) { toast('No se pudo consultar. Comprueba el usuario del servicio y la conexión.'); }
}

/* ---------- Citas ---------- */
function citaForm(id, preset) {
  const c = id ? byId(id) : {fecha:agendaDay < todayISO() ? todayISO() : agendaDay, hora:'', duracion:S.cfg.hueco || 60, nombre:'', telefono:'', matricula:'', motivo:'', estado:'pendiente', ...(preset || {})};
  if (!c.hora) { const f = freeSlots(c.fecha, 1, 1)[0]; c.hora = f ? f.hora : '09:00'; }
  openSheet({live:false, render:() => ({title:id ? 'Cita' : 'Nueva cita', body:`
    <div class="grid2 keep"><label class="f">Día<input class="in" id="ct-fecha" type="date" value="${esc(c.fecha)}"></label><label class="f">Hora<input class="in" id="ct-hora" type="time" step="900" value="${esc(c.hora)}"></label></div>
    <div id="ct-free"></div>
    <label class="f">Duración<select class="in" id="ct-dur">${[30, 60, 90, 120, 180, 240, 480].map(m => `<option value="${m}" ${+c.duracion === m ? 'selected' : ''}>${m < 60 ? m + ' min' : m / 60 + ' h'}${m === 480 ? ' (todo el día)' : ''}</option>`).join('')}</select></label>
    <label class="f">Matrícula<input class="in plate-in" id="ct-mat" value="${esc(showPlate(c.matricula))}" placeholder="1234 ABC" autocapitalize="characters"></label>
    <div class="grid2"><label class="f">Nombre<input class="in" id="ct-nombre" value="${esc(c.nombre)}"></label><label class="f">Teléfono<input class="in" id="ct-tel" type="tel" inputmode="tel" value="${esc(c.telefono)}"></label></div>
    <label class="f">Motivo<input class="in" id="ct-motivo" value="${esc(c.motivo)}" placeholder="Revisión, ITV, ruido al frenar…"></label>
    ${id ? `<div class="eyebrow">Estado</div><div class="seg">${Object.entries(CITA_EST).map(([k, v]) => `<button class="${c.estado === k ? 'on' : ''}" data-a="citaest" data-id="${id}:${k}">${v}</button>`).join('')}</div>
      <div class="grid2 keep">${c.telefono ? `<button class="btn" data-a="wa-cita" data-id="${id}">${ICON.wa}Confirmar por WhatsApp</button>` : ''}${c.trabajoId ? `<button class="btn" data-a="horas" data-id="${c.trabajoId}">Apuntar horas</button><button class="btn" data-a="job" data-id="${c.trabajoId}">Ver presupuesto</button>` : `<button class="btn primary" data-a="cita2job" data-id="${id}">Ha llegado: presupuesto</button>`}</div>` : ''}`,
    foot:`${id ? `<button class="btn danger" data-a="delcita" data-id="${id}">Borrar</button>` : ''}<button class="btn primary block" data-a="savecita" data-id="${id || ''}">Guardar cita</button>`}),
    after:() => {
      const showFree = () => { const iso = $('#ct-fecha').value; const fr = iso ? slotsOf(iso).filter(s => !s.busy) : []; $('#ct-free').innerHTML = fr.length ? `<div class="chips">${fr.map(s => `<button class="chip ${s.hora === $('#ct-hora').value ? 'on' : ''}" data-a="pickhora" data-id="${s.hora}">${s.hora}</button>`).join('')}</div>` : `<div class="muted small">${iso && !openRanges(iso).length ? 'Ese día el taller está cerrado.' : 'No quedan huecos libres ese día.'}</div>`; };
      showFree(); $('#ct-fecha').addEventListener('change', showFree); $('#ct-hora').addEventListener('change', showFree);
      $('#ct-mat').addEventListener('input', e => { const p = normPlate(e.target.value); const v = p.length >= 4 && S.vehiculos.find(x => normPlate(x.matricula) === p); if (v) { const cl = byId(v.clienteId) || {}; if (!$('#ct-nombre').value) $('#ct-nombre').value = cl.nombre || ''; if (!$('#ct-tel').value) $('#ct-tel').value = cl.telefono || ''; } });
    }, preset:c});
}
function ofrecerSheet() {
  const fr = freeSlots(todayISO(), 10, 6);
  const txt = fr.length ? `Hola, soy ${S.cfg.propietario} de ${S.cfg.taller}. Tengo libres estas horas:\n${fr.map(s => '• ' + longDate(s.iso) + ' a las ' + s.hora).join('\n')}\n¿Cuál le va mejor? Respóndame con la que quiera y se la reservo.` : '';
  openSheet({live:false, render:() => ({title:'Ofrecer huecos', body: fr.length ? `
    <div class="muted small">Estos son los próximos huecos libres según tu horario. Envía el mensaje y, cuando el cliente elija, crea la cita.</div>
    <textarea class="in" id="of-txt" style="min-height:200px">${esc(txt)}</textarea>
    <label class="f">Teléfono del cliente <span class="h">Opcional: si lo dejas vacío, eliges el contacto en WhatsApp</span><input class="in" id="of-tel" type="tel" inputmode="tel"></label>
    <button class="btn primary block" data-a="of-send">${ICON.wa}Enviar por WhatsApp</button><button class="btn block" data-a="of-copy">Copiar el texto</button>` : `<div class="card empty"><div class="muted">No hay huecos libres en los próximos 10 días. Revisa el horario en Ajustes.</div></div>`})});
}

/* ---------- Hacienda ---------- */
let repY = new Date().getFullYear(), repQ = Math.max(1, Math.floor(new Date().getMonth() / 3) + 1);
function haciendaSheet() {
  openSheet({live:true, render:() => {
    const r = report(repY, repQ); const m = r.m130; const t = todayISO(); const y = new Date().getFullYear();
    const evs = [...fiscalEvents(y), ...fiscalEvents(y + 1)].filter(e => e.fecha >= addDays(t, -45)).slice(0, 10);
    return {title:'Hacienda', body:`
      <div class="section-h"><h2>Calendario de impuestos</h2></div>
      <div class="list">${evs.map(e => { const d = daysTo(e.fecha); const done = (S.cfg.presentados || {})[e.key]; const dt = parseISO(e.fecha); return `<div class="deadline ${done ? 'done' : d >= 0 && d <= 15 ? 'soon' : ''}"><div class="dbox"><b>${dt.getDate()}</b><span>${MES[dt.getMonth()].slice(0, 3)}</span></div><div class="grow"><div style="font-weight:700">Modelo ${esc(e.modelos)}</div><div class="muted small">${esc(e.desc)}</div><div class="small">${done ? '<span class="pos">Presentado</span>' : d < 0 ? '<span class="neg">Plazo pasado</span>' : d === 0 ? '<b class="neg">Hoy es el último día</b>' : 'Quedan ' + d + ' días'}</div></div><button class="btn sm" data-a="presentado" data-id="${e.key}">${done ? 'Deshacer' : 'Hecho'}</button></div>`; }).join('')}</div>
      <div class="muted tiny">Si el gestor domicilia el pago, el plazo acaba 5 días antes. Los festivos pueden mover la fecha al siguiente día hábil.</div>
      <div class="section-h"><h2>Trimestre</h2></div>
      <div class="row wrapr"><div class="seg">${[1, 2, 3, 4].map(q => `<button class="${q === repQ ? 'on' : ''}" data-a="repq" data-id="${q}">${q}T</button>`).join('')}</div><div class="seg">${[y, y - 1].map(yy => `<button class="${yy === repY ? 'on' : ''}" data-a="repy" data-id="${yy}">${yy}</button>`).join('')}</div></div>
      <div class="model"><div class="model-h"><b>Modelo 303 · IVA</b><span class="small">${repQ}T ${repY}</span></div>
        ${Object.keys(r.repercutido).length ? Object.entries(r.repercutido).map(([k, v]) => `<div class="model-r"><span>Ventas al ${k} % · base</span><span>${eur(v.base)}</span></div><div class="model-r"><span>IVA cobrado a clientes</span><span>${eur(v.cuota)}</span></div>`).join('') : `<div class="model-r"><span>IVA cobrado a clientes</span><span>${eur(0)}</span></div>`}
        <div class="model-r"><span>Compras deducibles · base</span><span>${eur(r.sopBase)}</span></div><div class="model-r"><span>IVA pagado a proveedores</span><span>− ${eur(r.sopCuota)}</span></div>
        <div class="model-r res"><span>${r.res303 >= 0 ? 'A ingresar' : 'A compensar'}</span><span class="v">${eur(Math.abs(r.res303))}</span></div></div>
      <div class="model"><div class="model-h"><b>Modelo 130 · IRPF</b><span class="small">acumulado del año</span></div>
        <div class="model-r"><span>Ingresos</span><span>${eur(m.ing)}</span></div><div class="model-r"><span>Gastos deducibles</span><span>− ${eur(m.gas)}</span></div>
        <div class="model-r"><span>Rendimiento neto</span><span>${eur(m.rend)}</span></div><div class="model-r"><span>20 %</span><span>${eur(m.veinte)}</span></div>
        <div class="model-r"><span>Pagado en trimestres anteriores</span><span>− ${eur(m.anteriores)}</span></div>
        <div class="model-r res"><span>A ingresar</span><span class="v">${eur(m.pago)}</span></div></div>
      ${S.cfg.alquiler ? `<div class="model"><div class="model-h"><b>Modelo 115 · Alquiler</b><span class="small">${repQ}T</span></div><div class="model-r res"><span>Retención del 19 % sobre el alquiler</span><span class="v">${eur(r.ret115)}</span></div></div>` : ''}
      <div class="note warn small">Cálculo orientativo para estimación directa. Tu gestor lo revisa y aplica las deducciones que correspondan antes de presentar.</div>
      <div class="section-h"><h2>Para el gestor</h2></div>
      <div class="muted small">Tres archivos que abre cualquier Excel. Envíaselos por email o WhatsApp.</div>
      <button class="btn primary block" data-a="export" data-id="emitidas">Facturas emitidas ${repQ}T</button>
      <button class="btn block" data-a="export" data-id="recibidas">Facturas recibidas ${repQ}T</button>
      <button class="btn block" data-a="export" data-id="resumen">Resumen de modelos ${repQ}T</button>`};
  }});
}
function csv(rows) { return '﻿' + rows.map(r => r.map(c => { const s = typeof c === 'number' ? numES(c) : String(c ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\r\n'); }
function exportCSV(kind) {
  const r = report(repY, repQ); const tag = repY + '-' + repQ + 'T'; let rows, name;
  if (kind === 'emitidas') { name = 'facturas-emitidas-' + tag + '.csv'; rows = [['Fecha','Número','Tipo','Cliente','NIF cliente','Matrícula','Base','% IVA','Cuota IVA','Total','Cobrado','Forma de cobro']].concat(r.em.map(j => { const t = totals(j); const fc = j.facturaCliente || byId(j.clienteId) || {}; return [fdate(j.fechaFactura), j.numFactura, j.simplificada ? 'Simplificada' : 'Completa', fc.nombre || j.clienteNombre, fc.nif || '', showPlate(j.matricula), t.base, t.iva, t.cuota, t.total, pagado(j), (j.pagos || []).map(p => METODOS[p.metodo]).join(' + ')]; })); }
  else if (kind === 'recibidas') { name = 'facturas-recibidas-' + tag + '.csv'; rows = [['Fecha','Proveedor','NIF proveedor','Nº factura','Concepto','Categoría','Base','% IVA','Cuota IVA','Total','Deducible']].concat(r.re.map(g => [fdate(g.fecha), g.proveedor, g.nif, g.numero, g.concepto, g.categoria, +g.base || 0, +g.ivaPct || 0, +g.cuota || 0, +g.total || 0, g.deducible === false ? 'No' : 'Sí'])); }
  else { const m = r.m130; name = 'resumen-' + tag + '.csv'; rows = [['Concepto','Importe'],['Titular', S.cfg.propietario + ' · ' + (S.cfg.nif || 'NIF sin rellenar')],['Periodo', repQ + 'T ' + repY],['',''],['MODELO 303',''],...Object.entries(r.repercutido).flatMap(([k, v]) => [['Base imponible al ' + k + ' %', v.base],['Cuota repercutida al ' + k + ' %', v.cuota]]),['Base compras deducibles', r.sopBase],['Cuota soportada deducible', r.sopCuota],['Resultado 303', r.res303],['',''],['MODELO 130 (acumulado del año)',''],['Ingresos', m.ing],['Gastos deducibles', m.gas],['Rendimiento neto', m.rend],['20 % rendimiento', m.veinte],['Pagos trimestres anteriores', m.anteriores],['Resultado 130', m.pago],...(S.cfg.alquiler ? [['',''],['Retenciones alquiler (115)', r.ret115]] : []),['',''],['Nota','Cálculo orientativo preparado por la app. Revisar antes de presentar.']]; }
  saveBlob(new Blob([csv(rows)], {type:'text/csv;charset=utf-8'}), name);
}

function deudaCard(cliId) {
  const d = deudaDe(cliId);
  if (!d.rows.length && !(d.cfg && d.cfg.abierta)) return '';
  return `<div class="card stack" style="gap:6px"><div class="row"><div class="eyebrow grow">Cuenta deudora</div><button class="btn sm" data-a="deuda" data-id="${cliId}">${d.cfg && d.cfg.abierta ? 'Condiciones' : 'Abrir'}</button></div>
    ${d.rows.map(r => `<div class="kv"><span>${esc(r.j.numFactura)} · vence ${fdate(r.vence)}${r.tarde ? ' · <span class="neg">' + r.tarde + ' días tarde</span>' : ''}</span><span class="v">${eur(r.pend)}${r.int ? ' <span class="neg">+ ' + eur(r.int) + '</span>' : ''}</span></div>`).join('')}
    <div class="kv res"><span>Total a reclamar</span><span class="v">${eur(d.pend + d.int)}</span></div>
    ${d.cfg && d.cfg.abierta ? `<div class="muted tiny">Interés anual del ${String(d.cfg.interes).replace('.', ',')} % desde ${d.cfg.plazo} días después de cada factura.</div>` : `<div class="muted tiny">Abre la cuenta deudora para aplicar intereses por demora.</div>`}
    ${d.int ? `<button class="btn sm" data-a="cobrarint" data-id="${cliId}">Cobrar intereses (${eur(d.int)})</button>` : ''}</div>`;
}

/* ---------- Compras, gastos y lectura de facturas ---------- */
function gastosSheet() {
  openSheet({live:true, render:() => {
    const byMonth = {}; S.gastos.forEach(g => { const k = (g.fecha || '').slice(0, 7); (byMonth[k] = byMonth[k] || []).push(g); });
    const months = Object.keys(byMonth).sort().reverse();
    return {title:'Compras y gastos', body:`
      <div class="muted small">Cada factura de proveedor baja lo que pagas a Hacienda. Hazle una foto y la app lee los datos.</div>
      <div class="grid3"><button class="qa main" data-a="cam">${ICON.cam}Foto ahora</button><button class="qa" data-a="gal">${ICON.img}De la galería</button><button class="qa" data-a="newgasto">${ICON.edit}A mano</button></div>
      ${months.length ? months.map(m => { const arr = byMonth[m]; const tot = arr.reduce((s, g) => s + (+g.total || 0), 0); const [yy, mm] = m.split('-'); return `<div class="section-h"><h2>${MES[+mm - 1]} ${yy}</h2><span class="num muted">${eur(tot)}</span></div><div class="list">${arr.map(g => `<button class="item" data-a="gasto" data-id="${g.id}"><div class="grow"><div class="t">${esc(g.proveedor || 'Proveedor')} ${g.ejemplo ? '<span class="ex">ejemplo</span>' : ''}${g.fotoId ? ' <span class="ex">foto</span>' : ''}</div><div class="s">${fdate(g.fecha)} · ${esc(g.categoria || '')}${g.deducible === false ? ' · no deducible' : ''}</div></div><div class="amt num">${eur(g.total)}</div></button>`).join('')}</div>`; }).join('') : `<div class="card empty"><div class="muted">Aún no hay gastos apuntados.</div></div>`}`};
  }});
}
function photoMenu() {
  openSheet({live:false, render:() => ({title:'Foto', body:`
    <div class="eyebrow">Factura de un gasto</div>
    <div class="muted small">Proveedor de recambios, alquiler, suministros, seguros… La app lee proveedor, NIF, fecha, importes, IBAN y teléfono y la apunta en la contabilidad.</div>
    <div class="grid2 keep"><button class="btn primary" style="min-height:64px" data-a="cam">${ICON.cam}Foto ahora</button><button class="btn" style="min-height:64px" data-a="gal">${ICON.img}De la galería</button></div>
    <div class="note small">Para que se lea bien: factura plana, con buena luz y que ocupe toda la foto.</div>
    <div class="eyebrow" style="margin-top:8px">Foto del coche o de una pieza</div>
    <div class="muted small">Se une al trabajo del cliente y sale con su presupuesto y factura.</div>
    <button class="btn block" style="min-height:56px" data-a="photopick">${ICON.car}Elegir el trabajo y hacer la foto</button>`})});
}
async function compress(file, max = 1800, q = 0.82) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height);
    const color = await new Promise(res => c.toBlob(res, 'image/jpeg', q));
    // versión en grises con más contraste para leer el texto
    const d = x.getImageData(0, 0, c.width, c.height); const p = d.data;
    for (let i = 0; i < p.length; i += 4) { let g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; g = Math.max(0, Math.min(255, (g - 128) * 1.35 + 140)); p[i] = p[i + 1] = p[i + 2] = g; }
    x.putImageData(d, 0, 0);
    const gray = await new Promise(res => c.toBlob(res, 'image/png'));
    return {color, gray};
  } finally { URL.revokeObjectURL(url); }
}
let ocrWorker = null;
async function getOCR(onProgress) {
  if (ocrWorker) return ocrWorker;
  if (!window.Tesseract) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/tesseract/tesseract.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  const abs = p => new URL(p, location.href).href;
  ocrWorker = await window.Tesseract.createWorker('spa', 1, {
    workerPath:abs('vendor/tesseract/worker.min.js'), corePath:abs('vendor/tesseract/core'), langPath:abs('vendor/tesseract/lang'),
    gzip:true, workerBlobURL:false, logger:m => onProgress && onProgress(m)
  });
  return ocrWorker;
}
async function readPhoto(file) {
  let prog = 0;
  openSheet({live:false, render:() => ({title:'Leyendo la factura', body:`<div class="card empty"><div class="spin"></div><b id="ocr-msg">Preparando la foto…</b><div class="ocr-bar"><i id="ocr-bar"></i></div><div class="muted small">La primera vez tarda un poco más: prepara el lector de texto en el móvil.</div></div>`})});
  const msg = t => { const m = $('#ocr-msg'); if (m) m.textContent = t; };
  const bar = v => { const b = $('#ocr-bar'); if (b) b.style.width = Math.round(v * 100) + '%'; };
  let blobs;
  try { blobs = await compress(file); } catch (e) { closeSheet(); toast('No se pudo abrir la foto.'); return; }
  const fotoId = newId('f_'); let saved = false;
  try { saved = await Store.putFile(fotoId, blobs.color); } catch (e) {}
  let parsed = {};
  try {
    msg('Preparando el lector…');
    const w = await getOCR(m => { if (m.status === 'recognizing text') { msg('Leyendo el texto…'); bar(m.progress); } else if (m.progress !== undefined) { prog = m.progress; bar(prog * 0.3); } });
    msg('Leyendo el texto…');
    const {data} = await w.recognize(blobs.gray);
    parsed = parseInvoice(data.text || '');
    parsed._texto = data.text || '';
  } catch (e) {
    parsed = {_fallo:true};
  }
  closeSheet();
  gastoForm({fecha:parsed.fecha || todayISO(), proveedor:parsed.proveedor || '', nif:parsed.nif || '', numero:parsed.numero || '', concepto:'', categoria:parsed.categoria || 'Recambios', base:parsed.base || '', ivaPct:parsed.ivaPct || 21, cuota:parsed.cuota || '', total:parsed.total || '', deducible:true, fotoId:saved ? fotoId : '', _prov:{iban:parsed.iban || '', telefono:parsed.telefono || '', email:parsed.email || '', direccion:parsed.direccion || ''}}, parsed._fallo ? 'fallo' : 'ok');
}

/* Interpreta el texto de una factura española */
function parseInvoice(text) {
  const out = {}; const up = text.toUpperCase();
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const own = normPlate(S.cfg.nif);
  // NIF / CIF
  const nifRe = /\b(?:ES)?([A-HJ-NP-SUVW][\s.-]?\d{7}[\s.-]?[0-9A-J]|\d{8}[\s.-]?[A-Z]|[XYZ][\s.-]?\d{7}[\s.-]?[A-Z])\b/g;
  const nifs = []; let m;
  while ((m = nifRe.exec(up))) { const n = m[1].replace(/[\s.-]/g, ''); if (n !== own && !nifs.includes(n)) nifs.push({n, at:m.index}); }
  const nifList = nifs.filter(x => x.n);
  if (nifList.length) out.nif = nifList[0].n;
  // IBAN, teléfono, email
  const iban = up.replace(/[ ]/g, ' ').match(/\bES\d{2}(?:[\s-]?\d{4}){5}\b/); if (iban) out.iban = iban[0].replace(/[\s-]/g, '');
  const telLine = lines.find(l => /\b(tel|tlf|tf|m[oó]vil|phone)\b/i.test(l)) || text;
  const tel = telLine.match(/\b([6789]\d{2})[\s.-]?(\d{3})[\s.-]?(\d{3})\b/) || telLine.match(/\b([6789]\d{2})[\s.-]?(\d{2})[\s.-]?(\d{2})[\s.-]?(\d{2})\b/) || text.match(/\b([6789]\d{2})[\s.-]?(\d{3})[\s.-]?(\d{3})\b/);
  if (tel) out.telefono = tel.slice(1).filter(Boolean).join(' ');
  const mail = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/); if (mail) out.email = mail[0];
  // fecha
  const dRe = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g;
  while ((m = dRe.exec(text))) { let [_, d, mo, y] = m; y = +y < 100 ? 2000 + +y : +y; if (y >= 2015 && y <= new Date().getFullYear() + 1 && +mo >= 1 && +mo <= 12 && +d >= 1 && +d <= 31) { out.fecha = y + '-' + pad(mo) + '-' + pad(d); break; } }
  // número de factura
  const numL = text.match(/(?:n[ºo°0.]?[ \t]*(?:de[ \t]*)?factura|factura[ \t]*(?:n[ºo°0.]?|num(?:ero)?\.?)|fra\.?[ \t]*n?[ºo°0]?|invoice[ \t]*(?:no|n[ºo°])?)[ \t]*[:#]?[ \t]*([A-Z0-9][A-Z0-9\/\-.]{0,20}\d[A-Z0-9\/\-.]{0,20})/i);
  if (numL) out.numero = numL[1];
  // importes
  const amtRe = /(\d{1,3}(?:[.\s]\d{3})*,\d{2}|\d+,\d{2}|\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2})(?!\d)/g;
  const amounts = l => { const r = []; let a; amtRe.lastIndex = 0; while ((a = amtRe.exec(l))) { let s = a[1]; if (/,\d{2}$/.test(s)) s = s.replace(/[.\s]/g, '').replace(',', '.'); else s = s.replace(/,/g, ''); r.push(parseFloat(s)); } return r; };
  let total = 0, base = 0, cuota = 0, pct = 0;
  lines.forEach((l, i) => {
    const L = fold(l); const nxt = lines[i + 1] || '';
    const vals = amounts(l).length ? amounts(l) : amounts(nxt);
    if (/total/.test(L) && !/subtotal|total base|base total|total iva|total dto/.test(L) && vals.length) total = Math.max(total, Math.max(...vals));
    if (/base\s*imp|^base|b\.\s*imp|subtotal|neto/.test(L) && vals.length) base = base || Math.max(...vals);
    if (/i\.?v\.?a|cuota/.test(L) && !/base|total|incl/.test(L) && vals.length) { const p = l.match(/(21|10|4)\s*%/); if (p) pct = +p[1]; const c = vals.filter(v => ![21, 10, 4].includes(v)); if (c.length) cuota = cuota || c[c.length - 1]; }
  });
  if (!pct) { const p = up.match(/(21|10|4)[,.]?0{0,2}\s*%/); if (p) pct = +p[1]; }
  if (!total) { const all = amounts(text); if (all.length) total = Math.max(...all); }
  pct = pct || 21;
  if (total && base && !cuota) cuota = r2(total - base);
  if (total && !base) { base = cuota ? r2(total - cuota) : r2(total / (1 + pct / 100)); cuota = cuota || r2(total - base); }
  if (!total && base) { cuota = cuota || r2(base * pct / 100); total = r2(base + cuota); }
  if (base && cuota && Math.abs(base * pct / 100 - cuota) > Math.max(1, base * 0.02)) { const guess = Math.round(cuota / base * 100); if ([21, 10, 4].includes(guess)) pct = guess; }
  Object.assign(out, {total:r2(total), base:r2(base), cuota:r2(cuota), ivaPct:pct});
  // proveedor: primera línea con letras antes del primer NIF, o con forma jurídica
  const legal = lines.find(l => /\b(S\.?\s?L\.?U?|S\.?\s?A\.?|S\.?\s?C\.?C?\.?L?|SCCL)\b/i.test(l) && l.length < 60 && !/cliente/i.test(l));
  const head = lines.slice(0, 8).find(l => /[A-Za-zÀ-ÿ]{3}/.test(l) && !/factura|fecha|n[ºo°]|tel|cif|nif|www|@/i.test(l) && l.length >= 4 && l.length < 50);
  out.proveedor = (legal || head || '').replace(/\s{2,}/g, ' ').trim();
  const dir = lines.find(l => /(^|\s)(c\/|calle|carrer|avda\.?|av\.|avenida|pol[ií]gono|pol\.|ctra\.?|carretera|pla[cç]a|plaza)(\s|$)/i.test(l) || /^c\//i.test(l)); if (dir) out.direccion = dir;
  // si ya conocemos al proveedor por el NIF, mandan sus datos
  const known = out.nif && S.proveedores.find(p => normPlate(p.nif) === out.nif);
  if (known) { out.proveedor = known.nombre; out.categoria = known.categoria; out._known = true; }
  else { const t = fold(text); out.categoria = /alquiler|lloguer|arrendamiento/.test(t) ? 'Alquiler del local' : /endesa|iberdrola|naturgy|electric|agua|aigues|movistar|vodafone|orange|telefon/.test(t) ? 'Suministros (luz, agua, teléfono)' : /seguro|asseguran|mapfre|allianz|axa|mutua/.test(t) ? 'Seguros' : /aceite|lubric|5w|10w|anticongel|liquido/.test(t) ? 'Aceites y líquidos' : /gasolin|carburant|repsol|cepsa|bp |galp|shell/.test(t) ? 'Combustible' : /gestor|asesor/.test(t) ? 'Gestoría' : 'Recambios'; }
  return out;
}

function gastoForm(g, from) {
  const x = g || {fecha:todayISO(), proveedor:'', nif:'', numero:'', concepto:'', categoria:'Recambios', base:'', ivaPct:21, cuota:'', total:'', deducible:true};
  const prov = x.proveedorId ? byId(x.proveedorId) : null;
  const pv = x._prov || {};
  openSheet({live:false, render:() => ({title:x.id ? 'Gasto' : 'Nuevo gasto', body:`
    ${from === 'ok' ? `<div class="note okn"><b>Datos leídos de la foto.</b> Compáralos con la factura antes de guardar.</div>` : from === 'fallo' ? `<div class="note warn">No se ha podido leer la foto en este dispositivo. La foto queda guardada: apunta los datos a mano.</div>` : ''}
    ${x.fotoId ? `<img class="photo" id="gx-photo" alt="Foto de la factura">` : ''}
    <div class="grid2 keep"><label class="f">Fecha<input class="in" id="gx-fecha" type="date" value="${esc(x.fecha)}"></label><label class="f">Nº factura<input class="in" id="gx-num" value="${esc(x.numero)}"></label></div>
    <label class="f">Proveedor<input class="in" id="gx-prov" value="${esc(x.proveedor)}" placeholder="Recambios del Camp SL" list="dl-prov"><datalist id="dl-prov">${S.proveedores.map(p => `<option value="${esc(p.nombre)}">`).join('')}</datalist></label>
    <div class="grid2"><label class="f">NIF del proveedor<input class="in" id="gx-nif" value="${esc(x.nif)}" autocapitalize="characters"></label><label class="f">Tipo de gasto<select class="in" id="gx-cat">${CATS.map(c => `<option ${c === x.categoria ? 'selected' : ''}>${c}</option>`).join('')}</select></label></div>
    <label class="f">Concepto<input class="in" id="gx-conc" value="${esc(x.concepto)}" placeholder="Pastillas de freno, discos…"></label>
    <div class="card stack"><div class="grid2 keep"><label class="f">Base (sin IVA)<input class="in num" id="gx-base" inputmode="decimal" value="${x.base === '' ? '' : numES(x.base)}"></label><label class="f">% IVA<select class="in" id="gx-iva">${[21, 10, 4, 0].map(p => `<option value="${p}" ${+x.ivaPct === p ? 'selected' : ''}>${p} %</option>`).join('')}</select></label></div>
      <div class="grid2 keep"><label class="f">IVA<input class="in num" id="gx-cuota" inputmode="decimal" value="${x.cuota === '' ? '' : numES(x.cuota)}"></label><label class="f">Total pagado<input class="in num" id="gx-total" inputmode="decimal" value="${x.total === '' ? '' : numES(x.total)}"></label></div>
      <label class="check"><input type="checkbox" id="gx-ded" ${x.deducible !== false ? 'checked' : ''}> Es un gasto del taller (deducible)</label></div>
    ${!x.id ? `<details class="card"${pv.iban || pv.telefono ? ' open' : ''}><summary style="font-weight:700;cursor:pointer">Datos del proveedor</summary><div class="stack" style="margin-top:10px">
      <label class="f">IBAN<input class="in num" id="gx-iban" value="${esc(pv.iban || (prov && prov.iban) || '')}"></label>
      <div class="grid2"><label class="f">Teléfono<input class="in" id="gx-tel" type="tel" value="${esc(pv.telefono || '')}"></label><label class="f">Email<input class="in" id="gx-email" value="${esc(pv.email || '')}"></label></div>
      <label class="f">Dirección<input class="in" id="gx-dir" value="${esc(pv.direccion || '')}"></label>
      <div class="muted tiny">Se guarda en Proveedores. La próxima factura con el mismo NIF se rellena sola.</div></div></details>` : ''}`,
    foot:`${x.id ? `<button class="btn danger" data-a="delgasto" data-id="${x.id}">Borrar</button>` : ''}<button class="btn primary block" data-a="savegasto" data-id="${x.id || ''}">Guardar gasto</button>`}),
    after:async () => {
      const recalc = () => { const b = parseNum($('#gx-base').value), p = +$('#gx-iva').value; $('#gx-cuota').value = numES(b * p / 100); $('#gx-total').value = numES(b + b * p / 100); };
      const fromTotal = () => { const t = parseNum($('#gx-total').value), p = +$('#gx-iva').value; const b = r2(t / (1 + p / 100)); $('#gx-base').value = numES(b); $('#gx-cuota').value = numES(t - b); };
      $('#gx-base').addEventListener('input', recalc); $('#gx-iva').addEventListener('change', recalc); $('#gx-total').addEventListener('change', fromTotal);
      $('#gx-prov').addEventListener('change', e => { const p = S.proveedores.find(p => p.nombre === e.target.value); if (p) { $('#gx-nif').value = p.nif || ''; $('#gx-cat').value = p.categoria || 'Recambios'; } });
      if (x.fotoId) { const b = await Store.getFile(x.fotoId); const im = $('#gx-photo'); if (b && im) im.src = URL.createObjectURL(b); else if (im) im.remove(); }
    }, gasto:x});
}
async function saveGasto(id) {
  const v = k => ($('#' + k) || {}).value || '';
  const base = parseNum(v('gx-base')), total = parseNum(v('gx-total'));
  const nombre = v('gx-prov').trim(); const nif = v('gx-nif').trim().toUpperCase().replace(/[\s.-]/g, '');
  if (!nombre) { toast('Escribe el proveedor.'); return; }
  if (!total && !base) { toast('Escribe el importe.'); return; }
  const top = sheetStack[sheetStack.length - 1]; const x = top.gasto || {};
  // proveedor: crear o completar
  let prov = S.proveedores.find(p => (nif && normPlate(p.nif) === nif) || p.nombre === nombre);
  const pdata = {t:'proveedor', nombre, nif, categoria:v('gx-cat'), iban:v('gx-iban').replace(/\s/g, '').toUpperCase(), telefono:v('gx-tel'), email:v('gx-email'), direccion:v('gx-dir')};
  let provId = prov ? prov.id : null;
  if (!prov) { provId = newId('p_'); await Store.put(provId, {...pdata, creado:new Date().toISOString()}); }
  else { const merged = {...docs[prov.id]}; Object.entries(pdata).forEach(([k, val]) => { if (val && !merged[k]) merged[k] = val; }); merged.categoria = pdata.categoria; await Store.put(prov.id, merged); }
  const data = {...(id ? docs[id] : {t:'gasto', creado:new Date().toISOString(), fotoId:x.fotoId || ''}), fecha:v('gx-fecha') || todayISO(), numero:v('gx-num').trim(), proveedor:nombre, proveedorId:provId, nif, categoria:v('gx-cat'), concepto:v('gx-conc').trim(), base, ivaPct:+v('gx-iva'), cuota:parseNum(v('gx-cuota')), total, deducible:$('#gx-ded').checked};
  await Store.put(id || newId('g_'), data); closeSheet(); toast('Gasto guardado');
}
function proveedoresSheet() {
  openSheet({live:true, render:() => ({title:'Proveedores', body: S.proveedores.length ? `<div class="list">${S.proveedores.map(p => { const gs = S.gastos.filter(g => g.proveedorId === p.id || (p.nif && g.nif === p.nif)); return `<button class="item" data-a="prov" data-id="${p.id}"><div class="grow"><div class="t">${esc(p.nombre)}</div><div class="s">${esc(p.nif || 'Sin NIF')} · ${esc(p.categoria || '')} · ${gs.length} facturas</div></div><div class="amt num" style="font-size:17px">${eur(gs.reduce((s, g) => s + (+g.total || 0), 0))}</div></button>`; }).join('')}</div>` : `<div class="card empty"><div class="muted">Los proveedores se guardan solos al apuntar sus facturas.</div></div>`})});
}
function provForm(id) {
  const p = byId(id);
  openSheet({live:false, render:() => ({title:p.nombre, body:`
    <label class="f">Nombre<input class="in" id="pv-nombre" value="${esc(p.nombre)}"></label>
    <div class="grid2"><label class="f">NIF<input class="in" id="pv-nif" value="${esc(p.nif)}"></label><label class="f">Tipo de gasto<select class="in" id="pv-cat">${CATS.map(c => `<option ${c === p.categoria ? 'selected' : ''}>${c}</option>`).join('')}</select></label></div>
    <label class="f">IBAN<input class="in num" id="pv-iban" value="${esc(p.iban)}"></label>
    <div class="grid2"><label class="f">Teléfono<input class="in" id="pv-tel" value="${esc(p.telefono)}"></label><label class="f">Email<input class="in" id="pv-email" value="${esc(p.email)}"></label></div>
    <label class="f">Dirección<input class="in" id="pv-dir" value="${esc(p.direccion)}"></label>`,
    foot:`<button class="btn danger" data-a="delprov" data-id="${id}">Borrar</button><button class="btn primary block" data-a="saveprov" data-id="${id}">Guardar</button>`})});
}

/* ---------- Ajustes ---------- */
let STC = null;
function settings(cfg) {
  const c = clone(cfg || S.cfg); STC = c;
  const d = (n, l) => `<label class="check" style="font-size:14px"><input type="checkbox" data-dia="${n}" ${(c.dias || []).includes(n) ? 'checked' : ''}>${l}</label>`;
  openSheet({live:false, render:() => ({title:'Ajustes del taller', body:`
    <div class="eyebrow">Datos que salen en las facturas</div>
    <label class="f">Nombre del taller<input class="in" id="st-taller" value="${esc(c.taller)}"></label>
    <div class="grid2 keep"><label class="f">Nombre<input class="in" id="st-prop" value="${esc(c.propietario)}"></label><label class="f">Apellidos<input class="in" id="st-ape" value="${esc(c.apellidos || '')}"></label></div>
    <label class="f">NIF<input class="in" id="st-nif" value="${esc(c.nif)}" autocapitalize="characters"></label>
    <label class="f">Dirección<input class="in" id="st-dir" value="${esc(c.direccion)}" placeholder="Calle y número"></label>
    <label class="f">Código postal y población<input class="in" id="st-pob" value="${esc(c.poblacion)}"></label>
    <div class="grid2"><label class="f">Teléfono<input class="in" id="st-tel" type="tel" value="${esc(c.telefono)}"></label><label class="f">Email<input class="in" id="st-email" type="email" value="${esc(c.email)}"></label></div>
    <div class="eyebrow" style="margin-top:8px">Precios e impuestos</div>
    <div class="grid3"><label class="f">€ / hora<input class="in num" id="st-tarifa" inputmode="decimal" value="${esc(String(c.tarifa).replace('.', ','))}"></label><label class="f">IVA %<input class="in num" id="st-iva" inputmode="numeric" value="${esc(c.iva)}"></label><label class="f">IRPF est. %<input class="in num" id="st-irpf" inputmode="numeric" value="${esc(c.irpf)}"></label></div>
    <div class="muted tiny">Referencia: los talleres independientes de la zona de Barcelona cobran entre 30 y 55 € la hora más IVA; la media en Madrid ronda los 45 €.</div>
    <label class="f">Días de validez del presupuesto<input class="in num" id="st-val" inputmode="numeric" value="${esc(c.validez)}"></label>
    <label class="check"><input type="checkbox" id="st-alq" ${c.alquiler ? 'checked' : ''}> Pago alquiler del local con retención (modelo 115)</label>
    <label class="check"><input type="checkbox" id="st-trab" ${c.trabajadores ? 'checked' : ''}> Tengo trabajadores (modelo 111)</label>
    <div class="eyebrow" style="margin-top:8px">Horario de la agenda</div>
    <div class="row wrapr" style="gap:14px">${d(1, 'L')}${d(2, 'M')}${d(3, 'X')}${d(4, 'J')}${d(5, 'V')}</div>
    <div class="grid2 keep"><label class="f">Mañana de<input class="in" id="st-m1" type="time" value="${esc(c.m1)}"></label><label class="f">a<input class="in" id="st-m2" type="time" value="${esc(c.m2)}"></label></div>
    <div class="grid2 keep"><label class="f">Tarde de<input class="in" id="st-t1" type="time" value="${esc(c.t1)}"></label><label class="f">a<input class="in" id="st-t2" type="time" value="${esc(c.t2)}"></label></div>
    <label class="check"><input type="checkbox" id="st-sab" ${c.sab ? 'checked' : ''}> Abro el sábado</label>
    <div class="grid2 keep"><label class="f">Sábado de<input class="in" id="st-s1" type="time" value="${esc(c.sab1)}"></label><label class="f">a<input class="in" id="st-s2" type="time" value="${esc(c.sab2)}"></label></div>
    <label class="f">Duración de cada hueco<select class="in" id="st-hueco">${[30, 45, 60, 90, 120].map(m => `<option value="${m}" ${+c.hueco === m ? 'selected' : ''}>${m} min</option>`).join('')}</select></label>
    <div class="eyebrow" style="margin-top:8px">Cobros · CaixaBank</div>
    <label class="f">IBAN<input class="in num" id="st-iban" value="${esc(c.iban)}" placeholder="ES00 2100 …" autocapitalize="characters"></label>
    <label class="f">Enlace de pago con tarjeta <span class="h">El que te da el TPV virtual de CaixaBank para cobrar a distancia</span><input class="in" id="st-link" type="url" value="${esc(c.linkPago)}" placeholder="https://…"></label>
    <label class="f">Teléfono de Bizum<input class="in" id="st-bizum" type="tel" value="${esc(c.bizum)}"></label>
    <div class="eyebrow" style="margin-top:8px">Datos de vehículos</div>
    <label class="f">Usuario del servicio de consulta de matrículas <span class="h">Opcional y de pago por consulta (RegCheck)</span><input class="in" id="st-reg" value="${esc(c.regcheck)}"></label>
    <div class="eyebrow" style="margin-top:8px">Conceptos habituales</div>
    <div class="muted small">Salen como botones al hacer un presupuesto. Los precios iniciales son de ejemplo: pon los tuyos.</div>
    <div class="stack">${c.conceptos.map((k, i) => `<div class="line"><input class="in" data-c="${i}" data-f="desc" value="${esc(k.desc)}"><div class="line-n"><label class="f">Tipo<select class="in" data-c="${i}" data-f="tipo">${Object.entries(TIPOS).map(([a, b]) => `<option value="${a}" ${k.tipo === a ? 'selected' : ''}>${b}</option>`).join('')}</select></label><label class="f">Cant.<input class="in num" data-c="${i}" data-f="cant" inputmode="decimal" value="${esc(String(k.cant).replace('.', ','))}"></label><label class="f">Precio<input class="in num" data-c="${i}" data-f="precio" inputmode="decimal" value="${esc(String(k.precio).replace('.', ','))}"></label></div><button class="btn sm danger" data-a="delconc" data-id="${i}">Quitar</button></div>`).join('')}</div>
    <button class="btn sm" data-a="addconcset">+ Concepto habitual</button>
    <div class="note small">Las facturas que hace la app valen hasta el 30/06/2027. Desde el 1/07/2027 los autónomos necesitan un programa adaptado a Verifactu: esa adaptación llega antes de esa fecha.</div>`,
    foot:`<button class="btn primary block" data-a="savecfg">Guardar ajustes</button>`})});
}
function readCfgForm() {
  const v = id => ($('#' + id) || {}).value || '';
  const ck = id => !!($('#' + id) || {}).checked;
  $$('[data-c]').forEach(el => { const i = +el.dataset.c, f = el.dataset.f; if (STC.conceptos[i]) STC.conceptos[i][f] = (f === 'desc' || f === 'tipo') ? el.value : parseNum(el.value); });
  return {...STC, t:'cfg', taller:v('st-taller').trim(), propietario:v('st-prop').trim(), apellidos:v('st-ape').trim(), nif:v('st-nif').trim().toUpperCase(), direccion:v('st-dir').trim(), poblacion:v('st-pob').trim(), telefono:v('st-tel').trim(), email:v('st-email').trim(),
    tarifa:parseNum(v('st-tarifa')), iva:parseNum(v('st-iva')) || 21, irpf:parseNum(v('st-irpf')), validez:parseInt(v('st-val')) || 15, alquiler:ck('st-alq'), trabajadores:ck('st-trab'),
    dias:$$('[data-dia]').filter(x => x.checked).map(x => +x.dataset.dia), m1:v('st-m1'), m2:v('st-m2'), t1:v('st-t1'), t2:v('st-t2'), sab:ck('st-sab'), sab1:v('st-s1'), sab2:v('st-s2'), hueco:+v('st-hueco') || 60,
    iban:v('st-iban').trim().toUpperCase(), linkPago:v('st-link').trim(), bizum:v('st-bizum').trim(), regcheck:v('st-reg').trim()};
}

/* ---------- Copia de seguridad ---------- */
function backupSheet() {
  openSheet({live:false, render:() => ({title:'Copia de seguridad', body:`
    <div class="muted">Todo está guardado solo en este móvil. Si se pierde o se rompe, la copia es lo único que lo recupera.</div>
    <div class="card stack"><h3>Hacer copia</h3><div class="muted small">Un archivo con clientes, coches, presupuestos, facturas, gastos y fotos. Guárdalo en Google Drive o envíatelo por email.</div><button class="btn primary block" data-a="bk-export">Descargar copia</button>${S.cfg.ultimaCopia ? `<div class="muted tiny">Última copia: ${fdate(S.cfg.ultimaCopia)}</div>` : ''}</div>
    <div class="card stack"><h3>Recuperar una copia</h3><div class="muted small">Sustituye todo lo que hay ahora en la app por lo de la copia.</div><button class="btn block" data-a="bk-import">Elegir archivo de copia</button></div>`})});
}
const blobToData = b => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
async function exportBackup() {
  const files = await Store.allFiles(); const fdata = {};
  for (const [k, b] of Object.entries(files)) fdata[k] = await blobToData(b);
  const today = todayISO();
  await Store.put('cfg', {...(docs.cfg || S.cfg), t:'cfg', ultimaCopia:today});
  saveBlob(new Blob([JSON.stringify({app:'taller-les-borges', version:2, fecha:today, docs, files:fdata})], {type:'application/json'}), 'copia-taller-' + today + '.json');
}
let pendingImport = null;
async function importBackup(file) {
  try { const d = JSON.parse(await file.text()); if (d.app !== 'taller-les-borges' || !d.docs) throw 0; pendingImport = d; }
  catch (e) { toast('Ese archivo no es una copia de esta app.'); return; }
  const n = Object.values(pendingImport.docs).filter(x => x.t === 'trabajo').length;
  openSheet({live:false, render:() => ({title:'Recuperar copia', body:`<div class="note warn">La copia es del ${fdate(pendingImport.fecha)} y tiene ${n} trabajos. <b>Lo que hay ahora en la app se sustituye.</b></div>`, foot:`<button class="btn danger block" data-a="bk-confirm">Sí, recuperar la copia</button>`})});
}
async function confirmImport() {
  const d = pendingImport; if (!d) return;
  await Store.clearAll(); await Store.putMany(d.docs);
  for (const [k, url] of Object.entries(d.files || {})) { try { const b = await (await fetch(url)).blob(); await Store.putFile(k, b); } catch (e) {} }
  pendingImport = null; closeAll(); toast('Copia recuperada');
}

/* ---------- Datos de ejemplo ---------- */
async function seed() {
  const t = todayISO(); const tar = S.cfg.tarifa || 45; const ts = n => new Date(Date.now() - n * 86400000).toISOString();
  const dd = n => { const d = addDays(t, -n); return d.slice(0, 7) === t.slice(0, 7) ? d : t.slice(0, 8) + '01'; };
  const f1 = freeSlots(t, 1, 3); const f2 = freeSlots(addDays(t, 1), 3, 2);
  const items = {
    c_ej1:{t:'cliente', nombre:'Jordi Puig', telefono:'600 000 001', nif:'', direccion:'', ejemplo:true},
    c_ej2:{t:'cliente', nombre:'Fatima El Amrani', telefono:'600 000 002', nif:'', direccion:'', ejemplo:true},
    c_ej3:{t:'cliente', nombre:'Transports Camp SL', telefono:'600 000 003', nif:'B00000000', direccion:'Polígon, 1 · Reus', ejemplo:true},
    v_ej1:{t:'vehiculo', clienteId:'c_ej1', matricula:'4821KLM', bastidor:'VSSZZZ5FZJR000001', marca:'Seat', modelo:'León', version:'1.6 TDI', combustible:'Diésel', anio:'2018', km:'148500', ejemplo:true},
    v_ej2:{t:'vehiculo', clienteId:'c_ej2', matricula:'7310HBD', marca:'Renault', modelo:'Clio', version:'1.2', combustible:'Gasolina', anio:'2011', ejemplo:true},
    v_ej3:{t:'vehiculo', clienteId:'c_ej3', matricula:'2299MPR', marca:'Ford', modelo:'Transit Custom', combustible:'Diésel', anio:'2023', ejemplo:true},
    j_ej1:{t:'trabajo', estado:'enviado', numPresupuesto:'EJ-P-001', fecha:t, clienteId:'c_ej1', vehiculoId:'v_ej1', clienteNombre:'Jordi Puig', matricula:'4821KLM', km:'148500', averia:'Chirrían los frenos delanteros', lineas:[{tipo:'mo', desc:'Cambio de pastillas y discos delanteros', cant:1.5, precio:tar}, {tipo:'pieza', desc:'Juego pastillas delanteras', cant:1, precio:38}, {tipo:'pieza', desc:'Discos de freno delanteros (par)', cant:1, precio:72}], iva:21, creado:ts(0), ejemplo:true},
    j_ej2:{t:'trabajo', estado:'aceptado', numPresupuesto:'EJ-P-002', fecha:dd(1), clienteId:'c_ej2', vehiculoId:'v_ej2', clienteNombre:'Fatima El Amrani', matricula:'7310HBD', km:'96200', averia:'Revisión y cambio de aceite', aceptadoFecha:dd(1), aceptadoVia:'whatsapp', lineas:[{tipo:'mo', desc:'Cambio de aceite y filtro', cant:0.5, precio:tar}, {tipo:'pieza', desc:'Aceite motor 5W30 (litro)', cant:4.5, precio:9.5}, {tipo:'pieza', desc:'Filtro de aceite', cant:1, precio:12}, {tipo:'otro', desc:'Gestión de residuos', cant:1, precio:3}], iva:21, creado:ts(1), ejemplo:true},
    j_ej3:{t:'trabajo', estado:'facturado', numPresupuesto:'EJ-P-003', numFactura:'EJ-F-0001', fecha:dd(3), fechaFactura:dd(2), clienteId:'c_ej3', vehiculoId:'v_ej3', clienteNombre:'Transports Camp SL', matricula:'2299MPR', km:'210400', averia:'Embrague patina', facturaCliente:{nombre:'Transports Camp SL', nif:'B00000000', direccion:'Polígon, 1 · Reus'}, aceptadoFecha:dd(3), aceptadoVia:'whatsapp', pagos:[{importe:300, metodo:'transferencia', fecha:dd(2)}], lineas:[{tipo:'mo', desc:'Sustitución kit de embrague', cant:5, precio:tar}, {tipo:'pieza', desc:'Kit de embrague con volante', cant:1, precio:465}], iva:21, creado:ts(3), ejemplo:true},
    j_ej4:{t:'trabajo', estado:'cobrado', numPresupuesto:'EJ-P-004', numFactura:'EJ-F-0002', fecha:t, fechaFactura:t, clienteId:'c_ej1', vehiculoId:'v_ej1', clienteNombre:'Jordi Puig', matricula:'4821KLM', km:'147900', averia:'Luz de matrícula fundida', aceptadoFecha:t, aceptadoVia:'whatsapp', pagos:[{importe:r2((0.5 * tar + 5) * 1.21), metodo:'datafono', fecha:t}], lineas:[{tipo:'mo', desc:'Revisión pre-ITV', cant:0.5, precio:tar}, {tipo:'pieza', desc:'Bombilla luz de matrícula', cant:2, precio:2.5}], iva:21, creado:ts(5), ejemplo:true},
    j_ej5:{t:'trabajo', simplificada:true, estado:'cobrado', numFactura:'EJ-T-0001', fecha:t, fechaFactura:t, clienteNombre:'Cliente de mostrador', lineas:[{tipo:'otro', desc:'Inflado y revisión de presión', cant:1, precio:r2(15 / 1.21)}], totalFijo:15, iva:21, pagos:[{importe:15, metodo:'efectivo', fecha:t}], creado:ts(0), ejemplo:true},
    g_ej1:{t:'gasto', fecha:dd(2), proveedor:'Recambios Baix Camp', proveedorId:'p_ej1', nif:'B11111111', numero:'A-1203', concepto:'Kit de embrague y pastillas', categoria:'Recambios', base:420, ivaPct:21, cuota:88.2, total:508.2, deducible:true, ejemplo:true},
    g_ej2:{t:'gasto', fecha:t.slice(0, 8) + '01', proveedor:'Lloguer nau', nif:'00000000T', numero:t.slice(0, 7), concepto:'Alquiler del local', categoria:'Alquiler del local', base:600, ivaPct:21, cuota:126, total:726, deducible:true, ejemplo:true},
    g_ej3:{t:'gasto', fecha:dd(6), proveedor:'Lubricantes Reus', proveedorId:'p_ej2', nif:'B22222222', numero:'F-889', concepto:'Bidón aceite 5W30 60 L', categoria:'Aceites y líquidos', base:310, ivaPct:21, cuota:65.1, total:375.1, deducible:true, ejemplo:true},
    p_ej1:{t:'proveedor', nombre:'Recambios Baix Camp', nif:'B11111111', categoria:'Recambios', iban:'', telefono:'977 000 000', ejemplo:true},
    p_ej2:{t:'proveedor', nombre:'Lubricantes Reus', nif:'B22222222', categoria:'Aceites y líquidos', ejemplo:true}
  };
  if (f1[0]) items.ct_ej1 = {t:'cita', fecha:t, hora:f1[0].hora, duracion:60, clienteId:'c_ej2', vehiculoId:'v_ej2', nombre:'Fatima El Amrani', telefono:'600 000 002', matricula:'7310HBD', motivo:'Recoge el coche tras el cambio de aceite', estado:'confirmada', ejemplo:true};
  if (f1[1]) items.ct_ej2 = {t:'cita', fecha:t, hora:f1[1].hora, duracion:60, nombre:'Marc Ferré', telefono:'600 000 004', matricula:'5512JTW', motivo:'Ruido en la suspensión', estado:'pendiente', ejemplo:true};
  if (f2[0]) items.ct_ej3 = {t:'cita', fecha:f2[0].iso, hora:f2[0].hora, duracion:120, clienteId:'c_ej1', vehiculoId:'v_ej1', nombre:'Jordi Puig', telefono:'600 000 001', matricula:'4821KLM', motivo:'Cambio de frenos (si acepta)', estado:'pendiente', ejemplo:true};
  await Store.putMany(items); toast('Datos de ejemplo cargados');
}
async function unseed() {
  const ids = Object.keys(docs).filter(k => docs[k] && docs[k].ejemplo);
  for (const id of ids) await Store.del(id);
  toast(ids.length ? 'Ejemplos borrados' : 'No había datos de ejemplo');
}

/* ---------- Registro, prueba gratuita y licencia ---------- */
const LIC_PUB = {kty:'EC', crv:'P-256', x:'HcbTGL6z-adYD_8D4Tw10ePs7fngCMNQCGQ2kO9tkR4', y:'YveerZLoHtf8itYWZ8r8bmkxAzZDGyCcYXn6EVbqhJQ'};
const TRIAL_DAYS = 15;
const CROCK = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function makeInstallId() { const a = new Uint8Array(8); crypto.getRandomValues(a); return 'LB' + Array.from(a, b => CROCK[b % 32]).join(''); }
const showId = id => id ? id.slice(0, 2) + '-' + id.slice(2, 6) + '-' + id.slice(6) : '';
const b64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
function lic() { return docs.lic || null; }
async function ensureLic() {
  let l = lic(); const t = todayISO();
  if (!l) { l = {t:'lic', id:makeInstallId(), inicio:t, hasta:'', maxVisto:t, codigos:[]}; await Store.put('lic', l); }
  if (t > (l.maxVisto || '')) { l = {...l, maxVisto:t}; await Store.put('lic', l); }
  return l;
}
function licState() {
  const l = lic(); if (!l) return {ok:true, dias:TRIAL_DAYS, modo:'prueba'};
  const ref = [todayISO(), l.maxVisto || ''].sort().pop(); // si el reloj va hacia atrás, manda el último día visto
  const finPrueba = addDays(l.inicio, TRIAL_DAYS);
  if (l.hasta && l.hasta >= ref) return {ok:true, modo:'licencia', hasta:l.hasta, dias:daysBetween(ref, l.hasta)};
  if (ref < finPrueba) return {ok:true, modo:'prueba', hasta:finPrueba, dias:daysBetween(ref, finPrueba)};
  return {ok:false, modo:l.hasta ? 'caducada' : 'fin-prueba', hasta:l.hasta || finPrueba};
}
const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
async function verifyCode(code) {
  code = String(code || '').trim().replace(/^.*[?&]lic=/, '').replace(/\s/g, '');
  const parts = code.split('.'); if (parts.length !== 3) return {ok:false, msg:'El código no está completo. Cópialo entero del mensaje.'};
  const [id, ymd, sig] = parts; const l = lic();
  if (!l || id !== l.id) return {ok:false, msg:'Este código es de otra instalación. Tu ID es ' + showId(l && l.id) + '.'};
  if (!/^\d{8}$/.test(ymd)) return {ok:false, msg:'El código no es válido.'};
  try {
    const key = await crypto.subtle.importKey('jwk', LIC_PUB, {name:'ECDSA', namedCurve:'P-256'}, false, ['verify']);
    const ok = await crypto.subtle.verify({name:'ECDSA', hash:'SHA-256'}, key, b64u(sig), new TextEncoder().encode(id + '.' + ymd));
    if (!ok) return {ok:false, msg:'El código no es válido. Revisa que lo hayas copiado entero.'};
  } catch (e) { return {ok:false, msg:'Este móvil no puede comprobar el código. Actualiza Chrome e inténtalo otra vez.'}; }
  const hasta = ymd.slice(0, 4) + '-' + ymd.slice(4, 6) + '-' + ymd.slice(6);
  if (hasta < todayISO()) return {ok:false, msg:'Este código ya caducó el ' + fdate(hasta) + '. Pide uno nuevo.'};
  const nl = {...l, hasta:[l.hasta || '', hasta].sort().pop(), codigos:[...(l.codigos || []), {hasta, fecha:todayISO()}]};
  await Store.put('lic', nl);
  return {ok:true, hasta:nl.hasta};
}
function gate(html) { let g = $('#gate'); if (!g) { g = document.createElement('div'); g.id = 'gate'; g.className = 'gate'; document.body.appendChild(g); } g.innerHTML = html; g.hidden = false; document.body.style.overflow = 'hidden'; }
function ungate() { const g = $('#gate'); if (g) { g.hidden = true; g.innerHTML = ''; } document.body.style.overflow = sheetStack.length ? 'hidden' : ''; }
const gateHead = `<div class="gate-top"><img src="icons/logo.svg" alt="" width="64" height="64"><div><div class="brand-k">Taller</div><div class="brand-n">Les Borges del Camp</div></div></div><div class="livery" aria-hidden="true"></div>`;
function showOnboarding() {
  const c = S.cfg;
  gate(`${gateHead}<div class="wrap stack gate-body">
    <h1>Bienvenido</h1><div class="muted">Antes de empezar, tus datos. Salen en los presupuestos y facturas, y los puedes cambiar luego en Ajustes.</div>
    <div class="grid2 keep"><label class="f">Nombre<input class="in" id="ob-nombre" autocomplete="given-name"></label><label class="f">Apellidos<input class="in" id="ob-apellidos" autocomplete="family-name"></label></div>
    <label class="f">Teléfono<input class="in" id="ob-tel" type="tel" inputmode="tel" autocomplete="tel"></label>
    <label class="f">Email <span class="h">Opcional</span><input class="in" id="ob-email" type="email" autocomplete="email"></label>
    <label class="f">NIF <span class="h">Opcional ahora, obligatorio para facturar</span><input class="in" id="ob-nif" autocapitalize="characters"></label>
    <label class="f">Nombre del taller<input class="in" id="ob-taller" value="${esc(c.taller)}"></label>
    <div class="note small">Tienes ${TRIAL_DAYS} días de prueba gratis con todas las funciones. Tus datos se guardan solo en este móvil.</div>
    <button class="btn primary block" data-a="ob-ok">Empezar</button></div>`);
}
function showPaywall() {
  const l = lic(); const st = licState();
  gate(`${gateHead}<div class="wrap stack gate-body">
    <h1>${st.modo === 'caducada' ? 'Tu suscripción ha terminado' : 'Fin de la prueba gratuita'}</h1>
    <div class="muted">${st.modo === 'caducada' ? 'El periodo pagado acabó el ' + fdate(l.hasta) + '.' : 'Han pasado los ' + TRIAL_DAYS + ' días de prueba.'} Si te gusta la app, suscríbete para seguir usándola. Tus datos siguen guardados en el móvil.</div>
    <div class="card stack" style="gap:8px"><div class="eyebrow">Cómo suscribirte</div>
      <div>1. Paga la cuota mensual en efectivo a quien te instaló la app.</div>
      <div>2. Te envía un código para 30 días.</div>
      <div>3. Pégalo aquí o toca el enlace que te llegue.</div></div>
    <div class="card stack" style="gap:6px"><div class="muted small">ID de tu instalación</div><div class="lic-id num">${esc(showId(l.id))}</div>
      <button class="btn block" data-a="lic-share">${ICON.wa}Enviar mi ID por WhatsApp</button></div>
    <label class="f">Código de activación<textarea class="in" id="lic-code" rows="3" placeholder="LB…" autocapitalize="off" autocomplete="off" spellcheck="false"></textarea></label>
    <div id="lic-msg"></div>
    <button class="btn primary block" data-a="lic-ok">Activar</button>
    <button class="btn block" data-a="lic-backup">Descargar copia de mis datos</button></div>`);
}
async function licBoot() {
  await ensureLic();
  const q = new URLSearchParams(location.search).get('lic');
  if (q) { const r = await verifyCode(q); try { history.replaceState(null, '', location.pathname); } catch (e) {} toast(r.ok ? 'App activada hasta el ' + fdate(r.hasta) : r.msg); }
  if (!S.cfg.registrado) { showOnboarding(); return false; }
  if (!licState().ok) { showPaywall(); return false; }
  return true;
}
function licBanner() {
  const st = licState();
  if (st.modo === 'prueba' && st.dias <= 5) return `<button class="note warn" data-a="licencia"><b>Prueba gratuita: ${st.dias === 0 ? 'último día' : 'quedan ' + st.dias + ' días'}.</b> Toca para ver cómo suscribirte.</button>`;
  if (st.modo === 'licencia' && st.dias <= 5) return `<button class="note warn" data-a="licencia"><b>Tu suscripción acaba ${st.dias === 0 ? 'hoy' : 'en ' + st.dias + ' días'}.</b> Toca para renovarla.</button>`;
  return '';
}
function licenciaSheet() {
  const l = lic(); const st = licState();
  openSheet({live:false, render:() => ({title:'Suscripción', body:`
    <div class="card stack" style="gap:6px"><div class="eyebrow">Estado</div><div style="font-weight:700;font-size:18px">${st.modo === 'licencia' ? 'Activa hasta el ' + fdate(st.hasta) : 'Prueba gratuita hasta el ' + fdate(st.hasta)}</div><div class="muted small">${st.dias} días restantes</div></div>
    <div class="card stack" style="gap:6px"><div class="muted small">ID de tu instalación</div><div class="lic-id num">${esc(showId(l.id))}</div><button class="btn block" data-a="lic-share">${ICON.wa}Enviar mi ID por WhatsApp</button></div>
    <label class="f">Código de activación<textarea class="in" id="lic-code" rows="3" placeholder="LB…" autocapitalize="off" autocomplete="off" spellcheck="false"></textarea></label>
    <div id="lic-msg"></div><button class="btn primary block" data-a="lic-ok">Activar código</button>
    ${(l.codigos || []).length ? `<div class="card">${l.codigos.slice().reverse().map(c => `<div class="kv"><span class="muted">Activado el ${fdate(c.fecha)}</span><span class="v">hasta ${fdate(c.hasta)}</span></div>`).join('')}</div>` : ''}`})});
}

/* ---------- Trabajos habituales con tiempos y precios orientativos ---------- */
// Horas de mano de obra según tiempos habituales y piezas a precio medio sin IVA para un turismo compacto. Orientativo: se ajusta en cada presupuesto.
const JOBS = [
  {n:'Equilibrado de 4 ruedas', kw:['equilibr','vibra','volante tiembla','tiembla el volante'], l:[['mo','Equilibrado de 4 ruedas',0.5],['pieza','Contrapesos',1,6]]},
  {n:'Alineación de dirección', kw:['alinea','paralelo','tira hacia','se va hacia','desgaste irregular'], l:[['mo','Alineación de dirección (paralelo)',0.75]]},
  {n:'Reparar pinchazo', kw:['pinchazo','pinchada','pierde aire'], l:[['otro','Reparación de pinchazo',1,15]]},
  {n:'Montar 2 neumáticos', kw:['neumatic','cubierta','rueda gastada'], l:[['mo','Montaje y equilibrado de 2 neumáticos',0.6],['pieza','Neumático',2,75],['otro','Válvula y tasa de reciclaje',2,4]]},
  {n:'Pastillas delanteras', kw:['pastilla','freno','chirr','pita al frenar','frena mal','frenos'], l:[['mo','Cambio de pastillas delanteras',0.8],['pieza','Juego de pastillas delanteras',1,45]]},
  {n:'Discos y pastillas delanteros', kw:['disco','vibra al frenar','tiembla al frenar','frenos'], l:[['mo','Cambio de discos y pastillas delanteros',1.5],['pieza','Discos de freno delanteros (par)',1,90],['pieza','Juego de pastillas delanteras',1,45]]},
  {n:'Pastillas traseras', kw:['trasera','freno trasero','freno de mano'], l:[['mo','Cambio de pastillas traseras',0.8],['pieza','Juego de pastillas traseras',1,40]]},
  {n:'Cambio de líquido de frenos', kw:['liquido de frenos','pedal esponjoso','pedal blando'], l:[['mo','Purgado y cambio de líquido de frenos',0.6],['pieza','Líquido de frenos DOT 4 (1 L)',1,12]]},
  {n:'Cambio de aceite y filtro', kw:['aceite','revision','mantenimiento','cambio de aceite'], l:[['mo','Cambio de aceite y filtro',0.5],['pieza','Aceite motor 5W30 (litro)',5,9.5],['pieza','Filtro de aceite',1,12],['otro','Gestión de residuos',1,3]]},
  {n:'Revisión completa con filtros', kw:['revision completa','filtros','filtro de aire','filtro de polen'], l:[['mo','Revisión completa con cambio de filtros',1],['pieza','Aceite motor 5W30 (litro)',5,9.5],['pieza','Filtro de aceite',1,12],['pieza','Filtro de aire',1,18],['pieza','Filtro de habitáculo',1,16],['otro','Gestión de residuos',1,3]]},
  {n:'Kit de distribución y bomba de agua', kw:['distribucion','correa de distribucion','bomba de agua'], l:[['mo','Sustitución kit de distribución y bomba de agua',4],['pieza','Kit de distribución con bomba de agua',1,220],['pieza','Líquido refrigerante (litro)',4,4]]},
  {n:'Embrague', kw:['embrague','patina','cuesta meter','marchas rascan'], l:[['mo','Sustitución del kit de embrague',5],['pieza','Kit de embrague',1,280]]},
  {n:'Batería', kw:['bateria','no arranca','arranque','descarga'], l:[['mo','Comprobación de carga y cambio de batería',0.4],['pieza','Batería 60 Ah',1,95]]},
  {n:'Diagnosis electrónica', kw:['testigo','luz motor','check','diagnos','error','averia electr','chivato'], l:[['mo','Diagnosis con máquina',0.5]]},
  {n:'Carga de aire acondicionado', kw:['aire acondicionado','no enfria','clima','a/c'], l:[['mo','Revisión y carga de aire acondicionado',0.75],['pieza','Gas refrigerante (carga)',1,45]]},
  {n:'Amortiguadores delanteros', kw:['amortigu','suspension','rebota','baches'], l:[['mo','Sustitución de amortiguadores delanteros',2],['pieza','Amortiguador delantero',2,70],['pieza','Copela de amortiguador',2,25]]},
  {n:'Bieletas o rótulas', kw:['rotula','bieleta','golpeteo','ruido en la direccion','clac'], l:[['mo','Sustitución de bieletas de estabilizadora',1],['pieza','Bieleta de estabilizadora',2,22]]},
  {n:'Bujías', kw:['bujia','tirones','falla el motor','ratea'], l:[['mo','Cambio de bujías',0.7],['pieza','Bujía',4,9]]},
  {n:'Correa de accesorios', kw:['correa','chirrido al arrancar','silba'], l:[['mo','Sustitución de correa de accesorios y tensor',1],['pieza','Correa de accesorios',1,35],['pieza','Tensor de correa',1,45]]},
  {n:'Refrigeración / termostato', kw:['calienta','temperatura','refrigerante','radiador','termostato'], l:[['mo','Diagnosis del circuito de refrigeración',0.5],['mo','Sustitución de termostato',1],['pieza','Termostato',1,35],['pieza','Líquido refrigerante (litro)',4,4]]},
  {n:'Escape', kw:['escape','silencioso','ruido de escape','tubo de escape'], l:[['mo','Sustitución de silencioso de escape',1],['pieza','Silencioso trasero',1,90]]},
  {n:'Escobillas', kw:['escobilla','limpiaparabrisas'], l:[['mo','Cambio de escobillas',0.2],['pieza','Juego de escobillas',1,25]]},
  {n:'Bombillas', kw:['bombilla','faro','luz fundida','luces'], l:[['mo','Cambio de bombillas',0.3],['pieza','Bombilla',2,8]]},
  {n:'Revisión pre-ITV', kw:['itv','pre itv'], l:[['mo','Revisión pre-ITV',0.5]]}
];
const jobLines = jb => jb.l.map(([tipo, desc, cant, precio]) => ({tipo, desc, cant, precio: tipo === 'mo' ? +S.cfg.tarifa || 45 : precio || 0}));
const jobPrice = jb => r2(jobLines(jb).reduce((s, l) => s + l.cant * l.precio, 0));
function suggestJobs(text) {
  const f = fold(text); if (f.length < 3) return [];
  return JOBS.map(j => ({j, hits:j.kw.filter(k => f.includes(fold(k))).length})).filter(x => x.hits).sort((a, b) => b.hits - a.hits).slice(0, 4).map(x => x.j);
}
function sugBox() {
  const box = $('#ed-sug'); if (!box || !D) return;
  const s = suggestJobs(D.averia);
  box.innerHTML = s.length ? `<div class="eyebrow" style="margin-bottom:6px">Sugerencias para esta avería</div><div class="stack" style="gap:6px">${s.map(j => `<button class="item card" style="border-radius:12px" data-a="addjobtpl" data-id="${JOBS.indexOf(j)}"><div class="grow"><div class="t">${esc(j.n)}</div><div class="s">${j.l.map(x => x[0] === 'mo' ? x[2] + ' h' : x[1]).join(' · ')}</div></div><div class="amt num" style="font-size:17px">≈ ${eur(jobPrice(j))}</div></button>`).join('')}</div><div class="muted tiny" style="margin-top:4px">Precio orientativo sin IVA con tu tarifa de ${eur(S.cfg.tarifa)}/h y piezas a precio medio. Ajusta las piezas a lo que te cuesten.</div>` : '';
}
function jobsCatalogSheet() {
  openSheet({live:false, render:() => ({title:'Trabajos habituales', body:`<div class="muted small">Toca uno para añadir sus líneas al presupuesto. Precios sin IVA, orientativos.</div><div class="list">${JOBS.map((j, i) => `<button class="item" data-a="addjobtpl" data-id="${i}"><div class="grow"><div class="t">${esc(j.n)}</div><div class="s">${j.l.map(x => x[0] === 'mo' ? x[2] + ' h' : x[1]).join(' · ')}</div></div><div class="amt num" style="font-size:17px">≈ ${eur(jobPrice(j))}</div></button>`).join('')}</div>`})});
}

/* ---------- Códigos de descuento ---------- */
const descuentos = () => Object.entries(docs).filter(([, d]) => d.t === 'descuento').map(([id, d]) => ({...d, id})).sort((a, b) => (b.creado || '').localeCompare(a.creado || ''));
function dtoValid(code) {
  const d = descuentos().find(x => x.codigo === String(code || '').trim().toUpperCase());
  if (!d) return {ok:false, msg:'Ese código no existe.'};
  if (d.hasta && d.hasta < todayISO()) return {ok:false, msg:'Ese código caducó el ' + fdate(d.hasta) + '.'};
  if (d.usosMax && (d.usos || 0) >= d.usosMax) return {ok:false, msg:'Ese código ya se ha usado todas las veces previstas.'};
  return {ok:true, d};
}
const dtoText = d => d.tipo === 'pct' ? d.valor + ' %' : eur(d.valor);
function descuentosSheet() {
  openSheet({live:true, render:() => { const arr = descuentos(); return {title:'Códigos de descuento', right:`<button class="iconbtn" data-a="newdto" aria-label="Nuevo código">${ICON.plus}</button>`, body:`
    <div class="muted small">Crea códigos para promociones o para premiar a los clientes que repiten. Se aplican en el presupuesto.</div>
    ${arr.length ? `<div class="list">${arr.map(d => { const vivo = dtoValid(d.codigo).ok; return `<button class="item" data-a="dto" data-id="${d.id}"><div class="grow"><div class="t num">${esc(d.codigo)} · ${dtoText(d)}</div><div class="s">${esc(d.nota || '')}${d.hasta ? ' · hasta ' + fdate(d.hasta) : ''} · usado ${d.usos || 0}${d.usosMax ? '/' + d.usosMax : ''} veces</div></div><span class="pill ${vivo ? 'p-cobrado' : 'p-rechazado'}">${vivo ? 'Activo' : 'Agotado'}</span></button>`; }).join('')}</div>` : `<div class="card empty"><div class="muted">Aún no hay códigos.</div><button class="btn primary" data-a="newdto">Crear el primero</button></div>`}`}; }});
}
function dtoForm(id) {
  const d = id ? byId(id) : {codigo:'', tipo:'pct', valor:10, hasta:addDays(todayISO(), 60), usosMax:'', nota:''};
  if (!id) { const a = new Uint8Array(3); crypto.getRandomValues(a); d.codigo = 'LB' + Array.from(a, b => CROCK[b % 32]).join('') + '10'; }
  openSheet({live:false, render:() => ({title:id ? 'Código ' + d.codigo : 'Nuevo código', body:`
    <label class="f">Código <span class="h">Lo que el cliente te dirá o enseñará</span><input class="in num" id="dt-cod" value="${esc(d.codigo)}" autocapitalize="characters" style="text-transform:uppercase;font-weight:700"></label>
    <div class="grid2 keep"><label class="f">Tipo<select class="in" id="dt-tipo"><option value="pct" ${d.tipo === 'pct' ? 'selected' : ''}>Porcentaje (%)</option><option value="eur" ${d.tipo === 'eur' ? 'selected' : ''}>Importe fijo (€)</option></select></label><label class="f">Valor<input class="in num" id="dt-val" inputmode="decimal" value="${esc(String(d.valor).replace('.', ','))}"></label></div>
    <div class="grid2 keep"><label class="f">Válido hasta<input class="in" id="dt-hasta" type="date" value="${esc(d.hasta)}"></label><label class="f">Usos máximos <span class="h">Vacío = sin límite</span><input class="in num" id="dt-max" inputmode="numeric" value="${esc(d.usosMax)}"></label></div>
    <label class="f">Para qué es<input class="in" id="dt-nota" value="${esc(d.nota)}" placeholder="Clientes que repiten, campaña de invierno…"></label>
    ${id ? `<button class="btn block" data-a="dto-share" data-id="${id}">${ICON.wa}Enviar el código por WhatsApp</button>` : ''}`,
    foot:`${id ? `<button class="btn danger" data-a="deldto" data-id="${id}">Borrar</button>` : ''}<button class="btn primary block" data-a="savedto" data-id="${id || ''}">Guardar código</button>`})});
}

/* ---------- Fotos de coches, piezas y clientes ---------- */
let photoTarget = null; const photoURL = {};
async function hydratePhotos(root) {
  const imgs = (root || document).querySelectorAll('img[data-file]:not([src])');
  for (const im of imgs) { const id = im.dataset.file; if (!photoURL[id]) { const b = await Store.getFile(id); if (b) photoURL[id] = URL.createObjectURL(b); } if (photoURL[id]) im.src = photoURL[id]; else im.alt = 'Foto no disponible'; }
}
function photoGrid(kind, id, fotos) {
  return `<div class="pgrid">${(fotos || []).map(f => `<button class="pthumb" data-a="photoview" data-id="${kind}|${id}|${f}"><img data-file="${f}" alt="Foto"></button>`).join('')}<button class="pthumb padd" data-a="photoadd" data-id="${kind}|${id}|cam" aria-label="Hacer foto">${ICON.cam}</button><button class="pthumb padd" data-a="photoadd" data-id="${kind}|${id}|gal" aria-label="Foto de la galería">${ICON.img}</button></div>`;
}
async function attachPhoto(file) {
  const tgt = photoTarget; photoTarget = null; if (!tgt) return;
  try {
    const {color} = await compress(file, 1600, 0.8); const fid = newId('f_');
    if (!(await Store.putFile(fid, color))) { toast('Este móvil no permite guardar fotos en la app.'); return; }
    const d = docs[tgt.id]; await Store.put(tgt.id, {...d, fotos:[...(d.fotos || []), fid]}); toast('Foto añadida');
  } catch (e) { toast('No se pudo guardar la foto.'); }
}
function photoView(v) {
  const [kind, id, fid] = v.split('|');
  openSheet({live:false, render:() => ({title:'Foto', body:`<img class="photo" style="max-height:70vh" data-file="${fid}" alt="Foto">${kind === 'trabajo' ? `<div class="muted small">Las fotos del trabajo salen en una página extra del PDF de la factura y del presupuesto.</div>` : ''}`, foot:`<button class="btn danger block" data-a="photodel" data-id="${v}">Quitar esta foto</button>`}), after:() => hydratePhotos($('#sheet'))});
}
function pickJobForPhoto() {
  const arr = S.trabajos.filter(j => !j.simplificada && !['cobrado', 'rechazado'].includes(j.estado));
  openSheet({live:false, render:() => ({title:'Foto del coche o pieza', body:`<div class="muted small">¿A qué trabajo la añadimos? Saldrá con su presupuesto y factura.</div>${arr.length ? `<div class="list">${arr.map(j => `<button class="item" data-a="photojob" data-id="${j.id}">${plate(j.matricula)}<div class="grow"><div class="t">${esc(cliOf(j).nombre)}</div><div class="s">${esc(j.numPresupuesto)} · ${esc(ESTADOS[j.estado])}</div></div>${ICON.cam}</button>`).join('')}</div>` : `<div class="card empty"><div class="muted">No hay trabajos abiertos. Crea primero el presupuesto.</div></div>`}`})});
}

/* ---------- Horas reales ---------- */
const horasReales = j => r2((j.horas || []).reduce((s, h) => s + (+h.horas || 0), 0));
const horasCobradas = j => r2((j.lineas || []).filter(l => l.tipo === 'mo').reduce((s, l) => s + (+l.cant || 0), 0));
function gesto(j) { const extra = r2(horasReales(j) - horasCobradas(j)); return extra > 0.04 ? {horas:extra, valor:r2(extra * (+S.cfg.tarifa || 0))} : null; }
function horasSheet(jobId) {
  openSheet({live:false, render:() => ({title:'Apuntar horas', body:`
    <div class="grid2 keep"><label class="f">Día<input class="in" id="hr-fecha" type="date" value="${todayISO()}"></label><label class="f">Horas<input class="in num" id="hr-h" inputmode="decimal" placeholder="1,5"></label></div>
    <div class="chips">${[0.5, 1, 1.5, 2, 3, 4, 8].map(h => `<button class="chip" data-a="hrpick" data-id="${h}">${String(h).replace('.', ',')} h</button>`).join('')}</div>
    <label class="f">Qué se hizo <span class="h">Opcional</span><input class="in" id="hr-nota" placeholder="Desmontaje, prueba en carretera…"></label>`,
    foot:`<button class="btn primary block" data-a="hrsave" data-id="${jobId}">Guardar horas</button>`})});
}

/* ---------- Cuentas deudoras e impagos ---------- */
const INTERES_DEMORA = 4.0625; // interés de demora 2026 (OCU / LPGE prorrogada)
function deudaDe(cliId) {
  const c = byId(cliId); const cfg = (c && c.deuda) || null;
  const facts = S.trabajos.filter(j => j.clienteId === cliId && j.estado === 'facturado');
  const rows = facts.map(j => {
    const pend = pendiente(j); const plazo = cfg ? +cfg.plazo || 30 : 30;
    const vence = addDays(j.fechaFactura, plazo); const tarde = Math.max(0, daysBetween(vence, todayISO()));
    const int = cfg && cfg.abierta ? r2(pend * (+cfg.interes || 0) / 100 * tarde / 365) : 0;
    return {j, pend, vence, tarde, int};
  });
  return {cfg, rows, pend:r2(rows.reduce((s, r) => s + r.pend, 0)), int:r2(rows.reduce((s, r) => s + r.int, 0))};
}
function deudaForm(cliId) {
  const c = byId(cliId); const d = c.deuda || {abierta:true, plazo:30, interes:INTERES_DEMORA};
  openSheet({live:false, render:() => ({title:'Cuenta deudora', body:`
    <div class="note small">Al abrir la cuenta deudora, las facturas de ${esc(c.nombre)} empiezan a generar intereses desde su vencimiento. Avísale por escrito del plazo y del interés antes de cobrarlos.</div>
    <div class="grid2 keep"><label class="f">Plazo de pago (días)<input class="in num" id="dd-plazo" inputmode="numeric" value="${esc(d.plazo)}"></label><label class="f">Interés anual %<input class="in num" id="dd-int" inputmode="decimal" value="${esc(String(d.interes).replace('.', ','))}"></label></div>
    <div class="muted tiny">Por defecto, el interés de demora de 2026 (${String(INTERES_DEMORA).replace('.', ',')} %). Entre empresas, la ley de morosidad permite un tipo más alto: consúltalo con tu gestor.</div>`,
    foot:`${c.deuda && c.deuda.abierta ? `<button class="btn" data-a="deudaclose" data-id="${cliId}">Cerrar cuenta</button>` : ''}<button class="btn primary block" data-a="deudasave" data-id="${cliId}">${c.deuda && c.deuda.abierta ? 'Guardar' : 'Abrir cuenta deudora'}</button>`})});
}
function stageOf(days) {
  if (days < 7) return {n:0, t:'Recién facturado', a:'Envía la factura con el enlace de pago.'};
  if (days < 15) return {n:1, t:'Recordatorio amable', a:'Un mensaje corto y educado recordando el importe.'};
  if (days < 30) return {n:2, t:'Segundo aviso', a:'Llámale y ofrécele pagar en dos o tres plazos.'};
  if (days < 60) return {n:3, t:'Requerimiento', a:'Abre su cuenta deudora con intereses y envíale un requerimiento por escrito con fecha límite.'};
  return {n:4, t:'Reclamación', a:'Requerimiento por burofax y, si no paga, procedimiento monitorio en el juzgado (la petición inicial no necesita abogado).'};
}
function reminderText(j) {
  const c = cliOf(j); const days = daysBetween(j.fechaFactura, todayISO()); const st = stageOf(days); const p = eur(pendiente(j));
  const pay = (S.cfg.linkPago ? '\nPago con tarjeta: ' + S.cfg.linkPago : '') + (S.cfg.iban ? '\nTransferencia: ' + S.cfg.iban : '');
  if (st.n <= 1) return `Hola ${c.nombre || ''}, le recuerdo que tiene pendiente la factura ${j.numFactura} de su ${showPlate(j.matricula)} por ${p}.${pay}\nGracias, ${S.cfg.propietario} · ${S.cfg.taller}.`;
  if (st.n === 2) return `Hola ${c.nombre || ''}, la factura ${j.numFactura} (${p}) lleva ${days} días pendiente. Si le va mejor, podemos dividirla en plazos: dígame qué le encaja.${pay}\n${S.cfg.propietario} · ${S.cfg.taller}.`;
  const d = deudaDe(j.clienteId); const r = d.rows.find(x => x.j.id === j.id);
  return `Estimado/a ${c.nombre || ''}: la factura ${j.numFactura} de fecha ${fdate(j.fechaFactura)} por ${p} sigue sin pagarse. Le rogamos el pago antes del ${fdate(addDays(todayISO(), 10))}.${d.cfg && d.cfg.abierta ? ' Desde su vencimiento se aplican intereses de demora del ' + String(d.cfg.interes).replace('.', ',') + ' % anual' + (r && r.int ? ' (a día de hoy, ' + eur(r.int) + ')' : '') + '.' : ''} En caso contrario, iniciaremos la reclamación.${pay}\n${S.cfg.propietario} · NIF ${S.cfg.nif || ''} · ${S.cfg.taller}.`;
}
function impagadosSheet() {
  openSheet({live:true, render:() => {
    const arr = S.trabajos.filter(j => j.estado === 'facturado').map(j => ({j, days:daysBetween(j.fechaFactura, todayISO())})).sort((a, b) => b.days - a.days);
    const sinResp = S.trabajos.filter(j => j.estado === 'enviado' && daysBetween((j.enviadoFecha || j.fecha), todayISO()) >= 3);
    return {title:'Cobros pendientes', body:`
      <div class="card"><div class="kv"><span>Pendiente de cobro</span><span class="v">${eur(arr.reduce((s, x) => s + pendiente(x.j), 0))}</span></div><div class="kv"><span>Facturas</span><span class="v">${arr.length}</span></div></div>
      ${arr.length ? arr.map(({j, days}) => { const st = stageOf(days); const dd = deudaDe(j.clienteId); const r = dd.rows.find(x => x.j.id === j.id); return `<div class="card stack" style="gap:8px">
        <button class="row" data-a="job" data-id="${j.id}" style="border:0;background:none;padding:0;text-align:left;cursor:pointer">${plate(j.matricula)}<div class="grow"><b>${esc(cliOf(j).nombre)}</b><div class="muted small">${esc(j.numFactura)} · hace ${days} días</div></div><div class="amt num" style="font-family:var(--f-display);font-weight:700;font-size:20px">${eur(pendiente(j))}</div></button>
        <div class="steps">${[0, 1, 2, 3].map(k => `<div class="step ${k <= Math.min(3, st.n) ? 'on' : ''}" ${st.n >= 3 && k <= st.n ? 'style="background:var(--bad)"' : ''}></div>`).join('')}</div>
        <div><b>${st.t}.</b> ${st.a}${r && r.int ? ` <span class="neg">Intereses: ${eur(r.int)}</span>` : ''}</div>
        <div class="grid2 keep">${cliOf(j).telefono ? `<button class="btn sm" data-a="remind" data-id="${j.id}">${ICON.wa}Enviar aviso</button>` : `<span></span>`}${j.clienteId ? `<button class="btn sm" data-a="deuda" data-id="${j.clienteId}">${dd.cfg && dd.cfg.abierta ? 'Cuenta deudora' : 'Abrir cuenta deudora'}</button>` : ''}</div>
        ${(j.recordatorios || []).length ? `<div class="muted tiny">Avisos enviados: ${j.recordatorios.map(x => fdate(x)).join(', ')}</div>` : ''}</div>`; }).join('') : `<div class="card empty"><div class="muted">No hay facturas pendientes de cobro.</div></div>`}
      ${sinResp.length ? `<div class="section-h"><h2>Presupuestos sin respuesta</h2></div><div class="muted small">Llevan 3 días o más enviados. Una llamada corta suele cerrar la mitad.</div><div class="list">${sinResp.map(jobItem).join('')}</div>` : ''}`};
  }});
}

/* ---------- Tareas ---------- */
const tareas = () => Object.entries(docs).filter(([, d]) => d.t === 'tarea').map(([id, d]) => ({...d, id}));
function autoTasks() {
  const out = []; const t = todayISO();
  S.trabajos.filter(j => j.estado === 'aceptado' && !j.piezasPedidas && (j.lineas || []).some(l => l.tipo === 'pieza')).forEach(j => out.push({auto:'piezas', id:j.id, txt:'Pedir piezas: ' + j.lineas.filter(l => l.tipo === 'pieza').map(l => l.desc).slice(0, 3).join(', '), sub:showPlate(j.matricula) + ' · ' + cliOf(j).nombre}));
  nextDeadlines(3).filter(e => daysTo(e.fecha) <= 15).forEach(e => out.push({auto:'hacienda', id:e.key, txt:'Presentar modelo ' + e.modelos, sub:'Hasta el ' + fdate(e.fecha) + ' · quedan ' + daysTo(e.fecha) + ' días'}));
  S.trabajos.filter(j => j.estado === 'facturado' && daysBetween(j.fechaFactura, t) >= 7 && !(j.recordatorios || []).some(r => daysBetween(r, t) < 7)).forEach(j => out.push({auto:'cobro', id:j.id, txt:'Reclamar ' + eur(pendiente(j)) + ' a ' + cliOf(j).nombre, sub:j.numFactura + ' · hace ' + daysBetween(j.fechaFactura, t) + ' días'}));
  S.trabajos.filter(j => j.estado === 'enviado' && daysBetween(j.enviadoFecha || j.fecha, t) >= 3).forEach(j => out.push({auto:'llamar', id:j.id, txt:'Llamar por el presupuesto ' + j.numPresupuesto, sub:cliOf(j).nombre + ' · ' + eur(totals(j).total)}));
  return out;
}
function taskItem(x) {
  if (x.auto) return `<div class="item static"><button class="tick" data-a="autodone" data-id="${x.auto}|${x.id}" aria-label="Hecho"></button><div class="grow"><div class="t" style="white-space:normal">${esc(x.txt)}</div><div class="s">${esc(x.sub)}</div></div></div>`;
  return `<div class="item static"><button class="tick ${x.hecho ? 'on' : ''}" data-a="taskdone" data-id="${x.id}" aria-label="Hecho"></button><div class="grow"><div class="t" style="white-space:normal;${x.hecho ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(x.texto)}</div><div class="s">${x.fecha ? fdate(x.fecha) : 'Sin fecha'}</div></div></div>`;
}
function tasksSheet() {
  openSheet({live:true, render:() => { const man = tareas().filter(x => !x.hecho || x.hecho === todayISO()).sort((a, b) => (a.fecha || '9').localeCompare(b.fecha || '9')); const au = autoTasks();
    return {title:'Tareas', body:`
      <div class="row"><input class="in grow" id="tk-txt" placeholder="Nueva tarea: llamar al proveedor…"><input class="in" id="tk-fecha" type="date" value="${todayISO()}" style="width:150px"></div>
      <button class="btn primary block" data-a="taskadd">Añadir tarea</button>
      ${au.length ? `<div class="section-h"><h2>La app te recuerda</h2></div><div class="list">${au.map(taskItem).join('')}</div>` : ''}
      <div class="section-h"><h2>Tus tareas</h2></div>${man.length ? `<div class="list">${man.map(taskItem).join('')}</div>` : '<div class="muted small">Sin tareas pendientes.</div>'}`}; }});
}

/* ---------- Resumen diario ---------- */
function briefSheet() {
  openSheet({live:true, render:() => {
    const t = todayISO(), ay = addDays(t, -1);
    const cy = caja(ay, ay); const pm = periodRange('mes', t); const cm = caja(pm.from, t);
    const acept = S.trabajos.filter(j => j.estado === 'aceptado'); const sinR = S.trabajos.filter(j => j.estado === 'enviado' || j.estado === 'borrador');
    const hoy = S.citas.filter(c => c.fecha === t && c.estado !== 'novino');
    const prox = [1, 2, 3].map(n => addDays(t, n)).map(d => ({d, cs:S.citas.filter(c => c.fecha === d && c.estado !== 'novino')}));
    const au = autoTasks(); const man = tareas().filter(x => !x.hecho && (!x.fecha || x.fecha <= t));
    const plan = [];
    hoy.forEach(c => plan.push(`<b>${esc(c.hora)}</b> · ${esc(c.nombre || cliOf(c).nombre)}${c.matricula ? ' (' + esc(showPlate(c.matricula)) + ')' : ''}: ${esc(c.motivo || 'cita')}`));
    au.filter(x => x.auto === 'piezas').forEach(x => plan.push('A primera hora: ' + esc(x.txt.toLowerCase()) + ' para tenerlas a tiempo'));
    acept.forEach(j => plan.push('Avanzar en ' + esc(showPlate(j.matricula)) + ' · ' + esc(j.averia || carName(vehOf(j)) || j.numPresupuesto) + ` (≈ ${String(horasCobradas(j)).replace('.', ',')} h)`));
    au.filter(x => x.auto === 'llamar' || x.auto === 'cobro').forEach(x => plan.push('Llamada: ' + esc(x.txt)));
    au.filter(x => x.auto === 'hacienda').forEach(x => plan.push('Gestor: ' + esc(x.txt) + ' · ' + esc(x.sub)));
    man.forEach(x => plan.push(esc(x.texto)));
    return {title:'Buenos días, ' + (S.cfg.propietario || ''), body:`
      ${licBanner()}
      <div class="card talk">Ayer ${cy.fac.length ? `facturaste <b class="num">${eur(cy.fac.reduce((s, j) => s + totals(j).total, 0))}</b> en ${cy.fac.length} ${cy.fac.length === 1 ? 'factura' : 'facturas'}` : 'no hiciste facturas'} y cobraste <b class="num">${eur(cy.entradas)}</b>. En lo que va de mes llevas <b class="num ${cm.saldo >= 0 ? 'pos' : 'neg'}">${eur(cm.saldo)}</b> de caja y un beneficio limpio de <b class="num">${eur(cm.limpio)}</b>.</div>
      <div class="kpis"><div class="kpi"><div class="k">Aceptados</div><div class="v num">${acept.length}</div></div><div class="kpi"><div class="k">Sin respuesta</div><div class="v num">${sinR.length}</div></div><div class="kpi"><div class="k">Citas hoy</div><div class="v num">${hoy.length}</div></div></div>
      <div class="section-h"><h2>Tu día</h2></div>
      ${plan.length ? `<div class="card"><ol class="plan">${plan.map(p => `<li>${p}</li>`).join('')}</ol></div>` : `<div class="muted small">Día libre de citas y tareas. Buen momento para llamar a los presupuestos sin respuesta o para ordenar el taller.</div>`}
      <div class="section-h"><h2>Próximos días</h2></div>
      <div class="list">${prox.map(p => `<button class="item" data-a="agday-go" data-id="${p.d}"><div class="grow"><div class="t" style="text-transform:capitalize">${esc(longDate(p.d))}</div><div class="s">${p.cs.length ? p.cs.map(c => c.hora + ' ' + (c.nombre || '')).join(' · ') : openRanges(p.d).length ? 'Sin citas' : 'Cerrado'}</div></div>${ICON.chevR}</button>`).join('')}</div>
      ${au.length || man.length ? `<div class="section-h"><h2>Tareas</h2></div><div class="list">${au.map(taskItem).join('')}${man.map(taskItem).join('')}</div>` : ''}`,
      foot:`<button class="btn primary block" data-a="back">Empezar el día</button>`};
  }});
}

/* ---------- Administración e impuestos ---------- */
const OBLIG = [
  {m:'036 / 037', t:'Alta en Hacienda', c:'Al empezar o cambiar la actividad (epígrafe IAE 691.2, reparación de vehículos).', a:'Lo tramita el gestor una vez. Avísale si cambias de local o de actividad.'},
  {m:'RETA', t:'Cuota de autónomos', c:'Cada mes, en la Seguridad Social. La cuota depende de tus rendimientos.', a:'Apúntala como gasto «Cuota autónomos»: es deducible.'},
  {m:'303', t:'IVA trimestral', c:'Hasta el 20 de abril, julio y octubre, y el 30 de enero.', a:'La app suma el IVA de tus facturas y el de tus compras.'},
  {m:'130', t:'Pago a cuenta del IRPF', c:'Mismas fechas que el 303. El 20 % del beneficio acumulado del año.', a:'La app lo calcula con tus facturas y gastos.'},
  {m:'390', t:'Resumen anual de IVA', c:'Hasta el 30 de enero.', a:'Lo prepara el gestor con los cuatro 303 del año.'},
  {m:'347', t:'Operaciones con terceros', c:'En febrero, si con un cliente o proveedor superas 3.005,06 € al año.', a:'Mira tus proveedores grandes en Proveedores.'},
  {m:'115 / 180', t:'Retenciones del alquiler', c:'Si alquilas el local a un particular o empresa: 19 % cada trimestre y resumen en enero.', a:'Actívalo en Ajustes si te aplica.'},
  {m:'111 / 190', t:'Retenciones de trabajadores', c:'Si tienes empleados: cada trimestre y resumen en enero.', a:'Actívalo en Ajustes si te aplica.'},
  {m:'100', t:'Declaración de la renta', c:'De abril a finales de junio.', a:'Los pagos del 130 se restan de lo que salga.'},
  {m:'Libros', t:'Registro de facturas', c:'Facturas emitidas y recibidas, guardadas al menos 4 años.', a:'La app los lleva y los descarga para el gestor.'},
  {m:'Verifactu', t:'Facturación verificable', c:'Obligatorio para autónomos desde el 1 de julio de 2027.', a:'La app se adaptará antes de esa fecha.'}
];
function adminSheet() {
  openSheet({live:false, render:() => { const dl = nextDeadlines(3); return {title:'Administración', body:`
    <div class="section-h"><h2>Próximos plazos</h2><button class="btn sm" data-a="hacienda">Calendario y modelos</button></div>
    <div class="list">${dl.map(e => { const d = daysTo(e.fecha); const dt = parseISO(e.fecha); return `<div class="deadline ${d <= 15 ? 'soon' : ''}"><div class="dbox"><b>${dt.getDate()}</b><span>${MES[dt.getMonth()].slice(0, 3)}</span></div><div class="grow"><div style="font-weight:700">Modelo ${esc(e.modelos)}</div><div class="muted small">${esc(e.desc)} · quedan ${d} días</div></div></div>`; }).join('')}</div>
    <div class="section-h"><h2>Tus obligaciones</h2></div>
    <div class="list">${OBLIG.map(o => `<details class="item static" style="display:block"><summary style="cursor:pointer;display:flex;gap:12px;align-items:center"><span class="obl">${esc(o.m)}</span><span class="grow t" style="white-space:normal">${esc(o.t)}</span></summary><div class="small" style="margin:8px 0 2px 0">${esc(o.c)}</div><div class="small muted">${esc(o.a)}</div></details>`).join('')}</div>
    <div class="muted tiny">Guía general para un autónomo en estimación directa. Tu gestor confirma qué te aplica.</div>`}; }});
}

/* Bloques extra en la ficha del trabajo */
function jobExtras(j) {
  const hr = horasReales(j), hc = horasCobradas(j), g = gesto(j);
  const piezas = (j.lineas || []).filter(l => l.tipo === 'pieza');
  return `
    ${j.estado === 'aceptado' && piezas.length ? `<label class="card check"><input type="checkbox" data-a="piezas" data-id="${j.id}" ${j.piezasPedidas ? 'checked' : ''}> Piezas pedidas (${piezas.length})</label>` : ''}
    <div class="card stack" style="gap:8px"><div class="row"><div class="eyebrow grow">Horas reales</div><button class="btn sm" data-a="horas" data-id="${j.id}">+ Apuntar</button></div>
      <div class="row"><div class="grow"><div class="muted small">Trabajadas</div><b class="num" style="font-size:20px">${String(hr).replace('.', ',')} h</b></div><div class="grow"><div class="muted small">Cobradas</div><b class="num" style="font-size:20px">${String(hc).replace('.', ',')} h</b></div></div>
      ${hc ? `<div class="bar"><i style="width:${Math.min(100, hr / hc * 100)}%;${hr > hc ? 'background:var(--warn)' : ''}"></i></div>` : ''}
      ${(j.horas || []).map((h, i) => `<div class="kv"><span>${fdate(h.fecha)}${h.nota ? ' · ' + esc(h.nota) : ''}</span><span class="v">${String(h.horas).replace('.', ',')} h <button class="btn sm danger" data-a="hrdel" data-id="${j.id}|${i}" aria-label="Quitar">×</button></span></div>`).join('')}
      ${g ? `<div class="note warn small">Has trabajado ${String(g.horas).replace('.', ',')} h más de lo presupuestado (${eur(g.valor)}). ${j.numFactura ? '' : 'Puedes ajustar el presupuesto o regalárselo al cliente como gesto comercial.'}</div>
        <label class="check small"><input type="checkbox" data-a="gesto" data-id="${j.id}" ${j.mostrarGesto ? 'checked' : ''}> Mostrar al cliente las horas no cobradas en el presupuesto y la factura</label>
        ${!j.numFactura ? `<button class="btn sm" data-a="hrajustar" data-id="${j.id}">Ajustar el presupuesto a las horas reales</button>` : ''}` : ''}
    </div>
    <div class="card stack" style="gap:8px"><div class="eyebrow">Fotos del coche y las piezas</div>${photoGrid('trabajo', j.id, j.fotos)}</div>`;
}

/* ---------- acciones ---------- */
const A = {
  noop: () => {},
  tab: id => { tab = id; if (id === 'inicio') qHome = ''; closeAll(); render(); window.scrollTo(0, 0); },
  back: () => closeSheet(),
  settings: () => settings(),
  resumen: () => { closeAll(); resMode = 'dia'; resAnchor = todayISO(); resumenSheet(); },
  resmode: k => { resMode = k; resAnchor = todayISO(); renderSheet(false); },
  resshift: d => { resAnchor = shiftAnchor(resMode, resAnchor, +d); renderSheet(false); },
  ultimos: () => { closeAll(); ultimosSheet(); },
  cobro: () => { closeAll(); cobroSheet(); },
  padkey: k => {
    if (k === '⌫') payAmt = payAmt.slice(0, -1);
    else if (k === ',') { if (!payAmt.includes(',')) payAmt = (payAmt || '0') + ','; }
    else { if (/,\d{2}$/.test(payAmt) || payAmt.replace(',', '').length >= 7) return; payAmt = payAmt === '0' ? k : payAmt + k; }
    $('#pay-amt').textContent = (payAmt || '0') + ' €'; payList();
  },
  paydirect: () => { const a = parseNum(payAmt); if (!a) { toast('Escribe el importe con el teclado.'); return; } metodoSheet({importe:a}); },
  paypick: id => { const a = parseNum(payAmt) || pendiente(byId(id)); metodoSheet({importe:a, jobId:id}); },
  payjob: id => metodoSheet({importe:pendiente(byId(id)), jobId:id}),
  payok: m => registerPay(m),
  filtro: id => { filtro = id; render(); },
  'focus-search': () => { const i = $('#q-home'); i.focus(); i.scrollIntoView({block:'center'}); },
  newjob: () => jobEditor(null),
  newjobplate: p => { const vin = p.length === 17; jobEditor(null, vin ? {_veh:{bastidor:p}} : {matricula:p}); },
  newjobcli: id => { const v = S.vehiculos.find(v => v.clienteId === id); jobEditor(null, v ? {vehiculoId:v.id, clienteId:id, matricula:v.matricula} : {clienteId:id}); },
  newjobveh: id => { const v = byId(id); jobEditor(null, {vehiculoId:id, clienteId:v.clienteId, matricula:v.matricula}); },
  editjob: id => jobEditor(byId(id)),
  job: id => openJob(id),
  addline: tipo => { D.lineas.push({tipo, desc:'', cant:1, precio:tipo === 'mo' ? +S.cfg.tarifa || 0 : 0}); edLines(); edTot(); const ins = $$('#ed-lines input[data-f="desc"]'); ins[ins.length - 1].focus(); },
  addconc: i => { const c = S.cfg.conceptos[+i]; D.lineas.push({tipo:c.tipo, desc:c.desc, cant:+c.cant || 1, precio:+c.precio || 0}); edLines(); edTot(); toast('Añadido: ' + c.desc); },
  delline: i => { D.lineas.splice(+i, 1); edLines(); edTot(); },
  ltipo: v => { const [i, k] = v.split(':'); D.lineas[+i].tipo = k; if (k === 'mo' && !D.lineas[+i].precio) D.lineas[+i].precio = +S.cfg.tarifa || 0; edLines(); edTot(); },
  savejob: () => saveJob(),
  deljob: async (id, el) => { if (el.dataset.sure) { await Store.del(id); closeSheet(); toast('Presupuesto borrado'); } else { el.dataset.sure = '1'; el.textContent = 'Toca otra vez para borrarlo'; } },
  'wa-pres': async id => { const j = byId(id); openURL(waLink(cliOf(j).telefono, presText(j))); if (j.estado === 'borrador') await Store.put(id, {...docs[id], estado:'enviado', enviadoFecha:todayISO()}); },
  'accept-wa': async id => { await Store.put(id, {...docs[id], estado:'aceptado', aceptadoFecha:todayISO(), aceptadoVia:'whatsapp'}); toast('Presupuesto aceptado'); },
  reject: async id => { await Store.put(id, {...docs[id], estado:'rechazado'}); toast('Marcado como rechazado'); },
  reopen: async id => { await Store.put(id, {...docs[id], estado:'borrador'}); },
  sign: id => signSheet(id),
  sigclear: () => { const cv = $('#sig'); cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); sigDirty = false; },
  sigok: async id => { if (!sigDirty) { toast('Falta la firma del cliente.'); return; } await Store.put(id, {...docs[id], estado:'aceptado', firma:sigData(), aceptadoFecha:todayISO(), aceptadoVia:'firma', aceptadoNombre:$('#sg-name').value.trim()}); closeSheet(); toast('Aceptado y firmado'); },
  invoice: id => invoiceSheet(id),
  invok: async id => {
    const nombre = $('#fx-nombre').value.trim(), nif = $('#fx-nif').value.trim().toUpperCase(), direccion = $('#fx-dir').value.trim();
    if (!nombre) { toast('Falta el nombre del cliente.'); return; }
    const j = docs[id];
    if (j.clienteId && docs[j.clienteId]) await Store.put(j.clienteId, {...docs[j.clienteId], nombre, nif, direccion});
    const num = j.ejemplo ? 'EJ-F-' + pad(Math.floor(Math.random() * 900) + 100, 4) : nextNum('F');
    await Store.put(id, {...docs[id], estado:'facturado', numFactura:num, fechaFactura:todayISO(), facturaCliente:{nombre, nif, direccion}, clienteNombre:nombre});
    closeSheet(); toast('Factura ' + num + ' creada');
  },
  'wa-pay': id => { const j = byId(id); const c = cliOf(j); openURL(waLink(c.telefono, `Hola ${c.nombre || ''}, su coche ${showPlate(j.matricula)} ya está listo.\n${j.numFactura ? 'Factura ' + j.numFactura + ': ' : 'Importe: '}*${eur(pendiente(j))}*.\nPuede pagar con tarjeta aquí: ${S.cfg.linkPago}\nGracias, ${S.cfg.taller}.`)); },
  'wa-fac': id => { const j = byId(id); const c = cliOf(j); openURL(waLink(c.telefono, `Hola ${c.nombre || ''}, le enviamos la factura ${j.numFactura} de su vehículo ${showPlate(j.matricula)}: total ${eur(totals(j).total)} (IVA incluido).${pendiente(j) ? '\nPendiente de pago: ' + eur(pendiente(j)) + '.' : ''}${S.cfg.linkPago ? '\nPago con tarjeta: ' + S.cfg.linkPago : ''}${S.cfg.iban ? '\nTransferencia: ' + S.cfg.iban : ''}\nGracias, ${S.cfg.taller}.`)); toast('Adjunta el PDF desde «Ver factura»'); },
  'wa-cli': id => { const c = byId(id); openURL(waLink(c.telefono, `Hola ${c.nombre}, `)); },
  doc: v => { const [id, k] = v.split(':'); docSheet(id, k); },
  pdf: v => { const [id, k] = v.split(':'); makePDF(id, k); },
  cli: id => { if (id) openCli(id); },
  newcli: () => cliForm(null),
  editcli: id => cliForm(id),
  savecli: async id => {
    const nombre = $('#cf-nombre').value.trim(); if (!nombre) { toast('Escribe el nombre.'); return; }
    const data = {...(id ? docs[id] : {t:'cliente', creado:new Date().toISOString()}), nombre, telefono:$('#cf-tel').value.trim(), nif:$('#cf-nif').value.trim().toUpperCase(), email:$('#cf-email').value.trim(), direccion:$('#cf-dir').value.trim(), notas:$('#cf-notas').value.trim()};
    const cid = id || newId('c_'); await Store.put(cid, data);
    const mat = $('#cf-mat'); if (mat && normPlate(mat.value)) { const mod = $('#cf-mod').value.trim().split(/\s+/); await Store.put(newId('v_'), {t:'vehiculo', clienteId:cid, matricula:normPlate(mat.value), marca:mod[0] || '', modelo:mod.slice(1).join(' '), creado:new Date().toISOString()}); }
    closeSheet(); if (!id) openCli(cid); toast('Cliente guardado');
  },
  delcli: async (id, el) => { if (el.dataset.sure) { const c = docs[id]; for (const f of (c.fotos || [])) await Store.delFile(f); for (const v of S.vehiculos.filter(v => v.clienteId === id)) await Store.del(v.id); await Store.del(id); closeAll(); toast('Cliente borrado'); } else { el.dataset.sure = '1'; el.textContent = S.trabajos.some(j => j.clienteId === id && j.numFactura) ? 'Sus facturas se conservan (lo exige la ley). Toca otra vez para eliminar' : 'Toca otra vez para eliminar el cliente y sus coches'; } },
  veh: id => { if (id) openVeh(id); },
  newveh: cid => vehForm(null, cid),
  editveh: id => vehForm(id),
  saveveh: async id => {
    const v = k => $('#' + k).value.trim();
    const mat = normPlate(v('vf-mat')); if (mat.length < 4) { toast('Escribe la matrícula.'); return; }
    const vin = normPlate(v('vf-vin')); if (vin && vin.length !== 17) { toast('El bastidor tiene 17 caracteres. Revísalo o déjalo vacío.'); return; }
    const dup = S.vehiculos.find(x => normPlate(x.matricula) === mat && x.id !== id); if (dup) { toast('Ya hay un coche con esa matrícula.'); return; }
    const data = {...(id ? docs[id] : {t:'vehiculo', creado:new Date().toISOString()}), matricula:mat, bastidor:vin, marca:v('vf-marca'), modelo:v('vf-modelo'), version:v('vf-version'), combustible:$('#vf-comb').value, anio:v('vf-anio'), potencia:v('vf-cv'), cilindrada:v('vf-cc'), color:v('vf-color'), km:v('vf-km').replace(/\D/g, ''), clienteId:$('#vf-cli').value || null};
    const vid = id || newId('v_'); await Store.put(vid, data); closeSheet(); if (!id) openVeh(vid); toast('Coche guardado');
  },
  delveh: async (id, el) => { if (el.dataset.sure) { await Store.del(id); closeAll(); toast('Coche borrado'); } else { el.dataset.sure = '1'; el.textContent = '¿Seguro?'; } },
  vinlookup: id => vinLookup(id),
  platelookup: id => plateLookup(id),
  agday: d => { agendaDay = d; render(); },
  agwk: d => { agendaDay = addDays(agendaDay, 7 * +d); render(); },
  newcita: () => citaForm(null),
  newcitaslot: v => { const [f, h] = v.split('|'); citaForm(null, {fecha:f, hora:h}); },
  newcitaveh: id => { const v = byId(id); const c = byId(v.clienteId) || {}; citaForm(null, {vehiculoId:id, clienteId:v.clienteId, matricula:v.matricula, nombre:c.nombre || '', telefono:c.telefono || ''}); },
  newcitacli: id => { const c = byId(id); const v = S.vehiculos.find(x => x.clienteId === id) || {}; citaForm(null, {clienteId:id, vehiculoId:v.id, matricula:v.matricula || '', nombre:c.nombre, telefono:c.telefono || ''}); },
  newcitajob: id => { const j = byId(id); const c = cliOf(j); citaForm(null, {clienteId:j.clienteId, vehiculoId:j.vehiculoId, matricula:j.matricula, nombre:c.nombre, telefono:c.telefono || '', motivo:j.averia || '', trabajoId:id}); },
  cita: id => citaForm(id),
  pickhora: h => { $('#ct-hora').value = h; $$('#ct-free .chip').forEach(c => c.classList.toggle('on', c.dataset.id === h)); },
  citaest: async v => { const [id, e] = v.split(':'); await Store.put(id, {...docs[id], estado:e}); closeSheet(); citaForm(id); },
  savecita: async id => {
    const g = k => $('#' + k).value.trim(); const pre = sheetStack[sheetStack.length - 1].preset || {};
    if (!g('ct-fecha') || !g('ct-hora')) { toast('Elige día y hora.'); return; }
    if (!g('ct-nombre') && !g('ct-mat')) { toast('Escribe al menos el nombre o la matrícula.'); return; }
    const mat = normPlate(g('ct-mat')); const v = mat && S.vehiculos.find(x => normPlate(x.matricula) === mat);
    const data = {...(id ? docs[id] : {t:'cita', estado:'pendiente', creado:new Date().toISOString()}), fecha:g('ct-fecha'), hora:g('ct-hora'), duracion:+$('#ct-dur').value, matricula:mat, nombre:g('ct-nombre'), telefono:g('ct-tel'), motivo:g('ct-motivo'), vehiculoId:v ? v.id : (pre.vehiculoId || null), clienteId:v ? v.clienteId : (pre.clienteId || null)};
    if (pre.trabajoId && !id) data.trabajoId = pre.trabajoId;
    const clash = S.citas.find(c => c.id !== id && c.fecha === data.fecha && c.estado !== 'novino' && toMin(c.hora) < toMin(data.hora) + data.duracion && toMin(c.hora) + (+c.duracion || 60) > toMin(data.hora));
    await Store.put(id || newId('ct_'), data); agendaDay = data.fecha; closeSheet();
    toast(clash ? 'Cita guardada. Ojo: coincide con otra a las ' + clash.hora : 'Cita guardada para el ' + longDate(data.fecha) + ' a las ' + data.hora);
  },
  delcita: async (id, el) => { if (el.dataset.sure) { await Store.del(id); closeSheet(); toast('Cita borrada'); } else { el.dataset.sure = '1'; el.textContent = '¿Seguro?'; } },
  'wa-cita': id => { const c = byId(id); openURL(waLink(c.telefono, `Hola ${c.nombre || ''}, le confirmo la cita en ${S.cfg.taller} el ${longDate(c.fecha)} a las ${c.hora}${c.matricula ? ' para el coche ' + showPlate(c.matricula) : ''}. Si no puede venir, avíseme por aquí. Gracias.`)); if (c.estado === 'pendiente') Store.put(id, {...docs[id], estado:'confirmada'}); },
  cita2job: id => { const c = byId(id); closeSheet(); jobEditor(null, {matricula:c.matricula, vehiculoId:c.vehiculoId, clienteId:c.clienteId, averia:c.motivo, citaId:id, _cli:{nombre:c.nombre, telefono:c.telefono}}); },
  ofrecer: () => ofrecerSheet(),
  'of-send': () => openURL(waLink($('#of-tel').value, $('#of-txt').value)),
  'of-copy': async () => { const t = $('#of-txt'); try { await navigator.clipboard.writeText(t.value); toast('Texto copiado'); } catch (e) { t.select(); toast('Texto seleccionado: cópialo'); } },
  hacienda: () => { closeAll(); haciendaSheet(); },
  presentado: async key => { const p = {...(S.cfg.presentados || {})}; if (p[key]) delete p[key]; else p[key] = todayISO(); await Store.put('cfg', {...(docs.cfg || S.cfg), t:'cfg', presentados:p}); },
  repq: q => { repQ = +q; renderSheet(false); },
  repy: y => { repY = +y; renderSheet(false); },
  export: k => exportCSV(k),
  gastos: () => gastosSheet(),
  'photo-menu': () => photoMenu(),
  cam: () => { photoTarget = null; const f = $('#cam-in'); f.value = ''; f.click(); },
  gal: () => { photoTarget = null; const f = $('#gal-in'); f.value = ''; f.click(); },
  newgasto: () => gastoForm(null, ''),
  gasto: id => gastoForm(byId(id), ''),
  savegasto: id => saveGasto(id),
  delgasto: async (id, el) => { if (el.dataset.sure) { const g = docs[id]; await Store.del(id); if (g && g.fotoId) await Store.delFile(g.fotoId); closeSheet(); toast('Gasto borrado'); } else { el.dataset.sure = '1'; el.textContent = '¿Seguro?'; } },
  proveedores: () => proveedoresSheet(),
  prov: id => provForm(id),
  saveprov: async id => { const g = k => $('#' + k).value.trim(); await Store.put(id, {...docs[id], nombre:g('pv-nombre'), nif:g('pv-nif').toUpperCase(), categoria:$('#pv-cat').value, iban:g('pv-iban').replace(/\s/g, '').toUpperCase(), telefono:g('pv-tel'), email:g('pv-email'), direccion:g('pv-dir')}); closeSheet(); toast('Proveedor guardado'); },
  delprov: async (id, el) => { if (el.dataset.sure) { await Store.del(id); closeSheet(); toast('Proveedor borrado'); } else { el.dataset.sure = '1'; el.textContent = '¿Seguro?'; } },
  savecfg: async () => { await Store.put('cfg', readCfgForm()); closeSheet(); toast('Ajustes guardados'); },
  addconcset: () => { const c = readCfgForm(); c.conceptos.push({tipo:'mo', desc:'', cant:1, precio:+c.tarifa || 0}); closeSheet(); settings(c); },
  delconc: i => { const c = readCfgForm(); c.conceptos.splice(+i, 1); closeSheet(); settings(c); },
  backup: () => backupSheet(),
  'bk-export': () => exportBackup(),
  'bk-import': () => { const f = $('#bk-in'); f.value = ''; f.click(); },
  'bk-confirm': () => confirmImport(),
  install: async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice.catch(() => {}); installEvt = null; render(); },
  seed: () => seed(),
  unseed: () => unseed()
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const fn = A[el.dataset.a]; if (!fn) return;
  e.preventDefault(); fn(el.dataset.id, el, e);
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset && t.dataset.l !== undefined && D) {
    const i = +t.dataset.l, f = t.dataset.f; D.lineas[i][f] = f === 'desc' ? t.value : parseNum(t.value);
    const lt = $('#lt-' + i); if (lt) lt.textContent = eur((+D.lineas[i].cant || 0) * (+D.lineas[i].precio || 0)); edTot();
  }
  if (t.id === 'q-home' || t.id === 'q-cli') {
    if (t.id === 'q-home') qHome = t.value; else qCli = t.value;
    const pos = t.selectionStart; const id = t.id; render(); const n = $('#' + id); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e2) {} }
  }
});
$('#cam-in').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) { if (photoTarget) attachPhoto(f); else readPhoto(f); } });
$('#gal-in').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) { if (photoTarget) attachPhoto(f); else readPhoto(f); } });
$('#bk-in').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) importBackup(f); });
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (tab === 'mas') render(); });
window.addEventListener('popstate', () => { if (sheetStack.length) { closeSheet(); history.pushState(null, ''); } });

/* ---------- arranque ---------- */
(async () => {
  await Store.init(); booted = true; rebuild(); render();
  if (await licBoot()) maybeBrief();
  try { history.pushState(null, ''); } catch (e) {}
  if ('serviceWorker' in navigator && location.protocol === 'https:' && window.self === window.top) { try { await navigator.serviceWorker.register('sw.js'); } catch (e) {} }
})();

/* ---------- acciones de la versión 3 ---------- */
function maybeBrief() {
  let last = ''; try { last = localStorage.getItem('taller-brief') || ''; } catch (e) {}
  if (last === todayISO()) return;
  try { localStorage.setItem('taller-brief', todayISO()); } catch (e) {}
  if (S.trabajos.length || S.citas.length) briefSheet();
}
async function setPhotosOf(id, fotos) { await Store.put(id, {...docs[id], fotos}); }
Object.assign(A, {
  'ob-ok': async () => {
    const g = k => ($('#' + k).value || '').trim();
    if (!g('ob-nombre') || !g('ob-apellidos') || digits(g('ob-tel')).length < 9) { toast('Escribe nombre, apellidos y un teléfono válido.'); return; }
    await Store.put('cfg', {...(docs.cfg || S.cfg), t:'cfg', registrado:true, propietario:g('ob-nombre'), apellidos:g('ob-apellidos'), telefono:g('ob-tel'), email:g('ob-email'), nif:g('ob-nif').toUpperCase(), taller:g('ob-taller') || S.cfg.taller});
    ungate(); if (!licState().ok) showPaywall(); else toast('Prueba gratuita activada: ' + TRIAL_DAYS + ' días');
  },
  'lic-share': () => { const l = lic(); openURL(waLink('', `Hola, quiero activar la app del taller. Mi ID de instalación es ${showId(l.id)} (${S.cfg.propietario} ${S.cfg.apellidos || ''} · ${S.cfg.taller}).`)); },
  'lic-ok': async () => {
    const r = await verifyCode($('#lic-code').value); const m = $('#lic-msg');
    if (!r.ok) { m.innerHTML = `<div class="note bad small">${esc(r.msg)}</div>`; return; }
    toast('App activada hasta el ' + fdate(r.hasta)); ungate(); if (sheetStack.length) closeSheet(); render(); maybeBrief();
  },
  'lic-backup': () => exportBackup(),
  licencia: () => licenciaSheet(),
  catalogo: () => jobsCatalogSheet(),
  addjobtpl: i => {
    if (!D) { toast('Abre un presupuesto para añadir el trabajo.'); return; }
    const jb = JOBS[+i]; jobLines(jb).forEach(l => D.lineas.push(l));
    if (!$('#ed-lines')) closeSheet(); else { edLines(); edTot(); }
    toast('Añadido: ' + jb.n);
  },
  dtoapply: () => {
    const m = $('#ed-dtomsg');
    if (D.descuento) { if (D.descuento.contado) { m.innerHTML = '<span class="muted">Este descuento ya está aplicado al presupuesto guardado.</span>'; } D.descuento = null; $('#ed-dto').value = ''; edTot(); $('[data-a="dtoapply"]').textContent = 'Aplicar'; return; }
    const r = dtoValid($('#ed-dto').value);
    if (!r.ok) { m.innerHTML = `<span class="neg">${esc(r.msg)}</span>`; return; }
    D.descuento = {codigo:r.d.codigo, tipo:r.d.tipo, valor:+r.d.valor}; edTot(); m.innerHTML = `<span class="pos">Descuento de ${dtoText(r.d)} aplicado.</span>`; $('[data-a="dtoapply"]').textContent = 'Quitar';
  },
  descuentos: () => descuentosSheet(),
  newdto: () => dtoForm(null),
  dto: id => dtoForm(id),
  savedto: async id => {
    const g = k => ($('#' + k).value || '').trim();
    const codigo = g('dt-cod').toUpperCase().replace(/[^A-Z0-9-]/g, ''); const valor = parseNum(g('dt-val'));
    if (codigo.length < 3) { toast('El código necesita al menos 3 letras o números.'); return; }
    if (!valor) { toast('Escribe el valor del descuento.'); return; }
    if (descuentos().some(d => d.codigo === codigo && d.id !== id)) { toast('Ya existe un código igual.'); return; }
    const tipo = $('#dt-tipo').value; if (tipo === 'pct' && valor > 100) { toast('Un porcentaje no puede pasar de 100.'); return; }
    await Store.put(id || newId('d_'), {...(id ? docs[id] : {t:'descuento', usos:0, creado:new Date().toISOString()}), codigo, tipo, valor, hasta:g('dt-hasta'), usosMax:parseInt(g('dt-max')) || '', nota:g('dt-nota')});
    closeSheet(); toast('Código ' + codigo + ' guardado');
  },
  deldto: async (id, el) => { if (el.dataset.sure) { await Store.del(id); closeSheet(); toast('Código borrado'); } else { el.dataset.sure = '1'; el.textContent = '¿Seguro?'; } },
  'dto-share': id => { const d = byId(id); openURL(waLink('', `${S.cfg.taller}: tienes un ${dtoText(d)} de descuento en tu próxima reparación con el código *${d.codigo}*${d.hasta ? ', válido hasta el ' + fdate(d.hasta) : ''}. Pide cita respondiendo a este mensaje.`)); },
  photoadd: v => { const [kind, id, how] = v.split('|'); photoTarget = {kind, id}; const f = $(how === 'cam' ? '#cam-in' : '#gal-in'); f.value = ''; f.click(); },
  photoview: v => photoView(v),
  photodel: async (v, el) => { if (!el.dataset.sure) { el.dataset.sure = '1'; el.textContent = 'Toca otra vez para quitarla'; return; } const [, id, fid] = v.split('|'); await setPhotosOf(id, (docs[id].fotos || []).filter(f => f !== fid)); await Store.delFile(fid); closeSheet(); toast('Foto quitada'); },
  photopick: () => { closeSheet(); pickJobForPhoto(); },
  photojob: id => { closeSheet(); openJob(id); photoTarget = {kind:'trabajo', id}; const f = $('#cam-in'); f.value = ''; f.click(); },
  horas: id => horasSheet(id),
  hrpick: h => { $('#hr-h').value = String(h).replace('.', ','); },
  hrsave: async id => { const h = parseNum($('#hr-h').value); if (!h || h > 24) { toast('Escribe las horas (por ejemplo 1,5).'); return; } const j = docs[id]; await Store.put(id, {...j, horas:[...(j.horas || []), {fecha:$('#hr-fecha').value || todayISO(), horas:h, nota:$('#hr-nota').value.trim()}]}); closeSheet(); toast(String(h).replace('.', ',') + ' h apuntadas'); },
  hrdel: async v => { const [id, i] = v.split('|'); const j = docs[id]; const hs = (j.horas || []).slice(); hs.splice(+i, 1); await Store.put(id, {...j, horas:hs}); },
  hrajustar: async id => {
    const j = clone(docs[id]); const extra = r2(horasReales(j) - horasCobradas(j)); if (extra <= 0) return;
    const mo = j.lineas.find(l => l.tipo === 'mo'); if (mo) mo.cant = r2(+mo.cant + extra); else j.lineas.push({tipo:'mo', desc:'Mano de obra', cant:extra, precio:+S.cfg.tarifa || 0});
    await Store.put(id, j); toast('Presupuesto ajustado: +' + String(extra).replace('.', ',') + ' h');
  },
  gesto: async id => { await Store.put(id, {...docs[id], mostrarGesto:!docs[id].mostrarGesto}); },
  piezas: async id => { await Store.put(id, {...docs[id], piezasPedidas:!docs[id].piezasPedidas}); },
  deuda: id => deudaForm(id),
  deudasave: async id => { const plazo = parseInt($('#dd-plazo').value) || 30, interes = parseNum($('#dd-int').value); await Store.put(id, {...docs[id], deuda:{abierta:true, plazo, interes, desde:(docs[id].deuda && docs[id].deuda.desde) || todayISO()}}); closeSheet(); toast('Cuenta deudora abierta'); },
  deudaclose: async id => { await Store.put(id, {...docs[id], deuda:{...(docs[id].deuda || {}), abierta:false}}); closeSheet(); toast('Cuenta deudora cerrada'); },
  cobrarint: id => {
    const d = deudaDe(id); if (!d.int) return;
    openSheet({live:false, render:() => ({title:'Cobrar intereses', body:`<div class="card"><div class="kv res"><span>Intereses de demora</span><span class="v">${eur(d.int)}</span></div></div><div class="muted small">Se registra como un ingreso aparte (los intereses de demora no llevan IVA) y queda en tu caja y en tus ingresos.</div><div class="eyebrow">¿Cómo paga?</div><div class="grid2 keep">${Object.entries(METODOS).filter(([k]) => k !== 'tarjeta').map(([k, v]) => `<button class="btn" data-a="intok" data-id="${id}|${k}">${v}</button>`).join('')}</div>`})});
  },
  intok: async v => {
    const [id, metodo] = v.split('|'); const d = deudaDe(id); const c = byId(id); const today = todayISO(); const jid = newId('j_');
    await Store.put(jid, {t:'trabajo', simplificada:true, intereses:true, estado:'cobrado', numFactura:nextNum('T'), fechaFactura:today, fecha:today, clienteId:id, clienteNombre:c.nombre, lineas:[{tipo:'otro', desc:'Intereses de demora: ' + d.rows.filter(r => r.int).map(r => r.j.numFactura).join(', '), cant:1, precio:d.int}], iva:0, pagos:[{importe:d.int, metodo, fecha:today}], creado:new Date().toISOString()});
    await Store.put(id, {...docs[id], deuda:{...docs[id].deuda, desde:today}});
    closeSheet(); toast('Intereses cobrados');
  },
  impagados: () => impagadosSheet(),
  remind: async id => { const j = byId(id); openURL(waLink(cliOf(j).telefono, reminderText(j))); await Store.put(id, {...docs[id], recordatorios:[...(docs[id].recordatorios || []), todayISO()]}); },
  tareas: () => tasksSheet(),
  taskadd: async () => { const t = $('#tk-txt').value.trim(); if (!t) { toast('Escribe la tarea.'); return; } await Store.put(newId('tk_'), {t:'tarea', texto:t, fecha:$('#tk-fecha').value, hecho:'', creado:new Date().toISOString()}); },
  taskdone: async id => { await Store.put(id, {...docs[id], hecho:docs[id].hecho ? '' : todayISO()}); },
  autodone: async v => {
    const [kind, id] = v.split('|');
    if (kind === 'piezas') await Store.put(id, {...docs[id], piezasPedidas:true});
    else if (kind === 'hacienda') { const p = {...(S.cfg.presentados || {}), [id]:todayISO()}; await Store.put('cfg', {...(docs.cfg || S.cfg), t:'cfg', presentados:p}); }
    else if (kind === 'cobro') { const j = byId(id); openURL(waLink(cliOf(j).telefono, reminderText(j))); await Store.put(id, {...docs[id], recordatorios:[...(docs[id].recordatorios || []), todayISO()], fechaFactura:docs[id].fechaFactura}); }
    else if (kind === 'llamar') { const j = byId(id); const tel = digits(cliOf(j).telefono); if (tel) openURL('tel:' + tel); await Store.put(id, {...docs[id], enviadoFecha:todayISO()}); }
  },
  brief: () => { closeAll(); briefSheet(); },
  admin: () => adminSheet(),
  agview: v => { agView = v; render(); },
  agmes: d => { const x = parseISO(agendaDay); agendaDay = isoOf(new Date(x.getFullYear(), x.getMonth() + +d, 1)); render(); },
  'agday-go': d => { agendaDay = d; agView = 'dia'; tab = 'agenda'; closeAll(); render(); window.scrollTo(0, 0); }
});
})();
