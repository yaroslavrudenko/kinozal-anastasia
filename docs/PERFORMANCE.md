# Performance tracking — «Настин кинозал» (Nastin Kinozal)

## Summary of the 2026 performance work

### How it started

On 2026-10-25 six independent reviewers read the whole code of v1.7.0 (HEAD `20c4c6e`): two frontend/JavaScript code reviewers, two performance specialists, a general code reviewer and Codex as an external reviewer. Together they reported **230 findings**. All six verdicts were **REJECT**; none of the findings was critical. Performance came first. Every ◀ ▶ press downloaded a 205 KB guide. The channel list was parsed twice and written to storage before the first frame. A failed guide request was retried in a tight loop. A background health check of every channel competed with playback. The details are in [section 3](#3-baseline--2026-10-25-review) and the [backlog](#4-performance-backlog).

### How it was done

- **A fix plan that disposed of every finding.** Each of the 230 findings got a status: **115 FIX**, **112 MERGED** into a primary that the same work fixes, and **3 OPEN-NO-CLEAN-FIX** because of provider or platform limits. No finding was dropped.
- **One implementer, one batch.** The 724-line `app.js` was split into small single-purpose modules. A single transport module now owns every request, and every request can be aborted.
- **Three independent reviewers after every iteration:** the native frontend code reviewer, Codex (external, read-only) and the performance analyst. None of them wrote code. The performance analyst re-ran the measurements with scripts of its own rather than trusting the implementer's numbers.
- **Five fix iterations.** Verdicts per review round:

  | Round | Native reviewer | Codex (external) | Performance analyst |
  |---|---|---|---|
  | 1 | REJECT | REJECT | REJECT |
  | 2 | REJECT | APPROVE | APPROVE |
  | 3 | APPROVE | REJECT (wrapped rows still clipped) | APPROVE |
  | 4 | REJECT (one LOW item, R4-1) | APPROVE | APPROVE |
  | 5 | REJECT (R5-1, LOW) | REJECT (page-up overlap, tech line, panel cursor) | APPROVE |
  | 6 | APPROVE | APPROVE | — |

- **A behaviour test suite grown from 0 to 131 tests**, all passing (`tests/run.sh`, iteration 5). It includes headless-browser layout tests for wrapping, paging and the tall-row case. Every pin is mutation-proven: the guard is removed, the test turns red, the guard is restored, the test turns green.

### Before → after (measured numbers)

Labels: **harness** = `node tools/perf-measure.js` and the session scripts, run on a desktop against the simulated network, with "before" taken from the old tree. **measured desktop** = headless Chrome on a Mac with the CPU throttled 6×. **estimate** = not measured. **Nothing in this table has been measured on the TV yet** (see [Still to verify on the TV](#still-to-verify-on-the-tv)).

| What | Before | After | Label |
|---|---|---|---|
| Guide + stream requests per 10-press zap burst | 20 | 3 (1 of them aborted); desktop Chrome app requests 20 → 2 | harness · measured desktop |
| Single press → channel open | 350 ms fixed delay | 0 ms | harness (TV first frame: TV-2) |
| Channel-list parses per load | 2 | 1 | harness |
| Storage writes before the first frame | 2 | 0 (offline copy 500 022 → 44 380 chars, ≈ 500 KB → 44 KB) | harness |
| Requests during a 10-minute pause | 200 | 0 | harness |
| Failed-guide requests in 10 minutes | 12 007 | 5 (maximum over 50+ seeded runs) | harness |
| List requests while the list server is down for 30 minutes | 179 | 10 | harness |
| Malformed XMLTV, 8 000 unclosed tags | 307 ms | ≈ 5 ms; linear (32 000 tags: 6.6 ms) | harness |
| Full guides kept after visiting 100 channels | 100 (7 680 000 description chars) | 24 (0 description chars) | harness |
| Health-check requests on a relaunch 1 hour later | 201 | 0 | harness |
| Startup long tasks over 50 ms, CPU 6× | 1–2 per run, 66–74 ms | none in 10 of 10 runs | measured desktop |
| Menu cursor move, key → frame median, CPU 6× | 15–17 ms | 10–13 ms | measured desktop |

Every row has a matching row with its exact command in the [change log](#6-change-log).

One cost did not change. Opening the menu is still a single long task: 57–74 ms on the real list and 127–133 ms on a worst-case list of 60 long names, at 6× CPU. The baseline measured the same (56–72 / 119–141 ms), so this work did not cause it. It is recorded for the next batch (N-5).

### On the TV — 2026-10-25 / 2026-10-26

What happened when the work met the real TV (UE50MU7000), in order:

1. **2026-10-25 ~23:45 — the first deploy failed.** The desktop-verified build showed a black screen. On this TV `webapis.network.addNetworkStateChangeListener` throws error 18. v1.7.0 had wrapped that call in try/catch; the refactor had dropped the wrapper, so boot stopped before the channel list loaded. The build was rolled back at once.
2. **A second black screen, already present in v1.7.0.** Home → another app → back to our app left the screen black for minutes. The other app takes the TV's player, so ours is left IDLE, and `restore()` silently did nothing. Fixed in `e0c8758`: anything but PLAYING is reopened, and the watchdog fails an IDLE/NONE player.
3. **The fixed overhaul passed the owner's cycle on the TV.** This is main `0375363` / `a856e77`. Each step reads the AVPlay state and the advancing media time through the Tizen inspector.

   | Step | Result |
   |---|---|
   | close → open | PLAYING, time advancing |
   | exit → open again | PLAYING, time advancing |
   | Home → OTT Club (20 s) → back, ×2 | PLAYING within 6–11 s, time advancing |
   | failure log | empty |

4. **2026-10-26, testing on heavy channels and archives** (partial run; the full table is still to come):
   - **Viju+ Megahit** (1920×1080 · H.264 · 10.9 Mbit/s · stereo): 5+ minutes live, PLAYING throughout, 60 s of video per minute, no new failures.
   - An archive film («Now You See Me») resumed in place after a return from another app.
   - Two failure-log entries appeared during the pause tests. They are not explained yet.

Lessons now written into [docs/TESTING.md](TESTING.md):
- No build is accepted until it plays on the TV.
- Every deploy has a smoke check with automatic rollback.
- Testing uses far, high-bitrate movie channels, not the default channel.

### What the viewer notices

- **Instant zapping.** A single press opens the channel at once. In a burst of presses only the channel you stop on loads its guide, and the channels you skipped past are cancelled.
- **Pause stays paused.** Neither the watchdog nor the background check nor a pending zap overrides a pause. A pause shorter than 2 minutes resumes in place.
- **The archive resumes in place.** A reconnect or a return from Home reopens the recording at the position on screen, not at its start. The position follows the player's clock, so time spent buffering is not counted as watched.
- **No truncated text.** Channel names and programme titles wrap instead of being cut off. A row taller than the screen can be scrolled through line by line.
- **The playing channel is highlighted** in the menu.
- **A stream tech line on every channel open:** resolution, codec, bitrate and sound appear with the banner for 5 seconds. It never shows the previous channel's values.
- **Paging never skips channels.** CH± / PG± turn the page by the rows that were completely visible, so every channel appears fully on some page.
- **A new name:** the app is now called «Настин кинозал» (Nastin Kinozal).
- **No black screen after another app:** returning from Home / another app reopens the channel (verified on the TV).
- **Coming next, on branch `perf-fixes`, not yet verified on the TV:**
  - a status banner from channel open to the first frame («Подключение…», «Загрузка видео… N%», «Нет сигнала — повтор через N с (попытка K)», «Канал отключён провайдером»);
  - a clear message for a wrong or expired key instead of hiding every channel;
  - media keys that work from the first seconds.

### Still to verify on the TV

These checks need one build deployed to the TV, which the owner has to permit:

- **TV-1:** the tightened CSP still lets webapis.js, AVPlay, logos and requests work (blocks the release).
- **TV-2:** zap timing on the device, and the cost of the synchronous AVPlay `stop` / `close` / `open` calls.
- **TV-3:** native pause at 30 s, 3 min and 30 min; whether the provider serves an open-ended archive near live (PE-10 residual).
- **TV-4:** the number of video renditions per channel (P-L).
- **TV-5:** HTTPS for the API and the streams (S01).
- **TV-6:** the watchdog during a pause, and the Home round trip (P-G, P-E).
- **TV-7:** whether `sdb shell 0 rm` is allowed (cleanup of the stage directory).
- **TV-8:** startup long tasks and launch-to-first-frame (P-B, P-P).
- **TV-9:** a 3 × 10 min soak with the rebuffer counters, so that "never stalls" is measured on the device (P-X).
- **TV-10:** wrapped rows fit; the paint cost of the slider and the banner.

**Accepted residuals (OPEN-NO-CLEAN-FIX):**

- **S01:** the provider serves the subscriber key and the streams over plain HTTP. The scheme is one constant and flips once TV-5 passes.
- **PE-23:** AVPlay has no asynchronous `stop` / `close` / `open`. The work reduced how often these calls happen; TV-2 will measure what they cost.
- **PE-27:** the provider's channel list is 444 KB and uncompressed. The app cannot change that, but it no longer stores the unused descriptions.

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
| P-A | Every ◀ ▶ press downloads the 205 KB 7-day guide and the channel playlist; only `Player.play` is debounced; nothing is cancelled | app.js:302-316, :426; epg.js:98; ottclub.js:94 | 6 | see review | DONE (uncommitted, perf-fixes) | requests per zap burst of 10 presses: ~21 (~2 MB) → ≤ 3 | R PERF-3, PERF-4 · P PERF-03, PERF-04, PERF-08 · C P02 · G PERF-2 · J JP-01 · E PE-01, PE-06 |
| P-B | Channel list parsed twice per load + ~1 MB JSON written to localStorage before playback (at start and every 6 h) | app.js:178-215 | 6 | see review | DONE (uncommitted, perf-fixes) | parses per load: 2 → 1; main-thread block at start on the TV: est. 140–280 ms → measured, with no localStorage write before first frame | R PERF-2, PERF-8 · P PERF-02, PERF-15 · C P05 · G PERF-3 · J JP-02, JP-06 · E PE-05 |
| P-C | XMLTV guide held as one string; shared `/g` regex cursor corrupts overlapping parses; quadratic regex on malformed input; unsliced sort; re-download on every refresh | epg.js:6-38 | 6 | see review | DONE (uncommitted, perf-fixes) | malformed 8000-tag input: 483 ms (desktop) → linear time; overlapping parses give correct results; no re-download within the cache period | R PERF-7, PERF-9 · P PERF-13 · C P08, C21 · G PERF-8 · J JP-03, JP-10, JP-11 · E PE-20 |
| P-D | Background health check: 389 keyed requests every launch and every 6 h, 4 in flight (~13–16 s), never cancelled when the list refreshes, competes with zaps | app.js:229-250 | 5 | see review | DONE (uncommitted, perf-fixes) | health-check requests in flight during a zap: up to 4 → 0; check cancelled on list refresh | R PERF-1, PERF-12 · P PERF-05 · C P01 · J JP-04 · E PE-02 |
| P-E | Archive reconnect / return from Home reopens the recording from its start (or position 0) | player.js:27-37, :110-123 | 5 | see review | DONE (uncommitted, perf-fixes) | archive position after reconnect / Home: 0 → within a few seconds of the last position | R PERF-15 · P hand-off · C C06 · J JP-19 · E PE-16, PE-17 |
| P-F | Pending zap timer overrides a pause / archive started within 350 ms | app.js:311-313 | 5 | see review (R: LOW) | DONE (uncommitted, perf-fixes) | pause or archive started within 350 ms of a zap is kept (0 overrides) | R LOW · P PERF-09 · C C04 · J JP-17 · E PE-28 |
| P-G | Watchdog restarts a paused / backgrounded / still-progressing rebuffer | player.js:103-138 | 4 | see review | DONE (uncommitted, perf-fixes) — TV check pending | watchdog restarts while paused or progressing: > 0 → 0 (verified on TV) | P PERF-09 · C C03 · J JP-18 · E PE-12, PE-15 |
| P-H | Archive position counted from wall clock — buffering counts as watched, content skipped at continuation | app.js:341-345 | 4 | see review | DONE (uncommitted, perf-fixes) | content skipped at continuation: buffering time → 0 s | R PERF-16 · C C05 · J JP-19 · E PE-11 |
| P-I | Guides and unused descriptions kept forever (~200 KB per channel visited; ~400 MB at 2000 channels) | ottclub.js:98-100; epg.js:90-95 | 4 | see review | DONE (uncommitted, perf-fixes) | memory per visited channel: ~200 KB → bounded cache, descriptions not stored | P PERF-06 · C P07 · J JP-09 · E PE-07 |
| P-J | Backoff never builds / resets on open → a stream that fails seconds later retries every 0.5 s; one failure counted twice; retry chains multiply | player.js:103-123 | 3 | see review | DONE (uncommitted, perf-fixes) | retry interval for a repeatedly failing stream: 0.5 s forever → 0.5 s … 15 s backoff; one retry chain at a time | R F-ARCH-8 · C P13 · E PE-13, PE-14 |
| P-K | Fixed 350 ms delay on every single press (~16 % of the 2.1 s zap) | app.js:312-314 | 3 | see review | DONE (uncommitted, perf-fixes) — TV check pending | single-press zap to first frame on the TV: ≈ 2.1 s → ≈ 1.75 s | R PERF-6 · P PERF-07 · E PE-04 |
| P-L | AVPlay adaptive start at the highest bitrate, lowest excluded (matters only with multi-rendition playlists) | player.js:39 | 3 | see review | DONE (uncommitted, perf-fixes) — TV check pending | to be defined after the multi-rendition check (section 7) | C P04 · G PERF-7 · E PE-18 |
| P-M | localStorage churn: write on every zap, fail log rewritten per failure | app.js; player.js | 3 | see review | DONE (uncommitted, perf-fixes) | localStorage writes per zap: ≥ 1 → 0 on the zap path | P PERF-11 · J JP-07 · E LOW |
| P-N | Guide overlay rewrites all ~26 rows per key press | ui.js; app.js | 3 | see review | DONE (uncommitted, perf-fixes) | rows rewritten per key press: ~26 → only changed rows | R PERF-10 · P PERF-12 · J JP-08 |
| P-O | Failed guide request → immediate re-request loop (measured 176 req/s for one channel); banner never hides | app.js:423-426; ottclub.js:105 | 2 | see review | DONE (uncommitted, perf-fixes) | requests after a failed guide request: 176 req/s → bounded retries with backoff | G PERF-1 · C P03 |
| P-P | Startup waits for the 445 KB list before opening the saved last channel (est. 0.25–0.85 s). J disagrees for M3U mode (EPG URL comes from the header) — dissent recorded | app.js:117-122, :197-215 | 2 | see review | DONE (uncommitted, perf-fixes) — TV check pending | launch to first frame of the last channel on the TV: measured before → after, list load not on the critical path | P PERF-01 · E PE-03 · (J: none found) |
| P-Q | `OttClub.key()` reads localStorage per channel (778× per load) | ottclub.js:74-80 | 2 | see review | DONE (uncommitted, perf-fixes) | localStorage reads per list load: 778 → 1 | C P06 · J JP-05 |
| P-R | Repeated setup OK → duplicate permanent refresh intervals / double source start | app.js:140 | 2 | see review | DONE (uncommitted, perf-fixes) | active refresh intervals after repeated setup: N → 1 | R F-ARCH-9 · C P12 |
| P-S | M3U parse in one blocking pass (EPG is sliced, playlist is not) | m3u.js:5-49 | 1 | see review | DONE (uncommitted, perf-fixes) | longest main-thread task while parsing a 1000-channel M3U: measured before → after (sliced) | R PERF-5 |
| P-T | Banner shows the previous channel's tech info during a zap; stream info re-read for each banner | app.js | 2 | see review | DONE (uncommitted, perf-fixes) | banner shows the previous channel's info: yes → no; stream-info reads per banner: measured before → after | R PERF-11 · P PERF-14 |
| P-U | Resume after suspend is synchronous and skips prepare | player.js:139 | 1 | see review | DONE (uncommitted, perf-fixes) — TV check pending | resume after suspend: synchronous call → async prepare; time to first frame measured on the TV | C P10 |
| P-V | Dead-channel navigation recursion can overflow the stack | app.js:292 | 1 | see review | DONE (uncommitted, perf-fixes) | stack depth with all neighbours dead: recursive → iterative (constant) | C P14 |
| P-W | Near-live archive: reopen every (delay − 10 s) with a ~2.2 s gap; a pause under 2 min jumps to live (OPEN-NO-CLEAN-FIX until provider timeshift is tested) | catchup.js:12; app.js:97, :333 | 1 | see review | PARTLY DONE (uncommitted, perf-fixes): pause < 2 min resumes in place; near-live chunking stays OPEN-NO-CLEAN-FIX until TV-3 | gaps per near-live hour: measured before → after, once provider timeshift is tested (section 7) | E PE-10 |
| P-X | Rebuffers are not recorded on the TV — "never stalls" cannot be proven on the device | player.js | 1 | see review | DONE (uncommitted, perf-fixes) — TV check pending | rebuffer count and duration recorded on the TV for a soak run | E PE-19 |
| P-Y | Failed hls.js load appends script tags indefinitely; guide lookups rescan history; comparator does constant extra work | player.js:95; epg.js:63; ottclub.js | 1–2 | see review | DONE (uncommitted, perf-fixes) | script tags after N failed loads: N → 1; guide lookup cost measured before → after | C P11, P09 · P PERF-10 |
| P-Z | Remaining low-severity items (uncompressed list, synchronous player calls, swallowed settings, About-screen values, cancellation) | various | 1 each | LOW | PARTLY DONE (uncommitted, perf-fixes): see change log; PE-23 and PE-27 stay OPEN-NO-CLEAN-FIX | per item, in its own change-log row | E PE-08, PE-09, PE-21…PE-27 · P PERF-16 |

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
| 2026-10-25 | uncommitted (branch perf-fixes) | P-A | Zap: leading-edge open after 1 s idle, trailing 350 ms inside a burst; guide only for the landing channel after its first frame; probes and guides of channels passed are aborted (`Net`, `EPG.cancelExcept`) | 20 guide+stream requests per 10-press burst, 0 aborted; opens 1 | 3 requests (1 aborted); opens 2 | `node tools/perf-measure.js` (Node 22, harness, desktop); before = `KINOZAL_ROOT=<7a39bce tree>`; desktop Chrome with intercepted masters: app XHR 20 → 2 (`zapnet.mjs`, session scratchpad) |
| 2026-10-25 | uncommitted (branch perf-fixes) | P-B | List parsed once; compact offline copy (`playlistSnap`, no descriptions, no key) written in idle after the first frame; `playlistText` retired | 2 parses; 2 writes / 500 069 chars before the first play; copy 500 022 chars | 1 parse; 0 writes before the first play; copy 44 380 chars | `node tools/perf-measure.js` (Node 22, harness, desktop); before = `KINOZAL_ROOT=<7a39bce tree>` |
| 2026-10-25 | uncommitted (branch perf-fixes) | P-C | `xmltv.js`: linear indexOf scanner, sliced sort, per-call state, newest load wins, 30 MB cap, re-download skipped for 12 h | 8000 unclosed tags: 303.7 ms total, longest task 287.4 ms | 4.3 ms total, longest task 3.9 ms | `node tools/perf-measure.js` (Node 22, harness, desktop); before = `KINOZAL_ROOT=<7a39bce tree>` |
| 2026-10-25 | uncommitted (branch perf-fixes) | P-D | Health: verdict cache (6 h, kept across launches), starts 60 s after stable playback, 2 in flight, paused and aborted on zap, cancelled on refresh; M3U not swept | sweep starts at 15.1 s; max 4 in flight; relaunch 1 h later: 201 requests | sweep starts at 80.5 s; max 2; relaunch 1 h later: 0 | `node tools/perf-measure.js` (Node 22, harness, desktop); before = `KINOZAL_ROOT=<7a39bce tree>` |
| 2026-10-25 | uncommitted (branch perf-fixes) | P-E, P-H | Archive position from the player media clock; a retry and the return from Home reopen at the position shown | resume at recording start / 0; buffering counted | within 1 s of the position (tests P-E pass); position after 20 s rebuffer + 30 s play = 30 s | `tests/run.sh` (player.test.js) + session `dbg2.js` |
| 2026-10-25 | uncommitted (branch perf-fixes) | P-F | Selection token: a pending zap open does nothing after a pause or an archive pick | pause / archive overridden | kept (tests P-F pass) | `tests/run.sh` (zap.test.js) |
| 2026-10-25 | uncommitted (branch perf-fixes) | P-G | Watchdog quiet while paused / suspended / retry pending; buffering timeout counted from the last progress | reopen during pause (PLAYING after suspend) and during progressing rebuffer | 0 reopens (tests pass; TV-6 pending) | `tests/run.sh` (player.test.js) |
| 2026-10-25 | uncommitted (branch perf-fixes) | P-I | Guide cache: LRU of 24 channels (the watched one never evicted), no `descr` | 100 full guides, 7 680 000 descr chars after 100 channels | 24 full guides, 0 descr chars | `node tools/perf-measure.js` (Node 22, harness, desktop); before = `KINOZAL_ROOT=<7a39bce tree>` |
| 2026-10-25 | uncommitted (branch perf-fixes) | P-J | Player: one retry chain per failure (generation bumped), backoff ±20 % jitter, reset only after 20 s of advancing playback | 0.5 s forever | 0.5 → 1 → 2 → 4 → 8 → 15 s (test P-J passes) | `tests/run.sh` (player.test.js) |
| 2026-10-25 | uncommitted (branch perf-fixes) | P-K | No fixed delay on a single press | open 350 ms after the press | open 0 ms after the press (desktop harness); TV first-frame time pending TV-2 | `node tools/perf-measure.js` (Node 22, harness, desktop); before = `KINOZAL_ROOT=<7a39bce tree>` |
| 2026-10-25 | uncommitted (branch perf-fixes) | P-L | `ADAPTIVE_INFO` = `STARTBITRATE=HIGHEST` (lowest rendition allowed); renditions per open recorded (`Diag` note `variants`) | lowest rendition excluded | allowed; TV-4 decides the effect | code review; TV-4 pending |
| 2026-10-25 | uncommitted (branch perf-fixes) | P-M | No storage write on the key path: last channel written once, 1 s after the landing channel plays; `failLog` batched every 30 s | 10 writes per 10-press burst (≤ 1 s after keys) | 0 | `node tools/perf-measure.js` (Node 22, harness, desktop); before = `KINOZAL_ROOT=<7a39bce tree>` |
| 2026-10-25 | uncommitted (branch perf-fixes) | P-N | `UI.column` writes a cell only when its value changed | ~26 rows rewritten per key | 2 rows per cursor move (only changed cells) | code review (ui.js `set`) |
| 2026-10-25 | uncommitted (branch perf-fixes) | P-O | Guide failure: cool-down with growing delay (30 s → 10 min, equal jitter), the watched channel retried by itself, failure keeps the "now" line | 12 007 guide requests in 10 min | 5–6 in 10 min (≤ 5 in the first minute) | `node tools/perf-measure.js` (Node 22, harness, desktop); before = `KINOZAL_ROOT=<7a39bce tree>` |
| 2026-10-25 | uncommitted (branch perf-fixes) | P-P | The saved last channel (`lastCh`) opens at boot in parallel with the list download | stream waits for the list | opened at boot (relaunch test passes); TV launch-to-first-frame pending TV-8 | `tests/run.sh` (list-load.test.js) |
| 2026-10-25 | uncommitted (branch perf-fixes) | P-Q | Subscriber key read once per session | 805 reads per 400-channel load | 1 | `node tools/perf-measure.js` (Node 22, harness, desktop); before = `KINOZAL_ROOT=<7a39bce tree>` |
| 2026-10-25 | uncommitted (branch perf-fixes) | P-R | Setup: one check in flight per session token; `Sources.start` idempotent | 2 refresh chains | 1 (test P-R passes) | `tests/run.sh` (setup-and-key.test.js) |
| 2026-10-25 | uncommitted (branch perf-fixes) | P-S | M3U parse sliced to 8 ms per task | one task | sliced (`CONFIG.SLICE_MS`) | code review; health/refresh M3U tests pass |
| 2026-10-25 | uncommitted (branch perf-fixes) | P-T | Stream info read once per attempt at its first frame; `''` before it (no previous channel's line) | re-read per banner; stale line shown | once per attempt | code review (player.js `streamInfo`) |
| 2026-10-25 | uncommitted (branch perf-fixes) | P-U | No `av.restore()`: return from Home reopens explicitly (live, or archive at the position) | synchronous restore, no prepare | prepareAsync path (test P-E Home passes); TV pending | `tests/run.sh` (player.test.js) |
| 2026-10-25 | uncommitted (branch perf-fixes) | P-V | `Channels.nextVisible`: bounded iterative walk; all dead → «Нет других доступных каналов» | recursion | iterative | code review |
| 2026-10-25 | uncommitted (branch perf-fixes) | P-W | Native pause: < 2 min resumes in place; ≥ 2 min or after Home reopens the archive at the paused moment | pause on live < 2 min jumped to live | resumes in place (desktop smoke: ⏸ / ▶) | session `smoke-perf.mjs`; TV-3 pending |
| 2026-10-25 | uncommitted (branch perf-fixes) | P-X | Rebuffer counters (`rebuffer`, `rebufferDoneMs`), settings rejections, variants in `Diag` (`localStorage.diag`, `Diag.snapshot()`) | none | recorded | code review; TV-9 pending |
| 2026-10-25 | uncommitted (branch perf-fixes) | P-Y | hls.js single-flight loader with SRI, element removed on error; binary-search guide lookups; precomputed sort keys | script tags N; linear scans; regex per comparison | 1 tag; O(log n); keys once | code review |
| 2026-10-25 | uncommitted (branch perf-fixes, iteration 2) | P-L (list part of P-Z: PE-21) | List retry: one shared backoff `Util.backoff` (base·2^n plus up to 25 %, capped); single retry chain. Row missing in iteration 1 | 179 list requests in a 30-min outage (fixed 10 s) | 10 in every one of 50 seeded runs (min 10, max 10); bound by construction: the shortest waits 10+20+40+80+160+300×4 s exceed 1800 s after 9 retries | `node tools/perf-measure.js` (Node 22, harness, desktop) + session `seeded.js` (50 seeds) |
| 2026-10-25 | uncommitted (branch perf-fixes, iteration 2) | P-O | Guide retry uses the same shared backoff (30 s → 10 min); a delay never shrinks; the panel says «Программа передач недоступна, повторю позже» during a cool-down instead of «загружается» | iteration 1: 5–6 in 10 min (3 of 20 runs gave 6) | 5 in every one of 50 seeded runs; bound: the shortest five waits 30+60+120+240+480 s exceed 600 s | session `seeded.js` (50 seeds) |
| 2026-10-25 | uncommitted (branch perf-fixes, iteration 2) | P-J | Player retry uses the shared backoff; the backoff resets only after STABLE_MS of uninterrupted advancing playback (a rebuffer or stall restarts the count); a failure while paused retries only on resume | retry #1, #1, #1 after three rebuffer-then-fail cycles | #1, #2, #3 | session `probes2.js` |
| 2026-10-25 | uncommitted (branch perf-fixes, iteration 2) | P-C | XMLTV scanner reuses the closing tag already found, so unclosed tags before one distant `</programme>` cost one search | iteration 1, unclosed tags + one closed: 8k 1010 ms, 16k 4007 ms, 32k 16035 ms (ratio 3.97, reviewer `probe-xmltv.js`) | 2k 0.8 · 4k 1.1 · 8k 2.1 · 16k 3.6 · 32k 6.6 ms (ratios 1.41/1.85/1.71/1.82); all-unclosed 32k 1.1 ms | session `xmltv-scale.js` |
| 2026-10-25 | uncommitted (branch perf-fixes, iteration 2) | P-A | The landing guide waits until zapping has settled (ZAP_IDLE_MS after the last press) as well as for the first frame | 4 requests when the leading channel's first frame arrives before press two | 3 | session `probes2.js` (prepare 1 ms) |
| 2026-10-25 | uncommitted (branch perf-fixes, iteration 2) | P-D, P-G | Background check only behind steady playback: stopped by pause, Home, any open, any rebuffer, direct picks; re-armed by STABLE_MS of playback + 60 s. Watchdog: only a higher buffering percentage restarts the buffering timeout; an unreadable AVPlay state is counted, the timeout still applies | 30 probes while paused; repeated 50 % progress: 0 reconnects in 60 s | 0 probes while paused (5 min); 3 reconnects in 60 s | session `probes2.js` |
| 2026-10-25 | uncommitted (branch perf-fixes, iteration 2) | P-B (P-Z PE-08) | Offline copy serialised once (`Util.save(key, value, maxChars)` checks the length of its own JSON) | 2 serialisations per write | 1 | code review (`util.js` save) |
| 2026-10-25 | uncommitted (branch perf-fixes, iteration 2) | P-P (startup) | Boot runs in its own task after the load event; row pools built on first use; key registration and hls.js preload in idle; the saved channel opens in the next task | longest startup task at 6× CPU: before the batch 64–67 ms; iteration 1: 50–54 ms | no task over 50 ms in 6 of 6 runs (load task 35–36 ms = page layout; boot task separate) | `CPU_THROTTLE=6` session `perfv/startup-cold.mjs` (6 runs) + `perfv/trace-cold.mjs` |
| 2026-10-25 | uncommitted (branch perf-fixes, iteration 3) | P-O, P-L (list), P-J | Shared backoff caps before the spread: min(max, base·2^n)·(1 + random/4), so delays at the cap keep their spread | iteration 2: spread lost at the cap | failed guide 5 / 10 min and list-down 10 / 30 min in all 50 seeded runs (max); below the cap a delay never shrinks | session `seeded.js` (50 seeds) + `tests/run.sh` (P-O, P-J) |
| 2026-10-25 | uncommitted (branch perf-fixes, iteration 3) | P-N (menu render) | Rows wrap instead of being cut (owner): the menu draws both columns, then reads the layout once for both and hides rows that do not fit completely; search computes the playing channel once per render | menu open 114–125 ms, 50 cursor moves 47–57 ms in total (median 1.0 ms), 5 pages 6.5–8.4 ms (6× CPU, before wrapping) | menu open 117–126 ms, 50 moves 54–56 ms (median 1.1–1.2 ms), 5 pages 7.4–9.5 ms; focused row fully visible after 73 moves at 1920×1080 and 1280×720 | `CPU_THROTTLE=6` session `e2e/menuperf.mjs` (3–4 runs each) + `e2e/wrapcheck.mjs` |
| 2026-10-25 | uncommitted (branch perf-fixes, iteration 4) | P-N (menu render, wrapping) | One layout read per render: a window that must move is placed from the heights already read (never read twice). A cursor row taller than the column is shown alone and ▼/▲ scroll through it by 80 % of the column (entering from below starts at its bottom) | iteration 3: up to 3 layouts per ▼ (test pin), refill loop up to 13 passes; tall cursor row clipped | ≤ 2 layouts per ▼ (pin passes; CDP LayoutCount 1.87 per key over 60 ▼ incl. the frame's own); key→frame median 12.2–12.5 ms, p90 13.4–13.5 ms with 60 long-name channels at 6× CPU; tall row (3796 px in a 910 px column) read in 5 steps, every line shown; ordinary menu: open 112–118 ms, 50 moves 49–50 ms | `CPU_THROTTLE=6` session `e2e/worstcase.mjs` (3 runs) + `e2e/menuperf.mjs` (3 runs) + `tests/run.sh --browser` |
| 2026-10-25 | uncommitted (branch perf-fixes, iteration 5) | P-N (paging, DEC-2026-10-25-paging) | CH±/PG± in the menu and search turn the page by the rows completely visible (down: the new page starts with the first row not shown; up: it ends right before the first row shown; the cursor lands on that row). The window now stays put while the cursor moves inside it (scrolls only at its edges). `ListView.reset` on every open (R4-1). One layout read per key press | pages of a fixed 13 (wrapped rows could be skipped unseen); window re-centred on every key | every channel completely visible on some page (browser pins); 48 page presses with 45 long-name channels at 6× CPU: key→frame median 14.4–14.8 ms, p90 15.7–16.0 ms, 1.56 layouts per key incl. the frame; arrows 60 ▼: median 13.0 ms, p90 15.2 ms, 1.70 layouts; ordinary menu open 120–125 ms, 50 moves 47–58 ms, 5 pages 7.6–8.6 ms | `CPU_THROTTLE=6` session `e2e/pagingperf.mjs` (3 runs), `e2e/worstcase.mjs`, `e2e/menuperf.mjs`; `tests/run.sh --browser` |
| 2026-10-25 | uncommitted (branch perf-fixes, iteration 5) | P-T (tech line, owner) | The stream's technical line appears with the banner at the first frame of every landing (live or archive) — «…» until the player describes the stream (a local read every 500 ms, no request) — and goes after TECH_LINE_MS (5 s); never the previous channel's values | tech line 1.2 s after the first frame (delayed banner) | desktop hls.js: tech line about 0.3 s after the press, gone 5 s later; 0 extra requests (pin) | session `e2e/techshot.mjs` + `tests/run.sh` (banner-tech.test.js) |

Each future performance fix appends one row here and changes its backlog Status to `DONE (<commit>)`. Rows are never deleted or rewritten; a correction is a new row.

## 7. Not yet verified on the TV

These items need a check on the device before they can be fixed or closed:

- **P-L — adaptive bitrate:** check whether the provider's playlists have several renditions; the finding matters only if they do.
- **P-W — provider timeshift:** test whether the provider's timeshift can replace the periodic archive reopen near live.
- **P-G — watchdog vs pause:** confirm on the TV that the watchdog restarts a paused or backgrounded stream.
- **P-X — rebuffer logging:** record rebuffers on the TV so "never stalls" can be measured on the device, not only on desktop.
