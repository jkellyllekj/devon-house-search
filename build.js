const fs = require("fs");
const path = require("path");

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "data.json"), "utf8"));
const props = data.properties;

const SECTION_TITLES = {
  pinned: "Jesse's Top Pick",
  new: "New This Sweep",
  still: "Still Listed",
  background: "Also On File (background)",
};
const SECTION_ORDER = ["pinned", "new", "still", "background"];

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function flagHtml(f) {
  return `<span class="flag" style="background:${f.color}">${esc(f.text)}</span>`;
}

function photosHtml(id, photos) {
  if (!photos.length) {
    return `<div class="no-photo">No photo available this sweep</div>`;
  }
  const imgs = photos.map((p, i) => `<img src="images/${p}" alt="${esc(id)} photo ${i + 1}" loading="lazy" class="gallery-img${i === 0 ? " active" : ""}">`).join("");
  const nav = photos.length > 1 ? `
        <button class="gallery-nav gallery-prev" type="button" aria-label="Previous photo">‹</button>
        <button class="gallery-nav gallery-next" type="button" aria-label="Next photo">›</button>
        <div class="gallery-counter"><span class="gallery-current">1</span> / ${photos.length}</div>` : "";
  return `
    <div class="gallery">
      <div class="gallery-viewport">
        ${imgs}
        ${nav}
      </div>
    </div>
  `;
}

function floorplansHtml(id, floorplans) {
  if (!floorplans || !floorplans.length) return "";
  const imgs = floorplans.map((f, i) =>
    `<img src="images/${f}" alt="${esc(id)} floor plan ${i + 1}" loading="lazy" class="floorplan-img" data-lightbox-src="images/${f}">`
  ).join("");
  return `<div class="floorplans"><div class="floorplans-label">📐 Floor plan${floorplans.length > 1 ? "s" : ""}</div><div class="floorplans-row">${imgs}</div></div>`;
}

function bedsBathsHtml(p) {
  const parts = [];
  if (p.bedrooms !== undefined && p.bedrooms !== null) parts.push(`🛏 ${esc(String(p.bedrooms))} bed${p.bedrooms == 1 ? "" : "s"}`);
  if (p.bathrooms !== undefined && p.bathrooms !== null) parts.push(`🛁 ${esc(String(p.bathrooms))} bath${p.bathrooms == 1 ? "" : "s"}`);
  if (!parts.length) return "";
  return `<div class="beds-baths">${parts.join(" &nbsp;·&nbsp; ")}</div>`;
}

function tenureHtml(p) {
  const c = p.checklist || {};
  if (c.tenure === "freehold") {
    return `<div class="tenure-badge tenure-freehold">🏠 Freehold</div>`;
  }
  if (c.tenure === "leasehold") {
    const label = c.leaseYears ? `📜 Leasehold — ${c.leaseYears} yrs remaining` : `📜 Leasehold — years unknown, ask agent`;
    return `<div class="tenure-badge tenure-leasehold">${label}</div>`;
  }
  return `<div class="tenure-badge tenure-unknown">❓ Tenure not stated</div>`;
}

