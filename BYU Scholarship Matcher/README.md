# AI Scholarship Matcher

A static web app that matches students to scholarships based on their profile and
their talents and skills, tracks deadlines, and uses Claude to help plan
applications and shape essays. Built with BYU students in mind; the national
awards work for anyone.

## How it works

1. Enter your GPA, major, class level, financial situation, and the talents and
   skills that describe you (athletics, arts, leadership, STEM, service, and more).
2. A rules-based matching engine surfaces two kinds of awards:
   - **BYU scholarships** mapped to your college (Financial Aid, Marriott, Wheatley,
     Kennedy Center, Phi Kappa Phi, Honors Program, and every college's funds).
   - **National scholarships** matched on talent and skill (Coca-Cola Scholars,
     Goldwater, Truman, Elks MVS, YoungArts, Foot Locker Scholar Athletes, and more).
3. Each card shows why you match, what might block you, award amounts, stacking
   notes, and the next deadline with an urgency indicator.
4. Filter by scope or deadline window, sort by best match or soonest deadline,
   and star awards into a shortlist that persists in your browser.
5. The **AI Application Strategist** writes a personalized plan, and the
   **Essay Helper** builds outlines, gives feedback grounded in the actual essay
   prompt, and runs an AI-tone check on your draft. Drafts autosave locally.

## AI, with a fallback

The core matcher runs entirely in your browser: no backend, no keys needed. The
AI features call Claude directly from the browser if you add your own key under
**Use my own Claude API key**. The key is stored only in your browser's
`localStorage` and sent only to Anthropic. Without a key, built-in rule-based
versions of the strategist, outline builder, feedback, and tone check still work.

## Stack

Vanilla HTML, CSS, and JavaScript. No framework, no build step. Deploys as static
files (GitHub Pages friendly).

## Running locally

Serve the folder over `http://` rather than `file://`. Any static server works.

## Data honesty

Scholarship details come from official provider pages where possible; cards
marked "Verify details" used secondary sources. Amounts and deadlines change
every year, so always confirm on the linked official page before applying.
Data last reviewed: July 2026.

## Author

Built by **Jordan Heaton**.
