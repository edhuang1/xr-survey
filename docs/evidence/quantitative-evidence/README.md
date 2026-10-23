# Quantitative evidence for the review

This supplement records the source-reported results displayed in the review's three quantitative tables. The review did not rerun these experiments. The CSV contains the displayed numerical subset; the JSON files retain the fuller source extraction, configuration, metric definitions, limitations and any additional values inspected but not displayed.

| Table | Method rows | Numerical table cells | Note runtimes | Explicit missing cells |
| --- | ---: | ---: | ---: | ---: |
| Assets | 10 | 66 | 2 | 6 |
| Scenes | 22 | 119 | 0 | 0 |
| Temporal worlds | 18 | 81 | 0 | 3 |
| Total | 50 | 266 | 2 | 9 |

`performance-values.csv` has **268 data records**: 266 numerical metric/time cells and the two asset-table note runtimes. Nine displayed missing cells are omitted from the CSV and remain explicit in the JSON; they are not zero. Original decimal precision, percentage signs and time units are preserved as strings. Import `value_string` as text in spreadsheet software. `direction` means higher/lower within the identified protocol, not a ranking across protocols. Dataset prefixes and `short.`/`long.` prefixes distinguish otherwise identically named metrics.

The two note records are 18 min for TripoSG → HoloPart and 34 s for PartCrafter, measured on four-part examples using one H20 GPU. They are identified by `display_location=table_note`; their values combine the original numeric string and unit without unit conversion.

## Files and source versions

- `performance-assets.json`: TRELLIS image-to-3D/Toys4k results from arXiv:2412.01506v1, Table 2; PartCrafter object results from the NeurIPS 2025 proceedings PDF, Table 1.
- `performance-scenes.json`: Text2Room from the ICCV 2023 paper, Table 1; Voyager from arXiv:2506.04225v1, Table 1; WorldScore from the ICCV 2025 paper, Table 2, with method configurations from its official supplement.
- `performance-worlds.json`: DreamGaussian4D from arXiv:2312.17142v3, Table 3; WorldPlay from PMLR volume 306, sun26az, Table 2; MultiGen from arXiv:2603.06679v2, Table 2.
- `performance-values.csv`: the exact selected values, with method, protocol, metric, value string, direction, citation key, table/page, source edition and public URL.

Bibliography publication metadata and the inspected technical edition can differ. In particular, the TRELLIS and Voyager numbers here come from the stated arXiv versions even though their bibliography entries identify subsequent venues. WorldPlay numbers come from the PMLR proceedings edition. Citation keys such as `Sun2025WorldPlay` are stable manuscript identifiers, not source-version dates. Source PDF page and printed page are separate fields; an empty printed-page field means it was not separately recorded.

Each panel is attributed to the paper that reported the comparison, including its baseline rows. WorldScore is a fixed published snapshot with unequal method inputs, resolution, duration and compute. WorldPlay's short and long evaluations use different reference targets. DreamGaussian4D's Fast configuration is labelled separately. Consult the JSON before comparing scores; no pooled ranking or unreported configuration is supplied.

The three JSON files are byte-for-byte copies of the verified extraction records. Their repository-relative cache/preview paths are provenance pointers, not dependencies included in this supplement; the public URLs and table/page anchors permit independent source lookup. The CSV uses only the displayed selections and adds no new measurements.
