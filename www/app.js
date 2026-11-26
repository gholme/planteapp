/* Planteøving – enkel app for å lære plantenavn.
   Ingen avhengigheter. Alt lagres lokalt (localStorage). */
(function () {
  'use strict';

  var STORE = 'planteapp.v1';
  // Dager til neste repetisjon for hver boks (Leitner).
  var INTERVALS = [0, 1, 2, 4, 7, 14, 30];
  var LEARNED_BOX = 3;
  var ORIGINAL = window.PLANTER_ORIGINAL || [];
  var GROUP_ORDER = ['Trær', 'Busker', 'Frukt og bær', 'Stauder', 'Klatreplanter', 'Roser'];

  var app = document.getElementById('app');
  var modalEl = document.getElementById('modal');
  var toastEl = document.getElementById('toast');

  // ---------- Hjelpere ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function dayNum() {
    var d = new Date();
    return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
  }
  function normalize(s) {
    return String(s || '').toLowerCase()
      .replace(/×/g, 'x')
      .replace(/['"‘’“”«»!?.,:;]/g, ' ')
      .replace(/\b(f|var|subsp|ssp)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function genus(p) { return normalize(p.latin).split(' ')[0]; }

  // ---------- Bilder ----------
  var ORIG_BY_ID = {}, ORIG_BY_LATIN = {};
  ORIGINAL.forEach(function (p) { ORIG_BY_ID[p.id] = p; ORIG_BY_LATIN[normalize(p.latin)] = p; });
  // Bilde for en plante. Faller tilbake til originallisten, så også eldre redigerte lister får bilder.
  function imageOf(p) {
    if (p.bilde) return p.bilde;
    var o = ORIG_BY_ID[p.id];
    if (o && o.bilde && normalize(o.latin) === normalize(p.latin)) return o.bilde;
    o = ORIG_BY_LATIN[normalize(p.latin)];
    return o && o.bilde ? o.bilde : null;
  }
  function infoOf(p) {
    if (p.info) return p.info;
    var o = ORIG_BY_ID[p.id];
    if (o && o.info && normalize(o.latin) === normalize(p.latin)) return o.info;
    o = ORIG_BY_LATIN[normalize(p.latin)];
    return o && o.info ? o.info : null;
  }
  // Spørsmål til skolen (data/sjekkliste.json). Hentes alltid fra originallista.
  function sjekkOf(p) {
    var o = ORIG_BY_ID[p.id];
    if (!(o && normalize(o.latin) === normalize(p.latin))) o = ORIG_BY_LATIN[normalize(p.latin)];
    return o && o.sjekk && o.sjekk.length ? o.sjekk : null;
  }
  function imgHtml(p, cls) {
    var b = imageOf(p);
    if (!b) return '<div class="noimg ' + (cls || '') + '" aria-hidden="true">🌿</div>';
    return '<img class="' + (cls || '') + '" src="' + esc(b.fil) + '" alt="' + esc(p.norsk) + '" loading="lazy" decoding="async">';
  }

  // ---------- Egne bilder (lagres i IndexedDB på telefonen) ----------
  var canPhoto = 'indexedDB' in window;
  var photoDb = null;
  var photos = {}; // plante-id -> [{key, plant, blob, created, url}], nyeste først
  var plantPicIdx = {}; // valgt bilde på plantesiden
  function idbReq(r) {
    return new Promise(function (res, rej) {
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function photoStore(mode) { return photoDb.transaction('photos', mode).objectStore('photos'); }
  function openPhotoDb() {
    if (!canPhoto) return Promise.reject(new Error('ingen IndexedDB'));
    var r = indexedDB.open('planteapp-bilder', 1);
    r.onupgradeneeded = function () {
      var s = r.result.createObjectStore('photos', { keyPath: 'key', autoIncrement: true });
      s.createIndex('plant', 'plant');
    };
    return idbReq(r).then(function (d) { photoDb = d; return d; });
  }
  function cachePhoto(rec) {
    if (!rec.url) rec.url = URL.createObjectURL(rec.blob);
    var l = photos[rec.plant] || (photos[rec.plant] = []);
    l.push(rec);
    l.sort(function (a, b) { return b.created - a.created; });
  }
  function loadPhotos() {
    return openPhotoDb()
      .then(function () { return idbReq(photoStore('readonly').getAll()); })
      .then(function (list) { list.forEach(cachePhoto); return list.length; })
      .catch(function () { return 0; });
  }
  function ownPhotos(p) { return (p && p.id && photos[p.id]) || []; }
  function hasOwn(p) { return ownPhotos(p).length > 0; }
  // Bildet som vises for en plante: eget (nyeste) eller originalen fra Wikipedia.
  function shownPic(p, preferOwn) {
    var own = ownPhotos(p), b = imageOf(p);
    if (own.length && (preferOwn || !b)) return { own: own[0] };
    return b ? { orig: b } : null;
  }
  function allPics(p) {
    var b = imageOf(p);
    return ownPhotos(p).map(function (r) { return { own: r }; }).concat(b ? [{ orig: b }] : []);
  }
  function picImg(pic, alt, cls) {
    if (!pic) return '<div class="noimg ' + (cls || '') + '" aria-hidden="true">🌿</div>';
    var src = pic.own ? pic.own.url : pic.orig.fil;
    return '<img class="' + (cls || '') + '" src="' + esc(src) + '" alt="' + esc(alt) + '" loading="lazy" decoding="async">';
  }
  function dateTxt(ms) {
    var d = new Date(ms);
    return d.getDate() + '. ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }
  function creditHtml(pic) {
    if (!pic) return '';
    if (pic.own) return '<div class="credit">📷 Eget bilde · ' + esc(dateTxt(pic.own.created)) + '</div>';
    var b = pic.orig;
    return '<div class="credit">Foto: ' + esc(b.fotograf) + (b.lisens ? ' · ' + esc(b.lisens) : '') + '</div>';
  }
  function addBtn(p, cls) {
    if (!canPhoto || !p || !p.id) return '';
    return '<button type="button" class="' + (cls || 'picbtn') + ' add" data-act="addPhoto" data-id="' + esc(p.id) + '" aria-label="Legg til eget bilde av ' + esc(p.norsk) + '">＋</button>';
  }
  function delBtn(pic, cls) {
    if (!pic || !pic.own) return '';
    return '<button type="button" class="' + (cls || 'picbtn') + ' del" data-act="delPhoto" data-id="' + esc(pic.own.plant) + '" data-key="' + pic.own.key + '" aria-label="Slett bildet">🗑</button>';
  }
  // Stort bilde med ＋ og 🗑 oppå.
  // nav = { idx, n } gjør bildet sveipbart (plantesiden) og viser teller.
  function picBlock(p, pic, nav) {
    if (!pic && !canPhoto) return '';
    var sw = nav && nav.n > 1;
    return '<div class="pic' + (sw ? ' swipe' : '') + '"' + (sw ? ' data-swipe="' + esc(p.id) + '" data-n="' + nav.n + '"' : '') + '>' +
      picImg(pic, p.norsk, 'big' + (sw && slideDir ? ' slide-' + slideDir : '')) + addBtn(p) + delBtn(pic) +
      (sw ? '<span class="piccount">' + (nav.idx + 1) + ' / ' + nav.n + '</span>' : '') + '</div>' + creditHtml(pic);
  }
  // Sveip til venstre/høyre for å bla mellom bildene.
  var slideDir = '', swipeStart = null;
  function showPic(id, idx, dir) {
    plantPicIdx[id] = idx;
    slideDir = dir;
    refresh();
    slideDir = '';
  }

  // Krymper bildet til maks 1024 px (JPEG), så det tar lite plass.
  function shrinkImage(file) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var max = 1024, w = im.naturalWidth, h = im.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u);
        c.toBlob(function (b) { if (b) res(b); else rej(new Error('toBlob')); }, 'image/jpeg', 0.82);
      };
      im.onerror = function () { URL.revokeObjectURL(u); rej(new Error('kunne ikke lese bildet')); };
      im.src = u;
    });
  }
  function savePhoto(plantId, blob) {
    var rec = { plant: plantId, blob: blob, created: Date.now() };
    return idbReq(photoStore('readwrite').add(rec)).then(function (key) { rec.key = key; cachePhoto(rec); });
  }
  // To skjulte filvelgere: én som åpner kameraet direkte, og én for galleriet.
  // (Nyere Android viser bare galleriet hvis vi ikke ber om kamera selv.)
  function makeInput(camera) {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.hidden = true;
    if (camera) inp.setAttribute('capture', 'environment'); else inp.multiple = true;
    inp.addEventListener('change', function () { onFiles(inp); });
    document.body.appendChild(inp);
    return inp;
  }
  var cameraInput = makeInput(true), galleryInput = makeInput(false);
  var pendingPlant = null;
  function pickPhoto(id) {
    if (!photoDb) { toast('Bilder kan ikke lagres på denne enheten'); return; }
    var p = findPlant(id);
    modalEl.innerHTML =
      '<div class="card stack" role="dialog" aria-modal="true">' +
      '<p><b>Legg til bilde' + (p ? ' av ' + esc(p.norsk) : '') + '</b></p>' +
      '<button class="btn primary" data-pick="camera">📷 Ta bilde</button>' +
      '<button class="btn" data-pick="gallery">🖼️ Velg fra galleri</button>' +
      '<button class="btn ghost" data-pick="" style="width:100%">Avbryt</button></div>';
    modalEl.hidden = false;
    modalEl.onclick = function (e) {
      var b = e.target.closest('[data-pick]');
      if (!b && e.target !== modalEl) return;
      modalEl.hidden = true; modalEl.onclick = null;
      var kind = b && b.getAttribute('data-pick');
      if (!kind) return;
      var inp = kind === 'camera' ? cameraInput : galleryInput;
      pendingPlant = id;
      inp.value = '';
      inp.click(); // må skje direkte i trykket, ellers blokkerer nettleseren det
    };
  }
  function onFiles(inp) {
    var files = [].slice.call(inp.files || []), id = pendingPlant;
    inp.value = ''; pendingPlant = null;
    if (!files.length || !id) return;
    toast('Lagrer bildet …');
    files.reduce(function (pr, f) {
      return pr.then(function () { return shrinkImage(f).then(function (b) { return savePhoto(id, b); }); });
    }, Promise.resolve()).then(function () {
      plantPicIdx[id] = 0;
      toast(files.length > 1 ? '📷 ' + files.length + ' bilder er lagt til' : '📷 Bildet er lagt til');
      refresh();
    }, function () { toast('Klarte ikke å lagre bildet'); refresh(); });
  }
  function removePhoto(id, key) {
    var l = photos[id] || [], rec = null;
    for (var i = 0; i < l.length; i++) if (l[i].key === key) { rec = l.splice(i, 1)[0]; break; }
    if (!rec) return;
    if (!l.length) delete photos[id];
    idbReq(photoStore('readwrite').delete(key)).catch(function () {});
    refresh();
    toastUndo('Bildet er slettet', function () {
      idbReq(photoStore('readwrite').put({ key: rec.key, plant: rec.plant, blob: rec.blob, created: rec.created }))
        .then(function () { cachePhoto(rec); refresh(); }, function () { toast('Klarte ikke å hente bildet tilbake'); });
    });
  }
  function removeAllPhotos(id) {
    ownPhotos({ id: id }).forEach(function (r) { idbReq(photoStore('readwrite').delete(r.key)).catch(function () {}); });
    delete photos[id];
  }

  // ---------- Opplesning ----------
  var voice = null;
  var canSpeak = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  function pickVoice() {
    var vs = window.speechSynthesis.getVoices() || [];
    voice = vs.filter(function (v) { return /^(nb|no|nn)\b/i.test(v.lang); })[0] || null;
  }
  if (canSpeak) {
    pickVoice();
    if ('onvoiceschanged' in window.speechSynthesis) window.speechSynthesis.onvoiceschanged = pickVoice;
  }
  function speechText(t) {
    return String(t || '')
      .replace(/×/g, ' ')
      // Vanlige forkortelser
      .replace(/\bca\.\s?/gi, 'cirka ')
      .replace(/\bf\.eks\.\s?/gi, 'for eksempel ')
      .replace(/\bbl\.a\.\s?/gi, 'blant annet ')
      .replace(/\bevt\.\s?/gi, 'eventuelt ')
      .replace(/\bosv\./gi, 'og så videre')
      .replace(/\bpH\b/g, 'p H')
      // Soner, mål og intervaller
      .replace(/H(\d)–H(\d)/g, 'sone $1 til $2')
      .replace(/(\d\s?c?m)\s–\s(\d)/g, '$1 til $2')
      .replace(/(\d)\s?cm\b/g, '$1 centimeter')
      .replace(/(\d)\s?m\b/g, '$1 meter')
      .replace(/\s[–·]\s/g, ', ')
      .replace(/–/g, ' til ')
      .replace(/\bf\.\s/g, 'forma ')
      .replace(/\bvar\.\s/g, 'varietet ')
      .replace(/\bsubsp\.\s/g, 'underart ')
      .replace(/['"‘’«»]/g, '')
      .replace(/\s*[()]\s*/g, ', ')
      .replace(/(,\s*)+/g, ', ')
      .replace(/,\s*([.!?]|$)/g, '$1')
      .replace(/([.!?])\s*,/g, '$1')
      .replace(/\.(\s*\.)+/g, '.')
      .trim();
  }
  function speak(t) {
    if (!canSpeak) { toast('Opplesning støttes ikke på denne enheten'); return; }
    var s = window.speechSynthesis;
    s.cancel();
    var u = new SpeechSynthesisUtterance(speechText(t));
    u.lang = voice ? voice.lang : 'nb-NO';
    if (voice) u.voice = voice;
    u.rate = 0.85;
    s.speak(u);
  }
  function sayBtn(text, cls) {
    if (!canSpeak) return '';
    return '<button type="button" class="say ' + (cls || '') + '" data-act="say" data-text="' + esc(text) + '" aria-label="Les opp ' + esc(text) + '">🔊</button>';
  }
  function levenshtein(a, b) {
    if (a === b) return 0;
    var m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      var t = prev; prev = cur; cur = t;
    }
    return prev[n];
  }
  function tolerance(len) { return len <= 4 ? 0 : len <= 8 ? 1 : 2; }
  // Varianter av et navn som godtas: hele navnet, uten parentes, innholdet i parentes, uten «x».
  function variants(name) {
    var out = [name];
    var noPar = name.replace(/\([^)]*\)/g, ' ');
    out.push(noPar);
    var m = name.match(/\(([^)]*)\)/g);
    if (m) m.forEach(function (x) {
      var inner = x.slice(1, -1);
      if (!/hybrid|prydepl|\?/i.test(inner)) out.push(inner);
    });
    var res = [];
    out.forEach(function (v) {
      var n = normalize(v);
      if (n) { res.push(n); res.push(n.replace(/ x /g, ' ')); }
    });
    return res.filter(function (v, i) { return v && res.indexOf(v) === i; });
  }

  // ---------- Tilstand ----------
  function defaults() {
    return {
      plants: null, // null = bruk originallisten
      progress: {},
      settings: { mode: 'mc', dir: 'mix', groups: [], size: 15, newPer: 8, includeUnsure: true, autoSpeak: true, sone: 0, ownPhotos: true, onlySchool: false },
      streak: { last: null, count: 0 }
    };
  }
  function loadState() {
    var d = defaults(), s = null;
    try { s = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { s = null; }
    if (!s || typeof s !== 'object') return d;
    return {
      plants: Array.isArray(s.plants) ? s.plants : null,
      progress: s.progress && typeof s.progress === 'object' ? s.progress : {},
      settings: Object.assign(d.settings, s.settings || {}),
      streak: Object.assign(d.streak, s.streak || {})
    };
  }
  var state = loadState();
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); }
    catch (e) { toast('Kunne ikke lagre på denne enheten'); }
  }
  function plants() { return state.plants || ORIGINAL; }
  function editable() {
    if (!state.plants) state.plants = clone(ORIGINAL);
    return state.plants;
  }
  function findPlant(id) {
    var l = plants();
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }
  function allGroups() {
    var seen = {};
    plants().forEach(function (p) { if (p.gruppe) seen[p.gruppe] = true; });
    return Object.keys(seen).sort(function (a, b) {
      var ia = GROUP_ORDER.indexOf(a), ib = GROUP_ORDER.indexOf(b);
      if (ia < 0) ia = 99; if (ib < 0) ib = 99;
      return ia - ib || a.localeCompare(b, 'nb');
    });
  }
  function usable(p) { return p && p.latin && p.norsk && p.aktiv !== false; }
  function activePool() {
    var g = state.settings.groups;
    var school = state.settings.onlySchool && schoolCount() > 0;
    return plants().filter(function (p) {
      return usable(p) &&
        (!school || hasOwn(p)) &&
        (state.settings.includeUnsure || p.status !== 'sjekk') &&
        (!g.length || g.indexOf(p.gruppe) >= 0);
    });
  }
  // Planter med egne bilder = planter som finnes på skolen.
  function schoolCount() { return plants().filter(function (p) { return usable(p) && hasOwn(p); }).length; }
  function prog(id) { return state.progress[id]; }
  function box(id) { var p = prog(id); return p ? p.box : -1; }

  function grade(id, ok) {
    var today = dayNum();
    var pr = prog(id) || { box: 0, due: today, right: 0, wrong: 0, seen: 0 };
    pr.seen++;
    if (ok) { pr.right++; pr.box = Math.min(pr.box + 1, INTERVALS.length - 1); }
    else { pr.wrong++; pr.box = 0; }
    pr.due = today + INTERVALS[pr.box];
    pr.last = today;
    state.progress[id] = pr;
    var st = state.streak;
    if (st.last !== today) {
      st.count = st.last === today - 1 ? st.count + 1 : 1;
      st.last = today;
    }
    save();
  }
  function currentStreak() {
    var st = state.streak, today = dayNum();
    return st.last != null && st.last >= today - 1 ? st.count : 0;
  }

  // ---------- UI-hjelpere ----------
  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.onclick = null;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2200);
  }
  // Melding med «Angre»-knapp (vises litt lenger).
  function toastUndo(msg, undo) {
    toastEl.innerHTML = esc(msg) + ' <button type="button" class="undo">Angre</button>';
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    function close() { toastEl.hidden = true; toastEl.onclick = null; }
    toastEl.onclick = function (e) {
      if (!e.target.closest('.undo')) return;
      clearTimeout(toastTimer); close(); undo();
    };
    toastTimer = setTimeout(close, 6000);
  }
  // Tegner siden på nytt uten å hoppe til toppen (brukes når bilder legges til eller slettes).
  var keepScroll = false;
  function refresh() {
    var y = window.scrollY;
    keepScroll = true;
    try { render(); } finally { keepScroll = false; }
    window.scrollTo(0, y);
  }
  function confirmBox(text, okLabel, danger, cancelLabel) {
    return new Promise(function (resolve) {
      modalEl.innerHTML =
        '<div class="card stack" role="dialog" aria-modal="true">' +
        '<p>' + esc(text) + '</p>' +
        '<div class="row"><button class="btn" data-m="0">' + esc(cancelLabel || 'Avbryt') + '</button>' +
        '<button class="btn ' + (danger ? 'bad' : 'primary') + '" data-m="1">' + esc(okLabel || 'OK') + '</button></div></div>';
      modalEl.hidden = false;
      modalEl.onclick = function (e) {
        var b = e.target.closest('[data-m]');
        if (!b && e.target !== modalEl) return;
        modalEl.hidden = true; modalEl.onclick = null;
        resolve(!!b && b.getAttribute('data-m') === '1');
      };
    });
  }
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

  // ---------- Øktlogikk ----------
  var session = null;
  var MODE_NAMES = { mc: 'Flervalg', write: 'Skriv svaret', flash: 'Flashkort' };
  var DIR_NAMES = { ln: 'Latin → norsk', nl: 'Norsk → latin', mix: 'Blandet' };

  function pickDir() {
    var d = state.settings.dir;
    return d === 'mix' ? (Math.random() < 0.5 ? 'ln' : 'nl') : d;
  }
  function startSession(mode, list) {
    var items, label = '';
    if (list && list.length) {
      items = shuffle(list);
      label = 'Øv på feilene';
    } else {
      var today = dayNum(), pool = activePool(), size = state.settings.size;
      var due = shuffle(pool.filter(function (p) { var r = prog(p.id); return r && r.due <= today; }))
        .sort(function (a, b) { return prog(a.id).box - prog(b.id).box; });
      var fresh = shuffle(pool.filter(function (p) { return !prog(p.id); }));
      items = due.slice(0, size);
      var room = size - items.length;
      items = items.concat(fresh.slice(0, Math.min(room, state.settings.newPer)));
      if (!items.length) {
        // Ingenting å repetere i dag: ekstraøving på de svakeste.
        items = shuffle(pool).sort(function (a, b) { return box(a.id) - box(b.id); }).slice(0, size);
        label = 'Ekstraøving';
      }
      items = shuffle(items);
    }
    if (!items.length) { toast('Ingen planter å øve på med dette utvalget'); return; }
    session = {
      mode: mode, label: label, total: items.length, firstDone: 0, right: 0, missed: [],
      queue: items.map(function (p) { return { p: p, dir: pickDir(), first: true, state: 'ask' }; })
    };
    go('#/ov');
  }
  function sides(cur) {
    return cur.dir === 'ln' ? { q: 'latin', a: 'norsk' } : { q: 'norsk', a: 'latin' };
  }
  // Alle svar som er riktige (flere planter kan ha samme norske navn).
  function acceptedAnswers(cur) {
    var s = sides(cur), qn = normalize(cur.p[s.q]), out = [];
    plants().forEach(function (p) {
      if (usable(p) && normalize(p[s.q]) === qn) out.push(p[s.a]);
    });
    if (out.indexOf(cur.p[s.a]) < 0) out.push(cur.p[s.a]);
    return out;
  }
  function sharedPrompt(cur) {
    var s = sides(cur), qn = normalize(cur.p[s.q]);
    return plants().filter(function (p) { return usable(p) && normalize(p[s.q]) === qn; }).length > 1;
  }
  function mcOptions(cur) {
    var s = sides(cur);
    var correct = cur.p[s.a];
    var bad = {};
    acceptedAnswers(cur).forEach(function (a) { bad[normalize(a)] = true; });
    var g = genus(cur.p);
    var cand = shuffle(plants().filter(function (p) { return usable(p) && !bad[normalize(p[s.a])]; }))
      .map(function (p) {
        var score = Math.random();
        if (genus(p) === g) score += 2;
        if (p.gruppe === cur.p.gruppe) score += 1;
        return { p: p, score: score };
      })
      .sort(function (a, b) { return b.score - a.score; });
    var picks = [], seen = {};
    for (var i = 0; i < cand.length && picks.length < 3; i++) {
      var v = cand[i].p[s.a], n = normalize(v);
      if (seen[n]) continue;
      seen[n] = true; picks.push(v);
    }
    return shuffle([correct].concat(picks));
  }
  function checkTyped(cur, input) {
    var n = normalize(input);
    if (!n) return { ok: false, near: false };
    var best = Infinity, bestLen = 0;
    acceptedAnswers(cur).forEach(function (a) {
      variants(a).forEach(function (v) {
        var d = levenshtein(n, v);
        if (d < best) { best = d; bestLen = v.length; }
      });
    });
    if (best === 0) return { ok: true, near: false };
    if (best <= tolerance(bestLen)) return { ok: true, near: true };
    return { ok: false, near: false };
  }
  function advance() {
    var s = session, cur = s.queue.shift();
    if (cur.first) {
      grade(cur.p.id, cur.ok);
      s.firstDone++;
      if (cur.ok) s.right++; else s.missed.push(cur.p);
    }
    if (!cur.ok) {
      // Spør igjen litt senere i samme økt.
      s.queue.splice(Math.min(3, s.queue.length), 0, { p: cur.p, dir: cur.dir, first: false, state: 'ask' });
    }
    if (!s.queue.length) { location.replace('#/ferdig'); return; }
    render();
  }

  // ---------- Visninger ----------
  function renderHome() {
    var all = plants().filter(usable), pool = activePool(), today = dayNum(), st = state.settings;
    var learned = all.filter(function (p) { return box(p.id) >= LEARNED_BOX; }).length;
    var due = pool.filter(function (p) { var r = prog(p.id); return r && r.due <= today; }).length;
    var fresh = pool.filter(function (p) { return !prog(p.id); }).length;
    var pct = all.length ? Math.round(learned / all.length * 100) : 0;
    var streak = currentStreak();
    var doneToday = state.streak.last === today;
    var groups = allGroups();
    var nSchool = schoolCount();
    var schoolOn = st.onlySchool && nSchool > 0;

    var html =
      '<h1>🌿 Planteøving</h1>' +
      '<p class="muted">' + (doneToday ? 'Bra jobba i dag! ' : '') + (streak ? '🔥 ' + streak + (streak === 1 ? ' dag' : ' dager') + ' på rad' : 'Øv litt hver dag, så sitter navnene.') + '</p>' +
      '<div class="card">' +
      '<div class="stats">' +
      '<div class="stat"><b>' + learned + '</b><span>lært</span></div>' +
      '<div class="stat"><b>' + due + '</b><span>til repetisjon</span></div>' +
      '<div class="stat"><b>' + fresh + '</b><span>nye</span></div>' +
      '</div>' +
      '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="small muted">' + learned + ' av ' + all.length + ' planter lært (' + pct + ' %)</div>' +
      '</div>' +

      '<h2>Hvordan vil du øve?</h2>' +
      '<div class="modes" role="radiogroup" aria-label="Øvingsmåte">' +
      modeBtn('mc', '🔘', 'Flervalg', 'Velg riktig navn blant fire', st.mode) +
      modeBtn('write', '⌨️', 'Skriv svaret', 'Små skrivefeil godtas', st.mode) +
      modeBtn('flash', '🃏', 'Flashkort', 'Tenk svaret, snu kortet', st.mode) +
      '</div>' +

      '<h2>Hva vil du øve på?</h2>' +
      '<div class="seg" role="group" aria-label="Retning">' +
      segBtn('dir', 'ln', 'Latin → norsk', st.dir) +
      segBtn('dir', 'nl', 'Norsk → latin', st.dir) +
      segBtn('dir', 'mix', 'Blandet', st.dir) +
      '</div>' +
      '<div class="chips" style="margin-top:12px">' +
      '<button class="chip' + (!st.groups.length ? ' on' : '') + '" data-act="group" data-g="">Alle</button>' +
      groups.map(function (g) {
        return '<button class="chip' + (st.groups.indexOf(g) >= 0 ? ' on' : '') + '" data-act="group" data-g="' + esc(g) + '">' + esc(g) + '</button>';
      }).join('') +
      '</div>' +
      (nSchool
        ? '<div class="chips" style="margin-top:8px"><button class="chip' + (st.onlySchool ? ' on' : '') + '" data-act="school" aria-pressed="' + !!st.onlySchool + '">📷 Bare planter fra skolen (' + nSchool + ')</button></div>'
        : (canPhoto ? '<p class="small muted" style="margin-top:10px">📷 Tips: trykk ＋ på et plantebilde for å legge til ditt eget bilde.</p>' : '')) +

      '<div class="card" style="margin-top:14px">' +
      '<div class="setting"><span>Spørsmål per økt</span>' + select('size', [10, 15, 20, 30], st.size) + '</div>' +
      '<div class="setting"><span>Nye planter per økt</span>' + select('newPer', [3, 5, 8, 12, 20], st.newPer) + '</div>' +
      '<label class="check"><input type="checkbox" data-set="includeUnsure"' + (st.includeUnsure ? ' checked' : '') + '> Ta med planter merket «usikker»</label>' +
      (canSpeak ? '<label class="check"><input type="checkbox" data-set="autoSpeak"' + (st.autoSpeak ? ' checked' : '') + '> 🔊 Les opp spørsmålet automatisk</label>' : '') +
      (nSchool ? '<label class="check"><input type="checkbox" data-set="ownPhotos"' + (st.ownPhotos ? ' checked' : '') + '> 📷 Vis egne bilder i testen</label>' : '') +
      '</div>' +

      '<button class="btn primary start" data-act="startTest">▶ Start test' +
      '<small>' + esc(MODE_NAMES[st.mode] || 'Flervalg') + ' · ' + esc(DIR_NAMES[st.dir]) + ' · ' + st.size + ' spørsmål' + (schoolOn ? ' · skoleplanter' : '') + '</small></button>' +

      '<a class="card sonecard" href="#/sone">' + (st.sone
        ? '<span>📍 Min sone: <b>H' + st.sone + '</b></span><span class="muted small">Se planter som passer →</span>'
        : '<span>📍 Velg din herdighetssone</span><span class="muted small">Se hvilke planter som tåler klimaet der du bor →</span>') + '</a>' +

      '<div class="links">' +
      '<a class="btn ghost" href="#/liste">📋 Plantelisten</a>' +
      '<a class="btn ghost" href="#/stat">📊 Statistikk</a>' +
      '<a class="btn ghost" href="#/data">💾 Sikkerhetskopi</a>' +
      '<a class="btn ghost" href="#/bilder">📷 Om bildene</a>' +
      '</div>';
    app.innerHTML = html;
  }
  function modeBtn(mode, ico, title, sub, cur) {
    var on = cur === mode;
    return '<button class="btn mode' + (on ? ' on' : '') + '" role="radio" aria-checked="' + on + '" data-act="mode" data-mode="' + mode + '">' +
      '<span class="ico" aria-hidden="true">' + ico + '</span><span class="txt">' + esc(title) + '<small>' + esc(sub) + '</small></span>' +
      '<span class="radio" aria-hidden="true"></span></button>';
  }
  function segBtn(key, val, label, cur) {
    return '<button class="' + (cur === val ? 'on' : '') + '" data-act="' + key + '" data-v="' + val + '">' + esc(label) + '</button>';
  }
  function select(key, opts, cur) {
    return '<select data-set="' + key + '">' + opts.map(function (o) {
      return '<option value="' + o + '"' + (o === cur ? ' selected' : '') + '>' + o + '</option>';
    }).join('') + '</select>';
  }

  function factsHtml(p) {
    var sorter = p.sorter || [];
    var sortTxt = '';
    if (sorter.length) {
      sortTxt = 'Sorter: ' + sorter.slice(0, 8).map(esc).join(', ') + (sorter.length > 8 ? ' + ' + (sorter.length - 8) + ' til' : '');
    }
    var note = p.merknad && /^(Nyere|Eldre|Også)/.test(p.merknad) ? '<div class="meta">' + esc(p.merknad) + '</div>' : '';
    return '<div class="card facts">' +
      picBlock(p, shownPic(p, state.settings.ownPhotos)) +
      '<div class="nameline"><span class="latin">' + esc(p.latin) + '</span>' + sayBtn(p.latin, 'small') + '</div>' +
      '<div class="nameline"><span class="norsk">' + esc(p.norsk) + '</span>' + sayBtn(p.norsk, 'small') + '</div>' +
      '<div class="meta">' + esc(p.gruppe || '') + (sortTxt ? ' · ' + sortTxt : '') + '</div>' + note +
      (infoOf(p) ? '<a class="btn ghost" style="margin-top:6px;padding-left:0" href="#/plante/' + encodeURIComponent(p.id) + '">ⓘ Les mer om planten →</a>' : '') +
      '</div>';
  }
  function plantByAnswer(cur, text) {
    var s = sides(cur), n = normalize(text);
    if (normalize(cur.p[s.a]) === n) return cur.p;
    var l = plants();
    for (var i = 0; i < l.length; i++) if (usable(l[i]) && normalize(l[i][s.a]) === n) return l[i];
    return null;
  }

  function renderPlay() {
    var s = session, cur = s.queue[0];
    var sd = sides(cur);
    var pct = Math.round(s.firstDone / s.total * 100);
    var qLabel = cur.dir === 'ln' ? 'Hva heter denne på norsk?' : 'Hva er det latinske navnet?';
    var promptCls = sd.q === 'latin' ? 'word latin' : 'word';
    var hint = sharedPrompt(cur) ? '<div class="hint">Flere arter har dette navnet – alle riktige svar godtas.</div>' : '';
    var again = cur.first ? '' : '<div class="hint">🔁 Prøv igjen</div>';
    var top =
      '<div class="topbar">' +
      '<button class="btn quit" data-act="quit">✕ Avbryt</button>' +
      '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
      '<span class="count">' + s.firstDone + ' / ' + s.total + '</span></div>';
    var promptHtml = '<div class="q">' + qLabel + '</div><div class="wordline"><span class="' + promptCls + '">' + esc(cur.p[sd.q]) + '</span>' +
      sayBtn(cur.p[sd.q]) + '</div>' + hint + again;
    var body = '';

    if (s.mode === 'mc') {
      if (!cur.options) cur.options = mcOptions(cur);
      var acc = acceptedAnswers(cur).map(normalize);
      body = '<div class="card prompt">' + promptHtml + '</div><div class="options tiles">' +
        cur.options.map(function (o, i) {
          var cls = '';
          if (cur.state === 'answered') {
            if (acc.indexOf(normalize(o)) >= 0) cls = ' right';
            else if (i === cur.picked) cls = ' wrong';
          }
          var op = plantByAnswer(cur, o) || { norsk: o, latin: o };
          var pic = shownPic(op, state.settings.ownPhotos);
          var done = cur.state === 'answered';
          // ＋ og 🗑 vises først når svaret er gitt, så de ikke kommer i veien for svaret.
          return '<div class="opt' + cls + '"><button class="optbtn" data-act="mc" data-i="' + i + '"' +
            (done ? ' disabled' : '') + '>' + picImg(pic, op.norsk, 'thumb') +
            '<span class="lbl' + (sd.a === 'latin' ? ' latin' : '') + '">' + esc(o) + '</span></button>' +
            '<div class="ovl">' + (done ? addBtn(op) + delBtn(pic) : '') + sayBtn(o, 'corner') + '</div></div>';
        }).join('') + '</div>';
      if (cur.state === 'answered') {
        body += '<div class="feedback ' + (cur.ok ? 'ok' : 'no') + '">' + (cur.ok ? 'Riktig! 🎉' : 'Ikke helt.') + '</div>' +
          factsHtml(cur.p) + '<button class="btn primary" data-act="next" id="nextBtn">Neste</button>';
      }
    } else if (s.mode === 'write') {
      body = '<div class="card prompt">' + promptHtml + '</div>';
      if (cur.state === 'ask') {
        body += '<form data-form="write" class="stack" autocomplete="off">' +
          '<input type="text" id="answer" placeholder="Skriv ' + (sd.a === 'latin' ? 'latinsk' : 'norsk') + ' navn" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done">' +
          '<div class="row"><button type="button" class="btn" data-act="dunno">Vet ikke</button>' +
          '<button type="submit" class="btn primary">Sjekk</button></div></form>';
      } else {
        var cls = cur.ok ? (cur.near ? 'near' : 'ok') : 'no';
        var msg = cur.ok ? (cur.near ? 'Nesten riktig – se stavemåten.' : 'Riktig! 🎉') : (cur.input ? 'Ikke riktig.' : 'Her er svaret:');
        body += '<div class="feedback ' + cls + '">' + msg +
          (cur.input ? '<span class="you">Du skrev: ' + esc(cur.input) + '</span>' : '') + '</div>' +
          factsHtml(cur.p) +
          '<div class="row">' +
          (!cur.ok && cur.input ? '<button class="btn" data-act="override">Jeg hadde rett</button>' : '') +
          '<button class="btn primary" data-act="next" id="nextBtn">Neste</button></div>';
      }
    } else {
      body = '<div class="card prompt flash" data-act="' + (cur.state === 'ask' ? 'reveal' : '') + '">' + promptHtml +
        (cur.state === 'ask'
          ? '<div class="hint" style="margin-top:22px">Trykk for å se svaret</div>'
          : '<div class="answer"><div class="wordline"><span class="' + (sd.a === 'latin' ? 'word latin' : 'word') + '">' + esc(cur.p[sd.a]) + '</span>' +
            sayBtn(cur.p[sd.a]) + '</div></div>') +
        '</div>';
      if (cur.state === 'ask') {
        body += '<button class="btn primary" data-act="reveal">Vis svar</button>';
      } else {
        body += factsHtml(cur.p) + '<div class="row">' +
          '<button class="btn bad" data-act="self" data-ok="0">Kunne ikke</button>' +
          '<button class="btn good" data-act="self" data-ok="1">Kunne</button></div>';
      }
    }
    app.innerHTML = top + body;
    if (cur.state === 'ask' && !cur.spoken && state.settings.autoSpeak && canSpeak) {
      cur.spoken = true;
      speak(cur.p[sd.q]);
    }
    if (keepScroll) return;
    if (cur.state !== 'ask') {
      var fb = app.querySelector('.feedback') || app.querySelector('.facts');
      if (fb) setTimeout(function () { fb.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
    }
    var inp = document.getElementById('answer');
    if (inp) inp.focus();
    var nb = document.getElementById('nextBtn');
    if (nb && s.mode !== 'mc') nb.focus();
  }

  function renderSummary() {
    var s = session;
    var pct = s.total ? Math.round(s.right / s.total * 100) : 0;
    var emoji = pct === 100 ? '🏆' : pct >= 80 ? '🌟' : pct >= 50 ? '👍' : '🌱';
    var seen = {}, missed = s.missed.filter(function (p) { if (seen[p.id]) return false; seen[p.id] = true; return true; });
    app.innerHTML =
      '<h1>' + emoji + ' Ferdig!</h1>' +
      '<div class="card"><div class="stats" style="grid-template-columns:1fr 1fr">' +
      '<div class="stat"><b>' + s.right + ' / ' + s.total + '</b><span>riktig første gang</span></div>' +
      '<div class="stat"><b>' + currentStreak() + '</b><span>dager på rad</span></div></div>' +
      '<div class="bar"><i style="width:' + pct + '%"></i></div></div>' +
      (missed.length
        ? '<h2>Disse må du øve mer på</h2><div class="card"><ul class="plist">' +
          missed.map(function (p) {
            return '<li><a><div class="names"><div class="latin">' + esc(p.latin) + '</div><div><b>' + esc(p.norsk) + '</b></div></div></a></li>';
          }).join('') + '</ul></div>' +
          '<div class="stack"><button class="btn primary" data-act="retry">Øv på disse igjen</button>'
        : '<p>Alt riktig – sterkt! 💪</p><div class="stack">') +
      '<button class="btn' + (missed.length ? '' : ' primary') + '" data-act="home">Til start</button></div>';
  }

  // ---------- Plantelisten med søk og filter ----------
  var MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];
  var MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];
  var listFilter = { q: '', type: [], farge: [], lys: [], mnd: 0, maksHoyde: 0, herdighet: 0, open: false, skole: false, sjekk: false };

  function filterActive() {
    var f = listFilter;
    return f.type.length || f.farge.length || f.lys.length || f.mnd || f.maksHoyde || f.herdighet;
  }
  function distinctInfo(key) {
    var seen = {};
    plants().forEach(function (p) {
      var i = infoOf(p); if (!i || i[key] == null) return;
      [].concat(i[key]).forEach(function (v) { if (v) seen[v] = true; });
    });
    return Object.keys(seen).sort(function (a, b) { return a.localeCompare(b, 'nb'); });
  }
  function matchesFilter(p) {
    var f = listFilter;
    if (f.q) {
      var key = normalize(p.latin + ' ' + p.norsk + ' ' + (p.sorter || []).join(' '));
      if (key.indexOf(normalize(f.q)) < 0) return false;
    }
    if (f.skole && !hasOwn(p)) return false;
    if (f.sjekk && !sjekkOf(p)) return false;
    if (!filterActive()) return true;
    var i = infoOf(p);
    if (!i) return false;
    function anyOf(sel, vals) { vals = [].concat(vals || []); return !sel.length || sel.some(function (s) { return vals.indexOf(s) >= 0; }); }
    if (!anyOf(f.type, i.plantetype)) return false;
    if (!anyOf(f.farge, i.blomsterfarge)) return false;
    if (!anyOf(f.lys, i.lys)) return false;
    if (f.mnd) {
      var m = i.blomstring_mnd;
      if (!m || m.length < 2 || f.mnd < m[0] || f.mnd > m[1]) return false;
    }
    if (f.maksHoyde) {
      var h = i.hoyde_cm;
      if (!h || h[0] > f.maksHoyde) return false;
    }
    if (f.herdighet && !(i.herdighet_maks >= f.herdighet)) return false;
    return true;
  }
  function chipRow(key, values) {
    return '<div class="chips">' + values.map(function (v) {
      return '<button class="chip' + (listFilter[key].indexOf(v) >= 0 ? ' on' : '') + '" data-act="lf" data-k="' + key + '" data-v="' + esc(v) + '">' + esc(v) + '</button>';
    }).join('') + '</div>';
  }
  function filterPanel() {
    var f = listFilter;
    var withInfo = plants().filter(function (p) { return infoOf(p); }).length;
    if (!withInfo) return '';
    var html = '<button class="btn" data-act="lfToggle" style="margin-top:8px">🔎 Filter' + (filterActive() ? ' (på)' : '') + ' ' + (f.open ? '▲' : '▼') + '</button>';
    if (!f.open) return html;
    html += '<div class="card filter" style="margin-top:8px">' +
      '<p class="small muted">Filter virker på planter som har planteinfo (' + withInfo + ' så langt).</p>' +
      '<div class="flabel">Type</div>' + chipRow('type', distinctInfo('plantetype')) +
      '<div class="flabel">Blomsterfarge</div>' + chipRow('farge', distinctInfo('blomsterfarge')) +
      '<div class="flabel">Lys</div>' + chipRow('lys', ['sol', 'halvskygge', 'skygge']) +
      '<div class="setting"><span>Blomstrer i</span><select data-lf="mnd"><option value="0">alle måneder</option>' +
      MONTHS.map(function (m, i) { return '<option value="' + (i + 1) + '"' + (f.mnd === i + 1 ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select></div>' +
      '<div class="setting"><span>Høyde</span><select data-lf="maksHoyde"><option value="0">alle høyder</option>' +
      [50, 100, 150, 200, 300].map(function (h) { return '<option value="' + h + '"' + (f.maksHoyde === h ? ' selected' : '') + '>kan holdes under ' + (h >= 100 ? (h / 100).toString().replace('.', ',') + ' m' : h + ' cm') + '</option>'; }).join('') + '</select></div>' +
      '<div class="setting"><span>Tåler sone</span><select data-lf="herdighet"><option value="0">alle soner</option>' +
      [3, 4, 5, 6, 7, 8].map(function (h) { return '<option value="' + h + '"' + (f.herdighet === h ? ' selected' : '') + '>minst H' + h + '</option>'; }).join('') + '</select></div>' +
      (filterActive() ? '<button class="btn ghost" data-act="lfClear">Nullstill filter</button>' : '') +
      '</div>';
    return html;
  }
  function listItemsHtml() {
    var list = plants().filter(matchesFilter);
    var html = '<p class="small muted" style="margin:10px 2px 0">Viser ' + list.length + ' av ' + plants().length + ' planter</p>';
    allGroups().concat(list.some(function (p) { return !p.gruppe; }) ? [''] : []).forEach(function (g) {
      var items = list.filter(function (p) { return (p.gruppe || '') === g; })
        .sort(function (a, b) { return a.latin.localeCompare(b.latin, 'nb'); });
      if (!items.length) return;
      html += '<h2>' + esc(g || 'Uten gruppe') + ' <span class="muted small">(' + items.length + ')</span></h2><div class="card" style="padding:4px 12px"><ul class="plist">' +
        items.map(function (p) {
          var b = '';
          if (p.aktiv === false) b = '<span class="badge av">ikke med</span>';
          else if (p.status === 'sjekk') b = '<span class="badge sjekk">usikker</span>';
          else if (box(p.id) >= LEARNED_BOX) b = '<span class="badge lv">lært</span>';
          var i = infoOf(p);
          var extra = i && i.hoyde_cm ? '<div class="small muted">' + esc(infoSummary(i)) + '</div>' : '';
          var pic = shownPic(p, true);
          return '<li class="prow"><a href="#/plante/' + encodeURIComponent(p.id) + '">' + picImg(pic, p.norsk, 'mini') + '<div class="names">' +
            '<div class="latin">' + esc(p.latin) + '</div><div><b>' + esc(p.norsk) + '</b>' + (i ? ' <span class="infodot" title="Har planteinfo">ⓘ</span>' : '') +
            (hasOwn(p) ? ' <span title="Finnes på skolen">📷</span>' : '') +
            (sjekkOf(p) ? ' <span class="sjekkdot" title="Spør på skolen">❓</span>' : '') + '</div>' + extra + '</div>' + b + '</a>' +
            delBtn(pic, 'rowbtn') + addBtn(p, 'rowbtn') + '</li>';
        }).join('') + '</ul></div>';
    });
    return html;
  }
  function infoSummary(i) {
    var parts = [];
    if (i.hoyde_cm) parts.push(rangeCm(i.hoyde_cm) + ' høy');
    if (i.blomsterfarge && i.blomsterfarge.length) parts.push(i.blomsterfarge.join('/'));
    if (i.blomstring_mnd) parts.push(monthRange(i.blomstring_mnd, true));
    return parts.join(' · ');
  }
  function renderList() {
    app.innerHTML = '<div class="topbar"><a class="btn ghost" href="#/">← Tilbake</a><h1 style="flex:1;margin:0;font-size:1.3rem">Plantelisten</h1></div>' +
      '<p class="small muted">Trykk på en plante for å se planteinfo. Der kan du også rette navn.</p>' +
      '<div class="sticky"><div class="row"><input type="search" id="search" placeholder="Søk latin eller norsk …" value="' + esc(listFilter.q) + '">' +
      '<a class="btn primary" href="#/liste/ny" style="flex:0 0 auto;width:auto">＋ Ny</a></div></div>' +
      '<div id="filterWrap">' + schoolChip() + filterPanel() + '</div><div id="listWrap">' + listItemsHtml() + '</div>';
    var search = document.getElementById('search');
    search.addEventListener('input', function () {
      listFilter.q = search.value;
      document.getElementById('listWrap').innerHTML = listItemsHtml();
    });
  }
  function schoolChip() {
    var n = schoolCount(), ns = plants().filter(sjekkOf).length, html = '';
    if (n || listFilter.skole) html += '<button class="chip' + (listFilter.skole ? ' on' : '') + '" data-act="lfSchool" aria-pressed="' + listFilter.skole + '">📷 Finnes på skolen (' + n + ')</button>';
    if (ns || listFilter.sjekk) html += '<button class="chip' + (listFilter.sjekk ? ' on' : '') + '" data-act="lfSjekk" aria-pressed="' + listFilter.sjekk + '">❓ Spør på skolen (' + ns + ')</button>';
    return html ? '<div class="chips" style="margin-top:8px">' + html + '</div>' : '';
  }
  function sjekkCard(p) {
    var s = sjekkOf(p);
    if (!s) return '';
    return '<div class="card sjekkcard"><div class="row" style="align-items:center"><h2 style="margin:0">❓ Spør på skolen</h2>' +
      (canSpeak ? '<button class="btn" data-act="say" data-text="' + esc(s.join(' ')) + '" style="flex:0 0 auto;width:auto;min-height:44px">🔊 Les opp</button>' : '') + '</div>' +
      '<ul class="bullets" style="margin-top:10px">' + s.map(function (k) { return '<li>' + esc(k) + '</li>'; }).join('') + '</ul>' +
      '<p class="small muted">Kildene er usikre eller stemmer ikke med lista her. Skriv svaret i Merknad under ✏️ Rediger, og send en sikkerhetskopi. Da kan lista rettes.</p></div>';
  }
  function refreshList() {
    document.getElementById('filterWrap').innerHTML = schoolChip() + filterPanel();
    document.getElementById('listWrap').innerHTML = listItemsHtml();
  }

  // ---------- Planteside ----------
  function rangeCm(r) {
    function f(cm) { return cm >= 100 ? (Math.round(cm / 10) / 10).toString().replace('.', ',') + ' m' : cm + ' cm'; }
    if (!r || r.length < 2) return '';
    if (r[0] === r[1]) return f(r[0]);
    if (r[0] >= 100 && r[1] >= 100) return f(r[0]).replace(' m', '') + '–' + f(r[1]);
    if (r[0] < 100 && r[1] < 100) return r[0] + '–' + r[1] + ' cm';
    return f(r[0]) + ' – ' + f(r[1]);
  }
  function monthRange(m, short) {
    var n = short ? MONTHS_SHORT : MONTHS;
    if (!m || m.length < 2) return '';
    return m[0] === m[1] ? n[m[0] - 1] : n[m[0] - 1] + '–' + n[m[1] - 1];
  }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function renderPlant(id) {
    var p = findPlant(id);
    if (!p) { go('#/liste'); return; }
    var i = infoOf(p);
    var pics = allPics(p), own = ownPhotos(p);
    var idx = Math.max(0, Math.min(plantPicIdx[p.id] || 0, pics.length - 1)), pic = pics[idx] || null;
    var strip = pics.length > 1 ? '<div class="strip">' + pics.map(function (x, n) {
      return '<button type="button" class="' + (n === idx ? 'on' : '') + '" data-act="pic" data-id="' + esc(p.id) + '" data-i="' + n + '" aria-label="Vis bilde ' + (n + 1) + '">' + picImg(x, '', '') + '</button>';
    }).join('') + '</div>' : '';
    var html = '<div class="topbar"><button class="btn ghost" data-act="back">← Tilbake</button><span style="flex:1"></span>' +
      '<a class="btn ghost" href="#/liste/' + encodeURIComponent(p.id) + '">✏️ Rediger</a></div>' +
      '<div class="card facts">' + picBlock(p, pic, { idx: idx, n: pics.length }) + strip +
      '<div class="nameline"><span class="latin" style="font-size:1.2rem">' + esc(p.latin) + '</span>' + sayBtn(p.latin, 'small') + '</div>' +
      '<div class="nameline"><span class="norsk" style="font-size:1.3rem">' + esc(p.norsk) + '</span>' + sayBtn(p.norsk, 'small') + '</div>' +
      '<div class="meta">' + esc(p.gruppe || '') + '</div>' +
      (own.length ? '<div class="zonebadge ok">📷 Finnes på skolen · ' + own.length + (own.length === 1 ? ' eget bilde' : ' egne bilder') + '</div>' : '') +
      zoneBadge(p) + '</div>' + sjekkCard(p);

    if (!i) {
      html += '<div class="card small muted">Det er ikke lagt inn planteinfo for denne planten ennå.</div>';
    } else {
      var readAll = [i.beskrivelse].concat(i.kjennetegn && i.kjennetegn.length ? ['Slik kjenner du den igjen: ' + i.kjennetegn.join('. ')] : []).join(' ');
      html += '<div class="card"><div class="row" style="align-items:center"><h2 style="margin:0">Om planten</h2>' +
        (canSpeak ? '<button class="btn" data-act="say" data-text="' + esc(readAll) + '" style="flex:0 0 auto;width:auto;min-height:44px">🔊 Les opp</button>' : '') + '</div>' +
        (i.beskrivelse ? '<p style="margin-top:10px">' + esc(i.beskrivelse) + '</p>' : '') +
        (i.kjennetegn && i.kjennetegn.length ? '<div class="flabel">Slik kjenner du den igjen</div><ul class="bullets">' + i.kjennetegn.map(function (k) { return '<li>' + esc(k) + '</li>'; }).join('') + '</ul>' : '') +
        (i.forveksling ? '<div class="flabel">Kan forveksles med</div><p>' + esc(i.forveksling) + '</p>' : '') +
        '</div>';
      var rows = [
        ['Navn hos Artsdatabanken', normalize(i.navn_artsdatabanken) !== normalize(p.norsk) ? i.navn_artsdatabanken : ''],
        ['Type', [i.plantetype, i.lovfelling].filter(Boolean).join(', ')],
        ['Høyde', rangeCm(i.hoyde_cm)],
        ['Bredde', rangeCm(i.bredde_cm)],
        ['Vekst', i.veksthastighet],
        ['Blomster', [(i.blomsterfarge || []).join(', '), monthRange(i.blomstring_mnd)].filter(Boolean).join(' · ')],
        ['Blader', i.bladverk],
        ['Lys', (i.lys || []).join(', ')],
        ['Jord', i.jord],
        ['Herdighet', i.herdighet_maks ? 'H1–H' + i.herdighet_maks : ''],
        ['Planteavstand', i.planteavstand_cm ? rangeCm(i.planteavstand_cm) + (i.planteavstand_merknad ? ' (' + i.planteavstand_merknad + ')' : '') : ''],
        ['Beskjæring', i.beskjaering],
        ['Brukes til', (i.bruksomrade || []).join(', ')],
        ['Egenskaper', (i.egenskaper || []).join(', ')],
        ['Høstfarge', i.hostfarge],
        ['Om vinteren', i.vinterpynt],
        ['Giftig', i.giftig],
        ['Spiselig', i.spiselig],
        ['Opprinnelse', i.opprinnelse],
        ['Fremmedart', i.fremmedart ? [i.fremmedart.kategori, i.fremmedart.merknad].filter(Boolean).join(' – ') : '']
      ].filter(function (r) { return r[1]; });
      // Resten av omskrivingen (forkortelser, mål, «–») gjøres i speechText().
      var factsSpeech = rows.map(function (r) { return r[0] + ': ' + String(r[1]).replace(/\.\s*$/, ''); }).join('. ')
        .replace(/\b(SE|HI|PH|LO|NK) – /g, '');
      html += '<div class="card"><div class="row" style="align-items:center"><h2 style="margin:0">Fakta</h2>' +
        (canSpeak ? '<button class="btn" data-act="say" data-text="' + esc(factsSpeech) + '" style="flex:0 0 auto;width:auto;min-height:44px">🔊 Les opp</button>' : '') +
        '</div><dl class="facttable" style="margin-top:12px">' +
        rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(cap(r[1])) + '</dd>'; }).join('') + '</dl></div>';
      if (p.sorter && p.sorter.length) {
        html += '<div class="card"><h2 style="margin-top:0">Sorter i lista</h2><p>' + p.sorter.map(esc).join(', ') + '</p></div>';
      }
      html += '<div class="card small"><span class="badge ' + (i.status === 'kontrollert' ? 'lv' : 'sjekk') + '">' +
        (i.status === 'kontrollert' ? '✔ Kontrollert mot kilder' : 'Utkast – ikke kontrollert') + '</span>' +
        (i.kontrollert ? ' <span class="muted">' + esc(i.kontrollert) + '</span>' : '') +
        '<p class="muted" style="margin-top:8px">Verdiene gjelder arten. Enkelte sorter kan bli lavere eller høyere.</p>' +
        (i.kilder && i.kilder.length ? '<div class="flabel">Kilder</div><ol class="sources">' + i.kilder.map(function (k) {
          return '<li><a href="' + esc(k.url) + '" target="_blank" rel="noopener">' + esc(k.tittel || k.url) + '</a></li>';
        }).join('') + '</ol>' : '') + '</div>';
    }
    app.innerHTML = html;
  }

  function renderEdit(id) {
    var isNew = id === 'ny';
    var p = isNew ? { id: '', gruppe: '', latin: '', norsk: '', sorter: [], status: 'ok', merknad: '' } : findPlant(id);
    if (!p) { go('#/liste'); return; }
    var pr = prog(p.id);
    var groups = allGroups();
    app.innerHTML =
      '<div class="topbar"><a class="btn ghost" href="#/liste">← Tilbake</a><h1 style="flex:1;margin:0;font-size:1.3rem">' + (isNew ? 'Ny plante' : 'Rediger') + '</h1></div>' +
      '<form data-form="edit" data-id="' + esc(p.id) + '" class="card" autocomplete="off">' +
      '<label class="field"><span>Latinsk navn</span><input type="text" name="latin" value="' + esc(p.latin) + '" required autocapitalize="off" spellcheck="false"></label>' +
      '<label class="field"><span>Norsk navn</span><input type="text" name="norsk" value="' + esc(p.norsk) + '" required></label>' +
      '<label class="field"><span>Gruppe</span><input type="text" name="gruppe" list="grp" value="' + esc(p.gruppe) + '"><datalist id="grp">' +
      groups.map(function (g) { return '<option value="' + esc(g) + '">'; }).join('') + '</datalist></label>' +
      '<label class="field"><span>Sorter (skill med komma)</span><textarea name="sorter">' + esc((p.sorter || []).join(', ')) + '</textarea></label>' +
      '<label class="field"><span>Merknad</span><textarea name="merknad" style="min-height:60px">' + esc(p.merknad) + '</textarea></label>' +
      '<label class="check"><input type="checkbox" name="aktiv"' + (p.aktiv !== false ? ' checked' : '') + '> Ta med i øving</label>' +
      '<label class="check"><input type="checkbox" name="sjekk"' + (p.status === 'sjekk' ? ' checked' : '') + '> Merket som usikker (bør sjekkes)</label>' +
      '<div class="row" style="margin-top:12px"><a class="btn" href="#/liste">Avbryt</a><button type="submit" class="btn primary">Lagre</button></div>' +
      '</form>' +
      (isNew ? '' :
        '<div class="card small muted">' + (pr ? 'Fremgang: boks ' + pr.box + ' av ' + (INTERVALS.length - 1) + ' · ' + pr.right + ' riktig, ' + pr.wrong + ' feil' : 'Ikke øvd på ennå.') + '</div>' +
        '<div class="stack">' +
        (pr ? '<button class="btn" data-act="resetOne" data-id="' + esc(p.id) + '">Nullstill fremgang for denne</button>' : '') +
        '<button class="btn danger" data-act="delete" data-id="' + esc(p.id) + '">Slett plante</button></div>');
  }

  function renderStats() {
    var all = plants().filter(usable), today = dayNum();
    var html = '<div class="topbar"><a class="btn ghost" href="#/">← Tilbake</a><h1 style="flex:1;margin:0;font-size:1.3rem">Statistikk</h1></div>';
    var learned = 0, learning = 0, fresh = 0;
    all.forEach(function (p) { var b = box(p.id); if (b >= LEARNED_BOX) learned++; else if (b >= 0) learning++; else fresh++; });
    html += '<div class="card"><div class="stats">' +
      '<div class="stat"><b>' + learned + '</b><span>lært</span></div>' +
      '<div class="stat"><b>' + learning + '</b><span>under læring</span></div>' +
      '<div class="stat"><b>' + fresh + '</b><span>ikke sett</span></div></div></div>';
    html += '<h2>Per gruppe</h2><div class="card">';
    allGroups().forEach(function (g) {
      var items = all.filter(function (p) { return p.gruppe === g; });
      if (!items.length) return;
      var l = items.filter(function (p) { return box(p.id) >= LEARNED_BOX; }).length;
      html += '<div class="gstat"><div class="top"><span>' + esc(g) + '</span><span class="muted">' + l + ' / ' + items.length + '</span></div>' +
        '<div class="bar"><i style="width:' + Math.round(l / items.length * 100) + '%"></i></div></div>';
    });
    html += '</div>';
    var hard = all.filter(function (p) { var r = prog(p.id); return r && r.wrong > 0; })
      .sort(function (a, b) {
        var ra = prog(a.id), rb = prog(b.id);
        return (rb.wrong / rb.seen) - (ra.wrong / ra.seen) || rb.wrong - ra.wrong;
      }).slice(0, 12);
    if (hard.length) {
      html += '<h2>Vanskeligst</h2><div class="card" style="padding:4px 12px"><ul class="plist">' + hard.map(function (p) {
        var r = prog(p.id);
        return '<li><a><div class="names"><div class="latin">' + esc(p.latin) + '</div><div><b>' + esc(p.norsk) + '</b></div></div>' +
          '<span class="badge sjekk">' + r.wrong + ' feil / ' + r.seen + '</span></a></li>';
      }).join('') + '</ul></div>' +
        '<button class="btn primary" data-act="practiceHard">Øv på de vanskeligste</button>';
    }
    var nextDue = all.map(function (p) { var r = prog(p.id); return r ? r.due : null; }).filter(function (d) { return d != null && d > today; });
    if (nextDue.length) {
      var dmin = Math.min.apply(null, nextDue) - today;
      html += '<p class="small muted" style="margin-top:12px">Neste repetisjon: ' + (dmin === 1 ? 'i morgen' : 'om ' + dmin + ' dager') + '.</p>';
    }
    app.innerHTML = html;
  }

  function renderData() {
    app.innerHTML =
      '<div class="topbar"><a class="btn ghost" href="#/">← Tilbake</a><h1 style="flex:1;margin:0;font-size:1.3rem">Sikkerhetskopi</h1></div>' +
      '<div class="card stack"><p><b>Eksporter</b><br><span class="small muted">Plantelisten og fremgangen som tekst. Lagre den et sted (f.eks. send den til deg selv på e-post), så kan du hente den inn igjen senere eller på en annen telefon. ' +
      'Egne bilder er ikke med i kopien ennå. De ligger bare i appen på denne telefonen.</span></p>' +
      '<div class="row"><button class="btn" data-act="copyExport">📋 Kopier</button>' +
      (navigator.share ? '<button class="btn" data-act="shareExport">📤 Del</button>' : '') + '</div></div>' +
      '<div class="card stack"><p><b>Importer</b><br><span class="small muted">Lim inn tekst fra en eksport. Plantelisten (og eventuell fremgang) blir erstattet.</span></p>' +
      '<textarea id="importText" placeholder="Lim inn her …"></textarea>' +
      '<button class="btn primary" data-act="import">Importer</button></div>' +
      '<h2>Nullstill</h2><div class="stack">' +
      '<button class="btn" data-act="resetList"' + (state.plants ? '' : ' disabled') + '>Gå tilbake til original planteliste</button>' +
      '<button class="btn danger" data-act="resetProgress">Nullstill all fremgang</button></div>' +
      '<p class="small muted" style="margin-top:16px">' + plants().length + ' planter i listen' + (state.plants ? ' (endret)' : ' (original)') + '.</p>';
  }

  // ---------- Min sone ----------
  var SONE_URL = 'https://klimasonekart.no/';
  function zoneFit(p, sone) {
    var i = infoOf(p);
    if (!sone || !i || !i.herdighet_maks) return null;
    return i.herdighet_maks >= sone;
  }
  function zoneBadge(p) {
    var sone = state.settings.sone, fit = zoneFit(p, sone);
    if (fit === null) return '';
    return fit
      ? '<div class="zonebadge ok">✔ Passer i din sone (H' + sone + ')</div>'
      : '<div class="zonebadge no">⚠ Kan være for lite herdig for din sone (H' + sone + ')</div>';
  }
  function plantTiles(list) {
    return '<div class="options tiles">' + list.map(function (p) {
      var i = infoOf(p), pic = shownPic(p, true);
      return '<div class="opt"><a class="optbtn" href="#/plante/' + encodeURIComponent(p.id) + '">' + picImg(pic, p.norsk, 'thumb') +
        '<span class="lbl"><span>' + esc(p.norsk) + '</span><small class="muted">H1–H' + i.herdighet_maks + '</small></span></a>' +
        '<div class="ovl">' + delBtn(pic) + addBtn(p) + sayBtn(p.norsk, 'corner') + '</div></div>';
    }).join('') + '</div>';
  }
  function renderZone() {
    var sone = state.settings.sone;
    var all = plants().filter(usable);
    var withH = all.filter(function (p) { var i = infoOf(p); return i && i.herdighet_maks; });
    var html = '<div class="topbar"><a class="btn ghost" href="#/">← Tilbake</a><h1 style="flex:1;margin:0;font-size:1.3rem">Min sone</h1></div>' +
      '<div class="card stack">' +
      '<p>Norge er delt inn i herdighetssoner fra <b>H1</b> (mildest, ytterst ved kysten) til <b>H8</b> (kaldest). ' +
      'En plante merket <b>H1–H5</b> tåler sone 1 til 5.</p>' +
      '<p><b>1.</b> Finn stedet ditt på kartet til Hageselskapet:</p>' +
      '<a class="btn" href="' + SONE_URL + '" target="_blank" rel="noopener">🗺️ Åpne klimasonekart.no ↗</a>' +
      '<p><b>2.</b> Trykk på sonen du fant:</p>' +
      '<div class="zonegrid">' + [1, 2, 3, 4, 5, 6, 7, 8].map(function (h) {
        return '<button class="zonebtn z' + h + (sone === h ? ' on' : '') + '" data-act="setZone" data-z="' + h + '" aria-pressed="' + (sone === h) + '">H' + h + '</button>';
      }).join('') + '</div>' +
      '<p class="small muted">Bor du i fjellsonen (lys grå på kartet): velg H8, men vær forsiktig – få hageplanter er prøvd der. ' +
      'Kartet er laget av Meteorologisk institutt for Det norske hageselskap.</p>' +
      (sone ? '<button class="btn ghost" data-act="setZone" data-z="0">Fjern valgt sone</button>' : '') +
      '</div>';

    if (sone) {
      var fits = withH.filter(function (p) { return zoneFit(p, sone); })
        .sort(function (a, b) { return a.norsk.localeCompare(b.norsk, 'nb'); });
      var tooTender = withH.filter(function (p) { return zoneFit(p, sone) === false; })
        .sort(function (a, b) { return a.norsk.localeCompare(b.norsk, 'nb'); });
      html += '<h2>✔ Passer i sone H' + sone + ' (' + fits.length + ')</h2>' +
        (fits.length ? plantTiles(fits) : '<p class="muted">Ingen av plantene med kjent herdighet tåler denne sonen.</p>');
      if (tooTender.length) {
        html += '<h2>⚠ Kan være for lite herdig (' + tooTender.length + ')</h2>' + plantTiles(tooTender);
      }
      html += '<p class="small muted" style="margin-top:14px">Herdighet er kjent for ' + withH.length + ' av ' + all.length +
        ' planter så langt. Verdiene gjelder arten – enkelte sorter tåler mer eller mindre. Lokale forhold (le, snø, jord) betyr også mye.</p>';
    }
    app.innerHTML = html;
  }

  function renderCredits() {
    var list = plants().filter(function (p) { return imageOf(p); })
      .sort(function (a, b) { return a.latin.localeCompare(b.latin, 'nb'); });
    app.innerHTML =
      '<div class="topbar"><a class="btn ghost" href="#/">← Tilbake</a><h1 style="flex:1;margin:0;font-size:1.3rem">Om bildene</h1></div>' +
      '<p class="small muted">Bildene er hentet fra Wikipedia og Wikimedia Commons og brukes under fri lisens. ' +
      'Trykk på en plante for å se originalbildet og lisensen. Bildet viser arten – ikke nødvendigvis akkurat den sorten som selges.</p>' +
      '<div class="card" style="padding:4px 12px"><ul class="plist">' + list.map(function (p) {
        var b = imageOf(p);
        return '<li><a href="' + esc(b.filside) + '" target="_blank" rel="noopener">' + imgHtml(p, 'mini') +
          '<div class="names"><div class="latin">' + esc(p.latin) + '</div><div class="small muted">' + esc(b.fotograf) +
          (b.lisens ? ' · ' + esc(b.lisens) : '') + '</div></div></a></li>';
      }).join('') + '</ul></div>';
  }

  function exportText() {
    return JSON.stringify({ type: 'planteapp', versjon: 1, eksportert: new Date().toISOString(), planter: plants(), fremgang: state.progress, streak: state.streak });
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { toast('Kopiert'); }, function () { fallbackCopy(text); });
    }
    fallbackCopy(text);
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Kopiert'); } catch (e) { toast('Kunne ikke kopiere'); }
    document.body.removeChild(ta);
  }

  // ---------- Hendelser ----------
  app.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act');
    if (!act) return;
    var st = state.settings, cur = session && session.queue[0];
    switch (act) {
      case 'say': e.stopPropagation(); speak(el.getAttribute('data-text')); break;
      case 'addPhoto': e.preventDefault(); e.stopPropagation(); pickPhoto(el.getAttribute('data-id')); break;
      case 'delPhoto': e.preventDefault(); e.stopPropagation(); removePhoto(el.getAttribute('data-id'), +el.getAttribute('data-key')); break;
      case 'pic': plantPicIdx[el.getAttribute('data-id')] = +el.getAttribute('data-i'); refresh(); break;
      case 'school': st.onlySchool = !st.onlySchool; save(); render(); break;
      case 'lfSchool': listFilter.skole = !listFilter.skole; refreshList(); break;
      case 'lfSjekk': listFilter.sjekk = !listFilter.sjekk; refreshList(); break;
      case 'back': if (history.length > 1) history.back(); else go('#/liste'); break;
      case 'setZone': state.settings.sone = +el.getAttribute('data-z'); save(); render(); break;
      case 'lfToggle': listFilter.open = !listFilter.open; refreshList(); break;
      case 'lfClear': listFilter.type = []; listFilter.farge = []; listFilter.lys = []; listFilter.mnd = 0; listFilter.maksHoyde = 0; listFilter.herdighet = 0; refreshList(); break;
      case 'lf': {
        var arr = listFilter[el.getAttribute('data-k')], v = el.getAttribute('data-v'), ix = arr.indexOf(v);
        if (ix >= 0) arr.splice(ix, 1); else arr.push(v);
        refreshList(); break;
      }
      case 'mode': st.mode = el.getAttribute('data-mode'); save(); render(); break;
      case 'startTest': startSession(st.mode || 'mc'); break;
      case 'dir': st.dir = el.getAttribute('data-v'); save(); render(); break;
      case 'group': {
        var g = el.getAttribute('data-g');
        if (!g) st.groups = [];
        else {
          var i = st.groups.indexOf(g);
          if (i >= 0) st.groups.splice(i, 1); else st.groups.push(g);
          if (st.groups.length === allGroups().length) st.groups = [];
        }
        save(); render(); break;
      }
      case 'quit':
        confirmBox('Avbryte økten? Det du har svart så langt er lagret.', 'Avbryt økten', true, 'Fortsett').then(function (ok) {
          if (ok) { session = null; go('#/'); }
        });
        break;
      case 'mc':
        if (cur.state !== 'ask') break;
        cur.picked = +el.getAttribute('data-i');
        cur.ok = acceptedAnswers(cur).map(normalize).indexOf(normalize(cur.options[cur.picked])) >= 0;
        cur.state = 'answered'; render(); break;
      case 'dunno': cur.input = ''; cur.ok = false; cur.near = false; cur.state = 'answered'; render(); break;
      case 'override': cur.ok = true; advance(); break;
      case 'next': advance(); break;
      case 'reveal': if (cur && cur.state === 'ask') { cur.state = 'shown'; render(); } break;
      case 'self': cur.ok = el.getAttribute('data-ok') === '1'; advance(); break;
      case 'retry': startSession(session.mode, session.missed.filter(function (p, i, a) { return a.indexOf(p) === i; })); break;
      case 'home': session = null; go('#/'); break;
      case 'practiceHard': {
        var hard = plants().filter(function (p) { var r = prog(p.id); return usable(p) && r && r.wrong > 0; })
          .sort(function (a, b) { var ra = prog(a.id), rb = prog(b.id); return (rb.wrong / rb.seen) - (ra.wrong / ra.seen); })
          .slice(0, state.settings.size);
        startSession('mc', hard); break;
      }
      case 'delete': {
        var id = el.getAttribute('data-id'), p = findPlant(id);
        confirmBox('Slette «' + p.latin + ' – ' + p.norsk + '»?', 'Slett', true).then(function (ok) {
          if (!ok) return;
          state.plants = editable().filter(function (x) { return x.id !== id; });
          delete state.progress[id];
          removeAllPhotos(id);
          save(); toast('Slettet'); go('#/liste');
        });
        break;
      }
      case 'resetOne': delete state.progress[el.getAttribute('data-id')]; save(); toast('Fremgang nullstilt'); render(); break;
      case 'copyExport': copyText(exportText()); break;
      case 'shareExport':
        navigator.share({ title: 'Planteøving – sikkerhetskopi', text: exportText() }).catch(function () {});
        break;
      case 'import': doImport(); break;
      case 'resetList':
        confirmBox('Gå tilbake til original planteliste? Alle endringer i listen forsvinner.', 'Tilbakestill', true).then(function (ok) {
          if (!ok) return;
          state.plants = null; save(); toast('Original liste er tilbake'); render();
        });
        break;
      case 'resetProgress':
        confirmBox('Nullstille all fremgang? Dette kan ikke angres.', 'Nullstill', true).then(function (ok) {
          if (!ok) return;
          state.progress = {}; state.streak = { last: null, count: 0 }; save(); toast('Fremgang nullstilt'); render();
        });
        break;
    }
  });

  app.addEventListener('pointerdown', function (e) {
    var el = e.target.closest('[data-swipe]');
    swipeStart = el && !e.target.closest('button') ? { x: e.clientX, y: e.clientY, el: el } : null;
  });
  app.addEventListener('pointerup', function (e) {
    var s = swipeStart; swipeStart = null;
    if (!s) return;
    var dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    var id = s.el.getAttribute('data-swipe'), n = +s.el.getAttribute('data-n');
    var cur = Math.max(0, Math.min(plantPicIdx[id] || 0, n - 1));
    // Sveip mot venstre = neste bilde. Går rundt i ring.
    showPic(id, dx < 0 ? (cur + 1) % n : (cur - 1 + n) % n, dx < 0 ? 'left' : 'right');
  });
  app.addEventListener('pointercancel', function () { swipeStart = null; });

  app.addEventListener('change', function (e) {
    var lf = e.target.getAttribute('data-lf');
    if (lf) { listFilter[lf] = +e.target.value; refreshList(); return; }
    var key = e.target.getAttribute('data-set');
    if (!key) return;
    var st = state.settings;
    if (e.target.type === 'checkbox') st[key] = e.target.checked;
    else st[key] = +e.target.value;
    save(); render();
  });

  app.addEventListener('submit', function (e) {
    var f = e.target, kind = f.getAttribute('data-form');
    e.preventDefault();
    if (kind === 'write') {
      var cur = session.queue[0];
      var input = f.querySelector('#answer').value.trim();
      if (!input) { toast('Skriv et svar, eller trykk «Vet ikke»'); return; }
      var r = checkTyped(cur, input);
      cur.input = input; cur.ok = r.ok; cur.near = r.near; cur.state = 'answered';
      render();
    } else if (kind === 'edit') {
      var latin = f.latin.value.trim(), norsk = f.norsk.value.trim();
      if (!latin || !norsk) { toast('Fyll inn både latinsk og norsk navn'); return; }
      var data = {
        latin: latin, norsk: norsk, gruppe: f.gruppe.value.trim(),
        sorter: f.sorter.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean),
        merknad: f.merknad.value.trim(),
        aktiv: f.aktiv.checked,
        status: f.sjekk.checked ? 'sjekk' : 'ok'
      };
      var list = editable(), id = f.getAttribute('data-id');
      if (!id) {
        data.id = 'u' + Date.now().toString(36);
        list.push(data);
      } else {
        for (var i = 0; i < list.length; i++) {
          if (list[i].id === id) {
            if (list[i].status === 'rettet' && data.status === 'ok') data.status = 'rettet';
            list[i] = Object.assign({}, list[i], data);
          }
        }
      }
      save(); toast('Lagret'); go('#/liste');
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || !session || location.hash !== '#/ov') return;
    var cur = session.queue[0];
    if (cur && cur.state === 'answered' && session.mode === 'mc') { e.preventDefault(); advance(); }
  });

  function doImport() {
    var txt = (document.getElementById('importText').value || '').trim();
    if (!txt) { toast('Lim inn teksten først'); return; }
    var data;
    try { data = JSON.parse(txt); } catch (e) { toast('Teksten er ikke gyldig – kopierte du alt?'); return; }
    var list = Array.isArray(data) ? data : data && data.planter;
    if (!Array.isArray(list) || !list.length) { toast('Fant ingen planter i teksten'); return; }
    var clean = list.filter(function (p) { return p && p.latin && p.norsk; }).map(function (p, i) {
      return {
        id: String(p.id || ('i' + Date.now().toString(36) + i)),
        gruppe: String(p.gruppe || ''), latin: String(p.latin), norsk: String(p.norsk),
        sorter: Array.isArray(p.sorter) ? p.sorter.map(String) : [],
        status: p.status || 'ok', merknad: String(p.merknad || ''), aktiv: p.aktiv !== false
      };
    });
    confirmBox('Importere ' + clean.length + ' planter' + (data.fremgang ? ' med fremgang' : '') + '? Det som er på telefonen nå blir erstattet.', 'Importer').then(function (ok) {
      if (!ok) return;
      state.plants = clean;
      if (data.fremgang && typeof data.fremgang === 'object') state.progress = data.fremgang;
      if (data.streak) state.streak = data.streak;
      save(); toast('Importert'); go('#/');
    });
  }

  // ---------- Ruting ----------
  function render() {
    var h = location.hash || '#/';
    var parts = h.replace(/^#\/?/, '').split('/');
    if (!keepScroll) window.scrollTo(0, 0);
    switch (parts[0]) {
      case 'ov': if (session && session.queue.length) renderPlay(); else go('#/'); break;
      case 'ferdig': if (session) renderSummary(); else go('#/'); break;
      case 'liste': if (parts[1]) renderEdit(decodeURIComponent(parts[1])); else renderList(); break;
      case 'stat': renderStats(); break;
      case 'data': renderData(); break;
      case 'bilder': renderCredits(); break;
      case 'plante': renderPlant(decodeURIComponent(parts[1] || '')); break;
      case 'sone': renderZone(); break;
      default: renderHome();
    }
  }
  window.addEventListener('hashchange', render);
  render();
  // Egne bilder hentes etterpå, så appen starter like raskt.
  loadPhotos().then(function (n) { if (n) refresh(); });

  // Offline-støtte og varig lagring (når appen kjører fra en nettadresse).
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(function () {});
  }
})();
