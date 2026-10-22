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
