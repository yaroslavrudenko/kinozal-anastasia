# Test report — 2026-10-25 evening to 2026-10-26 afternoon

What was tested, how, how often and with what result, for the work of this period: the performance overhaul (merged as `0375363`), the "now on air" fixes D1–D7, the refresh policy `DEC-2026-10-26-now-refresh-2` (`f0b31a7`), the review fixes and the menu regression (`8413f34`). Every number below comes from a file in this repository or from the run named next to it; nothing is estimated unless it says "simulation".

## 1. Kinds of testing

| # | Kind | What it is | Where it runs |
|---|---|---|---|
| 1 | **Desktop behaviour suite** | Node 22 built-in test runner on the real app code with a fake clock, a fake network and real recorded provider answers (`tests/*.test.js`) | Mac, `tests/run.sh` |
| 2 | **Desktop layout tests** | Headless Chrome (puppeteer-core) on the real page: layout passes, wrapping, what is visible (`tests/browser/*.test.mjs`) | Mac, `tests/run.sh --browser` |
| 3 | **Mutation proofs** | Each new test is shown to fail when the guarded line is broken on purpose, then the file is restored (count before/after, diff clean, green again) | Mac, scripts in the session scratchpad |
| 4 | **By-name regression diff** | The full suite's JUnit report compared test by test with the previous commit: newly failing, newly absent, newly passing | Mac |
| 5 | **Dry runs of the TV runner** | `node tests/tv/run.mjs --dry`: the TV test cases in headless Chrome against the real provider list and guides, no picture | Mac, `tests/tv/results/*-dry.md` |
| 6 | **TV runs** | `node tests/tv/run.mjs` drives the installed app on the Samsung UE50MU7000 (Tizen 3.0) over the remote-debugging inspector: real keys, real AVPlay, real network | TV, `tests/tv/results/*-tv.md` |
| 7 | **Owner's cycle on the TV** | Install, open, switch away to another app and back twice, checking that video plays and time advances (`scratchpad/tv5/cycle2.sh`) | TV |
| 8 | **Simulations for the judges** | The app's own scheduler run in memory over 1 h of simulated time, 389 channels, with outages, partial answers, show ends every minute; counts requests and empty rows | Mac (scripts in the session scratchpad, results quoted in §4) |
| 9 | **Independent review** | The code was reviewed by reviewers who did not write it: a native expert and Codex (external) for the change, three judges for the design decision | — |

## 2. How the testing was done (process)

1. **Before a change:** a baseline — the full suite by test name on the starting commit, and on the TV a U0 run on the build already installed (`2026-10-26-11-58-tv.md` for the refresh policy).
2. **The change** is written with red→green tests: each new test is run on the old code first (it must fail), then on the new code (it must pass), then mutation-proven.
3. **Desktop gates before every commit:** ES5 syntax check of every changed `js/` file (acorn, `ecmaVersion 5`), the full suite with `--browser`, the by-name diff against the previous commit (0 newly failing, 0 newly absent), and a check that the provider key is in no staged line.
4. **Independent review** of the commit (native expert, Codex). Findings are fixed in the next commit with their own red→green tests.
5. **On the TV:** install with `./build.sh`, then the TV runner: U0 in every group, then the cases of the matrix the change touches (M2–M11, C2, COLD348). Results are written to `tests/tv/results/` and compared with the baseline group by group. Any row worse than the baseline means the change is reverted, not patched over.
6. **Docs:** `docs/TESTING.md` (cases, traceability, results), `docs/PERFORMANCE.md` (history), this report.

## 3. What was tested

