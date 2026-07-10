/*
 * app.js - AI Scholarship Matcher
 * -------------------------------------------------------------
 * 1. Populates form dropdowns (majors grouped by college) and
 *    talent/skill checkboxes.
 * 2. Runs a rules-based matching engine over SCHOLARSHIPS,
 *    covering both BYU awards and national talent-based awards.
 * 3. Renders result cards with deadline tracking, filtering,
 *    sorting, and a persistent shortlist.
 * 4. AI Application Strategist: calls Claude from the browser if
 *    a key is saved, otherwise uses a built-in rule-based plan.
 * 5. Essay Helper: outlines, feedback, and an AI-tone check,
 *    grounded in the actual essay prompt, with drafts saved
 *    locally in the browser.
 * -------------------------------------------------------------
 */

/* ---------- Date helpers ---------- */

function nextDeadline(md) {
  if (!md) return null; // rolling / varies
  const now = new Date();
  const thisYear = new Date(now.getFullYear(), md.month - 1, md.day, 23, 59);
  return thisYear >= now
    ? thisYear
    : new Date(now.getFullYear() + 1, md.month - 1, md.day, 23, 59);
}

function daysUntil(date) {
  if (!date) return Infinity;
  return Math.ceil((date - new Date()) / (1000 * 60 * 60 * 24));
}

