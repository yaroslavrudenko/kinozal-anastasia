# Performance tracking

## 1. Purpose

The player has one performance goal: films never stall and zapping is fast on a 2017 Samsung TV (UE50MU7000, Tizen 3.0, Chromium 47 web engine, Wi‑Fi). This file is the single place that tracks every known performance issue, its status, and every change made for performance, with before/after numbers. A performance change is not done until it has a row in the [change log](#6-change-log) and its backlog item points to the commit.

## 2. How we measure

**Rule:** every change records a before/after taken with a named command or procedure. "Faster" without a number is not accepted. Each number states where it was taken: **TV** (measured on the device), **desktop** (measured on a Mac), or **estimate** (not measured).

### Baseline numbers known at 2026-10-25

| Metric | Value | Where | Method |
|---|---|---|---|
| Zap to first frame (◀ ▶ while watching) | ≈ 2.1–2.2 s | TV | Tizen debug inspector on the running app |
| Archive first frame (programme panel / slider) | ≈ 2.2 s | TV | Tizen debug inspector on the running app |
| Stalls over 3 movie channels × 10 min | 0 stalls · 0 rebuffers · 0 reconnects · buffer never below 12 s | desktop | parallel soak, 3 × 10 min |
| `/api/channel_now` response size | 444 KB, uncompressed (server ignores gzip) | desktop | reviewer measurement (HTTP request with `Accept-Encoding: gzip`) |
| One channel's 7-day guide | 205 KB, of which ~94 K characters are descriptions the player never shows | desktop | reviewer measurement |
| Master playlist | ~1 KB, 0.13 s | desktop | reviewer measurement |
| Channel-list parse | 4.2–4.3 ms | desktop (Apple M3) | reviewer measurement |
| Channel-list parse on the TV | 80–280 ms | **estimate** | scaled from the desktop figure; **not measured on the device** |
| Channel list parse + localStorage write freeze on start | 140–280 ms | **estimate** | review theme P-B; not measured on the device |
| XMLTV regex on malformed input | 483 ms at 8000 tags | desktop | review theme P-C |

### Measurement procedures

- **TV timings:** connect the Tizen debug inspector to the installed app and read timestamps from the console / network panel. Record the TV model, firmware and Wi‑Fi conditions with the result.
- **Request counts:** count requests in the inspector's network panel for a fixed key sequence (for example, 10 presses of ▶ in a row).
- **Soak:** play the stated channels for the stated time and record stalls, rebuffers, reconnects and minimum buffer level.

## 3. Baseline — 2026-10-25 review

Six independent reviewers, full-file scope, HEAD `20c4c6e` (v1.7.0): 230 findings, verdict REJECT, no critical findings. No code was changed by the review.

Reviewer codes used in the backlog: **R** mad_react_frontend-code-reviewer · **P** mad_react_performance-analyst · **C** Codex (external) · **G** code-reviewer · **J** javascript-pro · **E** performance-engineer. The full text of every finding is kept in the review workspace, outside the repository.

## 4. Performance backlog

Severity: the consolidated review groups findings by theme without one severity per theme; "see review" means the severity is in each reviewer's finding (IDs in the last column). All items are `OPEN` at the baseline.

| ID | Issue | Files | Agents | Severity | Status | Target metric (what proves it fixed) | Reviewer IDs |
|---|---|---|---|---|---|---|---|
| P-A | Every ◀ ▶ press downloads the 205 KB 7-day guide and the channel playlist; only `Player.play` is debounced; nothing is cancelled | app.js:302-316, :426; epg.js:98; ottclub.js:94 | 6 | see review | OPEN | requests per zap burst of 10 presses: ~21 (~2 MB) → ≤ 3 | R PERF-3, PERF-4 · P PERF-03, PERF-04, PERF-08 · C P02 · G PERF-2 · J JP-01 · E PE-01, PE-06 |
| P-B | Channel list parsed twice per load + ~1 MB JSON written to localStorage before playback (at start and every 6 h) | app.js:178-215 | 6 | see review | OPEN | parses per load: 2 → 1; main-thread block at start on the TV: est. 140–280 ms → measured, with no localStorage write before first frame | R PERF-2, PERF-8 · P PERF-02, PERF-15 · C P05 · G PERF-3 · J JP-02, JP-06 · E PE-05 |
| P-C | XMLTV guide held as one string; shared `/g` regex cursor corrupts overlapping parses; quadratic regex on malformed input; unsliced sort; re-download on every refresh | epg.js:6-38 | 6 | see review | OPEN | malformed 8000-tag input: 483 ms (desktop) → linear time; overlapping parses give correct results; no re-download within the cache period | R PERF-7, PERF-9 · P PERF-13 · C P08, C21 · G PERF-8 · J JP-03, JP-10, JP-11 · E PE-20 |
| P-D | Background health check: 389 keyed requests every launch and every 6 h, 4 in flight (~13–16 s), never cancelled when the list refreshes, competes with zaps | app.js:229-250 | 5 | see review | OPEN | health-check requests in flight during a zap: up to 4 → 0; check cancelled on list refresh | R PERF-1, PERF-12 · P PERF-05 · C P01 · J JP-04 · E PE-02 |
| P-E | Archive reconnect / return from Home reopens the recording from its start (or position 0) | player.js:27-37, :110-123 | 5 | see review | OPEN | archive position after reconnect / Home: 0 → within a few seconds of the last position | R PERF-15 · P hand-off · C C06 · J JP-19 · E PE-16, PE-17 |
| P-F | Pending zap timer overrides a pause / archive started within 350 ms | app.js:311-313 | 5 | see review (R: LOW) | OPEN | pause or archive started within 350 ms of a zap is kept (0 overrides) | R LOW · P PERF-09 · C C04 · J JP-17 · E PE-28 |
| P-G | Watchdog restarts a paused / backgrounded / still-progressing rebuffer | player.js:103-138 | 4 | see review | OPEN | watchdog restarts while paused or progressing: > 0 → 0 (verified on TV) | P PERF-09 · C C03 · J JP-18 · E PE-12, PE-15 |
| P-H | Archive position counted from wall clock — buffering counts as watched, content skipped at continuation | app.js:341-345 | 4 | see review | OPEN | content skipped at continuation: buffering time → 0 s | R PERF-16 · C C05 · J JP-19 · E PE-11 |
| P-I | Guides and unused descriptions kept forever (~200 KB per channel visited; ~400 MB at 2000 channels) | ottclub.js:98-100; epg.js:90-95 | 4 | see review | OPEN | memory per visited channel: ~200 KB → bounded cache, descriptions not stored | P PERF-06 · C P07 · J JP-09 · E PE-07 |
| P-J | Backoff never builds / resets on open → a stream that fails seconds later retries every 0.5 s; one failure counted twice; retry chains multiply | player.js:103-123 | 3 | see review | OPEN | retry interval for a repeatedly failing stream: 0.5 s forever → 0.5 s … 15 s backoff; one retry chain at a time | R F-ARCH-8 · C P13 · E PE-13, PE-14 |
| P-K | Fixed 350 ms delay on every single press (~16 % of the 2.1 s zap) | app.js:312-314 | 3 | see review | OPEN | single-press zap to first frame on the TV: ≈ 2.1 s → ≈ 1.75 s | R PERF-6 · P PERF-07 · E PE-04 |
| P-L | AVPlay adaptive start at the highest bitrate, lowest excluded (matters only with multi-rendition playlists) | player.js:39 | 3 | see review | OPEN | to be defined after the multi-rendition check (section 7) | C P04 · G PERF-7 · E PE-18 |
| P-M | localStorage churn: write on every zap, fail log rewritten per failure | app.js; player.js | 3 | see review | OPEN | localStorage writes per zap: ≥ 1 → 0 on the zap path | P PERF-11 · J JP-07 · E LOW |
| P-N | Guide overlay rewrites all ~26 rows per key press | ui.js; app.js | 3 | see review | OPEN | rows rewritten per key press: ~26 → only changed rows | R PERF-10 · P PERF-12 · J JP-08 |
| P-O | Failed guide request → immediate re-request loop (measured 176 req/s for one channel); banner never hides | app.js:423-426; ottclub.js:105 | 2 | see review | OPEN | requests after a failed guide request: 176 req/s → bounded retries with backoff | G PERF-1 · C P03 |
| P-P | Startup waits for the 445 KB list before opening the saved last channel (est. 0.25–0.85 s). J disagrees for M3U mode (EPG URL comes from the header) — dissent recorded | app.js:117-122, :197-215 | 2 | see review | OPEN | launch to first frame of the last channel on the TV: measured before → after, list load not on the critical path | P PERF-01 · E PE-03 · (J: none found) |
| P-Q | `OttClub.key()` reads localStorage per channel (778× per load) | ottclub.js:74-80 | 2 | see review | OPEN | localStorage reads per list load: 778 → 1 | C P06 · J JP-05 |
| P-R | Repeated setup OK → duplicate permanent refresh intervals / double source start | app.js:140 | 2 | see review | OPEN | active refresh intervals after repeated setup: N → 1 | R F-ARCH-9 · C P12 |
| P-S | M3U parse in one blocking pass (EPG is sliced, playlist is not) | m3u.js:5-49 | 1 | see review | OPEN | longest main-thread task while parsing a 1000-channel M3U: measured before → after (sliced) | R PERF-5 |
| P-T | Banner shows the previous channel's tech info during a zap; stream info re-read for each banner | app.js | 2 | see review | OPEN | banner shows the previous channel's info: yes → no; stream-info reads per banner: measured before → after | R PERF-11 · P PERF-14 |
| P-U | Resume after suspend is synchronous and skips prepare | player.js:139 | 1 | see review | OPEN | resume after suspend: synchronous call → async prepare; time to first frame measured on the TV | C P10 |
| P-V | Dead-channel navigation recursion can overflow the stack | app.js:292 | 1 | see review | OPEN | stack depth with all neighbours dead: recursive → iterative (constant) | C P14 |
| P-W | Near-live archive: reopen every (delay − 10 s) with a ~2.2 s gap; a pause under 2 min jumps to live (OPEN-NO-CLEAN-FIX until provider timeshift is tested) | catchup.js:12; app.js:97, :333 | 1 | see review | OPEN | gaps per near-live hour: measured before → after, once provider timeshift is tested (section 7) | E PE-10 |
| P-X | Rebuffers are not recorded on the TV — "never stalls" cannot be proven on the device | player.js | 1 | see review | OPEN | rebuffer count and duration recorded on the TV for a soak run | E PE-19 |
| P-Y | Failed hls.js load appends script tags indefinitely; guide lookups rescan history; comparator does constant extra work | player.js:95; epg.js:63; ottclub.js | 1–2 | see review | OPEN | script tags after N failed loads: N → 1; guide lookup cost measured before → after | C P11, P09 · P PERF-10 |
| P-Z | Remaining low-severity items (uncompressed list, synchronous player calls, swallowed settings, About-screen values, cancellation) | various | 1 each | LOW | OPEN | per item, in its own change-log row | E PE-08, PE-09, PE-21…PE-27 · P PERF-16 |

## 5. Performance ledger (the five priorities)

| # | Priority | Backlog items |
|---|---|---|
| 1 | N+1 / per-item request in a loop | P-A, P-D, P-O |
| 2 | Many calls → one | none found — verified (the provider has no batch endpoint); all six reviewers agree |
| 3 | Sequential → parallel | P-P (2 reviewers; J dissents) |
| 4 | Redundant work / calls | P-B, P-A (checkAlive), P-Q, P-M, P-N, P-T |
| 5 | Blocking the main thread | P-B, P-C, P-S, P-U |

## 6. Change log

| Date | Version / commit | Backlog IDs | Change | Before | After | How measured |
|---|---|---|---|---|---|---|
| 2026-10-25 | 20c4c6e (v1.7.0) | — | Baseline captured by six-reviewer review; no code changed yet | — | — | — |

Each future performance fix appends one row here and changes its backlog Status to `DONE (<commit>)`. Rows are never deleted or rewritten; a correction is a new row.

## 7. Not yet verified on the TV

These items need a check on the device before they can be fixed or closed:

- **P-L — adaptive bitrate:** check whether the provider's playlists have several renditions; the finding matters only if they do.
- **P-W — provider timeshift:** test whether the provider's timeshift can replace the periodic archive reopen near live.
- **P-G — watchdog vs pause:** confirm on the TV that the watchdog restarts a paused or backgrounded stream.
- **P-X — rebuffer logging:** record rebuffers on the TV so "never stalls" can be measured on the device, not only on desktop.
