#!/usr/bin/env python3
"""Validate the public static package using the Python standard library."""
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import hashlib
import json
import re
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
errors = []


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.links = []
        self.images = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            if attrs["id"] in self.ids:
                errors.append(f"Duplicate HTML id: {attrs['id']}")
            self.ids.add(attrs["id"])
        for key in ("href", "src"):
            if attrs.get(key):
                self.links.append(attrs[key])
        if tag == "img":
            self.images.append(attrs)


pages = {}
for path in DOCS.rglob("*.html"):
    page = Page()
    page.feed(path.read_text(encoding="utf-8"))
    pages[path.resolve()] = page
for path, page in pages.items():
    for link in page.links:
        parsed = urlsplit(link)
        if parsed.scheme or parsed.netloc:
            continue
        target = (path.parent / unquote(parsed.path)).resolve() if parsed.path else path
        if target.is_dir():
            target /= "index.html"
        if not target.is_file():
            errors.append(f"Missing local link: {path.relative_to(ROOT)} -> {link}")
        elif parsed.fragment and target in pages and unquote(parsed.fragment) not in pages[target].ids:
            errors.append(f"Missing anchor: {path.relative_to(ROOT)} -> {link}")
    for attrs in page.images:
        if not attrs.get("alt"):
            errors.append(f"Image is missing alt text: {path.relative_to(ROOT)} {attrs.get('src')}")

catalogue = json.loads((DOCS / "data/catalogue.json").read_text(encoding="utf-8"))
project = json.loads((DOCS / "data/project.json").read_text(encoding="utf-8"))
entries = catalogue["entries"]
expected = {"assets": 52, "scenes": 49, "temporal": 72, "xr": 31, "resources": 37}
assert Counter(item["category"] for item in entries) == expected, "Catalogue category counts changed"
assert len({item["id"] for item in entries}) == len(entries) == 241
# Holodeck (method B13) and its NoveltyTHOR benchmark (resource R34)
# are distinct catalogue records supported by the same source paper.
assert len({item["bibkey"] for item in entries if item["category"] != "resources"}) == 204
duplicates = {key: [item["id"] for item in entries if item["bibkey"] == key]
              for key, count in Counter(item["bibkey"] for item in entries).items() if count > 1}
assert duplicates == {"Yang2024Holodeck": ["B13", "R34"]}, duplicates
assert project["title"] == "Visual Generative AI for Extended Reality: A Survey"
for entry in entries:
    for key in ("id", "name", "title", "category", "bibkey", "year", "paper_url"):
        if not entry.get(key):
            errors.append(f"Missing {key} in {entry.get('id')}")
    for key in ("paper_url", "project_url", "url"):
        if entry.get(key) and urlsplit(entry[key]).scheme not in ("http", "https"):
            errors.append(f"Invalid URL: {entry['id']} {key}")
    if re.search(r"\\(?:textbf|emph|cite|href)\b", entry["title"]):
        errors.append(f"Unconverted TeX: {entry['id']}")

config = json.loads((DOCS / "site-config.json").read_text(encoding="utf-8"))
manifest = json.loads((DOCS / "evidence/manifest.json").read_text(encoding="utf-8"))
for relative_path, expected_hash in manifest["file_sha256"].items():
    actual_hash = hashlib.sha256((DOCS / "evidence" / relative_path).read_bytes()).hexdigest()
    if actual_hash != expected_hash:
        errors.append(f"Evidence release hash mismatch: {relative_path}")
if config.get("repository"):
    assert urlsplit(config["repository"]).hostname == "github.com"
if config.get("homepage"):
    assert urlsplit(config["homepage"]).scheme == "https"
manuscript_extensions = {".pdf", ".tex", ".ltx", ".doc", ".docx", ".odt", ".rtf"}
for path in DOCS.rglob("*"):
    if not path.is_file():
        continue
    if path.suffix.lower() in manuscript_extensions:
        errors.append(f"Manuscript files are forbidden in the public package: {path.relative_to(ROOT)}")
    if path.stat().st_size >= 100 * 1024 * 1024:
        errors.append(f"File exceeds GitHub file limit: {path.relative_to(ROOT)}")

if errors:
    raise SystemExit("Validation failed:\n- " + "\n- ".join(errors))
size = sum(p.stat().st_size for p in DOCS.rglob("*") if p.is_file())
print(f"PASS: {len(pages)} HTML pages; local paths and anchors valid; image alt text present")
print(f"PASS: {len(entries)} unique catalogue records; category counts {expected}")
print(f"PASS: public package {size / 1024 / 1024:.2f} MiB; all files below GitHub size limit")
print("PASS: public package contains no PDF, LaTeX, or word-processing manuscript files")
