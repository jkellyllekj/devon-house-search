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

function reactionHtml(id) {
  return `
    <div class="reactions" data-id="${id}">
      <button class="react-btn" data-val="love" onclick="react('${id}','love')">♥ Love it</button>
      <button class="react-btn" data-val="maybe" onclick="react('${id}','maybe')">? Maybe</button>
      <button class="react-btn" data-val="pass" onclick="react('${id}','pass')">✕ Not for me</button>
      <span class="react-note">(saved in this browser only — reply in chat with Jesse's account for it to actually steer future sweeps)</span>
    </div>
  `;
}

function propertyCard(p) {
  return `
  <section class="card" id="${esc(p.id)}">
    <h2>${esc(p.title)}</h2>
    <div class="price-row">
      <span class="price">${esc(p.price)}</span>
      <span class="agent">${esc(p.agent)}</span>
    </div>
    <div class="flags">${p.flags.map(flagHtml).join("")}</div>
    <div class="media-grid">
      <div class="photos">${photosHtml(p.id, p.photos)}</div>
      <div class="map"><img src="images/${p.map}" alt="Map of ${esc(p.title)}"><div class="map-cap">Approximate location</div></div>
    </div>
    <p class="body">${esc(p.body)}</p>
    <p class="why"><strong>Why it's here:</strong> ${esc(p.why)}</p>
    <p class="source"><strong>Source:</strong> <a href="${esc(p.link)}" target="_blank" rel="noopener">${esc(p.linkLabel)}</a></p>
    ${reactionHtml(p.id)}
    <div class="added">Added ${esc(p.dateAdded)}</div>
  </section>`;
}

const navLinks = props.map(p => `<a href="#${esc(p.id)}">${esc(p.title.split(",")[0].split(" (")[0])}</a>`).join("");

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
  nav { background: #23483a; padding: 10px 20px; overflow-x: auto; white-space: nowrap; position: sticky; top: 0; z-index: 10; }
  nav a { color: #d9ecdf; text-decoration: none; font-size: 13px; margin-right: 16px; }
  nav a:hover { text-decoration: underline; }
  main { max-width: 880px; margin: 0 auto; padding: 20px; }
  .section-title { margin-top: 48px; border-bottom: 3px solid #1b3a2f; padding-bottom: 8px; font-size: 22px; color: #1b3a2f; }
  .card { background: #fff; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.12); padding: 24px; margin: 20px 0; scroll-margin-top: 60px; }
  .card h2 { margin: 0 0 8px; font-size: 20px; }
  .price-row { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
  .price { font-size: 20px; font-weight: 700; color: #1b5e20; }
  .agent { color: #666; font-style: italic; font-size: 14px; }
  .flags { margin-bottom: 14px; }
  .flag { display: inline-block; color: #fff; font-weight: 700; font-size: 11px; padding: 4px 8px; border-radius: 4px; margin: 0 6px 6px 0; }
  .media-grid { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; }
  .photos { flex: 1 1 320px; min-width: 260px; }
  .photo-main img { width: 100%; border-radius: 8px; display: block; max-height: 320px; object-fit: cover; }
  .photo-strip { display: flex; gap: 6px; margin-top: 6px; }
  .photo-strip img { width: 33%; border-radius: 6px; height: 80px; object-fit: cover; }
  .no-photo { background: #eee; border-radius: 8px; padding: 40px; text-align: center; color: #888; font-size: 13px; }
  .map { flex: 0 0 220px; }
  .map img { width: 100%; border-radius: 8px; display: block; }
  .map-cap { font-size: 11px; color: #888; text-align: center; margin-top: 4px; }
  .body { line-height: 1.5; }
  .why { background: #fdf6e3; border-left: 4px solid #e6b800; padding: 10px 14px; border-radius: 4px; font-size: 14px; line-height: 1.5; }
  .source { font-size: 14px; }
  .source a { color: #1155cc; }
  .reactions { margin-top: 14px; padding-top: 12px; border-top: 1px solid #eee; }
  .react-btn { border: 1px solid #ccc; background: #fafafa; border-radius: 20px; padding: 6px 14px; font-size: 13px; cursor: pointer; margin-right: 8px; }
  .react-btn.active-love { background: #C2185B; color: #fff; border-color: #C2185B; }
  .react-btn.active-maybe { background: #E65100; color: #fff; border-color: #E65100; }
  .react-btn.active-pass { background: #757575; color: #fff; border-color: #757575; }
  .react-note { font-size: 11px; color: #999; display: block; margin-top: 6px; }
  .added { font-size: 11px; color: #aaa; margin-top: 10px; }
  footer { max-width: 880px; margin: 0 auto; padding: 20px; color: #555; font-size: 13px; }
</style>
</head>
<body>
<header>
  <h1>Devon House Search</h1>
  <div class="sub">Exmouth · Woodbury · Budleigh Salterton · East Devon coast — last updated ${esc(data.lastUpdated)}</div>
</header>
<nav>${navLinks}</nav>
<main>
${sections}
</main>
<footer>
  <p>This page is rebuilt daily. New finds are added to the top of their section; nothing already here is removed unless it's confirmed gone. Reactions typed here are stored only in your browser (localStorage) as a personal memory aid — to actually change what future sweeps prioritise, reply in chat.</p>
</footer>
<script>
function react(id, val) {
  localStorage.setItem('devon-react-' + id, val);
  render(id);
}
function render(id) {
  const el = document.querySelector('.reactions[data-id="' + id + '"]');
  if (!el) return;
  const saved = localStorage.getItem('devon-react-' + id);
  el.querySelectorAll('.react-btn').forEach(b => {
    b.classList.remove('active-love', 'active-maybe', 'active-pass');
    if (saved && b.dataset.val === saved) b.classList.add('active-' + saved);
  });
}
document.querySelectorAll('.reactions').forEach(el => render(el.dataset.id));
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, "index.html"), html);
console.log("wrote index.html,", html.length, "bytes,", props.length, "properties");
