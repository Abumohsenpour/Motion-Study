// @ts-nocheck — plain browser script inlined into each expert's offline .html file (no imports, no build step).
/*
 * Expert questionnaire runtime (CORTEX).
 *
 * The app writes one self-contained .html file per expert. That file carries:
 *   - the questionnaire data for this expert only (no other expert's individual answers, ever),
 *   - the bundled SHA-256 helpers (src/shared/sha256.js, inlined before this script),
 *   - this script.
 * The expert gives consent, answers, and presses «ذخیره پاسخ». The answers are downloaded as a small JSON
 * file (e.g. E07_round1.json) carrying a checksum; the expert emails it back and the researcher imports it.
 * The expert can also press «ذخیره نسخه PDF»: a print-only "answer sheet" is filled in and the browser's own
 * print dialog saves it as a PDF (no PDF library is embedded). If the .json is lost, the researcher can type the
 * answers into the app from that sheet.
 * A draft is kept in this file's own localStorage so the expert can close the page and continue later.
 *
 * Parts of this file, in order:
 *   1. helpers (digits, DOM builder, scrolling)        6. Delphi questions (rating, round-2 feedback)
 *   2. state and draft saving                          7. round-2 point allocation
 *   3. sections and counting                           8. weighted-Pugh scoring
 *   4. page frame: header, steps, chips, footer        9. review, saving the .json answer file
 *   5. consent page                                   10. the printable answer sheet (PDF copy)
 */
/* global sha256Hex, canonicalJson */

