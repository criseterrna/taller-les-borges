
/* ---------- acciones ---------- */
const A = {
  noop: () => {},
  tab: id => { tab = id; closeAll(); render(); window.scrollTo(0, 0); },
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
    const data = {...(id ? docs[id] : {t:'cliente', creado:new Date().toISOString()}), nombre, telefono:$('#cf-tel').value.trim(), nif:$('#cf-nif').value.trim().toUpperCase(), email:$('#cf-email').value.trim(), direccion:$('#cf-dir').value.trim()};
    const cid = id || newId('c_'); await Store.put(cid, data);
    const mat = $('#cf-mat'); if (mat && normPlate(mat.value)) { const mod = $('#cf-mod').value.trim().split(/\s+/); await Store.put(newId('v_'), {t:'vehiculo', clienteId:cid, matricula:normPlate(mat.value), marca:mod[0] || '', modelo:mod.slice(1).join(' '), creado:new Date().toISOString()}); }
    closeSheet(); if (!id) openCli(cid); toast('Cliente guardado');
  },
  delcli: async (id, el) => { if (S.trabajos.some(j => j.clienteId === id && j.numFactura)) { toast('Tiene facturas: no se puede borrar.'); return; } if (el.dataset.sure) { for (const v of S.vehiculos.filter(v => v.clienteId === id)) await Store.del(v.id); await Store.del(id); closeAll(); toast('Cliente borrado'); } else { el.dataset.sure = '1'; el.textContent = '¿Seguro?'; } },
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
  cam: () => { const f = $('#cam-in'); f.value = ''; f.click(); },
  gal: () => { const f = $('#gal-in'); f.value = ''; f.click(); },
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
$('#cam-in').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) readPhoto(f); });
$('#gal-in').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) readPhoto(f); });
$('#bk-in').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) importBackup(f); });
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (tab === 'mas') render(); });
window.addEventListener('popstate', () => { if (sheetStack.length) { closeSheet(); history.pushState(null, ''); } });

/* ---------- arranque ---------- */
(async () => {
  await Store.init(); booted = true; rebuild(); render();
  try { history.pushState(null, ''); } catch (e) {}
  if ('serviceWorker' in navigator && location.protocol === 'https:' && window.self === window.top) { try { await navigator.serviceWorker.register('sw.js'); } catch (e) {} }
})();
})();
