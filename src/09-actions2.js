
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
