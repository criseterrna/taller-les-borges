
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
        <div class="small"><span class="muted">Facturado:</span> <b class="num">${eur(total)}</b>${deuda ? ` · <span class="neg">debe ${eur(deuda)}</span>` : ''}</div></div>
      <div class="section-h"><h2>Coches</h2><button class="btn sm" data-a="newveh" data-id="${id}">${ICON.plus}Coche</button></div>
      <div class="list">${vs.map(v => `<button class="item" data-a="veh" data-id="${v.id}">${plate(v.matricula)}<div class="grow"><div class="t">${esc(carName(v) || 'Sin modelo')}</div><div class="s">${S.trabajos.filter(j => j.vehiculoId === v.id).length} trabajos${v.km ? ' · ' + Number(v.km).toLocaleString('es-ES') + ' km' : ''}</div></div>${ICON.chevR}</button>`).join('') || '<div class="item static muted">Sin coches.</div>'}</div>
      <div class="grid2 keep"><button class="btn primary" data-a="newjobcli" data-id="${id}">${ICON.plus}Presupuesto</button><button class="btn" data-a="newcitacli" data-id="${id}">${ICON.cal}Cita</button></div>
      <div class="section-h"><h2>Historial</h2></div>
      ${js.length ? `<div class="list">${js.map(jobItem).join('')}</div>` : '<div class="muted small">Sin trabajos.</div>'}`};
  }});
}
function cliForm(id) {
  const c = id ? byId(id) : {nombre:'', telefono:'', nif:'', direccion:'', email:''};
  openSheet({live:false, render:() => ({title:id ? 'Editar cliente' : 'Nuevo cliente', body:`
    <label class="f">Nombre o empresa<input class="in" id="cf-nombre" value="${esc(c.nombre)}"></label>
    <label class="f">Teléfono (WhatsApp)<input class="in" id="cf-tel" type="tel" inputmode="tel" value="${esc(c.telefono)}"></label>
    <div class="grid2"><label class="f">NIF / DNI<input class="in" id="cf-nif" value="${esc(c.nif)}" autocapitalize="characters"></label><label class="f">Email<input class="in" id="cf-email" type="email" value="${esc(c.email)}"></label></div>
    <label class="f">Dirección<input class="in" id="cf-dir" value="${esc(c.direccion)}"></label>
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
      <div class="grid2 keep">${c.telefono ? `<button class="btn" data-a="wa-cita" data-id="${id}">${ICON.wa}Confirmar por WhatsApp</button>` : ''}${c.trabajoId ? `<button class="btn" data-a="job" data-id="${c.trabajoId}">Ver presupuesto</button>` : `<button class="btn primary" data-a="cita2job" data-id="${id}">Ha llegado: presupuesto</button>`}</div>` : ''}`,
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
