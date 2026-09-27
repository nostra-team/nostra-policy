// 변경 내용 비교 — 두 판의 조항을 줄(제목·문단·목록 한 줄) 단위로 맞대고, 바뀐 줄만 이전·이후로 보여 준다.
//
//   changes.html?doc=privacy&from=2026-10-04&to=2026-11-01
//
// 원본은 build.py 가 페이지와 함께 쓴 data/<문서>/<시행일>[.en].json — 페이지에 보이는 글자와 같다.
// 줄 맞대기는 LCS, 한 줄 안에서는 낱말 단위 LCS 로 지운 말·더한 말을 칠한다.
(function () {
  var root = document.getElementById('compare');
  if (!root) return;
  var ds = root.dataset;
  var base = ds.root;
  var en = ds.lang === 'en';
  var T = en
    ? { preamble: 'Preamble', same: 'These two versions are identical.', pick: 'Pick two different versions.',
        fail: 'Could not load the versions. Please try again later.', loading: 'Loading…',
        summary: function (n, m, a, d) { return '<b>' + n + '</b> changes · ' + m + ' edited · ' + a + ' added · ' + d + ' removed'; },
        full: 'Read the full version', current: 'Current', upcoming: 'Upcoming', past: '' }
    : { preamble: '머리말', same: '두 판의 내용이 같습니다.', pick: '서로 다른 두 판을 고르세요.',
        fail: '판을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', loading: '불러오는 중…',
        summary: function (n, m, a, d) { return '바뀐 곳 <b>' + n + '</b> · 수정 ' + m + ' · 추가 ' + a + ' · 삭제 ' + d; },
        full: '전문 보기', current: '현행', upcoming: '시행 예정', past: '' };

  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  };
  var label = function (d) { return en ? d : d.replace(/-/g, '. '); };
  var q = new URLSearchParams(location.search);
  var state = { doc: q.get('doc') === 'terms' ? 'terms' : 'privacy', from: q.get('from'), to: q.get('to') };
  var index = null;
  var cache = {};

  // ── 판 → 줄 ────────────────────────────────────────────────────────────
  var flatten = function (blocks) {
    var out = [], sec = '', sub = '';
    blocks.forEach(function (b) {
      if (b.heading) { sec = b.heading; sub = ''; out.push({ kind: 'h2', text: b.heading, sec: sec, sub: sub }); }
      (b.body || []).forEach(function (t) { out.push({ kind: 'p', text: t, sec: sec, sub: sub }); });
      (b.bullets || []).forEach(function (t) { out.push({ kind: 'li', text: t, sec: sec, sub: sub }); });
      (b.items || []).forEach(function (it) {
        sub = it.title;
        out.push({ kind: 'h3', text: it.title, sec: sec, sub: sub });
        it.lines.forEach(function (t) { out.push({ kind: 'li', text: t, sec: sec, sub: sub }); });
      });
      sub = '';
    });
    return out;
  };

  // LCS 로 맞댄다 → [{op:'eq'|'del'|'ins', a, b}]
  var lcs = function (a, b, key) {
    var n = a.length, m = b.length, i, j;
    var dp = [];
    for (i = 0; i <= n; i++) dp.push(new Uint16Array(m + 1));
    for (i = n - 1; i >= 0; i--)
      for (j = m - 1; j >= 0; j--)
        dp[i][j] = key(a[i]) === key(b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    var ops = [];
    i = 0; j = 0;
    while (i < n && j < m) {
      if (key(a[i]) === key(b[j])) { ops.push({ op: 'eq', a: a[i], b: b[j] }); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push({ op: 'del', a: a[i++] });
      else ops.push({ op: 'ins', b: b[j++] });
    }
    while (i < n) ops.push({ op: 'del', a: a[i++] });
    while (j < m) ops.push({ op: 'ins', b: b[j++] });
    return ops;
  };

  // 한 줄 안 — 낱말·문장부호 단위
  var tokens = function (s) { return s.match(/\s+|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) || []; };
  var words = function (a, b) {
    var ops = lcs(tokens(a), tokens(b), function (x) { return x; });
    var left = '', right = '', same = 0, total = 0;
    ops.forEach(function (o) {
      var solid = /\S/.test(o.a || o.b);
      if (o.op === 'eq') { left += esc(o.a); right += esc(o.b); if (solid) { same += 2; total += 2; } }
      else if (o.op === 'del') { left += '<del>' + esc(o.a) + '</del>'; if (solid) total++; }
      else { right += '<ins>' + esc(o.b) + '</ins>'; if (solid) total++; }
    });
    // 이어진 칠을 한 덩어리로 (낱말 사이 공백까지)
    var glue = function (h, tag) { return h.split('</' + tag + '><' + tag + '>').join('').replace(new RegExp('</' + tag + '>(\\s+)<' + tag + '>', 'g'), '$1'); };
    return { left: glue(left, 'del'), right: glue(right, 'ins'), ratio: total ? same / total : 1 };
  };

  // 한 덩어리 안에서 지운 줄과 더한 줄을 짝짓는다 — 비슷하면(낱말 40% 이상 같으면) "수정", 아니면 따로
  var pairUp = function (dels, inss) {
    var pair = [], j0 = 0;
    dels.forEach(function (d, i) {
      var best = -1, bestR = 0.4, bestW = null;
      for (var j = j0; j < inss.length; j++) {
        if (inss[j].kind !== d.kind && !(inss[j].kind + d.kind).match(/^(p|li){2}$/)) continue;
        var w = words(d.text, inss[j].text);
        if (w.ratio > bestR) { best = j; bestR = w.ratio; bestW = w; }
      }
      if (best >= 0) { pair[i] = { j: best, w: bestW }; j0 = best + 1; }
    });
    var rows = [], i = 0, j = 0;
    while (i < dels.length || j < inss.length) {
      var p = pair[i];
      if (i < dels.length && !p) rows.push({ a: dels[i++] });
      else if (j < inss.length && (i >= dels.length || j < p.j)) rows.push({ b: inss[j++] });
      else { rows.push({ a: dels[i], b: inss[j], w: p.w }); i++; j++; }
    }
    return rows;
  };

  var hunks = function (a, b) {
    var ops = lcs(a, b, function (u) { return u.kind + '\u0000' + u.text; });
    var out = [], run = null;
    var flush = function () {
      if (!run) return;
      var dels = run.filter(function (o) { return o.op === 'del'; }).map(function (o) { return o.a; });
      var inss = run.filter(function (o) { return o.op === 'ins'; }).map(function (o) { return o.b; });
      var first = inss[0] || dels[0];
      out.push({ sec: first.sec, sub: first.kind === 'h3' ? '' : first.sub, rows: pairUp(dels, inss) });
      run = null;
    };
    ops.forEach(function (o) {
      if (o.op === 'eq') flush();
      else (run = run || []).push(o);
    });
    flush();
    return out;
  };

  // ── 화면 ───────────────────────────────────────────────────────────────
  var badge = function (st) { return T[st] ? '<span class="badge badge-' + st + '">' + T[st] + '</span>' : ''; };
  var picker = function (name, value, list) {
    var v = list.filter(function (x) { return x.date === value; })[0] || list[0];
    return '<details class="picker" data-name="' + name + '"><summary><span class="picker-value">' + label(v.date) + '</span>' +
      badge(v.status) + '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></summary>' +
      '<ul class="picker-list">' + list.map(function (x) {
        return '<li><button type="button" data-date="' + x.date + '"' + (x.date === v.date ? ' class="on" aria-current="true"' : '') + '>' +
          '<span>' + label(x.date) + '</span>' + badge(x.status) + '</button></li>';
      }).join('') + '</ul></details>';
  };

  var cellHtml = function (u, html, cls, tag) {
    if (!u) return '<div class="cell blank"></div>';
    return '<div class="cell ' + u.kind + ' ' + cls + '"><span class="tag">' + tag + '</span>' +
      (u.kind === 'li' ? '<span class="dot">• </span>' : '') + html + '</div>';
  };

  var load = function (d) {
    var key = state.doc + '/' + d + (en ? '.en' : '');
    if (cache[key]) return cache[key];
    var get = function (p) { return fetch(base + 'data/' + p + '.json').then(function (r) { if (!r.ok) throw r; return r.json(); }); };
    cache[key] = get(key).catch(function () { return get(state.doc + '/' + d); });  // 번역이 없는 판은 원문
    return cache[key];
  };

  var render = function () {
    var list = index[state.doc] || [];
    var dates = list.map(function (x) { return x.date; });
    if (dates.indexOf(state.to) < 0) state.to = dates[0];
    if (dates.indexOf(state.from) < 0) state.from = dates[dates.indexOf(state.to) + 1] || dates[1] || dates[0];
    history.replaceState(null, '', '?doc=' + state.doc + '&from=' + state.from + '&to=' + state.to);

    var fullUrl = base + (en ? 'en/' : '') + state.doc + '/' + state.to + '.html';
    root.innerHTML =
      '<div class="tabs" role="group">' + ['privacy', 'terms'].map(function (d) {
        return '<button type="button" data-doc="' + d + '" aria-pressed="' + (d === state.doc) + '">' + esc(ds[d]) + '</button>';
      }).join('') + '</div>' +
      '<div class="range"><div><label>' + esc(ds.before) + '</label>' + picker('from', state.from, list) + '</div>' +
      '<div class="arrow" aria-hidden="true">→</div>' +
      '<div><label>' + esc(ds.after) + '</label>' + picker('to', state.to, list) + '</div></div>' +
      '<div id="result"><p class="empty">' + T.loading + '</p></div>';

    root.querySelectorAll('.tabs button').forEach(function (b) {
      b.addEventListener('click', function () { state.doc = b.dataset.doc; state.from = state.to = null; render(); });
    });
    root.querySelectorAll('details.picker').forEach(function (det) {
      det.querySelectorAll('button[data-date]').forEach(function (b) {
        b.addEventListener('click', function () { state[det.dataset.name] = b.dataset.date; render(); });
      });
    });

    var out = document.getElementById('result');
    if (state.from === state.to) { out.innerHTML = '<p class="empty">' + T.pick + '</p>'; return; }
    var want = state.doc + state.from + state.to;
    Promise.all([load(state.from), load(state.to)]).then(function (pair) {
      if (want !== state.doc + state.from + state.to) return;  // 그 사이 다른 판을 골랐다
      var hs = hunks(flatten(pair[0]), flatten(pair[1]));
      if (!hs.length) { out.innerHTML = '<p class="empty">' + T.same + '</p>'; return; }
      var m = 0, a = 0, d = 0;
      // 같은 조항 안의 바뀐 곳은 한 카드에 — 사이의 같은 줄은 "⋯" 로 접는다
      var groups = [];
      hs.forEach(function (h) {
        var g = groups[groups.length - 1];
        if (g && g.sec === h.sec) g.parts.push(h); else groups.push({ sec: h.sec, parts: [h] });
      });
      var body = groups.map(function (g) {
        return '<section class="hunk"><div class="hunk-head">' + esc(g.sec || T.preamble) + '</div>' +
          g.parts.map(function (h, k) {
            var sub = h.sub ? '<div class="sub">' + (k ? '⋯ ' : '') + esc(h.sub) + '</div>' : (k ? '<div class="sub">⋯</div>' : '');
            return sub + rows(h);
          }).join('') + '</section>';
      }).join('');
      function rows(h) {
        return h.rows.map(function (r) {
            if (r.a && r.b) m++; else if (r.b) a++; else d++;
            var left = r.a ? (r.w ? r.w.left : '<del>' + esc(r.a.text) + '</del>') : '';
            var right = r.b ? (r.w ? r.w.right : '<ins>' + esc(r.b.text) + '</ins>') : '';
            return '<div class="row">' +
              cellHtml(r.a, left, r.b ? '' : 'gone', esc(ds.before) + ' · ' + label(state.from)) +
              cellHtml(r.b, right, r.a ? '' : 'new', esc(ds.after) + ' · ' + label(state.to)) + '</div>';
        }).join('');
      }
      out.innerHTML = '<p class="summary">' + T.summary(m + a + d, m, a, d) +
        ' · <a href="' + fullUrl + '">' + label(state.to) + ' ' + T.full + ' →</a></p>' +
        '<div class="cols"><span>' + esc(ds.before) + ' · ' + label(state.from) + '</span><span>' +
        esc(ds.after) + ' · ' + label(state.to) + '</span></div>' + body;
    }).catch(function () { out.innerHTML = '<p class="empty">' + T.fail + '</p>'; });
  };

  fetch(base + 'data/index.json').then(function (r) { return r.json(); }).then(function (j) {
    index = j;
    render();
  }).catch(function () { root.innerHTML = '<p class="empty">' + T.fail + '</p>'; });
})();