| Area | Cases (docs/TESTING.md) | What is checked |
|---|---|---|
| The viewer's basic journey | **U0** in every one of the 11 groups | the menu rows (no empty row, the show on air), picking a channel, the banner (number, name, now, next, clock), first frame time, the tech line (resolution, codec, bitrate, sound), and since `8413f34` **that the menu is gone from the screen after the pick** (`U0.menu-closed`) |
| Menu left open | **M11** (30 min) | every minute, every row on screen against the provider's fresh answer |
| Zapping, stalls, soak | M2, M4, M5 | first frames, rebuffers, 10 min soak |
| Archive | C2, D1 | 8 archive positions, the 7-day edge, the 4 h request cap |
| Cold open of 348 | COLD348 | the provider fault (stream 404/429) |
| "Now on air" policy | 18 desktop tests `now refresh-2`, plus the old D5–D7 pins | requests only for rows on screen, local flip at the show end, fresh answers, outages (500, timeout, empty, not JSON, `{}`, no programmes) for 60 min, partial answers (50 of 389), the «(шла до HH:MM)» mark, recovery |
| Menu over the picture | 2 browser tests `menu closed` + TV row `U0.menu-closed` | after a pick from the menu or from search nothing under the menu is visible and the banner is shown |
| Owner's life cycle | cycle2 | reopen / return from another app twice |

## 4. Volume and how many times

**Desktop suite**

| Commit | Tests | Result |
|---|---|---|
| 37fb286 (baseline) | 192 | 192 pass |
| f0b31a7 | 210 | 210 pass; by name: 0 failing, 3 replaced (mapped old→new in TESTING.md), 18 new |
| 8413f34 | 216 | 216 pass; by name vs f0b31a7: 0 failing, 0 absent, 6 new |

The suite was run in full at least 6 times on 2026-10-26 (baseline, implementer and coordinator on each commit). Mutation proofs: 21 mutants for `f0b31a7` (all red), 4 + 3 for `8413f34` (all red); 15 of the 18 new tests of `f0b31a7` fail on 37fb286.

**Dry runs of the TV runner** (headless, real provider data): 17 runs between 2026-10-25 23:17 and 2026-10-26 13:52, files `tests/tv/results/*-dry.md`. The last two prove the new menu check: on `f0b31a7` 33 of 33 `U0.menu-closed` rows FAIL (89 menu elements visible after the pick), on `8413f34` 33 of 33 PASS.

**TV runs** (the real set):

| File | Build | Cases | Result |
|---|---|---|---|
| 2026-10-26-08-23-tv.md | f7ccc45 | M11 30 min | 360 row checks, 3 lagging (all < 60 s) |
| 2026-10-26-09-02-tv.md | d704bda | U0, M5, M4, M2 | 173 pass · 11 fail |
| 2026-10-26-09-52-tv.md | d704bda | U0, COLD348 | 166 pass · 11 fail |
| 2026-10-26-10-04-tv.md | 37fb286 | COLD348 | provider fault confirmed |
| 2026-10-26-11-58-tv.md | 37fb286 | U0 (baseline before the refresh policy) | 168 pass · 8 fail; 0 empty rows in 11 groups, 7 rows lagging < 60 s |
| (see §5) | 8413f34 | U0, M11 30 min | final run of this report |

Owner's cycle on the TV: passed on 37fb286. Manual checks on the TV by the coordinator over the inspector: "pick a channel → what text is visible" on 37fb286 (failed: menu text visible — the check first looked only at the container and missed it), on a hot-fixed copy of f0b31a7 and on 8413f34 (0 menu elements visible after the pick).

**Simulations for the judges** (1 h, 389 channels, in memory): requests with the menu open 59 → 13 per hour; playing row turns over 0.6 s after its show ends; partial answers 46 046 → 0 empty samples of 46 800; outage: 13 empty rows at 60 min → 0, marked «(шла до HH:MM)» after 15 min. These are simulations, not TV measurements.

## 5. Final TV run on 8413f34

File `tests/tv/results/2026-10-26-14-02-tv.md` (14:02–14:46, build `8413f34`): **PASS 199 · FAIL 12**.

