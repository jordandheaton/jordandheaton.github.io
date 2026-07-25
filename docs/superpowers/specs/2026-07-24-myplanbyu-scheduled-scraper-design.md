# myplanBYU — Recurring Scraper Design

**Date:** 2026-07-24
**Status:** approved

## Problem

The myplanBYU data pipeline is run by hand. Two consequences:

1. **The data goes stale silently.** Course catalog, MAP sheets, and per-term
   add/drop deadlines all change on BYU's calendar, not on ours.
2. **The last attempt failed invisibly.** `refresh_maps.log` holds exactly two
   lines from 2026-07-22 16:30:36 — "run started", then "step: catalog ..." and
   nothing. Cause: `refresh_maps.ps1` invokes
   `C:\Users\jorda\venvs\myplan-scraper\Scripts\python.exe`, which no longer
   exists. When the interpreter itself cannot launch, `$LASTEXITCODE` is never
   set, so the script's `if ($LASTEXITCODE -ne 0)` guard saw stale success and
   the run neither completed nor reported failure.

A schedule built on top of that failure mode would do nothing for months
without saying so.

## Goals

- Refresh on a cadence matched to how fast each source actually changes.
- Ship good refreshes to the live site automatically; block bad ones.
- Make failure loud and same-day.
- Survive a missing or broken Python environment.

## Non-goals

- Cloud/CI execution. Runs on Jordan's Windows PC via Task Scheduler, reusing
  the local `.env` (`PINECONE_API_KEY`, `ANTHROPIC_API_KEY`) so no secret is
  copied anywhere. Accepted trade-off: refreshes only fire when the PC is awake.
- Real per-semester section history. Coursedog's sections endpoint is
  auth-walled (401/403); it needs a BYU WSO2 key. Unchanged by this work.
- Hosting the RAG advisor. `advisor_server.py` stays local-only
  (127.0.0.1:5000). The monthly Pinecone refresh keeps its index current for
  when it is running.

## Architecture

Three PowerShell layers in `scraper/`:

```
scraper/
  _pipeline.ps1        shared library, dot-sourced, no side effects on load
  refresh_core.ps1     weekly job
  refresh_full.ps1     monthly job
  setup_schedule.ps1   idempotent task registration, run once
```

`refresh_maps.ps1` is deleted; its catalog/maps/generate sequence becomes the
core of `refresh_core.ps1`.

All four are **ASCII-only**. PowerShell 5.1 reads a no-BOM script as ANSI, so
smart punctuation breaks string parsing — the constraint the existing
`refresh_maps.ps1` header already documents. No `&&`, no ternary, no `??`.

### `_pipeline.ps1`

| Function | Responsibility |
|---|---|
| `Initialize-ScraperEnv` | Resolve interpreter, import-check, self-heal, abort if broken |
| `Invoke-Step` | Run one Python script, tee to log, correctly detect failure |
| `Test-DataSanity` | The publish gate |
| `Publish-Refresh` | Scoped `git add` -> commit -> pull --rebase -> push |
| `Write-RunStatus` | Overwrite `data/_last_run.json` |
| `Send-FailureToast` | Windows toast notification |

`Invoke-Step` fixes the root cause above: the native call is wrapped in
try/catch, and "no exit code was produced" counts as failure rather than
success.

### Environment preflight

Before any step touches data, `Initialize-ScraperEnv`:

1. Checks `C:\Users\jorda\venvs\myplan-scraper\Scripts\python.exe` exists and
   `--version` works.
2. Runs `python -c "import requests, bs4, pypdf, sentence_transformers, pinecone"`.
3. On either failure: recreates the venv with `py -m venv`, installs
   `requirements.txt`, re-checks.
4. Still broken: toast, status file, **exit before scraping**. Never a partial
   refresh.

The venv lives outside OneDrive deliberately — a torch-sized venv inside a
synced folder is what corrupted the old `scraper/.venv` and hit Windows' 260-char
path limit.

## Tiers

Step order is load-bearing: `sources/maps.py` reads `data/catalog.json`, and
`generate_data.py` merges MAP and flowchart plans, so it runs after both.

### Weekly — Sunday 03:00

```
catalog.py -> academic_dates.py -> sources/maps.py
  -> generate_data.py -> generate_timeline.py
```

