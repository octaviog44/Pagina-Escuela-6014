(function () {
  'use strict';

  var COLLS = ['equipo', 'niveles', 'calendario', 'contactos', 'comunicados', 'proyectos'];
  var CATEGORIAS = ['Aviso', 'Reunión', 'Salida educativa', 'Actividad', 'Administración', 'Urgente'];
  var TIPOS = ['Clases', 'Sin clases', 'Reunión', 'Acto', 'Salida', 'Evaluación', 'Feriado', 'Otro'];
  var TABS = [['inicio', 'Inicio'], ['nosotros', 'Nosotros'], ['niveles', 'Propuesta'], ['calendario', 'Calendario'], ['comunicados', 'Comunicados'], ['proyectos', 'Proyectos'], ['libreta', 'Libreta virtual'], ['inscripcion', 'Inscripción'], ['contacto', 'Contacto']];

  /* Formularios simples: cada fila es un campo o una pareja de campos. */
  var COLS = {
    contactos: { nuevo: 'Agregar contacto', editar: 'Editar contacto', schema: [
      { k: 'area', label: 'Área o persona', req: 1, max: 80, hint: 'Por ejemplo: Secretaría, Dirección, Vicedirección.' },
      { k: 'detalle', label: 'Para qué consultar', max: 160 },
      [{ k: 'telefono', label: 'Teléfono', max: 60 }, { k: 'email', label: 'Correo', max: 100 }],
      { k: 'horario', label: 'Horario de atención', max: 100 }] },
    equipo: { nuevo: 'Agregar persona', editar: 'Editar persona', schema: [[
      { k: 'nombre', label: 'Nombre y apellido', req: 1, max: 80 },
      { k: 'cargo', label: 'Cargo o función', max: 80 }]] },
    niveles: { nuevo: 'Agregar nivel', editar: 'Editar nivel', schema: [
      { k: 'nombre', label: 'Nivel', req: 1, max: 60 },
      [{ k: 'edades', label: 'Salas o cursos', max: 60 }, { k: 'horario', label: 'Horario', max: 80 }],
      { k: 'texto', label: 'Descripción', type: 'textarea', rows: 6, req: 1, hint: 'Los saltos de línea se respetan.' }] },
    calendario: { nuevo: 'Agregar fecha', editar: 'Editar fecha', schema: [
      { k: 'titulo', label: 'Qué pasa ese día', req: 1, max: 120 },
      [{ k: 'fecha', label: 'Fecha', type: 'date', req: 1 }, { k: 'fin', label: 'Hasta (si dura varios días)', type: 'date' }],
      { k: 'tipo', label: 'Tipo', type: 'select', options: TIPOS },
      { k: 'detalle', label: 'Detalle (opcional)', type: 'textarea', rows: 3, max: 400 }] }
  };
  var SINGLES = {
    inicio: { titulo: 'Editar bienvenida', schema: [
      { k: 'titulo', label: 'Título', max: 100 },
      { k: 'texto', label: 'Mensaje de bienvenida', type: 'textarea', rows: 7, req: 1 }] },
    nosotros: { titulo: 'Editar Nosotros', schema: [
      { k: 'historia', label: 'Quiénes somos', type: 'textarea', rows: 7, req: 1, hint: 'Historia y presentación de la escuela.' },
      { k: 'mision', label: 'Misión y valores', type: 'textarea', rows: 7, req: 1 }] },
    libreta: { titulo: 'Editar Libreta virtual', schema: [
      { k: 'texto', label: 'Presentación', type: 'textarea', rows: 4, hint: 'Qué es la libreta virtual y para qué sirve.' },
      { k: 'pasos', label: 'Pasos para acceder (uno por línea)', type: 'textarea', rows: 8, req: 1 },
      [{ k: 'enlace', label: 'Enlace para ingresar (opcional)', max: 300, ph: 'https://' }, { k: 'boton', label: 'Texto del botón', max: 40, ph: 'Ingresar a la libreta' }],
      { k: 'ayuda', label: 'Si no podés ingresar', type: 'textarea', rows: 3, max: 400, hint: 'A quién consultar o qué hacer si hay problemas.' }] },
    inscripcion: { titulo: 'Editar Inscripción', schema: [
      { k: 'texto', label: 'Cómo anotarse', type: 'textarea', rows: 6, req: 1 },
      { k: 'requisitos', label: 'Documentación a presentar (una por línea)', type: 'textarea', rows: 6 },
      { k: 'fechas', label: 'Período de inscripción', max: 160 },
      { k: 'enlace', label: 'Enlace a formulario (opcional)', max: 300, ph: 'https://' }] }
  };

  /* Contenido inicial: lo escrito en index.html. Se usa hasta que un docente lo guarda en la base de datos. */
  var seed = norm(JSON.parse(document.getElementById('state').textContent));
  var live = clone(seed);
  var sb = null, sbProblem = '', user = null, remote = null, remoteOk = false, seedNeeded = false, loading = false, recovery = false;
  var draft = null, editing = false, dirty = false, canEdit = false, saving = false;
  var tab = 'inicio', filterCom = 'Todos', filterPro = 'Todos', showOld = false, showPast = false;
  var pendingDel = null, modal = null, lastFocus = null, formFotos = [], msg = '', discardArm = false;

  var hv = (location.hash || '').replace('#', '');
  if (TABS.some(function (t) { return t[0] === hv; })) tab = hv;

  /* ---------- utilidades ---------- */
  function el(tag, props) {
    var n = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v == null || v === false) return;
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
        else if (v === true) n.setAttribute(k, '');
        else n.setAttribute(k, v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(n, arguments[i]);
    return n;
  }
  function append(n, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(n, x); }); return; }
    n.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  function $(s) { return document.querySelector(s); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function uid() { return Math.random().toString(36).slice(2, 10); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseISO(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || '') ? new Date(s + 'T12:00:00') : null; }
  function dayNum(s) { var d = parseISO(s); return d ? String(d.getDate()) : ''; }
  function monthShort(s) {
    var d = parseISO(s); if (!d) return '';
    var m = d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
    return d.getFullYear() !== new Date().getFullYear() ? m + ' ' + String(d.getFullYear()).slice(2) : m;
  }
  function fmtLong(s) { var d = parseISO(s); return d ? d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''; }
  function fmtMd(s) { var d = parseISO(s); return d ? d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' }) : ''; }
  function monthName(s) { var d = parseISO(s); return d ? d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) : ''; }
  function rangeText(ev) {
    if (ev.fin && ev.fin > ev.fecha) return 'Del ' + fmtMd(ev.fecha) + ' al ' + fmtMd(ev.fin);
    return fmtLong(ev.fecha);
  }
  function safeUrl(u) {
    u = (u || '').trim(); if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try { var x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch (e) { return ''; }
  }
  function norm(s) {
    s.escuela = s.escuela || {};
    if (s.escuela.frase && !s.escuela.lema) s.escuela.lema = s.escuela.frase;
    delete s.escuela.frase;
    ['nombre', 'lema', 'direccion', 'telefono', 'email', 'horario'].forEach(function (k) { s.escuela[k] = s.escuela[k] || ''; });
    if (!Array.isArray(s.escuela.grupos) || !s.escuela.grupos.length) s.escuela.grupos = ['Toda la escuela'];
    s.inicio = s.inicio || { titulo: '', texto: '' };
    s.nosotros = s.nosotros || { historia: '', mision: '' };
    s.escuela.portada = s.escuela.portada || '';
    s.libreta = s.libreta || { texto: '', pasos: '', enlace: '', boton: '', ayuda: '' };
    s.inscripcion = s.inscripcion || { texto: '', requisitos: '', fechas: '', enlace: '' };
    ['equipo', 'niveles', 'calendario', 'contactos', 'comunicados', 'proyectos'].forEach(function (k) { s[k] = s[k] || []; });
    return s;
  }
  function data() { return editing ? draft : live; }
  function niveles(d) { var g = d.escuela.grupos; return g.length > 1 ? g.slice(1) : g; }
  function markDirty() { dirty = true; discardArm = false; msg = ''; }
  function hasEj(d) {
    return d.inicio.ejemplo || d.nosotros.ejemplo || d.libreta.ejemplo || d.inscripcion.ejemplo ||
      ['equipo', 'niveles', 'calendario', 'contactos', 'comunicados', 'proyectos'].some(function (k) { return d[k].some(function (x) { return x.ejemplo; }); });
  }
  function goTab(id) { tab = id; pendingDel = null; render(); try { window.scrollTo(0, 0); } catch (e) {} }

  /* ---------- base de datos y acceso de docentes (Supabase) ---------- */
  /* Qué se guarda y dónde: ver LEEME-docentes.md. Quién puede escribir lo deciden las políticas de supabase-setup.sql, no esta página. */
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
    return JSON.stringify(v);
  }
  function sbConfigured() {
    var c = window.SUPABASE_CONFIG;
    return !!(window.supabase && window.supabase.createClient && c && c.url && c.anonKey && !/PEGAR/i.test(c.url + c.anonKey));
  }
  function initSupabase() {
    if (!window.supabase || !window.supabase.createClient) { sbProblem = 'No se pudo cargar la librería de Supabase (revisá la conexión o el bloqueo de scripts).'; console.warn(sbProblem); return; }
    if (!sbConfigured()) { sbProblem = 'Falta completar supabase-config.js (o el archivo no se subió junto a index.html).'; console.warn(sbProblem); return; }
    try {
      sb = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
    } catch (e) { console.warn('Supabase no se pudo iniciar', e); sb = null; return; }
    loading = true; render();
    var timer = setTimeout(function () { if (loading) { loading = false; render(); } }, 8000);
    loadRemote().catch(function (e) { remoteOk = false; sbProblem = 'No se pudo leer la base de datos: ' + ((e && e.message) || e) + '. Si el proyecto de Supabase está pausado, reactivalo desde el panel.'; console.warn(sbProblem, e); }).then(function () {
      clearTimeout(timer); loading = false; render();
    });
    sb.auth.onAuthStateChange(function (event, session) {
      if (event === 'PASSWORD_RECOVERY') recovery = true;
      /* Supabase pide no llamar a otras funciones suyas dentro de este aviso: se difiere. */
      setTimeout(function () { onAuth(session && session.user ? session.user : null); }, 0);
    });
  }
  function loadRemote() {
    return Promise.resolve(sb.from('contenido').select('coleccion,id,orden,data')).then(function (res) {
      if (res.error) throw res.error;
      var cfg = null, cols = {}, rem = { config: null, cols: {} };
      COLLS.forEach(function (n) { cols[n] = []; rem.cols[n] = {}; });
      (res.data || []).forEach(function (r) {
        if (r.coleccion === 'config') { if (r.id === 'sitio') { cfg = r.data; rem.config = canon(r.data); } return; }
        if (!cols[r.coleccion]) return;
        rem.cols[r.coleccion][r.id] = canon({ orden: r.orden, data: r.data });
        cols[r.coleccion].push({ orden: r.orden, item: Object.assign({}, r.data, { id: r.id }) });
      });
      COLLS.forEach(function (n) {
        cols[n].sort(function (a, b) { return a.orden - b.orden; });
        cols[n] = cols[n].map(function (x) { return x.item; });
      });
      remote = rem; remoteOk = true;
      if (cfg) {
        live = norm({
          escuela: cfg.escuela, inicio: cfg.inicio, nosotros: cfg.nosotros, libreta: cfg.libreta, inscripcion: cfg.inscripcion,
          equipo: cols.equipo, niveles: cols.niveles, calendario: cols.calendario,
          contactos: cols.contactos, comunicados: cols.comunicados, proyectos: cols.proyectos
        });
        seedNeeded = false;
      } else {
        live = clone(seed); seedNeeded = true;
      }
    });
  }

  function checkDocente(u) {
    return Promise.resolve(sb.from('docentes').select('user_id').eq('user_id', u.id).maybeSingle()).then(function (r) {
      if (r.error) throw r.error;
      return !!r.data;
    });
  }
  function onAuth(u) {
    if (!u) {
      var was = !!user;
      user = null; canEdit = false; recovery = false;
      if (was) { editing = false; draft = null; dirty = false; msg = ''; }
      render(); return;
    }
    if (user && user.id === u.id) { user = u; afterAuth(); return; }
    checkDocente(u).then(function (ok) {
      if (ok) { user = u; canEdit = true; render(); afterAuth(); }
      else { user = null; canEdit = false; recovery = false; sb.auth.signOut(); }
    }).catch(function () { user = null; canEdit = false; });
  }
  /* Si la persona llegó desde el enlace de "Olvidé mi contraseña", se le pide la nueva. */
  function afterAuth() { if (recovery) { recovery = false; openModal({ type: 'newpass' }); } }
  function logout() { if (sb) sb.auth.signOut(); }
  function authError(e) {
    var m = ((e && e.message) || '').toLowerCase();
    if (m.indexOf('email not confirmed') >= 0) return 'Falta confirmar el correo de esta cuenta. Consultá con la dirección.';
    if (m.indexOf('rate limit') >= 0 || m.indexOf('too many') >= 0 || (e && e.status === 429)) return 'Demasiados intentos. Esperá unos minutos y probá de nuevo.';
    if (m.indexOf('fetch') >= 0 || m.indexOf('network') >= 0) return 'No hay conexión. Revisá internet y probá de nuevo.';
    if (m.indexOf('banned') >= 0 || m.indexOf('disabled') >= 0) return 'Esta cuenta está deshabilitada. Consultá con la dirección.';
    return 'Correo o contraseña incorrectos.';
  }
  function hideErr() { var b = document.getElementById('f-err'); if (b) b.hidden = true; }

  function formLogin() {
    var form = el('form', { novalidate: true },
      el('p', { class: 'hint', text: 'Este acceso es solo para docentes de la escuela. Las familias no necesitan iniciar sesión para ver la página.' }),
      errBox(),
      field('l-mail', 'Correo', el('input', { class: 'in', id: 'l-mail', type: 'email', autocomplete: 'username', inputmode: 'email' })),
      field('l-pass', 'Contraseña', el('input', { class: 'in', id: 'l-pass', type: 'password', autocomplete: 'current-password' })),
      el('p', { class: 'hint', id: 'l-info', hidden: true }),
      el('div', { class: 'dlg-foot' },
        el('button', { class: 'btn primary', type: 'submit', text: 'Ingresar' })));
    form.addEventListener('submit', function (ev) {
      ev.preventDefault(); hideErr();
      var mail = val('l-mail'), pass = document.getElementById('l-pass').value;
      if (!mail || !pass) { showErr('Escribí tu correo y tu contraseña.'); return; }
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      Promise.resolve(sb.auth.signInWithPassword({ email: mail, password: pass })).then(function (r) {
        if (r.error) throw r.error;
        var u = r.data.user;
        return checkDocente(u).then(function (ok) {
          if (!ok) {
            return Promise.resolve(sb.auth.signOut()).then(function () { showErr('Esta cuenta no está habilitada como docente. Pedile acceso a la dirección.'); });
          }
          user = u; canEdit = true; closeModal(); render();
        });
      }).catch(function (e) { showErr(authError(e)); }).then(function () { btn.disabled = false; });
    });
    return form;
  }
  function resetPass() {
    var mail = val('l-mail');
    if (!mail) { showErr('Escribí tu correo y volvé a tocar "Olvidé mi contraseña".'); return; }
    Promise.resolve(sb.auth.resetPasswordForEmail(mail, { redirectTo: location.origin + location.pathname })).then(function (r) {
      if (r.error) throw r.error;
      hideErr();
      var i = document.getElementById('l-info');
      i.textContent = 'Si el correo corresponde a una cuenta de docente, te llegó un mensaje para cambiar la contraseña. Revisá también la carpeta de spam.';
      i.hidden = false;
    }).catch(function () { showErr('No se pudo enviar el mensaje. Revisá el correo e intentá de nuevo.'); });
  }
  function formNewPass() {
    var form = el('form', { novalidate: true },
      errBox(),
      field('n-pass', 'Nueva contraseña', el('input', { class: 'in', id: 'n-pass', type: 'password', autocomplete: 'new-password' }), 'Mínimo 8 caracteres.'),
      field('n-pass2', 'Repetir contraseña', el('input', { class: 'in', id: 'n-pass2', type: 'password', autocomplete: 'new-password' })),
      el('p', { class: 'hint', id: 'n-info', hidden: true }),
      el('div', { class: 'dlg-foot' }, el('button', { class: 'btn primary', type: 'submit', text: 'Guardar contraseña' })));
    form.addEventListener('submit', function (ev) {
      ev.preventDefault(); hideErr();
      var a = document.getElementById('n-pass').value, b = document.getElementById('n-pass2').value;
      if (a.length < 8) { showErr('La contraseña tiene que tener al menos 8 caracteres.'); return; }
      if (a !== b) { showErr('Las dos contraseñas no coinciden.'); return; }
      Promise.resolve(sb.auth.updateUser({ password: a })).then(function (r) {
        if (r.error) throw r.error;
        var i = document.getElementById('n-info');
        i.textContent = 'Listo, tu contraseña se actualizó.'; i.hidden = false;
        setTimeout(closeModal, 1500);
      }).catch(function (e) {
        var m = ((e && e.message) || '').toLowerCase();
        showErr(m.indexOf('different') >= 0 ? 'La contraseña nueva tiene que ser distinta de la anterior.' : 'No se pudo cambiar la contraseña. Probá con otra.');
      });
    });
    return form;
  }

  /* ---------- estructura general ---------- */
  function render() {
    var d = data();
    var root = $('#root');
    root.replaceChildren();
    if (loading) {
      root.className = '';
      root.append(el('div', { class: 'wrap loading' }, el('p', { class: 'hint', text: 'Cargando…' })));
      return;
    }
    root.className = editing ? 'is-editing' : '';
    root.append(hero(d), main(d));
    var f = footer(d); if (f) root.append(f);
    if (editing) root.append(savebar());
  }

  function hero(d) {
    var e = d.escuela;
    var pu = e.portada && (/^data:image\//.test(e.portada) || safeUrl(e.portada)) ? e.portada : '';
    return el('header', { class: 'hero' + (pu ? ' has-img' : ''), style: pu ? 'background-image:linear-gradient(rgba(14,24,48,.55),rgba(14,24,48,.72)),url("' + pu.replace(/["\\\n]/g, '') + '")' : null }, el('div', { class: 'wrap' },
      el('div', { class: 'hero-top' },
        el('p', { class: 'eyebrow', text: 'Sitio de la escuela' }),
        sbProblem && /[?&]diagnostico/.test(location.search) ? el('p', { class: 'who', style: 'color:#b3261e', text: sbProblem }) : null,
        el('div', { class: 'grp' },
          editing ? el('button', { class: 'btn sm', type: 'button', onclick: function () { openModal({ type: 'esc' }); }, text: 'Datos de la escuela' }) : null,
          !editing && sb && !user ? el('button', { class: 'btn sm', type: 'button', onclick: function () { openModal({ type: 'login' }); }, text: 'Ingreso docentes' }) : null,
          !editing && user && canEdit ? [
            el('span', { class: 'who', text: user.email || 'Docente' }),
            el('button', { class: 'btn sm primary', type: 'button', onclick: startEdit, text: 'Editar contenido' }),
            el('button', { class: 'btn sm', type: 'button', onclick: logout, text: 'Cerrar sesión' })] : null)),
      el('h1', null, el('span', { text: e.nombre || 'Nombre de la escuela' })),
      e.lema ? el('p', { class: 'lema', text: e.lema }) : null,
      el('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Secciones' }, TABS.map(function (t) {
        var n = t[0] === 'comunicados' ? d.comunicados.length : (t[0] === 'proyectos' ? d.proyectos.length : null);
        return el('button', {
          class: 'tab', type: 'button', role: 'tab', 'aria-selected': tab === t[0] ? 'true' : 'false',
          onclick: function () { goTab(t[0]); }
        }, t[1], n != null ? el('small', { text: String(n) }) : null);
      }))));
  }

  function main(d) {
    var views = { inicio: viewInicio, nosotros: viewNosotros, niveles: viewNiveles, calendario: viewCal, comunicados: viewCom, proyectos: viewPro, libreta: viewLibreta, inscripcion: viewIns, contacto: viewContacto };
    return el('main', { class: 'wrap', role: 'tabpanel' },
      editing && hasEj(d) ? el('div', { class: 'hintbox' },
        el('strong', { text: 'Lo marcado como "Ejemplo" ' }),
        'está para que veas cómo se ve la página. Editalo con los datos de tu escuela o eliminalo antes de compartir el enlace con las familias.') : null,
      (views[tab] || viewInicio)(d));
  }

  function ejTag() { return el('span', { class: 'ej', text: 'Ejemplo' }); }
  function editBtn(label, fn, primary) {
    return editing ? el('button', { class: 'btn sm' + (primary ? ' primary' : ''), type: 'button', onclick: fn, text: label }) : null;
  }
  function secHead(title, flagged, controls) {
    return el('div', { class: 'sh' }, el('h2', null, title, flagged ? ejTag() : null), controls ? el('div', { class: 'grp' }, controls) : null);
  }
  function editSingle(key) { return editBtn('Editar texto', function () { openModal({ type: 'single', key: key }); }); }
  function newCol(col, label) {
    var type = col === 'comunicados' ? 'com' : (col === 'proyectos' ? 'pro' : 'col');
    return editBtn(label, function () { openModal({ type: type, col: col, id: null }); }, true);
  }
  function emptyBox(text, hintText) {
    return el('div', { class: 'empty' }, el('p', { text: text }), editing && hintText ? el('p', { text: hintText }) : null);
  }
  function seeAll(id, label) {
    return el('div', { class: 'foot-link' }, el('button', { class: 'btn sm', type: 'button', onclick: function () { goTab(id); }, text: label }));
  }

  function chips(options, current, onPick) {
    if (options.length < 2) return null;
    return el('div', { class: 'chips', role: 'group', 'aria-label': 'Filtrar' },
      ['Todos'].concat(options).map(function (o) {
        return el('button', { class: 'chip', type: 'button', 'aria-pressed': current === o ? 'true' : 'false', onclick: function () { onPick(o); render(); }, text: o });
      }));
  }

  function itemActions(coll, c) {
    if (!editing) return null;
    var key = coll + ':' + c.id;
    var type = coll === 'comunicados' ? 'com' : (coll === 'proyectos' ? 'pro' : 'col');
    return el('div', { class: 'acts' },
      el('button', { class: 'btn sm', type: 'button', onclick: function () { openModal({ type: type, col: coll, id: c.id }); }, text: 'Editar' }),
      pendingDel === key
        ? [el('button', { class: 'btn sm danger', type: 'button', onclick: function () { delItem(coll, c.id); }, text: 'Sí, eliminar' }),
           el('button', { class: 'btn sm', type: 'button', onclick: function () { pendingDel = null; render(); }, text: 'Cancelar' })]
        : el('button', { class: 'btn sm danger', type: 'button', onclick: function () { pendingDel = key; render(); }, text: 'Eliminar' }));
  }

  /* ---------- Inicio ---------- */
  function sortedCom(d) {
    return d.comunicados.slice().sort(function (a, b) { return (b.fecha || '').localeCompare(a.fecha || '') || (a.id < b.id ? 1 : -1); });
  }
  function upcoming(d) {
    var t = today();
    return d.calendario.filter(function (k) { return (k.fin || k.fecha) >= t; }).sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
  }
  function viewInicio(d) {
    var w = d.inicio;
    var pins = sortedCom(d).filter(function (c) { return c.fijado; }).slice(0, 1);
    var next = upcoming(d).slice(0, 4);
    var last = sortedCom(d).filter(function (c) { return !c.fijado; }).slice(0, 3);
    var projs = d.proyectos.slice().reverse().slice(0, 3);
    return el('section', null,
      el('div', { class: 'sec' },
        secHead(w.titulo || 'Bienvenidas y bienvenidos', w.ejemplo, editSingle('inicio')),
        el('p', { class: 'lead', text: w.texto })),
      pins.map(pinEl),
      el('div', { class: 'two' },
        el('div', { class: 'box' }, el('h3', { text: 'Próximas fechas' }),
          next.length ? el('ul', { class: 'mini' }, next.map(function (k) {
            return el('li', null, el('span', { class: 'md', text: dayNum(k.fecha) + ' ' + monthShort(k.fecha) }), el('span', { class: 'mt', text: k.titulo }));
          })) : el('p', { class: 'hint', text: 'No hay fechas próximas cargadas.' }),
          seeAll('calendario', 'Ver el calendario')),
        el('div', { class: 'box' }, el('h3', { text: 'Últimos comunicados' }),
          last.length ? el('ul', { class: 'mini' }, last.map(function (c) {
            return el('li', null, el('span', { class: 'md', text: dayNum(c.fecha) + ' ' + monthShort(c.fecha) }), el('span', { class: 'mt', text: c.titulo }));
          })) : el('p', { class: 'hint', text: 'Todavía no hay comunicados.' }),
          seeAll('comunicados', 'Ver todos los comunicados'))),
      projs.length ? el('div', { class: 'sec' },
        secHead('Proyectos recientes', false, el('button', { class: 'btn sm', type: 'button', onclick: function () { goTab('proyectos'); }, text: 'Ver todos' })),
        el('div', { class: 'grid' }, projs.map(cardEl))) : null);
  }

  /* ---------- Nosotros ---------- */
  function viewNosotros(d) {
    var n = d.nosotros;
    return el('section', null,
      el('div', { class: 'sec' }, secHead('Quiénes somos', n.ejemplo, editSingle('nosotros')), el('p', { class: 'lead', text: n.historia })),
      el('div', { class: 'sec' }, secHead('Misión y valores'), el('p', { class: 'lead', text: n.mision })),
      el('div', { class: 'sec' },
        secHead('Equipo', false, newCol('equipo', '+ Agregar persona')),
        d.equipo.length ? el('div', { class: 'grid' }, d.equipo.map(function (p) {
          var ini = (p.nombre || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join('');
          return el('article', { class: 'card' },
            el('div', { class: 'cb' }, el('div', { class: 'av', 'aria-hidden': 'true', text: ini }),
              el('h3', null, p.nombre, p.ejemplo ? ejTag() : null),
              el('p', { text: p.cargo || '' })),
            itemActions('equipo', p));
        })) : emptyBox('Todavía no hay personas cargadas.', 'Sumá al equipo con el botón "+ Agregar persona".')));
  }

  /* ---------- Propuesta educativa ---------- */
  function viewNiveles(d) {
    return el('section', { class: 'sec' },
      secHead('Propuesta educativa', false, newCol('niveles', '+ Agregar nivel')),
      d.niveles.length ? el('div', { class: 'grid' }, d.niveles.map(function (n) {
        return el('article', { class: 'card' },
          el('div', { class: 'cb' },
            el('div', { class: 'kick', text: [n.edades, n.horario].filter(Boolean).join(' · ') }),
            el('h3', null, n.nombre, n.ejemplo ? ejTag() : null),
            el('p', { class: 'full', text: n.texto })),
          itemActions('niveles', n));
      })) : emptyBox('Todavía no hay niveles cargados.', 'Agregá el primero con el botón "+ Agregar nivel".'));
  }

  /* ---------- Calendario ---------- */
  function calRow(k) {
    return el('article', { class: 'note' },
      el('div', { class: 'nd' }, el('b', { text: dayNum(k.fecha) }), el('span', { text: monthShort(k.fecha) })),
      el('div', { class: 'nc' },
        el('div', { class: 'meta' }, el('span', { text: k.tipo || 'Otro' }), el('span', { text: rangeText(k) }), k.ejemplo ? ejTag() : null),
        el('h3', { text: k.titulo }),
        k.detalle ? el('p', { class: 'body', text: k.detalle }) : null,
        itemActions('calendario', k)));
  }
  function groupByMonth(list) {
    var out = [], idx = {};
    list.forEach(function (k) {
      var key = (k.fecha || '').slice(0, 7);
      if (!(key in idx)) { idx[key] = out.length; out.push({ key: key, label: monthName(k.fecha), items: [] }); }
      out[idx[key]].items.push(k);
    });
    return out;
  }
  function viewCal(d) {
    var up = upcoming(d);
    var t = today();
    var past = d.calendario.filter(function (k) { return (k.fin || k.fecha) < t; }).sort(function (a, b) { return b.fecha.localeCompare(a.fecha); });
    var groups = groupByMonth(up);
    return el('section', { class: 'sec' },
      secHead('Calendario escolar', false, newCol('calendario', '+ Agregar fecha')),
      groups.length ? groups.map(function (g) {
        return [el('h3', { class: 'mh', text: g.label }), el('div', { class: 'sheet' }, g.items.map(calRow))];
      }) : emptyBox('No hay fechas próximas cargadas.', 'Agregá la primera con el botón "+ Agregar fecha".'),
      past.length && !showPast ? el('div', { class: 'more' }, el('button', { class: 'btn', type: 'button', onclick: function () { showPast = true; render(); }, text: 'Ver fechas pasadas (' + past.length + ')' })) : null,
      showPast && past.length ? [el('h3', { class: 'mh', text: 'Fechas pasadas' }), el('div', { class: 'sheet' }, past.map(calRow))] : null);
  }

  /* ---------- Comunicados ---------- */
  function viewCom(d) {
    var grupos = d.escuela.grupos;
    var opts = grupos.slice(1);
    if (filterCom !== 'Todos' && opts.indexOf(filterCom) < 0) filterCom = 'Todos';
    var all = sortedCom(d);
    var vis = all.filter(function (c) { return filterCom === 'Todos' || c.para === filterCom || c.para === grupos[0]; });
    var pinned = vis.filter(function (c) { return c.fijado; });
    var rest = vis.filter(function (c) { return !c.fijado; });
    var shown = showOld ? rest : rest.slice(0, 8);
    return el('section', null,
      secHead('Comunicados', false, newCol('comunicados', '+ Nuevo comunicado')),
      el('div', { class: 'bar' }, chips(opts, filterCom, function (o) { filterCom = o; }) || el('span')),
      pinned.map(pinEl),
      shown.length ? el('div', { class: 'sheet' }, shown.map(noteEl)) : (pinned.length ? null :
        emptyBox(all.length ? 'No hay comunicados para este grupo.' : 'Todavía no hay comunicados.', !all.length ? 'Creá el primero con el botón "+ Nuevo comunicado".' : null)),
      !showOld && rest.length > 8 ? el('div', { class: 'more' }, el('button', { class: 'btn', type: 'button', onclick: function () { showOld = true; render(); }, text: 'Ver comunicados anteriores (' + (rest.length - 8) + ')' })) : null);
  }
  function extras(c) {
    var u = safeUrl(c.enlace);
    return [
      c.evento ? el('p', { class: 'when' }, el('span', { class: 'k', text: 'Fecha' }), fmtLong(c.evento)) : null,
      u ? el('div', { class: 'acts' }, el('a', { class: 'btn sm', href: u, target: '_blank', rel: 'noopener noreferrer', text: 'Abrir enlace' })) : null
    ];
  }
  function pinEl(c) {
    return el('article', { class: 'pin' },
      el('div', { class: 'tag' }, 'Importante · ' + (c.categoria || 'Aviso') + ' · ' + (c.para || ''), c.ejemplo ? ejTag() : null),
      el('h3', { text: c.titulo }),
      el('p', { class: 'body', text: c.texto }),
      extras(c), itemActions('comunicados', c));
  }
  function noteEl(c) {
    return el('article', { class: 'note' },
      el('div', { class: 'nd', title: c.fecha || '' }, el('b', { text: dayNum(c.fecha) }), el('span', { text: monthShort(c.fecha) })),
      el('div', { class: 'nc' },
        el('div', { class: 'meta' },
          el('span', { class: c.categoria === 'Urgente' ? 'urg' : '', text: c.categoria || 'Aviso' }),
          el('span', { text: c.para || '' }),
          c.ejemplo ? ejTag() : null),
        el('h3', { text: c.titulo }),
        el('p', { class: 'body', text: c.texto }),
        extras(c), itemActions('comunicados', c)));
  }

  /* ---------- Proyectos ---------- */
  function viewPro(d) {
    var niv = niveles(d);
    if (filterPro !== 'Todos' && niv.indexOf(filterPro) < 0) filterPro = 'Todos';
    var items = d.proyectos.filter(function (p) { return filterPro === 'Todos' || p.nivel === filterPro; }).slice().reverse();
    return el('section', null,
      secHead('Proyectos de los alumnos', false, newCol('proyectos', '+ Nuevo proyecto')),
      el('div', { class: 'bar' }, chips(niv, filterPro, function (o) { filterPro = o; }) || el('span')),
      items.length ? el('div', { class: 'grid' }, items.map(cardEl)) :
        emptyBox(d.proyectos.length ? 'No hay proyectos para este nivel.' : 'Todavía no hay proyectos publicados.', !d.proyectos.length ? 'Sumá el primero con el botón "+ Nuevo proyecto".' : null));
  }
  function cardEl(p) {
    var cover = p.fotos && p.fotos[0];
    return el('article', { class: 'card link' },
      cover ? el('img', { class: 'cover', src: cover, alt: 'Foto del proyecto ' + p.titulo, loading: 'lazy' })
            : el('div', { class: 'ph', 'aria-hidden': 'true', text: (p.titulo || '?').trim().charAt(0).toUpperCase() }),
      el('div', { class: 'cb' },
        el('div', { class: 'kick', text: [p.curso, p.nivel].filter(Boolean).join(' · ') }),
        el('h3', null, el('button', { class: 'open', type: 'button', onclick: function () { openModal({ type: 'ver', id: p.id }); }, text: p.titulo })),
        p.resumen ? el('p', { class: 'clamp', text: p.resumen }) : null,
        el('div', { class: 'foot' }, p.periodo || '', p.ejemplo ? ejTag() : null)),
      itemActions('proyectos', p));
  }

  /* ---------- Libreta virtual ---------- */
  function viewLibreta(d) {
    var s = d.libreta;
    var pasos = (s.pasos || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    var u = safeUrl(s.enlace);
    if (!s.texto && !pasos.length && !u && !s.ayuda && !editing) return el('section', null, el('div', { class: 'sec' }, secHead('Libreta virtual', false, null),
      emptyBox('Pronto vas a encontrar acá cómo acceder a la libreta virtual.', '')));
    return el('section', null,
      el('div', { class: 'sec' }, secHead('Libreta virtual', s.ejemplo, editSingle('libreta')), s.texto ? el('p', { class: 'lead', text: s.texto }) : null),
      el('div', { class: 'two' },
        el('div', { class: 'box' }, el('h3', { text: 'Cómo acceder' }),
          pasos.length ? el('ol', { class: 'req steps' }, pasos.map(function (r) { return el('li', { text: r }); })) : el('p', { class: 'hint', text: 'Todavía no se cargaron los pasos.' })),
        (u || s.ayuda) ? el('div', { class: 'box' }, el('h3', { text: 'Ingreso y ayuda' }),
          s.ayuda ? el('p', { text: s.ayuda }) : null,
          u ? el('div', { class: 'acts' }, el('a', { class: 'btn primary', href: u, target: '_blank', rel: 'noopener noreferrer', text: s.boton || 'Ingresar a la libreta' })) : null,
          s.ayuda ? seeAll('contacto', 'Ir a Contacto') : null) : null));
  }

  /* ---------- Inscripción ---------- */
  function viewIns(d) {
    var s = d.inscripcion;
    var reqs = (s.requisitos || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    var u = safeUrl(s.enlace);
    return el('section', null,
      el('div', { class: 'sec' }, secHead('Inscripción', s.ejemplo, editSingle('inscripcion')), el('p', { class: 'lead', text: s.texto })),
      el('div', { class: 'two' },
        el('div', { class: 'box' }, el('h3', { text: 'Documentación' }),
          reqs.length ? el('ul', { class: 'req' }, reqs.map(function (r) { return el('li', { text: r }); })) : el('p', { class: 'hint', text: 'Todavía no se cargó la documentación.' })),
        el('div', { class: 'box' }, el('h3', { text: 'Fechas y consultas' }),
          s.fechas ? el('p', { text: s.fechas }) : null,
          el('p', { class: 'hint', text: 'Para consultar, usá los datos de la sección Contacto.' }),
          seeAll('contacto', 'Ir a Contacto'),
          u ? el('div', { class: 'acts' }, el('a', { class: 'btn primary', href: u, target: '_blank', rel: 'noopener noreferrer', text: 'Abrir formulario de inscripción' })) : null)));
  }

  /* ---------- Contacto ---------- */
  function schoolRows(e) {
    return [['Dirección', e.direccion], ['Teléfono', e.telefono, true], ['Correo', e.email, true], ['Horario de atención', e.horario]].filter(function (r) { return r[1]; });
  }
  function dlist(rows) {
    return el('dl', { class: 'cgrid' }, rows.map(function (r) {
      return el('div', null, el('dt', { text: r[0] }), el('dd', { text: r[1] }),
        r[2] ? el('button', { class: 'btn sm', type: 'button', onclick: function (ev) { copyText(r[1], ev.currentTarget); }, text: 'Copiar' }) : null);
    }));
  }
  function viewContacto(d) {
    var e = d.escuela;
    var rows = schoolRows(e);
    var map = e.direccion ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(e.direccion) : '';
    return el('section', null,
      el('div', { class: 'sec' },
        secHead('Contacto', false, editBtn('Editar datos de la escuela', function () { openModal({ type: 'esc' }); })),
        rows.length ? el('div', { class: 'box' }, dlist(rows),
          map ? el('div', { class: 'acts' }, el('a', { class: 'btn sm', href: map, target: '_blank', rel: 'noopener noreferrer', text: 'Ver en el mapa' })) : null)
          : emptyBox('Todavía no se cargaron los datos de contacto.', 'Cargalos con el botón "Editar datos de la escuela".')),
      el('div', { class: 'sec' },
        secHead('A quién consultar', false, newCol('contactos', '+ Agregar contacto')),
        d.contactos.length ? el('div', { class: 'grid' }, d.contactos.map(function (c) {
          var cr = [['Teléfono', c.telefono, true], ['Correo', c.email, true], ['Horario', c.horario]].filter(function (r) { return r[1]; });
          return el('article', { class: 'card' },
            el('div', { class: 'cb' },
              el('h3', null, c.area, c.ejemplo ? ejTag() : null),
              c.detalle ? el('p', { text: c.detalle }) : null,
              cr.length ? dlist(cr) : null),
            itemActions('contactos', c));
        })) : emptyBox('Todavía no hay contactos por área.', 'Agregá el primero con el botón "+ Agregar contacto".')));
  }
  function footer(d) {
    if (tab === 'contacto') return null;
    var e = d.escuela;
    var rows = schoolRows(e);
    if (!rows.length) {
      return editing ? el('footer', { class: 'contact' }, el('div', { class: 'wrap' }, el('p', { class: 'hint', text: 'Acá se muestran los datos de contacto de la escuela. Cargalos desde "Datos de la escuela".' }))) : null;
    }
    return el('footer', { class: 'contact' }, el('div', { class: 'wrap' },
      el('h2', { text: 'Contacto' }),
      dlist(rows),
      el('div', { class: 'acts' }, el('button', { class: 'btn sm', type: 'button', onclick: function () { goTab('contacto'); }, text: 'Ver todos los contactos' }))));
  }
  function copyText(t, btn) {
    var done = function (ok) { btn.textContent = ok ? 'Copiado' : 'Seleccioná y copiá'; setTimeout(function () { btn.textContent = 'Copiar'; }, 1800); };
    try { navigator.clipboard.writeText(t).then(function () { done(true); }, function () { done(false); }); } catch (e) { done(false); }
  }

  /* ---------- edición ---------- */
  function startEdit() {
    draft = clone(live); editing = true; discardArm = false;
    dirty = seedNeeded;
    msg = seedNeeded ? 'Primera vez: al guardar se sube todo el contenido actual a la base de datos.' : '';
    render();
  }
  function discard() {
    if (dirty && !discardArm) { discardArm = true; render(); return; }
    editing = false; draft = null; dirty = false; discardArm = false; msg = ''; pendingDel = null; render();
  }
  function delItem(coll, id) {
    draft[coll] = draft[coll].filter(function (x) { return x.id !== id; });
    pendingDel = null; markDirty(); render();
  }
  function savebar() {
    var status = saving ? 'Guardando…' : (msg || (dirty ? 'Tenés cambios sin guardar.' : 'Modo edición. Todavía no hay cambios.'));
    return el('div', { class: 'savebar', role: 'region', 'aria-label': 'Edición' },
      el('div', { class: 'sb-msg', 'aria-live': 'polite' }, el('span', { text: status })),
      el('div', { class: 'sb-btns' },
        el('button', { class: 'btn', type: 'button', disabled: saving, onclick: discard, text: discardArm ? 'Sí, descartar' : (dirty ? 'Descartar cambios' : 'Salir de edición') }),
        el('button', { class: 'btn go', type: 'button', disabled: saving || !dirty, onclick: save, text: 'Guardar y publicar' })));
  }
  /* Las fotos nuevas se suben al almacenamiento de Supabase y en la base queda solo su dirección. */
  function uploadPhotos() {
    var jobs = [];
    var por = draft.escuela.portada;
    if (por && /^data:/.test(por)) {
      jobs.push(fetch(por).then(function (r) { return r.blob(); }).then(function (blob) {
        var path = 'portada/' + uid() + uid() + '.jpg';
        return sb.storage.from('fotos').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' }).then(function (r) {
          if (r.error) throw r.error;
          draft.escuela.portada = sb.storage.from('fotos').getPublicUrl(path).data.publicUrl;
        });
      }));
    }
    draft.proyectos.forEach(function (p) {
      (p.fotos || []).forEach(function (f, i) {
        if (!/^data:/.test(f)) return;
        jobs.push(fetch(f).then(function (r) { return r.blob(); }).then(function (blob) {
          var path = 'proyectos/' + uid() + uid() + '.jpg';
          return sb.storage.from('fotos').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' }).then(function (r) {
            if (r.error) throw r.error;
            p.fotos[i] = sb.storage.from('fotos').getPublicUrl(path).data.publicUrl;
          });
        }));
      });
    });
    return Promise.all(jobs);
  }
  /* Compara lo editado con lo que hay en la base y escribe solo lo que cambió. */
  function save() {
    if (saving || !dirty) return;
    if (!sb || !user) { msg = 'Tu sesión terminó. Volvé a iniciar sesión para guardar.'; render(); return; }
    saving = true; msg = ''; render();
    uploadPhotos().then(function () {
      var rows = [], dels = [], next = { config: null, cols: {} };
      var cfg = { escuela: draft.escuela, inicio: draft.inicio, nosotros: draft.nosotros, libreta: draft.libreta, inscripcion: draft.inscripcion };
      next.config = canon(cfg);
      if (!remote || remote.config !== next.config) rows.push({ coleccion: 'config', id: 'sitio', orden: 0, data: cfg });
      COLLS.forEach(function (name) {
        var prev = (remote && remote.cols[name]) || {}, ids = {};
        next.cols[name] = {};
        draft[name].forEach(function (item, i) {
          var data = clone(item); delete data.id;
          var cs = canon({ orden: i, data: data });
          ids[item.id] = true; next.cols[name][item.id] = cs;
          if (prev[item.id] !== cs) rows.push({ coleccion: name, id: item.id, orden: i, data: data });
        });
        var gone = Object.keys(prev).filter(function (id) { return !ids[id]; });
        if (gone.length) dels.push({ coleccion: name, ids: gone });
      });
      var chain = Promise.resolve();
      for (var k = 0; k < rows.length; k += 50) {
        (function (chunk) {
          chain = chain.then(function () {
            return Promise.resolve(sb.from('contenido').upsert(chunk, { onConflict: 'coleccion,id' })).then(function (r) { if (r.error) throw r.error; });
          });
        })(rows.slice(k, k + 50));
      }
      dels.forEach(function (d) {
        chain = chain.then(function () {
          return Promise.resolve(sb.from('contenido').delete().eq('coleccion', d.coleccion).in('id', d.ids).select('id')).then(function (r) {
            if (r.error) throw r.error;
            /* Sin permiso, Supabase no da error: simplemente no borra nada. */
            if ((r.data || []).length < d.ids.length) { var e = new Error('sin permiso'); e.code = '42501'; throw e; }
          });
        });
      });
      return chain.then(function () { return next; });
    }).then(function (next) {
      remote = next; seedNeeded = false; live = clone(draft);
      editing = false; draft = null; dirty = false; saving = false; msg = ''; render();
    }).catch(function (e) {
      saving = false;
      var m = ((e && e.message) || '').toLowerCase();
      if ((e && (e.code === '42501' || e.status === 401 || e.status === 403)) || m.indexOf('row-level security') >= 0 || m.indexOf('jwt') >= 0 || m.indexOf('unauthorized') >= 0) msg = 'Tu cuenta no tiene permiso para guardar. Consultá con la dirección.';
      else if (m.indexOf('fetch') >= 0 || m.indexOf('network') >= 0) msg = 'No hay conexión con la base de datos. Probá de nuevo.';
      else msg = 'No se pudo guardar. Probá de nuevo en unos segundos.';
      render();
      /* Si una parte se guardó y otra no, se vuelve a leer la base para que el siguiente intento no repita nada. */
      loadRemote().catch(function () {});
    });
  }

  /* ---------- ventanas ---------- */
  function openModal(m) { lastFocus = document.activeElement; modal = m; formFotos = []; renderOverlay(); }
  function closeModal() {
    modal = null; formFotos = []; renderOverlay();
    if (lastFocus && document.contains(lastFocus)) { try { lastFocus.focus(); } catch (e) {} }
  }
  /* Ampliar fotos: pantalla completa, con flechas si hay varias. */
  var lb = null;
  function openLightbox(list, idx) {
    closeLightbox();
    var i = idx;
    var img = el('img', { class: 'lb-img', alt: '' });
    function show() { img.src = list[i]; img.alt = 'Foto ' + (i + 1) + ' de ' + list.length; cnt.textContent = list.length > 1 ? (i + 1) + ' / ' + list.length : ''; }
    function go(n) { i = (i + n + list.length) % list.length; show(); }
    var cnt = el('span', { class: 'lb-cnt' });
    var box = el('div', { class: 'lb', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Foto ampliada', onclick: function (ev) { if (ev.target === box || ev.target === wrap) closeLightbox(); } });
    var wrap = el('div', { class: 'lb-wrap' }, img);
    box.append(wrap, cnt,
      el('button', { class: 'lb-btn lb-x', type: 'button', 'aria-label': 'Cerrar', onclick: closeLightbox, text: '✕' }));
    if (list.length > 1) box.append(
      el('button', { class: 'lb-btn lb-prev', type: 'button', 'aria-label': 'Foto anterior', onclick: function () { go(-1); }, text: '‹' }),
      el('button', { class: 'lb-btn lb-next', type: 'button', 'aria-label': 'Foto siguiente', onclick: function () { go(1); }, text: '›' }));
    show();
    lb = { node: box, go: go, prev: document.activeElement };
    document.body.append(box);
    box.querySelector('.lb-x').focus();
  }
  function closeLightbox() { if (!lb) return; lb.node.remove(); var p = lb.prev; lb = null; try { if (p && p.focus) p.focus(); } catch (e) {} }
  document.addEventListener('keydown', function (ev) {
    if (lb) {
      if (ev.key === 'Escape') { ev.preventDefault(); closeLightbox(); }
      else if (ev.key === 'ArrowLeft') lb.go(-1);
      else if (ev.key === 'ArrowRight') lb.go(1);
      return;
    }
    if (ev.key === 'Escape' && modal) closeModal();
  });

  function renderOverlay() {
    var host = $('#overlay');
    host.replaceChildren();
    if (!modal) return;
    var body, title;
    var d = data();
    function byId(coll) { return modal.id ? d[coll].filter(function (x) { return x.id === modal.id; })[0] : null; }
    if (modal.type === 'ver') {
      var p = byId('proyectos');
      if (!p) { modal = null; return; }
      title = p.titulo; body = verBody(p);
    } else if (modal.type === 'com') {
      var c = byId('comunicados');
      title = c ? 'Editar comunicado' : 'Nuevo comunicado'; body = formCom(c, d);
    } else if (modal.type === 'pro') {
      var q = byId('proyectos');
      title = q ? 'Editar proyecto' : 'Nuevo proyecto'; body = formPro(q, d);
    } else if (modal.type === 'col') {
      var cfg = COLS[modal.col], rec = byId(modal.col);
      title = rec ? cfg.editar : cfg.nuevo;
      body = genForm(cfg.schema, rec, rec ? 'Aplicar cambios' : 'Agregar', function (vals) {
        if (rec) { Object.assign(rec, vals); delete rec.ejemplo; }
        else { vals.id = uid(); draft[modal.col].push(vals); }
        markDirty(); closeModal(); render();
      }, rec ? null : (modal.col === 'calendario' ? { fecha: today(), tipo: 'Otro' } : null));
    } else if (modal.type === 'single') {
      var sc = SINGLES[modal.key], key = modal.key;
      title = sc.titulo;
      body = genForm(sc.schema, d[key], 'Aplicar cambios', function (vals) {
        Object.assign(draft[key], vals); delete draft[key].ejemplo;
        markDirty(); closeModal(); render();
      });
    } else if (modal.type === 'newpass') {
      title = 'Nueva contraseña'; body = formNewPass();
    } else if (modal.type === 'login') {
      title = 'Ingreso docentes'; body = formLogin();
    } else {
      title = 'Datos de la escuela'; body = formEsc(d);
    }
    var scrim = el('div', {
      class: 'scrim',
      onclick: function (ev) { if (ev.target === scrim && modal && modal.type === 'ver') closeModal(); }
    }, el('div', { class: 'dlg', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, tabindex: '-1' },
      el('div', { class: 'dlg-head' }, el('h2', { text: title }),
        el('button', { class: 'btn sm', type: 'button', onclick: closeModal, text: 'Cerrar' })),
      body));
    host.append(scrim);
    var first = scrim.querySelector('input:not([type=file]), textarea, select');
    (first || scrim.querySelector('.dlg')).focus();
  }

  function zoomImg(list, i, alt) {
    return el('button', { class: 'zoom', type: 'button', 'aria-label': 'Ampliar: ' + alt, onclick: function () { openLightbox(list, i); } },
      el('img', { src: list[i], alt: alt }));
  }
  function verBody(p) {
    var fotos = p.fotos || [];
    var u = safeUrl(p.enlace);
    return el('div', null,
      el('p', { class: 'kick', text: [p.curso, p.nivel, p.periodo].filter(Boolean).join(' · ') }),
      p.docente ? el('p', { class: 'hint', text: 'A cargo: ' + p.docente }) : null,
      fotos.length ? el('div', { class: 'gal' }, zoomImg(fotos, 0, 'Foto principal del proyecto ' + p.titulo)) : null,
      fotos.length > 1 ? el('div', { class: 'gal rest' }, fotos.slice(1).map(function (f, i) { return zoomImg(fotos, i + 1, 'Foto ' + (i + 2) + ' del proyecto ' + p.titulo); })) : null,
      fotos.length ? el('p', { class: 'hint', text: 'Tocá una foto para verla más grande.' }) : null,
      p.resumen ? el('p', { class: 'body', text: p.resumen }) : null,
      p.texto ? el('p', { class: 'body', text: p.texto }) : null,
      u ? el('div', { class: 'acts' }, el('a', { class: 'btn sm', href: u, target: '_blank', rel: 'noopener noreferrer', text: 'Abrir enlace' })) : null);
  }

  function field(id, label, control, hint) {
    return el('div', { class: 'field' }, el('label', { for: id, text: label }), control, hint ? el('p', { class: 'hint', text: hint }) : null);
  }
  function val(id) { var n = document.getElementById(id); return n ? n.value.trim() : ''; }
  function errBox() { return el('p', { class: 'err', id: 'f-err', role: 'alert', hidden: true }); }
  function showErr(t) { var b = document.getElementById('f-err'); b.textContent = t; b.hidden = false; }
  function foot(label) {
    return el('div', { class: 'dlg-foot' },
      el('button', { class: 'btn', type: 'button', onclick: closeModal, text: 'Cancelar' }),
      el('button', { class: 'btn primary', type: 'submit', text: label }));
  }

  /* Formulario genérico a partir de un esquema. */
  function genForm(schema, rec, label, onSave, defaults) {
    var flat = [];
    function ctl(f) {
      flat.push(f);
      var id = 'g-' + f.k;
      var v = rec && rec[f.k] != null ? rec[f.k] : (defaults && defaults[f.k] != null ? defaults[f.k] : '');
      var c;
      if (f.type === 'textarea') c = el('textarea', { class: 'in', id: id, rows: String(f.rows || 5), text: v });
      else if (f.type === 'select') c = el('select', { class: 'in', id: id }, f.options.map(function (o) { return el('option', { value: o, selected: o === v, text: o }); }));
      else c = el('input', { class: 'in', id: id, type: f.type || 'text', maxlength: f.type === 'date' ? null : String(f.max || 200), placeholder: f.ph || null, value: v });
      return field(id, f.label, c, f.hint);
    }
    var form = el('form', { novalidate: true }, errBox());
    schema.forEach(function (row) {
      if (Array.isArray(row)) form.append(el('div', { class: 'row2' }, row.map(ctl)));
      else form.append(ctl(row));
    });
    form.append(foot(label));
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var vals = {};
      for (var i = 0; i < flat.length; i++) {
        var f = flat[i], v = val('g-' + f.k);
        if (f.req && !v) { showErr('Completá el campo "' + f.label + '".'); return; }
        vals[f.k] = v;
      }
      onSave(vals);
    });
    return form;
  }

  function formCom(c, d) {
    var grupos = d.escuela.grupos;
    var v = c || { titulo: '', texto: '', fecha: today(), categoria: 'Aviso', para: grupos[0], evento: '', enlace: '', fijado: false };
    var form = el('form', { novalidate: true },
      errBox(),
      field('f-titulo', 'Título', el('input', { class: 'in', id: 'f-titulo', type: 'text', maxlength: '120', value: v.titulo })),
      field('f-texto', 'Mensaje', el('textarea', { class: 'in', id: 'f-texto', rows: '6', text: v.texto }), 'Los saltos de línea se respetan.'),
      el('div', { class: 'row2' },
        field('f-categoria', 'Tipo', el('select', { class: 'in', id: 'f-categoria' }, CATEGORIAS.map(function (o) { return el('option', { value: o, selected: o === v.categoria, text: o }); }))),
        field('f-para', 'Para', el('select', { class: 'in', id: 'f-para' }, grupos.map(function (o) { return el('option', { value: o, selected: o === v.para, text: o }); })))),
      el('div', { class: 'row2' },
        field('f-fecha', 'Fecha del comunicado', el('input', { class: 'in', id: 'f-fecha', type: 'date', value: v.fecha })),
        field('f-evento', 'Fecha del evento (opcional)', el('input', { class: 'in', id: 'f-evento', type: 'date', value: v.evento }))),
      field('f-enlace', 'Enlace (opcional)', el('input', { class: 'in', id: 'f-enlace', type: 'text', inputmode: 'url', placeholder: 'https://', value: v.enlace }), 'Por ejemplo, una autorización o un formulario.'),
      el('div', { class: 'check' },
        el('input', { id: 'f-fijado', type: 'checkbox', checked: !!v.fijado }),
        el('label', { for: 'f-fijado', text: 'Marcar como importante (se muestra destacado arriba de todo)' })),
      foot(c ? 'Aplicar cambios' : 'Agregar comunicado'));
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var t = val('f-titulo'), x = document.getElementById('f-texto').value.trim();
      if (!t) { showErr('Escribí un título.'); return; }
      if (!x) { showErr('Escribí el mensaje.'); return; }
      var rec = {
        titulo: t, texto: x, fecha: val('f-fecha') || today(), categoria: val('f-categoria'), para: val('f-para'),
        evento: val('f-evento'), enlace: val('f-enlace'), fijado: document.getElementById('f-fijado').checked
      };
      if (c) { Object.assign(c, rec); delete c.ejemplo; }
      else { rec.id = uid(); draft.comunicados.push(rec); }
      markDirty(); closeModal(); render();
    });
    return form;
  }

  function formPro(p, d) {
    var niv = niveles(d);
    var v = p || { titulo: '', nivel: niv[0], curso: '', docente: '', periodo: '', resumen: '', texto: '', fotos: [], enlace: '' };
    formFotos = (v.fotos || []).slice();
    var box = el('div', { class: 'thumbs', id: 'fotos-box' });
    var fileIn = el('input', {
      id: 'f-fotos', type: 'file', accept: 'image/*', multiple: true,
      onchange: function (ev) { addFiles(ev.target.files); ev.target.value = ''; }
    });
    var form = el('form', { novalidate: true },
      errBox(),
      field('f-titulo', 'Nombre del proyecto', el('input', { class: 'in', id: 'f-titulo', type: 'text', maxlength: '120', value: v.titulo })),
      el('div', { class: 'row2' },
        field('f-nivel', 'Nivel', el('select', { class: 'in', id: 'f-nivel' }, niv.map(function (o) { return el('option', { value: o, selected: o === v.nivel, text: o }); }))),
        field('f-curso', 'Curso o sala', el('input', { class: 'in', id: 'f-curso', type: 'text', maxlength: '40', placeholder: 'Ej.: 4° B', value: v.curso }))),
      el('div', { class: 'row2' },
        field('f-docente', 'Docente o equipo a cargo', el('input', { class: 'in', id: 'f-docente', type: 'text', maxlength: '80', value: v.docente })),
        field('f-periodo', 'Período', el('input', { class: 'in', id: 'f-periodo', type: 'text', maxlength: '60', placeholder: 'Ej.: Octubre 2026', value: v.periodo }))),
      field('f-resumen', 'Resumen corto', el('textarea', { class: 'in', id: 'f-resumen', rows: '3', maxlength: '240', text: v.resumen }), 'Aparece en la tarjeta. Entre una y dos oraciones.'),
      field('f-texto', 'Descripción completa', el('textarea', { class: 'in', id: 'f-texto', rows: '7', text: v.texto })),
      el('div', { class: 'field' },
        el('span', { class: 'lbl', text: 'Fotos (hasta 4)' }),
        box,
        fileIn,
        el('p', { class: 'hint', text: 'La primera foto es la portada. Se reducen automáticamente (hasta 1600 px) para que la página cargue rápido.' })),
      field('f-enlace', 'Enlace (opcional)', el('input', { class: 'in', id: 'f-enlace', type: 'text', inputmode: 'url', placeholder: 'https://', value: v.enlace })),
      foot(p ? 'Aplicar cambios' : 'Agregar proyecto'));
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var t = val('f-titulo');
      if (!t) { showErr('Escribí el nombre del proyecto.'); return; }
      if (!val('f-resumen') && !val('f-texto')) { showErr('Agregá un resumen o una descripción.'); return; }
      var rec = {
        titulo: t, nivel: val('f-nivel'), curso: val('f-curso'), docente: val('f-docente'), periodo: val('f-periodo'),
        resumen: val('f-resumen'), texto: val('f-texto'), fotos: formFotos.slice(), enlace: val('f-enlace')
      };
      if (p) { Object.assign(p, rec); delete p.ejemplo; }
      else { rec.id = uid(); draft.proyectos.push(rec); }
      markDirty(); closeModal(); render();
    });
    setTimeout(drawFotos, 0);
    return form;
  }
  function drawFotos() {
    var box = document.getElementById('fotos-box'); if (!box) return;
    box.replaceChildren();
    formFotos.forEach(function (f, i) {
      box.append(el('div', { class: 'th' },
        el('img', { src: f, alt: 'Foto ' + (i + 1) }),
        i > 0 ? el('button', { class: 'btn sm', type: 'button', onclick: function () { formFotos.unshift(formFotos.splice(i, 1)[0]); drawFotos(); }, text: 'Hacer portada' }) : el('span', { class: 'hint', text: 'Portada' }),
        el('button', { class: 'btn sm danger', type: 'button', onclick: function () { formFotos.splice(i, 1); drawFotos(); }, text: 'Quitar' })));
    });
  }
  function shrink(file, maxPx, q) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          var max = maxPx || 800, s = Math.min(1, max / Math.max(img.width, img.height));
          var w = Math.max(1, Math.round(img.width * s)), h = Math.max(1, Math.round(img.height * s));
          var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          var ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
          res(cv.toDataURL('image/jpeg', q || 0.65));
        };
        img.onerror = function () { rej(new Error('img')); };
        img.src = fr.result;
      };
      fr.onerror = function () { rej(new Error('read')); };
      fr.readAsDataURL(file);
    });
  }
  function addFiles(files) {
    var list = Array.prototype.slice.call(files || []);
    var chain = Promise.resolve(), failed = false;
    list.forEach(function (f) {
      chain = chain.then(function () {
        if (formFotos.length >= 4 || !/^image\//.test(f.type)) return;
        return shrink(f, 1600, 0.72).then(function (u) { formFotos.push(u); }, function () { failed = true; });
      });
    });
    chain.then(function () {
      drawFotos();
      if (failed) showErr('No se pudo leer alguna de las imágenes. Probá con archivos JPG o PNG.');
    });
  }

  function formEsc(d) {
    var e = d.escuela;
    var portada = e.portada || '';
    var pv = el('div', { class: 'cover-prev', id: 'portada-prev' });
    function drawPortada() {
      pv.replaceChildren();
      if (portada) {
        pv.append(el('img', { src: portada, alt: 'Imagen de cabecera' }),
          el('button', { class: 'btn sm danger', type: 'button', onclick: function () { portada = ''; drawPortada(); }, text: 'Quitar imagen' }));
      } else pv.append(el('p', { class: 'hint', text: 'Sin imagen: se muestra el fondo de cuadritos.' }));
    }
    drawPortada();
    var pIn = el('input', { id: 'f-portada', type: 'file', accept: 'image/*', onchange: function (ev) {
      var f = ev.target.files && ev.target.files[0]; ev.target.value = '';
      if (!f || !/^image\//.test(f.type)) return;
      shrink(f, 1920, 0.72).then(function (u) { portada = u; drawPortada(); }, function () { showErr('No se pudo leer la imagen. Probá con un archivo JPG o PNG.'); });
    } });
    var form = el('form', { novalidate: true },
      errBox(),
      el('div', { class: 'field' }, el('span', { class: 'lbl', text: 'Imagen de cabecera (opcional)' }), pv, pIn,
        el('p', { class: 'hint', text: 'Aparece detrás del nombre de la escuela. Tamaño recomendado: 1920 × 600 px (horizontal).' })),
      field('f-nombre', 'Nombre de la escuela', el('input', { class: 'in', id: 'f-nombre', type: 'text', maxlength: '100', value: e.nombre })),
      field('f-lema', 'Frase o lema (opcional)', el('input', { class: 'in', id: 'f-lema', type: 'text', maxlength: '120', value: e.lema })),
      el('div', { class: 'row2' },
        field('f-dir', 'Dirección', el('input', { class: 'in', id: 'f-dir', type: 'text', maxlength: '120', value: e.direccion })),
        field('f-tel', 'Teléfono', el('input', { class: 'in', id: 'f-tel', type: 'text', maxlength: '60', value: e.telefono }))),
      el('div', { class: 'row2' },
        field('f-mail', 'Correo', el('input', { class: 'in', id: 'f-mail', type: 'text', maxlength: '100', value: e.email })),
        field('f-hor', 'Horario de atención', el('input', { class: 'in', id: 'f-hor', type: 'text', maxlength: '100', value: e.horario }))),
      field('f-grupos', 'Grupos de la escuela (uno por línea)', el('textarea', { class: 'in', id: 'f-grupos', rows: '5', text: e.grupos.join('\n') }),
        'La primera línea es para toda la escuela. Las demás se usan como filtro de comunicados y como nivel de los proyectos.'),
      foot('Aplicar cambios'));
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var nombre = val('f-nombre');
      if (!nombre) { showErr('Escribí el nombre de la escuela.'); return; }
      var grupos = document.getElementById('f-grupos').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      if (!grupos.length) grupos = ['Toda la escuela'];
      draft.escuela = { nombre: nombre, lema: val('f-lema'), direccion: val('f-dir'), telefono: val('f-tel'), email: val('f-mail'), horario: val('f-hor'), grupos: grupos, portada: portada };
      draft.comunicados.forEach(function (c) { if (grupos.indexOf(c.para) < 0) c.para = grupos[0]; });
      draft.proyectos.forEach(function (p) { var n = niveles(draft); if (n.indexOf(p.nivel) < 0) p.nivel = n[0]; });
      markDirty(); closeModal(); render();
    });
    return form;
  }

  /* ---------- arranque ---------- */
  initSupabase();
  if (!loading) render();
})();