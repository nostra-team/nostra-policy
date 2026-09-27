# nostra-policy

**Nostra - 로또의 모든것** 앱의 개인정보처리방침 · 이용약관 공개 페이지 (GitHub Pages).

Google Play Console · App Store Connect 의 개인정보처리방침 URL 로 쓰는 곳이다. 앱 안의 방침과
**같은 원본에서 같은 글자로** 만든다 — 두 곳이 다르면 심사에서 "방침 URL 과 앱 안 방침이 다르다" 로 걸린다.

## 주소

| 주소 | 내용 |
|---|---|
| https://nostra-team.github.io/nostra-policy/privacy | 개인정보처리방침 — **오늘 효력 있는 판** (스토어에 넣는 주소) |
| https://nostra-team.github.io/nostra-policy/terms | 이용약관 — 오늘 효력 있는 판 |
| `en/privacy` · `en/terms` | 영어판 (번역 — 다르면 한국어 원문이 우선) |
| `privacy/<시행일>` · `terms/<시행일>` (+ `en/`) | 시행일별 모든 판 — 위쪽 드롭다운으로 판을 바꾼다 |
| `changes?doc=privacy&from=<이전>&to=<이후>` (+ `en/`) | 두 판에서 **바뀐 줄만** 이전 · 이후로 |
| `privacy/` · `terms/` (+ `en/`) | 끝에 `/` 를 붙인 주소 — 첫 페이지와 같은 판 (대표 주소는 `/privacy`, canonical) |
| `/` · `/en/` · `index.html` | 예전 첫 주소 — `privacy` 로 넘어간다 (이미 적어 둔 곳이 끊기지 않게) |

**주소에 `.html` 을 붙이지 않는다.** GitHub Pages 는 `/terms` 를 `terms.html` 로 돌려주고, 같은 이름의
폴더(`terms/`)가 있어도 파일을 먼저 본다. 그래서 첫 페이지는 `privacy/index.md` 가 아니라 `privacy.md` 다 —
폴더 index 로 두면 `/privacy` 가 `/privacy/` 로 한 번 더 넘어간다. 페이지 안 링크도 전부 `.html` 없이 쓴다.
`terms.html` 처럼 붙여 적어도 같은 파일이라 그대로 열린다. 끝에 `/` 를 붙이면 폴더로 가므로 폴더 안에도
첫 페이지 사본(`privacy/index.md`)을 둔다 — 예전 사이트가 `/privacy` 를 `/privacy/` 로 301 했던 것을 브라우저가
기억하고 있으면 사본이 없을 때 404 가 뜬다.

## 손으로 고치지 않는다

`*.md` 와 `data/` 는 `scripts/build.ts` 가 만든다. 방침을 고치려면 앱 레포
[nostra-team/nostra](https://github.com/nostra-team/nostra) 의 **`shared/legal/<문서>/<시행일>[.en].json`**
을 고친다 — 그 레포의 수집 CI 가 [nostra-data](https://nostra-team.github.io/nostra-data/legal/index.json)
로 올리고, 이 레포는 그 공개된 판만 읽는다 (비밀 키 불필요).

```
shared/legal (nostra) ──CI──▶ nostra-data/legal (공개 JSON) ──build.ts──▶ *.md · data/ ──Jekyll──▶ Pages
```

## 어떻게 만들어지나

| 파일 | 역할 |
|---|---|
| `scripts/build.ts` | 공개 판을 받아 `index.md` · `terms.md`(오늘 효력 있는 판), `privacy/`·`terms/<시행일>.md` (+ `en/`), `data/`, `changes.md` 를 쓴다 |
| `src/compare.ts` → `assets/compare.js` | 변경 내용 비교 화면 |
| `src/picker.ts` → `assets/picker.js` | 시행일 드롭다운 — 바깥 클릭 · Esc 로 닫기만 (열고 닫기는 `<details>` 가 스스로) |
| `src/legal.d.ts` | 방침 한 판의 타입 (`LegalBlock`) — 빌드와 화면이 함께 쓴다 |
| `_layouts/` · `assets/site.css` | 머리(제목 · 드롭다운 · 링크)와 모양. Markdown 본문에는 방침 글자만 있다 |

- **TypeScript, 런타임 의존성 0.** 빌드 스크립트는 Node 22 의 `--experimental-strip-types` 로 타입만
  지우고 돌린다. 개발 의존성은 `typescript` · `@types/node` 둘이고 버전은 고정한다 (`^` · `~` 금지).
- **`assets/*.js` 는 커밋하지 않는다** (`.gitignore`). Pages 워크플로가 배포 직전에 `npm run build:assets`
  로 만든다. 커밋되는 생성물은 매일 바뀔 수 있는 `*.md` · `data/` 뿐이다.
- **"오늘 효력 있는 판" 은 만든 날 기준이다.** 그래서 `.github/workflows/pages.yml` 이 **매일 00:10 KST**
  에 타입 검사 → 다시 만들기 → (바뀌었으면 커밋) → 화면 스크립트 컴파일 → 배포한다.
  새 판의 시행일이 되면 그날 첫 페이지가 그 판으로 바뀐다.

### 변경 내용 비교

`changes` 는 `data/<문서>/<시행일>[.en].json` (페이지와 같은 글자) 두 개를 받아:

1. 판을 줄(조항 제목 · 문단 · 목록 한 줄) 단위로 펴고 LCS 로 맞댄다.
2. 바뀐 줄 덩어리 안에서 지운 줄 · 더한 줄을 짝짓는다 — 낱말이 40% 넘게 같으면 **수정**, 아니면 **삭제** · **추가**.
3. 수정된 줄 안은 낱말 단위 LCS 로 지운 말(빨간 취소선) · 더한 말(초록)을 칠한다.
4. 같은 조항의 바뀐 곳은 한 카드로 묶는다. 모바일에서는 이전 · 이후가 위아래로 쌓인다.

각 판 페이지의 "이전 판과 달라진 점 →" 이 바로 앞 판과의 비교로 연결된다.
한계: 한 조항 안에 비슷한 줄이 여럿이면 수정 짝이 가장 가까운 줄이 아닐 수 있다 (내용이 빠지지는 않고 삭제 · 추가로 보인다).

## 로컬에서

```bash
npm ci
npm run build                          # 공개된 판으로 다시 만들기
npm run build -- --today 2026-11-01    # 그날 기준으로 미리 보기
npm run typecheck                      # 빌드 스크립트 + 화면 스크립트 타입 검사
npm run build:assets                   # src/*.ts → assets/*.js

# 미리 보기 (Jekyll 이 있을 때). 로컬 서버는 같은 이름의 폴더를 먼저 봐서 /privacy 가 /privacy/ 로 넘어간다 —
# 로컬에서는 /privacy.html 로 연다. GitHub Pages 는 파일을 먼저 본다 (/terms → terms.html, 실측).
jekyll serve   # http://127.0.0.1:4000/privacy.html
```