function formatDate(date) {
  if (!date) return "Rolling / varies";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/* ---------- Matching engine ---------- */

function collegeMatches(s, p) {
  if (s.colleges.includes("any")) return true;
  return s.colleges.includes(p.college);
}

// Score one scholarship against the profile. Returns null if hard-ineligible.
function evaluate(s, p) {
  const reasons = [];
  const blockers = [];
  let score = 0;

  // --- Class level ---
  if (!s.levels.includes(p.level)) return null;

  // --- Talent gate: skip talent-specific awards the student didn't select ---
  if (s.requiredTags && s.requiredTags.length > 0) {
    const hasRequired = s.requiredTags.some((t) => p.talents.includes(t));
    if (!hasRequired) return null;
  }

  // --- College / major fit (BYU awards only) ---
  if (!collegeMatches(s, p)) return null;
  if (s.scope === "byu" && !s.colleges.includes("any")) {
    reasons.push(`Reserved for ${COLLEGES[p.college]} students like you.`);
    score += 3;
  } else if (s.scope === "national") {
    reasons.push("Open beyond BYU. Any qualifying student can apply.");
    score += 1;
  } else {
    reasons.push("Open to students of any major.");
    score += 1;
  }

  // --- International ---
  if (s.internationalOnly && !p.international) return null;
  if (p.international && s.internationalEligible === false) return null;
  if (p.international && s.internationalEligible) {
    reasons.push("Open to international students.");
    score += 1;
  }

  // --- Heritage-specific awards ---
  if (s.minorityOnly && !p.minority) return null;
  if (s.minorityOnly && p.minority) {
    reasons.push("Matches the heritage criteria you selected. Check the award's exact eligibility list.");
    score += 2;
  }

  // --- Talents & skills ---
  const talentOverlap = (s.tags || []).filter((t) => p.talents.includes(t));
  if (talentOverlap.length > 0) {
    const names = talentOverlap
      .map((t) => (TALENTS.find((x) => x.value === t) || {}).label || t)
      .join(", ")
      .toLowerCase();
    reasons.push(`Rewards your strengths: ${names}.`);
    score += Math.min(talentOverlap.length * 2, 4);
  }

  // --- GPA ---
  if (s.minGPA > 0) {
    if (p.gpa >= s.minGPA) {
      reasons.push(`Your ${p.gpa.toFixed(2)} GPA meets the ~${s.minGPA.toFixed(2)} bar.`);
      score += 3;
    } else if (p.gpa >= s.minGPA - 0.2) {
      blockers.push(`GPA is just under the ~${s.minGPA.toFixed(2)} target. Borderline but worth applying.`);
      score += 1;
    } else {
      blockers.push(`Typically wants ~${s.minGPA.toFixed(2)} GPA; yours is lower.`);
    }
  } else if (s.talentBased) {
    reasons.push("Judged on talent and skill, not GPA.");
    score += 1;
  }

  // --- Financial need ---
  if (s.needBased) {
    if (p.need === "yes") {
      reasons.push("Rewards demonstrated financial need, a strength for you.");
      score += 2;
    } else if (p.need === "maybe") {
      reasons.push("Considers financial need (submit the FAFSA to find out).");
      score += 1;
    } else if (!s.meritBased && !s.talentBased) {
      blockers.push("Purely need-based, so it's less likely without demonstrated need.");
    }
  }

  // --- Merit / first-gen ---
  if (s.meritBased && p.gpa >= 3.5) score += 1;
  if (p.firstGen && (s.group === "College" || s.needBased)) {
    reasons.push("First-generation students are specifically considered.");
    score += 1;
  }

  // --- Study abroad ---
  if (s.studyAbroad) {
    if (p.studyAbroad) {
      reasons.push("Matches your interest in studying abroad.");
      score += 2;
    } else {
      blockers.push("For study-abroad participants. Only relevant if you go abroad.");
    }
  }

  // --- Status ---
  let status;
  if (blockers.length === 0) status = "qualify";
  else if (score >= 3) status = "likely";
  else status = "reach";

  return { status, score, reasons, blockers };
}

function readProfile() {
  const majorValue = document.getElementById("major").value;
  const majorObj = MAJORS.find((m) => m.value === majorValue) || {};
  const talents = Array.from(
    document.querySelectorAll('#talents input[type="checkbox"]:checked')
  ).map((el) => el.value);
  return {
    gpa: parseFloat(document.getElementById("gpa").value) || 0,
    major: majorObj.label || "Undecided",
    college: majorObj.college || "undeclared",
    level: document.getElementById("level").value,
    need: document.getElementById("need").value,
    international: document.getElementById("international").checked,
    firstGen: document.getElementById("firstGen").checked,
    studyAbroad: document.getElementById("studyAbroad").checked,
    minority: document.getElementById("minority").checked,
    talents,
    interests: document.getElementById("interests").value.trim(),
  };
}

function matchScholarships(profile) {
  const results = [];
  for (const s of SCHOLARSHIPS) {
    const evaluation = evaluate(s, profile);
    if (!evaluation) continue;
    const due = nextDeadline(s.deadline);
    results.push({ s, ...evaluation, due, days: daysUntil(due) });
  }
  return results;
}

/* ---------- Results state: filters, sort, shortlist ---------- */

const SHORTLIST_KEY = "matcher_shortlist";
let lastResults = [];
let lastProfile = null;
const view = { scope: "all", due: "all", sort: "match", shortlistOnly: false };

function loadShortlist() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SHORTLIST_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function saveShortlist(set) {
  localStorage.setItem(SHORTLIST_KEY, JSON.stringify([...set]));
}
let shortlist = loadShortlist();

function toggleShortlist(id) {
  if (shortlist.has(id)) shortlist.delete(id);
  else shortlist.add(id);
  saveShortlist(shortlist);
  renderResults();
}

function applyView(results) {
  let out = [...results];
  if (view.scope !== "all") out = out.filter((r) => r.s.scope === view.scope);
  if (view.due === "30") out = out.filter((r) => r.days <= 30);
  if (view.due === "90") out = out.filter((r) => r.days <= 90);
  if (view.shortlistOnly) out = out.filter((r) => shortlist.has(r.s.id));

  const rank = { qualify: 0, likely: 1, reach: 2 };
  if (view.sort === "deadline") {
    out.sort((a, b) => a.days - b.days);
  } else {
    out.sort((a, b) => {
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      if (b.score !== a.score) return b.score - a.score;
      return a.days - b.days;
    });
  }
  return out;
}

/* ---------- Rendering ---------- */

const STATUS_LABELS = {
  qualify: "You likely qualify",
  likely: "Strong candidate",
  reach: "Worth a look",
};

function urgencyClass(days) {
  if (days === Infinity) return "due-far";
  if (days <= 30) return "due-soon";
  if (days <= 90) return "due-mid";
  return "due-far";
}

function deadlineText(r) {
  if (!r.due) return "Rolling / varies";
  return `${formatDate(r.due)} · ${r.days} days left`;
}

function esc(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderResults() {
  const wrap = document.getElementById("results");
  const summary = document.getElementById("results-summary");
  const toolbar = document.getElementById("results-toolbar");
  const results = applyView(lastResults);
  const profile = lastProfile;

  if (!profile) return;
  toolbar.hidden = lastResults.length === 0;

  document.getElementById("shortlist-count").textContent = shortlist.size;

  if (lastResults.length === 0) {
    summary.textContent = "";
    wrap.innerHTML =
      '<div class="empty"><i class="fas fa-magnifying-glass"></i><p>No matches with those inputs. Try adjusting your GPA, class level, or talents.</p></div>';
    document.getElementById("ai-section").hidden = true;
    document.getElementById("essay-section").hidden = true;
    return;
  }

  if (results.length === 0) {
    summary.textContent = "";
    wrap.innerHTML = view.shortlistOnly
      ? '<div class="empty"><i class="far fa-star"></i><p>Your shortlist is empty. Tap the star on any card to save it here.</p></div>'
      : '<div class="empty"><i class="fas fa-filter"></i><p>No results under these filters. Try widening the deadline window or scope.</p></div>';
    return;
  }

  const qualifyCount = results.filter((r) => r.status === "qualify").length;
  const soonCount = results.filter((r) => r.days <= 30).length;
  const levelText = document.getElementById("level").selectedOptions[0].text.toLowerCase();
  summary.innerHTML =
    `Found <strong>${results.length}</strong> scholarship${results.length === 1 ? "" : "s"} for a ` +
    `<strong>${esc(profile.major)}</strong> ${esc(levelText)} with a <strong>${profile.gpa.toFixed(2)}</strong> GPA. ` +
    `<strong>${qualifyCount}</strong> you likely qualify for` +
    (soonCount > 0 ? `, and <strong>${soonCount}</strong> close within 30 days.` : ".");

  wrap.innerHTML = results
    .map((r) => {
      const s = r.s;
      const starred = shortlist.has(s.id);
      const reasonList = r.reasons.map((t) => `<li class="good">${t}</li>`).join("");
      const blockerList = r.blockers.map((t) => `<li class="watch">${t}</li>`).join("");
      const reqList = s.requirements.map((t) => `<li>${t}</li>`).join("");
      const soon = r.days <= 30 && r.days !== Infinity;
      return `
      <article class="card status-${r.status}">
        <div class="card-head">
          <div>
            <h3>${esc(s.name)}</h3>
            <p class="provider">${esc(s.provider)}</p>
          </div>
          <div class="card-badges">
            <span class="badge badge-${r.status}">${STATUS_LABELS[r.status]}</span>
            <button class="star-btn ${starred ? "starred" : ""}" data-star="${s.id}"
              title="${starred ? "Remove from shortlist" : "Save to shortlist"}"
              aria-label="${starred ? "Remove from shortlist" : "Save to shortlist"}">
              <i class="${starred ? "fas" : "far"} fa-star"></i>
            </button>
          </div>
        </div>

        <div class="chips">
          <span class="chip chip-scope">${s.scope === "byu" ? "BYU award" : "National award"}</span>
          ${soon ? '<span class="chip chip-soon"><i class="fas fa-clock"></i> Closing soon</span>' : ""}
          <span class="chip chip-source" title="${
            s.sourceType === "official"
              ? "Details verified on the provider's official site"
              : "Details from secondary sources. Verify before relying on them"
          }">${s.sourceType === "official" ? "Official source" : "Verify details"}</span>
        </div>

        <div class="card-facts">
          <div class="fact"><span class="fact-label">Award</span>${esc(s.award)}</div>
          <div class="fact">
            <span class="fact-label">Next deadline</span>
            <span class="deadline ${urgencyClass(r.days)}">${deadlineText(r)}</span>
          </div>
        </div>

        <p class="note">${esc(s.deadlineNote)}</p>

        <ul class="reasons">${reasonList}${blockerList}</ul>

        <details>
          <summary>Requirements &amp; how it works</summary>
          <ul class="reqs">${reqList}</ul>
          ${s.stacking ? `<p class="stacking"><i class="fas fa-layer-group"></i> <strong>Stacking:</strong> ${esc(s.stacking)}</p>` : ""}
        </details>

        <a class="apply" href="${s.url}" target="_blank" rel="noopener">
          Official page <i class="fas fa-arrow-up-right-from-square"></i>
        </a>
      </article>`;
    })
    .join("");

  wrap.querySelectorAll("[data-star]").forEach((btn) =>
    btn.addEventListener("click", () => toggleShortlist(btn.dataset.star))
  );

  document.getElementById("ai-section").hidden = false;
  document.getElementById("essay-section").hidden = false;
  populateEssayScholarships(results);
}

/* ---------- AI plumbing (shared) ---------- */

const AI_MODEL = "claude-opus-4-8"; // swap to "claude-haiku-4-5" for a cheaper/faster demo
const KEY_STORAGE = "byu_matcher_anthropic_key";

async function callClaude(system, user, apiKey, maxTokens = 1024) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Request failed (${res.status})`);
  }
  const data = await res.json();
  return data.content.filter((b) => b.type === "text").map((b) => b.text).join("");
}

function miniMarkdown(md) {
  const lines = md.split("\n");
  let html = "";
  let inList = false;
  for (let line of lines) {
    line = line
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");
    if (/^##\s+/.test(line)) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h4>${line.replace(/^##\s+/, "")}</h4>`;
    } else if (/^\s*(\d+[.)]|-)\s+/.test(line)) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${line.replace(/^\s*(\d+[.)]|-)\s+/, "")}</li>`;
    } else if (line.trim() === "") {
      if (inList) { html += "</ul>"; inList = false; }
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<p>${line}</p>`;
    }
  }
  if (inList) html += "</ul>";
  return html;
}

