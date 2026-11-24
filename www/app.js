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
  function imgHtml(p, cls) {
    var b = imageOf(p);
    if (!b) return '<div class="noimg ' + (cls || '') + '" aria-hidden="true">🌿</div>';
    return '<img class="' + (cls || '') + '" src="' + esc(b.fil) + '" alt="' + esc(p.norsk) + '" loading="lazy" decoding="async">';
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
      .replace(/\bf\.\s/g, 'forma ')
      .replace(/\bvar\.\s/g, 'varietet ')
      .replace(/\bsubsp\.\s/g, 'underart ')
      .replace(/['"‘’«»]/g, '')
      .replace(/[()]/g, ', ');
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
      settings: { mode: 'mc', dir: 'mix', groups: [], size: 15, newPer: 8, includeUnsure: true, autoSpeak: true },
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
    return plants().filter(function (p) {
      return usable(p) &&
        (state.settings.includeUnsure || p.status !== 'sjekk') &&
        (!g.length || g.indexOf(p.gruppe) >= 0);
    });
  }
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
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2200);
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

      '<div class="card" style="margin-top:14px">' +
      '<div class="setting"><span>Spørsmål per økt</span>' + select('size', [10, 15, 20, 30], st.size) + '</div>' +
      '<div class="setting"><span>Nye planter per økt</span>' + select('newPer', [3, 5, 8, 12, 20], st.newPer) + '</div>' +
      '<label class="check"><input type="checkbox" data-set="includeUnsure"' + (st.includeUnsure ? ' checked' : '') + '> Ta med planter merket «usikker»</label>' +
      (canSpeak ? '<label class="check"><input type="checkbox" data-set="autoSpeak"' + (st.autoSpeak ? ' checked' : '') + '> 🔊 Les opp spørsmålet automatisk</label>' : '') +
      '</div>' +

      '<button class="btn primary start" data-act="startTest">▶ Start test' +
      '<small>' + esc(MODE_NAMES[st.mode] || 'Flervalg') + ' · ' + esc(DIR_NAMES[st.dir]) + ' · ' + st.size + ' spørsmål</small></button>' +

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
    var b = imageOf(p);
    var credit = b ? '<div class="credit">Foto: ' + esc(b.fotograf) + (b.lisens ? ' · ' + esc(b.lisens) : '') + '</div>' : '';
    return '<div class="card facts">' +
      (b ? imgHtml(p, 'big') + credit : '') +
      '<div class="nameline"><span class="latin">' + esc(p.latin) + '</span>' + sayBtn(p.latin, 'small') + '</div>' +
      '<div class="nameline"><span class="norsk">' + esc(p.norsk) + '</span>' + sayBtn(p.norsk, 'small') + '</div>' +
      '<div class="meta">' + esc(p.gruppe || '') + (sortTxt ? ' · ' + sortTxt : '') + '</div>' + note +
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
          return '<div class="opt' + cls + '"><button class="optbtn" data-act="mc" data-i="' + i + '"' +
            (cur.state === 'answered' ? ' disabled' : '') + '>' + imgHtml(op, 'thumb') +
            '<span class="lbl' + (sd.a === 'latin' ? ' latin' : '') + '">' + esc(o) + '</span></button>' +
            sayBtn(o, 'corner') + '</div>';
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

  function renderList() {
    var list = plants().slice();
    var groups = allGroups();
    var html = '<div class="topbar"><a class="btn ghost" href="#/">← Tilbake</a><h1 style="flex:1;margin:0;font-size:1.3rem">Plantelisten</h1></div>' +
      '<p class="small muted">Trykk på en plante for å rette navn, sorter eller gruppe. Endringer lagres bare på denne telefonen.</p>' +
      '<div class="sticky"><div class="row"><input type="search" id="search" placeholder="Søk latin eller norsk …">' +
      '<a class="btn primary" href="#/liste/ny" style="flex:0 0 auto;width:auto">＋ Ny</a></div></div>';
    groups.concat(list.some(function (p) { return !p.gruppe; }) ? [''] : []).forEach(function (g) {
      var items = list.filter(function (p) { return (p.gruppe || '') === g; })
        .sort(function (a, b) { return a.latin.localeCompare(b.latin, 'nb'); });
      if (!items.length) return;
      html += '<h2 data-grp>' + esc(g || 'Uten gruppe') + ' <span class="muted small">(' + items.length + ')</span></h2><div class="card" style="padding:4px 12px"><ul class="plist">' +
        items.map(function (p) {
          var b = '';
          if (p.aktiv === false) b = '<span class="badge av">ikke med</span>';
          else if (p.status === 'sjekk') b = '<span class="badge sjekk">usikker</span>';
          else if (box(p.id) >= LEARNED_BOX) b = '<span class="badge lv">lært</span>';
          var key = normalize(p.latin + ' ' + p.norsk + ' ' + (p.sorter || []).join(' '));
          return '<li data-key="' + esc(key) + '"><a href="#/liste/' + encodeURIComponent(p.id) + '"><div class="names">' +
            '<div class="latin">' + esc(p.latin) + '</div><div><b>' + esc(p.norsk) + '</b></div></div>' + b + '</a></li>';
        }).join('') + '</ul></div>';
    });
    app.innerHTML = html;
    var search = document.getElementById('search');
    search.addEventListener('input', function () {
      var q = normalize(search.value);
      app.querySelectorAll('.plist li').forEach(function (li) {
        li.hidden = !!q && li.getAttribute('data-key').indexOf(q) < 0;
      });
      app.querySelectorAll('h2[data-grp]').forEach(function (h) {
        var card = h.nextElementSibling;
        var any = card.querySelectorAll('li:not([hidden])').length > 0;
        h.hidden = !any; card.hidden = !any;
      });
    });
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
      '<div class="card stack"><p><b>Eksporter</b><br><span class="small muted">Plantelisten og fremgangen som tekst. Lagre den et sted (f.eks. send den til deg selv på e-post), så kan du hente den inn igjen senere eller på en annen telefon.</span></p>' +
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

  app.addEventListener('change', function (e) {
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
    window.scrollTo(0, 0);
    switch (parts[0]) {
      case 'ov': if (session && session.queue.length) renderPlay(); else go('#/'); break;
      case 'ferdig': if (session) renderSummary(); else go('#/'); break;
      case 'liste': if (parts[1]) renderEdit(decodeURIComponent(parts[1])); else renderList(); break;
      case 'stat': renderStats(); break;
      case 'data': renderData(); break;
      case 'bilder': renderCredits(); break;
      default: renderHome();
    }
  }
  window.addEventListener('hashchange', render);
  render();

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
