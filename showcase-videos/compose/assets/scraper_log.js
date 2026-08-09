// Curated from a real run: myplanBYU/scraper/run.log (course + catalog fetch) and
// the health report quarantined at myplanBYU/scraper/data/_rejected/20260802-032257/
// _health_report.txt. Line text is verbatim from those two files (timestamps already
// HH:MM:SS; one absolute local path redacted to a relative one -- see task-4-report.md).
window.SCRAPER_LOG = [
  // -- run starts -----------------------------------------------------------
  {t:'run',  s:'19:02:13  INFO     Fetching master course list ...'},
  // -- per-source, real counts -----------------------------------------------
  {t:'ok',   s:'19:02:15  INFO       courses: fetched 100 (total 100)'},
  {t:'ok',   s:'19:02:33  INFO       courses: fetched 100 (total 3300)'},
  {t:'ok',   s:'19:02:59  INFO       courses: fetched 94 (total 7894)'},
  {t:'ok',   s:'19:02:59  INFO     Normalized 7894 courses.'},
  {t:'run',  s:'19:02:59  INFO     Fetching program list ...'},
  {t:'ok',   s:'19:07:09  INFO       [626/626] Military Science'},
  {t:'ok',   s:'19:07:11  INFO     Wrote data/catalog.json (71722.7 KB)'},
  // -- health checks (requirement-parser findings, real lines) ---------------
  {t:'run',  s:'gate: checking data sanity ...'},
  {t:'warn', s:"Acting (BFA): MAP row y2W lists 15 credits of items against a printed total of 14 (+1) — the ITEMS look wrong, likely a line duplicated from another year; solver.js pins only up to the printed total"},
  {t:'warn', s:"Geology: 'Requirement 1 — Complete 12 Courses' wants 12 courses but only 11 options resolved"},
  {t:'warn', s:"Dietetics (BS): MAP row y2W prints a total of 6 for a Fall/Winter term whose 6 items sum to 16 — the PRINTED TOTAL looks mis-scraped (below full time); solver.js ignores it as a ceiling"},
  {t:'warn', s:"Information Technology: 'Requirement 7 — Obtain confirmation from your advisement center that you have completed the following:' states 200 non-credit hours — demoted to program note"},
  {t:'warn', s:"Wildlife & Wildlands Conservation: 'Requirement 1 — Complete 20 Courses' wants 20 courses but only 19 options resolved"},
  // -- quarantine / promotion gate --------------------------------------------
  {t:'warn', s:'health findings rose 24 -> 63 (limit +8) -- requirement parsing regressed'},
  {t:'gate', s:'health gate: FAILED -- quarantined to data/_rejected/, live site unchanged'},
];