/* ---------- AI Application Strategist ---------- */

const AI_SYSTEM_PROMPT =
  "You are a warm, practical scholarship advisor. Given a student's profile and the " +
  "scholarships they matched with (a mix of university and national awards), write a short " +
  "personalized action plan. Be concrete and encouraging, never generic. Use these four short " +
  "sections with these exact markdown headers: '## Priority order', '## How to stack them', " +
  "'## Essay angle', '## Next 3 steps'. Reference the student's real GPA, talents, and " +
  "interests. Keep the whole thing under 300 words. Output only the plan.";

function buildUserPrompt(profile, results) {
  const list = results
    .slice(0, 10)
    .map(
      (r) =>
        `- ${r.s.name} (${r.s.provider}, ${r.s.scope === "byu" ? "BYU" : "national"}) | status: ${STATUS_LABELS[r.status]}, ` +
        `award: ${r.s.award}, deadline: ${deadlineText(r)}`
    )
    .join("\n");
  const talents = profile.talents
    .map((t) => (TALENTS.find((x) => x.value === t) || {}).label || t)
    .join(", ");
  return (
    `Student profile:\n` +
    `- Major: ${profile.major} (${COLLEGES[profile.college]})\n` +
    `- Class level: ${document.getElementById("level").selectedOptions[0].text}\n` +
    `- GPA: ${profile.gpa.toFixed(2)}\n` +
    `- Talents & skills: ${talents || "(none selected)"}\n` +
    `- Financial need: ${profile.need}\n` +
    `- International student: ${profile.international ? "yes" : "no"}\n` +
    `- First-generation: ${profile.firstGen ? "yes" : "no"}\n` +
    `- Interested in study abroad: ${profile.studyAbroad ? "yes" : "no"}\n` +
    `- Interests / notes: ${profile.interests || "(none provided)"}\n\n` +
    `Matched scholarships:\n${list}\n\n` +
    `Write the personalized plan.`
  );
}

