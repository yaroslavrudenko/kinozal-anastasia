# TV acceptance test plan — «Настин кинозал»

A build is accepted only when every scenario below passes **on the real TV** (UE50MU7000). Desktop tests and code reviews are not acceptance.

This file is the complete use-case catalogue: U0 and the test matrix first, then every screen, key, data state and playback state, the correctness of what the viewer sees, and a traceability table from every change to the cases that verify it. The automatic cases run with `tests/tv/run.mjs` (see «How every use case is verified»).

Each result row records the date, build (commit), channel (name, list position, bitrate) and the measured value. A failed row blocks the release, and the previous working build goes back on the TV.

## U0. The viewer's basic journey (run FIRST, in EVERY group)
The owner's own words: "this is what must be tested from the very beginning". Run it in every group: Все каналы, Избранное, Израиль, Украина, and every provider group.
1. Open the app.
2. Open the menu and enter the group.
3. Scroll through the group, all pages, and check how every channel looks: number, logo, name, nothing cut off.
4. Check that the right-hand column shows **what is on air now** for every channel. An empty cell is a FAIL, unless the provider has no programme for that channel (verified with the API).
5. Enter a channel. The banner must show:
   - the channel (number, logo, name);
   - the programme on air and its time range;
   - the clock and the progress bar;
   - **what comes next** («Далее» with its time);
   - the tech line;
   - while connecting, the state line.
6. Repeat step 5 for 3 channels per group, including the last channel of the group.

Record, per group: channels checked, empty "now" cells (must be 0), banner fields present, PASS/FAIL.

## Test matrix (mandatory before every release)

Every cell is a test case. A cell passes only when it is checked on the TV and recorded in the results. «—» means the cell does not apply.

**Columns, the channel sets C1–C5:**
- **C1 ALL:** every channel in «Все каналы», checked automatically via the inspector, page by page.
- **C2:** the far high-bitrate «Кино» channels (top 4 by measured Мбит/с).
- **C3:** the middle and second half of the list (~150, ~250, last).
- **C4:** Israel and Ukraine HD.
- **C5:** long names, and archives that cross midnight.

| # | Feature / state | C1 ALL | C2 | C3 | C4 | C5 |
|---|---|---|---|---|---|---|
| M1 | Menu row shows **name, logo and "now on air" title + time** (no empty «now» cell) | ✔ count empty cells: must be 0, unless the provider has no programme (verify with the API) | ✔ | ✔ | ✔ | ✔ |
| M2 | Menu: opens on the playing channel, playing marker, long names wrap, paging by visible rows, search | — | ✔ | ✔ | ✔ | ✔ |
| M3 | Banner on open: name, programme + time, clock, state line until the first frame, tech line after it | — | ✔ | ✔ | ✔ | — |
| M4 | ▼ programme panel: cursor on air, titles wrap, ◀▶ change the day, a past programme plays | — | ✔ | ✔ | ✔ | ✔ |
| M5 | ▲ slider: scrub back and forward (position correct ±10 s); start of a recording; **7-day edge**; to live | — | ✔ | ✔ | — | ✔ |
| M6 | Archive continuation into the next programme: position and clock correct, no jump | — | ✔ | — | — | ✔ |
| M7 | Zap: single press first-frame time; burst of 10 → right channel, ≤3 requests; across groups | — | ✔ | ✔ | ✔ | — |
| M8 | Pause: live 3 min and archive 1 min; resume in place; 0 requests while paused | — | ✔ | ✔ | — | — |
| M9 | Life cycle: close / open / exit + open / Home → other app → back ×2, live **and** archive | — | ✔ | ✔ | ✔ | — |
| M10 | Soak 10 min: 0 stalls, 0 reconnects | — | ✔ (2 channels) | — | ✔ | — |
| M11 | Time passes: after 30 min and after 2 h of running, «now» (M1) and the banner are still current | ✔ | — | — | — | — |
| M12 | Resource targets: 1 list parse, 0 writes before first frame, ≤24 guides kept, no background requests while zapping or paused | ✔ | — | — | — | — |

**Process:**
1. Install with the gate: a smoke check, then automatic rollback on any failure.
2. Run C1 automatically (M1, M11, M12).
3. Run C2–C5 by scenario.
4. Fill a results table with one row per cell: channel, measured value, PASS/FAIL.
5. Any FAIL: fix, then rerun the whole matrix, not only the failed cell.
6. The owner gets the matrix table, not a summary.

## How every use case is verified

- **AUTO-TV `<case>`**: the TV runner `tests/tv/run.mjs` executes it against the installed app through the Tizen inspector (`tests/tv/launch.sh`, then `node tests/tv/run.mjs`). It writes one results table per run to `tests/tv/results/`; copy that table under «Results» below. The same runner with `--dry` runs the app from the repository in headless Chrome. That validates the steps and the data checks, but it has no picture, so playback checks report DRY-SKIP.
- **MANUAL**: a person at the TV, by eye, using the steps given. Record the outcome as a row under «Results».
- **HARNESS `<file>`**: a desktop unit test in `tests/` (`tests/run.sh`, `--browser` for layout). It pins the mechanism. It is **not** acceptance; the TV row is still required.
- **Priority:** P0 is the viewer's basic journey (a FAIL blocks the release). P1 is an important feature or recovery path. P2 is an edge case or a resource target.
- **Channel sets:** C1 is every channel, C2 the far high-bitrate «Кино» channels, C3 the middle and second half of the list, C4 Israel and Ukraine HD, C5 long names and midnight archives (definitions above).

## Use-case catalogue

