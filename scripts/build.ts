/**
 * 방침·약관 Markdown 페이지 — nostra-data 에 공개된 판(legal/)에서 만든다.
 *
 *     npm run build                          # CDN 에서 받아 만든다
 *     npm run build -- --today 2026-11-01    # 그날 기준으로 (확인용)
 *
 * 원본은 앱 레포(nostra-team/nostra)의 `shared/legal/` 이고, 그 수집 CI 가 nostra-data 로 올린다.
 * 이 레포는 **공개된 판만 읽으므로** 비밀 키가 필요 없다. 앱 안의 방침과 같은 글자다.
 *
 *     privacy.md · terms.md         오늘 효력 있는 판 → /privacy · /terms (Play Console · App Store 에 넣는 주소)
 *     en/privacy.md · en/terms.md   영어판 → /en/privacy · /en/terms
 *     privacy/<시행일>.md · terms/<시행일>.md (+ en/)   시행일별 모든 판 → /privacy/<시행일>
 *     data/<문서>/<시행일>[.en].json · data/index.json   비교 화면이 읽는 원본
 *     changes.md · en/changes.md    비교 화면 → /changes (본문은 src/compare.ts)
 *     index.md · en/index.md        예전 첫 주소(/ · /en/) — /privacy 로 보낸다
 *
 * 주소에 .html 을 붙이지 않는다. GitHub Pages 는 /terms 를 terms.html 로 돌려주고, 같은 이름의
 * 폴더(terms/)가 있어도 파일을 먼저 본다. 그래서 첫 페이지는 폴더 안 index 가 아니라 privacy.md 다
 * (폴더 index 면 /privacy → /privacy/ 로 한 번 더 넘어간다).
 *
 * "오늘 효력 있는 판" 은 만든 날 기준이다 — 그래서 `.github/workflows/pages.yml` 이 **매일** 다시 만든다.
 * 시행일이 되면 그날 새 판이 첫 페이지로 올라간다.
 *
 * Node 22 의 `--experimental-strip-types` 로 타입만 지우고 돌린다 — 컴파일 단계도, 런타임 의존성도 없다.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://nostra-team.github.io/nostra-data/legal';
const CONTACT = 'psj06201@gmail.com';

type Lang = 'ko' | 'en';

interface Strings {
  privacy: string;
  terms: string;
  effective: string;
  current: string;
  upcoming: string;
  past: string;
  upcomingNote: string;
  /** {0} = 다음 시행일, {1} = 그 판 주소 */
  nextNote: string;
  compare: string;
  compareTitle: string;
  before: string;
  after: string;
  contact: string;
  other: string;
  app: string;
}

const L: Record<Lang, Strings> = {
  ko: {
    privacy: '개인정보처리방침', terms: '이용약관', effective: '시행일', current: '현행',
    upcoming: '시행 예정', past: '지난 판',
    upcomingNote: '이 판은 아직 시행 전입니다. 시행일부터 적용됩니다.',
    nextNote: '개정판이 **{0}** 부터 시행됩니다 → [{0} 판]({1})',
    compare: '이전 판과 달라진 점', compareTitle: '변경 내용 비교', before: '이전', after: '이후',
    contact: '문의', other: 'English', app: 'Nostra - 로또의 모든것',
  },
  en: {
    privacy: 'Privacy Policy', terms: 'Terms of Service', effective: 'Effective', current: 'Current',
    upcoming: 'Upcoming', past: 'Previous',
    upcomingNote: 'This version is not yet in effect. It applies from its effective date.',
    nextNote: 'A revised version takes effect on **{0}** → [{0} version]({1})',
    compare: 'What changed from the previous version', compareTitle: 'Compare versions',
    before: 'Before', after: 'After',
    contact: 'Contact', other: '한국어', app: 'Nostra',
  },
};

/** 2026-11-01 → 2026. 11. 01 (한국어 표기). 영어는 ISO 그대로. */
const dot = (d: string, lang: Lang): string => (lang === 'ko' ? d.replaceAll('-', '. ') : d);

