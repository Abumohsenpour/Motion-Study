// @ts-nocheck — plain browser script inlined into each expert's offline .html file (no imports, no build step).
/*
 * Expert questionnaire runtime.
 *
 * The app writes one self-contained .html file per expert. That file carries:
 *   - the questionnaire data for this expert only (no other expert's individual answers, ever),
 *   - the bundled SHA-256 helpers (src/shared/sha256.js, inlined before this script),
 *   - this script.
 * The expert gives consent, answers, and presses «ذخیره پاسخ». The answers are downloaded as a small JSON
 * file (e.g. E07_round1.json) carrying a checksum; the expert emails it back and the researcher imports it.
 * A draft is kept in this file's own localStorage so the expert can close the page and continue later.
 */
/* global sha256Hex, canonicalJson */

function bootQuestionnaire() {
  var DATA = JSON.parse(document.getElementById('qdata').textContent);
  var KEY = 'dpq:' + DATA.projectId + ':' + DATA.kind + ':' + DATA.expertId;
  var FA = DATA.digits !== 'latin';
  var CJ = 'CJ';

  // ---------------------------------------------------------------------------------------------
  // helpers
  // ---------------------------------------------------------------------------------------------
  function num(n, d) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '—';
    var s = d === undefined ? String(n) : Number(n).toFixed(d);
    if (!FA) return s;
    return s.replace(/[0-9]/g, function (c) { return '۰۱۲۳۴۵۶۷۸۹'[+c]; }).replace('.', '٫');
  }
  function parseNum(s) {
    s = String(s || '').trim()
      .replace(/[۰-۹]/g, function (c) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)); })
      .replace(/[٠-٩]/g, function (c) { return String(c.charCodeAt(0) - 0x0660); })
      .replace(/[٫،,]/g, '.');
    if (s === '') return null;
    var n = Number(s);
    return isFinite(n) && n >= 0 ? n : NaN;
  }
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
  function paragraphs(text) {
    return String(text || '').split(/\n\s*\n/).map(function (p) { return h('p', null, p); });
  }

  // ---------------------------------------------------------------------------------------------
  // state (draft in localStorage)
  // ---------------------------------------------------------------------------------------------
  var blank = { consent: { given: false, at: null }, ratings: {}, openTexts: {}, groupPoints: {}, paramPoints: {}, scores: {} };
  var state = blank;
  var restored = false;
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) { state = Object.assign({}, blank, JSON.parse(raw)); restored = true; }
  } catch (e) { /* storage unavailable (some browsers block it for local files) */ }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  var root = document.getElementById('app');

  // ---------------------------------------------------------------------------------------------
  // header and consent
  // ---------------------------------------------------------------------------------------------
  var KIND_TITLE = { r1: 'پرسش‌نامه دلفی — دور اول', r2: 'پرسش‌نامه دلفی — دور دوم', pugh: 'ارزیابی کانسپت‌ها (ماتریس تصمیم وزن‌دار)' };

  function header() {
    return h('header', { class: 'top' },
      h('div', { class: 'proj' }, DATA.projectTitle),
      h('h1', null, KIND_TITLE[DATA.kind]),
      h('div', { class: 'meta' },
        h('span', null, 'کد شما: ', h('b', { class: 'ltr' }, DATA.expertCode)),
        DATA.deadline ? h('span', null, 'مهلت پاسخ: ', DATA.deadlineText) : null));
  }

  function consentView() {
    root.innerHTML = '';
    var box = h('input', { type: 'checkbox', id: 'agree' });
    var btn = h('button', { type: 'button', class: 'primary', disabled: true, onclick: function () {
      state.consent = { given: true, at: new Date().toISOString() };
      persist();
      mainView();
    } }, 'شروع');
    box.addEventListener('change', function () { btn.disabled = !box.checked; });
    add(root, [header(), h('section', { class: 'card consent' },
      h('h2', null, 'رضایت آگاهانه'),
      paragraphs(DATA.consentText),
      h('label', { class: 'agree', for: 'agree' }, box, ' موافقم و رضایت آگاهانه خود را برای مشارکت اعلام می‌کنم.'),
      h('div', { class: 'actions' }, btn))]);
  }

  // ---------------------------------------------------------------------------------------------
  // Delphi rounds
  // ---------------------------------------------------------------------------------------------
  var progressBar, progressText, unanswered;

  function allParams() {
    var out = [];
    DATA.groups.forEach(function (g) { g.params.forEach(function (p) { out.push(p); }); });
    return out;
  }

  function answeredCount() {
    if (DATA.kind === 'pugh') {
      var n = 0;
      DATA.concepts.forEach(function (c) { DATA.params.forEach(function (p) { var v = (state.scores[c.code] || {})[p.id]; if (typeof v === 'number') n++; }); });
      return { done: n, total: DATA.concepts.length * DATA.params.length };
    }
    var ps = allParams();
    return { done: ps.filter(function (p) { var v = state.ratings[p.id]; return v === CJ || typeof v === 'number'; }).length, total: ps.length };
  }

  function updateProgress() {
    var c = answeredCount();
    var pct = c.total ? Math.round((100 * c.done) / c.total) : 0;
    progressBar.style.width = pct + '%';
    progressText.textContent = num(c.done) + ' از ' + num(c.total) + ' پرسش پاسخ داده شد';
  }

  function scaleLegend() {
    var s = DATA.scale;
    return h('div', { class: 'legend' },
      s.bands.map(function (b) { return h('span', { class: 'band' }, h('b', null, num(b.from) + '–' + num(b.to)), ' ', b.label); }),
      s.allowCannotJudge ? h('span', { class: 'band' }, h('b', null, '؟'), ' ', s.cannotJudgeLabel) : null);
  }

  function ratingButtons(p) {
    var s = DATA.scale;
    var wrap = h('div', { class: 'rating', role: 'radiogroup', 'aria-label': 'امتیاز اهمیت ' + p.code });
    var buttons = [];
    function refresh() {
      buttons.forEach(function (b) {
        var on = state.ratings[p.id] === b._value;
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.classList.toggle('on', on);
      });
    }
    function choose(v) {
      state.ratings[p.id] = state.ratings[p.id] === v ? null : v;
      persist(); refresh(); updateProgress();
    }
    s.bands.forEach(function (band) {
      var seg = h('div', { class: 'seg' });
      var row = h('div', { class: 'seg-buttons' });
      for (var v = band.from; v <= band.to; v++) {
        (function (val) {
          var b = h('button', { type: 'button', role: 'radio', class: 'r', onclick: function () { choose(val); } }, num(val));
          b._value = val; buttons.push(b); row.appendChild(b);
        })(v);
      }
      add(seg, [row, h('div', { class: 'seg-label' }, band.label)]);
      wrap.appendChild(seg);
    });
    if (s.allowCannotJudge) {
      var cj = h('button', { type: 'button', role: 'radio', class: 'r cj', onclick: function () { choose(CJ); } }, s.cannotJudgeLabel);
      cj._value = CJ; buttons.push(cj);
      wrap.appendChild(h('div', { class: 'seg' }, h('div', { class: 'seg-buttons' }, cj)));
    }
    refresh();
    return wrap;
  }

  /** Round-2 feedback: panel's round-1 distribution by domain (aggregated) and this expert's own round-1 answer. */
  function feedback(p) {
    if (DATA.kind !== 'r2') return null;
    if (p.isNew) return h('div', { class: 'fb' }, h('div', { class: 'fb-title' }, 'این پارامتر در دور اول وجود نداشت (پارامتر جدید)؛ داده دور اول ندارد.'));
    var f = p.feedback;
    var rows = DATA.domains.map(function (d) {
      var x = f.byDomain[d.id] || { n: 0, percents: [] };
      var bar = h('div', { class: 'fb-bar', role: 'img', 'aria-label': d.name + ': ' + DATA.scale.bands.map(function (b, i) { return b.label + ' ' + num(x.percents[i] == null ? 0 : x.percents[i], 0) + '٪'; }).join('، ') });
      DATA.scale.bands.forEach(function (b, i) {
        var pc = x.percents[i] || 0;
        var op = DATA.scale.bands.length > 1 ? 0.3 + (0.7 * i) / (DATA.scale.bands.length - 1) : 1;
        if (pc > 0) bar.appendChild(h('span', { class: 'fb-seg', style: 'width:' + pc + '%;background:' + d.color + ';opacity:' + op.toFixed(2) }, pc >= 12 ? num(pc, 0) + '٪' : ''));
      });
      return h('div', { class: 'fb-row' },
        h('span', { class: 'chip', style: 'background:' + d.color }, d.shortLabel),
        h('span', { class: 'fb-name' }, d.name, ' ', h('small', null, '(n=' + num(x.n) + ')')),
        x.n ? bar : h('span', { class: 'muted' }, 'پاسخ معتبری نیست'));
    });
    var own = f.own === CJ ? DATA.scale.cannotJudgeLabel : typeof f.own === 'number' ? num(f.own) : 'در دور اول پاسخ نداده‌اید';
    return h('div', { class: 'fb' },
      h('div', { class: 'fb-title' }, 'نتیجه دور اول پنل (درصد پاسخ‌های معتبر در هر طبقه، به تفکیک حوزه؛ پررنگ‌تر = طبقه بالاتر)'),
      rows,
      h('div', { class: 'own' }, 'امتیاز شما در دور اول: ', h('b', null, own)));
  }

  function paramCard(p) {
    return h('article', { class: 'card param', id: 'p-' + p.id },
      h('div', { class: 'p-head' },
        h('span', { class: 'code ltr' }, p.code),
        h('h3', null, p.name),
        p.isNew ? h('span', { class: 'new' }, 'جدید') : null),
      p.requirement ? h('div', { class: 'req' }, h('b', null, 'الزام طراحی: '), p.requirement) : null,
      p.explanation ? h('div', { class: 'exp' }, p.explanation) : null,
      p.range ? h('div', { class: 'range' }, h('b', null, 'محدوده عددی گزارش‌شده: '), p.range) : null,
      feedback(p),
      ratingButtons(p));
  }

  function totalBadge(get) {
    var el = h('span', { class: 'total' });
    function refresh() {
      var t = get();
      var ok = Math.abs(t - 100) < 1e-9;
      el.textContent = 'مجموع: ' + num(Math.round(t * 100) / 100) + ' از ' + num(100) + (ok ? ' ✓' : t > 100 ? ' — ' + num(Math.round((t - 100) * 100) / 100) + ' بیشتر' : ' — ' + num(Math.round((100 - t) * 100) / 100) + ' کمتر');
      el.className = 'total ' + (ok ? 'ok' : 'warn');
    }
    refresh();
    return { el: el, refresh: refresh };
  }

  function pointInput(map, id, label, onchange) {
    var v = map[id];
    var inp = h('input', { type: 'text', inputmode: 'decimal', class: 'pts', 'aria-label': label, value: v === null || v === undefined ? '' : num(v) });
    inp.addEventListener('input', function () {
      var n = parseNum(inp.value);
      inp.classList.toggle('bad', isNaN(n));
      if (!isNaN(n)) { map[id] = n; persist(); onchange(); }
    });
    return inp;
  }

  function allocationSection() {
    var sum = function (obj, ids) { return ids.reduce(function (s, id) { var v = obj[id]; return s + (typeof v === 'number' ? v : 0); }, 0); };
    var groupIds = DATA.groups.map(function (g) { return g.id; });
    var gTotal = totalBadge(function () { return sum(state.groupPoints, groupIds); });
    var groupTable = h('table', { class: 'alloc' },
      DATA.groups.map(function (g) {
        return h('tr', null, h('td', null, g.name), h('td', null, pointInput(state.groupPoints, g.id, 'امتیاز گروه ' + g.name, gTotal.refresh)));
      }));
    var perGroup = DATA.groups.map(function (g) {
      var ids = g.params.map(function (p) { return p.id; });
      var t = totalBadge(function () { return sum(state.paramPoints, ids); });
      return h('div', { class: 'card alloc-group' },
        h('h3', null, g.name, ' ', t.el),
        h('table', { class: 'alloc' }, g.params.map(function (p) {
          return h('tr', null, h('td', null, h('span', { class: 'code ltr' }, p.code), ' ', p.name), h('td', null, pointInput(state.paramPoints, p.id, 'امتیاز ' + p.code, t.refresh)));
        })));
    });
    return h('section', { class: 'alloc-section' },
      h('h2', null, 'توزیع امتیاز (وزن‌دهی)'),
      h('p', null, 'ابتدا ۱۰۰ امتیاز را میان گروه‌های معنایی توزیع کنید؛ سپس در هر گروه، ۱۰۰ امتیاز را میان پارامترهای همان گروه. امتیاز بیشتر یعنی اهمیت نسبی بیشتر. اگر مجموع دقیقاً ۱۰۰ نشد نگران نباشید؛ امتیازها هنگام تحلیل دوباره نرمال می‌شوند.'),
      h('div', { class: 'card' }, h('h3', null, 'گروه‌های معنایی ', gTotal.el), groupTable),
      perGroup);
  }

  function delphiBody() {
    var parts = [];
    parts.push(h('section', { class: 'card intro' },
      h('p', null, DATA.kind === 'r1'
        ? 'لطفاً اهمیت هر پارامتر را برای موفقیت یک اگزواسکلتون غیرفعال پشتیبان پیش‌بند سربی برای جراحان درون‌عروقی روی مقیاس زیر مشخص کنید. در پایان هر گروه می‌توانید پارامتر جدید پیشنهاد دهید یا توضیح بنویسید.'
        : 'در این دور همه پارامترها دوباره امتیازدهی می‌شوند. کنار هر پارامتر، توزیع پاسخ‌های پنل در دور اول به تفکیک حوزه و امتیاز خود شما در دور اول آمده است تا در صورت تمایل امتیازتان را بازبینی کنید. امتیاز هیچ فرد دیگری نمایش داده نمی‌شود.'),
      scaleLegend()));
    DATA.groups.forEach(function (g) {
      var sec = h('section', { class: 'group' }, h('h2', null, g.name));
      g.params.forEach(function (p) { sec.appendChild(paramCard(p)); });
      if (DATA.kind === 'r1') {
        var ta = h('textarea', { rows: 3, 'aria-label': 'پیشنهاد یا توضیح برای ' + g.name, placeholder: 'پیشنهاد پارامتر جدید یا توضیح درباره این گروه (اختیاری)' });
        ta.value = state.openTexts[g.id] || '';
        ta.addEventListener('input', function () { state.openTexts[g.id] = ta.value; persist(); });
        sec.appendChild(h('div', { class: 'card open' }, h('label', null, 'پیشنهاد پارامتر جدید یا توضیح — ' + g.name), ta));
      }
      parts.push(sec);
    });
    if (DATA.kind === 'r2') parts.push(allocationSection());
    return parts;
  }

  // ---------------------------------------------------------------------------------------------
  // Weighted Pugh scoring
  // ---------------------------------------------------------------------------------------------
  function pughBody() {
    var parts = [h('section', { class: 'card intro' },
      h('p', null, 'برای هر کانسپت و هر پارامتر مشخص کنید کانسپت تا چه حد آن پارامتر را برآورده می‌سازد. امتیازدهی مطلق است و کانسپت‌ها با یکدیگر یا با طرح مرجعی مقایسه نمی‌شوند. کانسپت‌ها با کد تصادفی و به ترتیب تصادفی نمایش داده شده‌اند.'),
      h('div', { class: 'legend' }, DATA.valueLabels.map(function (l, i) { return h('span', { class: 'band' }, h('b', null, num(i + 1)), ' ', l); })))];
    DATA.concepts.forEach(function (c) {
      var rows = DATA.params.map(function (p) {
        var cell = h('div', { class: 'rating small', role: 'radiogroup', 'aria-label': c.label + ' — ' + p.code });
        var buttons = [];
        function refresh() { buttons.forEach(function (b) { var on = (state.scores[c.code] || {})[p.id] === b._value; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); }); }
        for (var v = 1; v <= 5; v++) {
          (function (val) {
            var b = h('button', { type: 'button', role: 'radio', class: 'r', title: DATA.valueLabels[val - 1], onclick: function () {
              state.scores[c.code] = state.scores[c.code] || {};
              state.scores[c.code][p.id] = state.scores[c.code][p.id] === val ? null : val;
              persist(); refresh(); updateProgress();
            } }, num(val));
            b._value = val; buttons.push(b); cell.appendChild(b);
          })(v);
        }
        refresh();
        return h('tr', null, h('td', null, h('span', { class: 'code ltr' }, p.code), ' ', p.name, p.requirement ? h('div', { class: 'muted small' }, p.requirement) : null), h('td', null, cell));
      });
      var img = c.sketch && /^data:image\//.test(c.sketch) ? h('img', { src: c.sketch, alt: 'طرح ' + c.label, class: 'sketch' }) : null;
      parts.push(h('section', { class: 'card concept' },
        h('h2', null, c.label),
        img,
        c.description ? h('p', { class: 'desc' }, c.description) : null,
        h('table', { class: 'pugh' }, rows)));
    });
    return parts;
  }

  // ---------------------------------------------------------------------------------------------
  // main view, saving
  // ---------------------------------------------------------------------------------------------
  function mainView() {
    root.innerHTML = '';
    progressBar = h('div', { class: 'bar-fill' });
    progressText = h('span', null, '');
    unanswered = h('div', { class: 'notice', role: 'status' });
    var saveBtn = h('button', { type: 'button', class: 'primary', onclick: trySave }, 'ذخیره پاسخ');
    var top = h('div', { class: 'sticky' },
      h('div', { class: 'bar' }, progressBar),
      h('div', { class: 'sticky-row' }, progressText, h('button', { type: 'button', class: 'secondary', onclick: trySave }, 'ذخیره پاسخ')));
    add(root, [header(), top,
      restored ? h('div', { class: 'notice ok' }, 'پیش‌نویس قبلی شما بازیابی شد.') : null,
      DATA.kind === 'pugh' ? pughBody() : delphiBody(),
      h('section', { class: 'card end' }, unanswered, h('div', { class: 'actions' }, saveBtn))]);
    updateProgress();
  }

  function payload() {
    var now = new Date().toISOString();
    if (DATA.kind === 'pugh') {
      var scores = {};
      DATA.concepts.forEach(function (c) {
        scores[c.code] = {};
        DATA.params.forEach(function (p) { var v = (state.scores[c.code] || {})[p.id]; scores[c.code][p.id] = typeof v === 'number' ? v : null; });
      });
      return { consent: state.consent, scores: scores, submittedAt: now };
    }
    var ratings = {};
    allParams().forEach(function (p) { var v = state.ratings[p.id]; ratings[p.id] = v === CJ || typeof v === 'number' ? v : null; });
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
    return { consent: state.consent, ratings: ratings, openTexts: openTexts, allocation: allocation, submittedAt: now };
  }

  function trySave() {
    var c = answeredCount();
    var problems = [];
    if (c.done < c.total) problems.push(num(c.total - c.done) + ' پرسش بی‌پاسخ مانده است.');
    if (DATA.kind === 'r2') {
      var gsum = DATA.groups.reduce(function (s, g) { var v = state.groupPoints[g.id]; return s + (typeof v === 'number' ? v : 0); }, 0);
      if (gsum === 0) problems.push('توزیع امتیاز میان گروه‌ها انجام نشده است.');
      else if (Math.abs(gsum - 100) > 1e-9) problems.push('مجموع امتیاز گروه‌ها ' + num(gsum) + ' است (نه ۱۰۰).');
    }
    unanswered.innerHTML = '';
    unanswered.className = 'notice';
    if (problems.length) {
      unanswered.className = 'notice warn';
      add(unanswered, [h('div', null, problems.join(' ')),
        h('div', { class: 'actions' },
          h('button', { type: 'button', class: 'secondary', onclick: function () { unanswered.innerHTML = ''; unanswered.className = 'notice'; jumpToFirstUnanswered(); } }, 'بازگشت به پرسش‌ها'),
          h('button', { type: 'button', class: 'primary', onclick: doSave }, 'با همین وضعیت ذخیره شود'))]);
      unanswered.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    doSave();
  }

  function jumpToFirstUnanswered() {
    if (DATA.kind === 'pugh') return;
    var p = allParams().find(function (x) { var v = state.ratings[x.id]; return !(v === CJ || typeof v === 'number'); });
    if (p) { var el = document.getElementById('p-' + p.id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }

  function doSave() {
    var env = { format: 'delphi-pugh/response', version: 1, projectId: DATA.projectId, kind: DATA.kind, expertId: DATA.expertId, expertCode: DATA.expertCode, payload: payload() };
    env.checksum = sha256Hex(canonicalJson(env));
    var name = DATA.expertCode + '_' + (DATA.kind === 'r1' ? 'round1' : DATA.kind === 'r2' ? 'round2' : 'pugh') + '.json';
    var blob = new Blob([JSON.stringify(env, null, 2)], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    unanswered.innerHTML = '';
    unanswered.className = 'notice ok';
    add(unanswered, ['فایل ', h('b', { class: 'ltr' }, name), ' ذخیره شد. لطفاً این فایل را به‌صورت پیوست برای پژوهشگر ایمیل کنید. سپاس از مشارکت شما.']);
  }

  if (state.consent && state.consent.given) mainView(); else consentView();
}

bootQuestionnaire();
