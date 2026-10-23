#!/usr/bin/env python3
"""Validate the public static package using the Python standard library."""
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import hashlib
import json
import math
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
        # An explicitly empty alt marks a decorative image. Missing alt does not.
        if "alt" not in attrs or attrs["alt"] is None:
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


def valid_source_url(value):
    if not isinstance(value, str):
        return False
    parsed = urlsplit(value)
    return (parsed.scheme in ("http", "https") and bool(parsed.hostname)
            and not parsed.username and not parsed.password
            and not re.search(r"\s", value))


showcase = json.loads((DOCS / "data/showcase.json").read_text(encoding="utf-8"))
showcase_ids = set()
showcase_groups = set()
for group in showcase["groups"]:
    group_id = group.get("id")
    if group_id not in expected or group_id == "resources":
        errors.append(f"Unknown showcase group: {group_id}")
    if group_id in showcase_groups:
        errors.append(f"Duplicate showcase group: {group_id}")
    showcase_groups.add(group_id)
    for item in group["items"]:
        item_id = item.get("id")
        if not item_id or item_id in showcase_ids:
            errors.append(f"Missing or duplicate showcase id: {item_id}")
        showcase_ids.add(item_id)
        for key in ("alt", "title", "attribution", "sourceAnchor"):
            if not isinstance(item.get(key), str) or not item[key].strip():
                errors.append(f"Missing showcase {key}: {item_id}")
        for key in ("sourceUrl", "licenseUrl"):
            if (key == "sourceUrl" or key in item) and not valid_source_url(item.get(key)):
                errors.append(f"Invalid showcase {key}: {item_id}")
        for key in ("width", "height"):
            if type(item.get(key)) is not int or item[key] <= 0:
                errors.append(f"Invalid showcase {key}: {item_id}")
        for key in ("sourceImageSha256", "imageSha256"):
            if not isinstance(item.get(key), str) or not re.fullmatch(r"[0-9a-f]{64}", item[key]):
                errors.append(f"Invalid showcase {key}: {item_id}")
        image = item.get("image")
        if not isinstance(image, str) or not image:
            errors.append(f"Missing showcase image path: {item_id}")
            continue
        parsed = urlsplit(image)
        target = (DOCS / unquote(parsed.path)).resolve()
        if (parsed.scheme or parsed.netloc or parsed.query or parsed.fragment
                or not target.is_relative_to(DOCS.resolve())):
            errors.append(f"Showcase image must be a local public asset: {item_id} -> {image}")
        elif not target.is_file():
            errors.append(f"Missing showcase image: {item_id} -> {image}")
        else:
            actual_hash = hashlib.sha256(target.read_bytes()).hexdigest()
            if actual_hash != item.get("imageSha256"):
                errors.append(f"Showcase image hash mismatch: {item_id} -> {image}")

def webp_dimensions(data):
    """Read WebP canvas dimensions without adding an image-library CI dependency."""
    if len(data) < 20 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        return None
    offset = 12
    while offset + 8 <= len(data):
        chunk_type = data[offset:offset + 4]
        chunk_size = int.from_bytes(data[offset + 4:offset + 8], "little")
        payload = data[offset + 8:offset + 8 + chunk_size]
        if len(payload) != chunk_size:
            return None
        if chunk_type == b"VP8X" and len(payload) >= 10:
            return (1 + int.from_bytes(payload[4:7], "little"),
                    1 + int.from_bytes(payload[7:10], "little"))
        if chunk_type == b"VP8 " and len(payload) >= 10 and payload[3:6] == b"\x9d\x01\x2a":
            return (int.from_bytes(payload[6:8], "little") & 0x3fff,
                    int.from_bytes(payload[8:10], "little") & 0x3fff)
        if chunk_type == b"VP8L" and len(payload) >= 5 and payload[0] == 0x2f:
            packed = int.from_bytes(payload[1:5], "little")
            return (1 + (packed & 0x3fff), 1 + ((packed >> 14) & 0x3fff))
        offset += 8 + chunk_size + (chunk_size % 2)
    return None


