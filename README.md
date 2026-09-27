# nostra-policy

**Nostra - 로또의 모든것** 앱의 개인정보처리방침 · 이용약관 공개 페이지 (GitHub Pages · Markdown).

| 주소 | 내용 |
|---|---|
| https://nostra-team.github.io/nostra-policy/ | 개인정보처리방침 — **오늘 효력 있는 판** |
| https://nostra-team.github.io/nostra-policy/terms.html | 이용약관 |
| https://nostra-team.github.io/nostra-policy/en/ · `en/terms.html` | 영어판 |
| `privacy/<시행일>.html` · `terms/<시행일>.html` (+ `en/`) | 시행일별 모든 판 — 위쪽 드롭다운으로 판을 바꾼다 |
| `changes.html?doc=privacy&from=<이전>&to=<이후>` (+ `en/`) | 두 판에서 **바뀐 줄만** 이전·이후로 |

첫 줄 주소를 Google Play Console 과 App Store Connect 의 개인정보처리방침 URL 에 넣는다.

## 화면

- **시행일 선택** — `_layouts/policy.html`. `<details>` 라 스크립트 없이도 열리고, 항목은 그 판 페이지로 가는 링크다.
  목록·딱지(현행·시행 예정)는 `build.py` 가 front matter 로 넣는다.
- **변경 내용 비교** — `_layouts/compare.html` + `assets/compare.js`. `data/<문서>/<시행일>[.en].json`
  (페이지와 같은 글자)을 두 개 받아 줄 단위로 맞대고, 바뀐 줄 안에서는 지운 말·더한 말을 칠한다.
  각 판 페이지의 "이전 판과 달라진 점" 이 바로 앞 판과의 비교로 연결된다.

미리 보기: `jekyll build && python3 -m http.server -d _site`

## 손으로 고치지 않는다

`*.md` 와 `data/` 는 `scripts/build.py` 가 만든다. 원본은 앱 레포 [nostra-team/nostra](https://github.com/nostra-team/nostra)
의 `shared/legal/` — **앱 안의 방침과 같은 글자** — 이고, 그 수집 CI 가
[nostra-data](https://nostra-team.github.io/nostra-data/legal/index.json) 로 올린 판을 읽는다.

```bash
python3 scripts/build.py                     # 공개된 판으로 다시 만들기
python3 scripts/build.py --today 2026-11-01  # 그날 기준으로 미리 보기
```

`.github/workflows/pages.yml` 이 **매일 00:10 KST** 에 다시 만들어 배포한다 — 새 판의
시행일이 되면 그날 첫 페이지가 그 판으로 바뀐다. 방침을 고치려면 앱 레포의 `shared/legal/` 을 고친다.
