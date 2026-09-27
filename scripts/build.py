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
           "upcoming": "시행 예정", "past": "지난 판",
           "upcomingNote": "이 판은 아직 시행 전입니다. 시행일부터 적용됩니다.",
           "nextNote": "개정판이 **{0}** 부터 시행됩니다 → [{0} 판]({1})",
           "compare": "이전 판과 달라진 점", "compareTitle": "변경 내용 비교", "before": "이전", "after": "이후",
           "contact": "문의", "other": "English", "app": "Nostra - 로또의 모든것"},
    "en": {"privacy": "Privacy Policy", "terms": "Terms of Service", "effective": "Effective", "current": "Current",
           "upcoming": "Upcoming", "past": "Previous",
           "upcomingNote": "This version is not yet in effect. It applies from its effective date.",
           "nextNote": "A revised version takes effect on **{0}** → [{0} version]({1})",
           "compare": "What changed from the previous version", "compareTitle": "Compare versions",
           "before": "Before", "after": "After",
           "contact": "Contact", "other": "한국어", "app": "Nostra"},
}


def dot(d: str, lang: str) -> str:
    """2026-11-01 → 2026. 11. 01 (한국어 표기). 영어는 ISO 그대로."""
    return d.replace("-", ". ") if lang == "ko" else d


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


def yq(text: str) -> str:
    """front matter 문자열 — 따옴표로 감싸 YAML 이 콜론·샵을 먹지 않게."""
    return json.dumps(text, ensure_ascii=False)


def page(doc: str, lang: str, eff: str, blocks: list, dates: list, today: str, depth: int, is_front: bool) -> str:
    """판 하나. 머리(제목·시행일 선택·링크)는 `_layouts/policy.html` 이 front matter 로 그린다.
    Markdown 본문은 방침 글자만 — GitHub 에서 파일로 열어도 읽히게."""
    t = L[lang]
    up = "../" * depth
    cur = max([d for d in dates if d <= today], default=min(dates))
    langdir = "" if lang == "ko" else "en/"
    other = "en/" if lang == "ko" else ""

    def link(d: str) -> str:
        return f"{up}{langdir}{doc}/{d}.html"

    status = lambda d: "current" if d == cur else ("upcoming" if d > today else "past")
    older = [d for d in dates if d < eff]
    other_doc = "terms" if doc == "privacy" else "privacy"
    fm = [
        "---",
        "layout: policy",
        f"root: {yq(up)}",
        f"title: {yq(t[doc] + ' · Nostra')}",
        f"heading: {yq(t[doc])}",
        f"app: {yq(t['app'])}",
        f"lang: {lang}",
        f"doc: {doc}",
        f"effective: {yq(eff)}",
        f"effective_label: {yq(dot(eff, lang))}",
        f"status: {status(eff)}",
        f"status_label: {yq(t[status(eff)])}",
        f"other_doc: {yq(t[other_doc])}",
        f"other_doc_url: {yq(up + langdir + ('terms.html' if doc == 'privacy' else 'index.html'))}",
        f"other_lang: {yq(t['other'])}",
        f"other_lang_url: {yq(up + other + ('index.html' if doc == 'privacy' else 'terms.html'))}",
        f"effective_word: {yq(t['effective'])}",
        f"contact_word: {yq(t['contact'])}",
        f"contact: {yq(CONTACT)}",
    ]
    if older:
        # 바로 앞 판과 견준다 — 개정 고지에서 사람들이 묻는 것이 "무엇이 바뀌었나" 다
        fm += [f"compare_label: {yq(t['compare'])}",
               f"compare_url: {yq(f'{up}{langdir}changes.html?doc={doc}&from={older[0]}&to={eff}')}"]
    fm += ["versions:"]
    for d in dates:
        fm += [f"  - date: {yq(d)}", f"    label: {yq(dot(d, lang))}", f"    status: {status(d)}",
               f"    status_label: {yq(t[status(d)])}", f"    url: {yq(link(d))}"]
    fm += ["---", ""]
    lines = []
    if eff > today:
        lines += [f"> {t['upcomingNote']}", ""]
    nxt = sorted(d for d in dates if d > today)
    if is_front and nxt:
        lines += [f"> {t['nextNote'].format(nxt[0], link(nxt[0]))}", ""]
    lines += [body(blocks)]
    return "\n".join(fm + lines)


def compare_page(lang: str, depth: int) -> str:
    """변경 내용 비교 — 본문은 `assets/compare.js` 가 data/ 의 판 두 개를 받아 그린다."""
    t = L[lang]
    up = "../" * depth
    fm = {
        "layout": "compare", "title": f"{t['compareTitle']} · Nostra", "heading": t["compareTitle"],
        "app": t["app"], "lang": lang, "root": up, "privacy_word": t["privacy"], "terms_word": t["terms"],
        "before_word": t["before"], "after_word": t["after"], "back_url": up + ("" if lang == "ko" else "en/") + "index.html",
        "other_lang": t["other"], "other_lang_url": up + ("en/" if lang == "ko" else "") + "changes.html",
        "contact_word": t["contact"], "contact": CONTACT,
    }
    return "---\n" + "".join(f"{k}: {yq(v)}\n" for k, v in fm.items()) + "---\n"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--today", default=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).date().isoformat())
    args = ap.parse_args()
    index = fetch("index.json")
    written = []
    listing = {}  # data/index.json — 비교 화면의 판 목록

    def put(p: pathlib.Path, text: str) -> None:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text)
        written.append(p)

    for doc in ("privacy", "terms"):
        dates = sorted(index.get(doc, []), reverse=True)
        if not dates:
            print(f"✗ {doc} 판이 없습니다", file=sys.stderr)
            return 1
        cur = max([d for d in dates if d <= args.today], default=min(dates))
        listing[doc] = [{"date": d, "status": "current" if d == cur else "upcoming" if d > args.today else "past"}
                        for d in dates]
        for lang in ("ko", "en"):
            texts = {}
            for d in dates:
                try:
                    texts[d] = fetch(f"{doc}/{d}{'' if lang == 'ko' else '.en'}.json")
                except Exception:
                    texts[d] = fetch(f"{doc}/{d}.json")  # 번역이 없는 판은 원문
            base = ROOT if lang == "ko" else ROOT / "en"
            for d in dates:
                put(base / doc / f"{d}.md", page(doc, lang, d, texts[d], dates, args.today, 1 if lang == "ko" else 2, False))
                # 비교 화면이 읽는 원본 — 페이지와 같은 글자를 같은 곳에서 (CDN 이 바뀌어도 이 사본과 견준다)
                put(ROOT / "data" / doc / f"{d}{'' if lang == 'ko' else '.en'}.json",
                    json.dumps(texts[d], ensure_ascii=False, indent=1) + "\n")
            front = base / ("index.md" if doc == "privacy" else "terms.md")
            put(front, page(doc, lang, cur, texts[cur], dates, args.today, 0 if lang == "ko" else 1, True))
    put(ROOT / "data" / "index.json", json.dumps(listing, ensure_ascii=False, indent=1) + "\n")
    put(ROOT / "changes.md", compare_page("ko", 0))
    put(ROOT / "en" / "changes.md", compare_page("en", 1))
    for p in written:
        print(f"→ {p.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