`academic_dates.py` is promoted from the "each semester" cadence its README
documents. `generate_timeline.py` reads `academic_dates.json`, add/drop
deadlines are the most perishable data in the set, and the scrape is 8
documents off two pages — effectively free.

### Monthly — first Sunday 04:00

```
catalog.py
  -> marriott_business, language_certs, kennedy_scraper, policy_scraper,
     research_grants, clubs, transfer_credit, tuition_graduation, flowcharts
  -> extract_flowchart_plans.py    (claude-haiku-4-5, temperature 0)
  -> sources/maps.py
  -> generate_data.py -> generate_timeline.py
  -> embed_and_load.py             (Pinecone upsert)
```

Failure policy differs by step class. A failing **source** is logged and
skipped — Kennedy's burst rate-limiting must not cost the clubs refresh. A
failing **generate or embed** step is fatal, because those produce what ships.

## Publish gate

Baselines measured 2026-07-24, which set the thresholds:

| Metric | Baseline |
|---|---|
| `catalog_data.js` courses / programs | 7130 / 313 |
| `catalog.json` courses / programs | 7894 / 626 |
| `_health_report.txt` findings | 24 |
| maps / clubs / study_abroad / transfer_credit rows | 194 / 373 / 131 / 41 |

`Test-DataSanity` blocks the push if any of these hold:

- A regenerated file does not parse, or `courses`/`programs` is empty.
- Course or program count fell more than **5%** below the last committed value.
- Any source JSON went from >0 records to 0 — the silent-breakage mode the
  Mendix-based `clubs.py` is most exposed to.
- Health findings rose by more than **8** (24 -> 33+ means the requirement
  parser regressed).

On gate failure: copy rejected output to `data/_rejected/<timestamp>/`,
`git restore` the tracked outputs so the tree is clean, toast, exit 1. Nothing
ships, nothing is lost.

## Publishing

The repo is a GitHub Pages site (`jordandheaton.github.io`); a push to `main`
is the deploy. The working tree routinely holds unrelated in-progress work, so
`Publish-Refresh`:

- Adds **explicit paths only**: `myplanBYU/js/catalog_data.js`,
  `myplanBYU/js/timeline_data.js`, `myplanBYU/scraper/data/*.json`. Never
  `git add -A`.
- **Aborts if the index already holds staged changes**, rather than sweeping
  in-progress work into an automated commit.
- No-ops on an empty diff — most weekly runs, so no commit and no noise.
- Writes the numbers into the message:
  `myplanBYU: scheduled data refresh (7130->7134 courses, 313 programs, 24 health findings)`.
- Runs `git pull --rebase origin main` first; on conflict it aborts the rebase
  and toasts rather than resolving anything unattended.

`scraper/data/catalog.json` (~69 MB) stays gitignored — a local build input
only. The deployed site loads the baked `js/catalog_data.js`.

## Alerting

Every run overwrites `data/_last_run.json`: UTC and local timestamp, job name,
per-step result, row counts, gate verdict, whether it pushed, and commit SHA if
it did. Runs also append to `refresh_core.log` / `refresh_full.log`.

Failures raise a Windows toast; success is silent. No external services and no
new credentials.

## Scheduling

`setup_schedule.ps1` registers both tasks with `Register-ScheduledTask`,
idempotently so it is safe to re-run:

- Runs as the current user, **only when logged on**. Windows Credential Manager
  (`credential.helper=manager`) needs the user session for the unattended
  `git push`, and `.env` lives in the user profile.
- `StartWhenAvailable` — a run missed while the PC slept fires on wake instead
  of being skipped.
- `RunOnlyIfNetworkAvailable`; `MultipleInstances = IgnoreNew`.
- Execution time limits: 2 h weekly, 6 h monthly.

## Verification

- `-NoPublish` switch on both jobs runs the full pipeline and stops short of
  git. The first real run uses it.
- Gate failure is exercised with a deliberately truncated `catalog.json`
  fixture: confirm no push, `_rejected/` written, tree clean, toast fired.
- Both tasks are launched via `schtasks /Run` — scheduled jobs break on
  environment differences (working directory, no PowerShell profile), so they
  are tested under the scheduler and not only in an interactive shell.
- `_last_run.json` is checked against each outcome.
