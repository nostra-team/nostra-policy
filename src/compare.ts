// 변경 내용 비교 — 두 판의 조항을 줄(제목·문단·목록 한 줄) 단위로 맞대고, 바뀐 줄만 이전·이후로 보여 준다.
//
//   changes?doc=privacy&from=2026-10-04&to=2026-11-01
//
// 원본은 scripts/build.ts 가 페이지와 함께 쓴 data/<문서>/<시행일>[.en].json — 페이지에 보이는 글자와 같다.
// 줄 맞대기는 LCS, 한 줄 안에서는 낱말 단위 LCS 로 지운 말·더한 말을 칠한다.
//
// import 가 없는 일반 스크립트다 (tsc 가 assets/compare.js 로 그대로 옮긴다 — 번들러 불필요).
(() => {
  type Kind = 'h2' | 'h3' | 'p' | 'li';
  /** 판을 편 한 줄 — sec 는 속한 조항 제목, sub 는 속한 소항목 제목 */
  interface Unit { kind: Kind; text: string; sec: string; sub: string }
  type Op<T> = { op: 'eq'; a: T; b: T } | { op: 'del'; a: T } | { op: 'ins'; b: T };
  interface Words { left: string; right: string; ratio: number }
  /** 한 줄 짝 — a 만 있으면 삭제, b 만 있으면 추가, 둘 다면 수정 */
  interface Row { a?: Unit; b?: Unit; w?: Words }
  interface Hunk { sec: string; sub: string; rows: Row[] }
  type Entry = LegalListing[LegalDoc][number];
  interface State { doc: LegalDoc; from: string | null; to: string | null }

  const root = document.getElementById('compare');
  if (!root) return;
  const ds = root.dataset;
  const base = ds.root ?? '';
  const en = ds.lang === 'en';
  const T = en
    ? { preamble: 'Preamble', same: 'These two versions are identical.', pick: 'Pick two different versions.',
        fail: 'Could not load the versions. Please try again later.', loading: 'Loading…',
        summary: (n: number, m: number, a: number, d: number) => `<b>${n}</b> changes · ${m} edited · ${a} added · ${d} removed`,
        full: 'Read the full version', current: 'Current', upcoming: 'Upcoming', past: '' }
    : { preamble: '머리말', same: '두 판의 내용이 같습니다.', pick: '서로 다른 두 판을 고르세요.',
        fail: '판을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', loading: '불러오는 중…',
        summary: (n: number, m: number, a: number, d: number) => `바뀐 곳 <b>${n}</b> · 수정 ${m} · 추가 ${a} · 삭제 ${d}`,
        full: '전문 보기', current: '현행', upcoming: '시행 예정', past: '' };

  const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
  const esc = (s: unknown): string => String(s).replace(/[&<>"]/g, (c) => ESC[c] ?? c);
  const label = (d: string): string => (en ? d : d.replace(/-/g, '. '));
  const q = new URLSearchParams(location.search);
  const state: State = { doc: q.get('doc') === 'terms' ? 'terms' : 'privacy', from: q.get('from'), to: q.get('to') };
  const cache = new Map<string, Promise<LegalBlock[]>>();

  // ── 판 → 줄 ────────────────────────────────────────────────────────────
  const flatten = (blocks: readonly LegalBlock[]): Unit[] => {
    const out: Unit[] = [];
    let sec = '';
    let sub = '';
    for (const b of blocks) {
      if (b.heading) { sec = b.heading; sub = ''; out.push({ kind: 'h2', text: b.heading, sec, sub }); }
      for (const t of b.body ?? []) out.push({ kind: 'p', text: t, sec, sub });
      for (const t of b.bullets ?? []) out.push({ kind: 'li', text: t, sec, sub });
      for (const it of b.items ?? []) {
        sub = it.title;
        out.push({ kind: 'h3', text: it.title, sec, sub });
        for (const t of it.lines) out.push({ kind: 'li', text: t, sec, sub });
      }
      sub = '';
    }
    return out;
  };

  /** LCS 로 맞댄다 */
  const lcs = <T>(a: readonly T[], b: readonly T[], key: (x: T) => string): Op<T>[] => {
    const n = a.length;
    const m = b.length;
    const ka = a.map(key);
    const kb = b.map(key);
    const dp: Uint16Array[] = [];
    for (let i = 0; i <= n; i++) dp.push(new Uint16Array(m + 1));
    const at = (i: number, j: number): number => dp[i]![j]!;
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        dp[i]![j] = ka[i] === kb[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
    const ops: Op<T>[] = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (ka[i] === kb[j]) { ops.push({ op: 'eq', a: a[i]!, b: b[j]! }); i++; j++; }
      else if (at(i + 1, j) >= at(i, j + 1)) ops.push({ op: 'del', a: a[i++]! });
      else ops.push({ op: 'ins', b: b[j++]! });
    }
    while (i < n) ops.push({ op: 'del', a: a[i++]! });
    while (j < m) ops.push({ op: 'ins', b: b[j++]! });
    return ops;
  };

  // 한 줄 안 — 낱말·문장부호 단위
  const tokens = (s: string): string[] => s.match(/\s+|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) ?? [];
  /** 이어진 칠을 한 덩어리로 (낱말 사이 공백까지) */
  const glue = (h: string, tag: 'del' | 'ins'): string =>
    h.split(`</${tag}><${tag}>`).join('').replace(new RegExp(`</${tag}>(\\s+)<${tag}>`, 'g'), '$1');
  const words = (a: string, b: string): Words => {
    let left = '';
    let right = '';
    let same = 0;
    let total = 0;
    for (const o of lcs(tokens(a), tokens(b), (x) => x)) {
      if (o.op === 'eq') {
        left += esc(o.a); right += esc(o.b);
        if (/\S/.test(o.a)) { same += 2; total += 2; }
      } else if (o.op === 'del') {
        left += `<del>${esc(o.a)}</del>`;
        if (/\S/.test(o.a)) total++;
      } else {
        right += `<ins>${esc(o.b)}</ins>`;
        if (/\S/.test(o.b)) total++;
      }
    }
    return { left: glue(left, 'del'), right: glue(right, 'ins'), ratio: total ? same / total : 1 };
  };

  /** 한 덩어리 안에서 지운 줄과 더한 줄을 짝짓는다 — 비슷하면(낱말 40% 이상 같으면) "수정", 아니면 따로 */
  const pairUp = (dels: readonly Unit[], inss: readonly Unit[]): Row[] => {
    const pair: ({ j: number; w: Words } | undefined)[] = [];
    let j0 = 0;
    dels.forEach((d, i) => {
      let best = -1;
      let bestR = 0.4;
      let bestW: Words | null = null;
      for (let j = j0; j < inss.length; j++) {
        const cand = inss[j]!;
        // 문단과 목록 한 줄은 서로 바뀌어도 같은 말로 본다 — 제목은 제목끼리만
        if (cand.kind !== d.kind && !/^(p|li){2}$/.test(cand.kind + d.kind)) continue;
        const w = words(d.text, cand.text);
        if (w.ratio > bestR) { best = j; bestR = w.ratio; bestW = w; }
      }
      if (best >= 0 && bestW) { pair[i] = { j: best, w: bestW }; j0 = best + 1; }
    });
    const rows: Row[] = [];
    let i = 0;
    let j = 0;
    while (i < dels.length || j < inss.length) {
      const p = pair[i];
      if (i < dels.length && !p) rows.push({ a: dels[i++]! });
      else if (j < inss.length && (i >= dels.length || (p && j < p.j))) rows.push({ b: inss[j++]! });
      else if (p) { rows.push({ a: dels[i]!, b: inss[j]!, w: p.w }); i++; j++; }
      else break;
    }
    return rows;
  };

  const hunks = (a: readonly Unit[], b: readonly Unit[]): Hunk[] => {
    const out: Hunk[] = [];
    let run: Op<Unit>[] | null = null;
    const flush = (): void => {
      if (!run) return;
      const dels = run.flatMap((o) => (o.op === 'del' ? [o.a] : []));
      const inss = run.flatMap((o) => (o.op === 'ins' ? [o.b] : []));
      const first = (inss[0] ?? dels[0])!;
      out.push({ sec: first.sec, sub: first.kind === 'h3' ? '' : first.sub, rows: pairUp(dels, inss) });
      run = null;
    };
    for (const o of lcs(a, b, (u) => `${u.kind}\u0000${u.text}`)) {
      if (o.op === 'eq') flush();
      else (run ??= []).push(o);
    }
    flush();
    return out;
  };

  // ── 화면 ───────────────────────────────────────────────────────────────
  const badge = (st: VersionStatus): string => (T[st] ? `<span class="badge badge-${st}">${T[st]}</span>` : '');
  const picker = (name: 'from' | 'to', value: string | null, list: readonly Entry[]): string => {
    const v = list.find((x) => x.date === value) ?? list[0]!;
    return `<details class="picker" data-name="${name}"><summary><span class="picker-value">${label(v.date)}</span>` +
      `${badge(v.status)}<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></summary>` +
      '<ul class="picker-list">' + list.map((x) =>
        `<li><button type="button" data-date="${x.date}"${x.date === v.date ? ' class="on" aria-current="true"' : ''}>` +
        `<span>${label(x.date)}</span>${badge(x.status)}</button></li>`,
      ).join('') + '</ul></details>';
  };

  const cellHtml = (u: Unit | undefined, html: string, cls: string, tag: string): string => {
    if (!u) return '<div class="cell blank"></div>';
    return `<div class="cell ${u.kind} ${cls}"><span class="tag">${tag}</span>` +
      (u.kind === 'li' ? '<span class="dot">• </span>' : '') + html + '</div>';
  };

  const getJson = async <T>(path: string): Promise<T> => {
    const r = await fetch(`${base}data/${path}.json`);
    if (!r.ok) throw new Error(`${r.status} ${path}`);
    return (await r.json()) as T;
  };
  const load = (d: string): Promise<LegalBlock[]> => {
    const key = `${state.doc}/${d}${en ? '.en' : ''}`;
    let p = cache.get(key);
    if (!p) {
      const doc = state.doc;
      p = getJson<LegalBlock[]>(key).catch(() => getJson<LegalBlock[]>(`${doc}/${d}`)); // 번역이 없는 판은 원문
      cache.set(key, p);
    }
    return p;
  };

  const render = (listing: LegalListing): void => {
    const list = listing[state.doc] ?? [];
    const dates = list.map((x) => x.date);
    if (!state.to || !dates.includes(state.to)) state.to = dates[0] ?? null;
    if (!state.from || !dates.includes(state.from)) {
      state.from = dates[dates.indexOf(state.to ?? '') + 1] ?? dates[1] ?? dates[0] ?? null;
    }
    const from = state.from ?? '';
    const to = state.to ?? '';
    history.replaceState(null, '', `?doc=${state.doc}&from=${from}&to=${to}`);

    const fullUrl = `${base}${en ? 'en/' : ''}${state.doc}/${to}`;
    root.innerHTML =
      '<div class="tabs" role="group">' + (['privacy', 'terms'] as const).map((d) =>
        `<button type="button" data-doc="${d}" aria-pressed="${d === state.doc}">${esc(ds[d])}</button>`,
      ).join('') + '</div>' +
      `<div class="range"><div><label>${esc(ds.before)}</label>${picker('from', from, list)}</div>` +
      '<div class="arrow" aria-hidden="true">→</div>' +
      `<div><label>${esc(ds.after)}</label>${picker('to', to, list)}</div></div>` +
      `<div id="result"><p class="empty">${T.loading}</p></div>`;

    root.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((b) => {
      b.addEventListener('click', () => {
        state.doc = b.dataset.doc === 'terms' ? 'terms' : 'privacy';
        state.from = state.to = null;
        render(listing);
      });
    });
    root.querySelectorAll<HTMLDetailsElement>('details.picker').forEach((det) => {
      det.querySelectorAll<HTMLButtonElement>('button[data-date]').forEach((b) => {
        b.addEventListener('click', () => {
          const date = b.dataset.date ?? null;
          if (det.dataset.name === 'from') state.from = date; else state.to = date;
          render(listing);
        });
      });
    });

    const out = document.getElementById('result');
    if (!out) return;
    if (from === to) { out.innerHTML = `<p class="empty">${T.pick}</p>`; return; }
    const want = state.doc + from + to;
    Promise.all([load(from), load(to)]).then(([before, after]) => {
      if (want !== state.doc + (state.from ?? '') + (state.to ?? '')) return; // 그 사이 다른 판을 골랐다
      const hs = hunks(flatten(before), flatten(after));
      if (!hs.length) { out.innerHTML = `<p class="empty">${T.same}</p>`; return; }
      let m = 0;
      let a = 0;
      let d = 0;
      const rows = (h: Hunk): string => h.rows.map((r) => {
        if (r.a && r.b) m++; else if (r.b) a++; else d++;
        const left = r.a ? (r.w ? r.w.left : `<del>${esc(r.a.text)}</del>`) : '';
        const right = r.b ? (r.w ? r.w.right : `<ins>${esc(r.b.text)}</ins>`) : '';
        return '<div class="row">' +
          cellHtml(r.a, left, r.b ? '' : 'gone', `${esc(ds.before)} · ${label(from)}`) +
          cellHtml(r.b, right, r.a ? '' : 'new', `${esc(ds.after)} · ${label(to)}`) + '</div>';
      }).join('');
      // 같은 조항 안의 바뀐 곳은 한 카드에 — 사이의 같은 줄은 "⋯" 로 접는다
      const groups: { sec: string; parts: Hunk[] }[] = [];
      for (const h of hs) {
        const g = groups.at(-1);
        if (g && g.sec === h.sec) g.parts.push(h); else groups.push({ sec: h.sec, parts: [h] });
      }
      const body = groups.map((g) =>
        `<section class="hunk"><div class="hunk-head">${esc(g.sec || T.preamble)}</div>` +
        g.parts.map((h, k) => {
          const sub = h.sub ? `<div class="sub">${k ? '⋯ ' : ''}${esc(h.sub)}</div>` : (k ? '<div class="sub">⋯</div>' : '');
          return sub + rows(h);
        }).join('') + '</section>',
      ).join('');
      out.innerHTML = `<p class="summary">${T.summary(m + a + d, m, a, d)}` +
        ` · <a href="${fullUrl}">${label(to)} ${T.full} →</a></p>` +
        `<div class="cols"><span>${esc(ds.before)} · ${label(from)}</span><span>` +
        `${esc(ds.after)} · ${label(to)}</span></div>` + body;
    }).catch(() => { out.innerHTML = `<p class="empty">${T.fail}</p>`; });
  };

  getJson<LegalListing>('index').then(render).catch(() => { root.innerHTML = `<p class="empty">${T.fail}</p>`; });
})();
