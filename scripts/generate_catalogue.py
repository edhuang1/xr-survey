#!/usr/bin/env python3
"""Build the public catalogue from the survey's checked-in source material.

Standard-library only. Run from any directory:
    python website/scripts/generate_catalogue.py

The manuscript tables determine membership and all descriptive fields. The
bibliography supplies titles and publication metadata. The publication ledger
cross-checks method membership and records the survey's bibliographic-year rule.
No network lookup or generated prose is involved.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse


CATEGORIES = [
    {"id": "assets", "label": "Visual assets", "prefix": "A", "expected": 52,
     "table": "catalogue-assets.tex", "description": "Visual-asset generation and editing methods."},
    {"id": "scenes", "label": "Spatial scenes", "prefix": "B", "expected": 49,
     "table": "catalogue-scenes.tex", "description": "Spatial scene generation and editing methods."},
    {"id": "temporal", "label": "Temporal content & worlds", "prefix": "C", "expected": 72,
     "table": "catalogue-temporal.tex", "description": "Video generation, time-varying 3D content, and action-conditioned worlds."},
    {"id": "xr", "label": "XR systems", "prefix": "X", "expected": 31,
     "table": "catalogue-xr.tex", "description": "XR authoring systems and generated-content presentation methods."},
    {"id": "resources", "label": "Datasets & benchmarks", "prefix": "R", "expected": 37,
     "table": "catalogue-resources.tex", "description": "Datasets, simulators, and evaluation benchmarks used in the review."},
]

INPUT_NAMES = {
    "T": "Text", "I": "Image", "V": "Video", "P": "Camera / pose",
    "G": "Geometry", "L": "Layout / graph / constraints",
    "N": "Latent / random seed", "U": "Unconditional", "A": "Actions",
    "H": "Hand", "S": "Sketch", "Sp": "Speech", "C": "Controller / touch / manipulation",
    "M": "Motion / flow",
}


def balanced(text: str, start: int, opening="{", closing="}") -> tuple[str, int]:
    """Return contents and first position after a balanced brace expression."""
    if text[start] != opening:
        raise ValueError(f"Expected {opening!r} at {start}")
    depth, pos = 1, start + 1
    while pos < len(text):
        char = text[pos]
        if char == "\\":
            pos += 2
            continue
        if char == opening:
            depth += 1
        elif char == closing:
            depth -= 1
            if not depth:
                return text[start + 1:pos], pos + 1
        pos += 1
    raise ValueError(f"Unbalanced expression at {start}")


def macro_args(text: str, name: str, count=1) -> list[str]:
    found = re.search(r"\\" + re.escape(name) + r"\*?(?:\[[^\]]*\])?\s*\{", text)
    if not found:
        return []
    pos, args = found.end() - 1, []
    for _ in range(count):
        while pos < len(text) and text[pos].isspace():
            pos += 1
        value, pos = balanced(text, pos)
        args.append(value)
    return args


def plain(text: str) -> str:
    """Decode the small, explicit LaTeX vocabulary used in source metadata."""
    text = re.sub(r"\\allowbreak\s*", "", text)
    text = text.replace(r"\&", "&").replace(r"\_", "_").replace(r"\%", "%")
    text = text.replace(r"\TblNR", "NR").replace(r"\TblNone", "—").replace(r"\TblYes", "Yes")
    text = text.replace(r"\sim", "≈").replace(r"\to", "→").replace(r"\times", "×")
    text = text.replace(r"\textendash", "–").replace(r"\textemdash", "—")
    text = text.replace(r"\ensuremath{^{\circ}}", "°").replace(r"\ensuremath{^\circ}", "°")
    text = text.replace("$^2$", "²").replace("$", "").replace("~", " ")
    # BibTeX accents, e.g. H{\"o}llein, and common special letters.
    accents = {'"': "\u0308", "'": "\u0301", "`": "\u0300", "^": "\u0302", "~": "\u0303", "v": "\u030c", "c": "\u0327"}
    for accent, combining in accents.items():
        separator = r"(?:\s+|\{)" if accent.isalpha() else r"\s*\{?"
        text = re.sub(r"\\" + re.escape(accent) + separator + r"([A-Za-z])\}?", lambda m: unicodedata.normalize("NFC", m[1] + combining), text)
    for command, value in {"ss": "ß", "ae": "æ", "AE": "Æ", "oe": "œ", "OE": "Œ", "o": "ø", "l": "ł"}.items():
        text = re.sub(r"\\" + command + r"\b\s*", value, text)
    # Formatting macros contain only their display contents in these sources.
    text = re.sub(r"\\(?:textbf|textit|emph|mbox|textrm|text|TblCode|fnm|sur|orgdiv|orgname|orgaddress|city|postcode|country)\s*", "", text)
    text = text.replace("{", "").replace("}", "").replace("\\\\", " ")
    text = text.replace("---", "—").replace("--", "–")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_bib(text: str) -> dict:
    result, offset = {}, 0
    while True:
        match = re.search(r"@(\w+)\s*\{", text[offset:])
        if not match:
            break
        entry_type = match[1].lower()
        start = offset + match.end() - 1
        body, offset = balanced(text, start)
        if entry_type in {"comment", "preamble", "string"}:
            continue
        key, fields_text = body.split(",", 1)
        fields, pos = {"entry_type": entry_type}, 0
        while pos < len(fields_text):
            field = re.search(r"(\w+)\s*=\s*", fields_text[pos:])
            if not field:
                break
            name = field[1].lower()
            pos += field.end()
            if fields_text[pos] == "{":
                value, pos = balanced(fields_text, pos)
            elif fields_text[pos] == '"':
                end = pos + 1
                while end < len(fields_text) and (fields_text[end] != '"' or fields_text[end - 1] == "\\"):
                    end += 1
                value, pos = fields_text[pos + 1:end], end + 1
            else:
                end = fields_text.find(",", pos)
                if end == -1:
                    end = len(fields_text)
                value, pos = fields_text[pos:end], end
            fields[name] = value.strip()
        if key.strip() in result:
            raise ValueError(f"Duplicate bibliography key: {key}")
        result[key.strip()] = fields
    return result


def table_cells(line: str) -> list[str]:
    cells, start, depth, pos = [], 0, 0, 0
    while pos < len(line):
        char = line[pos]
        if char == "\\":
            pos += 2
            continue
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
        elif char == "&" and depth == 0:
            cells.append(line[start:pos].strip())
            start = pos + 1
        pos += 1
    cells.append(re.sub(r"\\\\\s*$", "", line[start:]).strip())
    return cells


def clean_url(value: str) -> str:
    value = value.replace(r"\&", "&").replace(r"\_", "_").strip()
    if value and urlparse(value).scheme not in {"https", "http"}:
        raise ValueError(f"Invalid external URL: {value!r}")
    return value


def metadata(bibkey: str, bib: dict, publications: dict) -> dict:
    ref, ledger = bib[bibkey], publications.get(bibkey, {})
    year = int(ledger.get("year") or plain(ref["year"]))
    if year != int(plain(ref["year"])):
        raise ValueError(f"Year disagreement for {bibkey}: {year} vs {ref['year']}")
    doi = ledger.get("doi") or ref.get("doi", "")
    arxiv = ledger.get("arxiv") or ref.get("eprint", "")
    url = ledger.get("url") or ref.get("url", "")
    if not url and doi:
        url = "https://doi.org/" + doi
    if not url and arxiv:
        url = "https://arxiv.org/abs/" + arxiv
    formal_venue = ref.get("booktitle") or ref.get("journal") or ""
    inferred_type = "venue_publication" if formal_venue and "arxiv" not in formal_venue.lower() else ("preprint_record" if arxiv or "arxiv" in doi.lower() else "reference")
    publication_type = ledger.get("category") or inferred_type
    venue = plain(ref.get("booktitle") or ref.get("journal") or ledger.get("venue") or "")
    if not venue:
        venue = "Official blog" if publication_type == "official_blog" else ("arXiv" if arxiv or "arxiv" in doi.lower() else "")
    return {
        "title": plain(ref["title"]), "year": year, "venue": venue,
        "authors": plain(ref.get("author", "")), "publication_type": publication_type,
        "paper_url": clean_url(url), "doi": doi, "arxiv": arxiv,
    }


def read_catalogue(manuscript: Path, bib: dict, publications: dict) -> list[dict]:
    entries = []
    for category in CATEGORIES:
        path = manuscript / "tables" / category["table"]
        group, count = "", 0
        for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            group_args = macro_args(line, "CatGroup", 2)
            if group_args:
                group = plain(group_args[1])
            if not re.match(r"^\d+\s*&", line):
                continue
            cells = table_cells(line)
            name, bibkey = macro_args(cells[1], "CatName", 2)
            number = int(cells[0])
            count += 1
            if number != count:
                raise ValueError(f"Non-sequential catalogue row in {path}:{lineno}")
            record = {
                "id": f"{category['prefix']}{number}", "name": plain(name),
                "category": category["id"], "category_label": category["label"],
                "group": group, "bibkey": bibkey,
                **metadata(bibkey, bib, publications),
                "source": f"manuscript/tables/{path.name}:{lineno}",
            }
            project_args = macro_args(cells[-1], "TblSource")
            record["project_url"] = clean_url(project_args[0]) if project_args else ""
            record["url"] = record["project_url"] or record["paper_url"]
            if category["id"] == "resources":
                if len(cells) != 12:
                    raise ValueError(f"Expected 12 resource cells: {path}:{lineno}")
                record["kind"] = "resource"
                signals = [label for label, cell in zip(["RGB", "Depth", "Pose", "Geometry / layout", "Semantics / boxes", "Actions"], cells[4:10]) if r"\TblYes" in cell]
                fields = {"Domain": plain(cells[2]), "Origin": {"R": "Real capture", "S": "Synthetic / simulated", "M": "Mixed"}.get(plain(cells[3]), plain(cells[3])), "Signals": ", ".join(signals) or "No selected signal listed", "Other signals": plain(cells[10]), "Reported scale": plain(cells[11])}
                record["description"] = f"{group} · {fields['Domain']} · {fields['Reported scale']}"
            else:
                record["kind"] = "system" if category["id"] == "xr" else "method"
                tags = re.findall(r"\\Cond\{([^}]+)\}", cells[2])
                record["input_tags"] = tags
                record["inputs"] = [INPUT_NAMES[tag] for tag in tags]
                if category["id"] == "xr":
                    record["inputs"] = [{"G": "Geometry / scene context", "P": "Head / pose"}.get(tag, INPUT_NAMES[tag]) for tag in tags]
                if "$+n$" in cells[2]:
                    record["inputs"].append("Requested part count (n)")
                if category["id"] == "xr":
                    if len(cells) != 9:
                        raise ValueError(f"Expected 9 XR cells: {path}:{lineno}")
                    fields = dict(zip(["Model / component", "Artifact", "Platform", "Task", "Evaluation"], map(plain, cells[3:8])))
                    record["description"] = f"{fields['Artifact']} · {fields['Platform']} · {fields['Task']}"
                else:
                    if len(cells) != 8:
                        raise ValueError(f"Expected 8 method cells: {path}:{lineno}")
                    fields = dict(zip(["Mechanism", "Representation / state", "Output", "Stage"], map(plain, cells[3:7])))
                    record["description"] = f"{fields['Mechanism']} · {fields['Representation / state']} · {fields['Output']}"
                fields = {"Input": ", ".join(record["inputs"]) or plain(cells[2]), **fields}
            record["fields"] = fields
            entries.append(record)
        if count != category["expected"]:
            raise ValueError(f"Unexpected {category['id']} count: {count}, expected {category['expected']}")
    method_keys = {entry["bibkey"] for entry in entries if entry["kind"] != "resource"}
    if method_keys != set(publications):
        raise ValueError(f"Publication ledger mismatch. Tables only: {method_keys - set(publications)}; ledger only: {set(publications) - method_keys}")
    if len({entry["id"] for entry in entries}) != len(entries):
        raise ValueError("Duplicate catalogue IDs")
    return entries


def build(manuscript: Path, output: Path) -> dict:
    main_path = manuscript / "main.tex"
    main = main_path.read_text(encoding="utf-8")
    bibliography_path = manuscript / "references.bib"
    bib = parse_bib(bibliography_path.read_text(encoding="utf-8"))
    ledger_path = manuscript / "evidence-supplement" / "catalogue-publication-records.csv"
    with ledger_path.open(encoding="utf-8-sig", newline="") as file:
        publications = {row["key"]: row for row in csv.DictReader(file)}
    entries = read_catalogue(manuscript, bib, publications)
    counts = dict(Counter(entry["category"] for entry in entries))
    catalogue = {
        "schema_version": 1,
        "categories": [{"id": c["id"], "label": c["label"], "description": c["description"], "count": counts[c["id"]]} for c in CATEGORIES],
        "entries": entries,
        "field_notes": {
            "NR": "Not established in the inspected material.",
            "—": "Unlisted in the inspected description.",
            "Stage": "P: preparation; A: interactive authoring; R: ongoing generation / prediction.",
            "Evaluation": "U: user study; T: technical test; D: demonstration; X: exploratory study; F: formative study; E: expert assessment; R: ratings; WoZ: Wizard-of-Oz study.",
            "year": "Formal publication year, or initial preprint year for preprint-only records. Preprints and subsequent publications are merged.",
            "descriptions": "Concatenated source-table descriptors, not paper abstracts or capability ratings.",
            "resource_signals": "Selected documented signals; an unlisted signal does not establish absence. Reported scales retain the cited release and unit.",
        },
    }
    manifest_path = manuscript / "evidence-supplement" / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    cutoff = re.search(r"targeted retrieval through ([^.]+)\.", main)[1]
    author_raw = macro_args(main, "author")[0]
    affiliation_raw = macro_args(main, "affil")[0]
    annual_path = manuscript / "evidence-supplement" / "catalogue-papers-by-year.csv"
    with annual_path.open(encoding="utf-8-sig", newline="") as file:
        annual = [{key: int(value) for key, value in row.items()} for row in csv.DictReader(file)]
    files = [main_path, bibliography_path, ledger_path, manifest_path, annual_path] + [manuscript / "tables" / c["table"] for c in CATEGORIES]
    project = {
        "schema_version": 1,
        "title": plain(macro_args(main, "title")[0]),
        "short_title": "Visual Generative AI for Extended Reality",
        "authors": [{"name": plain(author_raw), "email": plain(macro_args(main, "email")[0]), "affiliation": plain(affiliation_raw.replace("\\\\", ", "))}],
        "abstract": plain(macro_args(main, "abstract")[0]),
        "keywords": [word.strip() for word in plain(macro_args(main, "keywords")[0]).split(",")],
        "review_type": "Critical narrative review",
        "retrieval_cutoff": cutoff,
        "release_date": manifest["release"],
        "counts": {"methods_and_systems": sum(count for category, count in counts.items() if category != "resources"), "resources": counts["resources"], "detailed_evidence_records": manifest["records"], "evidence_dimensions": manifest["cells"] // manifest["records"], "catalogued_papers": sum(row["total_papers"] for row in annual), "by_category": counts},
        "annual_counts": annual,
        "scope_note": "The catalogue contains 204 methods and systems and 37 resources. A purposively selected subset of 31 methods and systems receives detailed capability coding. Annual paper counts exclude the Genie 3 official blog.",
        "source_files": [{"path": "manuscript/" + str(path.relative_to(manuscript)).replace("\\", "/"), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()} for path in files],
    }
    if project["counts"]["methods_and_systems"] != manifest["catalogue_records"]:
        raise ValueError("Manifest catalogue count disagrees with source tables")
    # Detect unhandled LaTeX in visible strings before publishing it.
    for entry in entries:
        for name, value in [("name", entry["name"]), ("title", entry["title"]), ("venue", entry["venue"]), ("authors", entry["authors"]), *entry["fields"].items()]:
            if "\\" in value:
                raise ValueError(f"Unhandled LaTeX in {entry['id']} {name}: {value}")
        if not entry["url"]:
            raise ValueError(f"Missing source link for {entry['id']}")
    output.mkdir(parents=True, exist_ok=True)
    for name, content in [("catalogue.json", catalogue), ("project.json", project)]:
        (output / name).write_text(json.dumps(content, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    return {"entries": len(entries), "counts": counts, "publication_ledger_records": len(publications), "output": str(output)}


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manuscript", type=Path, default=root / "manuscript")
    parser.add_argument("--output", type=Path, default=root / "website" / "docs" / "data")
    args = parser.parse_args()
    print(json.dumps(build(args.manuscript.resolve(), args.output.resolve()), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
