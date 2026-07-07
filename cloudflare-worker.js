// Devon House Search — no-login write proxy
// Deploy this in Cloudflare Workers. Set a secret GITHUB_TOKEN (fine-grained PAT,
// scoped to jkellyllekj/devon-house-search, Issues + Discussions read/write).
// After deploying, send the worker's URL back so the site can be wired up to it.

const ALLOWED_ORIGIN = "https://jkellyllekj.github.io";
const REPO_OWNER = "jkellyllekj";
const REPO_NAME = "devon-house-search";
const CATEGORY_ID = "DIC_kwDOTN1h484DApI-"; // "General" discussion category

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

async function gh(env, query, variables) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "devon-house-search-worker",
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (data.errors) throw new Error(JSON.stringify(data.errors));
  return data;
}

async function getRepoId(env) {
  const data = await gh(env, `query($owner:String!,$name:String!){ repository(owner:$owner,name:$name){ id } }`, { owner: REPO_OWNER, name: REPO_NAME });
  return data.data.repository.id;
}

async function listDiscussions(env) {
  const data = await gh(env, `
    query($owner:String!,$name:String!,$cat:ID!){
      repository(owner:$owner,name:$name){
        discussions(first: 100, categoryId: $cat) {
          nodes { id title comments(first: 20) { nodes { body createdAt } } }
        }
      }
    }`, { owner: REPO_OWNER, name: REPO_NAME, cat: CATEGORY_ID });
  return data.data.repository.discussions.nodes;
}

async function findOrCreateDiscussion(env, term) {
  const nodes = await listDiscussions(env);
  const existing = nodes.find(d => d.title === term);
  if (existing) return existing.id;
  const repoId = await getRepoId(env);
  const created = await gh(env, `
    mutation($repoId:ID!,$cat:ID!,$title:String!,$body:String!){
      createDiscussion(input:{repositoryId:$repoId, categoryId:$cat, title:$title, body:$body}) {
        discussion { id }
      }
    }`, { repoId, cat: CATEGORY_ID, title: term, body: "(auto-created by the site)" });
  return created.data.createDiscussion.discussion.id;
}

async function postComment(env, discussionId, body) {
  await gh(env, `
    mutation($id:ID!,$body:String!){
      addDiscussionComment(input:{discussionId:$id, body:$body}) { comment { id } }
    }`, { id: discussionId, body });
}

async function createIssue(env, title, body, labels) {
  const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "devon-house-search-worker",
      "Accept": "application/vnd.github+json",
    },
    body: JSON.stringify({ title, body, labels }),
  });
  if (!res.ok) throw new Error(`issue create failed: ${res.status}`);
}

const BRO_RE = /^Bro [123]$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });

    try {
      if (url.pathname === "/comments" && request.method === "GET") {
        const term = url.searchParams.get("term");
        if (!term) return json({ error: "missing term" }, 400);
        const nodes = await listDiscussions(env);
        const disc = nodes.find(d => d.title === term);
        return json({ comments: disc ? disc.comments.nodes : [] });
      }

      if (url.pathname === "/comment" && request.method === "POST") {
        const { propertyId, bro, rating, comment } = await request.json();
        if (!propertyId || !bro || !BRO_RE.test(bro)) return json({ error: "bad request" }, 400);
        if (rating !== undefined && rating !== null && rating !== "" && (rating < 1 || rating > 10)) return json({ error: "bad rating" }, 400);
        const text = (comment || "").toString().slice(0, 2000);
        const term = `${propertyId}-${bro.toLowerCase().replace(" ", "")}`;
        const discussionId = await findOrCreateDiscussion(env, term);
        let body = text;
        if (rating) body = `Rating: ${rating}/10${text ? "\n\n" + text : ""}`;
        if (!body) return json({ error: "nothing to post" }, 400);
        await postComment(env, discussionId, body);
        return json({ ok: true });
      }

      if (url.pathname === "/research" && request.method === "POST") {
        const { propertyId, propertyTitle, question } = await request.json();
        if (!propertyId || !propertyTitle) return json({ error: "bad request" }, 400);
        await createIssue(env, `Research: ${propertyTitle}`, `Property ID: ${propertyId}\n\nWhat should Claude look into: ${(question || "").slice(0, 1000)}`, ["research-request"]);
        return json({ ok: true });
      }

      if (url.pathname === "/remove" && request.method === "POST") {
        const { propertyId, propertyTitle, reason } = await request.json();
        if (!propertyId || !propertyTitle) return json({ error: "bad request" }, 400);
        await createIssue(env, `Remove: ${propertyTitle}`, `Property ID: ${propertyId}\n\nReason: ${(reason || "").slice(0, 1000)}`, ["removal-request"]);
        return json({ ok: true });
      }

      if (url.pathname === "/submit" && request.method === "POST") {
        const { listingUrl, notes } = await request.json();
        if (!listingUrl) return json({ error: "bad request" }, 400);
        await createIssue(env, `Submit: ${listingUrl.slice(0, 200)}`, `Listing URL: ${listingUrl}\n\nWhat do you like about it: ${(notes || "").slice(0, 1000)}`, ["property-submission"]);
        return json({ ok: true });
      }

      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: String(e) }, 500);
    }
  },
};