function fallbackPlan(profile, results) {
  const dated = results.filter((r) => r.due);
  const soon = [...dated].sort((a, b) => a.days - b.days).slice(0, 3);
  const qualify = results.filter((r) => r.status === "qualify");

  const priority = soon
    .map((r, i) => `${i + 1}. **${r.s.name}**, due ${formatDate(r.due)} (${r.days} days).`)
    .join("\n");

  const stackNote =
    qualify.length >= 2
      ? `You qualify for **${qualify.length}** awards that can combine. University awards, ` +
        `college and department funds, and national awards come from different budgets, so apply ` +
        `to all of them. Check each card's stacking note, and report outside awards to the ` +
        `financial aid office.`
      : `Start with the award you clearly qualify for, then layer need-based, department, and ` +
        `national funds on top. Most of them can be combined.`;

  const essay = profile.interests
    ? `Lean into what makes you specific: "${profile.interests}". Tie it to leadership, service, ` +
      `and a clear goal. Reviewers reward a focused story over a list of activities.`
    : `Pick one throughline (a goal, a service experience, or a challenge you overcame) and let it ` +
      `carry the whole essay. Specific beats broad every time.`;

  return (
    `## Priority order\n${priority}\n\n` +
    `## How to stack them\n${stackNote}\n\n` +
    `## Essay angle\n${essay}\n\n` +
    `## Next 3 steps\n` +
    `1. Put every deadline above on your calendar today.\n` +
    `2. Draft one strong essay you can adapt for each application (the Essay Helper below can start the outline).\n` +
    `3. Line up two recommenders who know your work well.\n\n` +
    `*Tip: add your Anthropic API key in settings to get a plan written live by Claude.*`
  );
}

