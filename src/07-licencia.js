
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
