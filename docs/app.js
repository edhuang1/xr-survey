"use strict";
(() => {
  const $ = (s) => document.querySelector(s);
  const state = { entries: [], category: "all", query: "", year: "all", sort: "newest", page: 1 };
  const pageSize = 12;
  let fieldNotes = {};
  const displayField = (key, value) => {
    const dictionary = ["Stage", "Evaluation"].includes(key) && fieldNotes[key]
      ? Object.fromEntries(fieldNotes[key].replace(/\.$/, "").split(";").map((pair) => pair.split(":").map((part) => part.trim()))) : null;
    if (dictionary && typeof value === "string") return value.split("/").map((part) => dictionary[part.trim()] || part.trim()).join(" / ");
    return Array.isArray(value) ? value.join(", ") : value;
  };
  const labels = { assets: "3D assets", scenes: "Spatial scenes", temporal: "Time & worlds", xr: "XR systems", resources: "Resources" };
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (value) => { try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : ""; } catch { return ""; } };
  const paperLink = (url, text, className = "") => safeUrl(url) ? `<a class="${className}" href="${escape(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${text}</a>` : "";
  const searchText = (entry) => [entry.name, entry.title, entry.venue, entry.year, entry.category_label, entry.group, entry.description, entry.bibkey, JSON.stringify(entry.fields || {}), entry.authors].join(" ").toLocaleLowerCase();

  function readFilters() {
    const params = new URLSearchParams(location.search);
    if (params.has("q")) state.query = params.get("q");
    if (Object.hasOwn(labels, params.get("category"))) state.category = params.get("category");
    if (["newest", "oldest", "name"].includes(params.get("sort"))) state.sort = params.get("sort");
    const year = params.get("year");
    if (year && state.entries.some((entry) => String(entry.year) === year)) state.year = year;
    $("#search").value = state.query;
    $("#year").value = state.year;
    $("#sort").value = state.sort;
  }

  function saveFilters() {
    const params = new URLSearchParams();
    if (state.query) params.set("q", state.query);
    if (state.category !== "all") params.set("category", state.category);
    if (state.year !== "all") params.set("year", state.year);
    if (state.sort !== "newest") params.set("sort", state.sort);
    const query = params.toString();
    history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
  }

  function render() {
    const terms = state.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const filtered = state.entries.filter((entry) =>
      (state.category === "all" || entry.category === state.category) &&
      (state.year === "all" || String(entry.year) === state.year) &&
      terms.every((term) => entry.searchText.includes(term))
    ).sort((a, b) => state.sort === "name" ? a.name.localeCompare(b.name) :
      (state.sort === "oldest" ? a.year - b.year : b.year - a.year) || a.name.localeCompare(b.name));
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    state.page = Math.min(state.page, pages);
    const start = (state.page - 1) * pageSize;
    $("#result-count").textContent = filtered.length ? `${start + 1}–${Math.min(start + pageSize, filtered.length)} of ${filtered.length} records` : "0 records";
    document.querySelectorAll("[data-category]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.category === state.category)));
    $("#paper-list").innerHTML = filtered.slice(start, start + pageSize).map((entry) => {
      const primary = safeUrl(entry.paper_url || entry.url);
      const title = primary ? `<a href="${escape(primary)}" target="_blank" rel="noopener noreferrer">${escape(entry.name)}</a>` : escape(entry.name);
      const fields = Object.entries(entry.fields || {}).map(([key, value]) => `<strong>${escape(key.replace(/_/g, " "))}:</strong> ${escape(displayField(key, value))}`).join("<br>");
      return `<article class="paper-card" data-id="${escape(entry.id)}"><div class="paper-year">${escape(entry.year)}</div><div class="paper-content"><h3>${title}</h3><p class="paper-title">${escape(entry.title)}</p><div class="paper-meta"><span class="category-tag">${escape(labels[entry.category])}</span><span class="paper-venue">${escape(entry.venue)}</span></div><details><summary>Catalogue details · ${escape(entry.id)}</summary><p>${escape(entry.description)}</p>${fields ? `<p>${fields}</p>` : ""}<p>Reference key: ${escape(entry.bibkey)}</p></details></div><div class="paper-links">${paperLink(primary, "Source ↗", "primary-link")}${entry.project_url && safeUrl(entry.project_url) !== primary ? paperLink(entry.project_url, "Project ↗") : ""}</div></article>`;
    }).join("");
    $("#empty-state").hidden = filtered.length > 0;
    $("#pagination").hidden = pages <= 1;
    $("#page-status").textContent = `Page ${state.page} of ${pages}`;
    $("#previous-page").disabled = state.page === 1;
    $("#next-page").disabled = state.page === pages;
  }

  function update() { state.page = 1; render(); saveFilters(); }
  function setCategory(category) { state.category = category; update(); }
  function reset() { state.category = "all"; state.query = ""; state.year = "all"; state.sort = "newest"; $("#search").value = ""; $("#year").value = "all"; $("#sort").value = "newest"; update(); }
  $("#search").addEventListener("input", (event) => { state.query = event.target.value; update(); });
  $("#year").addEventListener("change", (event) => { state.year = event.target.value; update(); });
  $("#sort").addEventListener("change", (event) => { state.sort = event.target.value; update(); });
  $("#reset-filters").addEventListener("click", reset);
  document.querySelectorAll("[data-category]").forEach((button) => button.addEventListener("click", () => setCategory(button.dataset.category)));
  document.querySelectorAll("[data-category-jump]").forEach((link) => link.addEventListener("click", () => { reset(); setCategory(link.dataset.categoryJump); }));
  ["previous", "next"].forEach((direction) => $(`#${direction}-page`).addEventListener("click", () => { state.page += direction === "next" ? 1 : -1; render(); $("#collection").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); }));
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.activeElement.isContentEditable) { event.preventDefault(); $("#search").focus(); }
  });
  window.addEventListener("popstate", () => { state.category = "all"; state.query = ""; state.year = "all"; state.sort = "newest"; state.page = 1; readFilters(); render(); });
  $("#copy-citation").addEventListener("click", async () => {
    const button = $("#copy-citation");
    try { await navigator.clipboard.writeText($("#citation-text").textContent); button.textContent = "Copied!"; $("#copy-status").textContent = "Citation copied to clipboard."; }
    catch { const range = document.createRange(); range.selectNodeContents($("#citation-text")); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); button.textContent = "Select & copy"; $("#copy-status").textContent = "Citation selected. Press Control+C or Command+C to copy."; }
    setTimeout(() => { button.textContent = "Copy citation"; }, 2500);
  });
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => { entries.forEach((entry) => { if (entry.isIntersecting) document.querySelectorAll(".sidebar nav a").forEach((link) => { const active = link.hash === `#${entry.target.id}`; link.classList.toggle("active", active); if (active) link.setAttribute("aria-current", "location"); else link.removeAttribute("aria-current"); }); }); }, { rootMargin: "-5% 0px -70% 0px" });
    document.querySelectorAll("main section[id]").forEach((section) => observer.observe(section));
  }
  async function load() {
    try {
      const response = await fetch("data/catalogue.json");
      if (!response.ok) throw new Error(`Catalogue request failed: ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.entries)) throw new Error("Invalid catalogue format");
      fieldNotes = data.field_notes || {};
      state.entries = data.entries.map((entry) => ({ ...entry, searchText: searchText(entry) }));
      [...new Set(state.entries.map((entry) => entry.year))].filter(Boolean).sort((a, b) => b - a).forEach((year) => { const option = document.createElement("option"); option.value = String(year); option.textContent = String(year); $("#year").append(option); });
      readFilters(); render();
    } catch (error) {
      $("#result-count").textContent = "Catalogue could not be loaded";
      $("#paper-list").innerHTML = '<p class="empty-state">Please reload the page or <a href="data/catalogue.json">download the catalogue</a>.</p>';
      console.error(error);
    }
    try { const response = await fetch("data/project.json"); if (response.ok) { const project = await response.json(); if (project.abstract) $("#abstract-text").textContent = project.abstract; } } catch { /* The static abstract remains available. */ }
    try { const response = await fetch("site-config.json"); if (response.ok) { const config = await response.json(); const repository = safeUrl(config.repository); if (repository && new URL(repository).hostname === "github.com") document.querySelectorAll(".repository-link").forEach((link) => { link.href = repository; link.hidden = false; }); } } catch { /* Repository links appear after deployment is configured. */ }
  }
  load();
})();
