#!/usr/bin/env python3
"""
Heads-up for new Pokémon Sleep announcements. Reads the official news list
(https://www.pokemonsleep.net/en/news/, no RSS feed), compares it with the
post ids seen last time, and prints the new posts as Markdown.

    python3 scripts/watch_news.py SEEN_JSON OUT_MD

SEEN_JSON is the state file (the daily job keeps it in the Actions cache).
With no state file yet, it records what's there and reports nothing, so the
first run doesn't ping about every old post. Exits 1 if the page yields no
posts, which means the layout changed and the parser needs a look.
"""
import html
import json
import re
import sys
import urllib.request
from pathlib import Path

URL = "https://www.pokemonsleep.net/en/news/"

ITEM = re.compile(r'<a class="banner_2" href="(?P<url>https://www\.pokemonsleep\.net/en/news/(?P<id>\d+)/)">(?P<body>.*?)</a>', re.S)
TITLE = re.compile(r'class="banner_2__title">(.*?)</p>', re.S)
CATEGORY = re.compile(r'class="banner_2__category">.*?<span[^>]*>(.*?)</span>', re.S)
DATE = re.compile(r'<time[^>]*datetime="([^"]+)"')


def text(m: re.Match | None) -> str:
    return html.unescape(re.sub(r"\s+", " ", m.group(1))).strip() if m else ""


def main() -> int:
    seen_path, out_path = Path(sys.argv[1]), Path(sys.argv[2])
    req = urllib.request.Request(URL, headers={"User-Agent": "pleep-matchmaker news watch"})
    page = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")

    posts = []
    for m in ITEM.finditer(page):
        body = m.group("body")
        posts.append({
            "id": m.group("id"),
            "url": m.group("url"),
            "title": text(TITLE.search(body)),
            "category": text(CATEGORY.search(body)),
            "date": text(DATE.search(body)),
        })
    if not posts:
        print("No posts found on the news page; its layout may have changed.", file=sys.stderr)
        return 1

    first_run = not seen_path.exists()
    seen = set() if first_run else set(json.loads(seen_path.read_text()))
    new = [p for p in posts if p["id"] not in seen]
    seen_path.write_text(json.dumps(sorted(seen | {p["id"] for p in posts})) + "\n")

    if first_run or not new:
        print(f"{len(posts)} posts, {'first run, recorded' if first_run else 'nothing new'}")
        out_path.write_text("")
        return 0

    lines = [f"- **{p['title']}** ({p['category']}, {p['date']})\n  {p['url']}" for p in new]
    out_path.write_text("\n".join(lines) + "\n")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main())