### A. Start, key and channel sources
| ID | Steps | Expected result | Set | Verified | P |
|---|---|---|---|---|---|
| A1 | Fresh install (no key), open the app | Setup screen: field focused, OK submits, the on-screen keyboard's «Done» submits | — | MANUAL | P0 |
| A2 | Setup: enter a valid key, OK | «Проверяю ключ…», then the list loads and a channel plays within 10 s | C3 | MANUAL | P0 |
| A3 | Setup: enter a wrong key | «Ключ не подошёл…», the setup stays open, nothing plays | — | MANUAL + HARNESS setup-and-key | P1 |
| A4 | Setup: paste an M3U link | The M3U list loads (groups from the playlist), a channel plays | — | MANUAL | P2 |
| A5 | Open with a saved last channel | That channel starts before the list arrives; then the list appears | C3 | MANUAL (owner's cycle, L11) | P0 |
| A6 | Open with the list server down and an offline copy saved | «Сервер не ответил — показан последний список…», all channels listed, a channel plays; when the network returns, «now» lines fill in | C1 | MANUAL (unplug the router) + HARNESS list-load, refresh-now | P1 |
| A7 | Open with the server down and no copy | Error text with «Повтор через N с»; the list appears by itself when the server returns | — | MANUAL + HARNESS list-load | P1 |
| A8 | The key expires (provider «no key» clip) | A clear bad-key message, not "every channel removed" | — | MANUAL | P1 |
| A9 | BLUE in the menu: change the key; BACK cancels | Old key kept on BACK; a new valid key reloads the app | — | MANUAL | P2 |
| A10 | The list refreshes (6 h, or «now» refresh) while watching | Playing channel continues; order and groups unchanged; no flicker | C1 | AUTO-TV M11 + HARNESS refresh-now | P1 |

### B. Channel menu and groups
| ID | Steps | Expected result | Set | Verified | P |
|---|---|---|---|---|---|
| B1 | OK while watching | The menu opens on the playing channel, which is highlighted and marked as playing | C3, C4 | AUTO-TV M2 | P0 |
| B2 | Walk every group with ◀ and ▲▼ | Group order: Поиск · Все каналы · Избранное · Израиль · Украина · provider groups · О программе; each shows its count | C1 | AUTO-TV U0 + MANUAL look | P0 |
| B3 | Every group, every page | Every row: number, logo, full name (wrapped, never cut), «now» = the programme on air per the API | C1 | **AUTO-TV U0** | P0 |
| B4 | CH+ / CH− (page) through a group with wrapped rows | Every channel completely visible on some page; the last page stays put; page-up mirrors | C1 | AUTO-TV U0 (paging walk) + HARNESS paging, page-end | P0 |
| B5 | A channel name or «now» taller than the screen | ▼ / ▲ scroll inside it until every line was seen, then move on; reopening starts at its top | C5 | MANUAL + HARNESS tall-row, reopen | P2 |
| B6 | Hebrew names (Israel group) | Right-to-left text readable, numbers and times not mirrored | C4 | MANUAL | P1 |
| B7 | A group that becomes empty (all removed / favourites cleared) | The group disappears; the cursor lands on an existing row | — | MANUAL + HARNESS menu | P2 |
| B8 | The list shrinks while the menu is open | A highlighted channel exists; OK tunes it | — | HARNESS menu | P2 |
| B9 | OK on a channel | The menu closes; the channel plays (U0 landing) | C1 sample | AUTO-TV U0.landing | P0 |
| B10 | Mouse click (desktop preview only) | A row click tunes; a group click switches | — | MANUAL (desktop) | P2 |

### S. Search
| ID | Steps | Expected result | Set | Verified | P |
|---|---|---|---|---|---|
| S1 | Menu → «Поиск» → type part of a name | Matching channels with their «now»; OK / ▼ enters the list; OK tunes | C3 | MANUAL + HARNESS menu | P1 |
| S2 | Type a channel number | That channel is found | — | MANUAL | P1 |
| S3 | A query matching more than 60 | The last row says «Показаны первые 60 из N — уточните запрос» | — | MANUAL | P2 |
| S4 | The playing channel in the results | Marked as playing | — | HARNESS menu | P2 |
| S5 | BACK from the list → field → menu | Each BACK goes one level up | — | MANUAL | P1 |

### F. Favourites
| ID | Steps | Expected result | Set | Verified | P |
|---|---|---|---|---|---|
| F1 | YELLOW while watching | Toast «Добавлено в избранное»; «★ Избранное» appears; ◀▶ keeps zapping in the group browsed before | C3 | MANUAL + HARNESS menu (zap group) | P1 |
| F2 | YELLOW / ⏯ on a menu row | ★ toggles on that row; the cursor stays on it | — | MANUAL | P1 |
| F3 | Favourites after a key change | Still marked (kept by channel, not by stream URL) | — | MANUAL | P2 |

### P. Programme panel (▼)
| ID | Steps | Expected result | Set | Verified | P |
|---|---|---|---|---|---|
| P1 | ▼ while watching | Cursor on the programme on air («в эфире»), = the API's programme; titles wrap | C2, C3, C4 | AUTO-TV M4 | P0 |
| P2 | ▼ before the channel's guide has arrived | «Программа загружается…» then the cursor moves to the programme on air (an ▲▼ that could not move does not stop it) | — | HARNESS panel | P1 |
| P3 | ◀ ▶ (CH±) | Days: Вчера / Сегодня / Завтра / weekday dates, back to 7 days, forward 1 | C2 | AUTO-TV M4 (one day) + MANUAL (all days) | P1 |
| P4 | OK on a past programme | It plays from its start; banner «Архив · HH:MM» with that title | C2, C3 | AUTO-TV M4, C2 | P0 |
| P5 | OK on a future programme | Toast «Передача ещё не началась» | — | MANUAL | P2 |
| P6 | Guide unavailable | «Программа передач недоступна, повторю позже», retried later | — | MANUAL + HARNESS guide | P2 |
| P7 | The day across a DST change | 23/25-hour days listed midnight to midnight | — | HARNESS epg-day | P2 |
| P8 | ▼ after midnight while a programme that started yesterday is on air | «Сегодня» shows that programme (or the panel opens on it) with «в эфире»; the cursor is not on a future programme | C5 | AUTO-TV M4 (run after midnight) + MANUAL | P0 |

### R. Archive slider (▲, ⏪ ⏩)
| ID | Steps | Expected result | Set | Verified | P |
|---|---|---|---|---|---|
| R1 | ▲, ◀ ×6, OK | Plays 3 min back; the position equals the knob time ±10 s | C2, C3 | AUTO-TV M5 | P0 |
| R2 | ▲ then ▲ / ▼ | Previous / next programme on the knob; OK plays it | C2 | MANUAL | P1 |
| R3 | Hold ◀ to the start of the archive (7-day edge) | The knob stops at the first moment the provider still serves; OK plays (D1) | C2 | AUTO-TV M5 (7-day-edge) | P1 |
| R4 | Hold ▶ to the live edge | «прямой эфир»; OK goes live | C2 | AUTO-TV M5 (to-live) | P1 |
| R5 | Title and «−N мин от эфира» | Title wraps; delta correct | C5 | MANUAL + HARNESS layout | P2 |

### Z. Zapping and choosing channels
| ID | Steps | Expected result | Set | Verified | P |
|---|---|---|---|---|---|
| Z1 | Single ◀▶ / CH± | First frame ≤ 3 s; banner with the new channel | C2, C3 | AUTO-TV M7 | P0 |
| Z2 | Burst of 10 quick presses | Lands on the 10th channel; ≤ 3 app requests | C2, C3 | AUTO-TV M7 (burst) | P1 |
| Z3 | Across a group boundary / past the end | Wraps inside the browsed group | C3 | MANUAL | P1 |
| Z4 | A channel found removed while zapping | Message, moves on in the same direction | — | MANUAL + HARNESS health | P2 |
| Z5 | PREV CH | Returns to the previous channel (even after a list refresh) | — | MANUAL + HARNESS refresh | P1 |
| Z6 | Digits 1-2-3 | Number shown; after 1.8 s channel 123; an unknown number «Нет канала N» | — | MANUAL | P1 |
| Z7 | Zap then quickly ▼ / ▲ / OK / Home / ⏯ | The latest choice wins (no reopen under an overlay, no stream in the background) | — | HARNESS races | P1 |

### N. Banner
| ID | Steps | Expected result | Set | Verified | P |
|---|---|---|---|---|---|
| N1 | Every landing (zap, menu, number, boot, return) | Number, logo, name; programme with its time range; progress; clock; «Далее HH:MM …» | C1 sample | AUTO-TV U0.banner-fields, U0.next | P0 |
| N2 | Until the first frame | State line: «Подключение…» / «Загрузка видео… N%» / «Нет сигнала — повтор через N с (попытка K)» / «Канал отключён провайдером»; never hides early | C2 | MANUAL + HARNESS connect-banner | P0 |
| N3 | After the first frame | Tech line (resolution · codec · fps · Мбит/с · sound) for TECH_LINE_MS, then hides | C2, C4 | AUTO-TV U0.tech-line | P0 |
| N4 | Banner "now" vs the menu row and the API | The same programme | C1 sample | **AUTO-TV U0.banner==row** | P0 |
| N5 | INFO | The banner with current data | — | MANUAL | P1 |
| N6 | In the archive | «Архив · HH:MM» and the archive programme | C2 | AUTO-TV M4 | P1 |

### L. Playback states and life cycle
| ID | Steps | Expected result | Set | Verified | P |
|---|---|---|---|---|---|
| L1 | Watch live 10 min | 0 stalls, 0 reconnects, media time +60 s/min | C2 (2), C4 | AUTO-TV M10 | P1 |
| L2 | ⏯ live 3 min, ⏯ | Stays paused, 0 requests; resumes at the paused moment (archive) | C2 | AUTO-TV M8 (60 s) + MANUAL 3 min | P0 |
| L3 | ⏯ in the archive 1 min, ⏯ | Resumes in place ±5 s | C2 | AUTO-TV M8 (pause from live) + MANUAL (pause inside an archive film) | P1 |
| L4 | Pause while buffering | Stays paused; resume plays | C2 | MANUAL | P2 |
| L5 | A stall / rebuffer | State banner during it; reconnects after the timeout; position kept in the archive | C2 | MANUAL + HARNESS player, connect-banner | P1 |
| L6 | A stream failing repeatedly | Retries with growing delays (up to 15 s), «Нет сигнала…» line | — | MANUAL + HARNESS player, backoff | P1 |
| L7 | End of an archive recording | Continues into the next programme, position correct (D2) | C2, C5 | AUTO-TV M6 | P1 |
| L8 | Archive programme across midnight | Plays across 00:00 | C5 | MANUAL (not yet in the runner) | P1 |
| L9 | Home → another app → back (live) | Same channel PLAYING within 10 s | C2, C3, C4 | AUTO-TV M9 (OTHER_APP=…) | P0 |
| L10 | The same during an archive film | Resumes at the same point | C2 | AUTO-TV M9 | P0 |
| L11 | Close / open / exit + open | Plays the last channel within 10 s | C3 | MANUAL (owner's cycle) | P0 |
| L12 | Network lost / back | «Нет сети» / «Сеть восстановлена»; reconnects; archive keeps its position | C2 | MANUAL (unplug) + HARNESS player | P1 |
| L13 | Running for 2 h | «now» lines and the banner still current | C1 | AUTO-TV M11 | P0 |
| L14 | STOP / BACK in the archive | Back to live; double BACK on live exits | — | MANUAL | P1 |
| L15 | A TV platform call fails (error 18) | The app still starts and zaps | — | HARNESS platform-throws; TV boot itself | P0 |

### O. Other screens and keys
| ID | Steps | Expected result | Set | Verified | P |
|---|---|---|---|---|---|
| O1 | Menu → «О программе» | «Настин кинозал», version = config.xml, build, TV model, sources, buffer values | — | MANUAL + HARNESS config | P1 |
| O2 | «О программе» → OK on the adult switch | Group «Для взрослых» shown / hidden everywhere (menu, search, numbers, zap) | — | MANUAL + HARNESS menu (eligibility) | P1 |
| O3 | RED | Next audio track (toast with language), «одна дорожка» when there is one | C4 | MANUAL | P2 |
| O4 | GREEN | Picture mode cycles Авто / Во весь экран / С полями, remembered | — | MANUAL | P2 |
| O5 | BLUE while watching | Toast with the stream's tech line | — | MANUAL | P2 |
| O6 | Every key in every state (table below) | Does what the table says; nothing else | — | MANUAL | P1 |

**Key map (O6): each cell is a check.**
| Key | Watching | Menu | Panel ▼ | Slider ▲ | Search list | О программе | Setup |
|---|---|---|---|---|---|---|---|
| ◀ ▶ / CH± | zap | ◀ groups, ▶ channels · CH± page | day | scrub / page | — / page | — | — |
| ▲ ▼ | ▲ slider, ▼ panel | move | move | prev/next programme | move | — | — |
| OK | menu | tune / open group | play | play from knob | tune | toggle adult | submit |
| BACK | archive → live; twice → exit | close | close | close | to field, to menu | close | cancel (key change) |
| ⏯ / ⏸ / ▶ | pause / resume | favourite | — | — | — | — | — |
| ⏹ | to live | — | — | — | — | — | — |
| ⏪ ⏩ | slider with a step | — | — | step ≥ 5 min | — | — | — |
| INFO | banner | — | — | — | — | — | — |
| RED / GREEN / BLUE / YELLOW | audio / picture / tech / favourite | — / — / key / favourite | — | — | — | — | — |
| PREV CH | previous channel | — | — | — | — | — | — |
| Digits | channel number | — | — | — | — | — | — |

### D. Correctness of displayed data
| ID | Steps | Expected result | Set | Verified | P |
|---|---|---|---|---|---|
| D1 | Every menu row's «now» | = the programme the API says is on air at that moment (an ended programme never shown longer than ~10 s) | C1 | **AUTO-TV U0.rows, M11** | P0 |
| D2 | Banner on landing | = the menu row = the API | C1 sample | **AUTO-TV U0.banner==row** | P0 |
| D3 | «Далее» | = the next programme in the guide, with its start time | C1 sample | AUTO-TV U0.next | P0 |
| D4 | Times and dates | Local time; the panel's day names; the slider's HH:MM:SS; the clock | — | AUTO-TV (clock) + MANUAL | P1 |
| D5 | A channel without a programme in the API | Empty «now» is allowed (counted separately) | C1 | AUTO-TV U0.rows («no API programme») | P1 |
| D6 | Archive position | The banner's «Архив · HH:MM» = the moment actually shown | C2 | AUTO-TV M5, M6, M9 | P1 |
| D7 | Long names, Hebrew | Full text present, wrapped | C4, C5 | AUTO-TV U0 (text equality) + HARNESS layout | P1 |

### X. Resource targets
| ID | Steps | Expected result | Set | Verified | P |
|---|---|---|---|---|---|
| X1 | Launch | One list parse; nothing written before the first frame | — | MANUAL (inspector, early script) + HARNESS list-load | P2 |
| X2 | Zapping / pause | No background requests | — | AUTO-TV M7 (burst count), M8 (pause count) | P2 |
| X3 | Guide on 30 channels | ≤ 24 guides kept, no descriptions | — | HARNESS guide | P2 |
| X4 | «now» refresh | One request per refresh, ≥ 60 s apart, ≥ 5 min without an ended programme | — | HARNESS refresh-now | P2 |

### Counts
86 use cases plus the key map (O6, 11 keys × 7 states): **P0 26 · P1 38 · P2 22**. Verification: **28 fully AUTO-TV**, 6 AUTO-TV with a MANUAL part, 52 MANUAL or HARNESS only (a person at the TV is needed for acceptance). Of the 26 P0 cases, 20 have AUTO-TV coverage; the other P0 cases (A1, A2, A5, N2, L11, L15) are MANUAL on the TV.

## Traceability: change → use cases that verify it
| Change (docs/PERFORMANCE.md change log / owner request) | Use cases |
|---|---|
| P-A zap: leading-edge open, guide after the first frame, abort passed channels | Z1, Z2, X2 |
| P-B list parsed once, offline copy after the first frame | A6, X1 |
| P-C XMLTV linear scanner | A4 (M3U with url-tvg), HARNESS xmltv |
| P-D health check only behind steady playback | Z4, X2, L2 |
| P-E / P-H archive position from the media clock; retry / Home reopen at the position | L3, L5, L10, L12, D6 |
| P-F a pending zap never overrides a later choice | Z7 |
| P-G watchdog quiet while paused; buffering timeout from the last progress | L2, L4, L5 |
| P-I guide cache 24, no descriptions | X3 |
| P-J player backoff, reset after 20 s of advancing playback | L6 |
| P-K no fixed delay on a single press | Z1 |
| P-L adaptive bitrate / renditions recorded | N3, L1 |
| P-M no storage writes on the key path | X2 |
| P-N rows wrap, one layout read, paging by visible rows, tall rows scroll, page end stable | B3, B4, B5, D7 |
| P-O guide failure cool-down; «недоступна» text | P6 |
| P-P saved channel opens at boot | A5, L11 |
| P-Q key read once | A2 |
| P-R setup single check | A2, A3 |
| P-S M3U parse sliced | A4 |
| P-T tech line on every landing | N3 |
| P-U no `av.restore()` | L9, L10 |
| P-V bounded next-channel walk | Z4 |
| P-W native pause < 2 min in place, ≥ 2 min reopen | L2, L3 |
| P-X rebuffer counters | L1, L5 |
| P-Y hls.js loader, binary-search guide | P1, N1 |
| List / guide retry backoff, spread at the cap | A7, P6, L6 |
| Owner: «Настин кинозал» name | O1 |
| Owner: menu opens on the playing channel + playing marker | B1 |
| Owner: everything fits, nothing cut | B3, B5, R5, D7 |
| Owner: connection banner until the first frame | N2, L5 |
| Owner: tech line on landing | N3 |
| Owner: «now» current and correct (refresh, accuracy) | D1, D2, A10, L13 |
| Owner: U0 basic journey in every group | B2, B3, B9, N1, N4, D1–D3 |
| TV crash: platform call throws error 18 | L15 |
| D1 (7-day edge never starts) | R3 |
| D2 (continuation jumps ~50 s) | L7 |
| D4 (dry run 2026-10-26: ▼ after midnight has no programme on air) | P8 |

## Channels to use (never only the default one)
- Two channels from the middle and two from the second half of «Все каналы» (positions ~150, ~250, last).
- The three or four movie channels in «Кино» with the highest bitrate and resolution, read from the tech line.
- One Israeli and one Ukrainian HD channel.
- A channel with a very long name.
- A channel whose archive programme crosses midnight.

## Earlier scenario lists (2026-10-25, kept; every item is now a use case above)

## 1. Life cycle (owner's cycle)
Run it once from a second-half channel and once from the heaviest movie channel.
1. Close the app.
2. Open it: a channel plays within 10 s.
3. Exit and open again: it plays.
4. Home → another app (OTT Club or YouTube) → wait 20 s → Home → our app: it plays within 10 s. Do this twice.
5. The same, while an archive film is playing on a movie channel: it resumes at the same point.

### 2. Zapping
- A single CH± or ◀▶ press: first frame time on 10 different channels.
- A burst of 10 quick presses lands on the right channel, with at most 3 app requests.
- Crossing group boundaries works.
- Zapping into a channel the provider removed shows a message and moves on.

### 3. Archive (movie channels)
- From the ▼ panel, open a film from yesterday and from 3 or more days ago. It plays, with the right title in the banner.
- Switching between programmes in the panel and the ▲ slider: each one plays.
- Inside a film, scrub −30 min and +20 min several times. Playback starts at the chosen moment; the expected and actual position match within 10 s.
- Scrubbing to the start of a recording works. Scrubbing to the end or near live switches to live.
- Pause in the archive for 1 min: it resumes at the same point.
- The end of a recording continues into the next piece.
- A programme crossing midnight plays.

### 4. Pause and stability
- Live pause for 3 min stays paused, with no network requests and no reopen.
- Pause during buffering on the heaviest channel works.
- Watch two movie channels for 10 min each: 0 stalls and 0 reconnects (from the failure log).

### 5. Screens
- Menu: opening it lands on the playing channel, which is marked. Long names wrap. CH± pages by the rows that are visible, so no channel is skipped.
- Search finds channels.
- ▼ panel: the cursor is on the programme on air, titles wrap, and ◀▶ change the day.
- ▲ slider: the title wraps, and the times and «−N мин от эфира» are correct.
- Banner: on every landing it shows channel, programme, time and the tech line (resolution · codec · fps · Мбит/с · sound) for about 5 s.
- «О программе» shows «Настин кинозал», the version and the device. The adult-channels switch works.

### 6. Resource limits (optimisation targets)
- The channel list is parsed once per load.
- Nothing is written to storage before the first frame.
- After opening the guide on 30 channels, at most 24 guides are kept, with no descriptions.
- The background check sends no requests while zapping or paused.

## Results
Each run adds a table under this line; rows are never deleted.

### 2026-10-26 00:10 — main `0375363`
Owner's cycle only, landing channel 1+1 Україна:

| Scenario | Result | PASS/FAIL |
|---|---|---|
| close → open | PLAYING, time 13.0 → 17.1 s | PASS |
| exit → open | PLAYING, time 13.7 → 17.7 s | PASS |
| Home → OTT Club → back (1) | PLAYING, time 10.8 → 14.8 s | PASS |
| Home → OTT Club → back (2) | PLAYING, time 10.9 → 14.9 s | PASS |
| failure log | empty | PASS |

### 2026-10-26 00:30–00:55 — main `0375363`, partial (stopped for the night)

| Scenario | Channel | Result | PASS/FAIL |
|---|---|---|---|
| Return from another app during an archive film | «Now You See Me» (movie channel, archive) | PLAYING, position advancing | PASS |
| Live soak | Viju+ Megahit · 1080p · 10.9 Mbit/s | 5+ min PLAYING, 60 s of media per minute, no new failures | PASS (shortened) |
| Archive start / to live / archive pause / live pause | movie channels | logs captured; 2 failure-log entries during the pause tests | OPEN — to analyse |
| Sections 2, 3, 5 and 6 on far high-bitrate «Кино» channels | — | not run yet | NOT-RUN |

### 2026-10-26 00:20–01:00 — main `0375363`, full run on far high-bitrate movie channels (agent report, verbatim)

# TV results — 2026-10-26 00:15–00:58, main `0375363` («Настин кинозал» 1.7.0), UE50MU7000

All checks below were run on the real TV through the Tizen inspector (Runtime.evaluate, synthetic remote keys). App requests were counted with an in-page XMLHttpRequest wrapper. AVPlay fetches media natively, so media segments are not counted. First frame = the app's own first-frame hook (`Zap.onFirstFrame`) minus the key press.

Screenshots: `Page.captureScreenshot` hangs on this firmware, and no file was written. **No visual check was seen.** Every "banner / slider / panel" value below is DOM text that the inspector read.

## Ranked «Кино» list (master playlists fetched inside the app, max BANDWIDTH)
| # | Channel | «Кино» # | «Все каналы» # | Mbit/s | Resolution |
|---|---|---|---|---|---|
| 1 | Дорама | 9 | 138 | 9.8 | 1920×1080 |
| 2 | Мужское кино | 42 | 171 | 9.4 | 1920×1080 |
| 3 | **Viju+ Megahit** | 59 | 188 | 9.4 | 1920×1080 |
| 4 | **Кинокомедия** | 74 | 203 | 9.1 | 1920×1080 |
| 5 | **sci-fi** | 56 | 185 | 8.8 | 1920×1080 |
| 6 | **Kinoliving** | 87 | 216 | 8.6 | 1920×1080 |
| 7–11 | Kinosweet, KinoKazka, Fan, Твій Серіал, Kinowood | | | 8.6 | 1080p |
| … | 19 channels ≥ 7.1 Mbit/s have 2 renditions; Fresh * 5.8–6.5; most others 3.5–5.5; 13 SD channels 1.4–2.3 (1024/1048×576) | | | | |

Test set (top 4 in the second half of «Кино»): Viju+ Megahit, Кинокомедия, sci-fi, Kinoliving.

The tech line reports the current rendition's bitrate, which is higher than the master BANDWIDTH: Viju+ Megahit 10.9–11.7, Kinowood 10.7–10.8, Amedia Premium 10.1, Fresh Cinema 8.1 Mbit/s.

Full list: `masters.json`.

## Results (docs/TESTING.md order)
| Scenario | Channel (name · «Все» pos · Mbit/s) | Measured | PASS/FAIL |
|---|---|---|---|
| **1. Life cycle** | | | |
| 1.1–1.4 close/open/exit/other app ×2 | 1+1 Україна (coordinator's run 00:10) | PLAYING each time (see TESTING.md table) | PASS (only the default channel) |
| 1.1–1.4 from a second-half channel / heaviest movie channel | — | not run (stopped for the night) | NOT-RUN |
| 1.5 Home → OTT Club 20 s → back, during an archive film | Viju+ Megahit · 188 · 10.9, archive 25.10 21:40 «Now You See Me» | hidden at 21:40:09 (AVPlay PAUSED); PLAYING again about 2 s after the return, at 21:40:09, advancing 1 s/s | PASS |
| Cold launch → first frame | 1+1 Україна (saved channel) | ≤ 2180 ms after navigationStart (1 run, 50 ms poll); no uncaught errors | PASS (1 of 3 runs; the other runs were lost to an sdb drop) |
| Reload → first frame | 1+1 Україна | 2199 / 1985 / 2011 ms | PASS |
| **2. Zapping** | | | |
| Single CH+ / CH− press → first frame, 10 different channels | Kinowood 217 → Cartoons Big 226 (Kinowood 10.8, Наше любимое кино 10.5, Cineman Ментовские войны 5.2, BCU 5.5, Nick Jr 2.1 SD, JimJam 2.2, Піксель 4.9, Fresh Kids 8.1, Cartoons Short 4.4, Cartoons Big 4.4) | 1756/1678/1434/1491/1500/1634/1736/1589/1632/1604 ms · median 1611 · max 1756 | PASS |
| Single press inside «Кино» | Viju+ Megahit 188 ↔ Бестселлер 193 (Viju+ Comedy 9.5, Viju+ Premiere 9.6) | 10 presses, 1334–1653 ms, median 1440 | PASS |
| Single press (earlier sample) | К2 ↔ 1+1 Україна | median 1549, max 1634 | PASS |
| Burst of 10 presses at ~140 ms | Кинокомедия 203 → Еврокино 213 («Кино» group) | landed on Еврокино (expected); 1 app request (its guide); 2 opens (leading edge + landing); lastCh/lastUrl written once | PASS |
| Burst of 10, wrapping past the end of the list | Жара 349 → i24 (Израиль) 10 | landed on i24 (expected); 1 request | PASS |
| Burst of 10 (earlier) | 1+1 → КТК (Казахстан) and back | 1 and 0 requests, correct landing | PASS |
| Crossing a group boundary | BCU 220 («Кино») → Nick Jr 221 (Детские) | plays, 1500 ms | PASS |
| Removed channel | Cinema (#172, dead) | dead channels are not in any group, so zapping never lands on one; typing 1-7-2 shows «Нет канала 172» | PASS (partial: the live probe turning a channel dead mid-session was not reproducible) |
| **3. Archive (movie channels)** | | | |
| ▼ panel, film from yesterday | Viju+ Megahit · 188 | 25.10 08:50 «Механик: Воскрешение»: first frame 2005 ms, position 08:50:07 at +9 s | PASS |
| ▼ panel, 3 days back | Viju+ Megahit · 188 | 23.10 11:00 «End Of Days»: first frame 2357 ms, 11:00:07 | PASS |
| Switching programmes in the panel | Кинокомедия · 203 | «Снегурочка против всех» 2161 ms, «Пара на пару» 2258 ms; the banner shows the right title and «Архив · HH:MM» | PASS |
| Switching programmes in the ▲ slider («соседняя передача» ▲ / ▼) | Кинокомедия · 203 | prev → «Снегурочка…» 04:30, 1616 ms; next → «Несвятая Валентина» 07:15, 1804 ms; banner correct | PASS |
| Scrub back/forward ×2 | sci-fi · 185 | −17.5 min → 04:11:49, ff 1954 ms; +19 min → 04:30:59, 1617 ms; −33 min → 03:58:10, 1815 ms; +19 min → 04:17:21, 1739 ms. Knob vs played position: Δ ≤ 1 s (the app's own clock; the stream content could not be checked visually). Each CDP press took ~400 ms, so the hold acceleration produced −17.5 min, not −30 | PASS |
| Scrub to the very start of the recording (7-day edge) | Кинокомедия · 203 | knob 19.10 01:36 → AVPlay stays IDLE; «buffering timeout 30 s» every 30 s; no picture after 60 s | **FAIL — D1** |
| Archive at start + 5 min | Кинокомедия · 203 | 19.10 01:41 plays | PASS |
| Scrub to live | Кинокомедия · 203 | the slider shows «прямой эфир»; OK → live, first frame 1628 ms | PASS |
| Archive pause 1 min | Kinoliving · 216 | paused at 23:38:29 for 60 s, 0 requests; resumed in place at 23:38:29 → advancing | PASS |
| End of recording continues into the next piece | Viju+ Megahit · 188; Kinoliving · 216 | continues into the next programme («From Paris with Love», «Все ненавидят Йохана») without a failure, but the position jumps ~50 s ahead | **PASS with defect D2** |
| Programme crossing midnight | Kinoliving · 216 «Свистуны» 24.10 23:00–00:30 | started 23:59:01 (ff 2041 ms), played across 00:00 to 00:00:47, 0 failures | PASS |
| **4. Pause and stability** | | | |
| Live pause 3 min | Дорама · 138 · 9.8 | PAUSED for 180 s, 0 app requests, no reopen; resume → archive at the paused moment 00:41:26 (ff 1730 ms) | PASS |
| Pause during buffering, heaviest channel | Viju+ Megahit · 188 · 10.9 | paused while preparing (READY) for 60 s, 0 requests, no failure; resume → PLAYING in 514 ms | PASS |
| Soak 10 min | Viju+ Megahit · 188 · 10.9 | 60 samples, PLAYING in all 60, media time +60 s/min, 0 frozen samples, 0 new failures, 0 rebuffers | PASS (the channel was changed from outside in the last minute, see note) |
| Soak 10 min, second movie channel | Кинокомедия · 203 | stopped at the owner's end-of-day order | NOT-RUN |
| **5. Screens** (menu, search, panel cursor, slider wrap, banner tech line ~5 s, About / adult switch) | — | stopped for the night. Partial evidence: the tech line `resolution · H264 · Mbit/s · звук стерео` appears on every landing (all scan rows above); the panel cursor opens on the on-air programme | NOT-RUN (only partial evidence) |
| **6. Resource limits** | | | |
| List parsed once per load | reload ×3 | 1 JSON.parse of 382 927 chars per load | PASS |
| Nothing written before the first frame | reload ×3 | 0 writes before the first frame; `playlistSnap` (40 365 chars) 13–54 ms after it | PASS |
| Guide on 30 channels: ≤ 24 kept, no descr | — | not run | NOT-RUN |
| Background check silent while zapping or paused | bursts, 3-min pause, 1-min pause | 0 health/probe requests during the bursts and pauses (the only requests were the landing guide) | PASS (no separate 5-min network log) |

## The 2 failure-log entries
`2026-10-25T22:37:40Z #1 buffering timeout 30 s` and `22:38:11Z #2 buffering timeout 30 s`. Both come from the "scrub to the very start of the recording" test (D1) on Кинокомедия at 19.10 01:37, the 7-day archive edge. The archive never started, and the player retried every 30 s until I switched channel. No other failure was logged in any test.

## Defects
- **D1 (MEDIUM) — archive at the 7-day edge never starts and retries forever.**
  - Steps: Кинокомедия → ▲ → hold ◀ until the knob stops at the earliest moment (≈ now − 7 days) → OK.
  - Result: black screen. AVPlay stays IDLE, «buffering timeout 30 s» every 30 s, and the retry reopens the same moment, which by then is even further outside the provider's window.
  - The slider lets the knob reach a moment before the first guide programme (01:36 vs 01:40) that the provider no longer serves.
  - Start + 5 min plays fine.
- **D2 (MEDIUM) — position jumps ~50 s ahead after a recording continues into the next piece.**
  - Steps: Kinoliving archive at 25.10 00:29:20 (the programme ends 00:30) → wait for the end.
  - Sample log `s3-end-sample.log`: at the reopen, AVPlay currentTime of the new stream starts at ~50 s instead of ~0 (39 015 → 50 390 ms). `Playback.position()` = anchor + media time, so it reads 00:30:52 while the real moment is ≈ 00:30:05. Same on Viju+ Megahit (01:55:56 at ≈ 6 s after the reopen).
  - Effect: the banner and slider time are wrong by ~50 s, and a later long-pause or retry reopen skips ~50 s of the film.
  - Initial archive opens, the panel and the slider do not show it (currentTime starts at ~1 s).
- **D3 (LOW, environment) — `Page.captureScreenshot` hangs on this firmware.** No visual check is possible via CDP.
- **Note (not a defect):** during the last minute of the soak and after it, the playing channel changed without any action of mine (Cineman Скорая помощь, then CineMan Action). Someone was most likely using the remote. I left the app on the channel that was playing (CineMan Action, live, PLAYING).

## Evidence
Logs in this folder: masters.json, scan-kino.log, a1-burst*.log, a2-single.log, a3-reload*.log, a3-cold.log, s2-*.log, s3-*.log, s4-*.log, s1-archive-return.log, soak-megahit.log.

**Defects opened by this run:** D1 (scrub to the 7-day edge → black, retries a moment the provider no longer serves), D2 (archive continuation: player clock starts ~50 s in, position runs ~50 s ahead). Both MEDIUM, to fix next.

### 2026-10-26 01:30–01:55 — DRY runs of the TV runner (desktop, headless Chrome, main checkout code, real provider list and guides, no picture)

Not acceptance: it validates the runner and the data checks. Playback rows are DRY-SKIP and must be run on the TV.

**Found:**
- **D4 (MEDIUM, viewer-visible): after midnight the ▼ panel's «Сегодня» has no programme on air when that programme started before 00:00.** The cursor lands on a future programme. Run 2: 1+1 Україна, Астана ТВ, Armenia Premium 1 (the same on 4ever Music by hand). Use case P8.
- U0 found no empty and no wrong «now» cell: 11 groups, 372/372 channels each time. Channels without a programme in the API are counted as «no API programme».

#### Run 1 — 2026-10-26 01:42 local (file `tests/tv/results/2026-10-25-23-42-dry.md`, named in UTC) — DRY (desktop, headless Chrome, no picture) · cases U0,M2,M4,M5,M7,M8,M9,M6,C2,M10,M11

PASS 87 · FAIL 0 · DRY-SKIP 114 · NOT-RUN 1

| Case | Channel / group | Measured | Result |
|---|---|---|---|
| U0.rows | Все каналы | 372/372 rows seen · empty 0 · not on air 0 · no API programme 28 | PASS |
| U0.banner-fields | Все каналы · 1 Channel 9 (Израиль) | num «1» · title «Channel 9 (Израиль)» · now «01:25⁠–⁠02:15 Т/с "Свидетели", 82 с. "Долгая память".» · next «Далее 02:15 "День".» · clock «01:42» · shown true | PASS |
| U0.banner==row | Все каналы · 1 Channel 9 (Израиль) | menu «Т/с "Свидетели", 82 с. "Долгая память".» · banner «01:25⁠–⁠02:15 Т/с "Свидетели", 82 с. "Долгая память".» · API on air «Т/с "Свидетели", 82 с. "Долгая память".» | PASS |
| U0.next | Все каналы · 1 Channel 9 (Израиль) | guide next «"День".» · banner «Далее 02:15 "День".» | PASS |
| U0.first-frame | Все каналы · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Все каналы · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Все каналы · 186 Кинохит | num «186» · title «Кинохит» · now «00:00⁠–⁠02:20 Х/ф "Долина теней".» · next «» · clock «01:42» · shown true | PASS |
| U0.banner==row | Все каналы · 186 Кинохит | menu «Х/ф "Долина теней".» · banner «00:00⁠–⁠02:20 Х/ф "Долина теней".» · API on air «Х/ф "Долина теней".» | PASS |
| U0.next | Все каналы · 186 Кинохит | guide next «Х/ф "Большой солдат".» · banner «» | DRY-SKIP |
| U0.first-frame | Все каналы · 186 Кинохит | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Все каналы · 186 Кинохит | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Все каналы · 372 Жара | num «372» · title «Жара» · now «00:30⁠–⁠03:40 Музыкальный блок» · next «» · clock «01:42» · shown true | PASS |
| U0.banner==row | Все каналы · 372 Жара | menu «Музыкальный блок» · banner «00:30⁠–⁠03:40 Музыкальный блок» · API on air «Музыкальный блок» | PASS |
| U0.next | Все каналы · 372 Жара | guide next «Мегамикс» · banner «» | DRY-SKIP |
| U0.first-frame | Все каналы · 372 Жара | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Все каналы · 372 Жара | no picture in dry mode | DRY-SKIP |
| U0.rows | Израиль | 18/18 rows seen · empty 0 · not on air 0 · no API programme 1 | PASS |
| U0.banner-fields | Израиль · 1 Channel 9 (Израиль) | num «1» · title «Channel 9 (Израиль)» · now «01:25⁠–⁠02:15 Т/с "Свидетели", 82 с. "Долгая память".» · next «Далее 02:15 "День".» · clock «01:42» · shown true | PASS |
| U0.banner==row | Израиль · 1 Channel 9 (Израиль) | menu «Т/с "Свидетели", 82 с. "Долгая память".» · banner «01:25⁠–⁠02:15 Т/с "Свидетели", 82 с. "Долгая память".» · API on air «Т/с "Свидетели", 82 с. "Долгая память".» | PASS |
| U0.next | Израиль · 1 Channel 9 (Израиль) | guide next «"День".» · banner «Далее 02:15 "День".» | PASS |
| U0.first-frame | Израиль · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Израиль · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Израиль · 9 HOP! (Израиль) | num «9» · title «HOP! (Израиль)» · now «00:00⁠–⁠02:00 רדיו ללה» · next «» · clock «01:42» · shown true | PASS |
| U0.banner==row | Израиль · 9 HOP! (Израиль) | menu «רדיו ללה» · banner «00:00⁠–⁠02:00 רדיו ללה» · API on air «רדיו ללה» | PASS |
| U0.next | Израиль · 9 HOP! (Израиль) | guide next «רדיו ללה» · banner «» | DRY-SKIP |
| U0.first-frame | Израиль · 9 HOP! (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Израиль · 9 HOP! (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Израиль · 18 HOT HBO (Израиль) | num «18» · title «HOT HBO (Израиль)» · now «00:58⁠–⁠01:54 כנופיית הווסטיז» · next «» · clock «01:43» · shown true | PASS |
| U0.banner==row | Израиль · 18 HOT HBO (Израиль) | menu «כנופיית הווסטיז» · banner «00:58⁠–⁠01:54 כנופיית הווסטיז» · API on air «כנופיית הווסטיז» | PASS |
| U0.next | Израиль · 18 HOT HBO (Израиль) | guide next «לודוויג» · banner «» | DRY-SKIP |
| U0.first-frame | Израиль · 18 HOT HBO (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Израиль · 18 HOT HBO (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.rows | Украина | 91/91 rows seen · empty 0 · not on air 0 · no API programme 9 | PASS |
| U0.banner-fields | Украина · 19 Інтер | num «19» · title «Інтер» · now «01:00⁠–⁠02:00 "Єдині новини". Телемарафон.» · next «» · clock «01:43» · shown true | PASS |
| U0.banner==row | Украина · 19 Інтер | menu «"Єдині новини". Телемарафон.» · banner «01:00⁠–⁠02:00 "Єдині новини". Телемарафон.» · API on air «"Єдині новини". Телемарафон.» | PASS |
| U0.next | Украина · 19 Інтер | guide next «"Єдині новини". Телемарафон.» · banner «» | DRY-SKIP |
| U0.first-frame | Украина · 19 Інтер | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Украина · 19 Інтер | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Украина · 255 Setanta Sports UA | num «255» · title «Setanta Sports UA» · now «01:00⁠–⁠03:00 Футбол. Чемпионат Англии. Премьер-лига. Челси » · next «» · clock «01:43» · shown true | PASS |
| U0.banner==row | Украина · 255 Setanta Sports UA | menu «Футбол. Чемпионат Англии. Премьер-лига. Челси - Тоттенхэм Хо» · banner «01:00⁠–⁠03:00 Футбол. Чемпионат Англии. Премьер-лига. Челси » · API on air «Футбол. Чемпионат Англии. Премьер-лига. Челси - Тоттенхэм Хотспур.» | PASS |
| U0.next | Украина · 255 Setanta Sports UA | guide next «Футбол. Чемпионат Англии. Премьер-лига. Астон Вилла - Манчестер Сити.» · banner «» | DRY-SKIP |
| U0.first-frame | Украина · 255 Setanta Sports UA | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Украина · 255 Setanta Sports UA | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Украина · 366 Viva Latino | num «366» · title «Viva Latino» · now «21:00⁠–⁠05:00 Кліпи.» · next «» · clock «01:43» · shown true | PASS |
| U0.banner==row | Украина · 366 Viva Latino | menu «Кліпи.» · banner «21:00⁠–⁠05:00 Кліпи.» · API on air «Кліпи.» | PASS |
| U0.next | Украина · 366 Viva Latino | guide next «Кліпи.» · banner «» | DRY-SKIP |
| U0.first-frame | Украина · 366 Viva Latino | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Украина · 366 Viva Latino | no picture in dry mode | DRY-SKIP |
| U0.rows | Национальные | 62/62 rows seen · empty 0 · not on air 0 · no API programme 7 | PASS |
| U0.banner-fields | Национальные · 1 Channel 9 (Израиль) | num «1» · title «Channel 9 (Израиль)» · now «01:25⁠–⁠02:15 Т/с "Свидетели", 82 с. "Долгая память".» · next «Далее 02:15 "День".» · clock «01:43» · shown true | PASS |
| U0.banner==row | Национальные · 1 Channel 9 (Израиль) | menu «Т/с "Свидетели", 82 с. "Долгая память".» · banner «01:25⁠–⁠02:15 Т/с "Свидетели", 82 с. "Долгая память".» · API on air «Т/с "Свидетели", 82 с. "Долгая память".» | PASS |
| U0.next | Национальные · 1 Channel 9 (Израиль) | guide next «"День".» · banner «Далее 02:15 "День".» | PASS |
| U0.first-frame | Национальные · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Национальные · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Национальные · 31 Астана ТВ (Казахстан) | num «31» · title «Астана ТВ (Казахстан)» · now «20:10⁠–⁠02:30 Жажда мести» · next «» · clock «01:43» · shown true | PASS |
| U0.banner==row | Национальные · 31 Астана ТВ (Казахстан) | menu «Жажда мести» · banner «20:10⁠–⁠02:30 Жажда мести» · API on air «Жажда мести» | PASS |
| U0.next | Национальные · 31 Астана ТВ (Казахстан) | guide next «—» · banner «» | DRY-SKIP |
| U0.first-frame | Национальные · 31 Астана ТВ (Казахстан) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Национальные · 31 Астана ТВ (Казахстан) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Национальные · 62 Армія TV | num «62» · title «Армія TV» · now «00:00⁠–⁠01:44 Д/ф "12. Земля Героїв".» · next «» · clock «01:43» · shown true | PASS |
| U0.banner==row | Национальные · 62 Армія TV | menu «Д/ф "12. Земля Героїв".» · banner «00:00⁠–⁠01:44 Д/ф "12. Земля Героїв".» · API on air «—» | PASS |
| U0.next | Национальные · 62 Армія TV | guide next «"Відтягуйтесь, я прикрию!": подвиг воїна "Золотаря", який з важким пораненням відбивався від рою FPV \|\| Ukrainian Witness.» · banner «» | DRY-SKIP |
| U0.first-frame | Национальные · 62 Армія TV | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Национальные · 62 Армія TV | no picture in dry mode | DRY-SKIP |
| U0.rows | Новостные | 11/11 rows seen · empty 0 · not on air 0 · no API programme 0 | PASS |
| U0.banner-fields | Новостные · 63 Deutsche Welle | num «63» · title «Deutsche Welle» · now «01:30⁠–⁠02:00 REV. Mad for Mercedes: South Africans" love fo» · next «» · clock «01:44» · shown true | PASS |
| U0.banner==row | Новостные · 63 Deutsche Welle | menu «REV. Mad for Mercedes: South Africans" love for old Benz mod» · banner «01:30⁠–⁠02:00 REV. Mad for Mercedes: South Africans" love fo» · API on air «REV. Mad for Mercedes: South Africans" love for old Benz models.» | PASS |
| U0.next | Новостные · 63 Deutsche Welle | guide next «DW News.» · banner «» | DRY-SKIP |
| U0.first-frame | Новостные · 63 Deutsche Welle | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Новостные · 63 Deutsche Welle | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Новостные · 68 FreeДОМ | num «68» · title «FreeДОМ» · now «01:30⁠–⁠04:00 Марафон "FreeДОМ" UA.» · next «» · clock «01:44» · shown true | PASS |
| U0.banner==row | Новостные · 68 FreeДОМ | menu «Марафон "FreeДОМ" UA.» · banner «01:30⁠–⁠04:00 Марафон "FreeДОМ" UA.» · API on air «Марафон "FreeДОМ" UA.» | PASS |
| U0.next | Новостные · 68 FreeДОМ | guide next «Д/ф "Сімейний альбом".» · banner «» | DRY-SKIP |
| U0.first-frame | Новостные · 68 FreeДОМ | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Новостные · 68 FreeДОМ | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Новостные · 73 Новини Live | num «73» · title «Новини Live» · now «01:00⁠–⁠02:00 Нет данных» · next «» · clock «01:44» · shown true | PASS |
| U0.banner==row | Новостные · 73 Новини Live | menu «Нет данных» · banner «01:00⁠–⁠02:00 Нет данных» · API on air «Нет данных» | PASS |
| U0.next | Новостные · 73 Новини Live | guide next «—» · banner «» | DRY-SKIP |
| U0.first-frame | Новостные · 73 Новини Live | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Новостные · 73 Новини Live | no picture in dry mode | DRY-SKIP |
| U0.rows | Познавательные | 64/64 rows seen · empty 0 · not on air 0 · no API programme 7 | PASS |
| U0.banner-fields | Познавательные · 74 National Geographic | num «74» · title «National Geographic» · now «01:05⁠–⁠01:45 д/с Расследования авиакатастроф (Совместные ме» · next «» · clock «01:44» · shown true | PASS |
| U0.banner==row | Познавательные · 74 National Geographic | menu «д/с Расследования авиакатастроф (Совместные меры)» · banner «01:05⁠–⁠01:45 д/с Расследования авиакатастроф (Совместные ме» · API on air «д/с Расследования авиакатастроф (Совместные меры)» | PASS |
| U0.next | Познавательные · 74 National Geographic | guide next «д/с Расследования авиакатастроф (Хаос в кабине)» · banner «» | DRY-SKIP |
| U0.first-frame | Познавательные · 74 National Geographic | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Познавательные · 74 National Geographic | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Познавательные · 105 Discovery | num «105» · title «Discovery» · now «01:30⁠–⁠02:00 Пограничная служба: Испания 9. 2» · next «» · clock «01:44» · shown true | PASS |
| U0.banner==row | Познавательные · 105 Discovery | menu «Пограничная служба: Испания 9. 2» · banner «01:30⁠–⁠02:00 Пограничная служба: Испания 9. 2» · API on air «Пограничная служба: Испания 9. 2» | PASS |
| U0.next | Познавательные · 105 Discovery | guide next «Золотая лихорадка, 15 с-н 23 с. Последний танец» · banner «» | DRY-SKIP |
| U0.first-frame | Познавательные · 105 Discovery | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Познавательные · 105 Discovery | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Познавательные · 137 ЗооСвіт | num «137» · title «ЗооСвіт» · now «01:25⁠–⁠01:55 Дикі тварини. Маленькі, але смертельні хижаки.» · next «» · clock «01:44» · shown true | PASS |
| U0.banner==row | Познавательные · 137 ЗооСвіт | menu «Дикі тварини. Маленькі, але смертельні хижаки.» · banner «01:25⁠–⁠01:55 Дикі тварини. Маленькі, але смертельні хижаки.» · API on air «Дикі тварини. Маленькі, але смертельні хижаки.» | PASS |
| U0.next | Познавательные · 137 ЗооСвіт | guide next «Дикі тварини у зоопарку Сан-Дієго. Пармський валлабі, американський ворон, огляд горили.» · banner «» | DRY-SKIP |
| U0.first-frame | Познавательные · 137 ЗооСвіт | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Познавательные · 137 ЗооСвіт | no picture in dry mode | DRY-SKIP |
| U0.rows | Кино | 95/95 rows seen · empty 0 · not on air 0 · no API programme 4 | PASS |
| U0.banner-fields | Кино · 138 KinoKazka | num «138» · title «KinoKazka» · now «01:15⁠–⁠02:55 х/ф Стражи времени» · next «» · clock «01:44» · shown true | PASS |
| U0.banner==row | Кино · 138 KinoKazka | menu «х/ф Стражи времени» · banner «01:15⁠–⁠02:55 х/ф Стражи времени» · API on air «х/ф Стражи времени» | PASS |
| U0.next | Кино · 138 KinoKazka | guide next «м/ф Норм и Несокрушимые: Семейные каникулы» · banner «» | DRY-SKIP |
| U0.first-frame | Кино · 138 KinoKazka | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Кино · 138 KinoKazka | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Кино · 185 Cineman MiniSeries | num «185» · title «Cineman MiniSeries» · now «01:19⁠–⁠01:46 Нормальные люди 1 сезон 7 серия» · next «» · clock «01:45» · shown true | PASS |
| U0.banner==row | Кино · 185 Cineman MiniSeries | menu «Нормальные люди 1 сезон 7 серия» · banner «01:19⁠–⁠01:46 Нормальные люди 1 сезон 7 серия» · API on air «Нормальные люди 1 сезон 7 серия» | PASS |
| U0.next | Кино · 185 Cineman MiniSeries | guide next «Нормальные люди 1 сезон 8 серия» · banner «» | DRY-SKIP |
| U0.first-frame | Кино · 185 Cineman MiniSeries | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Кино · 185 Cineman MiniSeries | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Кино · 232 BCU | num «232» · title «BCU» · now «01:00⁠–⁠02:00 Нет данных» · next «» · clock «01:45» · shown true | PASS |
| U0.banner==row | Кино · 232 BCU | menu «Нет данных» · banner «01:00⁠–⁠02:00 Нет данных» · API on air «Нет данных» | PASS |
| U0.next | Кино · 232 BCU | guide next «—» · banner «» | DRY-SKIP |
| U0.first-frame | Кино · 232 BCU | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Кино · 232 BCU | no picture in dry mode | DRY-SKIP |
| U0.rows | Детские | 22/22 rows seen · empty 0 · not on air 0 · no API programme 6 | PASS |
| U0.banner-fields | Детские · 233 Nick Jr | num «233» · title «Nick Jr» · now «» · next «» · clock «01:45» · shown true | DRY-SKIP |
| U0.banner==row | Детские · 233 Nick Jr | menu «» · banner «» · API on air «—» | PASS |
| U0.next | Детские · 233 Nick Jr | guide next «М/с "Щенячий патруль", 10 сезон, 19 с. "Щенки спасают слоновий курорт / Щенки спасают подводного Отиса".» · banner «» | DRY-SKIP |
| U0.first-frame | Детские · 233 Nick Jr | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Детские · 233 Nick Jr | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Детские · 243 В гостях у сказки | num «243» · title «В гостях у сказки» · now «» · next «» · clock «01:45» · shown true | DRY-SKIP |
| U0.banner==row | Детские · 243 В гостях у сказки | menu «» · banner «» · API on air «—» | PASS |
| U0.next | Детские · 243 В гостях у сказки | guide next «М/с "Смешарики", 149 с. "Слишком фигурное катание: часть 1".» · banner «» | DRY-SKIP |
| U0.first-frame | Детские · 243 В гостях у сказки | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Детские · 243 В гостях у сказки | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Детские · 254 Nickelodeon | num «254» · title «Nickelodeon» · now «01:33⁠–⁠01:55 Лучш и Лучшик» · next «» · clock «01:45» · shown true | PASS |
| U0.banner==row | Детские · 254 Nickelodeon | menu «Лучш и Лучшик» · banner «01:33⁠–⁠01:55 Лучш и Лучшик» · API on air «Лучш и Лучшик» | PASS |
| U0.next | Детские · 254 Nickelodeon | guide next «Лучш и Лучшик» · banner «» | DRY-SKIP |
| U0.first-frame | Детские · 254 Nickelodeon | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Детские · 254 Nickelodeon | no picture in dry mode | DRY-SKIP |
| U0.rows | Спорт | 41/41 rows seen · empty 0 · not on air 0 · no API programme 3 | PASS |
| U0.banner-fields | Спорт · 255 Setanta Sports UA | num «255» · title «Setanta Sports UA» · now «01:00⁠–⁠03:00 Футбол. Чемпионат Англии. Премьер-лига. Челси » · next «» · clock «01:45» · shown true | PASS |
| U0.banner==row | Спорт · 255 Setanta Sports UA | menu «Футбол. Чемпионат Англии. Премьер-лига. Челси - Тоттенхэм Хо» · banner «01:00⁠–⁠03:00 Футбол. Чемпионат Англии. Премьер-лига. Челси » · API on air «Футбол. Чемпионат Англии. Премьер-лига. Челси - Тоттенхэм Хотспур.» | PASS |
| U0.next | Спорт · 255 Setanta Sports UA | guide next «Футбол. Чемпионат Англии. Премьер-лига. Астон Вилла - Манчестер Сити.» · banner «» | DRY-SKIP |
| U0.first-frame | Спорт · 255 Setanta Sports UA | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Спорт · 255 Setanta Sports UA | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Спорт · 275 KHL ТВ | num «275» · title «KHL ТВ» · now «01:30⁠–⁠03:50 ФОНБЕТ Чемпионат КХЛ. "Спартак" - "Шанхайские » · next «» · clock «01:45» · shown true | PASS |
| U0.banner==row | Спорт · 275 KHL ТВ | menu «ФОНБЕТ Чемпионат КХЛ. "Спартак" - "Шанхайские Драконы" (Кита» · banner «01:30⁠–⁠03:50 ФОНБЕТ Чемпионат КХЛ. "Спартак" - "Шанхайские » · API on air «ФОНБЕТ Чемпионат КХЛ. "Спартак" - "Шанхайские Драконы" (Китай).» | PASS |
| U0.next | Спорт · 275 KHL ТВ | guide next «"Всё, кроме хоккея".» · banner «» | DRY-SKIP |
| U0.first-frame | Спорт · 275 KHL ТВ | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Спорт · 275 KHL ТВ | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Спорт · 295 ОККО Прайм Спорт | num «295» · title «ОККО Прайм Спорт» · now «22:55⁠–⁠02:40 Футбол. Чемпионат Франции» · next «» · clock «01:46» · shown true | PASS |
| U0.banner==row | Спорт · 295 ОККО Прайм Спорт | menu «Футбол. Чемпионат Франции» · banner «22:55⁠–⁠02:40 Футбол. Чемпионат Франции» · API on air «Футбол. Чемпионат Франции» | PASS |
| U0.next | Спорт · 295 ОККО Прайм Спорт | guide next «Тревел-шоу. Сезон 1. Серия 10. Чек-лист: Мюнхен. Октоберфест. Матч Германия – Сербия» · banner «» | DRY-SKIP |
| U0.first-frame | Спорт · 295 ОККО Прайм Спорт | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Спорт · 295 ОККО Прайм Спорт | no picture in dry mode | DRY-SKIP |
| U0.rows | Развлекательные | 52/52 rows seen · empty 0 · not on air 0 · no API programme 10 | PASS |
| U0.banner-fields | Развлекательные · 296 Fashion ONE | num «296» · title «Fashion ONE» · now «» · next «» · clock «01:46» · shown true | DRY-SKIP |
| U0.banner==row | Развлекательные · 296 Fashion ONE | menu «» · banner «» · API on air «—» | PASS |
| U0.next | Развлекательные · 296 Fashion ONE | guide next «Модные Показы. IRINA VALERY. Осень-Зима22-23. Неделя моды в Санкт-Петербурге (12+)» · banner «» | DRY-SKIP |
| U0.first-frame | Развлекательные · 296 Fashion ONE | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Развлекательные · 296 Fashion ONE | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Развлекательные · 321 Панянка-селянка+ | num «321» · title «Панянка-селянка+» · now «01:00⁠–⁠02:00 Програма відсутня» · next «» · clock «01:46» · shown true | PASS |
| U0.banner==row | Развлекательные · 321 Панянка-селянка+ | menu «Програма відсутня» · banner «01:00⁠–⁠02:00 Програма відсутня» · API on air «Програма відсутня» | PASS |
| U0.next | Развлекательные · 321 Панянка-селянка+ | guide next «Програма відсутня» · banner «» | DRY-SKIP |
| U0.first-frame | Развлекательные · 321 Панянка-селянка+ | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Развлекательные · 321 Панянка-селянка+ | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Развлекательные · 347 Ми - Україна | num «347» · title «Ми - Україна» · now «01:00⁠–⁠02:00 "Єдині новини". Телемарафон.» · next «» · clock «01:46» · shown true | PASS |
| U0.banner==row | Развлекательные · 347 Ми - Україна | menu «"Єдині новини". Телемарафон.» · banner «01:00⁠–⁠02:00 "Єдині новини". Телемарафон.» · API on air «"Єдині новини". Телемарафон.» | PASS |
| U0.next | Развлекательные · 347 Ми - Україна | guide next «"Єдині новини". Телемарафон.» · banner «» | DRY-SKIP |
| U0.first-frame | Развлекательные · 347 Ми - Україна | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Развлекательные · 347 Ми - Україна | no picture in dry mode | DRY-SKIP |
| U0.rows | Музыкальные | 25/25 rows seen · empty 0 · not on air 0 · no API programme 0 | PASS |
| U0.banner-fields | Музыкальные · 348 Stingray iConcerts | num «348» · title «Stingray iConcerts» · now «01:00⁠–⁠03:11 Duane Allman: Song Of The South. 2013.» · next «» · clock «01:46» · shown true | PASS |
| U0.banner==row | Музыкальные · 348 Stingray iConcerts | menu «Duane Allman: Song Of The South. 2013.» · banner «01:00⁠–⁠03:11 Duane Allman: Song Of The South. 2013.» · API on air «Duane Allman: Song Of The South. 2013.» | PASS |
| U0.next | Музыкальные · 348 Stingray iConcerts | guide next «Charlie Puth: Live in London. 2015.» · banner «» | DRY-SKIP |
| U0.first-frame | Музыкальные · 348 Stingray iConcerts | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Музыкальные · 348 Stingray iConcerts | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Музыкальные · 360 4ever Music | num «360» · title «4ever Music» · now «21:00⁠–⁠05:00 Хіти минулих років.» · next «» · clock «01:46» · shown true | PASS |
| U0.banner==row | Музыкальные · 360 4ever Music | menu «Хіти минулих років.» · banner «21:00⁠–⁠05:00 Хіти минулих років.» · API on air «Хіти минулих років.» | PASS |
| U0.next | Музыкальные · 360 4ever Music | guide next «Хіти минулих років.» · banner «» | DRY-SKIP |
| U0.first-frame | Музыкальные · 360 4ever Music | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Музыкальные · 360 4ever Music | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Музыкальные · 372 Жара | num «372» · title «Жара» · now «00:30⁠–⁠03:40 Музыкальный блок» · next «» · clock «01:46» · shown true | PASS |
| U0.banner==row | Музыкальные · 372 Жара | menu «Музыкальный блок» · banner «00:30⁠–⁠03:40 Музыкальный блок» · API on air «Музыкальный блок» | PASS |
| U0.next | Музыкальные · 372 Жара | guide next «Мегамикс» · banner «» | DRY-SKIP |
| U0.first-frame | Музыкальные · 372 Жара | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Музыкальные · 372 Жара | no picture in dry mode | DRY-SKIP |
| M2.open-on-playing | 372 Жара | cursor on 372 Жара  ▶ · playing marker true | PASS |
| M4.cursor-on-air | 372 Жара | 00:30 «Музыкальный блок» в эфире · API «Музыкальный блок» | PASS |
| M4.day-back | 372 Жара | Жара — Вчера | PASS |
| M4.past-plays | 372 Жара | «Жара 13» → mode archive · banner «Жара · Архив · 00:00» · dry | PASS |
| M5.scrub-back | 372 Жара | knob 01:44:05 · position 01:44:05 · dry | PASS |
| M5.7-day-edge (D1) | 372 Жара | knob 02:49:05 · mode archive · no picture in dry mode | DRY-SKIP |
| M5.to-live | 372 Жара | knob прямой эфир · mode live | PASS |
| M7.single | 348 Stingray iConcerts | no picture in dry mode | DRY-SKIP |
| M7.single | 349 Stingray CMusic | no picture in dry mode | DRY-SKIP |
| M7.single | 350 М1 | no picture in dry mode | DRY-SKIP |
| M7.burst | from 350 М1 | landed 360 4ever Music (expected 360 4ever Music) · 2 app requests | PASS |
| M8.paused | 360 4ever Music | mode paused · 0 requests in 10 s | PASS |
| M8.resume-in-place | 360 4ever Music | paused at 01:51:22 · resumed at 01:51:22 (archive) | DRY-SKIP |
| M9.live | 360 4ever Music · simulated hide | live → live · position 01:51:35 → 01:51:40 · dry | PASS |
| M9.archive | 360 4ever Music · simulated hide | archive → archive · position 01:48:40 → 01:48:40 · dry | PASS |
| M6.continuation (D2) | — | no picture in dry mode | DRY-SKIP |
| C2.archive-1d | 197 Viju+ Megahit | «From Paris with Love» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-3d | 197 Viju+ Megahit | «Бременские музыканты (6+)» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-1d | 215 Кинокомедия | «х/ф Игра киллера» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-3d | 215 Кинокомедия | «х/ф Козёл отпущения» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-1d | 194 sci-fi | «Х/ф "Поезд в пусан".» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-3d | 194 sci-fi | «Т/с "Хемлок Гроув", 3 сезон, 4 с.» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-1d | 228 Kinoliving | «х/ф Все ненавидят Йохана» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-3d | 228 Kinoliving | «т/с Пайрэт Бэй ┊ 5» · mode archive · no picture in dry mode | DRY-SKIP |
| M10.soak | — | no picture in dry mode | DRY-SKIP |
| M11 | — | skipped (--m11-min 0) | NOT-RUN |
| app-errors | — | failure log lines: 40 | INFO |

#### Run 2 — 2026-10-26 01:53 local (file `tests/tv/results/2026-10-25-23-53-dry.md`) — DRY (desktop, headless Chrome, no picture) · cases M4

PASS 3 · FAIL 3 · DRY-SKIP 0 · NOT-RUN 0

| Case | Channel / group | Measured | Result |
|---|---|---|---|
| M4.cursor-on-air | 1 Channel 9 (Израиль) | 01:25 «Т/с "Свидетели", 82 с. "Долгая память".» в эфире · API «Т/с "Свидетели", 82 с. "Долгая память".» | PASS |
| M4.day-back | 1 Channel 9 (Израиль) | Channel 9 (Израиль) — Вчера | PASS |
| M4.past-plays | 1 Channel 9 (Израиль) | «Т/с "Свидетели", 82 с. "Долгая память".» → mode archive · banner «Channel 9 (Израиль) · Архив · 01:25» · dry | PASS |
| M4.after-midnight (P8) | 22 1+1 Україна | on air «"Світ навиворіт".» (started before 00:00) · panel «1+1 Україна — Сегодня» cursor 05:30 «"Життя відомих людей".»  | FAIL |
| M4.after-midnight (P8) | 31 Астана ТВ (Казахстан) | on air «Жажда мести» (started before 00:00) · panel «Астана ТВ (Казахстан) — Сегодня» cursor 02:30 «Кулфи»  | FAIL |
| M4.after-midnight (P8) | 52 Armenia Premium 1 | on air «Հ/Ս "Գոյամարտ ս189-ս192"» (started before 00:00) · panel «Armenia Premium 1 — Сегодня» cursor 02:05 «Օպերատիվ ժամ»  | FAIL |
| app-errors | — | failure log lines: 21 | INFO |

### 2026-10-26 01:55–02:37 — DRY run of the TV runner against the perf-fixes worktree (snapshot 01:5x), M11 with 30 min

Not acceptance: desktop headless Chrome, real provider data, no picture. Tree: a frozen copy of `kinozal-anastasia-perf`.

**Found:**
- **D5 (HIGH, viewer-visible): empty «now» cells while the provider has a programme on air (perf-fixes tree).**
  - First pass: Спорт 1 (289 Суспільне Спорт); Развлекательные 7 (298 Новий канал, 306 ОЦЕ, 311 Дім, 317 Вопросы и ответы …). The banner for 254 Nickelodeon was also empty while the API had «Лучш и Лучшик».
  - M11, menu left open 30 min: 64 of 332 per-minute row checks empty while the API had a programme (225 Еврокино, 226 Fan, 230 Наше любимое кино, 231 Cineman Ментовские войны, 232 BCU …).
  - After 30 min: 30 empty rows among channels 222–372.
  - The main-checkout runs at 01:18–01:42 (no now-lines refresh code) had 0 empty cells.
- D4 is fixed in this tree: `M4.after-midnight` PASS on 1+1 Україна, Астана ТВ, Armenia Premium 1 (cursor on the programme that started before 00:00, «в эфире»).
- Runner defect, fixed after this run: `M11·U0.rows` saw 151/372 because the group walk started from the playing channel, not the top. `openGroup` now pages up to the top first.

#### 2026-10-26 01:55 (local) — DRY (desktop, headless Chrome, no picture) · tree /private/tmp/claude-501/-Users-yaroslavr/40bd8e7a-b591-426c-be3d-f3bef355966b/scratchpad/worktree-snap15 · cases U0,M2,M4,M5,M7,M8,M9,M6,C2,M10,M11

PASS 87 · FAIL 6 · DRY-SKIP 113 · NOT-RUN 0

| Case | Channel / group | Measured | Result |
|---|---|---|---|
| U0.rows | Все каналы | 372/372 rows seen · empty 0 · not on air 0 · no API programme 35 | PASS |
| U0.banner-fields | Все каналы · 1 Channel 9 (Израиль) | num «1» · title «Channel 9 (Израиль)» · now «01:25⁠–⁠02:15 Т/с "Свидетели", 82 с. "Долгая память".» · next «Далее 02:15 "День".» · clock «01:55» · shown true | PASS |
| U0.banner==row | Все каналы · 1 Channel 9 (Израиль) | menu «Т/с "Свидетели", 82 с. "Долгая память".» · banner «01:25⁠–⁠02:15 Т/с "Свидетели", 82 с. "Долгая память".» · API on air «Т/с "Свидетели", 82 с. "Долгая память".» | PASS |
| U0.next | Все каналы · 1 Channel 9 (Израиль) | guide next «"День".» · banner «Далее 02:15 "День".» | PASS |
| U0.first-frame | Все каналы · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Все каналы · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Все каналы · 186 Кинохит | num «186» · title «Кинохит» · now «00:00⁠–⁠02:20 Х/ф "Долина теней".» · next «» · clock «01:56» · shown true | PASS |
| U0.banner==row | Все каналы · 186 Кинохит | menu «Х/ф "Долина теней".» · banner «00:00⁠–⁠02:20 Х/ф "Долина теней".» · API on air «Х/ф "Долина теней".» | PASS |
| U0.next | Все каналы · 186 Кинохит | guide next «Х/ф "Большой солдат".» · banner «» | DRY-SKIP |
| U0.first-frame | Все каналы · 186 Кинохит | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Все каналы · 186 Кинохит | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Все каналы · 372 Жара | num «372» · title «Жара» · now «00:30⁠–⁠03:40 Музыкальный блок» · next «» · clock «01:56» · shown true | PASS |
| U0.banner==row | Все каналы · 372 Жара | menu «Музыкальный блок» · banner «00:30⁠–⁠03:40 Музыкальный блок» · API on air «Музыкальный блок» | PASS |
| U0.next | Все каналы · 372 Жара | guide next «Мегамикс» · banner «» | DRY-SKIP |
| U0.first-frame | Все каналы · 372 Жара | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Все каналы · 372 Жара | no picture in dry mode | DRY-SKIP |
| U0.rows | Израиль | 18/18 rows seen · empty 0 · not on air 0 · no API programme 4 | PASS |
| U0.banner-fields | Израиль · 1 Channel 9 (Израиль) | num «1» · title «Channel 9 (Израиль)» · now «01:25⁠–⁠02:15 Т/с "Свидетели", 82 с. "Долгая память".» · next «Далее 02:15 "День".» · clock «01:56» · shown true | PASS |
| U0.banner==row | Израиль · 1 Channel 9 (Израиль) | menu «Т/с "Свидетели", 82 с. "Долгая память".» · banner «01:25⁠–⁠02:15 Т/с "Свидетели", 82 с. "Долгая память".» · API on air «Т/с "Свидетели", 82 с. "Долгая память".» | PASS |
| U0.next | Израиль · 1 Channel 9 (Израиль) | guide next «"День".» · banner «Далее 02:15 "День".» | PASS |
| U0.first-frame | Израиль · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Израиль · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Израиль · 9 HOP! (Израиль) | num «9» · title «HOP! (Израиль)» · now «00:00⁠–⁠02:00 רדיו ללה» · next «» · clock «01:56» · shown true | PASS |
| U0.banner==row | Израиль · 9 HOP! (Израиль) | menu «רדיו ללה» · banner «00:00⁠–⁠02:00 רדיו ללה» · API on air «רדיו ללה» | PASS |
| U0.next | Израиль · 9 HOP! (Израиль) | guide next «רדיו ללה» · banner «» | DRY-SKIP |
| U0.first-frame | Израиль · 9 HOP! (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Израиль · 9 HOP! (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Израиль · 18 HOT HBO (Израиль) | num «18» · title «HOT HBO (Израиль)» · now «» · next «» · clock «01:56» · shown true | DRY-SKIP |
| U0.banner==row | Израиль · 18 HOT HBO (Израиль) | menu «» · banner «» · API on air «—» | PASS |
| U0.next | Израиль · 18 HOT HBO (Израиль) | guide next «מובלנד 2» · banner «» | DRY-SKIP |
| U0.first-frame | Израиль · 18 HOT HBO (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Израиль · 18 HOT HBO (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.rows | Украина | 90/90 rows seen · empty 0 · not on air 0 · no API programme 10 | PASS |
| U0.banner-fields | Украина · 19 Інтер | num «19» · title «Інтер» · now «01:00⁠–⁠02:00 "Єдині новини". Телемарафон.» · next «» · clock «01:56» · shown true | PASS |
| U0.banner==row | Украина · 19 Інтер | menu «"Єдині новини". Телемарафон.» · banner «01:00⁠–⁠02:00 "Єдині новини". Телемарафон.» · API on air «"Єдині новини". Телемарафон.» | PASS |
| U0.next | Украина · 19 Інтер | guide next «"Єдині новини". Телемарафон.» · banner «» | DRY-SKIP |
| U0.first-frame | Украина · 19 Інтер | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Украина · 19 Інтер | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Украина · 258 Sport 1 | num «258» · title «Sport 1» · now «01:00⁠–⁠05:00 Шорт-трек. Світовий тур. Етап 1 у Ванкувері, К» · next «» · clock «01:56» · shown true | PASS |
| U0.banner==row | Украина · 258 Sport 1 | menu «Шорт-трек. Світовий тур. Етап 1 у Ванкувері, Канада. День 2.» · banner «01:00⁠–⁠05:00 Шорт-трек. Світовий тур. Етап 1 у Ванкувері, К» · API on air «Шорт-трек. Світовий тур. Етап 1 у Ванкувері, Канада. День 2. Пряма трансляція.» | PASS |
| U0.next | Украина · 258 Sport 1 | guide next «Футбол. Чемпіонат Латвії. Вірсліга. РФС - Тукумс 2000.» · banner «» | DRY-SKIP |
| U0.first-frame | Украина · 258 Sport 1 | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Украина · 258 Sport 1 | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Украина · 366 Viva Latino | num «366» · title «Viva Latino» · now «21:00⁠–⁠05:00 Кліпи.» · next «» · clock «01:57» · shown true | PASS |
| U0.banner==row | Украина · 366 Viva Latino | menu «Кліпи.» · banner «21:00⁠–⁠05:00 Кліпи.» · API on air «Кліпи.» | PASS |
| U0.next | Украина · 366 Viva Latino | guide next «Кліпи.» · banner «» | DRY-SKIP |
| U0.first-frame | Украина · 366 Viva Latino | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Украина · 366 Viva Latino | no picture in dry mode | DRY-SKIP |
| U0.rows | Национальные | 62/62 rows seen · empty 0 · not on air 0 · no API programme 7 | PASS |
| U0.banner-fields | Национальные · 1 Channel 9 (Израиль) | num «1» · title «Channel 9 (Израиль)» · now «01:25⁠–⁠02:15 Т/с "Свидетели", 82 с. "Долгая память".» · next «Далее 02:15 "День".» · clock «01:57» · shown true | PASS |
| U0.banner==row | Национальные · 1 Channel 9 (Израиль) | menu «Т/с "Свидетели", 82 с. "Долгая память".» · banner «01:25⁠–⁠02:15 Т/с "Свидетели", 82 с. "Долгая память".» · API on air «Т/с "Свидетели", 82 с. "Долгая память".» | PASS |
| U0.next | Национальные · 1 Channel 9 (Израиль) | guide next «"День".» · banner «Далее 02:15 "День".» | PASS |
| U0.first-frame | Национальные · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Национальные · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Национальные · 31 Астана ТВ (Казахстан) | num «31» · title «Астана ТВ (Казахстан)» · now «20:10⁠–⁠02:30 Жажда мести» · next «» · clock «01:57» · shown true | PASS |
| U0.banner==row | Национальные · 31 Астана ТВ (Казахстан) | menu «Жажда мести» · banner «20:10⁠–⁠02:30 Жажда мести» · API on air «Жажда мести» | PASS |
| U0.next | Национальные · 31 Астана ТВ (Казахстан) | guide next «Кулфи» · banner «» | DRY-SKIP |
| U0.first-frame | Национальные · 31 Астана ТВ (Казахстан) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Национальные · 31 Астана ТВ (Казахстан) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Национальные · 62 Армія TV | num «62» · title «Армія TV» · now «01:44⁠–⁠01:59 Як готують бійців роти НРК до роботи на війні » · next «» · clock «01:57» · shown true | PASS |
| U0.banner==row | Национальные · 62 Армія TV | menu «Як готують бійців роти НРК до роботи на війні \|\| 413 полк СБ» · banner «01:44⁠–⁠01:59 Як готують бійців роти НРК до роботи на війні » · API on air «Як готують бійців роти НРК до роботи на війні \|\| 413 полк СБС "РЕЙД".» | PASS |
| U0.next | Национальные · 62 Армія TV | guide next «"Відтягуйтесь, я прикрию!": подвиг воїна "Золотаря", який з важким пораненням відбивався від рою FPV \|\| Ukrainian Witness.» · banner «» | DRY-SKIP |
| U0.first-frame | Национальные · 62 Армія TV | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Национальные · 62 Армія TV | no picture in dry mode | DRY-SKIP |
| U0.rows | Новостные | 11/11 rows seen · empty 0 · not on air 0 · no API programme 0 | PASS |
| U0.banner-fields | Новостные · 63 Deutsche Welle | num «63» · title «Deutsche Welle» · now «01:30⁠–⁠02:00 REV. Mad for Mercedes: South Africans" love fo» · next «» · clock «01:57» · shown true | PASS |
| U0.banner==row | Новостные · 63 Deutsche Welle | menu «REV. Mad for Mercedes: South Africans" love for old Benz mod» · banner «01:30⁠–⁠02:00 REV. Mad for Mercedes: South Africans" love fo» · API on air «REV. Mad for Mercedes: South Africans" love for old Benz models.» | PASS |
| U0.next | Новостные · 63 Deutsche Welle | guide next «DW News.» · banner «» | DRY-SKIP |
| U0.first-frame | Новостные · 63 Deutsche Welle | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Новостные · 63 Deutsche Welle | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Новостные · 68 FreeДОМ | num «68» · title «FreeДОМ» · now «01:30⁠–⁠04:00 Марафон "FreeДОМ" UA.» · next «» · clock «01:57» · shown true | PASS |
| U0.banner==row | Новостные · 68 FreeДОМ | menu «Марафон "FreeДОМ" UA.» · banner «01:30⁠–⁠04:00 Марафон "FreeДОМ" UA.» · API on air «Марафон "FreeДОМ" UA.» | PASS |
| U0.next | Новостные · 68 FreeДОМ | guide next «Д/ф "Сімейний альбом".» · banner «» | DRY-SKIP |
| U0.first-frame | Новостные · 68 FreeДОМ | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Новостные · 68 FreeДОМ | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Новостные · 73 Новини Live | num «73» · title «Новини Live» · now «01:00⁠–⁠02:00 Нет данных» · next «» · clock «01:57» · shown true | PASS |
| U0.banner==row | Новостные · 73 Новини Live | menu «Нет данных» · banner «01:00⁠–⁠02:00 Нет данных» · API on air «Нет данных» | PASS |
| U0.next | Новостные · 73 Новини Live | guide next «—» · banner «» | DRY-SKIP |
| U0.first-frame | Новостные · 73 Новини Live | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Новостные · 73 Новини Live | no picture in dry mode | DRY-SKIP |
| U0.rows | Познавательные | 64/64 rows seen · empty 0 · not on air 0 · no API programme 9 | PASS |
| U0.banner-fields | Познавательные · 74 National Geographic | num «74» · title «National Geographic» · now «01:45⁠–⁠02:30 д/с Расследования авиакатастроф (Хаос в кабине» · next «» · clock «01:57» · shown true | PASS |
| U0.banner==row | Познавательные · 74 National Geographic | menu «д/с Расследования авиакатастроф (Хаос в кабине)» · banner «01:45⁠–⁠02:30 д/с Расследования авиакатастроф (Хаос в кабине» · API on air «д/с Расследования авиакатастроф (Хаос в кабине)» | PASS |
| U0.next | Познавательные · 74 National Geographic | guide next «д/с Расследования авиакатастроф (Потеря контроля)» · banner «» | DRY-SKIP |
| U0.first-frame | Познавательные · 74 National Geographic | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Познавательные · 74 National Geographic | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Познавательные · 105 Discovery | num «105» · title «Discovery» · now «01:30⁠–⁠02:00 Пограничная служба: Испания 9. 2» · next «» · clock «01:58» · shown true | PASS |
| U0.banner==row | Познавательные · 105 Discovery | menu «Пограничная служба: Испания 9. 2» · banner «01:30⁠–⁠02:00 Пограничная служба: Испания 9. 2» · API on air «Пограничная служба: Испания 9. 2» | PASS |
| U0.next | Познавательные · 105 Discovery | guide next «Золотая лихорадка, 15 с-н 23 с. Последний танец» · banner «» | DRY-SKIP |
| U0.first-frame | Познавательные · 105 Discovery | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Познавательные · 105 Discovery | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Познавательные · 137 ЗооСвіт | num «137» · title «ЗооСвіт» · now «» · next «» · clock «01:58» · shown true | DRY-SKIP |
| U0.banner==row | Познавательные · 137 ЗооСвіт | menu «» · banner «» · API on air «—» | PASS |
| U0.next | Познавательные · 137 ЗооСвіт | guide next «—» · banner «» | DRY-SKIP |
| U0.first-frame | Познавательные · 137 ЗооСвіт | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Познавательные · 137 ЗооСвіт | no picture in dry mode | DRY-SKIP |
| U0.rows | Кино | 95/95 rows seen · empty 0 · not on air 0 · no API programme 10 | PASS |
| U0.banner-fields | Кино · 138 KinoKazka | num «138» · title «KinoKazka» · now «01:15⁠–⁠02:55 х/ф Стражи времени» · next «» · clock «01:58» · shown true | PASS |
| U0.banner==row | Кино · 138 KinoKazka | menu «х/ф Стражи времени» · banner «01:15⁠–⁠02:55 х/ф Стражи времени» · API on air «х/ф Стражи времени» | PASS |
| U0.next | Кино · 138 KinoKazka | guide next «м/ф Норм и Несокрушимые: Семейные каникулы» · banner «» | DRY-SKIP |
| U0.first-frame | Кино · 138 KinoKazka | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Кино · 138 KinoKazka | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Кино · 185 Cineman MiniSeries | num «185» · title «Cineman MiniSeries» · now «01:46⁠–⁠02:14 Нормальные люди 1 сезон 8 серия» · next «» · clock «01:58» · shown true | PASS |
| U0.banner==row | Кино · 185 Cineman MiniSeries | menu «Нормальные люди 1 сезон 8 серия» · banner «01:46⁠–⁠02:14 Нормальные люди 1 сезон 8 серия» · API on air «Нормальные люди 1 сезон 8 серия» | PASS |
| U0.next | Кино · 185 Cineman MiniSeries | guide next «Нормальные люди 1 сезон 9 серия» · banner «» | DRY-SKIP |
| U0.first-frame | Кино · 185 Cineman MiniSeries | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Кино · 185 Cineman MiniSeries | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Кино · 232 BCU | num «232» · title «BCU» · now «01:00⁠–⁠02:00 Нет данных» · next «» · clock «01:58» · shown true | PASS |
| U0.banner==row | Кино · 232 BCU | menu «Нет данных» · banner «01:00⁠–⁠02:00 Нет данных» · API on air «Нет данных» | PASS |
| U0.next | Кино · 232 BCU | guide next «—» · banner «» | DRY-SKIP |
| U0.first-frame | Кино · 232 BCU | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Кино · 232 BCU | no picture in dry mode | DRY-SKIP |
| U0.rows | Детские | 22/22 rows seen · empty 0 · not on air 0 · no API programme 4 | PASS |
| U0.banner-fields | Детские · 233 Nick Jr | num «233» · title «Nick Jr» · now «01:40⁠–⁠02:00 М/с "Крепыш и команда", 3 сезон, 10 с. "Команд» · next «» · clock «01:58» · shown true | PASS |
| U0.banner==row | Детские · 233 Nick Jr | menu «М/с "Крепыш и команда", 3 сезон, 10 с. "Команда строит небос» · banner «01:40⁠–⁠02:00 М/с "Крепыш и команда", 3 сезон, 10 с. "Команд» · API on air «М/с "Крепыш и команда", 3 сезон, 10 с. "Команда строит небоскрёб".» | PASS |
| U0.next | Детские · 233 Nick Jr | guide next «М/с "Щенячий патруль", 10 сезон, 19 с. "Щенки спасают слоновий курорт / Щенки спасают подводного Отиса".» · banner «» | DRY-SKIP |
| U0.first-frame | Детские · 233 Nick Jr | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Детские · 233 Nick Jr | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Детские · 243 В гостях у сказки | num «243» · title «В гостях у сказки» · now «01:50⁠–⁠02:00 М/с "Смешарики", 149 с. "Слишком фигурное ката» · next «» · clock «01:58» · shown true | PASS |
| U0.banner==row | Детские · 243 В гостях у сказки | menu «М/с "Смешарики", 149 с. "Слишком фигурное катание: часть 1".» · banner «01:50⁠–⁠02:00 М/с "Смешарики", 149 с. "Слишком фигурное ката» · API on air «М/с "Смешарики", 149 с. "Слишком фигурное катание: часть 1".» | PASS |
| U0.next | Детские · 243 В гостях у сказки | guide next «М/с "Смешарики", 152 с. "Слишком фигурное катание: часть 2".» · banner «» | DRY-SKIP |
| U0.first-frame | Детские · 243 В гостях у сказки | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Детские · 243 В гостях у сказки | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Детские · 254 Nickelodeon | num «254» · title «Nickelodeon» · now «» · next «» · clock «01:59» · shown true | FAIL |
| U0.banner==row | Детские · 254 Nickelodeon | menu «» · banner «» · API on air «Лучш и Лучшик» | FAIL |
| U0.next | Детские · 254 Nickelodeon | guide next «Шоу Патрика Стара» · banner «» | DRY-SKIP |
| U0.first-frame | Детские · 254 Nickelodeon | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Детские · 254 Nickelodeon | no picture in dry mode | DRY-SKIP |
| U0.rows | Спорт | 41/41 rows seen · empty 1 · not on air 0 · no API programme 0 · 289 Суспільне Спорт: empty, on air «Суспільне Спорт. Новини» | FAIL |
| U0.banner-fields | Спорт · 255 Setanta Sports UA | num «255» · title «Setanta Sports UA» · now «01:00⁠–⁠03:00 Футбол. Чемпионат Англии. Премьер-лига. Челси » · next «» · clock «01:59» · shown true | PASS |
| U0.banner==row | Спорт · 255 Setanta Sports UA | menu «Футбол. Чемпионат Англии. Премьер-лига. Челси - Тоттенхэм Хо» · banner «01:00⁠–⁠03:00 Футбол. Чемпионат Англии. Премьер-лига. Челси » · API on air «Футбол. Чемпионат Англии. Премьер-лига. Челси - Тоттенхэм Хотспур.» | PASS |
| U0.next | Спорт · 255 Setanta Sports UA | guide next «Футбол. Чемпионат Англии. Премьер-лига. Астон Вилла - Манчестер Сити.» · banner «» | DRY-SKIP |
| U0.first-frame | Спорт · 255 Setanta Sports UA | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Спорт · 255 Setanta Sports UA | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Спорт · 275 KHL ТВ | num «275» · title «KHL ТВ» · now «01:30⁠–⁠03:50 ФОНБЕТ Чемпионат КХЛ. "Спартак" - "Шанхайские » · next «» · clock «01:59» · shown true | PASS |
| U0.banner==row | Спорт · 275 KHL ТВ | menu «ФОНБЕТ Чемпионат КХЛ. "Спартак" - "Шанхайские Драконы" (Кита» · banner «01:30⁠–⁠03:50 ФОНБЕТ Чемпионат КХЛ. "Спартак" - "Шанхайские » · API on air «ФОНБЕТ Чемпионат КХЛ. "Спартак" - "Шанхайские Драконы" (Китай).» | PASS |
| U0.next | Спорт · 275 KHL ТВ | guide next «"Всё, кроме хоккея".» · banner «» | DRY-SKIP |
| U0.first-frame | Спорт · 275 KHL ТВ | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Спорт · 275 KHL ТВ | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Спорт · 295 ОККО Прайм Спорт | num «295» · title «ОККО Прайм Спорт» · now «22:55⁠–⁠02:40 Футбол. Чемпионат Франции» · next «» · clock «01:59» · shown true | PASS |
| U0.banner==row | Спорт · 295 ОККО Прайм Спорт | menu «Футбол. Чемпионат Франции» · banner «22:55⁠–⁠02:40 Футбол. Чемпионат Франции» · API on air «Футбол. Чемпионат Франции» | PASS |
| U0.next | Спорт · 295 ОККО Прайм Спорт | guide next «Тревел-шоу. Сезон 1. Серия 10. Чек-лист: Мюнхен. Октоберфест. Матч Германия – Сербия» · banner «» | DRY-SKIP |
| U0.first-frame | Спорт · 295 ОККО Прайм Спорт | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Спорт · 295 ОККО Прайм Спорт | no picture in dry mode | DRY-SKIP |
| U0.rows | Развлекательные | 52/52 rows seen · empty 7 · not on air 0 · no API programme 2 · 298 Новий канал: empty, on air «Stadium Night, 3 еп.» \| 306 ОЦЕ: empty, on air «Слідство ведуть екстрасенси, 5 сезон, 16 еп. Привид - вбивця дітей.» \| 311 Дім: empty, on air «Хащі.» \| 317 Вопросы и ответы: empty, on air «Что? Где? Когда?, сезон 2024 года, 4 эп.» | FAIL |
| U0.banner-fields | Развлекательные · 296 Fashion ONE | num «296» · title «Fashion ONE» · now «01:48⁠–⁠02:00 Модные Показы. IRINA VALERY. Осень-Зима22-23. » · next «» · clock «01:59» · shown true | PASS |
| U0.banner==row | Развлекательные · 296 Fashion ONE | menu «Модные Показы. IRINA VALERY. Осень-Зима22-23. Неделя моды в » · banner «01:48⁠–⁠02:00 Модные Показы. IRINA VALERY. Осень-Зима22-23. » · API on air «Модные Показы. IRINA VALERY. Осень-Зима22-23. Неделя моды в Санкт-Петербурге (12+)» | PASS |
| U0.next | Развлекательные · 296 Fashion ONE | guide next «Мода и искусство (12+)» · banner «» | DRY-SKIP |
| U0.first-frame | Развлекательные · 296 Fashion ONE | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Развлекательные · 296 Fashion ONE | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Развлекательные · 321 Панянка-селянка+ | num «321» · title «Панянка-селянка+» · now «01:00⁠–⁠02:00 Програма відсутня» · next «» · clock «01:59» · shown true | PASS |
| U0.banner==row | Развлекательные · 321 Панянка-селянка+ | menu «Програма відсутня» · banner «01:00⁠–⁠02:00 Програма відсутня» · API on air «Програма відсутня» | PASS |
| U0.next | Развлекательные · 321 Панянка-селянка+ | guide next «Програма відсутня» · banner «» | DRY-SKIP |
| U0.first-frame | Развлекательные · 321 Панянка-селянка+ | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Развлекательные · 321 Панянка-селянка+ | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Развлекательные · 347 Ми - Україна | num «347» · title «Ми - Україна» · now «01:00⁠–⁠02:00 "Єдині новини". Телемарафон.» · next «» · clock «01:59» · shown true | PASS |
| U0.banner==row | Развлекательные · 347 Ми - Україна | menu «"Єдині новини". Телемарафон.» · banner «01:00⁠–⁠02:00 "Єдині новини". Телемарафон.» · API on air «"Єдині новини". Телемарафон.» | PASS |
| U0.next | Развлекательные · 347 Ми - Україна | guide next «"Єдині новини". Телемарафон.» · banner «» | DRY-SKIP |
| U0.first-frame | Развлекательные · 347 Ми - Україна | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Развлекательные · 347 Ми - Україна | no picture in dry mode | DRY-SKIP |
| U0.rows | Музыкальные | 25/25 rows seen · empty 0 · not on air 0 · no API programme 0 | PASS |
| U0.banner-fields | Музыкальные · 348 Stingray iConcerts | num «348» · title «Stingray iConcerts» · now «01:00⁠–⁠03:11 Duane Allman: Song Of The South. 2013.» · next «» · clock «02:00» · shown true | PASS |
| U0.banner==row | Музыкальные · 348 Stingray iConcerts | menu «Duane Allman: Song Of The South. 2013.» · banner «01:00⁠–⁠03:11 Duane Allman: Song Of The South. 2013.» · API on air «Duane Allman: Song Of The South. 2013.» | PASS |
| U0.next | Музыкальные · 348 Stingray iConcerts | guide next «Charlie Puth: Live in London. 2015.» · banner «» | DRY-SKIP |
| U0.first-frame | Музыкальные · 348 Stingray iConcerts | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Музыкальные · 348 Stingray iConcerts | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Музыкальные · 360 4ever Music | num «360» · title «4ever Music» · now «21:00⁠–⁠05:00 Хіти минулих років.» · next «» · clock «02:00» · shown true | PASS |
| U0.banner==row | Музыкальные · 360 4ever Music | menu «Хіти минулих років.» · banner «21:00⁠–⁠05:00 Хіти минулих років.» · API on air «Хіти минулих років.» | PASS |
| U0.next | Музыкальные · 360 4ever Music | guide next «Хіти минулих років.» · banner «» | DRY-SKIP |
| U0.first-frame | Музыкальные · 360 4ever Music | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Музыкальные · 360 4ever Music | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Музыкальные · 372 Жара | num «372» · title «Жара» · now «00:30⁠–⁠03:40 Музыкальный блок» · next «» · clock «02:00» · shown true | PASS |
| U0.banner==row | Музыкальные · 372 Жара | menu «Музыкальный блок» · banner «00:30⁠–⁠03:40 Музыкальный блок» · API on air «Музыкальный блок» | PASS |
| U0.next | Музыкальные · 372 Жара | guide next «Мегамикс» · banner «» | DRY-SKIP |
| U0.first-frame | Музыкальные · 372 Жара | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Музыкальные · 372 Жара | no picture in dry mode | DRY-SKIP |
| M2.open-on-playing | 372 Жара | cursor on 372 Жара  ▶ · playing marker true | PASS |
| M4.cursor-on-air | 372 Жара | 00:30 «Музыкальный блок» в эфире · API «Музыкальный блок» | PASS |
| M4.day-back | 372 Жара | Жара — Вчера | PASS |
| M4.past-plays | 372 Жара | «Жара 13» → mode archive · banner «Жара · Архив · 00:00» · dry | PASS |
| M4.after-midnight (P8) | 22 1+1 Україна | on air «"Світ навиворіт".» (started before 00:00) · panel «1+1 Україна — Сегодня» cursor 23:40 «"Світ навиворіт".» в эфире | PASS |
| M4.after-midnight (P8) | 31 Астана ТВ (Казахстан) | on air «Жажда мести» (started before 00:00) · panel «Астана ТВ (Казахстан) — Сегодня» cursor 20:10 «Жажда мести» в эфире | PASS |
| M4.after-midnight (P8) | 52 Armenia Premium 1 | on air «Հ/Ս "Գոյամարտ ս189-ս192"» (started before 00:00) · panel «Armenia Premium 1 — Сегодня» cursor 22:20 «Հ/Ս "Գոյամարտ ս189-ս192"» в эфире | PASS |
| M5.scrub-back | 52 Armenia Premium 1 | knob 01:57:49 · position 01:57:49 · dry | PASS |
| M5.7-day-edge (D1) | 52 Armenia Premium 1 | knob 03:12:49 · mode archive · no picture in dry mode | DRY-SKIP |
| M5.to-live | 52 Armenia Premium 1 | knob прямой эфир · mode live | PASS |
| M7.single | 53 Капучино ТВ | no picture in dry mode | DRY-SKIP |
| M7.single | 54 ATR | no picture in dry mode | DRY-SKIP |
| M7.single | 55 Перший Західний | no picture in dry mode | DRY-SKIP |
| M7.burst | from 55 Перший Західний | landed 65 Рада (expected 65 Рада) · 2 app requests | PASS |
| M8.paused | 65 Рада | mode paused · 0 requests in 10 s | PASS |
| M8.resume-in-place | 65 Рада | paused at 02:05:06 · resumed at 02:05:06 (archive) | DRY-SKIP |
| M9.live | 65 Рада · simulated hide | live → live · position 02:05:20 → 02:05:24 · dry | PASS |
| M9.archive | 65 Рада · simulated hide | archive → archive · position 02:02:24 → 02:02:24 · dry | PASS |
| M6.continuation (D2) | — | no picture in dry mode | DRY-SKIP |
| C2.archive-1d | 197 Viju+ Megahit | «La migliore offerta» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-3d | 197 Viju+ Megahit | «8 femmes» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-1d | 215 Кинокомедия | «х/ф Нереальная любовь» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-3d | 215 Кинокомедия | «х/ф Телохранитель на фрилансе» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-1d | 194 sci-fi | «Х/ф "Малышка на драйве".» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-3d | 194 sci-fi | «Х/ф "Взрывная блондинка".» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-1d | 228 Kinoliving | «х/ф Свистуны» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-3d | 228 Kinoliving | «т/с Пайрэт Бэй ┊ 5» · mode archive · no picture in dry mode | DRY-SKIP |
| M10.soak | — | no picture in dry mode | DRY-SKIP |
| M11.menu-open | 30 min | 332 row checks · 64 not on air · +1 min 225 Еврокино: «» ≠ «Нет данных» \| +1 min 226 Fan: «» ≠ «х/ф Иные» \| +1 min 230 Наше любимое кино: «» ≠ «х/ф У білому полоні» \| +1 min 231 Cineman Ментовские войны: «» ≠ «Ментовские войны 7 сезон 7 серия» \| +1 min 232 BCU: «» ≠ «Нет данных» | FAIL |
| M11·U0.rows | Все каналы | 151/372 rows seen · empty 30 · not on air 0 · no API programme 0 · 222 Хит: empty, on air «х/ф Мисс Плохое поведение» \| 224 Мосфильм. Золотая коллекция: empty, on air «Х/ф "Беспредел".» \| 227 Премиальное: empty, on air «Красавица и чудовище (12+)» \| 234 JimJam: empty, on air «М/с "Ангелина Балерина", 3 сезон, 10 с.» | FAIL |
| app-errors | — | failure log lines: 40 | INFO |

### 2026-10-26 02:10–02:35 — the intermittent "3 layouts per ▼" (desktop investigation)

- 40 instrumented runs (20 on the 01:04 snapshot, 20 on the 01:5x snapshot), each 25 ▼ presses through a menu with long wrapped names and a tall row. Logged per press: Chrome `LayoutCount`, every DOM mutation outside the menu columns, image load/error events, font loading.
- Result: **0 of 40 runs** had a press with more than 2 layouts. Earlier, without instrumentation, 1 of 20 runs had three such presses (`2,2,0,3,…,3,…,3`), with no channel-list answer during them.
- Font loading, logo decode, spinner and banner mutations never landed inside a press window in these runs. Not reproduced, so no cause is proven.
- The earlier sample has a 0 just before the first 3. That suggests one press's layout was sometimes counted in the next press's window (a frame-timing artefact), but this is not proven.

### 2026-10-26 05:42–07:10 — DRY runs against the perf-fixes worktree with a FRESH «on air» reference

**Runner change:** every «on air» reference is now the provider's fresh answer, `/api/channel_now?t=<seconds>`; the plain URL is served from a cache that is often minutes old.
- Each U0 page is compared with a reference fetched right after the page was read, at most 10 s later (measured: ≤ 5.9 s).
- A failed, empty or late reference is not judged and is counted.
- Each result row records the reference's delay and its number of ended shows.
- Run B adds a tie-breaker: when a row and the list API disagree, the channel's own guide decides what is on air at the read time.

The worktree was being edited during these runs (commit `37e1b5d` plus about 19 changed files).

**Result:** rows still differ from the fresh reference, and in every Run B case the channel's guide agreed with the reference, not with the row.
- **Run B U0, 9 rows:** Все каналы 2 (1 Channel 9 — the playing channel, row from the guide; 13 Knesset); Украина 3 (58 МТМ, 250 Niki junior, 309 36.6); Кино 1 (231 «… 12 серия» while 13 is on air); Развлекательные 3 (313 ПлюсПлюс, 334 2х2 «118 с.» while 119 is on air, 338 Міледі ТВ). Banner 68 FreeДОМ showed «Спеціальний репортаж» while the reference had «Історичні факти».
- **M11 with the menu open 30 min (Run B):** 42 of 390 per-minute checks differed. 369 Bridge and 371 Bridge хит showed «Нет данных» for 12+ minutes while the fresh answer had «Wake Up Call»; their guide is empty. After the 30 min, U0 on Все каналы had 4 rows differing.
- **Run A (before the guide tie-breaker):** Все каналы 1 (236 Fresh Kids). In M11, one minute's reference timed out at 20 s; such minutes are now counted as not judged. After the 30 min, U0 had 19 rows differing while the reference itself still listed up to 48 ended shows, so it was not trustworthy.

#### Run A — 2026-10-26 05:42 (local) — DRY (desktop, headless Chrome, no picture) · tree /Users/yaroslavr/Developer/Projects/AI/kinozal-anastasia-perf · cases U0,M2,M4,M5,M7,M8,M9,M6,C2,M10,M11

PASS 93 · FAIL 2 · DRY-SKIP 111 · NOT-RUN 0

| Case | Channel / group | Measured | Result |
|---|---|---|---|
| U0.rows | Все каналы | 372/372 rows seen · empty 0 · not on air 1 · no API programme 0 · reference: 30 fresh fetches, ≤ 4067 ms after each page read, ended shows in it ≤ 1 · 236 Fresh Kids: «Моана» ≠ on air «Монстры на каникулах» | FAIL |
| U0.banner-fields | Все каналы · 1 Channel 9 (Израиль) | num «1» · title «Channel 9 (Израиль)» · now «05:00⁠–⁠05:45 Т/с "Обручальное кольцо", 697 с.» · next «Далее 05:45 Т/с "Обручальное кольцо", 698 с.» · clock «05:43» · shown true | PASS |
| U0.banner==row | Все каналы · 1 Channel 9 (Израиль) | menu «Т/с "Обручальное кольцо", 697 с.» · banner «05:00⁠–⁠05:45 Т/с "Обручальное кольцо", 697 с.» · API on air «Т/с "Обручальное кольцо", 697 с.» (fresh, 2459 ms after the banner, 0 ended in it) | PASS |
| U0.next | Все каналы · 1 Channel 9 (Израиль) | guide next «Т/с "Обручальное кольцо", 698 с.» · banner «Далее 05:45 Т/с "Обручальное кольцо", 698 с.» | PASS |
| U0.first-frame | Все каналы · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Все каналы · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Все каналы · 186 Кинохит | num «186» · title «Кинохит» · now «05:25⁠–⁠07:35 Х/ф "Вальмон".» · next «» · clock «05:43» · shown true | PASS |
| U0.banner==row | Все каналы · 186 Кинохит | menu «Х/ф "Вальмон".» · banner «05:25⁠–⁠07:35 Х/ф "Вальмон".» · API on air «Х/ф "Вальмон".» (fresh, 2489 ms after the banner, 0 ended in it) | PASS |
| U0.next | Все каналы · 186 Кинохит | guide next «Х/ф "Новая Земля".» · banner «» | DRY-SKIP |
| U0.first-frame | Все каналы · 186 Кинохит | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Все каналы · 186 Кинохит | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Все каналы · 372 Жара | num «372» · title «Жара» · now «03:40⁠–⁠06:00 Мегамикс» · next «» · clock «05:44» · shown true | PASS |
| U0.banner==row | Все каналы · 372 Жара | menu «Мегамикс» · banner «03:40⁠–⁠06:00 Мегамикс» · API on air «Мегамикс» (fresh, 2837 ms after the banner, 0 ended in it) | PASS |
| U0.next | Все каналы · 372 Жара | guide next «Музыкальный блок» · banner «» | DRY-SKIP |
| U0.first-frame | Все каналы · 372 Жара | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Все каналы · 372 Жара | no picture in dry mode | DRY-SKIP |
| U0.rows | Израиль | 18/18 rows seen · empty 0 · not on air 0 · no API programme 0 · reference: 2 fresh fetches, ≤ 2970 ms after each page read, ended shows in it ≤ 0 | PASS |
| U0.banner-fields | Израиль · 1 Channel 9 (Израиль) | num «1» · title «Channel 9 (Израиль)» · now «05:00⁠–⁠05:45 Т/с "Обручальное кольцо", 697 с.» · next «Далее 05:45 Т/с "Обручальное кольцо", 698 с.» · clock «05:44» · shown true | PASS |
| U0.banner==row | Израиль · 1 Channel 9 (Израиль) | menu «Т/с "Обручальное кольцо", 697 с.» · banner «05:00⁠–⁠05:45 Т/с "Обручальное кольцо", 697 с.» · API on air «Т/с "Обручальное кольцо", 697 с.» (fresh, 2295 ms after the banner, 0 ended in it) | PASS |
| U0.next | Израиль · 1 Channel 9 (Израиль) | guide next «Т/с "Обручальное кольцо", 698 с.» · banner «Далее 05:45 Т/с "Обручальное кольцо", 698 с.» | PASS |
| U0.first-frame | Израиль · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Израиль · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Израиль · 9 HOP! (Израиль) | num «9» · title «HOP! (Израиль)» · now «05:00⁠–⁠07:30 בוקר חיוכים» · next «» · clock «05:44» · shown true | PASS |
| U0.banner==row | Израиль · 9 HOP! (Израиль) | menu «בוקר חיוכים» · banner «05:00⁠–⁠07:30 בוקר חיוכים» · API on air «בוקר חיוכים» (fresh, 2616 ms after the banner, 0 ended in it) | PASS |
| U0.next | Израиль · 9 HOP! (Израиль) | guide next «קוקוריקו» · banner «» | DRY-SKIP |
| U0.first-frame | Израиль · 9 HOP! (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Израиль · 9 HOP! (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Израиль · 18 HOT HBO (Израиль) | num «18» · title «HOT HBO (Израиль)» · now «04:40⁠–⁠08:40 נשוב לשדר ב-09:40» · next «» · clock «05:44» · shown true | PASS |
| U0.banner==row | Израиль · 18 HOT HBO (Израиль) | menu «נשוב לשדר ב-09:40» · banner «04:40⁠–⁠08:40 נשוב לשדר ב-09:40» · API on air «נשוב לשדר ב-09:40» (fresh, 2290 ms after the banner, 0 ended in it) | PASS |
| U0.next | Израиль · 18 HOT HBO (Израиль) | guide next «1923» · banner «» | DRY-SKIP |
| U0.first-frame | Израиль · 18 HOT HBO (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Израиль · 18 HOT HBO (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.rows | Украина | 86/86 rows seen · empty 0 · not on air 0 · no API programme 0 · reference: 7 fresh fetches, ≤ 4109 ms after each page read, ended shows in it ≤ 0 | PASS |
| U0.banner-fields | Украина · 19 Інтер | num «19» · title «Інтер» · now «05:00⁠–⁠06:00 "Єдині новини". Телемарафон.» · next «» · clock «05:45» · shown true | PASS |
| U0.banner==row | Украина · 19 Інтер | menu «"Єдині новини". Телемарафон.» · banner «05:00⁠–⁠06:00 "Єдині новини". Телемарафон.» · API on air «"Єдині новини". Телемарафон.» (fresh, 2834 ms after the banner, 0 ended in it) | PASS |
| U0.next | Украина · 19 Інтер | guide next «"Єдині новини". Телемарафон.» · banner «» | DRY-SKIP |
| U0.first-frame | Украина · 19 Інтер | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Украина · 19 Інтер | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Украина · 258 Sport 1 | num «258» · title «Sport 1» · now «05:00⁠–⁠07:00 Футбол. Чемпіонат Латвії. Вірсліга. РФС - Туку» · next «» · clock «05:45» · shown true | PASS |
| U0.banner==row | Украина · 258 Sport 1 | menu «Футбол. Чемпіонат Латвії. Вірсліга. РФС - Тукумс 2000.» · banner «05:00⁠–⁠07:00 Футбол. Чемпіонат Латвії. Вірсліга. РФС - Туку» · API on air «Футбол. Чемпіонат Латвії. Вірсліга. РФС - Тукумс 2000.» (fresh, 2438 ms after the banner, 0 ended in it) | PASS |
| U0.next | Украина · 258 Sport 1 | guide next «Футбол. Чемпіонат Польщі. Екстракласа. Відзев - Гурник.» · banner «» | DRY-SKIP |
| U0.first-frame | Украина · 258 Sport 1 | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Украина · 258 Sport 1 | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Украина · 366 Viva Latino | num «366» · title «Viva Latino» · now «05:00⁠–⁠13:00 Кліпи.» · next «» · clock «05:45» · shown true | PASS |
| U0.banner==row | Украина · 366 Viva Latino | menu «Кліпи.» · banner «05:00⁠–⁠13:00 Кліпи.» · API on air «Кліпи.» (fresh, 2513 ms after the banner, 0 ended in it) | PASS |
| U0.next | Украина · 366 Viva Latino | guide next «Кліпи.» · banner «» | DRY-SKIP |
| U0.first-frame | Украина · 366 Viva Latino | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Украина · 366 Viva Latino | no picture in dry mode | DRY-SKIP |
| U0.rows | Национальные | 62/62 rows seen · empty 0 · not on air 0 · no API programme 0 · reference: 5 fresh fetches, ≤ 3410 ms after each page read, ended shows in it ≤ 0 | PASS |
| U0.banner-fields | Национальные · 1 Channel 9 (Израиль) | num «1» · title «Channel 9 (Израиль)» · now «05:45⁠–⁠06:30 Т/с "Обручальное кольцо", 698 с.» · next «Далее 06:30 Т/с "Свидетели", 82 с. "Долгая память"» · clock «05:45» · shown true | PASS |
| U0.banner==row | Национальные · 1 Channel 9 (Израиль) | menu «Т/с "Обручальное кольцо", 698 с.» · banner «05:45⁠–⁠06:30 Т/с "Обручальное кольцо", 698 с.» · API on air «Т/с "Обручальное кольцо", 698 с.» (fresh, 3673 ms after the banner, 0 ended in it) | PASS |
| U0.next | Национальные · 1 Channel 9 (Израиль) | guide next «Т/с "Свидетели", 82 с. "Долгая память".» · banner «Далее 06:30 Т/с "Свидетели", 82 с. "Долгая память".» | PASS |
| U0.first-frame | Национальные · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Национальные · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Национальные · 31 Астана ТВ (Казахстан) | num «31» · title «Астана ТВ (Казахстан)» · now «05:00⁠–⁠06:25 Основание Орхан» · next «» · clock «05:46» · shown true | PASS |
| U0.banner==row | Национальные · 31 Астана ТВ (Казахстан) | menu «Основание Орхан» · banner «05:00⁠–⁠06:25 Основание Орхан» · API on air «Основание Орхан» (fresh, 4442 ms after the banner, 0 ended in it) | PASS |
| U0.next | Национальные · 31 Астана ТВ (Казахстан) | guide next «Үздік әзілдер» · banner «» | DRY-SKIP |
| U0.first-frame | Национальные · 31 Астана ТВ (Казахстан) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Национальные · 31 Астана ТВ (Казахстан) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Национальные · 62 Армія TV | num «62» · title «Армія TV» · now «05:00⁠–⁠06:00 Нет данных» · next «» · clock «05:46» · shown true | PASS |
| U0.banner==row | Национальные · 62 Армія TV | menu «Нет данных» · banner «05:00⁠–⁠06:00 Нет данных» · API on air «Нет данных» (fresh, 3516 ms after the banner, 0 ended in it) | PASS |
| U0.next | Национальные · 62 Армія TV | guide next «—» · banner «» | DRY-SKIP |
| U0.first-frame | Национальные · 62 Армія TV | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Национальные · 62 Армія TV | no picture in dry mode | DRY-SKIP |
| U0.rows | Новостные | 11/11 rows seen · empty 0 · not on air 0 · no API programme 0 · reference: 1 fresh fetches, ≤ 2909 ms after each page read, ended shows in it ≤ 0 | PASS |
| U0.banner-fields | Новостные · 63 Deutsche Welle | num «63» · title «Deutsche Welle» · now «05:30⁠–⁠06:00 Euromaxx. Culture. Ideas. Europe.» · next «» · clock «05:46» · shown true | PASS |
| U0.banner==row | Новостные · 63 Deutsche Welle | menu «Euromaxx. Culture. Ideas. Europe.» · banner «05:30⁠–⁠06:00 Euromaxx. Culture. Ideas. Europe.» · API on air «Euromaxx. Culture. Ideas. Europe.» (fresh, 3507 ms after the banner, 0 ended in it) | PASS |
| U0.next | Новостные · 63 Deutsche Welle | guide next «DW News.» · banner «» | DRY-SKIP |
| U0.first-frame | Новостные · 63 Deutsche Welle | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Новостные · 63 Deutsche Welle | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Новостные · 68 FreeДОМ | num «68» · title «FreeДОМ» · now «05:30⁠–⁠06:00 Інформаційні сюжети.» · next «» · clock «05:46» · shown true | PASS |
| U0.banner==row | Новостные · 68 FreeДОМ | menu «Інформаційні сюжети.» · banner «05:30⁠–⁠06:00 Інформаційні сюжети.» · API on air «Інформаційні сюжети.» (fresh, 3136 ms after the banner, 0 ended in it) | PASS |
| U0.next | Новостные · 68 FreeДОМ | guide next «Наш час.» · banner «» | DRY-SKIP |
| U0.first-frame | Новостные · 68 FreeДОМ | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Новостные · 68 FreeДОМ | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Новостные · 73 Новини Live | num «73» · title «Новини Live» · now «05:00⁠–⁠06:00 Нет данных» · next «» · clock «05:46» · shown true | PASS |
| U0.banner==row | Новостные · 73 Новини Live | menu «Нет данных» · banner «05:00⁠–⁠06:00 Нет данных» · API on air «Нет данных» (fresh, 2679 ms after the banner, 0 ended in it) | PASS |
| U0.next | Новостные · 73 Новини Live | guide next «—» · banner «» | DRY-SKIP |
| U0.first-frame | Новостные · 73 Новини Live | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Новостные · 73 Новини Live | no picture in dry mode | DRY-SKIP |
| U0.rows | Познавательные | 64/64 rows seen · empty 0 · not on air 0 · no API programme 0 · reference: 6 fresh fetches, ≤ 3436 ms after each page read, ended shows in it ≤ 3 | PASS |
| U0.banner-fields | Познавательные · 74 National Geographic | num «74» · title «National Geographic» · now «05:45⁠–⁠06:05 Научные глупости ┊ 10» · next «» · clock «05:47» · shown true | PASS |
| U0.banner==row | Познавательные · 74 National Geographic | menu «Научные глупости ┊ 10» · banner «05:45⁠–⁠06:05 Научные глупости ┊ 10» · API on air «Научные глупости ┊ 10» (fresh, 3015 ms after the banner, 1 ended in it) | PASS |
| U0.next | Познавательные · 74 National Geographic | guide next «д/с Настоящий суперкар (Саб-Зиро Порше)» · banner «» | DRY-SKIP |
| U0.first-frame | Познавательные · 74 National Geographic | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Познавательные · 74 National Geographic | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Познавательные · 105 Discovery | num «105» · title «Discovery» · now «05:00⁠–⁠06:00 Грязные богатства, 2 с-н 8 с. Мегазубы для мег» · next «» · clock «05:47» · shown true | PASS |
| U0.banner==row | Познавательные · 105 Discovery | menu «Грязные богатства, 2 с-н 8 с. Мегазубы для мегабаксов» · banner «05:00⁠–⁠06:00 Грязные богатства, 2 с-н 8 с. Мегазубы для мег» · API on air «Грязные богатства, 2 с-н 8 с. Мегазубы для мегабаксов» (fresh, 3849 ms after the banner, 0 ended in it) | PASS |
| U0.next | Познавательные · 105 Discovery | guide next «Грязные богатства, 2 с-н 9 с. Заплесневелые сокровища» · banner «» | DRY-SKIP |
| U0.first-frame | Познавательные · 105 Discovery | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Познавательные · 105 Discovery | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Познавательные · 137 ЗооСвіт | num «137» · title «ЗооСвіт» · now «05:00⁠–⁠06:00 Нет данных» · next «» · clock «05:47» · shown true | PASS |
| U0.banner==row | Познавательные · 137 ЗооСвіт | menu «Нет данных» · banner «05:00⁠–⁠06:00 Нет данных» · API on air «Нет данных» (fresh, 2484 ms after the banner, 0 ended in it) | PASS |
| U0.next | Познавательные · 137 ЗооСвіт | guide next «—» · banner «» | DRY-SKIP |
| U0.first-frame | Познавательные · 137 ЗооСвіт | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Познавательные · 137 ЗооСвіт | no picture in dry mode | DRY-SKIP |
| U0.rows | Кино | 95/95 rows seen · empty 0 · not on air 0 · no API programme 0 · reference: 8 fresh fetches, ≤ 3584 ms after each page read, ended shows in it ≤ 0 | PASS |
| U0.banner-fields | Кино · 138 KinoKazka | num «138» · title «KinoKazka» · now «04:20⁠–⁠06:15 х/ф Волшебный нос» · next «» · clock «05:48» · shown true | PASS |
| U0.banner==row | Кино · 138 KinoKazka | menu «х/ф Волшебный нос» · banner «04:20⁠–⁠06:15 х/ф Волшебный нос» · API on air «х/ф Волшебный нос» (fresh, 2766 ms after the banner, 0 ended in it) | PASS |
| U0.next | Кино · 138 KinoKazka | guide next «м/ф Стрекоза и муравей» · banner «» | DRY-SKIP |
| U0.first-frame | Кино · 138 KinoKazka | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Кино · 138 KinoKazka | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Кино · 185 Cineman MiniSeries | num «185» · title «Cineman MiniSeries» · now «05:43⁠–⁠06:40 Молодой Папа 1 сезон 3 серия» · next «» · clock «05:48» · shown true | PASS |
| U0.banner==row | Кино · 185 Cineman MiniSeries | menu «Молодой Папа 1 сезон 3 серия» · banner «05:43⁠–⁠06:40 Молодой Папа 1 сезон 3 серия» · API on air «Молодой Папа 1 сезон 3 серия» (fresh, 2685 ms after the banner, 0 ended in it) | PASS |
| U0.next | Кино · 185 Cineman MiniSeries | guide next «Молодой Папа 1 сезон 4 серия» · banner «» | DRY-SKIP |
| U0.first-frame | Кино · 185 Cineman MiniSeries | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Кино · 185 Cineman MiniSeries | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Кино · 232 BCU | num «232» · title «BCU» · now «05:00⁠–⁠06:00 Нет данных» · next «» · clock «05:48» · shown true | PASS |
| U0.banner==row | Кино · 232 BCU | menu «Нет данных» · banner «05:00⁠–⁠06:00 Нет данных» · API on air «Нет данных» (fresh, 2501 ms after the banner, 0 ended in it) | PASS |
| U0.next | Кино · 232 BCU | guide next «—» · banner «» | DRY-SKIP |
| U0.first-frame | Кино · 232 BCU | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Кино · 232 BCU | no picture in dry mode | DRY-SKIP |
| U0.rows | Детские | 22/22 rows seen · empty 0 · not on air 0 · no API programme 0 · reference: 2 fresh fetches, ≤ 3321 ms after each page read, ended shows in it ≤ 0 | PASS |
| U0.banner-fields | Детские · 233 Nick Jr | num «233» · title «Nick Jr» · now «05:25⁠–⁠05:50 М/с "Мистер Крокодил", 1 сезон, 1 с. "Кому пов» · next «» · clock «05:48» · shown true | PASS |
| U0.banner==row | Детские · 233 Nick Jr | menu «М/с "Мистер Крокодил", 1 сезон, 1 с. "Кому повезёт, у того и» · banner «05:25⁠–⁠05:50 М/с "Мистер Крокодил", 1 сезон, 1 с. "Кому пов» · API on air «М/с "Мистер Крокодил", 1 сезон, 1 с. "Кому повезёт, у того и крокодил запоёт / Крокодилья ночевка".» (fresh, 2640 ms after the banner, 0 ended in it) | PASS |
| U0.next | Детские · 233 Nick Jr | guide next «М/с "Барбапапа и семья!", 2 сезон, 3 с. "Летний лагерь".» · banner «» | DRY-SKIP |
| U0.first-frame | Детские · 233 Nick Jr | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Детские · 233 Nick Jr | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Детские · 243 В гостях у сказки | num «243» · title «В гостях у сказки» · now «05:45⁠–⁠06:00 М/с "Смешарики. ПинКод", 3 сезон, 6 с. "Плохой» · next «» · clock «05:48» · shown true | PASS |
| U0.banner==row | Детские · 243 В гостях у сказки | menu «М/с "Смешарики. ПинКод", 3 сезон, 6 с. "Плохой хороший Крош"» · banner «05:45⁠–⁠06:00 М/с "Смешарики. ПинКод", 3 сезон, 6 с. "Плохой» · API on air «М/с "Смешарики. ПинКод", 3 сезон, 6 с. "Плохой хороший Крош".» (fresh, 2496 ms after the banner, 4 ended in it) | PASS |
| U0.next | Детские · 243 В гостях у сказки | guide next «М/с "Смешарики. ПинКод", 3 сезон, 7 с. "Баю бай".» · banner «» | DRY-SKIP |
| U0.first-frame | Детские · 243 В гостях у сказки | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Детские · 243 В гостях у сказки | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Детские · 254 Nickelodeon | num «254» · title «Nickelodeon» · now «05:23⁠–⁠05:49 Мой шумный дом» · next «» · clock «05:49» · shown true | PASS |
| U0.banner==row | Детские · 254 Nickelodeon | menu «Мой шумный дом» · banner «05:23⁠–⁠05:49 Мой шумный дом» · API on air «Мой шумный дом» (fresh, 2584 ms after the banner, 0 ended in it) | PASS |
| U0.next | Детские · 254 Nickelodeon | guide next «Губка Боб Квадратные Штаны» · banner «» | DRY-SKIP |
| U0.first-frame | Детские · 254 Nickelodeon | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Детские · 254 Nickelodeon | no picture in dry mode | DRY-SKIP |
| U0.rows | Спорт | 41/41 rows seen · empty 0 · not on air 0 · no API programme 0 · reference: 4 fresh fetches, ≤ 2503 ms after each page read, ended shows in it ≤ 0 | PASS |
| U0.banner-fields | Спорт · 255 Setanta Sports UA | num «255» · title «Setanta Sports UA» · now «05:00⁠–⁠07:00 Футбол. Чемпионат Англии. Чемпионшип. Чарльтон» · next «» · clock «05:49» · shown true | PASS |
| U0.banner==row | Спорт · 255 Setanta Sports UA | menu «Футбол. Чемпионат Англии. Чемпионшип. Чарльтон Атлетик - Нор» · banner «05:00⁠–⁠07:00 Футбол. Чемпионат Англии. Чемпионшип. Чарльтон» · API on air «Футбол. Чемпионат Англии. Чемпионшип. Чарльтон Атлетик - Норвич Сити.» (fresh, 2624 ms after the banner, 0 ended in it) | PASS |
| U0.next | Спорт · 255 Setanta Sports UA | guide next «Футбол. Чемпионат Германии. РБ Лейпциг - Эльферсберг.» · banner «» | DRY-SKIP |
| U0.first-frame | Спорт · 255 Setanta Sports UA | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Спорт · 255 Setanta Sports UA | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Спорт · 275 KHL ТВ | num «275» · title «KHL ТВ» · now «05:00⁠–⁠07:20 ФОНБЕТ Чемпионат КХЛ. "Салават Юлаев" - "Ак Ба» · next «» · clock «05:49» · shown true | PASS |
| U0.banner==row | Спорт · 275 KHL ТВ | menu «ФОНБЕТ Чемпионат КХЛ. "Салават Юлаев" - "Ак Барс".» · banner «05:00⁠–⁠07:20 ФОНБЕТ Чемпионат КХЛ. "Салават Юлаев" - "Ак Ба» · API on air «ФОНБЕТ Чемпионат КХЛ. "Салават Юлаев" - "Ак Барс".» (fresh, 3632 ms after the banner, 0 ended in it) | PASS |
| U0.next | Спорт · 275 KHL ТВ | guide next «"Видео дня".» · banner «» | DRY-SKIP |
| U0.first-frame | Спорт · 275 KHL ТВ | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Спорт · 275 KHL ТВ | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Спорт · 295 ОККО Прайм Спорт | num «295» · title «ОККО Прайм Спорт» · now «04:20⁠–⁠08:00 Футбол. Франция. 1–4 c» · next «» · clock «05:49» · shown true | PASS |
| U0.banner==row | Спорт · 295 ОККО Прайм Спорт | menu «Футбол. Франция. 1–4 c» · banner «04:20⁠–⁠08:00 Футбол. Франция. 1–4 c» · API on air «Футбол. Франция. 1–4 c» (fresh, 3717 ms after the banner, 0 ended in it) | PASS |
| U0.next | Спорт · 295 ОККО Прайм Спорт | guide next «Новости спорта» · banner «» | DRY-SKIP |
| U0.first-frame | Спорт · 295 ОККО Прайм Спорт | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Спорт · 295 ОККО Прайм Спорт | no picture in dry mode | DRY-SKIP |
| U0.rows | Развлекательные | 52/52 rows seen · empty 0 · not on air 0 · no API programme 0 · reference: 5 fresh fetches, ≤ 4469 ms after each page read, ended shows in it ≤ 1 | PASS |
| U0.banner-fields | Развлекательные · 296 Fashion ONE | num «296» · title «Fashion ONE» · now «05:40⁠–⁠05:54 Неделя моды в Париже. Zuhair Murad Couture. Ос» · next «» · clock «05:50» · shown true | PASS |
| U0.banner==row | Развлекательные · 296 Fashion ONE | menu «Неделя моды в Париже. Zuhair Murad Couture. Осень-Зима 22-23» · banner «05:40⁠–⁠05:54 Неделя моды в Париже. Zuhair Murad Couture. Ос» · API on air «Неделя моды в Париже. Zuhair Murad Couture. Осень-Зима 22-23 (12+)» (fresh, 2797 ms after the banner, 0 ended in it) | PASS |
| U0.next | Развлекательные · 296 Fashion ONE | guide next «Модные Показы (12+)» · banner «» | DRY-SKIP |
| U0.first-frame | Развлекательные · 296 Fashion ONE | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Развлекательные · 296 Fashion ONE | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Развлекательные · 321 Панянка-селянка+ | num «321» · title «Панянка-селянка+» · now «05:00⁠–⁠06:00 Програма відсутня» · next «» · clock «05:50» · shown true | PASS |
| U0.banner==row | Развлекательные · 321 Панянка-селянка+ | menu «Програма відсутня» · banner «05:00⁠–⁠06:00 Програма відсутня» · API on air «Програма відсутня» (fresh, 3656 ms after the banner, 0 ended in it) | PASS |
| U0.next | Развлекательные · 321 Панянка-селянка+ | guide next «Програма відсутня» · banner «» | DRY-SKIP |
| U0.first-frame | Развлекательные · 321 Панянка-селянка+ | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Развлекательные · 321 Панянка-селянка+ | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Развлекательные · 347 Ми - Україна | num «347» · title «Ми - Україна» · now «05:00⁠–⁠06:00 "Єдині новини". Телемарафон.» · next «» · clock «05:50» · shown true | PASS |
| U0.banner==row | Развлекательные · 347 Ми - Україна | menu «"Єдині новини". Телемарафон.» · banner «05:00⁠–⁠06:00 "Єдині новини". Телемарафон.» · API on air «"Єдині новини". Телемарафон.» (fresh, 3030 ms after the banner, 0 ended in it) | PASS |
| U0.next | Развлекательные · 347 Ми - Україна | guide next «"Єдині новини". Телемарафон.» · banner «» | DRY-SKIP |
| U0.first-frame | Развлекательные · 347 Ми - Україна | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Развлекательные · 347 Ми - Україна | no picture in dry mode | DRY-SKIP |
| U0.rows | Музыкальные | 25/25 rows seen · empty 0 · not on air 0 · no API programme 0 · reference: 2 fresh fetches, ≤ 3993 ms after each page read, ended shows in it ≤ 0 | PASS |
| U0.banner-fields | Музыкальные · 348 Stingray iConcerts | num «348» · title «Stingray iConcerts» · now «05:22⁠–⁠07:00 Queens of the Stone Age: Zenith, Paris. 2013.» · next «» · clock «05:50» · shown true | PASS |
| U0.banner==row | Музыкальные · 348 Stingray iConcerts | menu «Queens of the Stone Age: Zenith, Paris. 2013.» · banner «05:22⁠–⁠07:00 Queens of the Stone Age: Zenith, Paris. 2013.» · API on air «Queens of the Stone Age: Zenith, Paris. 2013.» (fresh, 4631 ms after the banner, 2 ended in it) | PASS |
| U0.next | Музыкальные · 348 Stingray iConcerts | guide next «Take That: Wonderland Live from The O2 Arena, London. 2017.» · banner «» | DRY-SKIP |
| U0.first-frame | Музыкальные · 348 Stingray iConcerts | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Музыкальные · 348 Stingray iConcerts | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Музыкальные · 360 4ever Music | num «360» · title «4ever Music» · now «05:00⁠–⁠13:00 Хіти минулих років.» · next «» · clock «05:51» · shown true | PASS |
| U0.banner==row | Музыкальные · 360 4ever Music | menu «Хіти минулих років.» · banner «05:00⁠–⁠13:00 Хіти минулих років.» · API on air «Хіти минулих років.» (fresh, 2624 ms after the banner, 0 ended in it) | PASS |
| U0.next | Музыкальные · 360 4ever Music | guide next «Хіти минулих років.» · banner «» | DRY-SKIP |
| U0.first-frame | Музыкальные · 360 4ever Music | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Музыкальные · 360 4ever Music | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Музыкальные · 372 Жара | num «372» · title «Жара» · now «03:40⁠–⁠06:00 Мегамикс» · next «» · clock «05:51» · shown true | PASS |
| U0.banner==row | Музыкальные · 372 Жара | menu «Мегамикс» · banner «03:40⁠–⁠06:00 Мегамикс» · API on air «Мегамикс» (fresh, 2594 ms after the banner, 0 ended in it) | PASS |
| U0.next | Музыкальные · 372 Жара | guide next «Музыкальный блок» · banner «» | DRY-SKIP |
| U0.first-frame | Музыкальные · 372 Жара | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Музыкальные · 372 Жара | no picture in dry mode | DRY-SKIP |
| M2.open-on-playing | 372 Жара | cursor on 372 Жара  ▶ · playing marker true | PASS |
| M4.cursor-on-air | 372 Жара | 03:40 «Мегамикс» в эфире · API «Мегамикс» | PASS |
| M4.day-back | 372 Жара | Жара — Вчера | PASS |
| M4.past-plays | 372 Жара | «Музыкальный блок» → mode archive · banner «Жара · Архив · 00:30» · dry | PASS |
| M4.after-midnight (P8) | 71 Прямий | on air «Повтори прямих ефірів і передач дня» (started before 00:00) · panel «Прямий — Сегодня» cursor 23:20 «Повтори прямих ефірів і передач дня» в эфире | PASS |
| M4.after-midnight (P8) | 84 Перший Автомобільний | on air «Мотоспорт. MotoGP. Сезон 2026.» (started before 00:00) · panel «Перший Автомобільний — Сегодня» cursor 23:00 «Мотоспорт. MotoGP. Сезон 2026.» в эфире | PASS |
| M4.after-midnight (P8) | 266 Беларусь 5 | on air «Перерыв в вещании.» (started before 00:00) · panel «Беларусь 5 — Сегодня» cursor 23:50 «Перерыв в вещании.» в эфире | PASS |
| M5.scrub-back | 266 Беларусь 5 | knob 05:49:11 · position 05:49:11 · dry | PASS |
| M5.7-day-edge (D1) | 266 Беларусь 5 | knob 07:04:11 · mode archive · no picture in dry mode | DRY-SKIP |
| M5.to-live | 266 Беларусь 5 | knob прямой эфир · mode live | PASS |
| M7.single | 267 Prime Fight | no picture in dry mode | DRY-SKIP |
| M7.single | 268 Qazsport | no picture in dry mode | DRY-SKIP |
| M7.single | 269 Матч! Боец | no picture in dry mode | DRY-SKIP |
| M7.burst | from 269 Матч! Боец | landed 279 Матч! Футбол 3 (expected 279 Матч! Футбол 3) · 2 app requests | PASS |
| M8.paused | 279 Матч! Футбол 3 | mode paused · 0 requests in 10 s | PASS |
| M8.resume-in-place | 279 Матч! Футбол 3 | paused at 05:56:27 · resumed at 05:56:27 (archive) | DRY-SKIP |
| M9.live | 279 Матч! Футбол 3 · simulated hide | live → live · position 05:56:41 → 05:56:45 · dry | PASS |
| M9.archive | 279 Матч! Футбол 3 · simulated hide | archive → archive · position 05:53:45 → 05:53:45 · dry | PASS |
| M6.continuation (D2) | — | no picture in dry mode | DRY-SKIP |
| C2.archive-1d | 197 Viju+ Megahit | «La migliore offerta» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-3d | 197 Viju+ Megahit | «8 femmes» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-1d | 215 Кинокомедия | «х/ф Нереальная любовь» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-3d | 215 Кинокомедия | «х/ф Телохранитель на фрилансе» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-1d | 194 sci-fi | «Х/ф "Малышка на драйве".» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-3d | 194 sci-fi | «Х/ф "Взрывная блондинка".» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-1d | 228 Kinoliving | «х/ф Свистуны» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-3d | 228 Kinoliving | «т/с Пайрэт Бэй ┊ 5» · mode archive · no picture in dry mode | DRY-SKIP |
| M10.soak | — | no picture in dry mode | DRY-SKIP |
| M11.menu-open | 30 min | 348 row checks · 0 not on air · reference fresh, ≤ 20007 ms after each read, ended shows in it ≤ 2 | PASS |
| M11·U0.rows | Все каналы | 372/372 rows seen · empty 0 · not on air 19 · no API programme 1 · reference: 30 fresh fetches, ≤ 4855 ms after each page read, ended shows in it ≤ 48 · 55 Перший Західний: «Переможний голос віруючого.» ≠ on air «Підсумки тижня.» \| 56 Раі: «Новий погляд.» ≠ on air «Підбірка музичних творів.» \| 59 Перший Міський (Кривий Ріг): «Підсумки тижня.» ≠ on air «Інформаційний блок.» \| 60 Jurnal TV (Молдова): «Asfalt de Moldova» ≠ on air «Patrula Jurnal TV» | FAIL |
| app-errors | — | failure log lines: 40 | INFO |

#### Run B — 2026-10-26 06:32 (local) — DRY (desktop, headless Chrome, no picture) · tree /Users/yaroslavr/Developer/Projects/AI/kinozal-anastasia-perf · cases U0,M11

PASS 75 · FAIL 7 · DRY-SKIP 96 · NOT-RUN 0

| Case | Channel / group | Measured | Result |
|---|---|---|---|
| U0.rows | Все каналы | 372/372 rows seen · empty 0 · not on air 2 · no API programme 0 · reference: 30 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 5880 ms after each page read, ended shows in it ≤ 1 · 0 rows differed from the list API but matched the channel's guide · 1 Channel 9 (Израиль)  ▶: «Т/с "Обручальное кольцо", 698 с.» ≠ on air «Т/с "Свидетели", 82 с. "Долгая память".» (guide: «Т/с "Свидетели", 82 с. "Долгая память".») \| 13 Knesset Channel (Израиль): «המדריך לבחירות» ≠ on air «סוגרים כנס» (guide: «סוגרים כנס») | FAIL |
| U0.banner-fields | Все каналы · 1 Channel 9 (Израиль) | num «1» · title «Channel 9 (Израиль)» · now «06:30⁠–⁠07:20 Т/с "Свидетели", 82 с. "Долгая память".» · next «Далее 07:20 Т/с "Невидимки". "Змея и чучело".» · clock «06:34» · shown true | PASS |
| U0.banner==row | Все каналы · 1 Channel 9 (Израиль) | menu «Т/с "Свидетели", 82 с. "Долгая память".» · banner «06:30⁠–⁠07:20 Т/с "Свидетели", 82 с. "Долгая память".» · API on air «Т/с "Свидетели", 82 с. "Долгая память".» (fresh, 4197 ms after the banner, 0 ended in it) | PASS |
| U0.next | Все каналы · 1 Channel 9 (Израиль) | guide next «Т/с "Невидимки". "Змея и чучело".» · banner «Далее 07:20 Т/с "Невидимки". "Змея и чучело".» | PASS |
| U0.first-frame | Все каналы · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Все каналы · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Все каналы · 186 Кинохит | num «186» · title «Кинохит» · now «05:25⁠–⁠07:35 Х/ф "Вальмон".» · next «» · clock «06:34» · shown true | PASS |
| U0.banner==row | Все каналы · 186 Кинохит | menu «Х/ф "Вальмон".» · banner «05:25⁠–⁠07:35 Х/ф "Вальмон".» · API on air «Х/ф "Вальмон".» (fresh, 2422 ms after the banner, 1 ended in it) | PASS |
| U0.next | Все каналы · 186 Кинохит | guide next «Х/ф "Новая Земля".» · banner «» | DRY-SKIP |
| U0.first-frame | Все каналы · 186 Кинохит | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Все каналы · 186 Кинохит | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Все каналы · 372 Жара | num «372» · title «Жара» · now «06:00⁠–⁠07:00 Музыкальный блок» · next «» · clock «06:34» · shown true | PASS |
| U0.banner==row | Все каналы · 372 Жара | menu «Музыкальный блок» · banner «06:00⁠–⁠07:00 Музыкальный блок» · API on air «Музыкальный блок» (fresh, 4270 ms after the banner, 0 ended in it) | PASS |
| U0.next | Все каналы · 372 Жара | guide next «Жара новости» · banner «» | DRY-SKIP |
| U0.first-frame | Все каналы · 372 Жара | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Все каналы · 372 Жара | no picture in dry mode | DRY-SKIP |
| U0.rows | Израиль | 18/18 rows seen · empty 0 · not on air 0 · no API programme 0 · reference: 2 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 3131 ms after each page read, ended shows in it ≤ 0 · 0 rows differed from the list API but matched the channel's guide | PASS |
| U0.banner-fields | Израиль · 1 Channel 9 (Израиль) | num «1» · title «Channel 9 (Израиль)» · now «06:30⁠–⁠07:20 Т/с "Свидетели", 82 с. "Долгая память".» · next «Далее 07:20 Т/с "Невидимки". "Змея и чучело".» · clock «06:34» · shown true | PASS |
| U0.banner==row | Израиль · 1 Channel 9 (Израиль) | menu «Т/с "Свидетели", 82 с. "Долгая память".» · banner «06:30⁠–⁠07:20 Т/с "Свидетели", 82 с. "Долгая память".» · API on air «Т/с "Свидетели", 82 с. "Долгая память".» (fresh, 2949 ms after the banner, 0 ended in it) | PASS |
| U0.next | Израиль · 1 Channel 9 (Израиль) | guide next «Т/с "Невидимки". "Змея и чучело".» · banner «Далее 07:20 Т/с "Невидимки". "Змея и чучело".» | PASS |
| U0.first-frame | Израиль · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Израиль · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Израиль · 9 HOP! (Израиль) | num «9» · title «HOP! (Израиль)» · now «05:00⁠–⁠07:30 בוקר חיוכים» · next «» · clock «06:34» · shown true | PASS |
| U0.banner==row | Израиль · 9 HOP! (Израиль) | menu «בוקר חיוכים» · banner «05:00⁠–⁠07:30 בוקר חיוכים» · API on air «בוקר חיוכים» (fresh, 2897 ms after the banner, 0 ended in it) | PASS |
| U0.next | Израиль · 9 HOP! (Израиль) | guide next «קוקוריקו» · banner «» | DRY-SKIP |
| U0.first-frame | Израиль · 9 HOP! (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Израиль · 9 HOP! (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Израиль · 18 HOT HBO (Израиль) | num «18» · title «HOT HBO (Израиль)» · now «04:40⁠–⁠08:40 נשוב לשדר ב-09:40» · next «» · clock «06:35» · shown true | PASS |
| U0.banner==row | Израиль · 18 HOT HBO (Израиль) | menu «נשוב לשדר ב-09:40» · banner «04:40⁠–⁠08:40 נשוב לשדר ב-09:40» · API on air «נשוב לשדר ב-09:40» (fresh, 3754 ms after the banner, 0 ended in it) | PASS |
| U0.next | Израиль · 18 HOT HBO (Израиль) | guide next «1923» · banner «» | DRY-SKIP |
| U0.first-frame | Израиль · 18 HOT HBO (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Израиль · 18 HOT HBO (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.rows | Украина | 88/88 rows seen · empty 0 · not on air 3 · no API programme 0 · reference: 8 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 2894 ms after each page read, ended shows in it ≤ 0 · 0 rows differed from the list API but matched the channel's guide · 58 МТМ: «На часі. Підсумки.» ≠ on air «Погода.» (guide: «Погода.») \| 250 Niki junior: «М/с "Піратка і Капітан", 39 с. "СОС, пірат у небезпеці".» ≠ on air «М/с "Рафік, Толік та Додік", 51 с. "Пригода "Ігровий майданчик".» (guide: «М/с "Рафік, Толік та Додік", 51 с. "Пригода "Ігровий майданчик".») \| 309 36.6: «До 36 і більше, 25 еп.» ≠ on air «Юля зможе?!, 1 еп.» (guide: «Юля зможе?!, 1 еп.») | FAIL |
| U0.banner-fields | Украина · 19 Інтер | num «19» · title «Інтер» · now «06:00⁠–⁠07:00 "Єдині новини". Телемарафон.» · next «» · clock «06:35» · shown true | PASS |
| U0.banner==row | Украина · 19 Інтер | menu «"Єдині новини". Телемарафон.» · banner «06:00⁠–⁠07:00 "Єдині новини". Телемарафон.» · API on air «"Єдині новини". Телемарафон.» (fresh, 2606 ms after the banner, 0 ended in it) | PASS |
| U0.next | Украина · 19 Інтер | guide next «"Єдині новини". Телемарафон.» · banner «» | DRY-SKIP |
| U0.first-frame | Украина · 19 Інтер | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Украина · 19 Інтер | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Украина · 258 Sport 1 | num «258» · title «Sport 1» · now «05:00⁠–⁠07:00 Футбол. Чемпіонат Латвії. Вірсліга. РФС - Туку» · next «» · clock «06:35» · shown true | PASS |
| U0.banner==row | Украина · 258 Sport 1 | menu «Футбол. Чемпіонат Латвії. Вірсліга. РФС - Тукумс 2000.» · banner «05:00⁠–⁠07:00 Футбол. Чемпіонат Латвії. Вірсліга. РФС - Туку» · API on air «Футбол. Чемпіонат Латвії. Вірсліга. РФС - Тукумс 2000.» (fresh, 2575 ms after the banner, 0 ended in it) | PASS |
| U0.next | Украина · 258 Sport 1 | guide next «Футбол. Чемпіонат Польщі. Екстракласа. Відзев - Гурник.» · banner «» | DRY-SKIP |
| U0.first-frame | Украина · 258 Sport 1 | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Украина · 258 Sport 1 | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Украина · 366 Viva Latino | num «366» · title «Viva Latino» · now «05:00⁠–⁠13:00 Кліпи.» · next «» · clock «06:36» · shown true | PASS |
| U0.banner==row | Украина · 366 Viva Latino | menu «Кліпи.» · banner «05:00⁠–⁠13:00 Кліпи.» · API on air «Кліпи.» (fresh, 2672 ms after the banner, 0 ended in it) | PASS |
| U0.next | Украина · 366 Viva Latino | guide next «Кліпи.» · banner «» | DRY-SKIP |
| U0.first-frame | Украина · 366 Viva Latino | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Украина · 366 Viva Latino | no picture in dry mode | DRY-SKIP |
| U0.rows | Национальные | 62/62 rows seen · empty 0 · not on air 0 · no API programme 0 · reference: 5 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 2955 ms after each page read, ended shows in it ≤ 0 · 0 rows differed from the list API but matched the channel's guide | PASS |
| U0.banner-fields | Национальные · 1 Channel 9 (Израиль) | num «1» · title «Channel 9 (Израиль)» · now «06:30⁠–⁠07:20 Т/с "Свидетели", 82 с. "Долгая память".» · next «Далее 07:20 Т/с "Невидимки". "Змея и чучело".» · clock «06:36» · shown true | PASS |
| U0.banner==row | Национальные · 1 Channel 9 (Израиль) | menu «Т/с "Свидетели", 82 с. "Долгая память".» · banner «06:30⁠–⁠07:20 Т/с "Свидетели", 82 с. "Долгая память".» · API on air «Т/с "Свидетели", 82 с. "Долгая память".» (fresh, 2668 ms after the banner, 1 ended in it) | PASS |
| U0.next | Национальные · 1 Channel 9 (Израиль) | guide next «Т/с "Невидимки". "Змея и чучело".» · banner «Далее 07:20 Т/с "Невидимки". "Змея и чучело".» | PASS |
| U0.first-frame | Национальные · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Национальные · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Национальные · 31 Астана ТВ (Казахстан) | num «31» · title «Астана ТВ (Казахстан)» · now «06:25⁠–⁠07:30 Үздік әзілдер» · next «» · clock «06:36» · shown true | PASS |
| U0.banner==row | Национальные · 31 Астана ТВ (Казахстан) | menu «Үздік әзілдер» · banner «06:25⁠–⁠07:30 Үздік әзілдер» · API on air «Үздік әзілдер» (fresh, 2601 ms after the banner, 0 ended in it) | PASS |
| U0.next | Национальные · 31 Астана ТВ (Казахстан) | guide next «Художественный фильм» · banner «» | DRY-SKIP |
| U0.first-frame | Национальные · 31 Астана ТВ (Казахстан) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Национальные · 31 Астана ТВ (Казахстан) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Национальные · 62 Армія TV | num «62» · title «Армія TV» · now «06:00⁠–⁠07:00 Нет данных» · next «» · clock «06:36» · shown true | PASS |
| U0.banner==row | Национальные · 62 Армія TV | menu «Нет данных» · banner «06:00⁠–⁠07:00 Нет данных» · API on air «Нет данных» (fresh, 3602 ms after the banner, 0 ended in it) | PASS |
| U0.next | Национальные · 62 Армія TV | guide next «—» · banner «» | DRY-SKIP |
| U0.first-frame | Национальные · 62 Армія TV | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Национальные · 62 Армія TV | no picture in dry mode | DRY-SKIP |
| U0.rows | Новостные | 11/11 rows seen · empty 0 · not on air 0 · no API programme 0 · reference: 1 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 2509 ms after each page read, ended shows in it ≤ 0 · 0 rows differed from the list API but matched the channel's guide | PASS |
| U0.banner-fields | Новостные · 63 Deutsche Welle | num «63» · title «Deutsche Welle» · now «06:15⁠–⁠06:45 Global Us. What connects us all.» · next «» · clock «06:37» · shown true | PASS |
| U0.banner==row | Новостные · 63 Deutsche Welle | menu «Global Us. What connects us all.» · banner «06:15⁠–⁠06:45 Global Us. What connects us all.» · API on air «Global Us. What connects us all.» (fresh, 4611 ms after the banner, 0 ended in it) | PASS |
| U0.next | Новостные · 63 Deutsche Welle | guide next «Reporter. On Location.» · banner «» | DRY-SKIP |
| U0.first-frame | Новостные · 63 Deutsche Welle | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Новостные · 63 Deutsche Welle | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Новостные · 68 FreeДОМ | num «68» · title «FreeДОМ» · now «06:11⁠–⁠06:37 Спеціальний репортаж.» · next «» · clock «06:37» · shown true | PASS |
| U0.banner==row | Новостные · 68 FreeДОМ | menu «Спеціальний репортаж.» · banner «06:11⁠–⁠06:37 Спеціальний репортаж.» · API on air «Історичні факти.» (fresh, 2385 ms after the banner, 0 ended in it) | FAIL |
| U0.next | Новостные · 68 FreeДОМ | guide next «Наш час.» · banner «» | DRY-SKIP |
| U0.first-frame | Новостные · 68 FreeДОМ | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Новостные · 68 FreeДОМ | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Новостные · 73 Новини Live | num «73» · title «Новини Live» · now «06:00⁠–⁠07:00 Нет данных» · next «» · clock «06:37» · shown true | PASS |
| U0.banner==row | Новостные · 73 Новини Live | menu «Нет данных» · banner «06:00⁠–⁠07:00 Нет данных» · API on air «Нет данных» (fresh, 2669 ms after the banner, 0 ended in it) | PASS |
| U0.next | Новостные · 73 Новини Live | guide next «—» · banner «» | DRY-SKIP |
| U0.first-frame | Новостные · 73 Новини Live | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Новостные · 73 Новини Live | no picture in dry mode | DRY-SKIP |
| U0.rows | Познавательные | 64/64 rows seen · empty 0 · not on air 0 · no API programme 0 · reference: 6 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 2555 ms after each page read, ended shows in it ≤ 0 · 0 rows differed from the list API but matched the channel's guide | PASS |
| U0.banner-fields | Познавательные · 74 National Geographic | num «74» · title «National Geographic» · now «06:05⁠–⁠06:50 д/с Настоящий суперкар (Саб-Зиро Порше)» · next «» · clock «06:37» · shown true | PASS |
| U0.banner==row | Познавательные · 74 National Geographic | menu «д/с Настоящий суперкар (Саб-Зиро Порше)» · banner «06:05⁠–⁠06:50 д/с Настоящий суперкар (Саб-Зиро Порше)» · API on air «д/с Настоящий суперкар (Саб-Зиро Порше)» (fresh, 2487 ms after the banner, 0 ended in it) | PASS |
| U0.next | Познавательные · 74 National Geographic | guide next «д/с Настоящий суперкар (Транспортер Lamborghini)» · banner «» | DRY-SKIP |
| U0.first-frame | Познавательные · 74 National Geographic | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Познавательные · 74 National Geographic | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Познавательные · 105 Discovery | num «105» · title «Discovery» · now «06:00⁠–⁠07:00 Грязные богатства, 2 с-н 9 с. Заплесневелые со» · next «» · clock «06:37» · shown true | PASS |
| U0.banner==row | Познавательные · 105 Discovery | menu «Грязные богатства, 2 с-н 9 с. Заплесневелые сокровища» · banner «06:00⁠–⁠07:00 Грязные богатства, 2 с-н 9 с. Заплесневелые со» · API on air «Грязные богатства, 2 с-н 9 с. Заплесневелые сокровища» (fresh, 2474 ms after the banner, 0 ended in it) | PASS |
| U0.next | Познавательные · 105 Discovery | guide next «Гаражный ремонт, 9 с. Скоростной авторемонт» · banner «» | DRY-SKIP |
| U0.first-frame | Познавательные · 105 Discovery | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Познавательные · 105 Discovery | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Познавательные · 137 ЗооСвіт | num «137» · title «ЗооСвіт» · now «06:00⁠–⁠07:00 Нет данных» · next «» · clock «06:38» · shown true | PASS |
| U0.banner==row | Познавательные · 137 ЗооСвіт | menu «Нет данных» · banner «06:00⁠–⁠07:00 Нет данных» · API on air «Нет данных» (fresh, 2492 ms after the banner, 0 ended in it) | PASS |
| U0.next | Познавательные · 137 ЗооСвіт | guide next «—» · banner «» | DRY-SKIP |
| U0.first-frame | Познавательные · 137 ЗооСвіт | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Познавательные · 137 ЗооСвіт | no picture in dry mode | DRY-SKIP |
| U0.rows | Кино | 95/95 rows seen · empty 0 · not on air 1 · no API programme 0 · reference: 8 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 2954 ms after each page read, ended shows in it ≤ 1 · 0 rows differed from the list API but matched the channel's guide · 231 Cineman Ментовские войны: «Ментовские войны 7 сезон 12 серия» ≠ on air «Ментовские войны 7 сезон 13 серия» (guide: «Ментовские войны 7 сезон 13 серия») | FAIL |
| U0.banner-fields | Кино · 138 KinoKazka | num «138» · title «KinoKazka» · now «06:30⁠–⁠06:45 м/с Гормити 3 ┊ 59» · next «» · clock «06:38» · shown true | PASS |
| U0.banner==row | Кино · 138 KinoKazka | menu «м/с Гормити 3 ┊ 59» · banner «06:30⁠–⁠06:45 м/с Гормити 3 ┊ 59» · API on air «м/с Гормити 3 ┊ 59» (fresh, 2513 ms after the banner, 0 ended in it) | PASS |
| U0.next | Кино · 138 KinoKazka | guide next «м/ф Фелікс рятує день» · banner «» | DRY-SKIP |
| U0.first-frame | Кино · 138 KinoKazka | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Кино · 138 KinoKazka | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Кино · 185 Cineman MiniSeries | num «185» · title «Cineman MiniSeries» · now «05:43⁠–⁠06:40 Молодой Папа 1 сезон 3 серия» · next «» · clock «06:38» · shown true | PASS |
| U0.banner==row | Кино · 185 Cineman MiniSeries | menu «Молодой Папа 1 сезон 3 серия» · banner «05:43⁠–⁠06:40 Молодой Папа 1 сезон 3 серия» · API on air «Молодой Папа 1 сезон 3 серия» (fresh, 2551 ms after the banner, 0 ended in it) | PASS |
| U0.next | Кино · 185 Cineman MiniSeries | guide next «Молодой Папа 1 сезон 4 серия» · banner «» | DRY-SKIP |
| U0.first-frame | Кино · 185 Cineman MiniSeries | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Кино · 185 Cineman MiniSeries | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Кино · 232 BCU | num «232» · title «BCU» · now «06:00⁠–⁠07:00 Нет данных» · next «» · clock «06:39» · shown true | PASS |
| U0.banner==row | Кино · 232 BCU | menu «Нет данных» · banner «06:00⁠–⁠07:00 Нет данных» · API on air «Нет данных» (fresh, 3110 ms after the banner, 0 ended in it) | PASS |
| U0.next | Кино · 232 BCU | guide next «—» · banner «» | DRY-SKIP |
| U0.first-frame | Кино · 232 BCU | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Кино · 232 BCU | no picture in dry mode | DRY-SKIP |
| U0.rows | Детские | 22/22 rows seen · empty 0 · not on air 0 · no API programme 0 · reference: 2 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 2890 ms after each page read, ended shows in it ≤ 0 · 0 rows differed from the list API but matched the channel's guide | PASS |
| U0.banner-fields | Детские · 233 Nick Jr | num «233» · title «Nick Jr» · now «06:35⁠–⁠07:00 М/с "Тим Рекс в космосе", 1 сезон, 3 с. "Ракет» · next «» · clock «06:39» · shown true | PASS |
| U0.banner==row | Детские · 233 Nick Jr | menu «М/с "Тим Рекс в космосе", 1 сезон, 3 с. "Ракетная гонка / Ма» · banner «06:35⁠–⁠07:00 М/с "Тим Рекс в космосе", 1 сезон, 3 с. "Ракет» · API on air «М/с "Тим Рекс в космосе", 1 сезон, 3 с. "Ракетная гонка / Магия / Родители".» (fresh, 2578 ms after the banner, 0 ended in it) | PASS |
| U0.next | Детские · 233 Nick Jr | guide next «М/с "Тим Рекс в космосе", 2 сезон, 3 с. "Пляжный сканнер / Уборка / Питмоцы".» · banner «» | DRY-SKIP |
| U0.first-frame | Детские · 233 Nick Jr | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Детские · 233 Nick Jr | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Детские · 243 В гостях у сказки | num «243» · title «В гостях у сказки» · now «06:30⁠–⁠06:40 М/ф "Впервые на арене".» · next «» · clock «06:39» · shown true | PASS |
| U0.banner==row | Детские · 243 В гостях у сказки | menu «М/ф "Впервые на арене".» · banner «06:30⁠–⁠06:40 М/ф "Впервые на арене".» · API on air «М/ф "Впервые на арене".» (fresh, 2543 ms after the banner, 0 ended in it) | PASS |
| U0.next | Детские · 243 В гостях у сказки | guide next «М/ф "Ежик плюс черепаха".» · banner «» | DRY-SKIP |
| U0.first-frame | Детские · 243 В гостях у сказки | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Детские · 243 В гостях у сказки | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Детские · 254 Nickelodeon | num «254» · title «Nickelodeon» · now «06:23⁠–⁠06:47 Губка Боб Квадратные Штаны» · next «» · clock «06:39» · shown true | PASS |
| U0.banner==row | Детские · 254 Nickelodeon | menu «Губка Боб Квадратные Штаны» · banner «06:23⁠–⁠06:47 Губка Боб Квадратные Штаны» · API on air «Губка Боб Квадратные Штаны» (fresh, 2485 ms after the banner, 0 ended in it) | PASS |
| U0.next | Детские · 254 Nickelodeon | guide next «Губка Боб Квадратные Штаны» · banner «» | DRY-SKIP |
| U0.first-frame | Детские · 254 Nickelodeon | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Детские · 254 Nickelodeon | no picture in dry mode | DRY-SKIP |
| U0.rows | Спорт | 41/41 rows seen · empty 0 · not on air 0 · no API programme 0 · reference: 4 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 2997 ms after each page read, ended shows in it ≤ 0 · 0 rows differed from the list API but matched the channel's guide | PASS |
| U0.banner-fields | Спорт · 255 Setanta Sports UA | num «255» · title «Setanta Sports UA» · now «05:00⁠–⁠07:00 Футбол. Чемпионат Англии. Чемпионшип. Чарльтон» · next «» · clock «06:39» · shown true | PASS |
| U0.banner==row | Спорт · 255 Setanta Sports UA | menu «Футбол. Чемпионат Англии. Чемпионшип. Чарльтон Атлетик - Нор» · banner «05:00⁠–⁠07:00 Футбол. Чемпионат Англии. Чемпионшип. Чарльтон» · API on air «Футбол. Чемпионат Англии. Чемпионшип. Чарльтон Атлетик - Норвич Сити.» (fresh, 4530 ms after the banner, 19 ended in it) | PASS |
| U0.next | Спорт · 255 Setanta Sports UA | guide next «Футбол. Чемпионат Германии. РБ Лейпциг - Эльферсберг.» · banner «» | DRY-SKIP |
| U0.first-frame | Спорт · 255 Setanta Sports UA | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Спорт · 255 Setanta Sports UA | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Спорт · 275 KHL ТВ | num «275» · title «KHL ТВ» · now «05:00⁠–⁠07:20 ФОНБЕТ Чемпионат КХЛ. "Салават Юлаев" - "Ак Ба» · next «» · clock «06:40» · shown true | PASS |
| U0.banner==row | Спорт · 275 KHL ТВ | menu «ФОНБЕТ Чемпионат КХЛ. "Салават Юлаев" - "Ак Барс".» · banner «05:00⁠–⁠07:20 ФОНБЕТ Чемпионат КХЛ. "Салават Юлаев" - "Ак Ба» · API on air «ФОНБЕТ Чемпионат КХЛ. "Салават Юлаев" - "Ак Барс".» (fresh, 3375 ms after the banner, 0 ended in it) | PASS |
| U0.next | Спорт · 275 KHL ТВ | guide next «"Видео дня".» · banner «» | DRY-SKIP |
| U0.first-frame | Спорт · 275 KHL ТВ | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Спорт · 275 KHL ТВ | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Спорт · 295 ОККО Прайм Спорт | num «295» · title «ОККО Прайм Спорт» · now «04:20⁠–⁠08:00 Футбол. Франция. 1–4 c» · next «» · clock «06:40» · shown true | PASS |
| U0.banner==row | Спорт · 295 ОККО Прайм Спорт | menu «Футбол. Франция. 1–4 c» · banner «04:20⁠–⁠08:00 Футбол. Франция. 1–4 c» · API on air «Футбол. Франция. 1–4 c» (fresh, 2686 ms after the banner, 0 ended in it) | PASS |
| U0.next | Спорт · 295 ОККО Прайм Спорт | guide next «Новости спорта» · banner «» | DRY-SKIP |
| U0.first-frame | Спорт · 295 ОККО Прайм Спорт | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Спорт · 295 ОККО Прайм Спорт | no picture in dry mode | DRY-SKIP |
| U0.rows | Развлекательные | 52/52 rows seen · empty 0 · not on air 3 · no API programme 0 · reference: 5 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 2775 ms after each page read, ended shows in it ≤ 0 · 0 rows differed from the list API but matched the channel's guide · 313 ПлюсПлюс: «Корисні підказки.» ≠ on air «Світ чекає на відкриття.» (guide: «Світ чекає на відкриття.») \| 334 2х2: «М/с "Смешарики", 118 с.» ≠ on air «М/с "Смешарики", 119 с.» (guide: «М/с "Смешарики", 119 с.») \| 338 Міледі ТВ: «Від першої особи з Сергієм Дойком.» ≠ on air «Батьківські збори.» (guide: «Батьківські збори.») | FAIL |
| U0.banner-fields | Развлекательные · 296 Fashion ONE | num «296» · title «Fashion ONE» · now «06:37⁠–⁠06:46 Модные Показы (12+)» · next «» · clock «06:40» · shown true | PASS |
| U0.banner==row | Развлекательные · 296 Fashion ONE | menu «Модные Показы (12+)» · banner «06:37⁠–⁠06:46 Модные Показы (12+)» · API on air «Модные Показы (12+)» (fresh, 2489 ms after the banner, 0 ended in it) | PASS |
| U0.next | Развлекательные · 296 Fashion ONE | guide next «Мода и искусство (12+)» · banner «» | DRY-SKIP |
| U0.first-frame | Развлекательные · 296 Fashion ONE | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Развлекательные · 296 Fashion ONE | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Развлекательные · 321 Панянка-селянка+ | num «321» · title «Панянка-селянка+» · now «06:00⁠–⁠07:00 Програма відсутня» · next «» · clock «06:40» · shown true | PASS |
| U0.banner==row | Развлекательные · 321 Панянка-селянка+ | menu «Програма відсутня» · banner «06:00⁠–⁠07:00 Програма відсутня» · API on air «Програма відсутня» (fresh, 2706 ms after the banner, 0 ended in it) | PASS |
| U0.next | Развлекательные · 321 Панянка-селянка+ | guide next «Програма відсутня» · banner «» | DRY-SKIP |
| U0.first-frame | Развлекательные · 321 Панянка-селянка+ | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Развлекательные · 321 Панянка-селянка+ | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Развлекательные · 347 Ми - Україна | num «347» · title «Ми - Україна» · now «06:00⁠–⁠07:00 "Єдині новини". Телемарафон.» · next «» · clock «06:41» · shown true | PASS |
| U0.banner==row | Развлекательные · 347 Ми - Україна | menu «"Єдині новини". Телемарафон.» · banner «06:00⁠–⁠07:00 "Єдині новини". Телемарафон.» · API on air «"Єдині новини". Телемарафон.» (fresh, 2925 ms after the banner, 1 ended in it) | PASS |
| U0.next | Развлекательные · 347 Ми - Україна | guide next «"Єдині новини". Телемарафон.» · banner «» | DRY-SKIP |
| U0.first-frame | Развлекательные · 347 Ми - Україна | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Развлекательные · 347 Ми - Україна | no picture in dry mode | DRY-SKIP |
| U0.rows | Музыкальные | 25/25 rows seen · empty 0 · not on air 0 · no API programme 0 · reference: 2 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 2561 ms after each page read, ended shows in it ≤ 0 · 0 rows differed from the list API but matched the channel's guide | PASS |
| U0.banner-fields | Музыкальные · 348 Stingray iConcerts | num «348» · title «Stingray iConcerts» · now «05:22⁠–⁠07:00 Queens of the Stone Age: Zenith, Paris. 2013.» · next «» · clock «06:41» · shown true | PASS |
| U0.banner==row | Музыкальные · 348 Stingray iConcerts | menu «Queens of the Stone Age: Zenith, Paris. 2013.» · banner «05:22⁠–⁠07:00 Queens of the Stone Age: Zenith, Paris. 2013.» · API on air «Queens of the Stone Age: Zenith, Paris. 2013.» (fresh, 2681 ms after the banner, 0 ended in it) | PASS |
| U0.next | Музыкальные · 348 Stingray iConcerts | guide next «Take That: Wonderland Live from The O2 Arena, London. 2017.» · banner «» | DRY-SKIP |
| U0.first-frame | Музыкальные · 348 Stingray iConcerts | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Музыкальные · 348 Stingray iConcerts | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Музыкальные · 360 4ever Music | num «360» · title «4ever Music» · now «05:00⁠–⁠13:00 Хіти минулих років.» · next «» · clock «06:41» · shown true | PASS |
| U0.banner==row | Музыкальные · 360 4ever Music | menu «Хіти минулих років.» · banner «05:00⁠–⁠13:00 Хіти минулих років.» · API on air «Хіти минулих років.» (fresh, 2771 ms after the banner, 0 ended in it) | PASS |
| U0.next | Музыкальные · 360 4ever Music | guide next «Хіти минулих років.» · banner «» | DRY-SKIP |
| U0.first-frame | Музыкальные · 360 4ever Music | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Музыкальные · 360 4ever Music | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Музыкальные · 372 Жара | num «372» · title «Жара» · now «06:00⁠–⁠07:00 Музыкальный блок» · next «» · clock «06:41» · shown true | PASS |
| U0.banner==row | Музыкальные · 372 Жара | menu «Музыкальный блок» · banner «06:00⁠–⁠07:00 Музыкальный блок» · API on air «Музыкальный блок» (fresh, 2534 ms after the banner, 0 ended in it) | PASS |
| U0.next | Музыкальные · 372 Жара | guide next «Жара новости» · banner «» | DRY-SKIP |
| U0.first-frame | Музыкальные · 372 Жара | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Музыкальные · 372 Жара | no picture in dry mode | DRY-SKIP |
| M11.menu-open | 30 min | 390 row checks · 42 not on air · reference fresh, ≤ 3410 ms after each read, ended shows in it ≤ 21 · 0 minutes without a usable reference · +12 min 369 Bridge: «Нет данных» ≠ «Wake Up Call.» \| +12 min 371 Bridge хит: «Нет данных» ≠ «Wake Up Call.» \| +13 min 369 Bridge: «Нет данных» ≠ «Wake Up Call.» \| +13 min 371 Bridge хит: «Нет данных» ≠ «Wake Up Call.» \| +14 min 369 Bridge: «Нет данных» ≠ «Wake Up Call.» | FAIL |
| M11·U0.rows | Все каналы | 372/372 rows seen · empty 0 · not on air 4 · no API programme 1 · reference: 30 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 4490 ms after each page read, ended shows in it ≤ 1 · 0 rows differed from the list API but matched the channel's guide · 15 KAN23 (Израиль): «הנסיך הקטן וחברים - 7. הנוסע השישי» ≠ on air «היכון הכן טוס - 22. קולות רקע» (guide: «היכון הכן טוס - 22. קולות רקע») \| 349 Stingray CMusic: «Нет данных» ≠ on air «Dawn Chorus.» (guide: «—») \| 369 Bridge: «Нет данных» ≠ on air «Wake Up Call.» (guide: «—») \| 371 Bridge хит: «Нет данных» ≠ on air «Wake Up Call.» (guide: «—») | FAIL |
| app-errors | — | failure log lines: 40 | INFO |

### 2026-10-26 07:16–09:30 — CLEAN dry runs on frozen trees: perf-fixes 8d3905f (D6b) and f7ccc45 (D7)
Frozen detached checkouts; the fresh reference and the guide tie-breaker are on. For each differing row the time since the show changed comes from the guide's start of the programme on air, or the fresh list's start when there is no guide. Rows under 60 s are within the 60 s refresh floor (DEC-2026-10-26-now-refresh). In the f7ccc45 run each U0 sweep also records its start time and how long the menu had been closed.

| | 8d3905f | f7ccc45 |
|---|---|---|
| U0 Все каналы — rows differing (< 60 s / > 60 s) | 6 (1 / 5: Israel rows 3, 14, 15 at 377, 382, 202 s; 23 К2 and 24 Суспільне Київ at 82 s) | 5 (2 / 3: Israel rows 2, 6, 10 at 352 s, sweep 08:05:50, 1 s after boot) |
| Израиль, Украина, Новостные, Детские, Спорт | 0 each | 0 each |
| Национальные | 3 (all < 60 s) | 0 |
| Познавательные | 3 (all < 60 s) | 1 (< 60 s) |
| Кино | 1 (< 60 s) | 0 |
| Развлекательные | 0 | 0 |
| Музыкальные | 1 (< 60 s) | 0 |
| M11, menu open 30 min — differing checks (< 60 s / > 60 s) | 4 of 359 (3 / 1 at 61 s, 233 Nick Jr) | 0 of 382 |
| U0 Все каналы after the 30 min (< 60 s / > 60 s) | 6 (6 / 0) | 2 (2 / 0) |
| Bridge «Нет данных» (D7) | not seen | not seen |

**Over 60 s in both trees:** the Israeli rows in the first «Все каналы» sweep, right after boot (Channel 11, Channel 12, Channel 24, i24, Zoom, KAN23; 202–382 s). The first sweep starts within seconds of launch, so the launch list was already minutes old for those channels and the immediate fresh re-read (D6b) had not corrected them by the time the first page was read. The «Израиль» group sweep 2–3 min later shows 0. Everything else that differed changed less than 60 s before the read, apart from 233 Nick Jr at 61 s and К2 and Суспільне Київ at 82 s in 8d3905f.

#### Run 8d3905f — 2026-10-26 07:16 (local) — DRY (desktop, headless Chrome, no picture) · tree /private/tmp/claude-501/-Users-yaroslavr/40bd8e7a-b591-426c-be3d-f3bef355966b/scratchpad/frozen-8d3905f · cases U0,M2,M4,M5,M7,M8,M9,M6,C2,M10,M11

PASS 86 · FAIL 7 · DRY-SKIP 111 · NOT-RUN 0

| Case | Channel / group | Measured | Result |
|---|---|---|---|
| U0.rows | Все каналы | 372/372 rows seen · empty 0 · not on air 6 (1 of them < 60 s after the show changed) · no API programme 0 · reference: 30 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 4371 ms after each page read, ended shows in it ≤ 0 · 0 rows differed from the list API but matched the channel's guide · 3 Channel 12 (Израиль): «מבזק חדשות» ≠ on air «חדשות הבוקר - עם ניב רסקין» (guide: «חדשות הבוקר - עם ניב רסקין») · changed 377 s before the read \| 14 Zoom (Израиль): «סופר סטרייקה 5 -האיש במסכת טנק הברזל» ≠ on air «לגו חברות - הדור הבא עונה 3 - פרק 4» (guide: «לגו חברות - הדור הבא עונה 3 - פרק 4») · changed 382 s before the read \| 15 KAN23 (Израиль): «הנסיך הקטן וחברים - 7. הנוסע השישי» ≠ on air «היכון הכן טוס - 22. קולות רקע» (guide: «היכון הכן טוס - 22. קולות רקע») · changed 202 s before the read \| 23 К2: «Т/с "Криваві квіти", 2 сезон, 183 с.» ≠ on air «"Сімейний суд", 61 еп.» (guide: «"Сімейний суд", 61 еп.») · changed 82 s before the read \| 24 Суспільне Київ: «Суспільне Спорт. Новини.» ≠ on air «Легка атлетика. Діамантова ліга. Етап 7 у Досі, Катар. Стрибки у висоту. Чоловіки.» (guide: «—») · changed 82 s before the read \| 247 Капитан Фантастика: «м/ф Леонардо: Миссия Мона Лиза» ≠ on air «м/ф Забытое чудо ┊ 1» (guide: «м/ф Забытое чудо ┊ 1») · changed 19 s before the read | FAIL |
| U0.banner-fields | Все каналы · 1 Channel 9 (Израиль) | num «1» · title «Channel 9 (Израиль)» · now «06:30⁠–⁠07:20 Т/с "Свидетели", 82 с. "Долгая память".» · next «Далее 07:20 Т/с "Невидимки". "Змея и чучело".» · clock «07:17» · shown true | PASS |
| U0.banner==row | Все каналы · 1 Channel 9 (Израиль) | menu «Т/с "Свидетели", 82 с. "Долгая память".» · banner «06:30⁠–⁠07:20 Т/с "Свидетели", 82 с. "Долгая память".» · API on air «Т/с "Свидетели", 82 с. "Долгая память".» (fresh, 2594 ms after the banner, 0 ended in it) | PASS |
| U0.next | Все каналы · 1 Channel 9 (Израиль) | guide next «Т/с "Невидимки". "Змея и чучело".» · banner «Далее 07:20 Т/с "Невидимки". "Змея и чучело".» | PASS |
| U0.first-frame | Все каналы · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Все каналы · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Все каналы · 186 Кинохит | num «186» · title «Кинохит» · now «05:25⁠–⁠07:35 Х/ф "Вальмон".» · next «» · clock «07:18» · shown true | PASS |
| U0.banner==row | Все каналы · 186 Кинохит | menu «Х/ф "Вальмон".» · banner «05:25⁠–⁠07:35 Х/ф "Вальмон".» · API on air «Х/ф "Вальмон".» (fresh, 2577 ms after the banner, 0 ended in it) | PASS |
| U0.next | Все каналы · 186 Кинохит | guide next «Х/ф "Новая Земля".» · banner «» | DRY-SKIP |
| U0.first-frame | Все каналы · 186 Кинохит | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Все каналы · 186 Кинохит | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Все каналы · 372 Жара | num «372» · title «Жара» · now «07:15⁠–⁠08:00 Музыкальный блок» · next «» · clock «07:18» · shown true | PASS |
| U0.banner==row | Все каналы · 372 Жара | menu «Музыкальный блок» · banner «07:15⁠–⁠08:00 Музыкальный блок» · API on air «Музыкальный блок» (fresh, 2601 ms after the banner, 0 ended in it) | PASS |
| U0.next | Все каналы · 372 Жара | guide next «Сквозь время» · banner «» | DRY-SKIP |
| U0.first-frame | Все каналы · 372 Жара | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Все каналы · 372 Жара | no picture in dry mode | DRY-SKIP |
| U0.rows | Израиль | 18/18 rows seen · empty 0 · not on air 0 (0 of them < 60 s after the show changed) · no API programme 0 · reference: 2 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 3498 ms after each page read, ended shows in it ≤ 0 · 0 rows differed from the list API but matched the channel's guide | PASS |
| U0.banner-fields | Израиль · 1 Channel 9 (Израиль) | num «1» · title «Channel 9 (Израиль)» · now «06:30⁠–⁠07:20 Т/с "Свидетели", 82 с. "Долгая память".» · next «Далее 07:20 Т/с "Невидимки". "Змея и чучело".» · clock «07:18» · shown true | PASS |
| U0.banner==row | Израиль · 1 Channel 9 (Израиль) | menu «Т/с "Свидетели", 82 с. "Долгая память".» · banner «06:30⁠–⁠07:20 Т/с "Свидетели", 82 с. "Долгая память".» · API on air «Т/с "Свидетели", 82 с. "Долгая память".» (fresh, 3190 ms after the banner, 1 ended in it) | PASS |
| U0.next | Израиль · 1 Channel 9 (Израиль) | guide next «Т/с "Невидимки". "Змея и чучело".» · banner «Далее 07:20 Т/с "Невидимки". "Змея и чучело".» | PASS |
| U0.first-frame | Израиль · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Израиль · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Израиль · 9 HOP! (Израиль) | num «9» · title «HOP! (Израиль)» · now «05:00⁠–⁠07:30 בוקר חיוכים» · next «» · clock «07:18» · shown true | PASS |
| U0.banner==row | Израиль · 9 HOP! (Израиль) | menu «בוקר חיוכים» · banner «05:00⁠–⁠07:30 בוקר חיוכים» · API on air «בוקר חיוכים» (fresh, 2442 ms after the banner, 0 ended in it) | PASS |
| U0.next | Израиль · 9 HOP! (Израиль) | guide next «קוקוריקו» · banner «» | DRY-SKIP |
| U0.first-frame | Израиль · 9 HOP! (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Израиль · 9 HOP! (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Израиль · 18 HOT HBO (Израиль) | num «18» · title «HOT HBO (Израиль)» · now «04:40⁠–⁠08:40 נשוב לשדר ב-09:40» · next «» · clock «07:18» · shown true | PASS |
| U0.banner==row | Израиль · 18 HOT HBO (Израиль) | menu «נשוב לשדר ב-09:40» · banner «04:40⁠–⁠08:40 נשוב לשדר ב-09:40» · API on air «נשוב לשדר ב-09:40» (fresh, 2866 ms after the banner, 0 ended in it) | PASS |
| U0.next | Израиль · 18 HOT HBO (Израиль) | guide next «1923» · banner «» | DRY-SKIP |
| U0.first-frame | Израиль · 18 HOT HBO (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Израиль · 18 HOT HBO (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.rows | Украина | 90/90 rows seen · empty 0 · not on air 0 (0 of them < 60 s after the show changed) · no API programme 0 · reference: 8 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 3064 ms after each page read, ended shows in it ≤ 0 · 0 rows differed from the list API but matched the channel's guide | PASS |
| U0.banner-fields | Украина · 19 Інтер | num «19» · title «Інтер» · now «07:00⁠–⁠08:00 "Єдині новини". Телемарафон.» · next «» · clock «07:19» · shown true | PASS |
| U0.banner==row | Украина · 19 Інтер | menu «"Єдині новини". Телемарафон.» · banner «07:00⁠–⁠08:00 "Єдині новини". Телемарафон.» · API on air «"Єдині новини". Телемарафон.» (fresh, 2506 ms after the banner, 0 ended in it) | PASS |
| U0.next | Украина · 19 Інтер | guide next «"Єдині новини". Телемарафон.» · banner «» | DRY-SKIP |
| U0.first-frame | Украина · 19 Інтер | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Украина · 19 Інтер | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Украина · 250 Niki junior | num «250» · title «Niki junior» · now «07:18⁠–⁠07:24 М/с "Маленькі приятелі", 26 с. "Таємничі звуки» · next «» · clock «07:19» · shown true | PASS |
| U0.banner==row | Украина · 250 Niki junior | menu «М/с "Маленькі приятелі", 26 с. "Таємничі звуки".» · banner «07:18⁠–⁠07:24 М/с "Маленькі приятелі", 26 с. "Таємничі звуки» · API on air «М/с "Маленькі приятелі", 26 с. "Таємничі звуки".» (fresh, 2689 ms after the banner, 0 ended in it) | PASS |
| U0.next | Украина · 250 Niki junior | guide next «М/с "Моланг", 25 с. "Авто".» · banner «» | DRY-SKIP |
| U0.first-frame | Украина · 250 Niki junior | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Украина · 250 Niki junior | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Украина · 366 Viva Latino | num «366» · title «Viva Latino» · now «05:00⁠–⁠13:00 Кліпи.» · next «» · clock «07:19» · shown true | PASS |
| U0.banner==row | Украина · 366 Viva Latino | menu «Кліпи.» · banner «05:00⁠–⁠13:00 Кліпи.» · API on air «Кліпи.» (fresh, 2660 ms after the banner, 0 ended in it) | PASS |
| U0.next | Украина · 366 Viva Latino | guide next «Кліпи.» · banner «» | DRY-SKIP |
| U0.first-frame | Украина · 366 Viva Latino | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Украина · 366 Viva Latino | no picture in dry mode | DRY-SKIP |
| U0.rows | Национальные | 62/62 rows seen · empty 0 · not on air 3 (3 of them < 60 s after the show changed) · no API programme 0 · reference: 5 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 4277 ms after each page read, ended shows in it ≤ 0 · 0 rows differed from the list API but matched the channel's guide · 39 TV3 Life (Латвия): «Šefu gaidījāt? 6» ≠ on air «Safīrs» (guide: «Safīrs») · changed 8 s before the read \| 52 Armenia Premium 1: «Հ/Ս "Վարդերով տունը ս35"» ≠ on air «Հ/Ս "Գոյամարտ ս192"» (guide: «Հ/Ս "Գոյամարտ ս192"») · changed 13 s before the read \| 56 Раі: «Новини Прикарпаття.» ≠ on air «Міжнародні новини.» (guide: «Міжнародні новини.») · changed 13 s before the read | FAIL |
| U0.banner-fields | Национальные · 1 Channel 9 (Израиль) | num «1» · title «Channel 9 (Израиль)» · now «07:20⁠–⁠08:05 Т/с "Невидимки". "Змея и чучело".» · next «Далее 08:05 "День".» · clock «07:20» · shown true | PASS |
| U0.banner==row | Национальные · 1 Channel 9 (Израиль) | menu «Т/с "Невидимки". "Змея и чучело".» · banner «07:20⁠–⁠08:05 Т/с "Невидимки". "Змея и чучело".» · API on air «Т/с "Невидимки". "Змея и чучело".» (fresh, 2632 ms after the banner, 0 ended in it) | PASS |
| U0.next | Национальные · 1 Channel 9 (Израиль) | guide next «"День".» · banner «Далее 08:05 "День".» | PASS |
| U0.first-frame | Национальные · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Национальные · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Национальные · 31 Астана ТВ (Казахстан) | num «31» · title «Астана ТВ (Казахстан)» · now «06:25⁠–⁠07:30 Үздік әзілдер» · next «» · clock «07:20» · shown true | PASS |
| U0.banner==row | Национальные · 31 Астана ТВ (Казахстан) | menu «Үздік әзілдер» · banner «06:25⁠–⁠07:30 Үздік әзілдер» · API on air «Үздік әзілдер» (fresh, 2595 ms after the banner, 0 ended in it) | PASS |
| U0.next | Национальные · 31 Астана ТВ (Казахстан) | guide next «Художественный фильм» · banner «» | DRY-SKIP |
| U0.first-frame | Национальные · 31 Астана ТВ (Казахстан) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Национальные · 31 Астана ТВ (Казахстан) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Национальные · 62 Армія TV | num «62» · title «Армія TV» · now «07:00⁠–⁠07:31 Клон гвинтівки для війни в Іраку MK18 MOD-0 \|\|» · next «» · clock «07:20» · shown true | PASS |
| U0.banner==row | Национальные · 62 Армія TV | menu «Клон гвинтівки для війни в Іраку MK18 MOD-0 \|\| Американський» · banner «07:00⁠–⁠07:31 Клон гвинтівки для війни в Іраку MK18 MOD-0 \|\|» · API on air «Клон гвинтівки для війни в Іраку MK18 MOD-0 \|\| Американський бунтар.» (fresh, 2366 ms after the banner, 0 ended in it) | PASS |
| U0.next | Национальные · 62 Армія TV | guide next «—» · banner «» | DRY-SKIP |
| U0.first-frame | Национальные · 62 Армія TV | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Национальные · 62 Армія TV | no picture in dry mode | DRY-SKIP |
| U0.rows | Новостные | 11/11 rows seen · empty 0 · not on air 0 (0 of them < 60 s after the show changed) · no API programme 0 · reference: 1 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 3533 ms after each page read, ended shows in it ≤ 0 · 0 rows differed from the list API but matched the channel's guide | PASS |
| U0.banner-fields | Новостные · 63 Deutsche Welle | num «63» · title «Deutsche Welle» · now «07:02⁠–⁠07:30 DocFilm. The Doctors of the Aegean.» · next «» · clock «07:20» · shown true | PASS |
| U0.banner==row | Новостные · 63 Deutsche Welle | menu «DocFilm. The Doctors of the Aegean.» · banner «07:02⁠–⁠07:30 DocFilm. The Doctors of the Aegean.» · API on air «DocFilm. The Doctors of the Aegean.» (fresh, 2672 ms after the banner, 0 ended in it) | PASS |
| U0.next | Новостные · 63 Deutsche Welle | guide next «Tomorrow Today. Who was the shaman of Bad Durrenberg?» · banner «» | DRY-SKIP |
| U0.first-frame | Новостные · 63 Deutsche Welle | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Новостные · 63 Deutsche Welle | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Новостные · 68 FreeДОМ | num «68» · title «FreeДОМ» · now «07:00⁠–⁠07:31 Наш час.» · next «» · clock «07:20» · shown true | PASS |
| U0.banner==row | Новостные · 68 FreeДОМ | menu «Наш час.» · banner «07:00⁠–⁠07:31 Наш час.» · API on air «Наш час.» (fresh, 3420 ms after the banner, 0 ended in it) | PASS |
| U0.next | Новостные · 68 FreeДОМ | guide next «Кремль продає ілюзію: російського дизеля вистачить США менш ніж на 2 години.» · banner «» | DRY-SKIP |
| U0.first-frame | Новостные · 68 FreeДОМ | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Новостные · 68 FreeДОМ | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Новостные · 73 Новини Live | num «73» · title «Новини Live» · now «07:00⁠–⁠08:00 Нет данных» · next «» · clock «07:21» · shown true | PASS |
| U0.banner==row | Новостные · 73 Новини Live | menu «Нет данных» · banner «07:00⁠–⁠08:00 Нет данных» · API on air «Нет данных» (fresh, 2608 ms after the banner, 0 ended in it) | PASS |
| U0.next | Новостные · 73 Новини Live | guide next «—» · banner «» | DRY-SKIP |
| U0.first-frame | Новостные · 73 Новини Live | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Новостные · 73 Новини Live | no picture in dry mode | DRY-SKIP |
| U0.rows | Познавательные | 64/64 rows seen · empty 0 · not on air 3 (3 of them < 60 s after the show changed) · no API programme 0 · reference: 6 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 2798 ms after each page read, ended shows in it ≤ 0 · 0 rows differed from the list API but matched the channel's guide · 82 Терра: «Світовий тур, 1 сезон, 2 еп.» ≠ on air «Двоколісні хроніки, 56 еп.» (guide: «Двоколісні хроніки, 56 еп.») · changed 18 s before the read \| 85 Фронт: «93 ОМБр – Chameleon Team: 18-24 роки – вік контракту» ≠ on air «Події ┊ 7» (guide: «Події ┊ 7») · changed 18 s before the read \| 121 Диалоги о рыбалке: «Народный проект. Астрахань. Ирина из Москвы снова с нами в лодке.» ≠ on air «Народный проект. Беларусь. Алексей Мурашко ловит лещей на диком осеннем озере.» (guide: «Народный проект. Беларусь. Алексей Мурашко ловит лещей на диком осеннем озере.») · changed 28 s before the read | FAIL |
| U0.banner-fields | Познавательные · 74 National Geographic | num «74» · title «National Geographic» · now «06:50⁠–⁠07:35 д/с Настоящий суперкар (Транспортер Lamborghin» · next «» · clock «07:21» · shown true | PASS |
| U0.banner==row | Познавательные · 74 National Geographic | menu «д/с Настоящий суперкар (Транспортер Lamborghini)» · banner «06:50⁠–⁠07:35 д/с Настоящий суперкар (Транспортер Lamborghin» · API on air «д/с Настоящий суперкар (Транспортер Lamborghini)» (fresh, 2363 ms after the banner, 0 ended in it) | PASS |
| U0.next | Познавательные · 74 National Geographic | guide next «д/с Настоящий суперкар (Maserati для гонки Le Man)» · banner «» | DRY-SKIP |
| U0.first-frame | Познавательные · 74 National Geographic | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Познавательные · 74 National Geographic | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Познавательные · 105 Discovery | num «105» · title «Discovery» · now «07:00⁠–⁠08:00 Гаражный ремонт, 9 с. Скоростной авторемонт» · next «» · clock «07:21» · shown true | PASS |
| U0.banner==row | Познавательные · 105 Discovery | menu «Гаражный ремонт, 9 с. Скоростной авторемонт» · banner «07:00⁠–⁠08:00 Гаражный ремонт, 9 с. Скоростной авторемонт» · API on air «Гаражный ремонт, 9 с. Скоростной авторемонт» (fresh, 2433 ms after the banner, 0 ended in it) | PASS |
| U0.next | Познавательные · 105 Discovery | guide next «Гаражный ремонт, 11 с. Zurba Industries» · banner «» | DRY-SKIP |
| U0.first-frame | Познавательные · 105 Discovery | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Познавательные · 105 Discovery | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Познавательные · 137 ЗооСвіт | num «137» · title «ЗооСвіт» · now «06:54⁠–⁠07:26 Знайомство з дикою природою. Африканські слони» · next «» · clock «07:22» · shown true | PASS |
| U0.banner==row | Познавательные · 137 ЗооСвіт | menu «Знайомство з дикою природою. Африканські слони.» · banner «06:54⁠–⁠07:26 Знайомство з дикою природою. Африканські слони» · API on air «Знайомство з дикою природою. Африканські слони.» (fresh, 3303 ms after the banner, 0 ended in it) | PASS |
| U0.next | Познавательные · 137 ЗооСвіт | guide next «—» · banner «» | DRY-SKIP |
| U0.first-frame | Познавательные · 137 ЗооСвіт | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Познавательные · 137 ЗооСвіт | no picture in dry mode | DRY-SKIP |
| U0.rows | Кино | 95/95 rows seen · empty 0 · not on air 1 (1 of them < 60 s after the show changed) · no API programme 0 · reference: 8 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 3609 ms after each page read, ended shows in it ≤ 1 · 0 rows differed from the list API but matched the channel's guide · 164 Fresh Family: «Человек из ниоткуда» ≠ on air «Чудеса случаются» (guide: «Чудеса случаются») · changed 3 s before the read | FAIL |
| U0.banner-fields | Кино · 138 KinoKazka | num «138» · title «KinoKazka» · now «07:15⁠–⁠08:30 м/ф Пираты опасного моря: Капитан Клык» · next «» · clock «07:22» · shown true | PASS |
| U0.banner==row | Кино · 138 KinoKazka | menu «м/ф Пираты опасного моря: Капитан Клык» · banner «07:15⁠–⁠08:30 м/ф Пираты опасного моря: Капитан Клык» · API on air «м/ф Пираты опасного моря: Капитан Клык» (fresh, 2460 ms after the banner, 0 ended in it) | PASS |
| U0.next | Кино · 138 KinoKazka | guide next «х/ф Как не жениться на принцессе» · banner «» | DRY-SKIP |
| U0.first-frame | Кино · 138 KinoKazka | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Кино · 138 KinoKazka | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Кино · 185 Cineman MiniSeries | num «185» · title «Cineman MiniSeries» · now «06:40⁠–⁠07:34 Молодой Папа 1 сезон 4 серия» · next «» · clock «07:22» · shown true | PASS |
| U0.banner==row | Кино · 185 Cineman MiniSeries | menu «Молодой Папа 1 сезон 4 серия» · banner «06:40⁠–⁠07:34 Молодой Папа 1 сезон 4 серия» · API on air «Молодой Папа 1 сезон 4 серия» (fresh, 2661 ms after the banner, 0 ended in it) | PASS |
| U0.next | Кино · 185 Cineman MiniSeries | guide next «Молодой Папа 1 сезон 5 серия» · banner «» | DRY-SKIP |
| U0.first-frame | Кино · 185 Cineman MiniSeries | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Кино · 185 Cineman MiniSeries | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Кино · 232 BCU | num «232» · title «BCU» · now «07:00⁠–⁠08:00 Нет данных» · next «» · clock «07:22» · shown true | PASS |
| U0.banner==row | Кино · 232 BCU | menu «Нет данных» · banner «07:00⁠–⁠08:00 Нет данных» · API on air «Нет данных» (fresh, 2830 ms after the banner, 0 ended in it) | PASS |
| U0.next | Кино · 232 BCU | guide next «—» · banner «» | DRY-SKIP |
| U0.first-frame | Кино · 232 BCU | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Кино · 232 BCU | no picture in dry mode | DRY-SKIP |
| U0.rows | Детские | 22/22 rows seen · empty 0 · not on air 0 (0 of them < 60 s after the show changed) · no API programme 0 · reference: 2 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 3310 ms after each page read, ended shows in it ≤ 0 · 0 rows differed from the list API but matched the channel's guide | PASS |
| U0.banner-fields | Детские · 233 Nick Jr | num «233» · title «Nick Jr» · now «07:00⁠–⁠07:25 М/с "Тим Рекс в космосе", 2 сезон, 3 с. "Пляжн» · next «» · clock «07:23» · shown true | PASS |
| U0.banner==row | Детские · 233 Nick Jr | menu «М/с "Тим Рекс в космосе", 2 сезон, 3 с. "Пляжный сканнер / У» · banner «07:00⁠–⁠07:25 М/с "Тим Рекс в космосе", 2 сезон, 3 с. "Пляжн» · API on air «М/с "Тим Рекс в космосе", 2 сезон, 3 с. "Пляжный сканнер / Уборка / Питмоцы".» (fresh, 2572 ms after the banner, 0 ended in it) | PASS |
| U0.next | Детские · 233 Nick Jr | guide next «М/с "Тим Рекс в космосе", 2 сезон, 6 с. "Путешествие / Билеты / Шоу талантов".» · banner «» | DRY-SKIP |
| U0.first-frame | Детские · 233 Nick Jr | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Детские · 233 Nick Jr | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Детские · 243 В гостях у сказки | num «243» · title «В гостях у сказки» · now «07:15⁠–⁠07:30 М/ф "Лиса Патрикеевна".» · next «» · clock «07:23» · shown true | PASS |
| U0.banner==row | Детские · 243 В гостях у сказки | menu «М/ф "Лиса Патрикеевна".» · banner «07:15⁠–⁠07:30 М/ф "Лиса Патрикеевна".» · API on air «М/ф "Лиса Патрикеевна".» (fresh, 2471 ms after the banner, 0 ended in it) | PASS |
| U0.next | Детские · 243 В гостях у сказки | guide next «М/ф "Ох и Ах".» · banner «» | DRY-SKIP |
| U0.first-frame | Детские · 243 В гостях у сказки | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Детские · 243 В гостях у сказки | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Детские · 254 Nickelodeon | num «254» · title «Nickelodeon» · now «07:22⁠–⁠07:43 Шоу Патрика Стара» · next «» · clock «07:23» · shown true | PASS |
| U0.banner==row | Детские · 254 Nickelodeon | menu «Шоу Патрика Стара» · banner «07:22⁠–⁠07:43 Шоу Патрика Стара» · API on air «Шоу Патрика Стара» (fresh, 2729 ms after the banner, 0 ended in it) | PASS |
| U0.next | Детские · 254 Nickelodeon | guide next «Шоу Патрика Стара» · banner «» | DRY-SKIP |
| U0.first-frame | Детские · 254 Nickelodeon | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Детские · 254 Nickelodeon | no picture in dry mode | DRY-SKIP |
| U0.rows | Спорт | 41/41 rows seen · empty 0 · not on air 0 (0 of them < 60 s after the show changed) · no API programme 0 · reference: 4 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 2954 ms after each page read, ended shows in it ≤ 0 · 0 rows differed from the list API but matched the channel's guide | PASS |
| U0.banner-fields | Спорт · 255 Setanta Sports UA | num «255» · title «Setanta Sports UA» · now «07:00⁠–⁠09:00 Футбол. Чемпионат Германии. РБ Лейпциг - Эльфе» · next «» · clock «07:23» · shown true | PASS |
| U0.banner==row | Спорт · 255 Setanta Sports UA | menu «Футбол. Чемпионат Германии. РБ Лейпциг - Эльферсберг.» · banner «07:00⁠–⁠09:00 Футбол. Чемпионат Германии. РБ Лейпциг - Эльфе» · API on air «Футбол. Чемпионат Германии. РБ Лейпциг - Эльферсберг.» (fresh, 2725 ms after the banner, 0 ended in it) | PASS |
| U0.next | Спорт · 255 Setanta Sports UA | guide next «Футбол. Чемпионат Германии. Боруссия Дортмунд - Айнтрахт Франкфурт.» · banner «» | DRY-SKIP |
| U0.first-frame | Спорт · 255 Setanta Sports UA | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Спорт · 255 Setanta Sports UA | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Спорт · 275 KHL ТВ | num «275» · title «KHL ТВ» · now «07:20⁠–⁠07:25 "Видео дня".» · next «» · clock «07:24» · shown true | PASS |
| U0.banner==row | Спорт · 275 KHL ТВ | menu «"Видео дня".» · banner «07:20⁠–⁠07:25 "Видео дня".» · API on air «"Видео дня".» (fresh, 3874 ms after the banner, 0 ended in it) | PASS |
| U0.next | Спорт · 275 KHL ТВ | guide next «"Подробно".» · banner «» | DRY-SKIP |
| U0.first-frame | Спорт · 275 KHL ТВ | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Спорт · 275 KHL ТВ | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Спорт · 295 ОККО Прайм Спорт | num «295» · title «ОККО Прайм Спорт» · now «04:20⁠–⁠08:00 Футбол. Франция. 1–4 c» · next «» · clock «07:24» · shown true | PASS |
| U0.banner==row | Спорт · 295 ОККО Прайм Спорт | menu «Футбол. Франция. 1–4 c» · banner «04:20⁠–⁠08:00 Футбол. Франция. 1–4 c» · API on air «Футбол. Франция. 1–4 c» (fresh, 2560 ms after the banner, 0 ended in it) | PASS |
| U0.next | Спорт · 295 ОККО Прайм Спорт | guide next «Новости спорта» · banner «» | DRY-SKIP |
| U0.first-frame | Спорт · 295 ОККО Прайм Спорт | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Спорт · 295 ОККО Прайм Спорт | no picture in dry mode | DRY-SKIP |
| U0.rows | Развлекательные | 52/52 rows seen · empty 0 · not on air 0 (0 of them < 60 s after the show changed) · no API programme 0 · reference: 5 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 2654 ms after each page read, ended shows in it ≤ 1 · 0 rows differed from the list API but matched the channel's guide | PASS |
| U0.banner-fields | Развлекательные · 296 Fashion ONE | num «296» · title «Fashion ONE» · now «07:10⁠–⁠07:44 Yanina. Лучшее. 2-я серия (12+)» · next «» · clock «07:24» · shown true | PASS |
| U0.banner==row | Развлекательные · 296 Fashion ONE | menu «Yanina. Лучшее. 2-я серия (12+)» · banner «07:10⁠–⁠07:44 Yanina. Лучшее. 2-я серия (12+)» · API on air «Yanina. Лучшее. 2-я серия (12+)» (fresh, 2632 ms after the banner, 0 ended in it) | PASS |
| U0.next | Развлекательные · 296 Fashion ONE | guide next «Alex Voronoy. 4-я серия (12+)» · banner «» | DRY-SKIP |
| U0.first-frame | Развлекательные · 296 Fashion ONE | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Развлекательные · 296 Fashion ONE | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Развлекательные · 321 Панянка-селянка+ | num «321» · title «Панянка-селянка+» · now «07:00⁠–⁠08:00 Програма відсутня» · next «» · clock «07:24» · shown true | PASS |
| U0.banner==row | Развлекательные · 321 Панянка-селянка+ | menu «Програма відсутня» · banner «07:00⁠–⁠08:00 Програма відсутня» · API on air «Програма відсутня» (fresh, 2491 ms after the banner, 0 ended in it) | PASS |
| U0.next | Развлекательные · 321 Панянка-селянка+ | guide next «Програма відсутня» · banner «» | DRY-SKIP |
| U0.first-frame | Развлекательные · 321 Панянка-селянка+ | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Развлекательные · 321 Панянка-селянка+ | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Развлекательные · 347 Ми - Україна | num «347» · title «Ми - Україна» · now «07:00⁠–⁠08:00 "Єдині новини". Телемарафон.» · next «» · clock «07:24» · shown true | PASS |
| U0.banner==row | Развлекательные · 347 Ми - Україна | menu «"Єдині новини". Телемарафон.» · banner «07:00⁠–⁠08:00 "Єдині новини". Телемарафон.» · API on air «"Єдині новини". Телемарафон.» (fresh, 4681 ms after the banner, 0 ended in it) | PASS |
| U0.next | Развлекательные · 347 Ми - Україна | guide next «"Єдині новини". Телемарафон.» · banner «» | DRY-SKIP |
| U0.first-frame | Развлекательные · 347 Ми - Україна | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Развлекательные · 347 Ми - Україна | no picture in dry mode | DRY-SKIP |
| U0.rows | Музыкальные | 25/25 rows seen · empty 0 · not on air 1 (1 of them < 60 s after the show changed) · no API programme 0 · reference: 2 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 3756 ms after each page read, ended shows in it ≤ 0 · 0 rows differed from the list API but matched the channel's guide · 354 Муз ТВ: «Хиты по-русски.» ≠ on air «PRO-новости. Лучшее.» (guide: «PRO-новости. Лучшее.») · changed 6 s before the read | FAIL |
| U0.banner-fields | Музыкальные · 348 Stingray iConcerts | num «348» · title «Stingray iConcerts» · now «07:00⁠–⁠08:52 Take That: Wonderland Live from The O2 Arena, » · next «» · clock «07:25» · shown true | PASS |
| U0.banner==row | Музыкальные · 348 Stingray iConcerts | menu «Take That: Wonderland Live from The O2 Arena, London. 2017.» · banner «07:00⁠–⁠08:52 Take That: Wonderland Live from The O2 Arena, » · API on air «Take That: Wonderland Live from The O2 Arena, London. 2017.» (fresh, 2899 ms after the banner, 0 ended in it) | PASS |
| U0.next | Музыкальные · 348 Stingray iConcerts | guide next «Various: From Mambo to Hip Hop. 2009.» · banner «» | DRY-SKIP |
| U0.first-frame | Музыкальные · 348 Stingray iConcerts | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Музыкальные · 348 Stingray iConcerts | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Музыкальные · 360 4ever Music | num «360» · title «4ever Music» · now «05:00⁠–⁠13:00 Хіти минулих років.» · next «» · clock «07:25» · shown true | PASS |
| U0.banner==row | Музыкальные · 360 4ever Music | menu «Хіти минулих років.» · banner «05:00⁠–⁠13:00 Хіти минулих років.» · API on air «Хіти минулих років.» (fresh, 2849 ms after the banner, 0 ended in it) | PASS |
| U0.next | Музыкальные · 360 4ever Music | guide next «Хіти минулих років.» · banner «» | DRY-SKIP |
| U0.first-frame | Музыкальные · 360 4ever Music | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Музыкальные · 360 4ever Music | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Музыкальные · 372 Жара | num «372» · title «Жара» · now «07:15⁠–⁠08:00 Музыкальный блок» · next «» · clock «07:25» · shown true | PASS |
| U0.banner==row | Музыкальные · 372 Жара | menu «Музыкальный блок» · banner «07:15⁠–⁠08:00 Музыкальный блок» · API on air «Музыкальный блок» (fresh, 2643 ms after the banner, 0 ended in it) | PASS |
| U0.next | Музыкальные · 372 Жара | guide next «Сквозь время» · banner «» | DRY-SKIP |
| U0.first-frame | Музыкальные · 372 Жара | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Музыкальные · 372 Жара | no picture in dry mode | DRY-SKIP |
| M2.open-on-playing | 372 Жара | cursor on 372 Жара  ▶ · playing marker true | PASS |
| M4.cursor-on-air | 372 Жара | 07:15 «Музыкальный блок» в эфире · API «Музыкальный блок» | PASS |
| M4.day-back | 372 Жара | Жара — Вчера | PASS |
| M4.past-plays | 372 Жара | «Жара новости» → mode archive · banner «Жара · Архив · 07:00» · dry | PASS |
| M4.after-midnight (P8) | 352 Inrating | on air «Кліпи.» (started before 00:00) · panel «Inrating — Сегодня» cursor 22:40 «Кліпи.» в эфире | PASS |
| M5.scrub-back | 352 Inrating | knob 07:23:07 · position 07:23:07 · dry | PASS |
| M5.7-day-edge (D1) | 352 Inrating | knob 08:38:08 · mode archive · no picture in dry mode | DRY-SKIP |
| M5.to-live | 352 Inrating | knob прямой эфир · mode live | PASS |
| M7.single | 353 Музвар | no picture in dry mode | DRY-SKIP |
| M7.single | 354 Муз ТВ | no picture in dry mode | DRY-SKIP |
| M7.single | 355 Bridge deluxe | no picture in dry mode | DRY-SKIP |
| M7.burst | from 355 Bridge deluxe | landed 365 Black (expected 365 Black) · 2 app requests | PASS |
| M8.paused | 365 Black | mode paused · 0 requests in 10 s | PASS |
| M8.resume-in-place | 365 Black | paused at 07:30:24 · resumed at 07:30:24 (archive) | DRY-SKIP |
| M9.live | 365 Black · simulated hide | live → live · position 07:30:38 → 07:30:42 · dry | PASS |
| M9.archive | 365 Black · simulated hide | archive → archive · position 07:27:42 → 07:27:42 · dry | PASS |
| M6.continuation (D2) | — | no picture in dry mode | DRY-SKIP |
| C2.archive-1d | 197 Viju+ Megahit | «La migliore offerta» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-3d | 197 Viju+ Megahit | «8 femmes» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-1d | 215 Кинокомедия | «х/ф Нереальная любовь» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-3d | 215 Кинокомедия | «х/ф Телохранитель на фрилансе» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-1d | 194 sci-fi | «Х/ф "Малышка на драйве".» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-3d | 194 sci-fi | «Х/ф "Взрывная блондинка".» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-1d | 228 Kinoliving | «х/ф Свистуны» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-3d | 228 Kinoliving | «т/с Пайрэт Бэй ┊ 5» · mode archive · no picture in dry mode | DRY-SKIP |
| M10.soak | — | no picture in dry mode | DRY-SKIP |
| M11.menu-open | 30 min | 359 row checks · 4 not on air (3 of them < 60 s after the show changed) · 0 resolved by the guide · reference fresh, ≤ 9982 ms after each read, ended shows in it ≤ 24 · 0 minutes without a usable reference · +8 min 223 Блокбастер: «х/ф Иллюзия обмана 2» ≠ «х/ф Красивый, плохой, злой» (guide «х/ф Красивый, плохой, злой») · 27 s \| +8 min 224 Мосфильм. Золотая коллекция: «Х/ф "Трест, который лопнул".» ≠ «М/с "Весёлая карусель", 1 с.» (guide «М/с "Весёлая карусель", 1 с.») · 27 s \| +9 min 230 Наше любимое кино: «Планета Кіно ┊ 48» ≠ «х/ф 14 клинків» (guide «х/ф 14 клинків») · 31 s \| +18 min 233 Nick Jr: «М/с "Тим Рекс в космосе", 2 сезон, 6 с. "Путешествие / Билеты / Шоу талантов".» ≠ «М/с "Крепыш и команда", 1 сезон, 25 с. "Команда строит автоматическую парковку / Команда строит кемпинг".» (guide «М/с "Крепыш и команда", 1 сезон, 25 с. "Команда строит автоматическую парковку / Команда строит кемпинг".») · 61 s | FAIL |
| M11·U0.rows | Все каналы | 372/372 rows seen · empty 0 · not on air 6 (6 of them < 60 s after the show changed) · no API programme 1 · reference: 30 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 5520 ms after each page read, ended shows in it ≤ 20 · 0 rows differed from the list API but matched the channel's guide · 82 Терра: «Кулінарна подорож Європою, 13 еп.» ≠ on air «Виходячи за межі, 8 еп.» (guide: «Виходячи за межі, 8 еп.») · changed 17 s before the read \| 276 Матч ТВ: «Новости.» ≠ on air «Специальный репортаж.» (guide: «Специальный репортаж.») · changed 12 s before the read \| 298 Новий канал: «М/ф "Посіпаки: Становлення лиходія".» ≠ on air «Кохання на виживання, 5 сезон, 5 еп.» (guide: «Кохання на виживання, 5 сезон, 5 еп.») · changed 16 s before the read \| 303 Суспільне Культура: «д/с Остання війна ┊ 6 Українське прокляття: будівничі й руйнівники імперії» ≠ on air «т/с Злочин у раю 7 ┊ 5» (guide: «т/с Злочин у раю 7 ┊ 5») · changed 19 s before the read \| 307 Кус-кус: «НеКотлетка, 19 еп.» ≠ on air «Море Ом Ном, 2 еп.» (guide: «Море Ом Ном, 2 еп.») · changed 19 s before the read \| 309 36.6: «Новий день, 1 еп.» ≠ on air «Тактична медицина, 9 еп.» (guide: «Тактична медицина, 9 еп.») · changed 19 s before the read | FAIL |
| app-errors | — | failure log lines: 40 | INFO |

#### Run f7ccc45 (U0 … M10; its M11 ended in a runner error) — 2026-10-26 08:05 (local) — DRY (desktop, headless Chrome, no picture) · tree /private/tmp/claude-501/-Users-yaroslavr/40bd8e7a-b591-426c-be3d-f3bef355966b/scratchpad/frozen-f7ccc45 · cases U0,M2,M4,M5,M7,M8,M9,M6,C2,M10,M11

PASS 89 · FAIL 3 · DRY-SKIP 111 · NOT-RUN 0

| Case | Channel / group | Measured | Result |
|---|---|---|---|
| U0.rows | Все каналы | sweep 08:05:50, menu closed 1 s before · 372/372 rows seen · empty 0 · not on air 5 (2 of them < 60 s after the show changed) · no API programme 1 · reference: 30 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 6579 ms after each page read, ended shows in it ≤ 1 · 0 rows differed from the list API but matched the channel's guide · 1 Channel 9 (Израиль) ▶: «Т/с "Невидимки". "Змея и чучело".» ≠ on air «"День".» (guide: «"День".») · changed 52 s before the read \| 2 Channel 11 (Израиль): «הבוקר הזה - עם אריה גולן» ≠ on air «קלמן ליברמן» (guide: «קלמן ליברמן») · changed 352 s before the read \| 6 Channel 24 (Израиль): «בוקר ישראלי» ≠ on air «ד""ש עם שיר - מהחזית» (guide: «ד""ש עם שיר - מהחזית») · changed 352 s before the read \| 10 i24 (Израиль): «מדד גלבוע» ≠ on air «חדר החדשות» (guide: «חדר החדשות») · changed 352 s before the read \| 126 Масон: «Життя, Всесвіт і все на світі. У чому таємниця світла?» ≠ on air «Елементи. Кремній. Фтор. Літій. Бор. Хром.» (guide: «—») · changed 25 s before the read | FAIL |
| U0.banner-fields | Все каналы · 1 Channel 9 (Израиль) | num «1» · title «Channel 9 (Израиль)» · now «08:05⁠–⁠08:30 "День".» · next «Далее 08:30 "Выборы".» · clock «08:07» · shown true | PASS |
| U0.banner==row | Все каналы · 1 Channel 9 (Израиль) | menu «"День".» · banner «08:05⁠–⁠08:30 "День".» · API on air «"День".» (fresh, 2728 ms after the banner, 0 ended in it) | PASS |
| U0.next | Все каналы · 1 Channel 9 (Израиль) | guide next «"Выборы".» · banner «Далее 08:30 "Выборы".» | PASS |
| U0.first-frame | Все каналы · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Все каналы · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Все каналы · 186 Кинохит | num «186» · title «Кинохит» · now «07:35⁠–⁠09:20 Х/ф "Новая Земля".» · next «» · clock «08:07» · shown true | PASS |
| U0.banner==row | Все каналы · 186 Кинохит | menu «Х/ф "Новая Земля".» · banner «07:35⁠–⁠09:20 Х/ф "Новая Земля".» · API on air «Х/ф "Новая Земля".» (fresh, 2750 ms after the banner, 0 ended in it) | PASS |
| U0.next | Все каналы · 186 Кинохит | guide next «Х/ф "Рейс навылет".» · banner «» | DRY-SKIP |
| U0.first-frame | Все каналы · 186 Кинохит | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Все каналы · 186 Кинохит | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Все каналы · 372 Жара | num «372» · title «Жара» · now «08:00⁠–⁠08:10 Сквозь время» · next «» · clock «08:08» · shown true | PASS |
| U0.banner==row | Все каналы · 372 Жара | menu «Сквозь время» · banner «08:00⁠–⁠08:10 Сквозь время» · API on air «Сквозь время» (fresh, 3170 ms after the banner, 0 ended in it) | PASS |
| U0.next | Все каналы · 372 Жара | guide next «Музыкальный блок» · banner «» | DRY-SKIP |
| U0.first-frame | Все каналы · 372 Жара | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Все каналы · 372 Жара | no picture in dry mode | DRY-SKIP |
| U0.rows | Израиль | sweep 08:08:11, menu closed 5 s before · 18/18 rows seen · empty 0 · not on air 0 (0 of them < 60 s after the show changed) · no API programme 0 · reference: 2 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 2590 ms after each page read, ended shows in it ≤ 0 · 0 rows differed from the list API but matched the channel's guide | PASS |
| U0.banner-fields | Израиль · 1 Channel 9 (Израиль) | num «1» · title «Channel 9 (Израиль)» · now «08:05⁠–⁠08:30 "День".» · next «Далее 08:30 "Выборы".» · clock «08:08» · shown true | PASS |
| U0.banner==row | Израиль · 1 Channel 9 (Израиль) | menu «"День".» · banner «08:05⁠–⁠08:30 "День".» · API on air «"День".» (fresh, 2526 ms after the banner, 0 ended in it) | PASS |
| U0.next | Израиль · 1 Channel 9 (Израиль) | guide next «"Выборы".» · banner «Далее 08:30 "Выборы".» | PASS |
| U0.first-frame | Израиль · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Израиль · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Израиль · 9 HOP! (Израиль) | num «9» · title «HOP! (Израиль)» · now «07:30⁠–⁠10:00 קוקוריקו» · next «» · clock «08:08» · shown true | PASS |
| U0.banner==row | Израиль · 9 HOP! (Израиль) | menu «קוקוריקו» · banner «07:30⁠–⁠10:00 קוקוריקו» · API on air «קוקוריקו» (fresh, 2670 ms after the banner, 0 ended in it) | PASS |
| U0.next | Израиль · 9 HOP! (Израиль) | guide next «יוצרי המופת שלנו» · banner «» | DRY-SKIP |
| U0.first-frame | Израиль · 9 HOP! (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Израиль · 9 HOP! (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Израиль · 18 HOT HBO (Израиль) | num «18» · title «HOT HBO (Израиль)» · now «04:40⁠–⁠08:40 נשוב לשדר ב-09:40» · next «» · clock «08:08» · shown true | PASS |
| U0.banner==row | Израиль · 18 HOT HBO (Израиль) | menu «נשוב לשדר ב-09:40» · banner «04:40⁠–⁠08:40 נשוב לשדר ב-09:40» · API on air «נשוב לשדר ב-09:40» (fresh, 2616 ms after the banner, 0 ended in it) | PASS |
| U0.next | Израиль · 18 HOT HBO (Израиль) | guide next «1923» · banner «» | DRY-SKIP |
| U0.first-frame | Израиль · 18 HOT HBO (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Израиль · 18 HOT HBO (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.rows | Украина | sweep 08:08:44, menu closed 5 s before · 91/91 rows seen · empty 0 · not on air 0 (0 of them < 60 s after the show changed) · no API programme 1 · reference: 8 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 4060 ms after each page read, ended shows in it ≤ 0 · 0 rows differed from the list API but matched the channel's guide | PASS |
| U0.banner-fields | Украина · 19 Інтер | num «19» · title «Інтер» · now «08:00⁠–⁠09:00 "Єдині новини". Телемарафон.» · next «» · clock «08:09» · shown true | PASS |
| U0.banner==row | Украина · 19 Інтер | menu «"Єдині новини". Телемарафон.» · banner «08:00⁠–⁠09:00 "Єдині новини". Телемарафон.» · API on air «"Єдині новини". Телемарафон.» (fresh, 2501 ms after the banner, 1 ended in it) | PASS |
| U0.next | Украина · 19 Інтер | guide next «Загальнонаціональна хвилина мовчання.» · banner «» | DRY-SKIP |
| U0.first-frame | Украина · 19 Інтер | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Украина · 19 Інтер | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Украина · 250 Niki junior | num «250» · title «Niki junior» · now «08:07⁠–⁠08:18 М/с "Текс", 32 с. "Хмарка, що не хотіла дощити» · next «» · clock «08:09» · shown true | PASS |
| U0.banner==row | Украина · 250 Niki junior | menu «М/с "Текс", 32 с. "Хмарка, що не хотіла дощити".» · banner «08:07⁠–⁠08:18 М/с "Текс", 32 с. "Хмарка, що не хотіла дощити» · API on air «М/с "Текс", 32 с. "Хмарка, що не хотіла дощити".» (fresh, 2820 ms after the banner, 0 ended in it) | PASS |
| U0.next | Украина · 250 Niki junior | guide next «М/с "Райдужні рейнджери", 19 с. "Непрошений гість".» · banner «» | DRY-SKIP |
| U0.first-frame | Украина · 250 Niki junior | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Украина · 250 Niki junior | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Украина · 366 Viva Latino | num «366» · title «Viva Latino» · now «05:00⁠–⁠13:00 Кліпи.» · next «» · clock «08:09» · shown true | PASS |
| U0.banner==row | Украина · 366 Viva Latino | menu «Кліпи.» · banner «05:00⁠–⁠13:00 Кліпи.» · API on air «Кліпи.» (fresh, 2714 ms after the banner, 0 ended in it) | PASS |
| U0.next | Украина · 366 Viva Latino | guide next «Кліпи.» · banner «» | DRY-SKIP |
| U0.first-frame | Украина · 366 Viva Latino | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Украина · 366 Viva Latino | no picture in dry mode | DRY-SKIP |
| U0.rows | Национальные | sweep 08:09:43, menu closed 5 s before · 62/62 rows seen · empty 0 · not on air 0 (0 of them < 60 s after the show changed) · no API programme 3 · reference: 5 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 3029 ms after each page read, ended shows in it ≤ 28 · 0 rows differed from the list API but matched the channel's guide | PASS |
| U0.banner-fields | Национальные · 1 Channel 9 (Израиль) | num «1» · title «Channel 9 (Израиль)» · now «08:05⁠–⁠08:30 "День".» · next «Далее 08:30 "Выборы".» · clock «08:10» · shown true | PASS |
| U0.banner==row | Национальные · 1 Channel 9 (Израиль) | menu «"День".» · banner «08:05⁠–⁠08:30 "День".» · API on air «"День".» (fresh, 4354 ms after the banner, 0 ended in it) | PASS |
| U0.next | Национальные · 1 Channel 9 (Израиль) | guide next «"Выборы".» · banner «Далее 08:30 "Выборы".» | PASS |
| U0.first-frame | Национальные · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Национальные · 1 Channel 9 (Израиль) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Национальные · 31 Астана ТВ (Казахстан) | num «31» · title «Астана ТВ (Казахстан)» · now «07:30⁠–⁠09:30 Художественный фильм» · next «» · clock «08:10» · shown true | PASS |
| U0.banner==row | Национальные · 31 Астана ТВ (Казахстан) | menu «Художественный фильм» · banner «07:30⁠–⁠09:30 Художественный фильм» · API on air «Художественный фильм» (fresh, 2605 ms after the banner, 1 ended in it) | PASS |
| U0.next | Национальные · 31 Астана ТВ (Казахстан) | guide next «Зу-зу Күлпәш» · banner «» | DRY-SKIP |
| U0.first-frame | Национальные · 31 Астана ТВ (Казахстан) | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Национальные · 31 Астана ТВ (Казахстан) | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Национальные · 62 Армія TV | num «62» · title «Армія TV» · now «08:00⁠–⁠08:14 UAR-15: будова та елементи керування \|\| Азов Н» · next «» · clock «08:10» · shown true | PASS |
| U0.banner==row | Национальные · 62 Армія TV | menu «UAR-15: будова та елементи керування \|\| Азов НГУ.» · banner «08:00⁠–⁠08:14 UAR-15: будова та елементи керування \|\| Азов Н» · API on air «UAR-15: будова та елементи керування \|\| Азов НГУ.» (fresh, 2602 ms after the banner, 0 ended in it) | PASS |
| U0.next | Национальные · 62 Армія TV | guide next «—» · banner «» | DRY-SKIP |
| U0.first-frame | Национальные · 62 Армія TV | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Национальные · 62 Армія TV | no picture in dry mode | DRY-SKIP |
| U0.rows | Новостные | sweep 08:10:29, menu closed 5 s before · 11/11 rows seen · empty 0 · not on air 0 (0 of them < 60 s after the show changed) · no API programme 0 · reference: 1 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 2764 ms after each page read, ended shows in it ≤ 0 · 0 rows differed from the list API but matched the channel's guide | PASS |
| U0.banner-fields | Новостные · 63 Deutsche Welle | num «63» · title «Deutsche Welle» · now «08:02⁠–⁠08:15 Sports Life. En Garde in Kenya - Fencing for a» · next «» · clock «08:10» · shown true | PASS |
| U0.banner==row | Новостные · 63 Deutsche Welle | menu «Sports Life. En Garde in Kenya - Fencing for a better life.» · banner «08:02⁠–⁠08:15 Sports Life. En Garde in Kenya - Fencing for a» · API on air «Sports Life. En Garde in Kenya - Fencing for a better life.» (fresh, 3620 ms after the banner, 0 ended in it) | PASS |
| U0.next | Новостные · 63 Deutsche Welle | guide next «Shift. Living in the Digital Age.» · banner «» | DRY-SKIP |
| U0.first-frame | Новостные · 63 Deutsche Welle | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Новостные · 63 Deutsche Welle | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Новостные · 68 FreeДОМ | num «68» · title «FreeДОМ» · now «08:10⁠–⁠10:00 Марафон "FreeДОМ" UA. Прямий ефір.» · next «» · clock «08:10» · shown true | PASS |
| U0.banner==row | Новостные · 68 FreeДОМ | menu «Марафон "FreeДОМ" UA. Прямий ефір.» · banner «08:10⁠–⁠10:00 Марафон "FreeДОМ" UA. Прямий ефір.» · API on air «Марафон "FreeДОМ" UA. Прямий ефір.» (fresh, 2465 ms after the banner, 0 ended in it) | PASS |
| U0.next | Новостные · 68 FreeДОМ | guide next «Наш час. Прямий ефір.» · banner «» | DRY-SKIP |
| U0.first-frame | Новостные · 68 FreeДОМ | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Новостные · 68 FreeДОМ | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Новостные · 73 Новини Live | num «73» · title «Новини Live» · now «08:00⁠–⁠09:00 Нет данных» · next «» · clock «08:10» · shown true | PASS |
| U0.banner==row | Новостные · 73 Новини Live | menu «Нет данных» · banner «08:00⁠–⁠09:00 Нет данных» · API on air «Нет данных» (fresh, 2702 ms after the banner, 4 ended in it) | PASS |
| U0.next | Новостные · 73 Новини Live | guide next «—» · banner «» | DRY-SKIP |
| U0.first-frame | Новостные · 73 Новини Live | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Новостные · 73 Новини Live | no picture in dry mode | DRY-SKIP |
| U0.rows | Познавательные | sweep 08:11:00, menu closed 5 s before · 64/64 rows seen · empty 0 · not on air 1 (1 of them < 60 s after the show changed) · no API programme 0 · reference: 6 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 3289 ms after each page read, ended shows in it ≤ 0 · 0 rows differed from the list API but matched the channel's guide · 114 Живая природа: «Пляж Харрис.» ≠ on air «Белое море.» (guide: «Белое море.») · changed 12 s before the read | FAIL |
| U0.banner-fields | Познавательные · 74 National Geographic | num «74» · title «National Geographic» · now «07:35⁠–⁠08:20 д/с Настоящий суперкар (Maserati для гонки Le » · next «» · clock «08:11» · shown true | PASS |
| U0.banner==row | Познавательные · 74 National Geographic | menu «д/с Настоящий суперкар (Maserati для гонки Le Man)» · banner «07:35⁠–⁠08:20 д/с Настоящий суперкар (Maserati для гонки Le » · API on air «д/с Настоящий суперкар (Maserati для гонки Le Man)» (fresh, 2616 ms after the banner, 0 ended in it) | PASS |
| U0.next | Познавательные · 74 National Geographic | guide next «д/с Расследование авиакатастроф: Спецвыпуск (Крайности севера)» · banner «» | DRY-SKIP |
| U0.first-frame | Познавательные · 74 National Geographic | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Познавательные · 74 National Geographic | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Познавательные · 105 Discovery | num «105» · title «Discovery» · now «08:00⁠–⁠09:00 Гаражный ремонт, 11 с. Zurba Industries» · next «» · clock «08:11» · shown true | PASS |
| U0.banner==row | Познавательные · 105 Discovery | menu «Гаражный ремонт, 11 с. Zurba Industries» · banner «08:00⁠–⁠09:00 Гаражный ремонт, 11 с. Zurba Industries» · API on air «Гаражный ремонт, 11 с. Zurba Industries» (fresh, 2572 ms after the banner, 0 ended in it) | PASS |
| U0.next | Познавательные · 105 Discovery | guide next «Как это устроено? 19 с-н 2 с. Оловянные фляжки / Картофельный салат / Топливные ячейки» · banner «» | DRY-SKIP |
| U0.first-frame | Познавательные · 105 Discovery | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Познавательные · 105 Discovery | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Познавательные · 137 ЗооСвіт | num «137» · title «ЗооСвіт» · now «07:55⁠–⁠08:27 Боротьба за виживання. Чорні какаду Західної А» · next «» · clock «08:11» · shown true | PASS |
| U0.banner==row | Познавательные · 137 ЗооСвіт | menu «Боротьба за виживання. Чорні какаду Західної Австралії.» · banner «07:55⁠–⁠08:27 Боротьба за виживання. Чорні какаду Західної А» · API on air «Боротьба за виживання. Чорні какаду Західної Австралії.» (fresh, 2576 ms after the banner, 0 ended in it) | PASS |
| U0.next | Познавательные · 137 ЗооСвіт | guide next «Світ дикої природи. Велика африканська савана.» · banner «» | DRY-SKIP |
| U0.first-frame | Познавательные · 137 ЗооСвіт | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Познавательные · 137 ЗооСвіт | no picture in dry mode | DRY-SKIP |
| U0.rows | Кино | sweep 08:11:49, menu closed 5 s before · 95/95 rows seen · empty 0 · not on air 0 (0 of them < 60 s after the show changed) · no API programme 0 · reference: 8 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 3209 ms after each page read, ended shows in it ≤ 2 · 0 rows differed from the list API but matched the channel's guide | PASS |
| U0.banner-fields | Кино · 138 KinoKazka | num «138» · title «KinoKazka» · now «07:15⁠–⁠08:30 м/ф Пираты опасного моря: Капитан Клык» · next «» · clock «08:12» · shown true | PASS |
| U0.banner==row | Кино · 138 KinoKazka | menu «м/ф Пираты опасного моря: Капитан Клык» · banner «07:15⁠–⁠08:30 м/ф Пираты опасного моря: Капитан Клык» · API on air «м/ф Пираты опасного моря: Капитан Клык» (fresh, 2497 ms after the banner, 0 ended in it) | PASS |
| U0.next | Кино · 138 KinoKazka | guide next «х/ф Как не жениться на принцессе» · banner «» | DRY-SKIP |
| U0.first-frame | Кино · 138 KinoKazka | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Кино · 138 KinoKazka | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Кино · 185 Cineman MiniSeries | num «185» · title «Cineman MiniSeries» · now «07:34⁠–⁠08:28 Молодой Папа 1 сезон 5 серия» · next «» · clock «08:12» · shown true | PASS |
| U0.banner==row | Кино · 185 Cineman MiniSeries | menu «Молодой Папа 1 сезон 5 серия» · banner «07:34⁠–⁠08:28 Молодой Папа 1 сезон 5 серия» · API on air «Молодой Папа 1 сезон 5 серия» (fresh, 2786 ms after the banner, 0 ended in it) | PASS |
| U0.next | Кино · 185 Cineman MiniSeries | guide next «Молодой Папа 1 сезон 6 серия» · banner «» | DRY-SKIP |
| U0.first-frame | Кино · 185 Cineman MiniSeries | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Кино · 185 Cineman MiniSeries | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Кино · 232 BCU | num «232» · title «BCU» · now «08:00⁠–⁠09:00 Нет данных» · next «» · clock «08:12» · shown true | PASS |
| U0.banner==row | Кино · 232 BCU | menu «Нет данных» · banner «08:00⁠–⁠09:00 Нет данных» · API on air «Нет данных» (fresh, 2460 ms after the banner, 0 ended in it) | PASS |
| U0.next | Кино · 232 BCU | guide next «—» · banner «» | DRY-SKIP |
| U0.first-frame | Кино · 232 BCU | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Кино · 232 BCU | no picture in dry mode | DRY-SKIP |
| U0.rows | Детские | sweep 08:12:44, menu closed 5 s before · 22/22 rows seen · empty 0 · not on air 0 (0 of them < 60 s after the show changed) · no API programme 0 · reference: 2 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 3042 ms after each page read, ended shows in it ≤ 0 · 0 rows differed from the list API but matched the channel's guide | PASS |
| U0.banner-fields | Детские · 233 Nick Jr | num «233» · title «Nick Jr» · now «08:10⁠–⁠08:35 М/с "Крепыш и команда", 4 сезон, 2 с. "Команда» · next «» · clock «08:12» · shown true | PASS |
| U0.banner==row | Детские · 233 Nick Jr | menu «М/с "Крепыш и команда", 4 сезон, 2 с. "Команда строит хэллоу» · banner «08:10⁠–⁠08:35 М/с "Крепыш и команда", 4 сезон, 2 с. "Команда» · API on air «М/с "Крепыш и команда", 4 сезон, 2 с. "Команда строит хэллоуинский лабиринт / Команда строит гигантский дом для щенков".» (fresh, 2923 ms after the banner, 0 ended in it) | PASS |
| U0.next | Детские · 233 Nick Jr | guide next «М/с "Щенячий патруль", 12 сезон, 9 с. "Щенки спасают ферму с привидениями / Щенки спасают Буги Бухты Приключений".» · banner «» | DRY-SKIP |
| U0.first-frame | Детские · 233 Nick Jr | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Детские · 233 Nick Jr | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Детские · 243 В гостях у сказки | num «243» · title «В гостях у сказки» · now «08:10⁠–⁠08:20 М/с "Смешарики", 164 с. "Эрудит".» · next «» · clock «08:13» · shown true | PASS |
| U0.banner==row | Детские · 243 В гостях у сказки | menu «М/с "Смешарики", 164 с. "Эрудит".» · banner «08:10⁠–⁠08:20 М/с "Смешарики", 164 с. "Эрудит".» · API on air «М/с "Смешарики", 164 с. "Эрудит".» (fresh, 3248 ms after the banner, 0 ended in it) | PASS |
| U0.next | Детские · 243 В гостях у сказки | guide next «М/с "Смешарики", 165 с. "Черно-белое кино".» · banner «» | DRY-SKIP |
| U0.first-frame | Детские · 243 В гостях у сказки | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Детские · 243 В гостях у сказки | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Детские · 254 Nickelodeon | num «254» · title «Nickelodeon» · now «07:55⁠–⁠08:18 Мой шумный дом» · next «» · clock «08:13» · shown true | PASS |
| U0.banner==row | Детские · 254 Nickelodeon | menu «Мой шумный дом» · banner «07:55⁠–⁠08:18 Мой шумный дом» · API on air «Мой шумный дом» (fresh, 2403 ms after the banner, 0 ended in it) | PASS |
| U0.next | Детские · 254 Nickelodeon | guide next «Мой шумный дом» · banner «» | DRY-SKIP |
| U0.first-frame | Детские · 254 Nickelodeon | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Детские · 254 Nickelodeon | no picture in dry mode | DRY-SKIP |
| U0.rows | Спорт | sweep 08:13:19, menu closed 4 s before · 41/41 rows seen · empty 0 · not on air 0 (0 of them < 60 s after the show changed) · no API programme 0 · reference: 4 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 2728 ms after each page read, ended shows in it ≤ 0 · 0 rows differed from the list API but matched the channel's guide | PASS |
| U0.banner-fields | Спорт · 255 Setanta Sports UA | num «255» · title «Setanta Sports UA» · now «07:00⁠–⁠09:00 Футбол. Чемпионат Германии. РБ Лейпциг - Эльфе» · next «» · clock «08:13» · shown true | PASS |
| U0.banner==row | Спорт · 255 Setanta Sports UA | menu «Футбол. Чемпионат Германии. РБ Лейпциг - Эльферсберг.» · banner «07:00⁠–⁠09:00 Футбол. Чемпионат Германии. РБ Лейпциг - Эльфе» · API on air «Футбол. Чемпионат Германии. РБ Лейпциг - Эльферсберг.» (fresh, 2630 ms after the banner, 0 ended in it) | PASS |
| U0.next | Спорт · 255 Setanta Sports UA | guide next «Футбол. Чемпионат Германии. Боруссия Дортмунд - Айнтрахт Франкфурт.» · banner «» | DRY-SKIP |
| U0.first-frame | Спорт · 255 Setanta Sports UA | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Спорт · 255 Setanta Sports UA | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Спорт · 275 KHL ТВ | num «275» · title «KHL ТВ» · now «07:55⁠–⁠08:45 "Трансферы".» · next «» · clock «08:13» · shown true | PASS |
| U0.banner==row | Спорт · 275 KHL ТВ | menu «"Трансферы".» · banner «07:55⁠–⁠08:45 "Трансферы".» · API on air «"Трансферы".» (fresh, 2476 ms after the banner, 0 ended in it) | PASS |
| U0.next | Спорт · 275 KHL ТВ | guide next «"МХЛ удивляет".» · banner «» | DRY-SKIP |
| U0.first-frame | Спорт · 275 KHL ТВ | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Спорт · 275 KHL ТВ | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Спорт · 295 ОККО Прайм Спорт | num «295» · title «ОККО Прайм Спорт» · now «08:00⁠–⁠08:20 Новости спорта» · next «» · clock «08:13» · shown true | PASS |
| U0.banner==row | Спорт · 295 ОККО Прайм Спорт | menu «Новости спорта» · banner «08:00⁠–⁠08:20 Новости спорта» · API on air «Новости спорта» (fresh, 2702 ms after the banner, 0 ended in it) | PASS |
| U0.next | Спорт · 295 ОККО Прайм Спорт | guide next «Футбол. Германия. Фрайбург – Бавария, Майнц – Вердер» · banner «» | DRY-SKIP |
| U0.first-frame | Спорт · 295 ОККО Прайм Спорт | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Спорт · 295 ОККО Прайм Спорт | no picture in dry mode | DRY-SKIP |
| U0.rows | Развлекательные | sweep 08:13:59, menu closed 5 s before · 52/52 rows seen · empty 0 · not on air 0 (0 of them < 60 s after the show changed) · no API programme 0 · reference: 5 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 3108 ms after each page read, ended shows in it ≤ 0 · 0 rows differed from the list API but matched the channel's guide | PASS |
| U0.banner-fields | Развлекательные · 296 Fashion ONE | num «296» · title «Fashion ONE» · now «08:11⁠–⁠08:19 Модные Показы (12+)» · next «» · clock «08:14» · shown true | PASS |
| U0.banner==row | Развлекательные · 296 Fashion ONE | menu «Модные Показы (12+)» · banner «08:11⁠–⁠08:19 Модные Показы (12+)» · API on air «Модные Показы (12+)» (fresh, 2803 ms after the banner, 0 ended in it) | PASS |
| U0.next | Развлекательные · 296 Fashion ONE | guide next «Модные имена. Андреа Варани. Fashion-фотограф (12+)» · banner «» | DRY-SKIP |
| U0.first-frame | Развлекательные · 296 Fashion ONE | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Развлекательные · 296 Fashion ONE | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Развлекательные · 321 Панянка-селянка+ | num «321» · title «Панянка-селянка+» · now «08:00⁠–⁠09:00 Програма відсутня» · next «» · clock «08:14» · shown true | PASS |
| U0.banner==row | Развлекательные · 321 Панянка-селянка+ | menu «Програма відсутня» · banner «08:00⁠–⁠09:00 Програма відсутня» · API on air «Програма відсутня» (fresh, 2619 ms after the banner, 0 ended in it) | PASS |
| U0.next | Развлекательные · 321 Панянка-селянка+ | guide next «Програма відсутня» · banner «» | DRY-SKIP |
| U0.first-frame | Развлекательные · 321 Панянка-селянка+ | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Развлекательные · 321 Панянка-селянка+ | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Развлекательные · 347 Ми - Україна | num «347» · title «Ми - Україна» · now «08:00⁠–⁠09:00 "Єдині новини". Телемарафон.» · next «» · clock «08:14» · shown true | PASS |
| U0.banner==row | Развлекательные · 347 Ми - Україна | menu «"Єдині новини". Телемарафон.» · banner «08:00⁠–⁠09:00 "Єдині новини". Телемарафон.» · API on air «"Єдині новини". Телемарафон.» (fresh, 2514 ms after the banner, 0 ended in it) | PASS |
| U0.next | Развлекательные · 347 Ми - Україна | guide next «Загальнонаціональна хвилина мовчання.» · banner «» | DRY-SKIP |
| U0.first-frame | Развлекательные · 347 Ми - Україна | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Развлекательные · 347 Ми - Україна | no picture in dry mode | DRY-SKIP |
| U0.rows | Музыкальные | sweep 08:14:45, menu closed 5 s before · 25/25 rows seen · empty 0 · not on air 0 (0 of them < 60 s after the show changed) · no API programme 0 · reference: 2 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 3192 ms after each page read, ended shows in it ≤ 0 · 0 rows differed from the list API but matched the channel's guide | PASS |
| U0.banner-fields | Музыкальные · 348 Stingray iConcerts | num «348» · title «Stingray iConcerts» · now «07:00⁠–⁠08:52 Take That: Wonderland Live from The O2 Arena, » · next «» · clock «08:14» · shown true | PASS |
| U0.banner==row | Музыкальные · 348 Stingray iConcerts | menu «Take That: Wonderland Live from The O2 Arena, London. 2017.» · banner «07:00⁠–⁠08:52 Take That: Wonderland Live from The O2 Arena, » · API on air «Take That: Wonderland Live from The O2 Arena, London. 2017.» (fresh, 7114 ms after the banner, 26 ended in it) | PASS |
| U0.next | Музыкальные · 348 Stingray iConcerts | guide next «Various: From Mambo to Hip Hop. 2009.» · banner «» | DRY-SKIP |
| U0.first-frame | Музыкальные · 348 Stingray iConcerts | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Музыкальные · 348 Stingray iConcerts | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Музыкальные · 360 4ever Music | num «360» · title «4ever Music» · now «05:00⁠–⁠13:00 Хіти минулих років.» · next «» · clock «08:15» · shown true | PASS |
| U0.banner==row | Музыкальные · 360 4ever Music | menu «Хіти минулих років.» · banner «05:00⁠–⁠13:00 Хіти минулих років.» · API on air «Хіти минулих років.» (fresh, 3123 ms after the banner, 0 ended in it) | PASS |
| U0.next | Музыкальные · 360 4ever Music | guide next «Хіти минулих років.» · banner «» | DRY-SKIP |
| U0.first-frame | Музыкальные · 360 4ever Music | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Музыкальные · 360 4ever Music | no picture in dry mode | DRY-SKIP |
| U0.banner-fields | Музыкальные · 372 Жара | num «372» · title «Жара» · now «08:10⁠–⁠10:00 Музыкальный блок» · next «» · clock «08:15» · shown true | PASS |
| U0.banner==row | Музыкальные · 372 Жара | menu «Музыкальный блок» · banner «08:10⁠–⁠10:00 Музыкальный блок» · API on air «Музыкальный блок» (fresh, 2952 ms after the banner, 0 ended in it) | PASS |
| U0.next | Музыкальные · 372 Жара | guide next «Один на один» · banner «» | DRY-SKIP |
| U0.first-frame | Музыкальные · 372 Жара | no picture in dry mode | DRY-SKIP |
| U0.tech-line | Музыкальные · 372 Жара | no picture in dry mode | DRY-SKIP |
| M2.open-on-playing | 372 Жара | cursor on 372 Жара  ▶ · playing marker true | PASS |
| M4.cursor-on-air | 372 Жара | 08:10 «Музыкальный блок» в эфире · API «Музыкальный блок» | PASS |
| M4.day-back | 372 Жара | Жара — Вчера | PASS |
| M4.past-plays | 372 Жара | «Сквозь время» → mode archive · banner «Жара · Архив · 08:00» · dry | PASS |
| M4.after-midnight (P8) | 352 Inrating | on air «Кліпи.» (started before 00:00) · panel «Inrating — Сегодня» cursor 22:40 «Кліпи.» в эфире | PASS |
| M5.scrub-back | 352 Inrating | knob 08:12:50 · position 08:12:50 · dry | PASS |
| M5.7-day-edge (D1) | 352 Inrating | knob 09:27:49 · mode archive · no picture in dry mode | DRY-SKIP |
| M5.to-live | 352 Inrating | knob прямой эфир · mode live | PASS |
| M7.single | 353 Музвар | no picture in dry mode | DRY-SKIP |
| M7.single | 354 Муз ТВ | no picture in dry mode | DRY-SKIP |
| M7.single | 355 Bridge deluxe | no picture in dry mode | DRY-SKIP |
| M7.burst | from 355 Bridge deluxe | landed 365 Black (expected 365 Black) · 2 app requests | PASS |
| M8.paused | 365 Black | mode paused · 0 requests in 10 s | PASS |
| M8.resume-in-place | 365 Black | paused at 08:20:05 · resumed at 08:20:05 (archive) | DRY-SKIP |
| M9.live | 365 Black · simulated hide | live → live · position 08:20:18 → 08:20:23 · dry | PASS |
| M9.archive | 365 Black · simulated hide | archive → archive · position 08:17:23 → 08:17:23 · dry | PASS |
| M6.continuation (D2) | — | no picture in dry mode | DRY-SKIP |
| C2.archive-1d | 197 Viju+ Megahit | «La migliore offerta» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-3d | 197 Viju+ Megahit | «8 femmes» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-1d | 215 Кинокомедия | «х/ф Нереальная любовь» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-3d | 215 Кинокомедия | «х/ф Телохранитель на фрилансе» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-1d | 194 sci-fi | «Х/ф "Малышка на драйве".» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-3d | 194 sci-fi | «Х/ф "Взрывная блондинка".» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-1d | 228 Kinoliving | «х/ф Свистуны» · mode archive · no picture in dry mode | DRY-SKIP |
| C2.archive-3d | 228 Kinoliving | «т/с Пайрэт Бэй ┊ 5» · mode archive · no picture in dry mode | DRY-SKIP |
| M10.soak | — | no picture in dry mode | DRY-SKIP |
| M11 | — | runner error: (intermediate value).filter is not a function | FAIL |
| app-errors | — | failure log lines: [object Object] | INFO |

#### Run f7ccc45, M11 again (plus the 348 cold-open diagnostic) — 2026-10-26 08:55 (local) — DRY (desktop, headless Chrome, no picture) · tree /private/tmp/claude-501/-Users-yaroslavr/40bd8e7a-b591-426c-be3d-f3bef355966b/scratchpad/frozen-f7ccc45 · cases COLD348,M11

PASS 1 · FAIL 1 · DRY-SKIP 1 · NOT-RUN 0

| Case | Channel / group | Measured | Result |
|---|---|---|---|
| M2.cold-348 | 348 Stingray iConcerts | first frame none in 30 s · states 462ms html · spinner 462ms buffering · rebuffers +0 · new failures +8 · 2026-10-26T06:55:23.592Z #4 hls.js not loaded http://myott.top/stream/<key>/267.m3u8 \| 2026-10-26T06:55:28.169Z #5 hls.js not loaded http://myott.top/stream/<key>/267.m3u8 \| 2026-10-26T06:55:37.742Z #6 hls.js not loaded http://myott.top/stream/<key>/267.m3u8 | DRY-SKIP |
| M11.menu-open | 30 min | 382 row checks · 0 not on air (0 of them < 60 s after the show changed) · 0 resolved by the guide · reference fresh, ≤ 3807 ms after each read, ended shows in it ≤ 123 · 0 minutes without a usable reference | PASS |
| M11·U0.rows | Все каналы | sweep 09:27:17, menu closed 0 s before · 372/372 rows seen · empty 0 · not on air 2 (2 of them < 60 s after the show changed) · no API programme 0 · reference: 30 fresh fetches (0 failed or > 10 s, those pages not judged), ≤ 4396 ms after each page read, ended shows in it ≤ 4 · 0 rows differed from the list API but matched the channel's guide · 114 Живая природа: «Река Курузак.» ≠ on air «Природный парк Као Сок.» (guide: «Природный парк Као Сок.») · changed 52 s before the read \| 254 Nickelodeon: «Мой шумный дом» ≠ on air «Губка Боб Квадратные Штаны» (guide: «Губка Боб Квадратные Штаны») · changed 26 s before the read | FAIL |
| app-errors | — | failure log lines: 40 | INFO |

### 2026-10-26 — TV results (UE50MU7000, Tizen 3.0), builds f7ccc45 and 84fc43e
Source logs, read for this summary: `tv-full-f7ccc45.txt`, `tv-m11-f7ccc45.txt` and `tv-rerun-84fc43e.txt` (session scratchpad), plus `tests/tv/results/2026-10-26-08-23-tv.md`. All runs used `tests/tv/run.mjs` against the installed app.

**Run 1 — 07:43–08:16, build f7ccc45, all cases: 199 PASS · 10 FAIL.** It was stopped by hand during M11: the owner saw a static screen because the menu is opaque, while the video kept playing behind it (verified PLAYING).

| Case | Result |
|---|---|
| U0 rows, 11 groups (Все каналы 349) | 0 empty «now» cells; 2 rows not on air (Все каналы 1, Детские 1), both less than 60 s after their show changed |
| U0 landings, 32 | first frame 744–1986 ms, median 973 ms. Banner = row everywhere except 184 Amedia 1: the menu said «… 5 с.» while the banner and the fresh API said «6 с.» |
| U0 tech line | FAIL on 232 BCU, 242 Мульт и музыка, 348 Stingray iConcerts, 372 Жара. The runner read it after slower checks, by which time the line had gone (TECH_LINE_MS 5 s). Runner fixed, TV re-run pending |
| 348 Stingray iConcerts | no first frame in 10 s, no «Далее». Per the implementer's probe (`d1probe/variant.mjs`), the provider's variant playlist for stream id 267 answers 404/429, so this is not an app bug. The probe's output is not among the logs above |
| M2 menu opens on the playing channel, marked | PASS |
| M4 panel: cursor on air, day back, past programme plays (1168 ms), after midnight (352 Inrating) | PASS |
| M5 scrub back (±1 s, 849 ms) · to live | PASS |
| M5 7-day edge (D1) | FAIL on 352 Inrating: no first frame in 15 s. Fixed in 84fc43e, see run 3. The «147» finding was this same D1 archive request |
| M7 single zap, 10 channels | 678–1321 ms. Burst of 10: right channel, 0 app requests |
| M8 pause 60 s | 0 requests; resumed in place |
| M9 hide and return (simulated), live and archive | PASS (637 / 647 ms) |
| M6 end of recording (D2) | position 07:00:28 vs expected 07:00:30 — PASS |
| C2 archives 1 and 3 days back on Viju+ Megahit, Кинокомедия, sci-fi, Kinoliving | 8/8 PASS, first frame 1198–2090 ms |
| M10 soak 10 min, 228 Kinoliving | not PLAYING 0 · frozen 0 · new failures 0 |

**Run 2 — 08:23, build f7ccc45, M11 for 30 min (`tests/tv/results/2026-10-26-08-23-tv.md`).**
- Menu open the whole time: 360 per-minute row checks, 3 not on air, all less than 60 s after the show changed. Reference fresh, ≤ 5.3 s after each read.
- U0 «Все каналы» afterwards: 349/349 rows, 0 empty, 2 not on air, both less than 60 s.
- Both are marked FAIL by the strict rule, but everything that lagged is within the 60 s refresh floor.

**Run 3 — 09:02, build 84fc43e, U0 · M5 · M4 · M2: 173 PASS · 11 FAIL.** This run used the runner version without the per-row «time since the show changed».
- **D1 7-day edge:** PASS on 372 Жара (first frame 1020 ms). Scrub back, to live, panel, after midnight and menu-on-playing: PASS.
- **U0 rows not on air:** Все каналы 1, Израиль 1, Украина 1, Познавательные 2, Детские 1. 0 empty cells.
- **Tech line:** FAIL on 372, 232, 322 ТНТ and 348 (the same runner timing as run 1). 348: no first frame and no «Далее» (provider).

**Owner decisions, 2026-10-26:**
- The menu stays opaque; no picture behind the menu.
- The current channel's sound under the menu is correct.

**Open after 2026-10-26:**
- The 60 s floor of the «now» refresh: rows can lag a show change by up to 60 s. Owner decision pending.
- The tech-line check: fixed in the runner (read right after the first frame, polled up to 15 s, delay recorded); to be re-run on the TV.
- Repeated sdb disconnects during TV runs (reported by the coordinator; not in the logs above).