function parsePrice(str) {
  if (!str) return null;
  const m = String(str).replace(/,/g, "").match(/£\s*(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

const PARKING_LABELS = {
  has: "🅿️ Has parking",
  onstreet: "🅿️ On-street parking only",
  none: "🚫 No parking",
  unknown: "❓ Parking unclear",
};

function parkingHtml(p) {
  const pk = p.parking;
  if (!pk) return "";
  const label = PARKING_LABELS[pk.status] || "🅿️ Parking";
  return `<div class="parking-block"><strong>${label}</strong>${pk.note ? `<span class="parking-note"> — ${esc(pk.note)}</span>` : ""}</div>`;
}

const REPO = "jkellyllekj/devon-house-search";
const WORKER_URL = "https://devon-house-worker.jessekellyuk.workers.dev";

function commentsBlockHtml(p) {
  return `
    <div class="comments-block">
      <h3>💬 Family Comments</h3>
      <p class="rating-hint">💡 Ratings live in the box above now — tap or drag your row (B1/B2/B3) there to rate instantly, nothing to submit. Down here is just for comments: pick who you are and post whenever.</p>
      <div class="family-feed" data-property="${esc(p.id)}">Loading…</div>
      <div class="family-post">
        <div class="family-who">
          <span class="family-who-label">Posting as:</span>
          <button type="button" class="bro-select-btn bro-select-1" data-bro="Bro 1">Bro 1</button>
          <button type="button" class="bro-select-btn bro-select-2" data-bro="Bro 2">Bro 2</button>
          <button type="button" class="bro-select-btn bro-select-3" data-bro="Bro 3">Bro 3</button>
        </div>
        <textarea class="family-input" placeholder="Write a comment…"></textarea>
        <div class="family-controls">
          <button class="family-post-btn" data-property="${esc(p.id)}">Post</button>
          <span class="family-status"></span>
        </div>
      </div>
    </div>
  `;
}

function askClaudeHtml(p) {
  return `
    <div class="ask-claude-block">
      <div class="mini-form">
        <textarea class="research-input" placeholder="What should Claude look into? (a specific risk, local news, planning history, why the price is what it is…)"></textarea>
        <button class="research-post-btn" data-property="${esc(p.id)}" data-title="${esc(p.title)}">🔍 Ask Claude to research this</button>
        <span class="mini-status"></span>
      </div>
      <div class="mini-form">
        <textarea class="remove-input" placeholder="Reason for removal (optional)…"></textarea>
        <button class="remove-post-btn" data-property="${esc(p.id)}" data-title="${esc(p.title)}">Request removal</button>
        <span class="mini-status"></span>
      </div>
      <span class="notes-caveat">No sign-in needed — Claude actions these on the next daily sweep, not instantly.</span>
    </div>
  `;
}

function sourceBadgeHtml(p) {
  let domain;
  try { domain = new URL(p.link).hostname.replace(/^www\./, ""); } catch (e) { domain = p.linkLabel; }
  return `<a class="source-badge" href="${esc(p.link)}" target="_blank" rel="noopener">View on ${esc(domain.toUpperCase())} ↗</a>`;
}

const BROTHER_SLOTS = ["Bro 1", "Bro 2", "Bro 3"];
const BROTHER_WEIGHTS = { "Bro 1": 1, "Bro 2": 1, "Bro 3": 2 };

function ratingBarColor(score) {
  const pct = Math.max(0, Math.min(10, score)) / 10;
  const r = Math.round(211 - pct * (211 - 46));
  const g = Math.round(47 + pct * (125 - 47));
  const b = 60;
  return `rgb(${r},${g},${b})`;
}

function ratingRowHtml(label, score, cls, propertyId, bro) {
  const interactive = Boolean(propertyId && bro);
  const dataAttrs = interactive ? ` data-property="${esc(propertyId)}" data-bro="${esc(bro)}"` : "";
  const trackClass = "rating-bar-track" + (interactive ? " interactive" : "");
  const thumb = (pct) => interactive ? `<div class="rating-thumb" style="left:${pct}%"></div>` : "";
  const flash = interactive ? `<span class="rating-row-flash"></span>` : "";
  if (score === null || score === undefined) {
    return `
      <div class="rating-row rating-row-empty ${cls}"${dataAttrs}>
        <span class="rating-row-label">${esc(label)}</span>
        <div class="${trackClass}"><div class="rating-bar-fill" style="width:0%"></div>${thumb(0)}</div>
        <span class="rating-row-score">not yet rated</span>
        ${flash}
      </div>
    `;
  }
  const scoreLabel = Number.isInteger(score) ? score : score.toFixed(1);
  const flames = "🔥".repeat(Math.round(score)) || "";
  return `
    <div class="rating-row ${cls}"${dataAttrs}>
      <span class="rating-row-label">${esc(label)}</span>
      <div class="${trackClass}"><div class="rating-bar-fill" style="width:${score * 10}%;background:${ratingBarColor(score)}"></div>${thumb(score * 10)}</div>
      <span class="rating-row-score">${esc(scoreLabel)}/10</span>
      <span class="rating-row-flames">${flames}</span>
      ${flash}
    </div>
  `;
}

function computeOverall(p) {
  const ratings = p.ratings || {};
  let total = 0, weight = 0;
  if (p.aiRating !== undefined && p.aiRating !== null) { total += p.aiRating * 1; weight += 1; }
  BROTHER_SLOTS.forEach(label => {
    if (ratings[label] !== undefined) { total += ratings[label].score * BROTHER_WEIGHTS[label]; weight += BROTHER_WEIGHTS[label]; }
  });
  return weight ? total / weight : null;
}

function ratingsHtml(p) {
  const ratings = p.ratings || {};
  const rows = [
    ratingRowHtml("⭐", computeOverall(p), "rating-row-overall"),
    ...BROTHER_SLOTS.map(label => ratingRowHtml(label.replace("Bro ", "B"), ratings[label] !== undefined ? ratings[label].score : null, "", p.id, label)),
    ratingRowHtml("🤖", (p.aiRating !== undefined && p.aiRating !== null) ? p.aiRating : null, "rating-row-ai"),
  ].join("");
  return `<div class="ratings-block" title="Tap or drag your row (B1/B2/B3) to rate — saves instantly, no submit needed">${rows}<div class="ratings-caption">Tap/drag B1–B3 to rate</div></div>`;
}

function avgRating(p) {
  const entries = Object.entries(p.ratings || {});
  if (!entries.length) return null;
  let total = 0, weight = 0;
  entries.forEach(([label, r]) => {
    const w = BROTHER_WEIGHTS[label] || 1;
    total += r.score * w;
    weight += w;
  });
  return weight ? total / weight : null;
}

const CHECKLIST_ITEMS = [
  { key: "ocean", label: "🌊 Close to ocean" },
  { key: "trainStation", label: "🚉 Close to train station" },
  { key: "poolSwimTeam", label: "🏊 Close to pool/swim team" },
  { key: "private", label: "🔒 Private/secluded" },
  { key: "mtbTrails", label: "🚵 Close to Woodbury Common/MTB trails" },
  { key: "character", label: "✨ Has character" },
  { key: "garden", label: "🌳 Has a garden" },
  { key: "garageWorkspace", label: "🔧 Garage/shed/workspace" },
  { key: "closeToFamily", label: "👨‍👩‍👦 Close to Exmouth/brothers" },
];

const GROUND_FLOOR_LABELS = {
  yes: "♿ Already ground-floor livable",
  adaptable: "♿ Could adapt to ground-floor living",
  no: "♿ Not realistically ground-floor adaptable",
};

function normalizeChecklistVal(raw) {
  if (raw === "yes") return "good";
  if (raw === "no") return "bad";
  if (raw === "partial" || raw === "adaptable") return "indifferent";
  return "indifferent";
}

function clItemHtml(p, key, label, rawVal) {
  const norm = normalizeChecklistVal(rawVal);
  return `<div class="cl-item" data-cl-key="${esc(key)}" data-cl-default="${norm}" data-prop="${esc(p.id)}" onclick="cycleChecklist(this)">${esc(label)}</div>`;
}

function checklistHtml(p) {
  const c = p.checklist || {};
  const items = CHECKLIST_ITEMS.map(item => ({ key: item.key, label: item.label, raw: c[item.key] }));
  items.push({ key: "groundFloorLongTerm", label: GROUND_FLOOR_LABELS[c.groundFloorLongTerm] || "♿ Ground-floor adaptability unknown", raw: c.groundFloorLongTerm === "yes" ? "yes" : c.groundFloorLongTerm === "no" ? "no" : "partial" });
  const rowsHtml = items.map(item => clItemHtml(p, item.key, item.label, item.raw)).join("");
  const unique = c.uniqueFeature ? `<div class="cl-unique">🎁 <strong>Unique:</strong> ${esc(c.uniqueFeature)}</div>` : "";
  return `
    <div class="checklist-block">
      <h3>Jesse's Checklist <span class="cl-hint">(click any item to override — it's your read, not just the AI's)</span></h3>
      <div class="cl-columns">
        <div class="cl-col cl-col-good"><h4>✓ What's great</h4><div class="cl-col-body" data-col="good"></div></div>
        <div class="cl-col cl-col-bad"><h4>✕ What's missing</h4><div class="cl-col-body" data-col="bad"></div></div>
      </div>
      <div class="cl-indifferent" data-col="indifferent"><span class="cl-indifferent-label">≈ Doesn't matter here / unclear:</span></div>
      <div class="cl-source" style="display:none">${rowsHtml}</div>
      ${unique}
    </div>
  `;
}

function aiTakeHtml(p) {
  if (!p.aiTake) return "";
  return `<p class="ai-take">🤖 <strong>AI's take:</strong> ${esc(p.aiTake)}</p>`;
}

function researchHtml(p) {
  const items = p.research || [];
  if (!items.length) return "";
  return `
    <div class="research-block">
      <h3>Research findings</h3>
      ${items.map(r => `
        <div class="research-item">
          <p class="research-q"><strong>Asked:</strong> ${esc(r.question)} <span class="research-date">(${esc(r.date)})</span></p>
          <p class="research-a">${esc(r.findings)}</p>
          ${(r.sources || []).length ? `<p class="research-sources">Sources: ${r.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join(" · ")}</p>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

function overviewMapHtml(items) {
  const points = items.filter(p => typeof p.lat === "number" && typeof p.lng === "number");
  const data = points.map(p => {
    const sold = (p.flags || []).some(f => /SOLD|WITHDRAWN/.test(f.text));
    const photo = (p.photos && p.photos[0]) ? `images/${p.photos[0]}` : "";
    return {
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      title: p.title,
      price: p.price,
      photo,
      sold,
    };
  });
  return `
  <div class="overview-map-wrap">
    <div class="overview-map-head">
      <h2>Map overview — ${points.length} propert${points.length === 1 ? "y" : "ies"}</h2>
      <span class="overview-map-hint">Click a pin to preview, then jump to the full listing below</span>
    </div>
    <div id="overviewMap"></div>
  </div>
  <script>window.__OVERVIEW_MAP_DATA__ = ${JSON.stringify(data)};</script>
  `;
}

function mapQuery(p) {
  return p.title.replace(/\s*\([^)]*\)/g, "").trim() + ", Devon, UK";
}

function mapEmbedHtml(p) {
  const q = encodeURIComponent(mapQuery(p));
  return `
    <div class="map-embed">
      <iframe
        src="https://www.google.com/maps?q=${q}&z=15&output=embed"
        width="100%" height="380" style="border:0"
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
        allowfullscreen
      ></iframe>
      <div class="map-links">
        <a href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">Open full Google Maps ↗</a>
        <a href="https://www.google.com/maps/dir/?api=1&destination=${q}" target="_blank" rel="noopener">Directions ↗</a>
      </div>
    </div>
  `;
}

function propertyCard(p) {
  const avg = avgRating(p);
  const aiR = (p.aiRating !== undefined && p.aiRating !== null) ? p.aiRating : "";
  const overall = computeOverall(p);
  const bro3 = (p.ratings && p.ratings["Bro 3"]) ? p.ratings["Bro 3"].score : "";
  const priceVal = parsePrice(p.price);
  return `
  <section class="card" id="${esc(p.id)}" data-avg-rating="${avg !== null ? avg.toFixed(2) : ""}" data-ai-rating="${aiR}" data-overall-rating="${overall !== null ? overall.toFixed(2) : ""}" data-bro3-rating="${bro3}" data-price="${priceVal !== null ? priceVal : ""}" data-date-added="${esc(p.dateAdded)}" data-town="${esc(p.town || "")}">
    <div class="card-head">
      <div class="card-head-main">
        <h2>${esc(p.title)}</h2>
        <div class="price-row">
          <span class="price">${esc(p.price)}</span>
        </div>
        ${bedsBathsHtml(p)}
        ${tenureHtml(p)}
        ${sourceBadgeHtml(p)}
      </div>
      <div class="card-head-ratings">
        ${ratingsHtml(p)}
      </div>
    </div>
    <div class="flags">${p.flags.map(flagHtml).join("")}</div>
    ${parkingHtml(p)}
    <div class="photos">${photosHtml(p.id, p.photos)}</div>
    ${floorplansHtml(p.id, p.floorplans)}
    ${mapEmbedHtml(p)}
    <p class="body">${esc(p.body)}</p>
    <p class="why"><strong>Why it's here:</strong> ${esc(p.why)}</p>
    ${aiTakeHtml(p)}
    ${researchHtml(p)}
    ${checklistHtml(p)}
    ${askClaudeHtml(p)}
    ${commentsBlockHtml(p)}
    <div class="added">Added ${esc(p.dateAdded)}</div>
  </section>`;
}

function byDateAddedDesc(a, b) { return (b.dateAdded || "").localeCompare(a.dateAdded || ""); }

const orderedProps = SECTION_ORDER.flatMap(sec => props.filter(p => p.section === sec).slice().sort(byDateAddedDesc));

const navLinks = orderedProps.map(p => `<a href="#${esc(p.id)}">${esc(p.title.split(",")[0].split(" (")[0])}</a>`).join("");

const townCounts = {};
props.forEach(p => { if (p.town) townCounts[p.town] = (townCounts[p.town] || 0) + 1; });
const townOptions = Object.keys(townCounts).sort().map(t =>
  `<option value="${esc(t)}">${esc(t)} (${townCounts[t]})</option>`
).join("");

const sections = SECTION_ORDER.filter(s => props.some(p => p.section === s)).map(sec => {
  const items = props.filter(p => p.section === sec).slice().sort(byDateAddedDesc);
  return `<h1 class="section-title">${SECTION_TITLES[sec]}</h1>` + items.map(propertyCard).join("\n");
}).join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Devon House Search</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<style>
  :root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; }
  body { margin: 0; background: #f4f1ea; color: #222; }
  header { background: #1b3a2f; color: #fff; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
  .header-left { min-width: 0; }
  header h1 { margin: 0; font-size: 20px; }
  header .sub { color: #cfe0d6; font-size: 12px; margin-top: 2px; }
  .header-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
  .submit-form { position: relative; }
  #submitPanel { position: absolute; right: 0; top: 100%; background: #fff; border-radius: 8px; padding: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.2); z-index: 1000; width: 300px; box-sizing: border-box; }
  .submit-link { display: inline-block; background: #E65100; color: #fff; font-weight: 700; font-size: 12px; padding: 6px 14px; border-radius: 16px; text-decoration: none; border: none; font-family: inherit; cursor: pointer; white-space: nowrap; }
  .submit-link:hover { background: #ff6f1a; }
  .sort-row { font-size: 12px; display: flex; align-items: center; gap: 6px; }
  .sort-row label { color: #cfe0d6; }
  .sort-row select { font-size: 12px; padding: 3px 6px; border-radius: 4px; border: 1px solid #3f6a55; background: #23483a; color: #fff; }
  nav { background: #23483a; padding: 10px 20px; overflow-x: auto; white-space: nowrap; position: sticky; top: 0; z-index: 10; }
  nav a { color: #d9ecdf; text-decoration: none; font-size: 13px; margin-right: 16px; }
  nav a:hover { text-decoration: underline; }
  main { max-width: 880px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; }
  .overview-map-wrap { margin: 4px 0 20px; }
  .overview-map-head { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
  .overview-map-head h2 { margin: 0; font-size: 17px; color: #1b3a2f; }
  .overview-map-hint { font-size: 12px; color: #777; }
  #overviewMap { width: 100%; height: 440px; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.12); background: #eee; }
  .map-pin-popup { width: 200px; }
  .map-pin-popup img { width: 100%; height: 110px; object-fit: cover; border-radius: 6px 6px 0 0; display: block; }
  .map-pin-popup .mpp-body { padding: 8px 2px 2px; }
  .map-pin-popup .mpp-title { font-weight: 700; font-size: 13px; line-height: 1.3; margin: 0 0 3px; color: #1b3a2f; }
  .map-pin-popup .mpp-price { font-size: 13px; font-weight: 700; color: #1b5e20; margin: 0 0 6px; }
  .map-pin-popup .mpp-link { display: inline-block; background: #1b3a2f; color: #fff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 14px; text-decoration: none; }
  .map-pin-popup .mpp-link:hover { background: #23483a; }
  .map-pin-popup .mpp-sold { display: inline-block; background: #8D6E63; color: #fff; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-bottom: 4px; }
  .leaflet-popup-content-wrapper { padding: 0; overflow: hidden; border-radius: 8px; }
  .leaflet-popup-content { margin: 0; width: 200px !important; }
  .section-title { margin-top: 30px; border-bottom: 3px solid #1b3a2f; padding-bottom: 6px; font-size: 20px; color: #1b3a2f; }
  .card { background: #fff; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.12); padding: 16px; margin: 12px 0; scroll-margin-top: 60px; }
  .card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; flex-wrap: wrap; margin-bottom: 8px; }
  .card-head-main { flex: 1 1 260px; min-width: 220px; }
  .card-head-ratings { flex: 0 0 auto; width: 170px; }
  .card h2 { margin: 0 0 6px; font-size: 18px; }
  .price-row { display: flex; align-items: baseline; gap: 10px; margin-bottom: 6px; flex-wrap: wrap; }
  .price { font-size: 18px; font-weight: 700; color: #1b5e20; }
  .beds-baths { font-size: 13px; color: #444; font-weight: 600; margin-bottom: 6px; }
  .tenure-badge { display: inline-block; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 14px; margin-bottom: 8px; }
  .tenure-freehold { background: #e6f4ea; color: #1b5e20; }
  .tenure-leasehold { background: #fff3e0; color: #9a5300; }
  .tenure-unknown { background: #eee; color: #777; }
  .flags { margin-bottom: 10px; }
  .flag { display: inline-block; color: #fff; font-weight: 700; font-size: 11px; padding: 4px 8px; border-radius: 4px; margin: 0 6px 6px 0; }
  .parking-block { background: #eef6fb; border-left: 4px solid #1565C0; border-radius: 4px; padding: 7px 10px; font-size: 13px; line-height: 1.45; margin-bottom: 10px; }
  .parking-block .parking-note { color: #333; }
  .photos { margin-bottom: 14px; }
  .floorplans { margin-bottom: 14px; }
  .floorplans-label { font-size: 13px; font-weight: 700; color: #444; margin-bottom: 6px; }
  .floorplans-row { display: flex; flex-wrap: wrap; gap: 10px; }
  .floorplan-img { max-width: 220px; max-height: 220px; border: 1px solid #ddd; border-radius: 6px; background: #fff; cursor: zoom-in; }
  .lightbox-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 30px; }
  .lightbox-img { max-width: 100%; max-height: 100%; border-radius: 6px; background: #fff; }
  .lightbox-close { position: absolute; top: 16px; right: 20px; background: rgba(255,255,255,0.15); color: #fff; border: none; width: 40px; height: 40px; border-radius: 50%; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .lightbox-close:hover { background: rgba(255,255,255,0.3); }
  .gallery-viewport { position: relative; border-radius: 8px; overflow: hidden; background: #eee; height: 380px; }
  .gallery-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: none; }
  .gallery-img.active { display: block; }
  .gallery-nav { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.45); color: #fff; border: none; width: 36px; height: 36px; border-radius: 50%; font-size: 20px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .gallery-nav:hover { background: rgba(0,0,0,0.7); }
  .gallery-prev { left: 10px; }
  .gallery-next { right: 10px; }
  .gallery-counter { position: absolute; right: 10px; bottom: 10px; background: rgba(0,0,0,0.55); color: #fff; font-size: 12px; padding: 3px 8px; border-radius: 10px; }
  .no-photo { background: #eee; border-radius: 8px; padding: 40px; text-align: center; color: #888; font-size: 13px; }
  .map-embed { margin-bottom: 14px; }
  .map-embed iframe { width: 100%; border-radius: 8px; display: block; }
  .map-links { display: flex; justify-content: flex-end; gap: 20px; margin-top: 6px; }
  .map-links a { font-size: 13px; color: #1155cc; text-decoration: none; font-weight: 600; }
  .map-links a:hover { text-decoration: underline; }
  .body { line-height: 1.5; }
  .why { background: #fdf6e3; border-left: 4px solid #e6b800; padding: 10px 14px; border-radius: 4px; font-size: 14px; line-height: 1.5; }
  .source-badge { display: inline-block; background: #1b3a2f; color: #fff !important; font-weight: 700; font-size: 12px; letter-spacing: 0.4px; padding: 5px 12px; border-radius: 20px; text-decoration: none; margin-bottom: 0; }
  .source-badge:hover { background: #23483a; }
  .ratings-block { padding: 8px 10px; background: #fafafa; border-radius: 8px; }
  .ratings-caption { font-size: 9px; color: #aaa; text-align: right; margin-top: 2px; }
  .rating-row { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; font-size: 11px; position: relative; }
  .rating-row-label { flex: 0 0 26px; font-weight: 600; color: #333; }
  .rating-row-ai .rating-row-label { color: #6A1B9A; }
  .rating-row-overall .rating-row-label { color: #E65100; font-weight: 800; }
  .rating-bar-track { flex: 1 1 auto; height: 6px; background: #e6e6e6; border-radius: 6px; overflow: hidden; position: relative; }
  .rating-bar-track.interactive { cursor: pointer; overflow: visible; touch-action: none; }
  .rating-bar-track.interactive:hover .rating-bar-fill, .rating-bar-track.interactive:active .rating-bar-fill { filter: brightness(1.08); }
  .rating-thumb { position: absolute; top: 50%; width: 12px; height: 12px; border-radius: 50%; background: #fff; border: 2px solid #E65100; transform: translate(-50%, -50%); pointer-events: none; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
  .rating-bar-fill { height: 100%; border-radius: 8px; transition: width 0.15s; }
  .rating-row-score { flex: 0 0 32px; font-weight: 700; color: #444; text-align: right; font-size: 11px; }
  .rating-row-flames { display: none; }
  .rating-row-flash { position: absolute; right: 0; top: -13px; font-size: 9px; font-weight: 700; color: #2E7D32; }
  .rating-row-empty .rating-row-score { color: #999; font-weight: 400; }
  .checklist-block { margin-bottom: 10px; padding: 10px 12px; background: #f4f8f5; border-radius: 8px; }
  .checklist-block h3 { margin: 0 0 8px; font-size: 12px; color: #1b3a2f; text-transform: uppercase; letter-spacing: 0.5px; }
  .cl-hint { text-transform: none; font-weight: 400; font-size: 11px; color: #888; letter-spacing: normal; }
  .cl-columns { display: flex; gap: 12px; flex-wrap: wrap; }
  .cl-col { flex: 1 1 200px; min-width: 180px; }
  .cl-col h4 { margin: 0 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; }
  .cl-col-good h4 { color: #2E7D32; }
  .cl-col-bad h4 { color: #B71C1C; }
  .cl-col-body { display: flex; flex-direction: column; gap: 3px; min-height: 16px; }
  .cl-item { font-size: 12px; padding: 4px 8px; border-radius: 6px; cursor: pointer; user-select: none; }
  .cl-item.cl-good { background: #e6f4ea; color: #1b5e20; }
  .cl-item.cl-bad { background: #fdeaea; color: #8e1c1c; }
  .cl-item.cl-overridden { border: 1px dashed #999; }
  .cl-indifferent { margin-top: 6px; font-size: 11px; color: #999; display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }
  .cl-indifferent-label { font-weight: 600; }
  .cl-indifferent .cl-item { background: none; padding: 1px 4px; font-size: 11px; color: #999; }
  .cl-unique { margin-top: 6px; font-size: 12px; }
  .ai-take { background: #f3e5f5; border-left: 4px solid #6A1B9A; padding: 8px 12px; border-radius: 4px; font-size: 13px; line-height: 1.45; margin-top: 6px; }
  .research-block { margin-top: 10px; padding: 10px 12px; background: #eef4fb; border-left: 4px solid #1565C0; border-radius: 4px; }
  .research-block h3 { margin: 0 0 6px; font-size: 13px; color: #1b3a2f; }
  .research-item + .research-item { margin-top: 8px; padding-top: 8px; border-top: 1px solid #d6e4f2; }
  .research-q { margin: 0 0 4px; font-size: 12px; color: #444; }
  .research-date { color: #888; font-weight: 400; }
  .research-a { margin: 0 0 4px; font-size: 13px; line-height: 1.45; }
  .research-sources { margin: 0; font-size: 11px; color: #666; }
  .research-sources a { color: #1155cc; }
  .comments-block { margin-top: 10px; padding: 10px 12px; background: #fff8f0; border: 2px solid #E65100; border-radius: 8px; }
  .comments-block h3 { margin: 0 0 6px; font-size: 14px; font-weight: 800; color: #E65100; letter-spacing: 0.3px; }
  .rating-hint { font-size: 10px; color: #8a5a00; margin: 0 0 6px; }
  .family-feed { font-size: 12px; margin-bottom: 8px; max-height: 160px; overflow-y: auto; }
  .fam-comment { background: #f4f4f4; border-radius: 6px; padding: 5px 7px; margin-bottom: 4px; white-space: pre-wrap; }
  .fam-comment-who { font-weight: 700; margin-right: 4px; }
  .fam-bro-1 .fam-comment-who { color: #1565C0; }
  .fam-bro-2 .fam-comment-who { color: #2E7D32; }
  .fam-bro-3 .fam-comment-who { color: #C2185B; }
  .bro-empty { color: #999; font-size: 11px; }
  .family-post { background: #fff; border-radius: 8px; padding: 8px; }
  .family-who { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap; }
  .family-who-label { font-size: 11px; color: #666; font-weight: 600; }
  .bro-select-btn { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 14px; border: 2px solid #ccc; background: #fff; color: #666; cursor: pointer; }
  .bro-select-btn.active { color: #fff; }
  .bro-select-1.active { background: #1565C0; border-color: #1565C0; }
  .bro-select-2.active { background: #2E7D32; border-color: #2E7D32; }
  .bro-select-3.active { background: #C2185B; border-color: #C2185B; }
  .family-input { width: 100%; box-sizing: border-box; min-height: 40px; font-family: inherit; font-size: 12px; padding: 5px 7px; border: 1px solid #ccc; border-radius: 6px; resize: vertical; }
  .family-controls { display: flex; gap: 6px; margin-top: 5px; align-items: center; }
  .family-post-btn { background: #1b3a2f; color: #fff; border: none; border-radius: 16px; padding: 5px 12px; font-size: 11px; font-weight: 600; cursor: pointer; }
  .family-post-btn:hover { background: #23483a; }
  .family-post-btn:disabled { opacity: 0.6; cursor: default; }
  .family-status { display: block; font-size: 10px; color: #888; margin-top: 3px; min-height: 12px; }
  .ask-claude-block { margin-top: 6px; padding-top: 6px; }
  .mini-form { margin-bottom: 8px; }
  .mini-form textarea, .mini-form input[type="text"], .mini-form select { width: 100%; box-sizing: border-box; font-family: inherit; font-size: 12px; padding: 5px 7px; border: 1px solid #ccc; border-radius: 6px; margin-bottom: 5px; }
  .submit-hint { font-size: 11px; color: #9a5300; background: #fff3e0; border-radius: 4px; padding: 6px 8px; margin: 0 0 8px; }
  .mini-form textarea { min-height: 40px; resize: vertical; }
  .mini-form button { background: #1155cc; color: #fff; border: none; border-radius: 16px; padding: 5px 12px; font-size: 11px; font-weight: 600; cursor: pointer; }
  .mini-form button:hover { background: #0d3f99; }
  .mini-form button:disabled { opacity: 0.6; cursor: default; }
  .mini-status { display: block; font-size: 10px; color: #888; margin-top: 3px; min-height: 12px; }
  .submit-form { margin-top: 14px; }
  #submitPanel { margin-top: 10px; max-width: min(420px, calc(100vw - 24px)); }
  .notes-caveat { display: block; font-size: 11px; color: #999; margin-top: 6px; }
  .added { font-size: 11px; color: #aaa; margin-top: 6px; }
  footer { max-width: 880px; margin: 0 auto; padding: 20px; color: #555; font-size: 13px; }
</style>
</head>
<body>
<header>
  <div class="header-left">
    <h1>Devon House Search</h1>
    <div class="sub">Exmouth · Woodbury · Budleigh Salterton · East Devon coast — last updated ${esc(data.lastUpdated)}</div>
  </div>
  <div class="header-right">
    <div class="submit-form">
      <button id="submitToggle" class="submit-link" type="button">📮 Spotted one yourself? Submit a property</button>
      <div id="submitPanel" class="mini-form" style="display:none">
        <input id="submitUrl" type="text" placeholder="Paste the listing URL here">
        <button id="submitPostBtn" type="button">Submit</button>
        <span id="submitStatus" class="mini-status"></span>
      </div>
    </div>
    <div class="sort-row">
      <label for="townFilter">Show:</label>
      <select id="townFilter">
        <option value="all">All towns</option>
        ${townOptions}
      </select>
      <label for="sortControl">Sort:</label>
      <select id="sortControl">
        <option value="default">Default (newest first)</option>
        <option value="overall">Overall rating (high to low)</option>
        <option value="bro3">Bro 3 rating (high to low)</option>
        <option value="price">Price (lowest to highest)</option>
      </select>
    </div>
  </div>
</header>
<nav>${navLinks}</nav>
<main>
${overviewMapHtml(orderedProps)}
${sections}
</main>
<footer>
  <p>This page is rebuilt daily. New finds are added to the top of their section; nothing already here is removed unless it's confirmed gone. Checklist overrides (clicking an item) are stored only in your own browser — to actually change what future sweeps prioritise, leave a comment or reply in chat.</p>
</footer>
<div id="lightboxOverlay" class="lightbox-overlay" style="display:none">
  <button type="button" class="lightbox-close" aria-label="Close">✕</button>
  <img id="lightboxImg" class="lightbox-img" src="" alt="Floor plan enlarged">
</div>
<script>
function clStorageKey(prop, key) { return 'devon-cl-' + prop + '-' + key; }

function getClState(el) {
  var saved = localStorage.getItem(clStorageKey(el.dataset.prop, el.dataset.clKey));
  return saved || el.dataset.clDefault;
}

function placeClItem(el) {
  var state = getClState(el);
  var overridden = state !== el.dataset.clDefault;
  el.className = 'cl-item cl-' + state + (overridden ? ' cl-overridden' : '');
  var block = el.closest('.checklist-block');
  var target = state === 'good' ? block.querySelector('.cl-col-body[data-col="good"]')
    : state === 'bad' ? block.querySelector('.cl-col-body[data-col="bad"]')
    : block.querySelector('.cl-indifferent[data-col="indifferent"]');
  target.appendChild(el);
}

function cycleChecklist(el) {
  var current = getClState(el);
  var next = current === 'good' ? 'bad' : current === 'bad' ? 'indifferent' : 'good';
  localStorage.setItem(clStorageKey(el.dataset.prop, el.dataset.clKey), next);
  placeClItem(el);
}

document.querySelectorAll('.cl-source .cl-item').forEach(placeClItem);

document.querySelectorAll('.gallery').forEach(function (g) {
  var imgs = g.querySelectorAll('.gallery-img');
  var counter = g.querySelector('.gallery-current');
  var idx = 0;
  function show(i) {
    idx = (i + imgs.length) % imgs.length;
    imgs.forEach(function (im, j) { im.classList.toggle('active', j === idx); });
    if (counter) counter.textContent = idx + 1;
  }
  var prev = g.querySelector('.gallery-prev');
  var next = g.querySelector('.gallery-next');
  if (prev) prev.addEventListener('click', function () { show(idx - 1); });
  if (next) next.addEventListener('click', function () { show(idx + 1); });
});

var lightboxOverlay = document.getElementById('lightboxOverlay');
var lightboxImg = document.getElementById('lightboxImg');
function openLightbox(src) {
  lightboxImg.src = src;
  lightboxOverlay.style.display = 'flex';
}
function closeLightbox() {
  lightboxOverlay.style.display = 'none';
  lightboxImg.src = '';
}
document.querySelectorAll('.floorplan-img').forEach(function (img) {
  img.addEventListener('click', function () { openLightbox(img.dataset.lightboxSrc); });
});
lightboxOverlay.addEventListener('click', function (e) {
  if (e.target === lightboxOverlay) closeLightbox();
});
document.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeLightbox();
});

var WORKER_URL = 'https://devon-house-worker.jessekellyuk.workers.dev';

function escText(s) {
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function loadFamilyFeed(el) {
  var propertyId = el.dataset.property;
  var terms = [1, 2, 3].map(function (n) { return propertyId + '-bro' + n; });
  Promise.all(terms.map(function (term) {
    return fetch(WORKER_URL + '/comments?term=' + encodeURIComponent(term))
      .then(function (r) { return r.json(); })
      .then(function (data) { return { term: term, bro: 'Bro ' + term.slice(-1), comments: data.comments || [] }; })
      .catch(function () { return { term: term, bro: 'Bro ' + term.slice(-1), comments: [] }; });
  })).then(function (results) {
    results.forEach(function (r) { applyLiveRating(r.term, r.comments); });
    var all = [];
    results.forEach(function (r) {
      r.comments.forEach(function (c) {
        var body = c.body.replace(/^\\s*Rating:\\s*\\d{1,2}\\s*\\/\\s*10\\s*\\n*/i, '').trim();
        if (!body) return;
        all.push({ bro: r.bro, body: body, createdAt: c.createdAt });
      });
    });
    all.sort(function (a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });
    if (!all.length) {
      el.innerHTML = '<p class="bro-empty">No comments yet.</p>';
      return;
    }
    el.innerHTML = all.map(function (c) {
      var cls = c.bro === 'Bro 1' ? 'fam-bro-1' : c.bro === 'Bro 2' ? 'fam-bro-2' : 'fam-bro-3';
      return '<div class="fam-comment ' + cls + '"><span class="fam-comment-who">' + c.bro + ':</span>' + escText(c.body) + '</div>';
    }).join('');
  }).catch(function () {
    el.innerHTML = '<p class="bro-empty">Couldn\\'t load comments right now — try reloading the page.</p>';
  });
}

function ratingBarColorJs(score) {
  var pct = Math.max(0, Math.min(10, score)) / 10;
  var r = Math.round(211 - pct * (211 - 46));
  var g = Math.round(47 + pct * (125 - 47));
  return 'rgb(' + r + ',' + g + ',60)';
}

var BRO_WEIGHTS_JS = { 'Bro 1': 1, 'Bro 2': 1, 'Bro 3': 2 };

function recomputeOverall(card) {
  var overallRow = card.querySelector('.rating-row-overall');
  if (!overallRow) return;
  var total = 0, weight = 0;
  var aiScoreEl = card.querySelector('.rating-row-ai .rating-row-score');
  var aiScore = aiScoreEl ? parseFloat(aiScoreEl.textContent) : NaN;
  if (!isNaN(aiScore)) { total += aiScore * 1; weight += 1; }
  card.querySelectorAll('.rating-row[data-bro]:not(.rating-row-empty)').forEach(function (row) {
    var scoreEl = row.querySelector('.rating-row-score');
    var score = scoreEl ? parseFloat(scoreEl.textContent) : NaN;
    if (isNaN(score)) return;
    var w = BRO_WEIGHTS_JS[row.dataset.bro] || 1;
    total += score * w;
    weight += w;
  });
  if (!weight) return;
  var overall = total / weight;
  overallRow.classList.remove('rating-row-empty');
  overallRow.querySelector('.rating-bar-fill').style.width = (overall * 10) + '%';
  overallRow.querySelector('.rating-bar-fill').style.background = ratingBarColorJs(overall);
  overallRow.querySelector('.rating-row-score').textContent = overall.toFixed(1) + '/10';
  var flamesEl = overallRow.querySelector('.rating-row-flames');
  if (flamesEl) flamesEl.textContent = '🔥'.repeat(Math.round(overall));
  card.dataset.overallRating = overall.toFixed(2);
}

function updateRatingRow(propertyId, bro, score) {
  var row = document.querySelector('.rating-row[data-property="' + propertyId + '"][data-bro="' + bro + '"]');
  if (!row) return;
  row.classList.remove('rating-row-empty');
  row.querySelector('.rating-bar-fill').style.width = (score * 10) + '%';
  row.querySelector('.rating-bar-fill').style.background = ratingBarColorJs(score);
  row.querySelector('.rating-row-score').textContent = score + '/10';
  var flamesEl = row.querySelector('.rating-row-flames');
  if (flamesEl) flamesEl.textContent = '🔥'.repeat(Math.round(score));
  var card = row.closest('.card');
  if (card) {
    if (bro === 'Bro 3') card.dataset.bro3Rating = score;
    var total = 0, weight = 0;
    card.querySelectorAll('.rating-row[data-bro]:not(.rating-row-empty)').forEach(function (r) {
      var scoreEl = r.querySelector('.rating-row-score');
      var v = scoreEl ? parseFloat(scoreEl.textContent) : NaN;
      if (isNaN(v)) return;
      var w = BRO_WEIGHTS_JS[r.dataset.bro] || 1;
      total += v * w;
      weight += w;
    });
    if (weight) card.dataset.avgRating = (total / weight).toFixed(2);
    recomputeOverall(card);
  }
}

function applyLiveRating(term, comments) {
  var m = term.match(/^(.+)-bro([123])$/);
  if (!m) return;
  var propertyId = m[1], bro = 'Bro ' + m[2];
  for (var i = comments.length - 1; i >= 0; i--) {
    var match = comments[i].body.match(/Rating:\\s*(\\d{1,2})\\s*\\/\\s*10/i) || comments[i].body.match(/^\\s*(\\d{1,2})\\s*\\/\\s*10/);
    if (match) {
      var score = Math.max(1, Math.min(10, parseInt(match[1], 10)));
      updateRatingRow(propertyId, bro, score);
      return;
    }
  }
}

document.querySelectorAll('.family-feed').forEach(loadFamilyFeed);

document.querySelectorAll('.family-post').forEach(function (panel) {
  var selected = null;
  var buttons = panel.querySelectorAll('.bro-select-btn');
  var textarea = panel.querySelector('.family-input');
  var postBtn = panel.querySelector('.family-post-btn');
  var status = panel.querySelector('.family-status');
  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      buttons.forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      selected = b.dataset.bro;
      status.textContent = '';
    });
  });
  postBtn.addEventListener('click', function () {
    if (!selected) {
      status.textContent = 'Pick who you are first.';
      return;
    }
    if (!textarea.value.trim()) {
      status.textContent = 'Write a comment first.';
      return;
    }
    postBtn.disabled = true;
    status.textContent = 'Posting…';
    fetch(WORKER_URL + '/comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId: postBtn.dataset.property,
        bro: selected,
        rating: null,
        comment: textarea.value,
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        postBtn.disabled = false;
        if (data.ok) {
          status.textContent = 'Posted!';
          textarea.value = '';
          loadFamilyFeed(panel.closest('.comments-block').querySelector('.family-feed'));
        } else {
          status.textContent = 'Something went wrong — try again in a bit.';
        }
      })
      .catch(function () {
        postBtn.disabled = false;
        status.textContent = 'Could not reach the server — try again in a bit.';
      });
  });
});

function computeScoreFromEvent(track, clientX) {
  var rect = track.getBoundingClientRect();
  var pct = rect.width ? (clientX - rect.left) / rect.width : 0;
  pct = Math.max(0, Math.min(1, pct));
  return Math.max(1, Math.round(pct * 10) || 1);
}

document.querySelectorAll('.rating-bar-track.interactive').forEach(function (track) {
  var dragging = false;
  function paint(score) {
    var row = track.closest('.rating-row');
    row.classList.remove('rating-row-empty');
    track.querySelector('.rating-bar-fill').style.width = (score * 10) + '%';
    track.querySelector('.rating-bar-fill').style.background = ratingBarColorJs(score);
    var thumb = track.querySelector('.rating-thumb');
    if (thumb) thumb.style.left = (score * 10) + '%';
    var scoreEl = row.querySelector('.rating-row-score');
    if (scoreEl) scoreEl.textContent = score + '/10';
  }
  function commit(score) {
    var row = track.closest('.rating-row');
    var propertyId = row.dataset.property, bro = row.dataset.bro;
    var flash = row.querySelector('.rating-row-flash');
    fetch(WORKER_URL + '/comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId: propertyId, bro: bro, rating: score, comment: '' }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        updateRatingRow(propertyId, bro, score);
        if (flash) {
          flash.textContent = data.ok ? '✓ saved' : 'save failed';
          setTimeout(function () { flash.textContent = ''; }, 2000);
        }
      })
      .catch(function () {
        if (flash) {
          flash.textContent = 'save failed — try again';
          setTimeout(function () { flash.textContent = ''; }, 2500);
        }
      });
  }
  track.addEventListener('pointerdown', function (e) {
    dragging = true;
    try { track.setPointerCapture(e.pointerId); } catch (err) {}
    paint(computeScoreFromEvent(track, e.clientX));
    e.preventDefault();
  });
  track.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    paint(computeScoreFromEvent(track, e.clientX));
  });
  track.addEventListener('pointerup', function (e) {
    if (!dragging) return;
    dragging = false;
    var score = computeScoreFromEvent(track, e.clientX);
    paint(score);
    commit(score);
  });
  track.addEventListener('pointercancel', function () { dragging = false; });
});

function wireMiniForm(inputSel, btnSel, endpoint, buildBody) {
  document.querySelectorAll(btnSel).forEach(function (btn) {
    btn.addEventListener('click', function () {
      var block = btn.closest('.ask-claude-block') || document;
      var textarea = block.querySelector(inputSel);
      var status = btn.parentElement.querySelector('.mini-status');
      btn.disabled = true;
      if (status) status.textContent = 'Sending…';
      fetch(WORKER_URL + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody(btn, textarea)),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          btn.disabled = false;
          if (status) status.textContent = data.ok ? 'Sent — thanks!' : 'Something went wrong, try again.';
          if (data.ok && textarea) textarea.value = '';
        })
        .catch(function () {
          btn.disabled = false;
          if (status) status.textContent = 'Could not reach the server — try again in a bit.';
        });
    });
  });
}

wireMiniForm('.research-input', '.research-post-btn', '/research', function (btn, textarea) {
  return { propertyId: btn.dataset.property, propertyTitle: btn.dataset.title, question: textarea.value };
});

wireMiniForm('.remove-input', '.remove-post-btn', '/remove', function (btn, textarea) {
  return { propertyId: btn.dataset.property, propertyTitle: btn.dataset.title, reason: textarea.value };
});

(function () {
  var toggle = document.getElementById('submitToggle');
  var panel = document.getElementById('submitPanel');
  if (!toggle) return;
  toggle.addEventListener('click', function () {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('submitPostBtn').addEventListener('click', function () {
    var urlInput = document.getElementById('submitUrl');
    var status = document.getElementById('submitStatus');
    var btn = this;
    if (!urlInput.value.trim()) {
      status.textContent = 'Paste a listing URL first.';
      return;
    }
    btn.disabled = true;
    status.textContent = 'Sending…';
    fetch(WORKER_URL + '/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listingUrl: urlInput.value,
        notes: '',
        price: '',
        address: '',
        bedrooms: '',
        bathrooms: '',
        parking: '',
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        btn.disabled = false;
        if (data.ok) {
          status.textContent = 'Sent — Claude will pick it up on the next sweep!';
          urlInput.value = '';
        } else {
          status.textContent = 'Something went wrong, try again.';
        }
      })
      .catch(function () {
        btn.disabled = false;
        status.textContent = 'Could not reach the server — try again in a bit.';
      });
  });
})();

(function () {
  var mapData = window.__OVERVIEW_MAP_DATA__ || [];
  var mapEl = document.getElementById('overviewMap');
  if (!mapEl || !mapData.length || typeof L === 'undefined') return;
  var map = L.map('overviewMap');
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  var bounds = [];
  mapData.forEach(function (p) {
    var color = p.sold ? '#8D6E63' : '#1b3a2f';
    var icon = L.divIcon({
      className: 'map-pin-icon',
      html: '<div style="width:16px;height:16px;border-radius:50% 50% 50% 0;background:' + color + ';border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.4);transform:rotate(-45deg);"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 16],
      popupAnchor: [0, -16],
    });
    var marker = L.marker([p.lat, p.lng], { icon: icon }).addTo(map);
    var soldBadge = p.sold ? '<span class="mpp-sold">Likely sold/withdrawn</span>' : '';
    var img = p.photo ? '<img src="' + p.photo + '" alt="">' : '';
    var popupHtml = '<div class="map-pin-popup">' + img +
      '<div class="mpp-body">' + soldBadge +
      '<p class="mpp-title">' + escText(p.title) + '</p>' +
      '<p class="mpp-price">' + escText(p.price) + '</p>' +
      '<a class="mpp-link" href="#' + p.id + '">View full listing ↓</a>' +
      '</div></div>';
    marker.bindPopup(popupHtml);
    bounds.push([p.lat, p.lng]);
  });
  if (bounds.length) map.fitBounds(bounds, { padding: [24, 24] });
})();

(function () {
  var allCards = Array.from(document.querySelectorAll('.card'));
  var headers = Array.from(document.querySelectorAll('.section-title'));
  var townSelect = document.getElementById('townFilter');
  var sortSelect = document.getElementById('sortControl');
  if (!sortSelect) return;

  function applyFilterAndSort() {
    var town = townSelect ? townSelect.value : 'all';
    var mode = sortSelect.value;
    var isDefaultView = town === 'all' && mode === 'default';

    allCards.forEach(function (c) {
      var matches = town === 'all' || c.dataset.town === town;
      c.style.display = matches ? '' : 'none';
    });

    headers.forEach(function (h) { h.style.display = isDefaultView ? '' : 'none'; });

    if (isDefaultView) {
      allCards.forEach(function (c) { c.style.order = ''; });
      return;
    }

    var visible = allCards.filter(function (c) { return c.style.display !== 'none'; });
    var ranked;
    if (mode === 'price') {
      ranked = visible.slice().sort(function (a, b) {
        var av = a.dataset.price !== '' && a.dataset.price != null ? parseFloat(a.dataset.price) : Infinity;
        var bv = b.dataset.price !== '' && b.dataset.price != null ? parseFloat(b.dataset.price) : Infinity;
        return av - bv;
      });
    } else if (mode === 'overall' || mode === 'bro3') {
      var attr = mode === 'bro3' ? 'bro3Rating' : 'overallRating';
      ranked = visible.slice().sort(function (a, b) {
        var av = a.dataset[attr] !== '' && a.dataset[attr] != null ? parseFloat(a.dataset[attr]) : -1;
        var bv = b.dataset[attr] !== '' && b.dataset[attr] != null ? parseFloat(b.dataset[attr]) : -1;
        return bv - av;
      });
    } else {
      ranked = visible.slice().sort(function (a, b) {
        return (b.dataset.dateAdded || '').localeCompare(a.dataset.dateAdded || '');
      });
    }
    ranked.forEach(function (c, i) { c.style.order = i; });
  }

  if (townSelect) townSelect.addEventListener('change', applyFilterAndSort);
  sortSelect.addEventListener('change', applyFilterAndSort);
})();
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, "index.html"), html);
console.log("wrote index.html,", html.length, "bytes,", props.length, "properties");
