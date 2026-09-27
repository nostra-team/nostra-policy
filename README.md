# nostra-policy

**Nostra - 로또의 모든것** 앱의 개인정보처리방침 · 이용약관 공개 페이지 (GitHub Pages · Markdown).

| 주소 | 내용 |
|---|---|
| https://nostra-team.github.io/nostra-policy/ | 개인정보처리방침 — **오늘 효력 있는 판** |
| https://nostra-team.github.io/nostra-policy/terms.html | 이용약관 |
| https://nostra-team.github.io/nostra-policy/en/ · `en/terms.html` | 영어판 |
| `privacy/<시행일>.html` · `terms/<시행일>.html` (+ `en/`) | 시행일별 모든 판 |

첫 줄 주소를 Google Play Console 과 App Store Connect 의 개인정보처리방침 URL 에 넣는다.

## 손으로 고치지 않는다

`*.md` 는 `scripts/build.py` 가 만든다. 원본은 앱 레포 [nostra-team/nostra](https://github.com/nostra-team/nostra)
의 `shared/legal/` — **앱 안의 방침과 같은 글자** — 이고, 그 수집 CI 가
[nostra-data](https://nostra-team.github.io/nostra-data/legal/index.json) 로 올린 판을 읽는다.

```bash
python3 scripts/build.py                     # 공개된 판으로 다시 만들기
python3 scripts/build.py --today 2026-11-01  # 그날 기준으로 미리 보기
```

`.github/workflows/pages.yml` 이 **매일 00:10 KST** 에 다시 만들어 배포한다 — 새 판의
시행일이 되면 그날 첫 페이지가 그 판으로 바뀐다. 방침을 고치려면 앱 레포의 `shared/legal/` 을 고친다.
