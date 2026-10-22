
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
      <div class="section-h"><h2>Trabajo y piezas</h2></div>
      <div id="ed-lines" class="stack"></div>
      <div class="row wrapr"><button class="btn sm" data-a="addline" data-id="mo">+ Horas</button><button class="btn sm" data-a="addline" data-id="pieza">+ Pieza</button><button class="btn sm" data-a="addline" data-id="otro">+ Otro</button></div>
      ${S.cfg.conceptos.length ? `<div><div class="eyebrow" style="margin-bottom:6px">Habituales</div><div class="chips">${S.cfg.conceptos.map((c, i) => `<button class="chip" data-a="addconc" data-id="${i}">${esc(c.desc)}</button>`).join('')}</div></div>` : ''}
      <div class="card"><div class="totals" id="ed-tot"></div></div>`,
    foot:`<button class="btn primary block" data-a="savejob">Guardar presupuesto</button>`
  }), after:() => {
    edVeh(); edLines(); edTot();
    $('#ed-mat').addEventListener('input', e => { D.matricula = normPlate(e.target.value); edMatch(); });
    $('#ed-averia').addEventListener('input', e => D.averia = e.target.value);
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
  box.innerHTML = `<span class="muted">Base</span><span>${eur(t.base)}</span><span class="muted">IVA ${t.iva} %</span><span>${eur(t.cuota)}</span><b style="align-self:end">Total</b><span class="big">${eur(t.total)}</span>`;
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
  ['firma','aceptadoFecha','aceptadoVia','aceptadoNombre','enviadoFecha','numFactura','fechaFactura','facturaCliente','pagos','citaId','ejemplo'].forEach(k => { if (D[k] !== undefined) out[k] = D[k]; });
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
        <div class="card"><div class="totals"><span class="muted">Base</span><span>${eur(t.base)}</span><span class="muted">IVA ${t.iva} %</span><span>${eur(t.cuota)}</span><b style="align-self:end">Total</b><span class="big">${eur(t.total)}</span>${pagado(j) ? `<span class="muted">Pagado</span><span class="pos">${eur(pagado(j))}</span><b>Pendiente</b><b>${eur(pendiente(j))}</b>` : ''}</div></div>
        ${(j.pagos || []).length ? `<div class="card">${j.pagos.map(p => `<div class="kv"><span>${fdate(p.fecha)} · ${esc(METODOS[p.metodo] || p.metodo)}</span><span class="v pos">${eur(p.importe)}</span></div>`).join('')}</div>` : ''}
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
    <div class="tt"><div><span>Base imponible</span><span>${eur(t.base)}</span></div><div><span>IVA ${t.iva} %</span><span>${eur(t.cuota)}</span></div><div class="g"><span>Total</span><span>${eur(t.total)}</span></div></div>
    <div style="margin-top:14px;font-size:11.5px;color:#444">${isF ? ((j.pagos || []).length ? 'Pagado: ' + j.pagos.map(p => fdate(p.fecha) + ' ' + (METODOS[p.metodo] || '') + ' ' + eur(p.importe)).join(' · ') : (cf.iban ? 'Forma de pago: transferencia a ' + esc(cf.iban) + ' o tarjeta.' : '')) : 'Presupuesto válido ' + esc(cf.validez) + ' días.'}</div>
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
  doc.text('Base imponible', 140, y); doc.text(E(t.base), 195, y, {align:'right'}); y += 5.5;
  doc.text('IVA ' + t.iva + ' %', 140, y); doc.text(E(t.cuota), 195, y, {align:'right'}); y += 3;
  doc.setLineWidth(0.7); doc.setDrawColor(...BLUE); doc.line(140, y, 195, y); y += 6;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('TOTAL', 140, y); doc.text(E(t.total), 195, y, {align:'right'});
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(70);
  const foot = isF ? ((j.pagos || []).length ? 'Pagado: ' + j.pagos.map(p => fdate(p.fecha) + ' ' + (METODOS[p.metodo] || '') + ' ' + E(p.importe)).join(' · ') : (cf.iban ? 'Forma de pago: transferencia a ' + cf.iban + ' o tarjeta.' : '')) : 'Presupuesto válido ' + cf.validez + ' días.';
  doc.text(doc.splitTextToSize(foot, 180), 15, y + 12);
  if (!isF && j.firma) { doc.text('Aceptado por ' + (j.aceptadoNombre || '') + ' el ' + fdate(j.aceptadoFecha), 15, y + 20); try { doc.addImage(j.firma, 'JPEG', 15, y + 22, 50, 18); } catch (e) {} }
  const name = (j.simplificada ? 'Ticket_' + j.numFactura : isF ? 'Factura_' + j.numFactura : 'Presupuesto_' + j.numPresupuesto) + (j.matricula ? '_' + normPlate(j.matricula) : '') + '.pdf';
  saveBlob(doc.output('blob'), name);
}