function bootQuestionnaire() {
  var DATA = JSON.parse(document.getElementById('qdata').textContent);
  var KEY = 'dpq:' + DATA.projectId + ':' + DATA.kind + ':' + DATA.expertId;
  var FA = DATA.digits !== 'latin';
  var CJ = 'CJ';
  var KIND_TITLE = { r1: 'پرسش‌نامه دلفی — دور اول', r2: 'پرسش‌نامه دلفی — دور دوم', pugh: 'ارزیابی کانسپت‌ها (ماتریس تصمیم وزن‌دار)' };
  /** Base name of the answer files: E07_round1 → E07_round1.json and (proposed by the browser) E07_round1.pdf. */
  var BASE_NAME = DATA.expertCode + '_' + (DATA.kind === 'r1' ? 'round1' : DATA.kind === 'r2' ? 'round2' : 'pugh');
  var REDUCED_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ---------------------------------------------------------------------------------------------
  // 1. helpers
  // ---------------------------------------------------------------------------------------------
  /** Formats a number with the questionnaire's digit setting (Persian or Latin digits). */
  function num(n, d) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '—';
    var s = d === undefined ? String(n) : Number(n).toFixed(d);
    if (!FA) return s;
    return s.replace(/[0-9]/g, function (c) { return '۰۱۲۳۴۵۶۷۸۹'[+c]; }).replace('.', '٫');
  }
  /** Reads a typed number; Persian and Arabic digits are accepted. Empty → null, not a number → NaN. */
  function parseNum(s) {
    s = String(s || '').trim()
      .replace(/[۰-۹]/g, function (c) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)); })
      .replace(/[٠-٩]/g, function (c) { return String(c.charCodeAt(0) - 0x0660); })
      .replace(/[٫،,]/g, '.');
    if (s === '') return null;
    var n = Number(s);
    return isFinite(n) && n >= 0 ? n : NaN;
  }
  function round2(x) { return Math.round(x * 100) / 100; }
  /** h('div', {class: 'x', onclick: f}, child, 'text', …) — text is always set as text, never as HTML. */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v === undefined || v === null || v === false) continue;
      if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'style') el.setAttribute('style', v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function paragraphs(text) {
    return String(text || '').split(/\n\s*\n/).map(function (p) { return h('p', null, p); });
  }
  /** The CORTEX mark (an <img> with an inline SVG, prepared by the generator in <template id="qlogo">). */
  function logo() {
    var t = document.getElementById('qlogo');
    return t && t.content ? t.content.cloneNode(true) : null;
  }
  /** Scrolls an element into view below the sticky header and flashes an outline around it. */
  function jumpTo(id, block) {
    var el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: REDUCED_MOTION ? 'auto' : 'smooth', block: block || 'start' });
    el.classList.remove('flash');
    void el.offsetWidth; // restart the animation if the same element is highlighted twice
    el.classList.add('flash');
    setTimeout(function () { el.classList.remove('flash'); }, 2200);
  }
  /** Date and time in the reader's calendar (Persian calendar for a Persian file), e.g. for the answer sheet. */
  function dateTime(iso) {
    try {
      return new Date(iso).toLocaleString(FA ? 'fa-IR' : 'fa-IR-u-nu-latn', { dateStyle: 'long', timeStyle: 'short' });
    } catch (e) { return iso; }
  }

  // ---------------------------------------------------------------------------------------------
  // 2. state (the draft, kept in localStorage)
  // ---------------------------------------------------------------------------------------------
  // state.saved = { name, checksum, at } remembers the last downloaded answer file; any later change removes it.
  var blank = { consent: { given: false, at: null }, ratings: {}, openTexts: {}, groupPoints: {}, paramPoints: {}, scores: {}, saved: null };
  var state = blank;
  var restored = false;
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) { state = Object.assign({}, blank, JSON.parse(raw)); restored = true; }
  } catch (e) { /* storage unavailable (some browsers block it for local files) */ }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  /** Small parts of the page (progress, chips, steps, review …) register a function here to be redrawn. */
  var refreshers = [];
  function refreshAll() { refreshers.forEach(function (f) { f(); }); }
  var savedThisSession = false; // a file was downloaded since the page was opened
  var confirmProblems = null; // list of warnings waiting for «با همین وضعیت ذخیره شود»
  /** Every answer change goes through here: the saved-file marker is dropped, the draft stored, the page redrawn. */
  function changed() {
    state.saved = null;
    confirmProblems = null;
    persist();
    refreshAll();
  }

  // ---------------------------------------------------------------------------------------------
  // 3. sections and counting
  // ---------------------------------------------------------------------------------------------
  // A section is one semantic group (Delphi) or one concept (Pugh); an item is one question inside it.
  function isAnswered(v) { return v === CJ || typeof v === 'number'; }
  var SECTIONS = DATA.kind === 'pugh'
    ? DATA.concepts.map(function (c, i) {
      return { domId: 'sec-' + i, title: c.label, items: DATA.params.map(function (p) {
        return { domId: 'q-' + i + '-' + p.id, get: function () { return (state.scores[c.code] || {})[p.id]; } };
      }) };
    })
    : DATA.groups.map(function (g, i) {
      return { domId: 'sec-' + i, title: g.name, items: g.params.map(function (p) {
        return { domId: 'q-' + p.id, get: function () { return state.ratings[p.id]; } };
      }) };
    });
  function countSection(s) {
    return { done: s.items.filter(function (it) { return isAnswered(it.get()); }).length, total: s.items.length };
  }
  function countAll() {
    return SECTIONS.reduce(function (acc, s) { var c = countSection(s); return { done: acc.done + c.done, total: acc.total + c.total }; }, { done: 0, total: 0 });
  }
  function unansweredItems(list) {
    var out = [];
    (list || SECTIONS).forEach(function (s) { s.items.forEach(function (it) { if (!isAnswered(it.get())) out.push(it); }); });
    return out;
  }
  /** «پرسش بی‌پاسخ بعدی»: the first unanswered item, or the one after the last jump if that is still unanswered. */
  var lastJump = null;
  function jumpToNextUnanswered(list) {
    var open = unansweredItems(list);
    if (!open.length) { jumpTo(DATA.kind === 'r2' && !allocationStatus().complete ? 'alloc' : 'review'); return; }
    var i = lastJump ? open.findIndex(function (it) { return it.domId === lastJump; }) : -1;
    var target = open[(i + 1) % open.length];
    lastJump = target.domId;
    jumpTo(target.domId, 'center');
  }

  // Round-2 allocation: sums of the points at the group level and inside each group.
  function sumPoints(map, ids) {
    return ids.reduce(function (s, id) { var v = map[id]; return s + (typeof v === 'number' ? v : 0); }, 0);
  }
  function is100(t) { return Math.abs(t - 100) < 1e-9; }
  function allocationStatus() {
    var groupTotal = sumPoints(state.groupPoints, DATA.groups.map(function (g) { return g.id; }));
    var openGroups = DATA.groups.filter(function (g) { return !is100(sumPoints(state.paramPoints, g.params.map(function (p) { return p.id; }))); });
    return { groupTotal: groupTotal, groupsOk: is100(groupTotal), openGroups: openGroups, complete: is100(groupTotal) && openGroups.length === 0 };
  }

  // ---------------------------------------------------------------------------------------------
  // 4. page frame: sticky header (brand, title, progress, steps, section chips), body, footer
  // ---------------------------------------------------------------------------------------------
  var root = document.getElementById('app');
  var view = h('div', { class: 'view' }); // the consent page or the questions are drawn in here
  var inMain = false;

  function stepList() {
    var c = countAll();
    var consent = !!(state.consent && state.consent.given);
    var steps = [
      { label: 'رضایت', done: consent, target: null },
      { label: 'امتیازدهی', done: consent && c.total > 0 && c.done === c.total, target: 'sec-0' },
    ];
    if (DATA.kind === 'r2') steps.push({ label: 'توزیع امتیاز', done: consent && allocationStatus().complete, target: 'alloc' });
    steps.push({ label: 'ذخیره', done: !!state.saved, target: 'review' });
    return steps;
  }

  function buildFrame() {
    var fill = h('div', { class: 'bar-fill' });
    var bar = h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': 'پیشرفت پاسخ‌گویی' }, fill);
    var progressText = h('span', { class: 'progress-text' });
    var nextBtn = h('button', { type: 'button', class: 'btn small', onclick: function () { jumpToNextUnanswered(); } });
    var steps = h('ol', { class: 'steps', 'aria-label': 'مراحل' });
    var chips = h('nav', { class: 'chips', 'aria-label': DATA.kind === 'pugh' ? 'کانسپت‌ها' : 'گروه‌های معنایی' });
    var header = h('header', { class: 'hdr' },
      h('div', { class: 'hdr-in' },
        h('div', { class: 'hdr-top' },
          h('span', { class: 'brand' }, logo(), h('b', { class: 'ltr' }, 'CORTEX'), h('span', { class: 'brand-fa' }, 'کورتکس')),
          h('div', { class: 'hdr-title' }, h('h1', null, KIND_TITLE[DATA.kind]), h('div', { class: 'proj' }, DATA.projectTitle)),
          h('div', { class: 'hdr-meta' },
            h('span', { class: 'tag' }, 'کد شما: ', h('b', { class: 'ltr' }, DATA.expertCode)),
            DATA.deadline ? h('span', { class: 'tag' }, 'مهلت پاسخ: ', h('b', null, DATA.deadlineText)) : null)),
        h('div', { class: 'hdr-progress' }, bar, progressText, nextBtn),
        steps,
        chips));

    refreshers.push(function () {
      // progress bar and «x از y پرسش»
      var c = countAll();
      var pct = c.total ? Math.round((100 * c.done) / c.total) : 0;
      fill.style.width = pct + '%';
      bar.setAttribute('aria-valuenow', String(pct));
      progressText.textContent = num(c.done) + ' از ' + num(c.total) + ' پرسش';
      nextBtn.hidden = !inMain;
      nextBtn.textContent = c.done < c.total ? 'پرسش بی‌پاسخ بعدی' : 'رفتن به ذخیره';

      // step indicator: done steps get a check, the first open step is the current one
      clear(steps);
      var list = stepList();
      var current = list.findIndex(function (s) { return !s.done; });
      list.forEach(function (s, i) {
        var inner = [h('span', { class: 'step-n', 'aria-hidden': 'true' }, s.done ? '✓' : num(i + 1)), h('span', null, s.label),
          h('span', { class: 'sr' }, s.done ? ' (انجام شد)' : i === current ? ' (مرحله فعلی)' : '')];
        var cls = 'step' + (s.done ? ' done' : '') + (i === current ? ' current' : '');
        steps.appendChild(h('li', { class: cls, 'aria-current': i === current ? 'step' : null },
          inMain && s.target ? h('button', { type: 'button', onclick: function () { jumpTo(s.target); } }, inner) : h('span', { class: 'step-in' }, inner)));
      });

      // one chip per section: answered / total, click to jump
      clear(chips);
      chips.hidden = !inMain;
      if (inMain) SECTIONS.forEach(function (s) {
        var n = countSection(s);
        var full = n.done === n.total;
        chips.appendChild(h('button', { type: 'button', class: 'chip-nav' + (full ? ' done' : ''), onclick: function () { jumpTo(s.domId); } },
          h('span', { class: 'chip-name' }, s.title),
          h('span', { class: 'chip-count' }, (full ? '✓ ' : '') + num(n.done) + '/' + num(n.total))));
      });
      syncHeaderHeight();
    });

    var footer = h('footer', { class: 'foot' }, logo(),
      h('span', null, 'ساخته‌شده با ', h('b', { class: 'ltr' }, 'CORTEX'), ' — داده‌های شما فقط در همین فایل و مرورگر خودتان می‌ماند تا وقتی پاسخ را ذخیره و ارسال کنید'));
    clear(root);
    add(root, [header, view, footer]);

    // jump targets must stop below the sticky header: its height is published as the CSS variable --hdr
    function syncHeaderHeight() { document.documentElement.style.setProperty('--hdr', header.offsetHeight + 'px'); }
    window.addEventListener('resize', syncHeaderHeight);
  }

  // ---------------------------------------------------------------------------------------------
  // 5. consent page (always first)
  // ---------------------------------------------------------------------------------------------
  function consentView() {
    inMain = false;
    clear(view);
    var box = h('input', { type: 'checkbox', id: 'agree' });
    var btn = h('button', { type: 'button', class: 'btn primary big', disabled: true, onclick: function () {
      state.consent = { given: true, at: new Date().toISOString() };
      persist();
      mainView();
      window.scrollTo(0, 0);
    } }, 'شروع');
    box.addEventListener('change', function () { btn.disabled = !box.checked; });
    add(view, h('section', { class: 'card consent' },
      h('h2', null, 'رضایت آگاهانه'),
      paragraphs(DATA.consentText),
      h('label', { class: 'agree', for: 'agree' }, box, h('span', null, 'موافقم و رضایت آگاهانه خود را برای مشارکت اعلام می‌کنم.')),
      h('div', { class: 'actions' }, btn)));
    refreshAll();
  }

  // ---------------------------------------------------------------------------------------------
  // 6. Delphi questions
  // ---------------------------------------------------------------------------------------------
  /**
   * Turns a list of buttons into one radio group (WAI-ARIA radio pattern):
   * one tab stop, arrow keys move and select, a click on the selected value clears it.
   * Each button carries its value in `_value`; `get`/`set` read and write the answer.
   */
  function wireRadios(buttons, get, set) {
    function refresh() {
      var cur = get();
      var any = false;
      buttons.forEach(function (b) {
        var on = cur === b._value;
        any = any || on;
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.classList.toggle('on', on);
        b.tabIndex = on ? 0 : -1;
      });
      if (!any && buttons[0]) buttons[0].tabIndex = 0;
    }
    buttons.forEach(function (b, i) {
      b.addEventListener('click', function () { set(get() === b._value ? null : b._value); refresh(); });
      b.addEventListener('keydown', function (e) {
        // right-to-left page: the next value is to the left
        var step = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        var next = buttons[(i + step + buttons.length) % buttons.length];
        next.focus();
        set(next._value);
        refresh();
      });
    });
    refresh();
  }

  function scaleLegend() {
    var s = DATA.scale;
    return h('div', { class: 'legend' },
      s.bands.map(function (b) { return h('span', { class: 'legend-item' }, h('b', null, num(b.from) + '–' + num(b.to)), ' ', b.label); }),
      s.allowCannotJudge ? h('span', { class: 'legend-item' }, h('b', null, '؟'), ' ', s.cannotJudgeLabel) : null);
  }

  /** The 1–9 control: the bands of the scale are grouped and labelled; «توانایی قضاوت ندارم» is a separate button. */
  function ratingControl(p, onchange) {
    var s = DATA.scale;
    var wrap = h('div', { class: 'rating', role: 'radiogroup', 'aria-label': 'امتیاز اهمیت ' + p.code + ' — ' + p.name });
    var buttons = [];
    s.bands.forEach(function (band) {
      var row = h('div', { class: 'band-btns' });
      for (var v = band.from; v <= band.to; v++) {
        var b = h('button', { type: 'button', role: 'radio', class: 'r', 'aria-label': num(v) + ' — ' + band.label }, num(v));
        b._value = v; buttons.push(b); row.appendChild(b);
      }
      wrap.appendChild(h('div', { class: 'band' }, row, h('div', { class: 'band-label', 'aria-hidden': 'true' }, band.label)));
    });
    if (s.allowCannotJudge) {
      var cj = h('button', { type: 'button', role: 'radio', class: 'r cj' }, s.cannotJudgeLabel);
      cj._value = CJ; buttons.push(cj);
      wrap.appendChild(h('div', { class: 'band cj-wrap' }, cj));
    }
    wireRadios(buttons, function () { return state.ratings[p.id]; }, function (v) { state.ratings[p.id] = v; changed(); onchange(); });
    return wrap;
  }

  /**
   * Round-2 feedback: the panel's round-1 distribution by domain (aggregated: percent per band and n) and this
   * expert's own round-1 answer. No other individual's score exists in the file.
   */
  function feedback(p) {
    if (DATA.kind !== 'r2') return null;
    if (p.isNew || !p.feedback) return h('div', { class: 'fb' }, h('div', { class: 'fb-title' }, 'این پارامتر در دور اول وجود نداشت (پارامتر جدید)؛ داده دور اول ندارد.'));
    var f = p.feedback;
    var bands = DATA.scale.bands;
    // one shade per band, light → dark; the same shades for every domain
    function shade(i) { return bands.length > 1 ? 0.2 + (0.8 * i) / (bands.length - 1) : 1; }
    var rows = DATA.domains.map(function (d) {
      var x = f.byDomain[d.id] || { n: 0, percents: [] };
      var text = bands.map(function (b, i) { return b.label + ' ' + num(x.percents[i] == null ? 0 : x.percents[i], 0) + '٪'; }).join('، ');
      var bar = h('div', { class: 'fb-bar', role: 'img', 'aria-label': d.name + ': ' + text, title: text });
      bands.forEach(function (b, i) {
        var pc = x.percents[i] || 0;
        if (pc > 0) bar.appendChild(h('span', { class: 'fb-seg' + (i === bands.length - 1 ? ' top' : ''), style: 'width:' + pc + '%;background:rgba(74,63,214,' + shade(i).toFixed(2) + ')' }, pc >= 12 ? num(pc, 0) + '٪' : ''));
      });
      return h('div', { class: 'fb-row' },
        h('span', { class: 'fb-name' }, h('span', { class: 'dom', style: 'background:' + d.color }, d.shortLabel), d.name, ' ', h('small', null, '(n=' + num(x.n) + ')')),
        x.n ? bar : h('span', { class: 'muted' }, 'پاسخ معتبری نیست'));
    });
    var own = f.own === CJ ? DATA.scale.cannotJudgeLabel : typeof f.own === 'number' ? num(f.own) : 'پاسخ نداده‌اید';
    return h('div', { class: 'fb' },
      h('div', { class: 'fb-title' },
        h('span', null, 'نتیجه دور اول پنل (درصد پاسخ‌های معتبر، به تفکیک حوزه):'),
        bands.map(function (b, i) { return h('span', { class: 'fb-key' }, h('i', { style: 'background:rgba(74,63,214,' + shade(i).toFixed(2) + ')' }), b.label); })),
      rows,
      h('div', { class: 'own' }, 'امتیاز شما در دور اول: ', h('b', null, own)));
  }

  function paramCard(p) {
    var card = h('article', { class: 'card q', id: 'q-' + p.id });
    function mark() { card.classList.toggle('done', isAnswered(state.ratings[p.id])); }
    add(card, [
      h('div', { class: 'q-head' },
        h('span', { class: 'code ltr' }, p.code),
        h('h3', null, p.name),
        p.isNew ? h('span', { class: 'new' }, 'جدید') : null,
        h('span', { class: 'tick' }, '✓ پاسخ داده شد')),
      p.requirement ? h('div', { class: 'req' }, h('b', null, 'الزام طراحی: '), p.requirement) : null,
      p.explanation ? h('div', { class: 'exp' }, p.explanation) : null,
      p.range ? h('div', { class: 'range' }, h('b', null, 'محدوده عددی گزارش‌شده: '), p.range) : null,
      feedback(p),
      ratingControl(p, mark)]);
    mark();
    return card;
  }

  /** Heading of a section with its own live «x از y» counter. */
  function sectionHead(s) {
    var count = h('span', { class: 'sec-count' });
    refreshers.push(function () {
      var n = countSection(s);
      count.textContent = num(n.done) + ' از ' + num(n.total);
      count.classList.toggle('done', n.done === n.total);
    });
    return h('div', { class: 'sec-head' }, h('h2', null, s.title), count);
  }

  function delphiBody() {
    var parts = [];
    parts.push(h('section', { class: 'card intro' },
      h('p', null, DATA.kind === 'r1'
        ? 'لطفاً اهمیت هر پارامتر را برای موفقیت یک اگزواسکلتون غیرفعال پشتیبان پیش‌بند سربی برای جراحان درون‌عروقی روی مقیاس زیر مشخص کنید. در پایان هر گروه می‌توانید پارامتر جدید پیشنهاد دهید یا توضیح بنویسید.'
        : 'در این دور همه پارامترها دوباره امتیازدهی می‌شوند. کنار هر پارامتر، توزیع پاسخ‌های پنل در دور اول به تفکیک حوزه و امتیاز خود شما در دور اول آمده است تا در صورت تمایل امتیازتان را بازبینی کنید. امتیاز هیچ فرد دیگری نمایش داده نمی‌شود.'),
      scaleLegend(),
      h('p', { class: 'muted small' }, 'پاسخ‌ها خودکار به‌صورت پیش‌نویس در همین مرورگر نگه داشته می‌شوند. برای پاک‌کردن یک پاسخ، دوباره روی همان گزینه بزنید.')));
    DATA.groups.forEach(function (g, i) {
      var sec = h('section', { class: 'group', id: SECTIONS[i].domId }, sectionHead(SECTIONS[i]));
      g.params.forEach(function (p) { sec.appendChild(paramCard(p)); });
      if (DATA.kind === 'r1') {
        var ta = h('textarea', { rows: 3, id: 'open-' + i, placeholder: 'اختیاری' });
        ta.value = state.openTexts[g.id] || '';
        ta.addEventListener('input', function () { state.openTexts[g.id] = ta.value; changed(); });
        sec.appendChild(h('div', { class: 'card open' }, h('label', { for: 'open-' + i }, 'پیشنهاد پارامتر جدید یا توضیح درباره گروه «' + g.name + '»'), ta));
      }
      parts.push(sec);
    });
    if (DATA.kind === 'r2') parts.push(allocationSection());
    return parts;
  }

  // ---------------------------------------------------------------------------------------------
  // 7. round-2 point allocation (100 points among the groups, then 100 inside each group)
  // ---------------------------------------------------------------------------------------------
  /**
   * One allocation level: a list of rows with a number box each, the live total / remaining points, and
   * «نرمال‌سازی به ۱۰۰». rows = [{ id, label }]; map = state.groupPoints or state.paramPoints.
   */
  function allocLevel(title, rows, map, domId) {
    var ids = rows.map(function (r) { return r.id; });
    var inputs = {};
    var total = h('span', { class: 'alloc-total' });
    var pill = h('span', { class: 'pill' });
    var normBtn = h('button', { type: 'button', class: 'btn small', onclick: normalise }, 'نرمال‌سازی به ۱۰۰');

    function refresh() {
      var t = round2(sumPoints(map, ids));
      var rest = round2(100 - t);
      total.textContent = 'مجموع: ' + num(t) + ' از ' + num(100) + ' — مانده: ' + num(rest);
      pill.textContent = rest === 0 ? 'کامل ✓' : rest > 0 ? num(rest) + ' امتیاز کمتر' : num(-rest) + ' امتیاز بیشتر';
      pill.className = 'pill ' + (rest === 0 ? 'ok' : rest > 0 ? 'warn' : 'bad');
      var whole = ids.every(function (id) { return typeof map[id] !== 'number' || map[id] === Math.round(map[id]); });
      normBtn.disabled = t === 0 || (rest === 0 && whole);
    }
    /** Rescales the entered numbers proportionally to whole numbers that sum to 100 (rounding goes to the largest). */
    function normalise() {
      var used = ids.filter(function (id) { return typeof map[id] === 'number'; });
      var sum = sumPoints(map, used);
      if (!sum) return;
      var scaled = used.map(function (id) { return Math.round((map[id] * 100) / sum); });
      var largest = 0;
      scaled.forEach(function (v, i) { if (v > scaled[largest]) largest = i; });
      scaled[largest] += 100 - scaled.reduce(function (a, b) { return a + b; }, 0);
      used.forEach(function (id, i) { map[id] = scaled[i]; inputs[id].value = num(scaled[i]); inputs[id].classList.remove('bad'); });
      changed();
    }
    refreshers.push(refresh);

    var list = h('div', { class: 'alloc-rows' }, rows.map(function (r, i) {
      var v = map[r.id];
      var inp = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', class: 'pts', id: domId + '-i' + i, value: typeof v === 'number' ? num(v) : '' });
      inp.addEventListener('input', function () {
        var n = parseNum(inp.value);
        inp.classList.toggle('bad', isNaN(n));
        if (!isNaN(n)) { map[r.id] = n; changed(); }
      });
      inputs[r.id] = inp;
      return h('div', { class: 'alloc-row' }, h('label', { for: domId + '-i' + i }, r.label), inp);
    }));
    return h('div', { class: 'card alloc-level', id: domId },
      h('div', { class: 'alloc-head' }, h('h3', null, title), pill),
      list,
      h('div', { class: 'alloc-foot' }, total, normBtn));
  }

  function allocationSection() {
    return h('section', { class: 'alloc-section', id: 'alloc' },
      h('div', { class: 'sec-head' }, h('h2', null, 'توزیع امتیاز (وزن‌دهی)')),
      h('div', { class: 'card intro' },
        h('p', null, 'ابتدا ۱۰۰ امتیاز را میان گروه‌های معنایی توزیع کنید؛ سپس در هر گروه، ۱۰۰ امتیاز را میان پارامترهای همان گروه. امتیاز بیشتر یعنی اهمیت نسبی بیشتر.'),
        h('p', { class: 'muted small' }, 'می‌توانید عددها را به هر مقیاسی وارد کنید و سپس «نرمال‌سازی به ۱۰۰» را بزنید تا به نسبت، به مجموع ۱۰۰ تبدیل شوند. اگر مجموع دقیقاً ۱۰۰ نشد نگران نباشید؛ امتیازها هنگام تحلیل دوباره نرمال می‌شوند.')),
      allocLevel('میان گروه‌های معنایی', DATA.groups.map(function (g) { return { id: g.id, label: g.name }; }), state.groupPoints, 'alloc-g'),
      DATA.groups.map(function (g, i) {
        return allocLevel('درون گروه «' + g.name + '»',
          g.params.map(function (p) { return { id: p.id, label: [h('span', { class: 'code ltr' }, p.code), ' ', p.name] }; }),
          state.paramPoints, 'alloc-p' + i);
      }));
  }

  // ---------------------------------------------------------------------------------------------
  // 8. weighted-Pugh scoring (one card per blinded concept; absolute 1–5 score per parameter)
  // ---------------------------------------------------------------------------------------------
  function valueLegend() {
    return h('div', { class: 'legend' }, DATA.valueLabels.map(function (l, i) { return h('span', { class: 'legend-item' }, h('b', null, num(i + 1)), ' ', l); }));
  }

  function pughItem(c, ci, p) {
    var rowEl = h('div', { class: 'pq', id: 'q-' + ci + '-' + p.id });
    var chosen = h('div', { class: 'pq-val', 'aria-live': 'polite' });
    var group = h('div', { class: 'rating five', role: 'radiogroup', 'aria-label': c.label + ' — ' + p.code + ' — ' + p.name });
    var buttons = [];
    for (var v = 1; v <= 5; v++) {
      var b = h('button', { type: 'button', role: 'radio', class: 'r', title: DATA.valueLabels[v - 1], 'aria-label': num(v) + ' — ' + DATA.valueLabels[v - 1] }, num(v));
      b._value = v; buttons.push(b); group.appendChild(b);
    }
    function mark() {
      var cur = (state.scores[c.code] || {})[p.id];
      rowEl.classList.toggle('done', isAnswered(cur));
      chosen.textContent = isAnswered(cur) ? '✓ ' + DATA.valueLabels[cur - 1] : 'انتخاب نشده';
    }
    wireRadios(buttons,
      function () { return (state.scores[c.code] || {})[p.id]; },
      function (val) { state.scores[c.code] = state.scores[c.code] || {}; state.scores[c.code][p.id] = val; changed(); mark(); });
    add(rowEl, [
      h('div', { class: 'pq-text' }, h('span', { class: 'code ltr' }, p.code), ' ', h('b', null, p.name), p.requirement ? h('div', { class: 'muted small' }, p.requirement) : null),
      h('div', { class: 'pq-ctl' }, group, chosen)]);
    mark();
    return rowEl;
  }

  function pughBody() {
    var parts = [h('section', { class: 'card intro' },
      h('p', null, 'برای هر کانسپت و هر پارامتر مشخص کنید کانسپت تا چه حد آن پارامتر را برآورده می‌سازد. امتیازدهی مطلق است و کانسپت‌ها با یکدیگر یا با طرح مرجعی مقایسه نمی‌شوند. کانسپت‌ها با کد تصادفی و به ترتیب تصادفی نمایش داده شده‌اند.'),
      valueLegend(),
      h('p', { class: 'muted small' }, 'پاسخ‌ها خودکار به‌صورت پیش‌نویس در همین مرورگر نگه داشته می‌شوند. برای پاک‌کردن یک پاسخ، دوباره روی همان گزینه بزنید.'))];
    DATA.concepts.forEach(function (c, ci) {
      var img = c.sketch && /^data:image\//.test(c.sketch) ? h('img', { src: c.sketch, alt: 'طرح ' + c.label, class: 'sketch' }) : null;
      parts.push(h('section', { class: 'card concept', id: SECTIONS[ci].domId },
        sectionHead(SECTIONS[ci]),
        img,
        c.description ? h('p', { class: 'desc' }, c.description) : null,
        h('div', { class: 'pq-scale muted small' }, 'مقیاس: ', DATA.valueLabels.map(function (l, i) { return num(i + 1) + ' = ' + l; }).join(' · ')),
        h('div', { class: 'pq-list' }, DATA.params.map(function (p) { return pughItem(c, ci, p); }))));
    });
    return parts;
  }

  // ---------------------------------------------------------------------------------------------
  // 9. main view, review, saving the answer file
  // ---------------------------------------------------------------------------------------------
  /** Final section: what is answered / open in each section (with links), allocation status, save buttons. */
  function reviewSection() {
    var list = h('ul', { class: 'review' });
    var saveBox = h('div', { class: 'savebox', role: 'status' });

    function line(label, ok, text, go) {
      return h('li', { class: ok ? 'ok' : 'open' },
        h('span', { class: 'rv-mark', 'aria-hidden': 'true' }, ok ? '✓' : '!'),
        h('span', { class: 'rv-name' }, label),
        h('span', { class: 'rv-text' }, text),
        ok ? null : h('button', { type: 'button', class: 'link', onclick: go }, 'رفتن'));
    }
    refreshers.push(function () {
      clear(list);
      SECTIONS.forEach(function (s) {
        var n = countSection(s);
        var text = num(n.done) + ' از ' + num(n.total) + ' پاسخ داده شد' + (n.done < n.total ? ' — ' + num(n.total - n.done) + ' بی‌پاسخ' : '');
        list.appendChild(line(s.title, n.done === n.total, text, function () { lastJump = null; jumpToNextUnanswered([s]); }));
      });
      if (DATA.kind === 'r2') {
        var a = allocationStatus();
        list.appendChild(line('توزیع امتیاز میان گروه‌ها', a.groupsOk, a.groupsOk ? 'کامل' : 'مجموع ' + num(round2(a.groupTotal)) + ' از ' + num(100), function () { jumpTo('alloc-g'); }));
        var G = DATA.groups.length;
        list.appendChild(line('توزیع امتیاز درون گروه‌ها', a.openGroups.length === 0,
          a.openGroups.length === 0 ? 'کامل' : num(G - a.openGroups.length) + ' از ' + num(G) + ' گروه کامل',
          function () { jumpTo('alloc-p' + DATA.groups.indexOf(a.openGroups[0])); }));
      }
      drawSaveBox(saveBox);
    });

    return h('section', { class: 'card review-card', id: 'review' },
      h('h2', null, 'مرور و ذخیره'),
      h('p', { class: 'muted small' }, 'پیش از ذخیره، وضعیت هر بخش را ببینید. پرسش بی‌پاسخ مانع ذخیره نیست.'),
      list,
      saveBox,
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn', onclick: printAnswers }, 'ذخیره نسخه PDF'),
        h('button', { type: 'button', class: 'btn primary big', onclick: trySave }, 'ذخیره پاسخ')));
  }

  /** The message area above the save buttons: warnings before saving, or the three completion steps after it. */
  function drawSaveBox(box) {
    clear(box);
    box.className = 'savebox';
    if (state.saved) {
      box.className = 'savebox done';
      add(box, [
        h('h3', null, 'تقریباً تمام شد — سه گام پایانی'),
        h('ol', { class: 'done-steps' },
          h('li', { class: 'ok' }, h('span', { class: 'ds-n' }, num(1)), h('div', null, h('b', null, 'فایل پاسخ ذخیره شد ✓'), ' ', h('span', { class: 'ltr file' }, '(' + state.saved.name + ')'),
            h('div', { class: 'muted small' }, 'فایل در پوشه دانلودهای مرورگر شماست.'))),
          h('li', null, h('span', { class: 'ds-n' }, num(2)), h('div', null,
            h('button', { type: 'button', class: 'btn primary big', onclick: printAnswers }, 'ذخیره نسخه PDF'),
            h('div', { class: 'muted small' }, 'در پنجره چاپ، مقصد را ', h('span', { class: 'ltr' }, 'Save as PDF'), ' انتخاب کنید.'))),
          h('li', null, h('span', { class: 'ds-n' }, num(3)), h('div', null, h('b', null, 'هر دو فایل را برای پژوهشگر ایمیل کنید'),
            h('div', { class: 'muted small' }, 'سپاس از مشارکت شما.'))))]);
    } else if (confirmProblems) {
      box.className = 'savebox warn';
      add(box, [
        h('ul', null, confirmProblems.map(function (t) { return h('li', null, t); })),
        h('div', { class: 'actions' },
          h('button', { type: 'button', class: 'btn', onclick: function () { confirmProblems = null; refreshAll(); lastJump = null; jumpToNextUnanswered(); } }, 'بازگشت به پرسش‌ها'),
          h('button', { type: 'button', class: 'btn primary', onclick: doSave }, 'با همین وضعیت ذخیره شود'))]);
    } else if (savedThisSession) {
      box.className = 'savebox warn';
      add(box, 'پاسخ‌ها پس از آخرین ذخیره تغییر کرده‌اند. برای اینکه فایل پاسخ به‌روز باشد دوباره «ذخیره پاسخ» را بزنید.');
    }
  }

  function mainView() {
    inMain = true;
    clear(view);
    add(view, [
      restored ? h('div', { class: 'notice ok', role: 'status' }, 'پیش‌نویس قبلی شما بازیابی شد.') : null,
      DATA.kind === 'pugh' ? pughBody() : delphiBody(),
      reviewSection()]);
    refreshAll();
  }

  /** The answers in the format of the response file (field names are part of the file format; do not rename). */
  function payload(submittedAt) {
    if (DATA.kind === 'pugh') {
      var scores = {};
      DATA.concepts.forEach(function (c) {
        scores[c.code] = {};
        DATA.params.forEach(function (p) { var v = (state.scores[c.code] || {})[p.id]; scores[c.code][p.id] = typeof v === 'number' ? v : null; });
      });
      return { consent: state.consent, scores: scores, submittedAt: submittedAt };
    }
    var ratings = {};
    DATA.groups.forEach(function (g) { g.params.forEach(function (p) { var v = state.ratings[p.id]; ratings[p.id] = isAnswered(v) ? v : null; }); });
    var openTexts = {};
    if (DATA.kind === 'r1') DATA.groups.forEach(function (g) { if ((state.openTexts[g.id] || '').trim()) openTexts[g.id] = state.openTexts[g.id].trim(); });
    var allocation = null;
    if (DATA.kind === 'r2') {
      allocation = { groupPoints: {}, paramPoints: {} };
      DATA.groups.forEach(function (g) {
        var gv = state.groupPoints[g.id]; allocation.groupPoints[g.id] = typeof gv === 'number' ? gv : null;
        g.params.forEach(function (p) { var pv = state.paramPoints[p.id]; allocation.paramPoints[p.id] = typeof pv === 'number' ? pv : null; });
      });
    }
    return { consent: state.consent, ratings: ratings, openTexts: openTexts, allocation: allocation, submittedAt: submittedAt };
  }

  /** The response file: the payload plus who/what it belongs to, and a SHA-256 checksum over all of it. */
  function envelope(submittedAt) {
    var env = { format: 'delphi-pugh/response', version: 1, projectId: DATA.projectId, kind: DATA.kind, expertId: DATA.expertId, expertCode: DATA.expertCode, payload: payload(submittedAt) };
    env.checksum = sha256Hex(canonicalJson(env));
    return env;
  }

  /** «ذخیره پاسخ»: lists what is still open and asks once; with nothing open it saves at once. */
  function trySave() {
    var c = countAll();
    var problems = [];
    if (c.done < c.total) problems.push(num(c.total - c.done) + ' پرسش بی‌پاسخ مانده است.');
    if (DATA.kind === 'r2') {
      var a = allocationStatus();
      if (a.groupTotal === 0) problems.push('توزیع امتیاز میان گروه‌ها انجام نشده است.');
      else if (!a.groupsOk) problems.push('مجموع امتیاز گروه‌ها ' + num(round2(a.groupTotal)) + ' است (نه ۱۰۰).');
      if (a.openGroups.length) problems.push('در ' + num(a.openGroups.length) + ' گروه، مجموع امتیاز پارامترها ۱۰۰ نیست.');
    }
    if (!problems.length) { doSave(); return; }
    confirmProblems = problems;
    refreshAll();
    jumpTo('review');
  }

  function doSave() {
    var env = envelope(new Date().toISOString());
    var name = BASE_NAME + '.json';
    var blob = new Blob([JSON.stringify(env, null, 2)], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    // remember which file was written, so the PDF copy can carry the same time and checksum
    state.saved = { name: name, checksum: env.checksum, at: env.payload.submittedAt };
    savedThisSession = true;
    confirmProblems = null;
    persist();
    refreshAll();
    jumpTo('review');
  }

  // ---------------------------------------------------------------------------------------------
  // 10. the printable answer sheet («ذخیره نسخه PDF»)
  // ---------------------------------------------------------------------------------------------
  // The sheet lives in the section with id "print-sheet": hidden on screen, the only thing visible in print (see the
  // @media print rules). It is rebuilt from the same envelope as the .json file, so both always agree.
  var sheet = document.getElementById('print-sheet');

  function sheetTable(cls, head, rows, foot) {
    return h('table', { class: cls },
      h('thead', null, h('tr', null, head.map(function (t) { return h('th', { scope: 'col' }, t); }))),
      h('tbody', null, rows),
      foot ? h('tfoot', null, foot) : null);
  }

  function buildSheet() {
    if (!sheet) return;
    // Final copy: the answers are exactly those of the saved file (same time → same checksum). Otherwise a draft.
    var env = envelope(state.saved ? state.saved.at : new Date().toISOString());
    var isFinal = !!state.saved && state.saved.checksum === env.checksum;
    var pl = env.payload;
    var fileName = BASE_NAME + '.json';
    /** A score cell: the value, or an empty box to fill in by hand (draft) / «بی‌پاسخ» (saved copy). */
    function scoreCell(v, cls) {
      var inner = v === CJ ? h('span', { class: 'sh-cj' }, DATA.scale.cannotJudgeLabel)
        : typeof v === 'number' ? h('b', null, num(v))
          : isFinal ? h('span', { class: 'sh-none' }, 'بی‌پاسخ') : h('span', { class: 'sh-box' });
      return h('td', { class: cls || 'sh-score' }, inner);
    }
    function totalRow(label, span, values) {
      var any = values.some(function (v) { return typeof v === 'number'; });
      var t = values.reduce(function (s, v) { return s + (typeof v === 'number' ? v : 0); }, 0);
      return h('tr', null, h('th', { colspan: String(span), scope: 'row' }, label), h('td', { class: 'sh-score' }, any ? h('b', null, num(round2(t))) : isFinal ? num(0) : h('span', { class: 'sh-box' })));
    }

    clear(sheet);
    add(sheet, [
      h('div', { class: 'sh-head' }, logo(),
        h('div', null, h('div', { class: 'sh-title' }, DATA.projectTitle), h('div', { class: 'sh-kind' }, 'برگه پاسخ — ' + KIND_TITLE[DATA.kind]))),
      isFinal ? null : h('div', { class: 'sh-draft' }, 'پیش‌نویس — هنوز ذخیره نشده'),
      h('table', { class: 'sh-meta' }, h('tbody', null,
        h('tr', null,
          h('th', { scope: 'row' }, 'کد خبره'), h('td', null, h('b', { class: 'ltr' }, DATA.expertCode)),
          h('th', { scope: 'row' }, 'رضایت آگاهانه'), h('td', null, pl.consent && pl.consent.given ? 'بله — ' + dateTime(pl.consent.at) : 'خیر')),
        h('tr', null,
          h('th', { scope: 'row' }, isFinal ? 'تاریخ و زمان ذخیره' : 'تاریخ و زمان چاپ'), h('td', null, dateTime(pl.submittedAt), ' ', h('span', { class: 'ltr sh-iso' }, '(' + pl.submittedAt + ')')),
          h('th', { scope: 'row' }, 'فایل پاسخ'), h('td', null, isFinal ? h('span', { class: 'ltr' }, fileName) : 'هنوز ذخیره نشده'))))]);

    if (DATA.kind === 'pugh') {
      // matrix: one row per blinded concept, one column per parameter code (split when there are many columns)
      add(sheet, h('div', { class: 'sh-legend' }, h('b', null, 'مقیاس: '), DATA.valueLabels.map(function (l, i) { return num(i + 1) + ' = ' + l; }).join(' ؛ ')));
      // at most 10 columns per table, spread evenly (22 parameters → 8 + 8 + 6)
      var PER_TABLE = Math.ceil(DATA.params.length / Math.ceil(DATA.params.length / 10)) || 1;
      for (var from = 0; from < DATA.params.length; from += PER_TABLE) {
        var cols = DATA.params.slice(from, from + PER_TABLE);
        add(sheet, sheetTable('sh-t sh-matrix',
          ['کانسپت'].concat(cols.map(function (p) { return h('span', { class: 'ltr' }, p.code); })),
          DATA.concepts.map(function (c) {
            return h('tr', null, h('th', { scope: 'row' }, c.label), cols.map(function (p) { return scoreCell((pl.scores[c.code] || {})[p.id], 'sh-score sh-cell'); }));
          })));
      }
      add(sheet, [
        h('h3', null, 'راهنمای کد پارامترها'),
        sheetTable('sh-t sh-codes', ['کد', 'پارامتر'], DATA.params.map(function (p) { return h('tr', null, h('td', { class: 'sh-code ltr' }, p.code), h('td', null, p.name)); }))]);
    } else {
      var s = DATA.scale;
      add(sheet, h('div', { class: 'sh-legend' }, h('b', null, 'مقیاس اهمیت: '),
        s.bands.map(function (b) { return num(b.from) + '–' + num(b.to) + ' = ' + b.label; }).join(' ؛ ') + (s.allowCannotJudge ? ' ؛ یا «' + s.cannotJudgeLabel + '»' : '')));
      // one table per semantic group: code, name, score
      DATA.groups.forEach(function (g) {
        add(sheet, [
          h('h3', null, g.name),
          sheetTable('sh-t', ['کد', 'پارامتر', 'امتیاز (' + num(s.min) + '–' + num(s.max) + ')'], g.params.map(function (p) {
            return h('tr', null, h('td', { class: 'sh-code ltr' }, p.code), h('td', null, p.name), scoreCell(pl.ratings[p.id]));
          }))]);
        if (DATA.kind === 'r1') {
          var text = pl.openTexts[g.id];
          add(sheet, h('div', { class: 'sh-open' + (text || isFinal ? '' : ' blank') }, h('b', null, 'پیشنهاد پارامتر جدید یا توضیح: '), text ? h('span', { class: 'sh-open-text' }, text) : isFinal ? '—' : null));
        }
      });
      if (DATA.kind === 'r2') {
        // allocation: points per group, then points per parameter inside each group, each with its total
        var al = pl.allocation;
        add(sheet, [
          h('h2', null, 'توزیع امتیاز (وزن‌دهی) — هر جدول از ۱۰۰ امتیاز'),
          h('h3', null, 'میان گروه‌های معنایی'),
          sheetTable('sh-t', ['گروه معنایی', 'امتیاز'],
            DATA.groups.map(function (g) { return h('tr', null, h('td', null, g.name), scoreCell(al.groupPoints[g.id])); }),
            totalRow('مجموع', 1, DATA.groups.map(function (g) { return al.groupPoints[g.id]; })))]);
        DATA.groups.forEach(function (g) {
          add(sheet, [
            h('h3', null, 'درون گروه «' + g.name + '»'),
            sheetTable('sh-t', ['کد', 'پارامتر', 'امتیاز'],
              g.params.map(function (p) { return h('tr', null, h('td', { class: 'sh-code ltr' }, p.code), h('td', null, p.name), scoreCell(al.paramPoints[p.id])); }),
              totalRow('مجموع', 2, g.params.map(function (p) { return al.paramPoints[p.id]; })))]);
        });
      }
    }

    add(sheet, h('div', { class: 'sh-foot' },
      isFinal
        ? [h('div', null, 'این برگه رونوشت فایل ', h('b', { class: 'ltr' }, fileName), ' است.'),
          h('div', null, 'کد صحت‌سنجی فایل پاسخ (', h('span', { class: 'ltr' }, 'SHA-256'), '): ', h('span', { class: 'ltr sh-sum' }, env.checksum.replace(/(.{8})(?=.)/g, '$1 ')))]
        : h('div', null, 'این برگه پیش‌نویس است و هنوز فایل پاسخ (', h('span', { class: 'ltr' }, fileName), ') از آن ذخیره نشده است؛ کد صحت‌سنجی پس از «ذخیره پاسخ» ثبت می‌شود.'),
      h('div', { class: 'sh-made' }, 'ساخته‌شده با ', h('span', { class: 'ltr' }, 'CORTEX'))));
  }

  // The browser proposes the page title as the PDF's file name: use E07_round1 while printing, then restore.
  var pageTitle = document.title;
  window.addEventListener('beforeprint', function () { buildSheet(); document.title = BASE_NAME; });
  window.addEventListener('afterprint', function () { document.title = pageTitle; });
  function printAnswers() {
    buildSheet();
    document.title = BASE_NAME;
    window.print();
    // most browsers block inside print() and fire `afterprint`; this is a fallback for those that do neither
    setTimeout(function () { document.title = pageTitle; }, 60000);
  }

  // ---------------------------------------------------------------------------------------------
  // start
  // ---------------------------------------------------------------------------------------------
  buildFrame();
  if (state.consent && state.consent.given) mainView(); else consentView();
}

bootQuestionnaire();
