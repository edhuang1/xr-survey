# Contributing

Thank you for helping maintain *Visual Generative AI for Extended Reality: A Survey*. Contributions can correct bibliographic details, improve catalogue descriptions, repair links, add relevant work, or improve the project website.

## Suggest a correction or addition

Open an issue or pull request with the method or resource name, a primary-source link, and a short explanation of the proposed change. A paper, official project page, publisher record, or author-maintained repository should support factual additions. Cite the relevant section, table, figure, or release when a claim depends on a particular configuration.

For a proposed catalogue entry, include:

- Full title, authors, publication year, venue or preprint status, and DOI or canonical paper URL.
- The matching domain: visual assets, spatial scenes, temporal/world models, XR systems, or resources.
- Conditioning inputs, generative mechanism, retained representation, delivered output, and operating stage, where applicable.
- The official project or code URL, if available.
- A brief explanation of its relevance to the survey's content-to-XR-operation comparison.

For XR systems, also identify the platform, interaction inputs, task, and evaluation form. For datasets, simulators, or benchmarks, identify supported signals, tasks, release/version, and the unit used for any reported scale.

## Keep the catalogue and evidence consistent

The website reads [docs/data/catalogue.json](docs/data/catalogue.json). Its `entries` array contains the catalogue records; follow the existing record schema when proposing a data correction. Preserve stable record identifiers and bibliography keys. Merge preprint and formally published versions of the same work instead of adding duplicate records.

The catalogue and `docs/data/project.json` are exported from the manuscript workspace. Maintainers with the original `../manuscript/` directory can rebuild them from this repository root:

```sh
python scripts/generate_catalogue.py
```

This export command requires the manuscript source directory, which is separate from the public website bundle. Contributors can submit source-backed corrections without that workspace; maintainers should reconcile accepted data changes with the manuscript before the next export.

The four method/system domains currently contain 204 entries, and the resource domain contains 37 additional entries. When membership changes, update the associated counts in the website and README together. Publication-year summaries use the formal publication year, or the initial preprint year for preprint-only records. The Genie 3 blog is excluded from the publication-year paper count.

The [evidence supplement](docs/evidence/README.md) is a separately coded subset. Adding a catalogue entry does not add an evidence profile automatically. A new capability claim requires a traceable source, inspected configuration, and supporting locator. Preserve source-reported quantities, units, protocols, and uncertainty; use an explicit missing-value convention when a detail is unreported.

Evidence files include a release manifest. If updating an evidence release, regenerate the relevant hashes and crosswalks together, document the changed source editions, and keep the browsable supplement consistent with its data. Do not change a release date merely because website styling changed.

## Website changes

The deployable website lives in `docs/`. Keep local links and assets relative so they work on both a local preview and a repository-based GitHub Pages URL. Use accessible headings, descriptive image alternatives, keyboard-operable controls, and responsive layouts.

Use the existing source attribution records in [docs/assets/CREDITS.md](docs/assets/CREDITS.md) when changing figures. Preserve figure credits and the rights attached to source material. The only permitted manuscript PDF is the public reading copy at `docs/paper/visual-generative-ai-xr-survey.pdf`. Keep it below 5 MB with searchable text, preserve the scientific content and links, and keep its abstract, DOI, and version metadata aligned with the public preprint. Do not add other manuscript PDFs, LaTeX or Word sources, private review notes, credentials, local absolute paths, or unrelated working files. Link to external papers through their canonical source URLs. The site validator enforces this narrow PDF exception.

## Validate and preview

From the repository root, run:

```sh
python scripts/validate_site.py
python -m http.server 8000 --directory docs
```

Open <http://localhost:8000>. Check affected links, desktop and mobile layouts, catalogue search and filters, keyboard focus, and the catalogue/evidence downloads. Describe the change and the relevant checks in the pull request.

Pull requests run static validation. After a change reaches `main`, the GitHub Actions workflow validates and publishes `docs/` to GitHub Pages. The repository's Pages publishing source must be set to **GitHub Actions**.
