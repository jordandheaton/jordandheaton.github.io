/*
 * app.js — BYU Scholarship Matcher
 * -------------------------------------------------------------
 * 1. Populates form dropdowns (majors grouped by college).
 * 2. Runs a rules-based matching engine over SCHOLARSHIPS.
 * 3. Renders result cards sorted by deadline urgency + fit.
 * 4. Generates an "AI Application Strategist" plan — either by
 *    calling Claude directly from the browser (if a key is saved)
 *    or with a built-in rule-based plan so the demo always works.
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

// Does this scholarship's college filter include the student's college?
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

  // --- College / major fit ---
  if (!collegeMatches(s, p)) return null;
  if (!s.colleges.includes("any")) {
    reasons.push(`Reserved for ${COLLEGES[p.college]} students like you.`);
    score += 3;
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

  // --- GPA ---
  if (s.minGPA > 0) {
    if (p.gpa >= s.minGPA) {
      reasons.push(`Your ${p.gpa.toFixed(2)} GPA meets the ~${s.minGPA.toFixed(2)} bar.`);
      score += 3;
    } else if (p.gpa >= s.minGPA - 0.2) {
      blockers.push(`GPA is just under the ~${s.minGPA.toFixed(2)} target — borderline but worth applying.`);
      score += 1;
    } else {
      blockers.push(`Typically wants ~${s.minGPA.toFixed(2)} GPA; yours is lower.`);
    }
  } else if (s.talentBased) {
    reasons.push("Judged on talent/skill, not GPA.");
    score += 1;
  }

  // --- Financial need ---
  if (s.needBased) {
    if (p.need === "yes") {
      reasons.push("Rewards demonstrated financial need — a strength for you.");
      score += 2;
    } else if (p.need === "maybe") {
      reasons.push("Considers financial need (submit the FAFSA to find out).");
      score += 1;
    } else if (!s.meritBased && !s.talentBased) {
      blockers.push("Purely need-based — less likely without demonstrated need.");
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
      blockers.push("For study-abroad participants — only relevant if you go abroad.");
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
  return {
    gpa: parseFloat(document.getElementById("gpa").value) || 0,
    major: majorObj.label || "Undecided",
    college: majorObj.college || "undeclared",
    level: document.getElementById("level").value,
    need: document.getElementById("need").value,
    international: document.getElementById("international").checked,
    firstGen: document.getElementById("firstGen").checked,
    studyAbroad: document.getElementById("studyAbroad").checked,
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
  const rank = { qualify: 0, likely: 1, reach: 2 };
  results.sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    return a.days - b.days;
  });
  return results;
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

function renderResults(results, profile) {
  const wrap = document.getElementById("results");
  const summary = document.getElementById("results-summary");

  if (results.length === 0) {
    summary.textContent = "";
    wrap.innerHTML =
      '<p class="empty">No matches with those inputs. Try adjusting your GPA, major, or class level.</p>';
    document.getElementById("ai-section").hidden = true;
    return;
  }

  const qualifyCount = results.filter((r) => r.status === "qualify").length;
  const levelText = document.getElementById("level").selectedOptions[0].text.toLowerCase();
  summary.innerHTML =
    `Found <strong>${results.length}</strong> scholarship${results.length === 1 ? "" : "s"} for a ` +
    `<strong>${profile.major}</strong> ${levelText} with a <strong>${profile.gpa.toFixed(2)}</strong> GPA — ` +
    `<strong>${qualifyCount}</strong> you likely qualify for right now.`;

  wrap.innerHTML = results
    .map((r) => {
      const s = r.s;
      const reasonList = r.reasons.map((t) => `<li class="good">${t}</li>`).join("");
      const blockerList = r.blockers.map((t) => `<li class="watch">${t}</li>`).join("");
      const reqList = s.requirements.map((t) => `<li>${t}</li>`).join("");
      return `
      <article class="card status-${r.status}">
        <div class="card-head">
          <div>
            <h3>${s.name}</h3>
            <p class="provider">${s.provider}</p>
          </div>
          <span class="badge badge-${r.status}">${STATUS_LABELS[r.status]}</span>
        </div>

        <div class="card-facts">
          <div class="fact"><span class="fact-label">Award</span>${s.award}</div>
          <div class="fact">
            <span class="fact-label">Next deadline</span>
            <span class="deadline ${urgencyClass(r.days)}">${deadlineText(r)}</span>
          </div>
        </div>

        <p class="note">${s.deadlineNote}</p>

        <ul class="reasons">${reasonList}${blockerList}</ul>

        <details>
          <summary>Requirements &amp; how it works</summary>
          <ul class="reqs">${reqList}</ul>
        </details>

        <a class="apply" href="${s.url}" target="_blank" rel="noopener">
          Official page <i class="fas fa-arrow-up-right-from-square"></i>
        </a>
      </article>`;
    })
    .join("");

  const ai = document.getElementById("ai-section");
  ai.hidden = false;
  document.getElementById("ai-output").innerHTML = "";
}

/* ---------- AI Application Strategist ---------- */

const AI_MODEL = "claude-opus-4-8"; // swap to "claude-haiku-4-5" for a cheaper/faster demo
const KEY_STORAGE = "byu_matcher_anthropic_key";

