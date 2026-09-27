#!/usr/bin/env python3
"""방침·약관 Markdown 페이지 — nostra-data 에 공개된 판(legal/)에서 만든다.

    python3 scripts/build.py                 # CDN 에서 받아 만든다
    python3 scripts/build.py --today 2026-11-01   # 그날 기준으로 (확인용)

원본은 앱 레포(nostra-team/nostra)의 `shared/legal/` 이고, 그 수집 CI 가 nostra-data 로 올린다.
이 레포는 **공개된 판만 읽으므로** 비밀 키가 필요 없다. 앱 안의 방침과 같은 글자다.

    index.md · terms.md           오늘 효력 있는 판 (Play Console · App Store 에 넣는 주소)
    en/index.md · en/terms.md     영어판
    privacy/<시행일>.md · terms/<시행일>.md (+ en/)   시행일별 모든 판

"오늘 효력 있는 판" 은 만든 날 기준이다 — 그래서 `.github/workflows/pages.yml` 이 **매일** 다시 만든다.
시행일이 되면 그날 새 판이 첫 페이지로 올라간다.
"""

import argparse
import datetime
import json
import pathlib
import re
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = "https://nostra-team.github.io/nostra-data/legal"
CONTACT = "psj06201@gmail.com"

L = {
    "ko": {"privacy": "개인정보처리방침", "terms": "이용약관", "effective": "시행일", "current": "현행",
           "upcoming": "시행 예정", "past": "지난 판", "versions": "시행일별 판",
           "upcomingNote": "이 판은 아직 시행 전입니다. 시행일부터 적용됩니다.",
           "nextNote": "개정판이 **{0}** 부터 시행됩니다 → [{0} 판]({1})",
           "contact": "문의", "other": "English", "app": "Nostra - 로또의 모든것"},
    "en": {"privacy": "Privacy Policy", "terms": "Terms of Service", "effective": "Effective", "current": "Current",
           "upcoming": "Upcoming", "past": "Previous", "versions": "All versions",
           "upcomingNote": "This version is not yet in effect. It applies from its effective date.",
           "nextNote": "A revised version takes effect on **{0}** → [{0} version]({1})",
           "contact": "Contact", "other": "한국어", "app": "Nostra"},
}


def fetch(path: str):
    with urllib.request.urlopen(f"{BASE}/{path}", timeout=20) as r:
        return json.loads(r.read().decode("utf-8"))


def md_escape(text: str) -> str:
    # 목록·제목으로 잘못 읽히는 줄머리와 밑줄·별표만 막는다. 주소는 그대로 두면 GitHub 가 링크로 만든다.
    return re.sub(r"([*_`])", r"\\\1", text)


def body(blocks: list) -> str:
    out = []
    for b in blocks:
        if b.get("heading"):
            out.append(f"## {md_escape(b['heading'])}\n")
        for p in b.get("body", []):
            out.append(md_escape(p) + "\n")
        if b.get("bullets"):
            out.append("\n".join(f"- {md_escape(x)}" for x in b["bullets"]) + "\n")
        for it in b.get("items", []):
            out.append(f"### {md_escape(it['title'])}\n")
            out.append("\n".join(f"- {md_escape(x)}" for x in it["lines"]) + "\n")
    return "\n".join(out)


def page(doc: str, lang: str, eff: str, blocks: list, dates: list, today: str, depth: int, is_front: bool) -> str:
    t = L[lang]
    up = "../" * depth
    title = t[doc]
    cur = max([d for d in dates if d <= today], default=min(dates))
    langdir = "" if lang == "ko" else "en/"
    other = "en/" if lang == "ko" else ""

    def link(d: str) -> str:
        return f"{up}{langdir}{doc}/{d}.html"

    label = lambda d: t["current"] if d == cur else (t["upcoming"] if d > today else t["past"])
    lines = [
        "---",
        f"title: {title} · Nostra",
        f"lang: {lang}",
        "---",
        "",
        f"**{t['app']}**",
        "",
        f"# {title}",
        "",
        f"[{t['terms'] if doc == 'privacy' else t['privacy']}]({up}{langdir}{'terms.html' if doc == 'privacy' else 'index.html'}) · "
        f"[{t['other']}]({up}{other}{'index.html' if doc == 'privacy' else 'terms.html'})",
        "",
        f"**{t['effective']}: {eff}** ({label(eff)})",
        "",
    ]
    if eff > today:
        lines += [f"> {t['upcomingNote']}", ""]
    nxt = sorted(d for d in dates if d > today)
    if is_front and nxt:
        lines += [f"> {t['nextNote'].format(nxt[0], link(nxt[0]))}", ""]
    lines += [body(blocks), "---", "", f"### {t['versions']}", ""]
    lines += [f"- [{d}]({link(d)}) — {label(d)}" for d in dates]
    lines += ["", f"{t['contact']}: [{CONTACT}](mailto:{CONTACT})", ""]
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--today", default=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).date().isoformat())
    args = ap.parse_args()
    index = fetch("index.json")
    written = []
    for doc in ("privacy", "terms"):
        dates = sorted(index.get(doc, []), reverse=True)
        if not dates:
            print(f"✗ {doc} 판이 없습니다", file=sys.stderr)
            return 1
        cur = max([d for d in dates if d <= args.today], default=min(dates))
        for lang in ("ko", "en"):
            texts = {}
            for d in dates:
                try:
                    texts[d] = fetch(f"{doc}/{d}{'' if lang == 'ko' else '.en'}.json")
                except Exception:
                    texts[d] = fetch(f"{doc}/{d}.json")  # 번역이 없는 판은 원문
            base = ROOT if lang == "ko" else ROOT / "en"
            for d in dates:
                p = base / doc / f"{d}.md"
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text(page(doc, lang, d, texts[d], dates, args.today, 1 if lang == "ko" else 2, False))
                written.append(p)
            front = base / ("index.md" if doc == "privacy" else "terms.md")
            front.write_text(page(doc, lang, cur, texts[cur], dates, args.today, 0 if lang == "ko" else 1, True))
            written.append(front)
    for p in written:
        print(f"→ {p.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
