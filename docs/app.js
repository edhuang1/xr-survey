"use strict";
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const url = (v) => { try { const u = new URL(v); return ["https:", "http:"].includes(u.protocol) ? u.href : ""; } catch { return ""; } };
  const localImage = (v) => typeof v === "string" && /^assets\/[a-zA-Z0-9/_.-]+\.(webp|png|svg|jpg)$/.test(v) && !v.includes("..") ? v : "";
  const external = (v, label, cls = "") => url(v) ? `<a href="${esc(url(v))}" class="${cls}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : "";
  const labels = { assets: "3D assets", scenes: "Spatial scenes", temporal: "Time & worlds", xr: "XR systems", resources: "Resources" };
  const state = { entries: [], category: "all", query: "", year: "all", sort: "newest", view: "table", page: 1 };
  const pageSize = 15;
  let fieldNotes = {}, catalogueReady = false, showcase, videoShowcase;
  let exampleMode = "videos", activeExampleGroup = "assets", releaseVideo = () => {};
  const scrollTo = (id) => $(id).scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  const searchText = (e) => [e.id, e.name, e.title, e.venue, e.year, e.category_label, e.group, e.description, e.bibkey, JSON.stringify(e.fields || {}), e.authors].join(" ").toLocaleLowerCase();
  function displayField(key, value) {
    const dictionary = ["Stage", "Evaluation"].includes(key) && fieldNotes[key]
      ? Object.fromEntries(fieldNotes[key].replace(/\.$/, "").split(";").map((pair) => pair.split(":").map((part) => part.trim()))) : null;
    if (dictionary && typeof value === "string") return value.split("/").map((part) => dictionary[part.trim()] || part.trim()).join(" / ");
    return Array.isArray(value) ? value.join(", ") : value;
  }
  function readFilters() {
    const p = new URLSearchParams(location.search);
    state.query = p.get("q") || "";
    state.category = Object.hasOwn(labels, p.get("category")) ? p.get("category") : "all";
    state.sort = ["newest", "oldest", "name"].includes(p.get("sort")) ? p.get("sort") : "newest";
    state.year = state.entries.some((e) => String(e.year) === p.get("year")) ? p.get("year") : "all";
    state.view = p.get("view") === "cards" ? "cards" : "table";
    state.page = 1;
    syncInputs();
  }
  function syncInputs() { $("#search").value = state.query; $("#year").value = state.year; $("#sort").value = state.sort; }
  function saveFilters() {
    const p = new URLSearchParams();
    if (state.query) p.set("q", state.query);
    if (state.category !== "all") p.set("category", state.category);
    if (state.year !== "all") p.set("year", state.year);
    if (state.sort !== "newest") p.set("sort", state.sort);
    if (state.view !== "table") p.set("view", state.view);
    const q = p.toString();
    history.replaceState(null, "", `${location.pathname}${q ? `?${q}` : ""}${location.hash}`);
  }
  function links(e) {
    const primary = url(e.paper_url || e.url);
    return external(primary, "Source ↗", "primary-link") + (e.project_url && url(e.project_url) !== primary ? external(e.project_url, "Project ↗") : "");
  }
  function card(e) {
    const fields = Object.entries(e.fields || {}).map(([key, value]) => `<strong>${esc(key.replace(/_/g, " "))}:</strong> ${esc(displayField(key, value))}`).join("<br>");
    return `<article class="paper-card" data-id="${esc(e.id)}"><div class="paper-card-head"><h3>${external(e.paper_url || e.url, e.name) || esc(e.name)}</h3><span class="paper-year">${esc(e.year)}</span></div><p class="paper-title">${esc(e.title)}</p><div class="paper-meta"><span class="category-tag">${esc(labels[e.category])}</span><span>${esc(e.venue)}</span></div><details><summary>Catalogue details · ${esc(e.id)}</summary><p>${esc(e.description)}</p>${fields ? `<p>${fields}</p>` : ""}<p>Reference key: ${esc(e.bibkey)}</p></details><div class="paper-links">${links(e)}</div></article>`;
  }
  function venue(v) {
    const name = String(v || "");
    const known = name.match(/\b(CVPR|ICCV|ECCV|ICLR|ICML|NeurIPS|UIST|CHI|SIGGRAPH|ISMAR|I3D|TVCG)\b/i);
    if (known) return known[0];
    const fullNames = [[/Conference on Machine Learning/i, "ICML"], [/Conference on Learning Representations/i, "ICLR"], [/Neural Information Processing Systems/i, "NeurIPS"], [/Computer Vision and Pattern Recognition/i, "CVPR"], [/International Conference on Computer Vision/i, "ICCV"], [/Human Factors in Computing Systems/i, "CHI"], [/User Interface Software and Technology/i, "UIST"], [/Virtual Reality and 3D User Interfaces/i, "IEEE VR"]];
    const fullName = fullNames.find(([pattern]) => pattern.test(name));
    if (fullName) return fullName[1];
    if (/arxiv/i.test(name)) return "arXiv";
    return name;
  }
  function table(items) {
    return `<table class="paper-table"><caption class="sr-only">Research collection, sorted by ${esc(state.sort)}</caption><thead><tr><th scope="col">ID</th><th scope="col">PAPER / METHOD</th><th scope="col">PUBLICATION</th><th scope="col">LINKS</th></tr></thead><tbody>${items.map((e) => `<tr data-id="${esc(e.id)}"><td class="record-id">${esc(e.id)}</td><td>${external(e.paper_url || e.url, e.title, "table-title")}<div class="table-subtitle"><strong>${esc(e.name)}</strong><span class="category-tag">${esc(labels[e.category])}</span></div></td><td><span class="table-year">${esc(e.year)}</span><span class="venue-name" title="${esc(e.venue)}">${esc(venue(e.venue))}</span></td><td><div class="paper-links">${links(e)}</div></td></tr>`).join("")}</tbody></table>`;
  }
  function render() {
    if (!catalogueReady) return;
    const terms = state.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const filtered = state.entries.filter((e) => (state.category === "all" || e.category === state.category) && (state.year === "all" || String(e.year) === state.year) && terms.every((t) => e.searchText.includes(t)))
      .sort((a, b) => state.sort === "name" ? a.name.localeCompare(b.name) : (state.sort === "oldest" ? a.year - b.year : b.year - a.year) || a.name.localeCompare(b.name));
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    state.page = Math.max(1, Math.min(state.page, pages));
    const start = (state.page - 1) * pageSize, items = filtered.slice(start, start + pageSize);
    $("#result-count").textContent = filtered.length ? `${start + 1}–${Math.min(start + pageSize, filtered.length)} of ${filtered.length} records` : "0 records";
    $$("[data-category]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.category === state.category)));
    $$("[data-view]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === state.view)));
    $("#paper-list").innerHTML = items.length ? (state.view === "table" ? table(items) : `<div class="paper-card-grid">${items.map(card).join("")}</div>`) : "";
    $("#empty-state").hidden = filtered.length > 0;
    $("#pagination").hidden = pages <= 1;
    $("#page-status").textContent = `Page ${state.page} of ${pages}`;
    $("#previous-page").disabled = state.page === 1;
    $("#next-page").disabled = state.page === pages;
  }
  function update() { state.page = 1; render(); saveFilters(); }
  function reset() { Object.assign(state, { category: "all", query: "", year: "all", sort: "newest", page: 1 }); syncInputs(); }
  $("#search").addEventListener("input", (e) => { state.query = e.target.value; update(); });
  $("#year").addEventListener("change", (e) => { state.year = e.target.value; update(); });
  $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; update(); });
  $("#reset-filters").addEventListener("click", () => { reset(); update(); });
  $$("[data-category]").forEach((b) => b.addEventListener("click", () => { state.category = b.dataset.category; update(); }));
  $$("[data-view]").forEach((b) => b.addEventListener("click", () => { state.view = b.dataset.view; render(); saveFilters(); }));
  ["previous", "next"].forEach((direction) => $(`#${direction}-page`).addEventListener("click", () => { state.page += direction === "next" ? 1 : -1; render(); scrollTo("#collection"); }));
  window.addEventListener("popstate", () => { readFilters(); render(); });

  function tabSelection(container, key, value) {
    $$(`${container} [role=tab]`).forEach((b) => { const active = b.dataset[key] === value; b.setAttribute("aria-selected", String(active)); b.tabIndex = active ? 0 : -1; });
  }
  function renderTaxonomy(category) {
    const entries = state.entries.filter((e) => e.category === category);
    const groups = new Map();
    entries.forEach((e) => { if (!groups.has(e.group)) groups.set(e.group, []); groups.get(e.group).push(e); });
    tabSelection(".taxonomy-tabs", "taxonomy", category);
    const panel = $("#taxonomy-panel");
    panel.setAttribute("aria-labelledby", `tax-${category}`);
    panel.dataset.domain = category;
    panel.innerHTML = `<div class="taxonomy-heading"><p>${groups.size} families <span>· Select a method to view its paper</span></p><button type="button" class="taxonomy-original" data-lightbox="assets/taxonomy.png" data-caption="Illustrated taxonomy of 60 representatives. Annual counts summarize 203 catalogue papers, excluding the Genie 3 official blog.">Original figure ↗</button></div><div class="taxonomy-families">${[...groups].map(([name, items], index) => `<article class="family" aria-labelledby="taxonomy-family-${category}-${index}"><div class="family-heading"><span class="family-number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span><h4 id="taxonomy-family-${category}-${index}">${esc(name)}</h4><span class="family-count" aria-label="${items.length} records">${items.length}</span></div><div class="method-chips">${items.map((e) => `<button type="button" data-method="${esc(e.id)}" title="${esc(e.title)}" aria-label="Browse ${esc(e.name)} in the paper collection">${esc(e.name)}</button>`).join("")}</div></article>`).join("")}</div>`;
  }
  $$("[data-taxonomy]").forEach((b) => b.addEventListener("click", () => { if (catalogueReady) renderTaxonomy(b.dataset.taxonomy); }));
  function renderGuide(guide) {
    $("#benchmark-grid").innerHTML = guide.benchmarks.map((b) => `<li>${external(b.source_link, b.name + " ↗")}<span>${esc(b.category)} · ${esc(b.year)}</span></li>`).join("");
    $("#agenda-list").innerHTML = guide.agenda.map((a) => `<li><strong>${esc(a.title)}</strong><p>${esc(a.question)}</p></li>`).join("");
  }
  function renderFigures(groupId, itemId) {
    const group = showcase.groups.find((g) => g.id === groupId) || showcase.groups[0];
    const item = group.items.find((i) => i.id === itemId) || group.items[0];
    tabSelection("#example-tabs", "exampleGroup", group.id);
    $("#example-panel").setAttribute("aria-labelledby", `example-tab-${group.id}`);
    $("#example-panel").innerHTML = `<div class="example-stage"><button type="button" class="example-image" data-lightbox="${esc(localImage(item.image))}" data-caption="${esc(item.attribution)}" aria-label="Expand ${esc(item.method)} example"><img src="${esc(localImage(item.image))}" width="${Number(item.width)}" height="${Number(item.height)}" alt="${esc(item.alt)}"><span class="expand-label">⤢ Expand</span></button><div class="example-caption"><span class="example-method">${esc(item.method)}</span><h4>${esc(item.title)}</h4><p>${esc(item.description)}</p>${external(item.sourceUrl, `${item.sourceLabel} ↗`)}<p class="source-location">${esc(item.sourceAnchor)} <a href="assets/CREDITS.md">Image credits</a></p></div></div><div class="example-thumbnails" role="group" aria-label="Select a visual example">${group.items.map((i) => `<button type="button" data-example-item="${esc(i.id)}" data-group="${esc(group.id)}" aria-pressed="${i.id === item.id}" aria-label="Show ${esc(i.method)}: ${esc(i.title)}"><img src="${esc(localImage(i.image))}" width="${Number(i.width)}" height="${Number(i.height)}" alt="" loading="lazy"><span><strong>${esc(i.method)}</strong><small>${esc(i.title)}</small></span></button>`).join("")}</div>`;
  }
  const videoUrl = (value) => {
    const candidate = url(value);
    return candidate && new URL(candidate).protocol === "https:" && /\.(mp4|webm)$/i.test(new URL(candidate).pathname) ? candidate : "";
  };
  const formatDuration = (seconds) => `${Math.round(seconds)}s`;
  function renderExamples(groupId, itemId) {
    releaseVideo();
    activeExampleGroup = groupId || activeExampleGroup;
    $$("[data-example-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.exampleMode === exampleMode)));
    const interactive = exampleMode === "interactive";
    $("#example-tabs").hidden = interactive;
    $("#example-panel").hidden = interactive;
    $("#spatial-demo").hidden = !interactive;
    $("#media-credit").hidden = interactive;
    if (interactive) return;
    $("#media-credit").innerHTML = `${exampleMode === "figures" ? "Research figures" : "Recorded research demos"} from their authors. <a href="assets/CREDITS.md">Sources & credits ↗</a>`;
    const group = videoShowcase?.groups.find((g) => g.id === activeExampleGroup);
    if (exampleMode === "figures" || !group?.items.length) { renderFigures(activeExampleGroup, itemId); return; }
    const item = group.items.find((i) => i.id === itemId) || group.items[0];
    tabSelection("#example-tabs", "exampleGroup", group.id);
    $("#example-panel").setAttribute("aria-labelledby", `example-tab-${group.id}`);
    $("#example-panel").innerHTML = `<div class="example-stage video-example-stage"><div class="video-player"><div class="video-surface"><video id="example-video" controls loop muted playsinline preload="none" poster="${esc(localImage(item.poster.path))}" width="${Number(item.width)}" height="${Number(item.height)}" aria-label="${esc(item.method)}: ${esc(item.title)}" aria-describedby="video-description"><p>Your browser cannot play this video. ${external(item.sourceUrl, "Watch on the official project page")}</p></video></div><div class="video-toolbar"><button type="button" id="video-play-toggle" aria-label="Play video">▶ Play</button><span id="video-status" role="status">Ready to play · ${item.audio ? "Muted" : "Silent clip"}</span><button type="button" id="video-expand" aria-label="Expand video">⤢ <span>Expand</span></button></div><div class="video-error" id="video-error" hidden><p>This video could not be played here.</p>${external(item.sourceUrl, "Open the official demonstration ↗")}<button type="button" id="video-retry">Try again</button></div></div><div class="example-caption"><span class="example-method">${esc(item.method)}</span><h4>${esc(item.title)}</h4><p id="video-description">${esc(item.description)}</p>${external(item.sourceUrl, "Official project ↗")}<p class="source-location">${esc(item.sourceLabel)}</p></div></div><div class="example-thumbnails video-thumbnails" role="group" aria-label="Select a video demonstration">${group.items.map((i) => `<button type="button" data-video-item="${esc(i.id)}" data-group="${esc(group.id)}" aria-pressed="${i.id === item.id}" aria-label="Watch ${esc(i.method)}: ${esc(i.title)}"><span class="video-thumb-image"><img src="${esc(localImage(i.poster.path))}" width="${Number(i.poster.width)}" height="${Number(i.poster.height)}" alt="" loading="lazy"><span>▶ ${formatDuration(i.durationSeconds)}</span></span><span><strong>${esc(i.method)}</strong><small>${esc(i.title)}</small></span></button>`).join("")}</div>`;
    setupVideo(item);
  }
  function setupVideo(item) {
    const video = $("#example-video"), toggle = $("#video-play-toggle"), status = $("#video-status");
    const failure = $("#video-error");
    const videoDialog = $("#video-dialog"), home = video.parentElement, expandButton = $("#video-expand");
    let visible = false, userPaused = false, internalPause = false, disposed = false;
    const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
    const canAutoPlay = () => !motionPreference.matches && !navigator.connection?.saveData && visible && !document.hidden && !userPaused;
    const attachSource = () => { if (!video.hasAttribute("src")) video.src = videoUrl(item.videoUrl); };
    const play = async () => {
      attachSource(); status.textContent = "Loading video…";
      try { await video.play(); if (disposed || document.hidden || !visible) pauseForVisibility(); }
      catch { if (!disposed && !video.error) { status.textContent = "Press Play to start"; toggle.textContent = "▶ Play"; } }
    };
    const pauseForVisibility = () => { if (!video.paused) { internalPause = true; video.pause(); } };
    const onPlaying = () => { userPaused = false; toggle.textContent = "Ⅱ Pause"; toggle.setAttribute("aria-label", "Pause video"); status.textContent = item.audio ? "Playing · audio controls in video" : "Playing · silent loop"; failure.hidden = true; };
    const onPause = () => { if (!internalPause) userPaused = true; internalPause = false; toggle.textContent = "▶ Play"; toggle.setAttribute("aria-label", "Play video"); status.textContent = "Paused"; };
    const onError = () => { failure.hidden = false; status.textContent = "Video unavailable"; toggle.textContent = "▶ Play"; toggle.setAttribute("aria-label", "Play video"); };
    const onVisibility = () => { if (document.hidden) pauseForVisibility(); else if (canAutoPlay()) play(); };
    const onMotionPreference = () => { if (motionPreference.matches) pauseForVisibility(); };
    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause", onPause);
    video.addEventListener("error", onError);
    video.addEventListener("waiting", () => { if (!disposed) status.textContent = "Buffering…"; });
    toggle.addEventListener("click", () => { if (video.paused) { userPaused = false; visible = true; play(); } else { userPaused = true; video.pause(); } });
    $("#video-retry").addEventListener("click", () => { failure.hidden = true; video.removeAttribute("src"); userPaused = false; visible = true; play(); });
    const restoreVideo = () => {
      if (video.parentElement !== home) home.prepend(video);
      expandButton.focus({ preventScroll: true });
    };
    expandButton.addEventListener("click", () => {
      const wasPlaying = !video.paused;
      $("#expanded-video-title").textContent = `${item.method} · ${item.title}`;
      $("#expanded-video").append(video); videoDialog.showModal(); visible = true;
      if (wasPlaying) play();
    });
    videoDialog.addEventListener("close", restoreVideo);
    document.addEventListener("visibilitychange", onVisibility);
    motionPreference.addEventListener("change", onMotionPreference);
    const observer = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
      visible = videoDialog.open || (entries[0].isIntersecting && entries[0].intersectionRatio >= 0.25);
      if (canAutoPlay()) play(); else if (!visible) pauseForVisibility();
    }, { threshold: [0, 0.25] }) : null;
    observer?.observe(video);
    releaseVideo = () => {
      disposed = true; observer?.disconnect();
      videoDialog.removeEventListener("close", restoreVideo);
      if (videoDialog.open) { videoDialog.close(); home.prepend(video); }
      document.removeEventListener("visibilitychange", onVisibility);
      motionPreference.removeEventListener("change", onMotionPreference);
      video.removeEventListener("playing", onPlaying); video.removeEventListener("pause", onPause); video.removeEventListener("error", onError);
      video.pause(); video.removeAttribute("src"); video.load();
      releaseVideo = () => {};
    };
  }
  const dialog = $("#image-dialog");
  $("#close-video").addEventListener("click", () => $("#video-dialog").close());
  $("#video-dialog").addEventListener("click", (e) => {
    const modal = $("#video-dialog"), r = modal.getBoundingClientRect();
    if (e.target === modal && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) modal.close();
  });
  let lightboxTrigger;
  document.addEventListener("click", (event) => {
    const b = event.target.closest("[data-category-jump], [data-method], [data-example-group], [data-example-item], [data-video-item], [data-example-mode], [data-lightbox]");
    if (!b) return;
    if (b.hasAttribute("data-category-jump")) { reset(); state.category = b.dataset.categoryJump; update(); }
    if (b.hasAttribute("data-method")) {
      const entry = state.entries.find((e) => e.id === b.dataset.method);
      if (entry) { reset(); state.query = entry.name; state.category = entry.category; state.view = "cards"; syncInputs(); update(); location.hash = "collection"; $("#search").focus({ preventScroll: true }); scrollTo("#collection"); }
    }
    if (b.hasAttribute("data-example-group") && showcase) renderExamples(b.dataset.exampleGroup);
    if (b.hasAttribute("data-example-mode") && (showcase || b.dataset.exampleMode === "interactive")) { exampleMode = b.dataset.exampleMode; renderExamples(activeExampleGroup); }
    if (b.hasAttribute("data-video-item") && videoShowcase) {
      renderExamples(b.dataset.group, b.dataset.videoItem);
      $(`[data-video-item="${b.dataset.videoItem}"]`).focus({ preventScroll: true });
      const bounds = $("#example-video").getBoundingClientRect();
      if (bounds.top < 0 || bounds.bottom > window.innerHeight) scrollTo(".video-player");
    }
    if (b.hasAttribute("data-example-item") && showcase) {
      const itemId = b.dataset.exampleItem;
      renderExamples(b.dataset.group, itemId);
      $(`[data-example-item="${itemId}"]`).focus({ preventScroll: true });
    }
    if (b.hasAttribute("data-lightbox") && localImage(b.dataset.lightbox)) {
      lightboxTrigger = b; $("#lightbox-image").src = b.dataset.lightbox;
      $("#lightbox-image").alt = b.querySelector("img")?.alt || b.dataset.caption || "Expanded research illustration";
      $("#lightbox-caption").textContent = b.dataset.caption || "Research illustration";
      dialog.showModal();
    }
  });
  $("#close-lightbox").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
  dialog.addEventListener("close", () => lightboxTrigger?.focus({ preventScroll: true }));
  document.addEventListener("keydown", (event) => {
    const active = document.activeElement;
    if (active.matches("[role=tab]") && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      const tabs = [...active.closest("[role=tablist]").querySelectorAll("[role=tab]")];
      const index = tabs.indexOf(active);
      const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      event.preventDefault(); tabs[next].focus(); tabs[next].click();
    }
    if (event.key === "/" && !dialog.open && !$("#video-dialog").open && !/INPUT|TEXTAREA|SELECT/.test(active.tagName) && !active.isContentEditable && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); $("#search").focus(); }
  });
  $("#copy-citation").addEventListener("click", async () => {
    const b = $("#copy-citation");
    try { await navigator.clipboard.writeText($("#citation-text").textContent); b.textContent = "Copied!"; $("#copy-status").textContent = "Citation copied to clipboard."; }
    catch { const range = document.createRange(); range.selectNodeContents($("#citation-text")); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); b.textContent = "Select & copy"; $("#copy-status").textContent = "Citation selected. Press Control+C or Command+C to copy."; }
    setTimeout(() => { b.textContent = "Copy citation"; }, 2500);
  });
  const fetchJSON = async (path) => { const r = await fetch(path); if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); };
  async function load() {
    const results = await Promise.allSettled(["catalogue", "research-guide", "showcase", "videos"].map((name) => fetchJSON(`data/${name}.json`)));
    const [catalogue, guide, examples, videos] = results;
    if (videos.status === "fulfilled" && videos.value.groups?.length) videoShowcase = videos.value;
    else { exampleMode = "figures"; $('[data-example-mode="videos"]').disabled = true; }
    if (catalogue.status === "fulfilled" && Array.isArray(catalogue.value.entries)) {
      fieldNotes = catalogue.value.field_notes || {};
      state.entries = catalogue.value.entries.map((e) => ({ ...e, searchText: searchText(e) }));
      [...new Set(state.entries.map((e) => e.year))].filter(Boolean).sort((a, b) => b - a).forEach((year) => { const o = document.createElement("option"); o.value = String(year); o.textContent = String(year); $("#year").append(o); });
      catalogueReady = true; readFilters(); render(); renderTaxonomy("assets");
    } else {
      $("#result-count").textContent = "Catalogue could not be loaded";
      $("#paper-list").innerHTML = '<p class="empty-state">Please reload or <a href="data/catalogue.json">download the catalogue</a>.</p>';
      $("#taxonomy-panel").textContent = "Reload the page to explore the taxonomy.";
    }
    if (guide.status === "fulfilled") renderGuide(guide.value);
    else ["#benchmark-grid", "#agenda-list"].forEach((id) => { $(id).innerHTML = '<p class="empty-state">Please reload or <a href="data/research-guide.json">open the research guide</a>.</p>'; });
    if (examples.status === "fulfilled" && examples.value.groups?.length) {
      showcase = examples.value;
      $("#example-tabs").innerHTML = showcase.groups.map((g, i) => `<button type="button" role="tab" id="example-tab-${esc(g.id)}" aria-controls="example-panel" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-example-group="${esc(g.id)}">${esc(g.title)}</button>`).join("");
      renderExamples(showcase.groups[0].id);
    } else $("#example-panel").innerHTML = '<p class="empty-state">Please reload or <a href="data/showcase.json">view the visual example index</a>.</p>';
  }
  // Preserve section links when their content is collapsed by default.
  function revealAnchor() {
    const target = document.getElementById(location.hash.slice(1));
    if (!target) return;
    let node = target;
    while (node) { if (node.tagName === "DETAILS") node.open = true; node = node.parentElement; }
    if (target.closest("details")) target.scrollIntoView();
  }
  window.addEventListener("hashchange", revealAnchor);
  revealAnchor();
  load().catch((error) => console.error("Page initialization failed", error));
})();