async function generatePlan() {
  const out = document.getElementById("ai-output");
  const btn = document.getElementById("generate-plan");
  const profile = readProfile();
  const results = applyView(lastResults);
  if (results.length === 0) return;

  const apiKey = localStorage.getItem(KEY_STORAGE);
  btn.disabled = true;

  if (apiKey) {
    out.innerHTML = '<p class="loading"><i class="fas fa-spinner fa-spin"></i> Claude is writing your plan…</p>';
    try {
      const text = await callClaude(AI_SYSTEM_PROMPT, buildUserPrompt(profile, results), apiKey);
      out.innerHTML =
        '<span class="ai-tag"><i class="fas fa-bolt"></i> Written live by Claude</span>' +
        miniMarkdown(text);
    } catch (e) {
      out.innerHTML =
        `<p class="error">Couldn't reach Claude (${esc(e.message)}). Showing the built-in plan instead.</p>` +
        miniMarkdown(fallbackPlan(profile, results));
    }
  } else {
    out.innerHTML =
      '<span class="ai-tag muted"><i class="fas fa-wand-magic-sparkles"></i> Built-in advisor</span>' +
      miniMarkdown(fallbackPlan(profile, results));
  }
  btn.disabled = false;
}

/* ---------- Essay Helper ---------- */

const DRAFT_KEY = "matcher_essay_draft";
const PROMPT_KEY = "matcher_essay_prompt";

function populateEssayScholarships(results) {
  const sel = document.getElementById("essay-scholarship");
  const current = sel.value;
  sel.innerHTML = '<option value="">General / not tied to one scholarship</option>';
  results.forEach((r) => {
    const opt = new Option(r.s.name, r.s.id);
    sel.appendChild(opt);
  });
  if ([...sel.options].some((o) => o.value === current)) sel.value = current;
}

function essayContext() {
  const id = document.getElementById("essay-scholarship").value;
  const s = SCHOLARSHIPS.find((x) => x.id === id);
  const promptText = document.getElementById("essay-prompt").value.trim();
  const draft = document.getElementById("essay-draft").value.trim();
  return { s, promptText, draft };
}

