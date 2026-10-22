
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
