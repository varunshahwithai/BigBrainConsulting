"""Builds the website into /public from the parts in /src.

Run:  python3 tools/build.py
"""
import json, os, re, datetime
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "src")
OUT = os.path.join(ROOT, "public")
read = lambda f: open(os.path.join(SRC, f), encoding="utf-8").read()
os.makedirs(OUT, exist_ok=True)

# 1. the main site: page layout + both tools' code in one file
h = read("head.html")
a = h.index('\n  <div id="ops" hidden>'); b = h.index('\n  <footer>')
h = h[:a] + "\n" + read("opshead.html") + h[b:]
strip = lambda t: "\n".join(l for l in t.split("\n") if not l.startswith('if(typeof module!=="undefined")module.exports'))
parts = ["engine.js", "ui.js", "ai.js", "tour.js", "opsengine.js", "opsui.js", "opsai.js", "opstour.js"]
js = "".join((lambda t: t if t.endswith("\n") else t + "\n")(strip(read(f))) for f in parts)
head_tags = ('<!doctype html>\n<html lang="en-GB">\n<head>\n<meta charset="utf-8">\n'
             '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
             '<meta name="description" content="Free consulting tools for small businesses: test prices and market entry, and find the bottleneck in your operations.">\n')
title_end = h.index("</title>") + len("</title>")
page = head_tags + h[:title_end] + "\n</head>\n<body>\n" + h[title_end:].lstrip("\n").rstrip("\n") + "\n<script>\n" + js + "</script>\n</body>\n</html>\n"
open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(page)

# 2. privacy and admin pages
cfg = json.load(open(os.path.join(ROOT, "site.json"), encoding="utf-8"))
contact = cfg.get("contact") or "(contact email to be added)"
if not cfg.get("contact"):
    print("WARNING: site.json has no contact email yet; the privacy page shows a placeholder.")
p = read("privacy.html").replace("__OWNER__", cfg.get("owner") or "BBC – Big Brain Consulting").replace("__CONTACT__", contact)
p = p.replace("__UPDATED__", datetime.date.today().strftime("%-d %B %Y"))
open(os.path.join(OUT, "privacy.html"), "w", encoding="utf-8").write(p)
open(os.path.join(OUT, "admin.html"), "w", encoding="utf-8").write(read("admin.html"))
print("Built public/index.html, public/privacy.html, public/admin.html")