/* AI-tone scanner: fully local, works without an API key. */
const TONE_CHECKS = [
  { re: /[—–]/g, label: "Em or en dashes. The single most recognizable AI tell; swap for commas, colons, or periods." },
  { re: /\b(delve|delves|delving)\b/gi, label: '"Delve" is heavily overused by AI writing.' },
  { re: /\btapestry\b/gi, label: '"Tapestry" used figuratively reads as AI.' },
  { re: /\btestament to\b/gi, label: '"A testament to" is a stock AI phrase.' },
  { re: /\b(underscores?|underscoring)\b/gi, label: '"Underscores" is AI-flavored. Try "shows" or "means".' },
  { re: /\b(moreover|furthermore)\b/gi, label: 'Stacked formal connectors ("moreover", "furthermore") sound generated.' },
  { re: /\bin today's (world|society|fast-paced)\b/gi, label: '"In today\'s world/society" is a filler opener.' },
  { re: /\bnot only\b[\s\S]{0,80}\bbut also\b/gi, label: '"Not only... but also" is an overused AI construction.' },
  { re: /\bin conclusion\b/gi, label: '"In conclusion" announces the ending instead of just ending.' },
  { re: /\bplays? a (vital|crucial|pivotal|key) role\b/gi, label: '"Plays a vital/crucial role" is stock AI phrasing.' },
  { re: /\b(showcase|showcasing|showcases)\b/gi, label: '"Showcase" leans promotional and AI-flavored.' },
  { re: /\b(foster|fostering)\b/gi, label: '"Foster/fostering" is fine once, but it is a known AI favorite. Make sure it is intentional.' },
  { re: /\bever-evolving|rapidly evolving\b/gi, label: '"Ever-evolving / rapidly evolving" is filler.' },
  { re: /\bjourney\b/gi, label: '"Journey" used figuratively is overdone. Consider something concrete.' },
  { re: /\bpassion(ate)? (for|about)\b/gi, label: '"Passionate about" tells instead of shows. Replace with a specific moment.' },
];

function runToneCheck(draft) {
  if (!draft) {
    return '<p class="error">Paste or write your draft first, then run the check.</p>';
  }
  const findings = [];
  for (const check of TONE_CHECKS) {
    const matches = draft.match(check.re);
    if (matches && matches.length > 0) {
      findings.push(`<li><strong>${matches.length}×</strong> ${check.label}</li>`);
    }
  }
  // Sentence rhythm: flag uniform mid-length sentences.
  const sentences = draft.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  if (sentences.length >= 6) {
    const lens = sentences.map((s) => s.split(/\s+/).length);
    const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
    const variance = lens.reduce((a, b) => a + (b - avg) ** 2, 0) / lens.length;
    if (Math.sqrt(variance) < 4) {
      findings.push(
        "<li>Your sentences are all about the same length, which reads as machine-paced. Mix short and long.</li>"
      );
    }
  }
  const words = draft.split(/\s+/).filter(Boolean).length;
  const head =
    `<p><strong>${words} words, ${sentences.length} sentences.</strong> ` +
    (findings.length === 0
      ? "No obvious AI-tone flags found. Read it out loud once to be sure it sounds like you.</p>"
      : `${findings.length} thing${findings.length === 1 ? "" : "s"} to look at:</p>`);
  return head + (findings.length ? `<ul>${findings.join("")}</ul>` : "");
}

function fallbackOutline(ctx, profile) {
  const promptLine = ctx.promptText
    ? `Everything below should answer this prompt directly: "${ctx.promptText}"`
    : "No prompt pasted yet, so this is a general scholarship-essay structure. Paste the actual prompt for a tighter outline.";
  const award = ctx.s ? ` for the ${ctx.s.name}` : "";
  const talents = profile.talents
    .map((t) => (TALENTS.find((x) => x.value === t) || {}).label || t)
    .join(", ");
  return (
    `## Working outline${award}\n` +
    `${promptLine}\n\n` +
    `1. **Open in a moment, not a summary.** Start inside one specific scene that shows the quality the prompt asks about. No "Ever since I was young".\n` +
    `2. **The problem or tension.** What was hard, uncertain, or at stake? One paragraph.\n` +
    `3. **What you actually did.** Concrete actions and decisions. This is where your strengths (${talents || "add your talents in the form above"}) earn their place.\n` +
    `4. **What changed.** In you, and for other people. Numbers and names beat adjectives.\n` +
    `5. **Why this scholarship.** Tie your goal to what the provider says they fund${ctx.s ? ` (check the requirements on the ${ctx.s.name} card above)` : ""}.\n\n` +
    `## Before you draft\n` +
    `1. Answer the prompt's exact question in one sentence. If you can't, the essay isn't ready.\n` +
    `2. List 3 details only you could write (a place, a person, a mistake).\n` +
    `3. Keep it in your own voice. Run the AI-tone check here after drafting.`
  );
}

function fallbackFeedback(ctx) {
  if (!ctx.draft) {
    return '<p class="error">Paste or write your draft first, then ask for feedback.</p>';
  }
  const words = ctx.draft.split(/\s+/).filter(Boolean).length;
  const paras = ctx.draft.split(/\n\s*\n/).filter((p) => p.trim()).length;
  const hasNumbers = /\d/.test(ctx.draft);
  const iCount = (ctx.draft.match(/\bI\b/g) || []).length;
  const items = [];
  items.push(`<li><strong>Length:</strong> ${words} words in ${paras} paragraph${paras === 1 ? "" : "s"}. Most scholarship essays land between 300 and 650 words; check the prompt's limit.</li>`);
  items.push(
    ctx.promptText
      ? `<li><strong>Prompt fit:</strong> Reread your first and last paragraphs against the prompt ("${esc(ctx.promptText.slice(0, 120))}${ctx.promptText.length > 120 ? "…" : ""}"). Both should clearly answer it.</li>`
      : `<li><strong>Prompt fit:</strong> No prompt pasted, so I can't check alignment. Paste it above for grounded feedback.</li>`
  );
  items.push(
    hasNumbers
      ? `<li><strong>Specificity:</strong> Good, you use concrete numbers. Make sure each one carries weight.</li>`
      : `<li><strong>Specificity:</strong> No numbers found. One or two concrete figures (hours, people, results) make claims believable.</li>`
  );
  items.push(
    iCount > 0
      ? `<li><strong>Ownership:</strong> You write in first person (${iCount}×). Keep the focus on decisions you made, not things that happened to you.</li>`
      : `<li><strong>Ownership:</strong> Almost no first person. Reviewers fund a person, not a topic. Put yourself in the essay.</li>`
  );
  items.push(`<li><strong>Voice:</strong> Run the AI-tone check for phrasing flags, then read the draft out loud. Anything you'd never say, cut.</li>`);
  return `<p><strong>Built-in review</strong> (add an API key for line-level feedback from Claude):</p><ul>${items.join("")}</ul>`;
}

const ESSAY_SYSTEM =
  "You are a scholarship essay coach for a college student. Ground everything in the essay prompt " +
  "the student gives you; if none is given, say so and give general structure help. Be direct, warm, " +
  "and specific. Never rewrite the essay wholesale and never add flowery language. When giving " +
  "feedback, quote the student's own lines. Flag any phrasing that sounds AI-generated (em dashes, " +
  "'delve', 'testament', 'not only...but also', uniform sentence rhythm) since reviewers distrust it. " +
  "Use short markdown sections. Keep it under 400 words.";

async function runEssayHelper(mode) {
  const out = document.getElementById("essay-output");
  const profile = readProfile();
  const ctx = essayContext();

  // The tone check is always local and instant.
  if (mode === "tone") {
    out.innerHTML =
      '<span class="ai-tag muted"><i class="fas fa-spell-check"></i> Local AI-tone check</span>' +
      runToneCheck(ctx.draft);
    return;
  }

  const apiKey = localStorage.getItem(KEY_STORAGE);
  if (!apiKey) {
    out.innerHTML =
      '<span class="ai-tag muted"><i class="fas fa-wand-magic-sparkles"></i> Built-in helper</span>' +
      (mode === "outline" ? miniMarkdown(fallbackOutline(ctx, profile)) : fallbackFeedback(ctx));
    return;
  }

  out.innerHTML = '<p class="loading"><i class="fas fa-spinner fa-spin"></i> Claude is thinking…</p>';
  const scholarshipInfo = ctx.s
    ? `Scholarship: ${ctx.s.name} (${ctx.s.provider}). Requirements: ${ctx.s.requirements.join(" ")}`
    : "Scholarship: general application essay.";
  const user =
    mode === "outline"
      ? `${scholarshipInfo}\nEssay prompt: ${ctx.promptText || "(none provided)"}\n` +
        `Student's talents: ${profile.talents.join(", ") || "(none)"}; interests: ${profile.interests || "(none)"}.\n` +
        `Build a working outline that answers the prompt directly, with a note on what personal details to gather before drafting.`
      : `${scholarshipInfo}\nEssay prompt: ${ctx.promptText || "(none provided)"}\n` +
        `Student's draft:\n"""${ctx.draft || "(no draft yet)"}"""\n` +
        `Give focused feedback: prompt fit, structure, specificity, and voice. Quote lines when flagging them.`;
  try {
    const text = await callClaude(ESSAY_SYSTEM, user, apiKey, 1200);
    out.innerHTML =
      '<span class="ai-tag"><i class="fas fa-bolt"></i> Written live by Claude</span>' + miniMarkdown(text);
  } catch (e) {
    out.innerHTML =
      `<p class="error">Couldn't reach Claude (${esc(e.message)}). Showing the built-in helper instead.</p>` +
      (mode === "outline" ? miniMarkdown(fallbackOutline(ctx, profile)) : fallbackFeedback(ctx));
  }
}

function wireEssayPersistence() {
  const draft = document.getElementById("essay-draft");
  const promptEl = document.getElementById("essay-prompt");
  draft.value = localStorage.getItem(DRAFT_KEY) || "";
  promptEl.value = localStorage.getItem(PROMPT_KEY) || "";
  const savedNote = document.getElementById("draft-saved");
  let t;
  const save = () => {
    localStorage.setItem(DRAFT_KEY, draft.value);
    localStorage.setItem(PROMPT_KEY, promptEl.value);
    savedNote.textContent = "Draft saved in this browser";
    clearTimeout(t);
    t = setTimeout(() => (savedNote.textContent = ""), 1800);
  };
  draft.addEventListener("input", save);
  promptEl.addEventListener("input", save);
}

/* ---------- Settings (API key) ---------- */

function openSettings() {
  document.getElementById("settings").hidden = false;
  document.getElementById("api-key-input").value = localStorage.getItem(KEY_STORAGE) || "";
}
function closeSettings() {
  document.getElementById("settings").hidden = true;
}
function saveKey() {
  const val = document.getElementById("api-key-input").value.trim();
  if (val) localStorage.setItem(KEY_STORAGE, val);
  else localStorage.removeItem(KEY_STORAGE);
  document.getElementById("key-status").textContent = val
    ? "Saved in this browser only."
    : "Cleared. The built-in advisor will be used.";
}

/* ---------- Wiring ---------- */

function populateSelects() {
  const majorSel = document.getElementById("major");
  const order = Object.keys(COLLEGES);
  for (const key of order) {
    const inGroup = MAJORS.filter((m) => m.college === key);
    if (inGroup.length === 0) continue;
    const group = document.createElement("optgroup");
    group.label = COLLEGES[key];
    inGroup.forEach((m) => group.appendChild(new Option(m.label, m.value)));
    majorSel.appendChild(group);
  }

  const levelSel = document.getElementById("level");
  LEVELS.forEach((l) => levelSel.add(new Option(l.label, l.value)));
  levelSel.value = "sophomore";

  const talentsWrap = document.getElementById("talents");
  TALENTS.forEach((t) => {
    const label = document.createElement("label");
    label.className = "talent-chip";
    label.innerHTML = `<input type="checkbox" value="${t.value}" /><span>${t.label}</span>`;
    talentsWrap.appendChild(label);
  });
}

function onSubmit(e) {
  e.preventDefault();
  lastProfile = readProfile();
  lastResults = matchScholarships(lastProfile);
  view.shortlistOnly = false;
  document.getElementById("shortlist-toggle").classList.remove("active");
  renderResults();
  document.getElementById("results-wrap").scrollIntoView({ behavior: "smooth", block: "start" });
}

function wireToolbar() {
  document.getElementById("filter-scope").addEventListener("change", (e) => {
    view.scope = e.target.value;
    renderResults();
  });
  document.getElementById("filter-due").addEventListener("change", (e) => {
    view.due = e.target.value;
    renderResults();
  });
  document.getElementById("sort-by").addEventListener("change", (e) => {
    view.sort = e.target.value;
    renderResults();
  });
  document.getElementById("shortlist-toggle").addEventListener("click", (e) => {
    view.shortlistOnly = !view.shortlistOnly;
    e.currentTarget.classList.toggle("active", view.shortlistOnly);
    renderResults();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  populateSelects();
  wireToolbar();
  wireEssayPersistence();
  document.getElementById("matcher-form").addEventListener("submit", onSubmit);
  document.getElementById("generate-plan").addEventListener("click", generatePlan);
  document.getElementById("open-settings").addEventListener("click", openSettings);
  document.getElementById("close-settings").addEventListener("click", closeSettings);
  document.getElementById("save-key").addEventListener("click", saveKey);
  document.getElementById("essay-outline").addEventListener("click", () => runEssayHelper("outline"));
  document.getElementById("essay-feedback").addEventListener("click", () => runEssayHelper("feedback"));
  document.getElementById("essay-tone").addEventListener("click", () => runEssayHelper("tone"));
});