# Official source/media routes were manually verified when these demos were
# selected. CI validates the published manifest and local posters offline.
official_video_routes = {
    "TRELLIS": ("https://microsoft.github.io/TRELLIS/", "https://microsoft.github.io/TRELLIS/assets/"),
    "LGM": ("https://me.kiui.moe/lgm/", "https://me.kiui.moe/lgm/videos/"),
    "SceneScape": ("https://scenescape.github.io/", "https://scenescape.github.io/sm/assets/"),
    "ViewCrafter": ("https://drexubery.github.io/ViewCrafter/", "https://drexubery.github.io/ViewCrafter/static/videos/"),
    "4D-fy": ("https://sherwinbahmani.github.io/4dfy/", "https://sherwinbahmani.github.io/4dfy/data/videos/"),
    "WorldPlay": ("https://github.com/Tencent-Hunyuan/HY-WorldPlay", "https://3d-models.hunyuan.tencent.com/world/world1_5/"),
    "Dreamcrafter": ("https://dream-crafter.github.io/", "https://dream-crafter.github.io/static/videos/"),
    "Generated Reality": ("https://codeysun.github.io/generated-reality/", "https://codeysun.github.io/generated-reality/static/videos/"),
}
videos = json.loads((DOCS / "data/videos.json").read_text(encoding="utf-8"))
video_ids = set()
video_groups = []
video_count = 0
poster_root = (DOCS / "assets/video-posters").resolve()
for group in videos["groups"]:
    video_groups.append(group.get("id"))
    if len(group["items"]) != 2:
        errors.append(f"Video group must contain two demos: {group.get('id')}")
    for item in group["items"]:
        video_count += 1
        item_id = item.get("id")
        if not isinstance(item_id, str) or not item_id.strip() or item_id in video_ids:
            errors.append(f"Missing or duplicate video id: {item_id}")
        video_ids.add(item_id)
        for key in ("method", "title", "description", "attribution", "sourceLabel", "sourceLocator", "rightsNote"):
            if not isinstance(item.get(key), str) or not item[key].strip():
                errors.append(f"Missing video {key}: {item_id}")
        route = official_video_routes.get(item.get("method"))
        source_url = item.get("sourceUrl")
        video_url = item.get("videoUrl")
        if (not valid_source_url(source_url) or urlsplit(source_url).scheme != "https"
                or not route or source_url != route[0]):
            errors.append(f"Video source must use its verified official HTTPS page: {item_id}")
        if (not valid_source_url(video_url) or urlsplit(video_url).scheme != "https"
                or not route or not video_url.startswith(route[1])
                or not urlsplit(video_url).path.lower().endswith(".mp4")
                or urlsplit(video_url).query or urlsplit(video_url).fragment
                or ".." in unquote(urlsplit(video_url).path).split("/")):
            errors.append(f"Video must use a verified official HTTPS MP4 route: {item_id}")
        if item.get("mimeType") != "video/mp4":
            errors.append(f"Invalid video mimeType: {item_id}")
        if "licenseUrl" in item and not valid_source_url(item["licenseUrl"]):
            errors.append(f"Invalid video licenseUrl: {item_id}")
        for key in ("width", "height", "byteLength"):
            if type(item.get(key)) is not int or item[key] <= 0:
                errors.append(f"Invalid video {key}: {item_id}")
        duration = item.get("durationSeconds")
        if type(duration) not in (int, float) or not math.isfinite(duration) or duration <= 0:
            errors.append(f"Invalid video durationSeconds: {item_id}")
        for key in ("audio", "hasAudioTrack"):
            if type(item.get(key)) is not bool:
                errors.append(f"Video {key} must be boolean: {item_id}")
        if item.get("audio") is True and item.get("hasAudioTrack") is False:
            errors.append(f"Video audio requires an audio track: {item_id}")
        poster = item.get("poster")
        if not isinstance(poster, dict):
            errors.append(f"Missing video poster: {item_id}")
            continue
        for key in ("width", "height"):
            if type(poster.get(key)) is not int or poster[key] <= 0:
                errors.append(f"Invalid video poster {key}: {item_id}")
        if not isinstance(poster.get("sha256"), str) or not re.fullmatch(r"[0-9a-f]{64}", poster["sha256"]):
            errors.append(f"Invalid video poster sha256: {item_id}")
        poster_path = poster.get("path")
        if not isinstance(poster_path, str) or not poster_path:
            errors.append(f"Missing video poster path: {item_id}")
            continue
        parsed = urlsplit(poster_path)
        target = (DOCS / unquote(parsed.path)).resolve()
        if (parsed.scheme or parsed.netloc or parsed.query or parsed.fragment
                or not target.is_relative_to(poster_root) or target.suffix.lower() != ".webp"):
            errors.append(f"Video poster must be inside assets/video-posters: {item_id} -> {poster_path}")
        elif not target.is_file():
            errors.append(f"Missing video poster: {item_id} -> {poster_path}")
        else:
            poster_bytes = target.read_bytes()
            if hashlib.sha256(poster_bytes).hexdigest() != poster.get("sha256"):
                errors.append(f"Video poster hash mismatch: {item_id} -> {poster_path}")
            if webp_dimensions(poster_bytes) != (poster.get("width"), poster.get("height")):
                errors.append(f"Video poster dimensions mismatch: {item_id} -> {poster_path}")
