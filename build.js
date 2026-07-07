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
  const main = photos[0];
  const rest = photos.slice(1);
  return `
    <div class="photo-main"><img src="images/${main}" alt="${esc(id)} main photo" loading="lazy"></div>
    ${rest.length ? `<div class="photo-strip">${rest.map(p => `<img src="images/${p}" alt="${esc(id)} photo" loading="lazy">`).join("")}</div>` : ""}
  `;
}

const REPO = "jkellyllekj/devon-house-search";
const WORKER_URL = "https://devon-house-worker.jessekellyuk.workers.dev";

function brotherBoxHtml(p, n) {
  const bro = `Bro ${n}`;
  const term = `${p.id}-bro${n}`;
  return `
    <div class="brother-box brother-box-${n}">
      <h4>Bro ${n}</h4>
      <div class="bro-comments" data-term="${esc(term)}">Loading…</div>
      <textarea class="bro-input" placeholder="Write a comment (optional)…"></textarea>
      <div class="bro-controls">
        <select class="bro-rating">
          <option value="">No rating</option>
          ${[1,2,3,4,5,6,7,8,9,10].map(n2 => `<option value="${n2}">${n2}/10</option>`).join("")}
        </select>
        <button class="bro-post-btn" data-property="${esc(p.id)}" data-bro="${esc(bro)}">Post</button>
      </div>
      <span class="bro-status"></span>
    </div>
  `;
}