const fetchJson = async <T>(path: string): Promise<T> => {
  const r = await fetch(`${BASE}/${path}`, { signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return (await r.json()) as T;
};

/** 목록·제목으로 잘못 읽히는 줄머리와 밑줄·별표만 막는다. 주소는 그대로 두면 GitHub 가 링크로 만든다. */
const mdEscape = (text: string): string => text.replace(/([*_`])/g, '\\$1');

const body = (blocks: readonly LegalBlock[]): string => {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.heading) out.push(`## ${mdEscape(b.heading)}\n`);
    for (const p of b.body ?? []) out.push(mdEscape(p) + '\n');
    if (b.bullets?.length) out.push(b.bullets.map((x) => `- ${mdEscape(x)}`).join('\n') + '\n');
    for (const it of b.items ?? []) {
      out.push(`### ${mdEscape(it.title)}\n`);
      out.push(it.lines.map((x) => `- ${mdEscape(x)}`).join('\n') + '\n');
    }
  }
  return out.join('\n');
};

/** front matter 문자열 — 따옴표로 감싸 YAML 이 콜론·샵을 먹지 않게 (JSON 문자열은 YAML 문자열이다). */
const yq = (text: string): string => JSON.stringify(text);

/** 오늘 효력 있는 판 — 아직 아무 판도 시행 전이면 가장 오래된 판 */
const currentOf = (dates: readonly string[], today: string): string => {
  const live = dates.filter((d) => d <= today).sort();
  return live.at(-1) ?? [...dates].sort()[0]!;
};

const statusOf = (d: string, cur: string, today: string): VersionStatus =>
  d === cur ? 'current' : d > today ? 'upcoming' : 'past';

/**
 * 판 하나. 머리(제목·시행일 선택·링크)는 `_layouts/policy.html` 이 front matter 로 그린다.
 * Markdown 본문은 방침 글자만 — GitHub 에서 파일로 열어도 읽히게.
 */
const page = (
  doc: LegalDoc, lang: Lang, eff: string, blocks: readonly LegalBlock[],
  dates: readonly string[], today: string, depth: number, isFront: boolean,
): string => {
  const t = L[lang];
  const up = '../'.repeat(depth);
  const cur = currentOf(dates, today);
  const langdir = lang === 'ko' ? '' : 'en/';
  const other = lang === 'ko' ? 'en/' : '';
  const link = (d: string): string => `${up}${langdir}${doc}/${d}`;
  const status = (d: string): VersionStatus => statusOf(d, cur, today);
  const older = dates.filter((d) => d < eff);
  const otherDoc: LegalDoc = doc === 'privacy' ? 'terms' : 'privacy';

  const fm = [
    '---',
    'layout: policy',
    `root: ${yq(up)}`,
    `title: ${yq(t[doc] + ' · Nostra')}`,
    `heading: ${yq(t[doc])}`,
    `app: ${yq(t.app)}`,
    `lang: ${lang}`,
    `doc: ${doc}`,
    `effective: ${yq(eff)}`,
    `effective_label: ${yq(dot(eff, lang))}`,
    `status: ${status(eff)}`,
    `status_label: ${yq(t[status(eff)])}`,
    `other_doc: ${yq(t[otherDoc])}`,
    `other_doc_url: ${yq(up + langdir + otherDoc)}`,
    `other_lang: ${yq(t.other)}`,
    `other_lang_url: ${yq(up + other + doc)}`,
    `effective_word: ${yq(t.effective)}`,
    `contact_word: ${yq(t.contact)}`,
    `contact: ${yq(CONTACT)}`,
  ];
  if (older.length) {
    // 바로 앞 판과 견준다 — 개정 고지에서 사람들이 묻는 것이 "무엇이 바뀌었나" 다
    fm.push(`compare_label: ${yq(t.compare)}`,
      `compare_url: ${yq(`${up}${langdir}changes?doc=${doc}&from=${older[0]}&to=${eff}`)}`);
  }
  fm.push('versions:');
  for (const d of dates) {
    fm.push(`  - date: ${yq(d)}`, `    label: ${yq(dot(d, lang))}`, `    status: ${status(d)}`,
      `    status_label: ${yq(t[status(d)])}`, `    url: ${yq(link(d))}`);
  }
  fm.push('---', '');

  const lines: string[] = [];
  if (eff > today) lines.push(`> ${t.upcomingNote}`, '');
  const next = dates.filter((d) => d > today).sort()[0];
  if (isFront && next) lines.push(`> ${t.nextNote.replaceAll('{0}', next).replaceAll('{1}', link(next))}`, '');
  lines.push(body(blocks));
  return [...fm, ...lines].join('\n');
};

/** 변경 내용 비교 — 본문은 `src/compare.ts`(→ assets/compare.js) 가 data/ 의 판 두 개를 받아 그린다. */
const comparePage = (lang: Lang, depth: number): string => {
  const t = L[lang];
  const up = '../'.repeat(depth);
  const fm: Record<string, string> = {
    layout: 'compare', title: `${t.compareTitle} · Nostra`, heading: t.compareTitle,
    app: t.app, lang, root: up, privacy_word: t.privacy, terms_word: t.terms,
    before_word: t.before, after_word: t.after, back_url: up + (lang === 'ko' ? '' : 'en/') + 'privacy',
    other_lang: t.other, other_lang_url: up + (lang === 'ko' ? 'en/' : '') + 'changes',
    contact_word: t.contact, contact: CONTACT,
  };
  return '---\n' + Object.entries(fm).map(([k, v]) => `${k}: ${yq(v)}\n`).join('') + '---\n';
};

/** 예전 주소에서 새 주소로 — 스크립트 없이도 넘어가게 meta refresh 와 링크를 같이 둔다 */
const redirectPage = (to: string): string => `---\nlayout: redirect\nto: ${yq(to)}\n---\n`;

/** Python json.dumps(indent=1) 과 같은 모양 — 한 칸 들여쓰기, 끝에 줄바꿈 */
const jsonFile = (value: unknown): string => JSON.stringify(value, null, 1) + '\n';

const todayKst = (): string => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

const main = async (): Promise<number> => {
  const { values } = parseArgs({ options: { today: { type: 'string', default: todayKst() } } });
  const today = values.today;
  const index = await fetchJson<Partial<Record<LegalDoc, string[]>>>('index.json');
  const written: string[] = [];
  const listing = {} as LegalListing;

  const put = (p: string, text: string): void => {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, text);
    written.push(p);
  };

  for (const doc of ['privacy', 'terms'] as const) {
    const dates = [...(index[doc] ?? [])].sort().reverse();
    if (!dates.length) {
      console.error(`✗ ${doc} 판이 없습니다`);
      return 1;
    }
    const cur = currentOf(dates, today);
    listing[doc] = dates.map((d) => ({ date: d, status: statusOf(d, cur, today) }));
    for (const lang of ['ko', 'en'] as const) {
      const suffix = lang === 'ko' ? '' : '.en';
      const texts = new Map<string, LegalBlock[]>();
      for (const d of dates) {
        try {
          texts.set(d, await fetchJson<LegalBlock[]>(`${doc}/${d}${suffix}.json`));
        } catch {
          texts.set(d, await fetchJson<LegalBlock[]>(`${doc}/${d}.json`)); // 번역이 없는 판은 원문
        }
      }
      const base = lang === 'ko' ? ROOT : join(ROOT, 'en');
      for (const d of dates) {
        const blocks = texts.get(d)!;
        put(join(base, doc, `${d}.md`), page(doc, lang, d, blocks, dates, today, lang === 'ko' ? 1 : 2, false));
        // 비교 화면이 읽는 원본 — 페이지와 같은 글자를 같은 곳에서 (CDN 이 바뀌어도 이 사본과 견준다)
        put(join(ROOT, 'data', doc, `${d}${suffix}.json`), jsonFile(blocks));
      }
      const front = join(base, `${doc}.md`);
      put(front, page(doc, lang, cur, texts.get(cur)!, dates, today, lang === 'ko' ? 0 : 1, true));
    }
  }
  put(join(ROOT, 'data', 'index.json'), jsonFile(listing));
  put(join(ROOT, 'changes.md'), comparePage('ko', 0));
  // 예전 첫 주소 — 스토어·앱에 이미 적힌 / 와 /en/ 이 끊기지 않게
  put(join(ROOT, 'index.md'), redirectPage('privacy'));
  put(join(ROOT, 'en', 'index.md'), redirectPage('privacy'));
  put(join(ROOT, 'en', 'changes.md'), comparePage('en', 1));
  for (const p of written) console.log(`→ ${relative(ROOT, p)}`);
  return 0;
};

process.exitCode = await main();