if Counter(video_groups) != Counter({"assets": 1, "scenes": 1, "temporal": 1, "xr": 1}):
    errors.append("Video gallery must contain the four unique domain groups")
if video_count != 8 or len(video_ids) != 8:
    errors.append("Video gallery must contain eight uniquely identified demos")

guide = json.loads((DOCS / "data/research-guide.json").read_text(encoding="utf-8"))
entries_by_id = {item["id"]: item for item in entries}
benchmark_ids = set()
for benchmark in guide["benchmarks"]:
    benchmark_id = benchmark.get("id")
    entry = entries_by_id.get(benchmark_id)
    if benchmark_id in benchmark_ids:
        errors.append(f"Duplicate guide benchmark: {benchmark_id}")
    benchmark_ids.add(benchmark_id)
    if not entry or entry["category"] != "resources":
        errors.append(f"Unknown guide benchmark resource: {benchmark_id}")
        continue
    for key in ("name", "title", "year", "bibkey"):
        if benchmark.get(key) != entry[key]:
            errors.append(f"Guide benchmark {key} disagrees with catalogue: {benchmark_id}")
    if not valid_source_url(benchmark.get("source_link")):
        errors.append(f"Invalid guide benchmark source URL: {benchmark_id}")
    elif benchmark["source_link"] != entry["paper_url"]:
        errors.append(f"Guide benchmark source disagrees with catalogue: {benchmark_id}")

index = pages[(DOCS / "index.html").resolve()]
for route in guide["reading_routes"]:
    for step in route["steps"]:
        target = step.get("target")
        if (not isinstance(target, str) or not target.startswith("#")
                or unquote(target[1:]) not in index.ids):
            errors.append(f"Missing guide route anchor: {route.get('id')} -> {target}")

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
print(f"PASS: {len(showcase_ids)} showcase images; paths, alt text, sources, and hashes valid")
print(f"PASS: {len(video_ids)} videos in four groups; official URLs, metadata, poster dimensions and hashes valid")
print(f"PASS: {len(benchmark_ids)} guide resources match the catalogue; reading-route anchors valid")
print(f"PASS: public package {size / 1024 / 1024:.2f} MiB; all files below GitHub size limit")
print("PASS: public package contains no PDF, LaTeX, or word-processing manuscript files")
