# nostra-policy

**Nostra - 로또의 모든것** 앱의 개인정보처리방침 · 이용약관 공개 페이지 (GitHub Pages).

| 주소 | 내용 |
|---|---|
| https://nostra-team.github.io/nostra-policy/ | 개인정보처리방침 |
| https://nostra-team.github.io/nostra-policy/terms.html | 이용약관 |
| https://nostra-team.github.io/nostra-policy/en/ | Privacy Policy (English) |
| https://nostra-team.github.io/nostra-policy/en/terms.html | Terms of Service (English) |

첫 줄 주소를 Google Play Console 과 App Store Connect 의 개인정보처리방침 URL 에 넣는다.

## 손으로 고치지 않는다

이 페이지들은 앱 레포 [nostra-team/nostra](https://github.com/nostra-team/nostra) 의
`shared/legal/<문서>/<시행일>[.en].json` — **앱 안의 방침과 같은 원본** — 에서 만든다.

```bash
cd ../nostra
python3 shared/scripts/build_policy_site.py --out ../nostra-policy          # 만들기
python3 shared/scripts/build_policy_site.py --out ../nostra-policy --check  # 어긋났는지만
```

모든 시행일 판이 한 페이지에 들어 있고, 페이지의 작은 스크립트가 **오늘 효력 있는 판**을
펼친다(시행 예정 판은 "시행 예정" 딱지). 시행일이 지났다고 다시 올릴 필요가 없다 —
**새 판을 원본에 더했을 때만** 다시 만든다. `#v-2026-11-01` 처럼 판을 직접 가리킬 수 있다.
