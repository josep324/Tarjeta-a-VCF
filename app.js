(function () {
  'use strict';
  const P = window.CardParser;
  const $ = (id) => document.getElementById(id);
  const TESS_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sense emmagatzematge */ } }
  };

  const PROXY = ((window.APP_CONFIG && window.APP_CONFIG.proxyUrl) || '').replace(/\/$/, '');
  let contact = P.emptyContact();
  let worker = null;

  // ---------- Formulari ----------
  const PHONE_TYPES = [['CELL', 'Mòbil'], ['WORK', 'Feina'], ['HOME', 'Casa'], ['FAX', 'Fax']];

  function multiRow(kind, val) {
    const row = document.createElement('div');
    row.className = 'multi';
    if (kind === 'phones') {
      const sel = document.createElement('select');
      for (const [v, t] of PHONE_TYPES) { const o = new Option(t, v); sel.add(o); }
      sel.value = val.type || 'WORK';
      sel.addEventListener('change', refresh);
      row.append(sel);
    }
    const inp = document.createElement('input');
    inp.type = kind === 'emails' ? 'email' : kind === 'urls' ? 'url' : 'tel';
    inp.value = kind === 'phones' ? val.value : val;
    inp.addEventListener('input', refresh);
    const x = document.createElement('button');
    x.type = 'button'; x.className = 'x'; x.textContent = '✕'; x.setAttribute('aria-label', 'Elimina');
    x.addEventListener('click', () => { row.remove(); refresh(); });
    row.append(inp, x);
    $(kind).append(row);
  }

  function fillForm(c) {
    for (const k of ['given', 'family', 'org', 'title', 'note']) $(k).value = c[k] || '';
    for (const k of ['street', 'postal', 'city', 'region', 'country']) $(k).value = c.adr[k] || '';
    for (const k of ['phones', 'emails', 'urls']) {
      $(k).innerHTML = '';
      c[k].forEach((v) => multiRow(k, v));
    }
    refresh();
  }

  function readForm() {
    const c = P.emptyContact();
    for (const k of ['given', 'family', 'org', 'title', 'note']) c[k] = $(k).value.trim();
    for (const k of ['street', 'postal', 'city', 'region', 'country']) c.adr[k] = $(k).value.trim();
    document.querySelectorAll('#phones .multi').forEach((r) => {
      const v = r.querySelector('input').value.trim();
      if (v) c.phones.push({ type: r.querySelector('select').value, value: v });
    });
    document.querySelectorAll('#emails .multi input').forEach((i) => { if (i.value.trim()) c.emails.push(i.value.trim()); });
    document.querySelectorAll('#urls .multi input').forEach((i) => { if (i.value.trim()) c.urls.push(i.value.trim()); });
    return c;
  }

  function refresh() {
    contact = readForm();
    const vcf = P.buildVcf(contact);
    $('vcf').textContent = vcf;
    const errs = P.validateVcf(vcf);
    const warns = P.checkContact(contact);
    $('warns').innerHTML = warns.map((w) => `<div class="warn">⚠ ${esc(w)}</div>`).join('');
    $('valid').innerHTML = errs.length
      ? errs.map((e) => `<div class="err">✗ ${esc(e)}</div>`).join('')
      : '<div class="ok">✓ vCard 3.0 vàlid</div>';
    return vcf;
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

  document.querySelectorAll('#s-form input:not([type=file]),#s-form textarea').forEach((el) => el.addEventListener('input', refresh));
  document.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.add;
    multiRow(k, k === 'phones' ? { type: 'WORK', value: '' } : '');
    $(k).lastElementChild.querySelector('input').focus();
  }));

  // ---------- Desar ----------
  function fileName(c) {
    const base = [c.given, c.family].filter(Boolean).join(' ') || c.org || 'contacte';
    return base.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') + '.vcf';
  }

  function download(vcf, name) {
    const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function save(opts = {}) {
    const vcf = refresh();
    const name = fileName(contact);
    let how = 'descarregat';
    const file = new File([vcf], name, { type: 'text/vcard' });
    if (opts.share !== false && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name });
        how = 'compartit';
      } catch (e) {
        if (e && e.name === 'AbortError') return; // l'usuari ha cancel·lat
        download(vcf, name);
      }
    } else {
      download(vcf, name);
    }
    addHistory(vcf, name);
    $('saved').textContent = `✓ ${name} ${how}. Obre'l per afegir-lo als contactes.`;
  }

  function addHistory(vcf, name) {
    const h = store.get('history', []);
    h.unshift({ ts: Date.now(), name, vcf });
    store.set('history', h.slice(0, 50));
    renderHistory();
  }

  function renderHistory() {
    const h = store.get('history', []);
    $('s-hist').classList.toggle('hidden', !h.length);
    const ul = $('hist');
    ul.innerHTML = '';
    h.forEach((it) => {
      const li = document.createElement('li');
      const d = new Date(it.ts).toLocaleString('ca');
      li.innerHTML = `<div>${esc(it.name.replace(/\.vcf$/, '').replace(/_/g, ' '))}<small>${esc(d)}</small></div>`;
      const b = document.createElement('button');
      b.className = 'add'; b.type = 'button'; b.textContent = '⬇ .vcf';
      b.addEventListener('click', () => download(it.vcf, it.name));
      li.append(b);
      ul.append(li);
    });
  }

  $('b-clear').addEventListener('click', () => { if (confirm('Esborrar l\'historial?')) { store.set('history', []); renderHistory(); } });
  $('b-save').addEventListener('click', () => save());
  $('b-new').addEventListener('click', reset);

  // ---------- Entrada ----------
  $('key').value = store.get('gkey', '');
  $('key').addEventListener('change', () => store.set('gkey', $('key').value.trim()));
  if (PROXY) $('cfg').classList.add('hidden');
  else if (!$('key').value) $('cfg').open = true;

  // ---------- Codi d'accés ----------
  function showLock(msg) {
    $('lock').classList.remove('hidden');
    $('lock').style.display = 'flex';
    $('lock-err').textContent = msg || '';
    $('code').value = '';
  }
  async function tryUnlock(code) {
    try {
      const r = await fetch(PROXY + '/check', { method: 'POST', headers: { 'x-access-code': code } });
      if (r.status === 401) return 'Codi incorrecte';
      if (!r.ok) return 'Error del servidor (' + r.status + ')';
      store.set('code', code);
      $('lock').style.display = 'none';
      return '';
    } catch { return 'Sense connexió amb el servidor'; }
  }
  if (PROXY) {
    $('b-unlock').addEventListener('click', async () => { $('lock-err').textContent = await tryUnlock($('code').value.trim()) || ''; });
    $('code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('b-unlock').click(); });
    const saved = store.get('code', '');
    showLock('');
    if (saved) tryUnlock(saved).then((m) => { if (m) showLock(m === 'Codi incorrecte' ? m : ''); });
  }
  $('auto').checked = store.get('auto', false);
  $('auto').addEventListener('change', () => store.set('auto', $('auto').checked));
  $('b-text').addEventListener('click', () => { $('textbox').classList.toggle('hidden'); $('t-in').focus(); });
  $('b-parse').addEventListener('click', () => handleText($('t-in').value));
  $('f-cam').addEventListener('change', onFile);
  $('f-gal').addEventListener('change', onFile);

  function reset() {
    contact = P.emptyContact();
    $('s-form').classList.add('hidden');
    $('s-save').classList.add('hidden');
    $('thumb').classList.add('hidden');
    $('prog').classList.add('hidden');
    $('saved').textContent = '';
    $('t-in').value = '';
    $('f-cam').value = ''; $('f-gal').value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function progress(msg, pct) {
    $('prog').classList.remove('hidden');
    $('pstat').textContent = msg;
    $('bar').value = pct == null ? 0 : pct;
    $('bar').classList.toggle('hidden', pct == null);
  }

  async function handleText(text, ocrText, engine) {
    await handleContact(P.parseContact(text), ocrText != null ? ocrText : text, engine || 'Text');
  }

  async function handleContact(c, ocrText, engine) {
    $('engine').textContent = 'Motor utilitzat: ' + engine;
    contact = c;
    fillForm(contact);
    $('ocr').textContent = ocrText;
    $('s-form').classList.remove('hidden');
    $('s-save').classList.remove('hidden');
    $('saved').textContent = '';
    $('prog').classList.add('hidden');
    if ($('auto').checked) {
      await save({ share: false });
      $('saved').textContent += ' (desat automàticament)';
    }
    $('s-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- Gemini (visió) ----------
  const GEMINI_MODEL = 'gemini-3.8-flash';
  const S = (d) => ({ type: 'STRING', description: d });
  const SCHEMA = {
    type: 'OBJECT',
    properties: {
      given: S('Nom de pila'), family: S('Cognoms'), org: S('Empresa/organització'),
      title: S('Càrrec o posició tal com surt a la targeta (si hi ha dos idiomes, uneix-los amb " / ")'),
      phones: { type: 'ARRAY', items: { type: 'OBJECT', properties: { type: { type: 'STRING', enum: ['CELL', 'WORK', 'HOME', 'FAX'] }, value: S('Número tal com està escrit') }, required: ['type', 'value'] } },
      emails: { type: 'ARRAY', items: { type: 'STRING' } },
      urls: { type: 'ARRAY', items: { type: 'STRING' } },
      street: S('Carrer i número'), postal: S('Codi postal'), city: S('Ciutat'), region: S('Província/regió'), country: S('País'),
      note: S('Qualsevol altra dada rellevant (xarxes socials, departament, etc.)')
    }
  };
  const PROMPT = 'Aquesta és una foto d\'una targeta de visita. Extreu totes les dades de contacte que hi siguin explícites. ' +
    'No infereixis ni inventis res: si un camp no hi és, deixa\'l buit (cadena buida o llista buida). ' +
    'El nom de la persona no és el de l\'empresa (el logotip és l\'empresa). Les icones (telèfon fix, mòbil, sobre, ubicació) indiquen el tipus de cada línia: ' +
    'telèfon fix = WORK, mòbil = CELL. Conserva els números amb el prefix tal com surten.';


  async function geminiExtract(dataUrl, key) {
    const url = PROXY || `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    const r = await fetch(url, {
      method: 'POST',
      headers: PROXY ? { 'Content-Type': 'application/json', 'x-access-code': store.get('code', '') }
        : { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: 'image/jpeg', data: dataUrl.split(',')[1] } }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA }
      })
    });
    if (r.status === 401 && PROXY) { store.set('code', ''); showLock('Codi incorrecte'); throw new Error('codi incorrecte'); }
    if (!r.ok) {
      let m = r.status + '';
      try { m = (await r.json()).error.message; } catch { /* */ }
      throw new Error(m);
    }
    const j = await r.json();
    const txt = j.candidates && j.candidates[0] && j.candidates[0].content.parts.map((p) => p.text || '').join('');
    if (!txt) throw new Error('resposta buida');
    const g = JSON.parse(txt);
    const c = P.emptyContact();
    c.given = g.given || ''; c.family = g.family || ''; c.org = g.org || ''; c.title = g.title || ''; c.note = g.note || '';
    c.phones = (g.phones || []).filter((p) => p.value);
    c.emails = (g.emails || []).filter(Boolean);
    c.urls = (g.urls || []).filter(Boolean).map((u) => (/^https?:\/\//i.test(u) ? u : 'https://' + u));
    c.adr = { street: g.street || '', city: g.city || '', region: g.region || '', postal: g.postal || '', country: g.country || '' };
    return c;
  }

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('No s\'ha pogut carregar el motor OCR (cal connexió la primera vegada).'));
      document.head.append(s);
    });
  }

  async function getWorker() {
    if (worker) return worker;
    if (!window.Tesseract) { progress('Carregant motor OCR…', null); await loadScript(TESS_URL); }
    worker = await window.Tesseract.createWorker(['spa', 'cat', 'eng'], 1, {
      logger: (m) => {
        if (m.status) progress(statusText(m.status), Math.round((m.progress || 0) * 100));
      }
    });
    return worker;
  }

  const statusText = (s) => ({
    'loading tesseract core': 'Carregant motor OCR…',
    'loading language traineddata': 'Descarregant idiomes (només la 1a vegada)…',
    'initializing api': 'Inicialitzant…',
    'recognizing text': 'Llegint la targeta…'
  }[s] || s);

  // Redimensiona i passa a grisos amb contrast per millorar l'OCR
  async function prepare(file) {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
    let w, h, src;
    if (bmp) { w = bmp.width; h = bmp.height; src = bmp; }
    else {
      src = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
      w = src.naturalWidth; h = src.naturalHeight;
    }
    const scale = Math.min(1, 2200 / Math.max(w, h));
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * scale); cv.height = Math.round(h * scale);
    const ctx = cv.getContext('2d');
    ctx.drawImage(src, 0, 0, cv.width, cv.height);
    const thumbUrl = cv.toDataURL('image/jpeg', 0.85);
    const img = ctx.getImageData(0, 0, cv.width, cv.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = d[i + 1] = d[i + 2] = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    }
    ctx.putImageData(img, 0, 0);
    return { canvas: cv, thumbUrl };
  }

  async function onFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    $('s-form').classList.add('hidden');
    $('s-save').classList.add('hidden');
    try {
      progress('Preparant la imatge…', null);
      const { canvas, thumbUrl } = await prepare(file);
      $('thumb').src = thumbUrl;
      $('thumb').classList.remove('hidden');
      const key = $('key').value.trim();
      if (PROXY || key) {
        try {
          progress('Analitzant la targeta amb Gemini…', null);
          const c = await geminiExtract(thumbUrl, key);
          await handleContact(c, '(analitzat amb Gemini)', 'Gemini');
          return;
        } catch (err) {
          // No canviem en silenci a l'OCR local: mostrem l'error i deixem triar
          progress('⚠ Gemini ha fallat: ' + (err.message || err), null);
          $('pstat').className = 'status err';
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'add'; b.textContent = 'Provar amb OCR local (menys precís)';
          b.addEventListener('click', async () => {
            b.remove(); $('pstat').className = 'status';
            const w2 = await getWorker();
            const { data: d2 } = await w2.recognize(canvas);
            await handleText(d2.text, d2.text, 'OCR local');
          });
          $('prog').append(b);
          return;
        }
      }
      const w = await getWorker();
      const { data } = await w.recognize(canvas);
      await handleText(data.text, data.text, 'OCR local');
    } catch (err) {
      progress('Error: ' + (err && err.message ? err.message : err), null);
      $('pstat').className = 'status err';
    }
  }

  renderHistory();
  if ('serviceWorker' in navigator) {
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(() => {});
    // Si una versió nova pren el control, recarrega perquè es vegi de seguida
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) location.reload(); });
  }
})();