const AI_SYSTEM_PROMPT =
  "You are a warm, practical BYU scholarship advisor. Given a student's profile and the " +
  "scholarships they matched with, write a short personalized action plan. Be concrete and " +
  "encouraging, never generic. Use these four short sections with these exact markdown headers: " +
  "'## Priority order', '## How to stack them', '## Essay angle', '## Next 3 steps'. " +
  "Reference the student's real GPA, major, and interests. Keep the whole thing under 300 words. " +
  "Output only the plan — no preamble.";

function buildUserPrompt(profile, results) {
  const list = results
    .slice(0, 8)
    .map(
      (r) =>
        `- ${r.s.name} (${r.s.provider}) — status: ${STATUS_LABELS[r.status]}, ` +
        `award: ${r.s.award}, deadline: ${deadlineText(r)}`
    )
    .join("\n");

  return (
    `Student profile:\n` +
    `- Major: ${profile.major} (${COLLEGES[profile.college]})\n` +
    `- Class level: ${document.getElementById("level").selectedOptions[0].text}\n` +
    `- GPA: ${profile.gpa.toFixed(2)}\n` +
    `- Financial need: ${profile.need}\n` +
    `- International student: ${profile.international ? "yes" : "no"}\n` +
    `- First-generation: ${profile.firstGen ? "yes" : "no"}\n` +
    `- Interested in study abroad: ${profile.studyAbroad ? "yes" : "no"}\n` +
    `- Interests / notes: ${profile.interests || "(none provided)"}\n\n` +
    `Matched scholarships:\n${list}\n\n` +
    `Write the personalized plan.`
  );
}

async function callClaude(profile, results, apiKey) {
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
      max_tokens: 1024,
      system: AI_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(profile, results) }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Request failed (${res.status})`);
  }
  const data = await res.json();
  return data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function fallbackPlan(profile, results) {
  const dated = results.filter((r) => r.due);
  const soon = [...dated].sort((a, b) => a.days - b.days).slice(0, 3);
  const qualify = results.filter((r) => r.status === "qualify");

  const priority = soon
    .map((r, i) => `${i + 1}. **${r.s.name}** — due ${formatDate(r.due)} (${r.days} days).`)
    .join("\n");

  const stackNote =
    qualify.length >= 2
      ? `You qualify for **${qualify.length}** awards that can stack. University tuition awards, ` +
        `your college/department funds, and Kennedy Center study-abroad money come from different ` +
        `budgets — apply to all of them, since one application often feeds several donor funds.`
      : `Start with the award you clearly qualify for, then layer need-based and department funds ` +
        `on top — most BYU scholarships can be combined.`;

  const essay = profile.interests
    ? `Lean into what makes you specific: "${profile.interests}". Tie it to leadership, service, ` +
      `and a clear goal — reviewers reward a focused story over a list of activities.`
    : `Pick one throughline (a goal, a service experience, or a challenge you overcame) and let it ` +
      `carry the whole essay. Specific beats broad every time.`;

  return (
    `## Priority order\n${priority}\n\n` +
    `## How to stack them\n${stackNote}\n\n` +
    `## Essay angle\n${essay}\n\n` +
    `## Next 3 steps\n` +
    `1. Put every deadline above on your calendar today.\n` +
    `2. Draft one strong essay you can adapt for each application.\n` +
    `3. Line up two recommenders who know your work well.\n\n` +
    `*Tip: add your Anthropic API key in settings to get a plan written live by Claude.*`
  );
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

async function generatePlan() {
  const out = document.getElementById("ai-output");
  const btn = document.getElementById("generate-plan");
  const profile = readProfile();
  const results = matchScholarships(profile);
  if (results.length === 0) return;

  const apiKey = localStorage.getItem(KEY_STORAGE);
  btn.disabled = true;

  if (apiKey) {
    out.innerHTML = '<p class="loading"><i class="fas fa-spinner fa-spin"></i> Claude is writing your plan…</p>';
    try {
      const text = await callClaude(profile, results, apiKey);
      out.innerHTML =
        '<span class="ai-tag"><i class="fas fa-bolt"></i> Written live by Claude</span>' +
        miniMarkdown(text);
    } catch (e) {
      out.innerHTML =
        `<p class="error">Couldn't reach Claude (${e.message}). Showing the built-in plan instead.</p>` +
        miniMarkdown(fallbackPlan(profile, results));
    }
  } else {
    out.innerHTML =
      '<span class="ai-tag muted"><i class="fas fa-wand-magic-sparkles"></i> Built-in advisor</span>' +
      miniMarkdown(fallbackPlan(profile, results));
  }
  btn.disabled = false;
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
  // Group majors by college with <optgroup> for readability.
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
}

function onSubmit(e) {
  e.preventDefault();
  const profile = readProfile();
  const results = matchScholarships(profile);
  renderResults(results, profile);
  document.getElementById("results-wrap").scrollIntoView({ behavior: "smooth", block: "start" });
}

document.addEventListener("DOMContentLoaded", () => {
  populateSelects();
  document.getElementById("matcher-form").addEventListener("submit", onSubmit);
  document.getElementById("generate-plan").addEventListener("click", generatePlan);
  document.getElementById("open-settings").addEventListener("click", openSettings);
  document.getElementById("close-settings").addEventListener("click", closeSettings);
  document.getElementById("save-key").addEventListener("click", saveKey);
});
