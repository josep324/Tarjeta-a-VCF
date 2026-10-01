/* Extracció de dades de contacte de text desestructurat + generació/validació vCard 3.0.
   Sense dependències; funciona al navegador (window.CardParser) i a Node (module.exports). */
(function (root) {
  'use strict';

  const L = '\\p{L}';
  const wordRe = (words) =>
    new RegExp(`(?<![${L}])(?:${words.join('|')})(?![${L}])`, 'iu');

  const TITLE_WORDS = [
    'director(?:a)?', 'directiu', 'directiva', 'gerent(?:e)?', 'ceo', 'cto', 'cfo', 'coo', 'cmo', 'cio',
    'president(?:a|e)?', 'vicepresident(?:a|e)?', 'fundador(?:a)?', 'co-?founder', 'founder', 'cofundador(?:a)?',
    'manager', 'responsable', 'cap', 'jefe', 'jefa', 'head', 'lead',
    'enginyer(?:a)?', 'ingenier[oa]', 'engineer', 'arquitect(?:e|a|o)', 'architect',
    'consultor(?:a)?', 'consultant', 'comercial', 'advocat(?:da)?', 'abogad[oa]', 'lawyer', 'attorney',
    'doctor(?:a)?', 'm[eè]dic', 'm[eé]dic[oa]', 's[oò]ci(?:a)?', 'socio', 'partner', 'owner',
    'propietari(?:a)?', 'propietario', 'administrador(?:a)?', 'coordinador(?:a)?', 'analista', 'analyst',
    'developer', 'desenvolupador(?:a)?', 'desarrollador(?:a)?', 'dissenyador(?:a)?', 'dise[ñn]ador(?:a)?',
    'designer', 't[eè]cnic(?:a)?', 't[eé]cnic[oa]', 'assessor(?:a)?', 'asesor(?:a)?', 'advisor',
    'secretari(?:a)?', 'gestor(?:a)?', 'comptable', 'contable', 'accountant', 'executive', 'ejecutiv[oa]',
    'associate', 'supervisor(?:a)?', 'professor(?:a)?', 'profesor(?:a)?', 'representant(?:e)?',
    'delegat|delegad[oa]', 'especialista', 'specialist', 'officer', 'chief', 'senior', 'junior', 'freelance',
    'cirurgi[aà]', 'cirujan[oa]', 'psic[oò]leg(?:a)?', 'psic[oó]log[oa]', 'fotògraf(?:a)?', 'fot[oó]graf[oa]'
  ];
  const TITLE_RE = wordRe(TITLE_WORDS);

  const DEPT_WORDS = /^(ventas|vendes|sales|marketing|operaciones|operacions|operations|finanzas|finances|finance|tecnolog[ií]a|tecnologia|technology|producto|producte|product|comercial|recursos|rrhh|hr|desarrollo|desenvolupament|development|proyectos|projectes|projects|sistemas|sistemes|systems|negocio|negoci|business|clientes|clients|customers|compras|compres|log[ií]stica|calidad|qualitat|quality|[aá]rea|[aà]rea|departamento|departament|general|it|i\+d)$/iu;

  const COMPANY_RE = new RegExp(
    `(?:^|[\\s,(])(?:S\\.?\\s?L\\.?\\s?U?|S\\.?\\s?A\\.?|S\\.?\\s?C\\.?\\s?P|S\\.?\\s?L\\.?\\s?L|Ltd|LLC|Inc|GmbH|Corp|Co|SAS|SARL|AG|B\\.?V|Group|Grup|Grupo|Studio|Estudi|Estudio|Consulting|Solutions|Technologies|Systems|Associates|Associats|Asociados|Partners|Labs|Software|Soft|Cooperativa|Fundaci[oó]|Fundaci[oó]n|Associaci[oó]|Asociaci[oó]n)\\.?(?=$|[\\s,.)])`,
    'i'
  );

  const STREET_RE = new RegExp(
    `^(?:c\\/|c\\.|cl\\.?|carrer|calle|av\\.?|avda\\.?|avinguda|avenida|passeig|paseo|pg\\.?|pça\\.?|pl[aà]ça|plaza|pl\\.|ronda|cam[ií]|camino|carretera|ctra\\.?|pol[ií]gon(?:o)?|pol\\.|edifici|edificio|street|st\\.|road|rd\\.|avenue|boulevard|blvd|lane|via|rambla|travessera|travesia|gran\\s+via|parc|parque)(?![${L}])`,
    'iu'
  );

  const COUNTRIES = /^(espa[ñn]a|spain|andorra|fran[cç]a|france|francia|portugal|it[aà]lia|italia|italy|alemanya|alemania|germany|deutschland|regne\s+unit|reino\s+unido|united\s+kingdom|uk|usa|united\s+states|estats\s+units|estados\s+unidos|m[eé]xico|argentina|col[oó]mbia|colombia|xile|chile|per[uú]|belgium|b[eè]lgica|holanda|netherlands|pa[ïi]sos\s+baixos|su[ïi]ssa|suiza|switzerland)\.?$/iu;

  const LABEL_ONLY = /^(?:tel(?:f|[eè]fon[oa]?)?|phone|m[oò]bil|m[oó]vil|mobile|cel(?:ular)?|fax|e-?mail|mail|correu|correo|web|website|site|url|www|direcci[oó]n?|address|adre[cç]a|ubicaci[oó]n?|[a-z])\.?\s*[:.\-–]?$/iu;

  const LOCATION_RE = /^(?:(?:la\s+|el\s+|nostra\s+|nuestra\s+)?(?:oficina|office|despatx|despacho|seu|sede|ubicad[oa]|ubicaci[oó]n?|located|localitzad[oa]|ciutat|ciudad|city|localitat|localidad)(?:\s+(?:central|principal|d'[a-z]+|de\s+[a-z]+))?)\s*(?:a|en|in|at|:|-)?\s*(.+)$/iu;

  const PARTICLES = new Set(['de', 'del', 'della', 'di', 'da', 'dos', 'das', 'do', 'la', 'las', 'los', 'el', 'van', 'von', 'der', 'den', 'le', 'y', 'i', "d'", 'mc', 'mac']);

  const clean = (s) => s.replace(/\s+/g, ' ').trim();
  const stripEnds = (s) => s.replace(/^[\s,;:|·•\-–—_*]+|[\s,;:|·•\-–—_*]+$/g, '').trim();

  function titleCaseIfShouting(s) {
    const letters = s.replace(/[^\p{L}]/gu, '');
    if (letters.length > 1 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) {
      return s.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
    }
    return s;
  }

  function capFirst(s) {
    return s && s === s.toLowerCase() ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function emptyContact() {
    return {
      given: '', family: '', org: '', title: '',
      phones: [], emails: [], urls: [],
      adr: { street: '', city: '', region: '', postal: '', country: '' },
      note: ''
    };
  }

  function splitName(full) {
    const tokens = clean(full).split(' ').filter(Boolean);
    if (tokens.length <= 1) return { given: tokens[0] || '', family: '' };
    let pIdx = -1;
    for (let i = 1; i < tokens.length; i++) {
      if (PARTICLES.has(tokens[i].toLowerCase())) { pIdx = i; break; }
    }
    let cut;
    if (pIdx > 0) cut = pIdx;
    else if (tokens.length >= 4) cut = 2;
    else cut = 1;
    return { given: tokens.slice(0, cut).join(' '), family: tokens.slice(cut).join(' ') };
  }

  const EMAIL_RE = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
  const URL_RE = /(?:https?:\/\/|www\.)[^\s,;<>()"']+|(?<![@\w.-])[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|es|cat|eu|io|co|info|biz|app|dev|fr|de|uk|it|pt|ad|ai|tech|online|shop|studio|agency|digital)(?:\/[^\s,;<>()"']*)?(?![\w@-])/gi;
  const PHONE_RE = /(?:\+|00)?\d[\d\s().\-/]{6,}\d/g;

  function normalizeUrl(u) {
    u = u.replace(/[.,;:)\]]+$/, '');
    return /^https?:\/\//i.test(u) ? u : 'https://' + u;
  }

  function phoneType(before, num) {
    const b = before.toLowerCase();
    if (/(fax|\bf\s*[:.]\s*$)/.test(b)) return 'FAX';
    if (/(m[oò]bil|m[oó]vil|mobile|cel|\bm\s*[:.]\s*$|whats)/.test(b)) return 'CELL';
    const digits = num.replace(/\D/g, '').replace(/^(00)?34/, '');
    if (digits.length === 9 && /^[67]/.test(digits)) return 'CELL';
    return 'WORK';
  }

  /** Extreu dades de contacte d'un text lliure. */
  function parseContact(raw) {
    const c = emptyContact();
    if (!raw || !raw.trim()) return c;

    // [text](url) -> url ; normalitza espais exòtics
    let text = raw.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (m, a, b) => b || a).replace(/[\u00a0\u2007\u202f]/g, ' ');

    // Línies; les que no són adreça es divideixen per comes/separadors
    const segments = [];
    for (const line0 of text.split(/\r?\n/)) {
      const line = clean(line0);
      if (!line) continue;
      const isAddr = STREET_RE.test(line) || /\b\d{5}\b\s+\p{L}/u.test(line);
      if (isAddr) { segments.push(line); continue; }
      for (const part of line.split(/\s*(?:[;|·•]|,(?!\d)|\s[-–—]\s)\s*/)) {
        const p = clean(part);
        if (p) segments.push(p);
      }
    }

    const addr = { streets: [], postal: '', city: '', country: '' };
    const rest = []; // {text, idx}

    segments.forEach((seg0, idx) => {
      let seg = seg0;

      // Emails
      seg = seg.replace(EMAIL_RE, (m) => {
        if (!c.emails.includes(m)) c.emails.push(m);
        return ' ';
      });
      // URLs
      seg = seg.replace(URL_RE, (m) => {
        const u = normalizeUrl(m);
        if (!c.urls.includes(u)) c.urls.push(u);
        return ' ';
      });
      // Telèfons (només si no és una adreça amb número de carrer)
      if (!STREET_RE.test(seg)) {
        seg = seg.replace(PHONE_RE, (m, offset, whole) => {
          const digits = m.replace(/\D/g, '');
          if (digits.length < 9 || digits.length > 15) return m;
          const before = whole.slice(Math.max(0, offset - 14), offset);
          const value = m.trim().replace(/\s{2,}/g, ' ');
          if (!c.phones.some((p) => p.value.replace(/\D/g, '') === digits)) {
            c.phones.push({ type: phoneType(before, m), value });
          }
          return ' ';
        });
      }
      seg = stripEnds(clean(seg));
      if (!seg || LABEL_ONLY.test(seg)) return;
      // treu etiquetes inicials ("Email:", "Tel.")
      seg = stripEnds(seg.replace(/^(?:tel(?:f|[eè]fon[oa]?)?|phone|m[oò]bil|m[oó]vil|mobile|e-?mail|correu|correo|web|fax)\.?\s*[:.]?\s+/iu, ''));
      if (!seg || LABEL_ONLY.test(seg)) return;

      // Adreça
      const cp = seg.match(/(.*?)[\s,]*\b(\d{5})\b[\s,]+([\p{L}][\p{L}\s.'’-]*)$/u);
      if (STREET_RE.test(seg) || cp) {
        if (cp) {
          if (stripEnds(cp[1])) addr.streets.push(stripEnds(cp[1]));
          addr.postal = cp[2];
          let city = stripEnds(cp[3]);
          const parts = city.split(/\s*[,(-]\s*/);
          if (parts.length > 1 && COUNTRIES.test(parts[parts.length - 1])) { addr.country = parts.pop(); city = parts.join(', '); }
          addr.city = titleCaseIfShouting(city);
        } else {
          addr.streets.push(seg);
        }
        return;
      }
      if (COUNTRIES.test(seg)) { addr.country = seg.replace(/\.$/, ''); return; }

      // "oficina a Barcelona"
      const loc = seg.match(LOCATION_RE);
      if (loc) { addr.city = addr.city || stripEnds(loc[1]); return; }

      rest.push({ text: seg, idx });
    });

    // Títol / empresa / nom
    const nameRe = new RegExp(`^\\p{Lu}[\\p{L}'’.-]*$`, 'u');
    const isNameLike = (s) => {
      if (/\d|@/.test(s)) return false;
      if (TITLE_RE.test(s) || COMPANY_RE.test(s)) return false;
      const toks = s.split(' ').filter(Boolean);
      if (toks.length < 2 || toks.length > 5) return false;
      let caps = 0;
      for (const t of toks) {
        if (nameRe.test(t)) caps++;
        else if (!PARTICLES.has(t.toLowerCase())) return false;
      }
      return caps >= 2;
    };

    const leftovers = [];
    let nameSeg = null, titleIdx = -1;
    const used = new Set();

    // Títol (+ empresa dins del mateix fragment)
    for (const r of rest) {
      if (c.title || !TITLE_RE.test(r.text)) continue;
      let t = r.text, company = '';
      const m = t.match(/^(.*?)\s+(?:@|at|a|en|de|of)\s+(.+)$/iu) || t.match(/^(.*?)\s*(?:@|d')\s*(.+)$/iu);
      if (m) {
        const after = m[2].trim();
        const isAt = /\s(?:@|at)\s/i.test(r.text) || /@/.test(r.text);
        const first = after.split(' ')[0];
        const looksCompany = /^\p{Lu}/u.test(after) && !DEPT_WORDS.test(first) && TITLE_RE.test(m[1]);
        if ((isAt || looksCompany) && m[1].trim()) { t = m[1].trim(); company = after; }
      }
      c.title = capFirst(stripEnds(t));
      if (company && !c.org) c.org = stripEnds(company);
      used.add(r);
      titleIdx = r.idx;
    }

    // Empresa per sufix legal
    for (const r of rest) {
      if (used.has(r) || c.org) continue;
      if (COMPANY_RE.test(r.text) && !TITLE_RE.test(r.text)) { c.org = r.text; used.add(r); }
    }

    // Nom: candidat immediatament abans del títol, si no el primer
    const cands = rest.filter((r) => !used.has(r) && isNameLike(
      r.text.replace(/^(?:contact(?:a|ar|e)?|llama(?:r)?|trucar?|truca)\s+(?:amb|con|with|a)?\s*/iu, '')
        .replace(/^(?:(?:la|el|en|na|l')\s*)/iu, '').replace(/^(?:sr\.?|sra\.?|dr\.?|dra\.?|mr\.?|mrs\.?|ms\.?)\s+/iu, '')
    ));
    let pick = cands.find((r) => titleIdx >= 0 && r.idx === titleIdx - 1) || cands[0];
    if (!pick) {
      // Frases lliures tipus "Contacta amb la Marta Pérez"
      for (const r of rest) {
        if (used.has(r)) continue;
        const m = r.text.match(/^(?:contact(?:a|ar|e)?|llama(?:r)?|trucar?|truca|contact|call)\s+(?:amb|con|with|a)?\s*(?:(?:la|el|en|na|l')\s*)?(.+)$/iu);
        if (m && isNameLike(m[1])) { pick = r; pick.text = m[1]; break; }
      }
    }
    if (pick) {
      let n = pick.text
        .replace(/^(?:contact(?:a|ar|e)?|llama(?:r)?|trucar?|truca|call)\s+(?:amb|con|with|a)?\s*/iu, '')
        .replace(/^(?:(?:la|el|en|na|l')\s*)/iu, '')
        .replace(/^(?:sr\.?|sra\.?|dr\.?|dra\.?|mr\.?|mrs\.?|ms\.?)\s+/iu, '');
      nameSeg = titleCaseIfShouting(clean(n));
      used.add(pick);
      const sp = splitName(nameSeg);
      c.given = sp.given; c.family = sp.family;
    }

    for (const r of rest) if (!used.has(r)) leftovers.push(r);

    // Empresa sense sufix: primer fragment curt i "net" que quedi
    const found = c.given || c.family || c.phones.length || c.emails.length || c.urls.length || c.title || c.org ||
      addr.streets.length || addr.city || addr.postal;
    if (!c.org) {
      const i = !found ? -1 : leftovers.findIndex((r) => {
        const words = r.text.split(' ');
        const letters = r.text.replace(/[^\p{L}]/gu, '').length;
        return words.length <= 4 && letters >= 2 && letters / r.text.replace(/\s/g, '').length > 0.8;
      });
      if (i >= 0) c.org = titleCaseIfShouting(leftovers.splice(i, 1)[0].text);
    } else {
      c.org = c.org.replace(/\S+/g, (w) => w);
      c.org = titleCaseIfShouting(c.org);
    }
    c.org = c.org.replace(/(^|\s)(s\.?\s?[lac]\.?\s?u?\.?|ltd|llc|inc|gmbh|ag|sas|sarl|b\.?v\.?)(?=$|[\s,])/gi, (m, a, b) => a + b.toUpperCase());

    c.adr.street = addr.streets.join(', ');
    c.adr.postal = addr.postal;
    c.adr.city = addr.city;
    c.adr.country = addr.country;
    c.note = found ? leftovers.map((r) => r.text).join('\n') : '';
    return c;
  }

  // ---------- vCard 3.0 ----------
  const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');

  function fold(line) {
    // Plega a 75 octets (aprox. 75 caràcters; respecta parells subrogats)
    const out = [];
    let cur = '';
    let bytes = 0;
    for (const ch of line) {
      const b = new TextEncoder().encode(ch).length;
      const limit = out.length === 0 ? 75 : 74;
      if (bytes + b > limit) { out.push(cur); cur = ch; bytes = b; } else { cur += ch; bytes += b; }
    }
    out.push(cur);
    return out.map((l, i) => (i ? ' ' + l : l)).join('\r\n');
  }

  function buildVcf(c) {
    const given = (c.given || '').trim(), family = (c.family || '').trim();
    const fn = [given, family].filter(Boolean).join(' ') || (c.org || '').trim();
    const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
    lines.push(`N:${esc(family)};${esc(given)};;;`);
    lines.push(`FN:${esc(fn)}`);
    if ((c.org || '').trim()) lines.push(`ORG:${esc(c.org.trim())}`);
    if ((c.title || '').trim()) lines.push(`TITLE:${esc(c.title.trim())}`);
    for (const p of c.phones || []) {
      if (!(p.value || '').trim()) continue;
      const t = p.type === 'CELL' ? 'CELL' : p.type === 'FAX' ? 'WORK,FAX' : p.type === 'HOME' ? 'HOME,VOICE' : 'WORK,VOICE';
      lines.push(`TEL;TYPE=${t}:${esc(p.value.trim())}`);
    }
    for (const e of c.emails || []) if ((e || '').trim()) lines.push(`EMAIL;TYPE=INTERNET:${esc(e.trim())}`);
    for (const u of c.urls || []) if ((u || '').trim()) lines.push(`URL:${String(u).trim().replace(/\r?\n/g, '')}`);
    const a = c.adr || {};
    if ([a.street, a.city, a.region, a.postal, a.country].some((x) => (x || '').trim())) {
      lines.push(`ADR;TYPE=WORK:;;${esc(a.street)};${esc(a.city)};${esc(a.region)};${esc(a.postal)};${esc(a.country)}`);
    }
    if ((c.note || '').trim()) lines.push(`NOTE:${esc(c.note.trim())}`);
    lines.push('END:VCARD');
    return lines.map(fold).join('\r\n') + '\r\n';
  }

  /** Valida l'estructura bàsica d'un vCard 3.0. Retorna llista d'errors (buida = vàlid). */
  function validateVcf(vcf) {
    const errors = [];
    const unfolded = vcf.replace(/\r?\n[ \t]/g, '');
    const lines = unfolded.split(/\r?\n/).filter((l) => l !== '');
    if (lines[0] !== 'BEGIN:VCARD') errors.push('Falta BEGIN:VCARD');
    if (lines[lines.length - 1] !== 'END:VCARD') errors.push('Falta END:VCARD');
    if (!lines.includes('VERSION:3.0')) errors.push('Falta VERSION:3.0');
    const n = lines.find((l) => l.startsWith('N:'));
    if (!n) errors.push('Falta el camp N');
    else if ((n.match(/(?<!\\);/g) || []).length !== 4) errors.push('El camp N ha de tenir 5 components');
    if (!lines.some((l) => l.startsWith('FN:'))) errors.push('Falta el camp FN');
    for (const l of lines.slice(1, -1)) {
      if (!/^[A-Za-z0-9-]+(;[^:;]+(=[^:]*)?)*:/.test(l)) errors.push(`Línia mal formada: ${l.slice(0, 30)}`);
    }
    const adr = lines.find((l) => l.startsWith('ADR'));
    if (adr && (adr.slice(adr.indexOf(':') + 1).match(/(?<!\\);/g) || []).length !== 6) errors.push('El camp ADR ha de tenir 7 components');
    return errors;
  }

  /** Avisos de qualitat de dades (no bloquejants). */
  function checkContact(c) {
    const w = [];
    if (!c.given && !c.family) w.push('No s\'ha trobat cap nom.');
    for (const e of c.emails) if (!/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(e)) w.push(`Email dubtós: ${e}`);
    for (const p of c.phones) {
      const d = (p.value || '').replace(/\D/g, '').length;
      if (d < 9 || d > 15) w.push(`Telèfon dubtós: ${p.value}`);
    }
    for (const u of c.urls) { try { new URL(u); } catch { w.push(`Web dubtosa: ${u}`); } }
    return w;
  }

  const api = { parseContact, buildVcf, validateVcf, checkContact, emptyContact, splitName };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CardParser = api;
})(typeof window !== 'undefined' ? window : globalThis);
