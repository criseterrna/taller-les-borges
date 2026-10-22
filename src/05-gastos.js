
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