function commentsBlockHtml(p) {
  return `
    <div class="comments-block">
      <h3>💬 Family Comments</h3>
      <p class="rating-hint">💡 Each brother has their own box below — no sign-in needed. Write a comment and/or pick a rating, then hit Post. You can post again any time to update it.</p>
      <div class="brother-boxes">
        ${brotherBoxHtml(p, 1)}
        ${brotherBoxHtml(p, 2)}
        ${brotherBoxHtml(p, 3)}
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
  const dataAttrs = (propertyId && bro) ? ` data-property="${esc(propertyId)}" data-bro="${esc(bro)}"` : "";
  if (score === null || score === undefined) {
    return `
      <div class="rating-row rating-row-empty ${cls}"${dataAttrs}>
        <span class="rating-row-label">${esc(label)}</span>
        <div class="rating-bar-track"><div class="rating-bar-fill" style="width:0%"></div></div>
        <span class="rating-row-score">not yet rated</span>
      </div>
    `;
  }
  const flames = "🔥".repeat(Math.round(score)) || "";
  return `
    <div class="rating-row ${cls}"${dataAttrs}>
      <span class="rating-row-label">${esc(label)}</span>
      <div class="rating-bar-track"><div class="rating-bar-fill" style="width:${score * 10}%;background:${ratingBarColor(score)}"></div></div>
      <span class="rating-row-score">${esc(score)}/10</span>
      <span class="rating-row-flames">${flames}</span>
    </div>
  `;
}

function ratingsHtml(p) {
  const ratings = p.ratings || {};
  const rows = [
    ratingRowHtml("🤖 AI Rating", (p.aiRating !== undefined && p.aiRating !== null) ? p.aiRating : null, "rating-row-ai"),
    ...BROTHER_SLOTS.map(label => ratingRowHtml(label, ratings[label] !== undefined ? ratings[label].score : null, "", p.id, label)),
  ].join("");
  return `<div class="ratings-block"><h3>Ratings <span class="cl-hint">(family ratings update live as soon as someone posts — no need to wait for a sweep)</span></h3>${rows}</div>`;
}

function avgRating(p) {
  const entries = Object.entries(p.ratings || {});
  if (!entries.length) return null;
  return entries.reduce((s, [, r]) => s + r.score, 0) / entries.length;
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
  return `
  <section class="card" id="${esc(p.id)}" data-avg-rating="${avg !== null ? avg.toFixed(2) : ""}" data-ai-rating="${aiR}">
    <h2>${esc(p.title)}</h2>
    <div class="price-row">
      <span class="price">${esc(p.price)}</span>
      <span class="agent">${esc(p.agent)}</span>
    </div>
    ${sourceBadgeHtml(p)}
    <div class="flags">${p.flags.map(flagHtml).join("")}</div>
    <div class="photos">${photosHtml(p.id, p.photos)}</div>
    ${mapEmbedHtml(p)}
    <p class="body">${esc(p.body)}</p>
    <p class="why"><strong>Why it's here:</strong> ${esc(p.why)}</p>
    ${aiTakeHtml(p)}
    ${researchHtml(p)}
    ${ratingsHtml(p)}
    ${checklistHtml(p)}
    ${askClaudeHtml(p)}
    ${commentsBlockHtml(p)}
    <div class="added">Added ${esc(p.dateAdded)}</div>
  </section>`;
}

const orderedProps = SECTION_ORDER.flatMap(sec => props.filter(p => p.section === sec));

const navLinks = orderedProps.map(p => `<a href="#${esc(p.id)}">${esc(p.title.split(",")[0].split(" (")[0])}</a>`).join("");

const sections = SECTION_ORDER.filter(s => props.some(p => p.section === s)).map(sec => {
  const items = props.filter(p => p.section === sec);
  return `<h1 class="section-title">${SECTION_TITLES[sec]}</h1>` + items.map(propertyCard).join("\n");
}).join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Devon House Search</title>
<style>
  :root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; }
  body { margin: 0; background: #f4f1ea; color: #222; }
  header { background: #1b3a2f; color: #fff; padding: 28px 20px 20px; }
  header h1 { margin: 0 0 4px; font-size: 28px; }
  header .sub { color: #cfe0d6; font-size: 14px; }
  .submit-link { display: inline-block; margin-top: 14px; background: #E65100; color: #fff; font-weight: 700; font-size: 13px; padding: 8px 16px; border-radius: 20px; text-decoration: none; border: none; font-family: inherit; cursor: pointer; }
  .submit-link:hover { background: #ff6f1a; }
  .sort-row { margin-top: 12px; font-size: 13px; }
  .sort-row label { color: #cfe0d6; margin-right: 8px; }
  .sort-row select { font-size: 13px; padding: 4px 8px; border-radius: 4px; border: 1px solid #3f6a55; background: #23483a; color: #fff; }
  nav { background: #23483a; padding: 10px 20px; overflow-x: auto; white-space: nowrap; position: sticky; top: 0; z-index: 10; }
  nav a { color: #d9ecdf; text-decoration: none; font-size: 13px; margin-right: 16px; }
  nav a:hover { text-decoration: underline; }
  main { max-width: 880px; margin: 0 auto; padding: 20px; display: flex; flex-direction: column; }
  .section-title { margin-top: 48px; border-bottom: 3px solid #1b3a2f; padding-bottom: 8px; font-size: 22px; color: #1b3a2f; }
  .card { background: #fff; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.12); padding: 24px; margin: 20px 0; scroll-margin-top: 60px; }
  .card h2 { margin: 0 0 8px; font-size: 20px; }
  .price-row { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
  .price { font-size: 20px; font-weight: 700; color: #1b5e20; }
  .agent { color: #666; font-style: italic; font-size: 14px; }
  .flags { margin-bottom: 14px; }
  .flag { display: inline-block; color: #fff; font-weight: 700; font-size: 11px; padding: 4px 8px; border-radius: 4px; margin: 0 6px 6px 0; }
  .photos { margin-bottom: 14px; }
  .photo-main img { width: 100%; border-radius: 8px; display: block; max-height: 380px; object-fit: cover; }
  .photo-strip { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
  .photo-strip img { flex: 1 1 140px; max-width: 200px; border-radius: 6px; height: 110px; object-fit: cover; }
  .no-photo { background: #eee; border-radius: 8px; padding: 40px; text-align: center; color: #888; font-size: 13px; }
  .map-embed { margin-bottom: 14px; }
  .map-embed iframe { width: 100%; border-radius: 8px; display: block; }
  .map-links { display: flex; justify-content: flex-end; gap: 20px; margin-top: 6px; }
  .map-links a { font-size: 13px; color: #1155cc; text-decoration: none; font-weight: 600; }
  .map-links a:hover { text-decoration: underline; }
  .body { line-height: 1.5; }
  .why { background: #fdf6e3; border-left: 4px solid #e6b800; padding: 10px 14px; border-radius: 4px; font-size: 14px; line-height: 1.5; }
  .source-badge { display: inline-block; background: #1b3a2f; color: #fff !important; font-weight: 700; font-size: 13px; letter-spacing: 0.4px; padding: 7px 14px; border-radius: 20px; text-decoration: none; margin-bottom: 12px; }
  .source-badge:hover { background: #23483a; }
  .ratings-block { margin: 14px 0; padding: 14px; background: #fafafa; border-radius: 8px; }
  .ratings-block h3 { margin: 0 0 10px; font-size: 13px; color: #1b3a2f; text-transform: uppercase; letter-spacing: 0.5px; }
  .rating-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 13px; }
  .rating-row-label { flex: 0 0 130px; font-weight: 600; color: #333; }
  .rating-row-ai .rating-row-label { color: #6A1B9A; }
  .rating-bar-track { flex: 1 1 auto; height: 14px; background: #e6e6e6; border-radius: 8px; overflow: hidden; }
  .rating-bar-fill { height: 100%; border-radius: 8px; transition: width 0.3s; }
  .rating-row-score { flex: 0 0 50px; font-weight: 700; color: #444; text-align: right; }
  .rating-row-flames { flex: 0 0 auto; font-size: 12px; }
  .rating-row-empty .rating-row-score { color: #999; font-weight: 400; }
  .rating-hint { font-size: 12px; color: #8a5a00; background: #fff3cd; border-radius: 4px; padding: 6px 10px; margin: 0 0 10px; }
  .rating-hint code { background: #fff; padding: 1px 5px; border-radius: 3px; }
  .checklist-block { margin-bottom: 14px; padding: 14px; background: #f4f8f5; border-radius: 8px; }
  .checklist-block h3 { margin: 0 0 10px; font-size: 13px; color: #1b3a2f; text-transform: uppercase; letter-spacing: 0.5px; }
  .cl-hint { text-transform: none; font-weight: 400; font-size: 11px; color: #888; letter-spacing: normal; }
  .cl-columns { display: flex; gap: 16px; flex-wrap: wrap; }
  .cl-col { flex: 1 1 200px; min-width: 180px; }
  .cl-col h4 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.4px; }
  .cl-col-good h4 { color: #2E7D32; }
  .cl-col-bad h4 { color: #B71C1C; }
  .cl-col-body { display: flex; flex-direction: column; gap: 4px; min-height: 20px; }
  .cl-item { font-size: 13px; padding: 5px 10px; border-radius: 6px; cursor: pointer; user-select: none; }
  .cl-item.cl-good { background: #e6f4ea; color: #1b5e20; }
  .cl-item.cl-bad { background: #fdeaea; color: #8e1c1c; }
  .cl-item.cl-overridden { border: 1px dashed #999; }
  .cl-indifferent { margin-top: 10px; font-size: 12px; color: #999; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .cl-indifferent-label { font-weight: 600; }
  .cl-indifferent .cl-item { background: none; padding: 2px 4px; font-size: 12px; color: #999; }
  .cl-unique { margin-top: 10px; font-size: 13px; }
  .ai-take { background: #f3e5f5; border-left: 4px solid #6A1B9A; padding: 10px 14px; border-radius: 4px; font-size: 14px; line-height: 1.5; margin-top: 10px; }
  .research-block { margin-top: 14px; padding: 12px 14px; background: #eef4fb; border-left: 4px solid #1565C0; border-radius: 4px; }
  .research-block h3 { margin: 0 0 8px; font-size: 14px; color: #1b3a2f; }
  .research-item + .research-item { margin-top: 12px; padding-top: 12px; border-top: 1px solid #d6e4f2; }
  .research-q { margin: 0 0 6px; font-size: 13px; color: #444; }
  .research-date { color: #888; font-weight: 400; }
  .research-a { margin: 0 0 6px; font-size: 14px; line-height: 1.5; }
  .research-sources { margin: 0; font-size: 12px; color: #666; }
  .research-sources a { color: #1155cc; }
  .comments-block { margin-top: 18px; padding: 16px; background: #fff8f0; border: 3px solid #E65100; border-radius: 8px; }
  .comments-block h3 { margin: 0 0 10px; font-size: 18px; font-weight: 800; color: #E65100; letter-spacing: 0.3px; }
  .brother-boxes { display: flex; gap: 12px; flex-wrap: wrap; }
  .brother-box { flex: 1 1 260px; min-width: 240px; background: #fff; border-radius: 8px; padding: 10px; border-top: 4px solid #999; }
  .brother-box h4 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.4px; color: #666; }
  .brother-box-1 { border-top-color: #1565C0; }
  .brother-box-1 h4 { color: #1565C0; }
  .brother-box-2 { border-top-color: #2E7D32; }
  .brother-box-2 h4 { color: #2E7D32; }
  .brother-box-3 { border-top-color: #C2185B; }
  .brother-box-3 h4 { color: #C2185B; }
  .bro-comments { font-size: 13px; margin-bottom: 8px; max-height: 160px; overflow-y: auto; }
  .bro-comment { background: #f4f4f4; border-radius: 6px; padding: 6px 8px; margin-bottom: 6px; white-space: pre-wrap; }
  .bro-empty { color: #999; font-size: 12px; }
  .bro-input { width: 100%; box-sizing: border-box; min-height: 60px; font-family: inherit; font-size: 13px; padding: 6px 8px; border: 1px solid #ccc; border-radius: 6px; resize: vertical; }
  .bro-controls { display: flex; gap: 8px; margin-top: 6px; align-items: center; }
  .bro-rating { font-size: 12px; padding: 4px 6px; border-radius: 4px; border: 1px solid #ccc; }
  .bro-post-btn { background: #1b3a2f; color: #fff; border: none; border-radius: 16px; padding: 6px 14px; font-size: 12px; font-weight: 600; cursor: pointer; }
  .bro-post-btn:hover { background: #23483a; }
  .bro-post-btn:disabled { opacity: 0.6; cursor: default; }
  .bro-status { display: block; font-size: 11px; color: #888; margin-top: 4px; min-height: 14px; }
  .ask-claude-block { margin-top: 10px; padding-top: 10px; }
  .mini-form { margin-bottom: 12px; }
  .mini-form textarea, .mini-form input[type="text"] { width: 100%; box-sizing: border-box; font-family: inherit; font-size: 13px; padding: 6px 8px; border: 1px solid #ccc; border-radius: 6px; margin-bottom: 6px; }
  .mini-form textarea { min-height: 50px; resize: vertical; }
  .mini-form button { background: #1155cc; color: #fff; border: none; border-radius: 16px; padding: 6px 14px; font-size: 12px; font-weight: 600; cursor: pointer; }
  .mini-form button:hover { background: #0d3f99; }
  .mini-form button:disabled { opacity: 0.6; cursor: default; }
  .mini-status { display: block; font-size: 11px; color: #888; margin-top: 4px; min-height: 14px; }
  .submit-form { margin-top: 14px; }
  #submitPanel { margin-top: 10px; max-width: 420px; }
  .notes-caveat { display: block; font-size: 11px; color: #999; margin-top: 6px; }
  .added { font-size: 11px; color: #aaa; margin-top: 10px; }
  footer { max-width: 880px; margin: 0 auto; padding: 20px; color: #555; font-size: 13px; }
</style>
</head>
<body>
<header>
  <h1>Devon House Search</h1>
  <div class="sub">Exmouth · Woodbury · Budleigh Salterton · East Devon coast — last updated ${esc(data.lastUpdated)}</div>
  <div class="submit-form">
    <button id="submitToggle" class="submit-link" type="button">📮 Spotted one yourself? Submit a property</button>
    <div id="submitPanel" class="mini-form" style="display:none">
      <input id="submitUrl" type="text" placeholder="Paste the listing URL here">
      <textarea id="submitNotes" placeholder="What do you like about it? (optional)"></textarea>
      <button id="submitPostBtn" type="button">Submit</button>
      <span id="submitStatus" class="mini-status"></span>
    </div>
  </div>
  <div class="sort-row">
    <label for="sortControl">Sort:</label>
    <select id="sortControl">
      <option value="default">Default (newest first)</option>
      <option value="ai-high">Highest AI rating first</option>
      <option value="ai-low">Lowest AI rating first</option>
      <option value="family-high">Highest family rating first</option>
      <option value="family-low">Lowest family rating first</option>
    </select>
  </div>
</header>
<nav>${navLinks}</nav>
<main>
${sections}
</main>
<footer>
  <p>This page is rebuilt daily. New finds are added to the top of their section; nothing already here is removed unless it's confirmed gone. Checklist overrides (clicking an item) are stored only in your own browser — to actually change what future sweeps prioritise, leave a comment or reply in chat.</p>
</footer>
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

var WORKER_URL = 'https://devon-house-worker.jessekellyuk.workers.dev';

function escText(s) {
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function loadBroComments(el) {
  var term = el.dataset.term;
  fetch(WORKER_URL + '/comments?term=' + encodeURIComponent(term))
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data.comments || !data.comments.length) {
        el.innerHTML = '<p class="bro-empty">No comment yet.</p>';
        return;
      }
      el.innerHTML = data.comments.map(function (c) {
        return '<div class="bro-comment">' + escText(c.body) + '</div>';
      }).join('');
      applyLiveRating(el.dataset.term, data.comments);
    })
    .catch(function () {
      el.innerHTML = '<p class="bro-empty">Couldn\\'t load comments right now — try reloading the page.</p>';
    });
}

function ratingBarColorJs(score) {
  var pct = Math.max(0, Math.min(10, score)) / 10;
  var r = Math.round(211 - pct * (211 - 46));
  var g = Math.round(47 + pct * (125 - 47));
  return 'rgb(' + r + ',' + g + ',60)';
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
    var scores = Array.from(card.querySelectorAll('.rating-row:not(.rating-row-ai):not(.rating-row-empty) .rating-row-score'))
      .map(function (el) { return parseFloat(el.textContent); })
      .filter(function (n) { return !isNaN(n); });
    if (scores.length) {
      card.dataset.avgRating = (scores.reduce(function (a, b) { return a + b; }, 0) / scores.length).toFixed(2);
    }
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

document.querySelectorAll('.bro-comments').forEach(loadBroComments);

document.querySelectorAll('.bro-post-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var box = btn.closest('.brother-box');
    var textarea = box.querySelector('.bro-input');
    var select = box.querySelector('.bro-rating');
    var status = box.querySelector('.bro-status');
    var commentsEl = box.querySelector('.bro-comments');
    if (!textarea.value.trim() && !select.value) {
      status.textContent = 'Write a comment or pick a rating first.';
      return;
    }
    btn.disabled = true;
    status.textContent = 'Posting…';
    fetch(WORKER_URL + '/comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId: btn.dataset.property,
        bro: btn.dataset.bro,
        rating: select.value || null,
        comment: textarea.value,
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        btn.disabled = false;
        if (data.ok) {
          status.textContent = 'Posted!';
          textarea.value = '';
          select.value = '';
          loadBroComments(commentsEl);
        } else {
          status.textContent = 'Something went wrong — try again in a bit.';
        }
      })
      .catch(function () {
        btn.disabled = false;
        status.textContent = 'Could not reach the server — try again in a bit.';
      });
  });
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
    var notes = document.getElementById('submitNotes');
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
      body: JSON.stringify({ listingUrl: urlInput.value, notes: notes.value }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        btn.disabled = false;
        if (data.ok) {
          status.textContent = 'Sent — Claude will pick it up on the next sweep!';
          urlInput.value = '';
          notes.value = '';
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
  var sortCards = Array.from(document.querySelectorAll('.card'));
  var headers = Array.from(document.querySelectorAll('.section-title'));
  var select = document.getElementById('sortControl');
  if (!select) return;
  select.addEventListener('change', function () {
    var mode = select.value;
    if (mode === 'default') {
      sortCards.forEach(function (c) { c.style.order = ''; });
      headers.forEach(function (h) { h.style.display = ''; });
      return;
    }
    headers.forEach(function (h) { h.style.display = 'none'; });
    var attr = mode.indexOf('ai') === 0 ? 'aiRating' : 'avgRating';
    var asc = mode.indexOf('low') !== -1;
    var ranked = sortCards.slice().sort(function (a, b) {
      var av = a.dataset[attr] !== '' && a.dataset[attr] != null ? parseFloat(a.dataset[attr]) : -1;
      var bv = b.dataset[attr] !== '' && b.dataset[attr] != null ? parseFloat(b.dataset[attr]) : -1;
      return asc ? av - bv : bv - av;
    });
    ranked.forEach(function (c, i) { c.style.order = i; });
  });
})();
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, "index.html"), html);
console.log("wrote index.html,", html.length, "bytes,", props.length, "properties");
