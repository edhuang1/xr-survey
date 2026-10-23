# Figure sources and attribution

These website images are raster exports of the project's canonical manuscript figures. They preserve the supplied figure content and attribution. Exported on 23 October 2026.

## Review overview

- Website files: `overview.png`, `overview.webp`, and `overview-preview.webp`.
- Source: `manuscript/figures/drawio/review-overview.pdf`; editable source: `manuscript/figures/drawio/review-overview.drawio`.
- Original manuscript caption: “Review map linking content families, mechanisms, data and evaluation targets, and XR operations. Connections indicate review organization; the asset mesh is schematic. Published outputs from Fridman et al. (2023), Bahmani et al. (2024), and Sun et al. (2026) illustrate scenes, time-varying 3D, and action-conditioned observations.”
- The schematic asset mesh belongs to the supplied review figure. Its other illustrated outputs are attributed in the manuscript to:
  - Rafail Fridman, Amit Abecasis, Yoni Kasten, and Tali Dekel. *SceneScape: Text-Driven Consistent Scene Generation*. NeurIPS 36, 39897–39914 (2023). [Publication](https://papers.neurips.cc/paper_files/paper/2023/hash/7d62a85ebfed2f680eb5544beae93191-Abstract-Conference.html). Manuscript citation key: `Fridman2023SceneScape`.
  - Sherwin Bahmani et al. *4D-fy: Text-to-4D Generation Using Hybrid Score Distillation Sampling*. CVPR, 7996–8006 (2024). [DOI](https://doi.org/10.1109/cvpr52733.2024.00764). Manuscript citation key: `Bahmani2024FourDfy`.
  - Wenqiang Sun et al. *WorldPlay: Towards Long-Term Geometric Consistency for Real-Time Interactive World Modeling*. ICML, Proceedings of Machine Learning Research 306, 117501–117523 (2026). [Publication](https://proceedings.mlr.press/v306/sun26az.html). The manuscript's stable citation key is `Sun2025WorldPlay`; its bibliography records the 2026 proceedings edition.

## Taxonomy

- Website files: `taxonomy.png`, `taxonomy.webp`, and `taxonomy-preview.webp`.
- Source: `manuscript/figures/drawio/taxonomy-navigation.pdf`; editable source: `manuscript/figures/drawio/taxonomy-navigation.drawio`.
- Original manuscript caption: “Taxonomy of 60 representative methods in 20 complementary families. Names link to references; domain and axis labels link to sections. The inset counts 203 catalogued papers by bibliographic year, excluding the Genie 3 blog; 2026 runs through 23 October.”
- The figure is a review taxonomy, grouping representative methods under assets, spatial scenes, dynamic worlds, and XR systems. Raster website copies do not carry the interactive bibliography and section links provided by the manuscript PDF.
- Method references are preserved in [the bibliography](../paper/references.bib). The catalogue's publication records and annual counts are included in [the evidence supplement](../evidence/index.html).

## Scope and rights

The website exports add no license to the manuscript, original diagrams, or cited third-party images. Existing source attribution is retained; this file does not assert permission to relicense third-party material. Consult the original publications and their rights notices for reuse beyond this project.

PNG files are full-resolution 3200-pixel-wide exports; WebP files provide smaller web images, and preview WebP files are 1600 pixels wide. The website publishes figure previews and bibliographic records; the review manuscript and its source files are not distributed here.

## Published example gallery

The 12 thumbnails in `examples/` illustrate published model outputs or system previews. They are not newly reproduced experiments, measured interaction traces, or a controlled benchmark. Each example links to its source publication. The gallery data, including exact figure anchors, image hashes and image-specific notes, are in [`showcase.json`](../data/showcase.json).

| Website files | Source and retained credit | Source figure |
|---|---|---|
| `trellis-excavator.webp`, `lgm-chest.webp`, `instantmesh-excavator.webp` | Jianfeng Xiang et al., *Structured 3D Latents for Scalable and Versatile 3D Generation*, [arXiv:2412.01506v1](https://arxiv.org/abs/2412.01506v1). The LGM and InstantMesh results are the baseline outputs reproduced in this source. | Figure 5, image-conditioned examples, PDF page 7; both rendered views and original geometry insets retained. |
| `voyager-staircase.webp`, `viewcrafter-bathroom.webp` | Tianyu Huang et al., *Voyager: Long-Range and World-Consistent Video Diffusion for Explorable 3D Scene Generation*, [arXiv:2506.04225v1](https://arxiv.org/abs/2506.04225v1). The ViewCrafter result is reproduced in this source. | Figure 4, PDF page 6; first scene/Voyager and fourth scene/ViewCrafter. Original annotations and watermark retained. |
| `scenescape-museum.webp` | Rafail Fridman, Amit Abecasis, Yoni Kasten and Tali Dekel, *SceneScape: Text-Driven Consistent Scene Generation*, [arXiv:2302.01133v2](https://arxiv.org/abs/2302.01133v2). | Figure 2, generated RGB frame, PDF page 3. |
| `4dfy-monkey.webp`, `4dfy-panda.webp` | Sherwin Bahmani et al., *4D-fy: Text-to-4D Generation Using Hybrid Score Distillation Sampling*, [arXiv:2311.17984v2](https://arxiv.org/abs/2311.17984v2). | Figure 3, architecture-stack rendered monkey frame, PDF page 4; Figure 5, full-model panda output, PDF page 8. A single still does not demonstrate motion. |
| `worldplay-interior.webp` | Wenqiang Sun et al., *WorldPlay: Towards Long-Term Geometric Consistency for Real-Time Interactive World Modeling*, [PMLR 306 (2026)](https://proceedings.mlr.press/v306/sun26az.html). | Figure 12, example row 7, first displayed generated output, PDF page 18. No claim is made about exact cache occupancy or timing. |
| `dreamcrafter-preview.webp`, `dreamcrafter-final.webp` | Cyrus Vachha et al., *Dreamcrafter: Immersive Editing of 3D Radiance Fields Through Flexible, Generative Inputs and Outputs*, [CHI 2025](https://doi.org/10.1145/3706598.3714312). | Figure 5, middle preview and right final-generation panels, PDF page 5. The supplied preview crop includes a previously documented font-only change in its speech bubble; the phrase and scene pixels are unchanged. |
| `generated-reality-hands.webp` | Linxi Xie et al., *Generated Reality: Human-centric World Simulation using Interactive Video Generation with Hand and Camera Control*, [arXiv:2602.18422v1](https://arxiv.org/abs/2602.18422v1). | Figure 8, Task 1, Ours, last displayed sample, central crop, PDF page 14. |

The existing provenance records identify the specific SceneScape, 4D-fy, Dreamcrafter, WorldPlay and Generated Reality source editions as [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The gallery retains author, publication, figure and change credits. This does not imply author endorsement or independently establish rights in any third-party material embedded in those papers.

The version-specific TRELLIS and Voyager records link to the arXiv non-exclusive distribution licence. That record does **not** establish a new third-party image reuse licence. No Creative Commons licence is asserted for those excerpts; their source attribution is retained and no additional licence is granted by this website.

All gallery images come from already documented source excerpts in the local project. For this website, their complete pixels were converted to WebP at original aspect ratio, without retouching or synthetic content changes. Maximum width is 1280 pixels; the current 12 images are 272–658 pixels wide and were not upscaled. No source paper PDF, review manuscript, or manuscript source file is included in the gallery.

## Video gallery and interactive illustration

The eight video demonstrations stream directly from the authors' official project websites; this repository contains no video copies. These are recorded examples, not live inference, new experiments, or a controlled cross-method comparison. Exact media URLs, technical metadata, source locations and poster hashes are recorded in [`videos.json`](../data/videos.json).

| Poster file | Official demonstration and attribution |
|---|---|
| `trellis-cottage.webp` | [TRELLIS](https://microsoft.github.io/TRELLIS/) — Jianfeng Xiang et al., TRELLIS: Structured 3D Latents for Scalable and Versatile 3D Generation. Official project demonstration. |
| `lgm-multiview.webp` | [LGM](https://me.kiui.moe/lgm/) — LGM project authors, LGM: Large Multi-View Gaussian Model for High-Resolution 3D Content Creation. Official project demonstration. |
| `scenescape-cave.webp` | [SceneScape](https://scenescape.github.io/) — Rafail Fridman, Amit Abecasis, Yoni Kasten and Tali Dekel, SceneScape: Text-Driven Consistent Scene Generation. Official project demonstration. |
| `viewcrafter-nvs.webp` | [ViewCrafter](https://drexubery.github.io/ViewCrafter/) — ViewCrafter project authors, ViewCrafter: Taming Video Diffusion Models for High-fidelity Novel View Synthesis. Official project demonstration. |
| `4dfy-bear.webp` | [4D-fy](https://sherwinbahmani.github.io/4dfy/) — Sherwin Bahmani et al., 4D-fy: Text-to-4D Generation Using Hybrid Score Distillation Sampling, CVPR 2024. Official project demonstration. |
| `worldplay-demo.webp` | [WorldPlay](https://github.com/Tencent-Hunyuan/HY-WorldPlay) — Team HunyuanWorld / Tencent Hunyuan, HY-World 1.5 (WorldPlay), official third-person demonstration. |
| `dreamcrafter-edit.webp` | [Dreamcrafter](https://dream-crafter.github.io/) — Cyrus Vachha et al., Dreamcrafter: Immersive Editing of 3D Radiance Fields Through Flexible, Generative Inputs and Outputs, CHI 2025. Official project demonstration. |
| `generated-reality-interaction.webp` | [Generated Reality](https://codeysun.github.io/generated-reality/) — Linxi Xie, Lisong C. Sun, Ashley Neall, Tong Wu, Shengqu Cai and Gordon Wetzstein, Generated Reality, 2026. Official project demonstration. |

Posters in `video-posters/` are complete frames extracted at 0.8 seconds, preserving overlays and aspect ratio, resized to at most 960 pixels wide without upscaling, and encoded as WebP. They identify their corresponding videos; they are not additional generated results.

The TRELLIS project states that its materials are for academic and research purposes, excluding commercial exploitation. Dreamcrafter's website declares [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). A code, model, or paper licence is not asserted as a separate video reuse licence; no additional third-party media licence is granted here. All official source and rights notices remain applicable.

All eight selected demonstrations are silent. Dreamcrafter contains an AAC track whose full-clip peak and mean both measured −91 dB; its stream is presented muted, like the clips with no audio track. Visible source annotations and descriptive text accompany the videos.

The interactive spatial sandbox is original website code and uses constructed geometric primitives. Its camera orbit, surface/wireframe/point views illustrate representation and viewing choices. It is not an output of any cited model, a live generator, or an XR performance measurement.
