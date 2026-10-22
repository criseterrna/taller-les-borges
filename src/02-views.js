
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