| Check | Result | Baseline 11:58 (37fb286) |
|---|---|---|
| `U0.menu-closed` after every pick (new) | **33 of 33 PASS** — no menu text left over the picture | not checked (the bug was there) |
| Empty rows, 11 groups + the repeat after M11 | **0** | 0 |
| Rows lagging < 60 s after the show changed | 4 | 7 |
| Rows lagging **> 60 s** | **2** — «114 Живая природа» 98 s, one row in «Все каналы» after M11 210 s | 0 |
| M11, menu open 30 min | **390 row checks, 0 not on air**, reference fresh ≤ 5.5 s | 2026-10-26-08-23: 360 checks, 3 lagging |
| Banner == row, next, first frame, tech line | PASS on every channel except 348 | same |
| 348 Stingray iConcerts | no first frame, no «Далее» (provider fault) | same |
| Rows seen per group | 11/18 «Израиль», 49/56 «Национальные», 89/91 «Кино», 18/19 «Музыкальные» — unseen rows not counted | 324/349 «Все каналы», 48/49 «Развлекательные» |

**Reading:** the owner's bug is fixed on the TV; no row is ever empty; with the menu left open the rows are exact. **One regression remains:** a row scrolled into view whose show ended while it was off screen can show the ended show for longer than before (98 s and 210 s here, 0 in the baseline). Cause: after `f0b31a7` off-screen rows are no longer refreshed every minute; a page scrolled into view asks the provider 1 s after the keys rest, and the runner reads the page before that answer lands. Open item, see §7.

## 6. What testing missed, and what changed because of it

- **The menu stayed over the picture after a channel was picked** (regression of `88c1860`, present on 37fb286 and f0b31a7). The owner found it on the TV. No test looked at what is *visible* after the menu closes: the TV runner checked the menu's own state, and the first manual check after the report looked at the container's style only. Now a browser test and the TV row `U0.menu-closed` count the visible elements after every pick; both fail on the old code.
- **The TV runner disturbed the owner:** a run that drives the remote was started while the owner was watching, and his keys and the runner's mixed. Rule since then: TV runs only with a clear warning that the runner drives the screen.
- **Coverage gaps in U0:** some sweeps see fewer rows than the group has (e.g. 11 of 18 in «Израиль» on 8413f34); unseen rows are not counted as passed.
- **sdb drops:** the connection to the TV dropped several times; runs reconnect up to 3 times (`sdb-restart.command`). The cause is not found.

## 7. Open after this report

- 348 Stingray iConcerts does not play: provider fault (stream 404/429), no code change; its banner also shows no «Далее».
- ~~Regression (paging)~~ — fixed in the next commit, see §8.
- TV acceptance cases of the refresh policy not yet run on the TV: 20-min network cut, fast page-flipping stress, rebuffer counter soak, requests per hour with the menu open 60 min (`docs/TESTING.md` Q1-TV1…6).

## 8. Paging fix after the final run (owner: «да, исправляй и пушь»)

- Change: the open menu re-reads the whole list every 60 s (`NOW_OPEN_REREAD_MS`) instead of 5 min.
- New red→green test `now paging: a row scrolled into view never shows a show that ended more than 65 s before…`: on 8413f34 it fails (rows 71 s and 95 s behind), with the fix it passes.
- Suite: 217 tests, 217 pass. By name vs 8413f34: 0 newly failing; 3 renamed (the 5-min cadence tests):
  - «…the only requests are one every 5 min» → «…the only requests are the open menu's re-read every 60 s»
  - «…no refresh more often than every 5 min» → «…no refresh more often than the open menu's 60 s re-read»
  - «…or that answer is ≥ 5 min old» → «…or that answer is ≥ 60 s old»
- Two count assertions changed 23 → 119 and 29 → 119 refreshes in 2 h (60 s re-read); the T-flip test now asserts no answer landed between the show end and the flip (the 60 s re-read may run near the end).
- TV check of this commit: see the result file named in the commit that follows it.
