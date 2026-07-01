# 🎓 BYU Scholarship Matcher

An AI-powered web app that helps BYU students find scholarships they qualify for,
see when to apply, and get a personalized plan to stack them.

**Live demo:** _(add your link here once deployed)_

## What it does

1. You enter your GPA, major, class level, and situation.
2. A matching engine surfaces the BYU scholarships you're eligible for — mapped
   to your **college** — sorted by deadline urgency, with a clear "why you match."
3. An **AI Application Strategist** (powered by Claude) writes a personalized plan:
   which awards to prioritize, how to stack them, an essay angle, and next steps.

## Features

- **98 majors** grouped by BYU's 10 colleges
- **23 scholarships**: university-wide, every college's pool, institutes
  (Wheatley, Kennedy Center), and special awards (ROTC, Athletic, Fine Arts talent)
- **College-aware matching** — a finance major sees Marriott awards; an engineer
  sees Fulton College awards
- **Live deadline countdowns** that always show the next upcoming date
- **AI plans** written live by Claude, with a smart built-in fallback so the tool
  works even without an API key

## How the AI works

The core matcher runs entirely in your browser — no backend, no keys needed. The
optional AI Strategist calls the [Anthropic API](https://www.anthropic.com/) directly
from the page (model `claude-opus-4-8`). Add your own API key under
**Use my own Claude API key** — it's stored only in your browser's `localStorage`
and sent straight to Anthropic. Without a key, a rule-based plan is generated instead.

## Tech

Vanilla HTML, CSS, and JavaScript — no framework, no build step. Deploys as static files.

## Run locally

Open `index.html` in a browser. For the AI feature (which uses `fetch`), serve the
folder over `http://` rather than `file://` — any static server works.

## Data & accuracy

Scholarship data is gathered from official BYU pages (Financial Aid, the colleges,
Marriott, Wheatley, and the Kennedy Center). Amounts and deadlines change — always
confirm on the linked official page before applying.

## Author

Built by **Jordan Heaton**.
