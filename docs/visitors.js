"use strict";
(() => {
  const counter = document.getElementById("visitor-counter");
  if (!counter) return;

  const page = "https://edhuang1.github.io/xr-survey/";
  const production = location.origin === "https://edhuang1.github.io"
    && /^\/xr-survey\/(?:index\.html)?$/.test(location.pathname);
  const optedOut = navigator.globalPrivacyControl === true
    || navigator.doNotTrack === "1" || window.doNotTrack === "1";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  // page_uv is an IP + User-Agent estimate for this page, not all GitHub projects.
  // Previews and opted-out visitors read the total without incrementing it.
  fetch("https://bsz.iirose.cn/api", {
    method: production && !optedOut ? "POST" : "GET",
    headers: { "x-bsz-referer": page },
    credentials: "omit",
    referrerPolicy: "no-referrer",
    cache: "no-store",
    signal: controller.signal,
  }).then((response) => {
    if (!response.ok) throw new Error("Counter unavailable");
    return response.json();
  }).then((result) => {
    const count = result?.data?.page_uv;
    if (result.success !== true || !Number.isSafeInteger(count) || count < 0) {
      throw new Error("Invalid visitor count");
    }
    counter.textContent = `Visitors: ${count.toLocaleString("en-US")}`;
  }).catch((error) => {
    // Never invent a total or block the rest of the page when the service fails.
    counter.textContent = "Visitors: unavailable";
    console.warn("Visitor counter unavailable:", error.message);
  }).finally(() => clearTimeout(timeout));
})();
