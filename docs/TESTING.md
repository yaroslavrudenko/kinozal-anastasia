# TV acceptance test plan — «Настин кинозал»

A build is accepted only when every scenario below passes **on the real TV** (UE50MU7000). Desktop tests and code reviews are not acceptance.

This file is the complete use-case catalogue: U0 and the test matrix first, then every screen, key, data state and playback state, the correctness of what the viewer sees, and a traceability table from every change to the cases that verify it. The automatic cases run with `tests/tv/run.mjs` (see «How every use case is verified»).

Each result row records the date, build (commit), channel (name, list position, bitrate) and the measured value. A failed row blocks the release, and the previous working build goes back on the TV.

> Test report for 2026-10-25/26 (what was tested, how, how often, results, what testing missed): [TEST-REPORT-2026-10-26.md](TEST-REPORT-2026-10-26.md).

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
| A3 | Setup: enter a key (first run, or menu → BLUE at any time) | The key is saved and used at once, with no check of the app's own; a key the provider refuses gets the provider's error in the stream | — | MANUAL + HARNESS setup-and-key | P1 |
| A4 | Setup: paste an M3U link | The M3U list loads (groups from the playlist), a channel plays | — | MANUAL | P2 |
| A5 | Open with a saved last channel | That channel starts before the list arrives; then the list appears | C3 | MANUAL (owner's cycle, L11) | P0 |
| A6 | Open with the list server down and an offline copy saved | «Сервер не ответил — показан последний список…», all channels listed, a channel plays; when the network returns, «now» lines fill in | C1 | MANUAL (unplug the router) + HARNESS list-load, refresh-now | P1 |
| A7 | Open with the server down and no copy | Error text with «Повтор через N с»; the list appears by itself when the server returns | — | MANUAL + HARNESS list-load | P1 |
| A8 | The key expires (provider «no key» clip) | The provider's clip plays; menu → BLUE → a new key is used at once (DEC-2026-10-26-show-as-is) | — | MANUAL + HARNESS setup-and-key | P1 |
| A9 | BLUE in the menu: change the key; BACK cancels | Old key kept on BACK; a new valid key reloads the app | — | MANUAL | P2 |
| A10 | The list refreshes (every hour since 2026-10-27, was 6 h; or «now» refresh) while watching | Playing channel continues; order and groups unchanged; no flicker | C1 | AUTO-TV M11 + HARNESS refresh-now | P1 |

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
| B11 | Any group (long, short), every page; search results | In the list, right under the last completely visible row (the slot of one row: a page holds one row fewer — 12 one-line rows, was 13): «▼ ещё N каналов · CH− — дальше» while rows remain below the page (N = the rows after the last one completely visible, plural канал/канала/каналов), «Конец списка» once the last row is on screen; it covers no row; the hint bar is a separate band (its own soft ground, a faint rule) ≥ 8 px from the line, the list and the groups column; the groups column has its own slightly lighter ground and a faint divider before the channel list — gentle steps (≤ 10 % lightness), every text ≥ 4.5:1, the highlighted row the strongest; the line is gone with the menu | C1 | **AUTO-TV U0.list-end** + HARNESS list-end (browser + behaviour) | P1 |
| B12 | Pick a channel in a group (e.g. «Кино»), then: reopen the menu; restart the app or come back from another app; browse other groups and close the menu without a pick; ◀ ▶ | The menu reopens on that group with the cursor on the playing channel, its row on screen; ◀ ▶ stay inside that group; browsing without a pick changes nothing | C1 | **AUTO-TV G1** (reopen) + HARNESS menu «remembered group» (restart, browse without a pick, ▶) | P0 |
| B13 | A channel chosen outside the menu (search, number, PREV, programme panel) | In the remembered group: the group stays; not in it: the menu and ◀ ▶ use «Все каналы» | — | HARNESS menu «remembered group» (search, number) | P1 |
| B14 | The remembered group is gone (list changed, adult switch) | The menu opens on «Все каналы» on the playing channel; ◀ ▶ walk «Все каналы»; no error | — | HARNESS menu «remembered group» (group gone) | P2 |

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
| Z4 | A channel whose stream answers the provider's «removed» clip | Tuned like any other; no skip, no app message — the provider's stream shows what it shows (DEC-2026-10-26-show-as-is) | — | HARNESS health-check (show-as-is) | P2 |
| Z5 | PREV CH | Returns to the previous channel (even after a list refresh) | — | MANUAL + HARNESS refresh | P1 |
| Z6 | Digits 1-2-3 | Number shown; after 1.8 s channel 123; an unknown number «Нет канала N» | — | MANUAL | P1 |
| Z7 | Zap then quickly ▼ / ▲ / OK / Home / ⏯ | The latest choice wins (no reopen under an overlay, no stream in the background) | — | HARNESS races | P1 |

### N. Banner
| ID | Steps | Expected result | Set | Verified | P |
|---|---|---|---|---|---|
| N1 | Every landing (zap, menu, number, boot, return) | Number, logo, name; programme with its time range; progress; clock; «Далее HH:MM …» | C1 sample | AUTO-TV U0.banner-fields, U0.next | P0 |
| N2 | Until the first frame | State line: «Подключение…» / «Загрузка видео… N%» / «Нет сигнала — повтор через N с (попытка K)»; never hides early | C2 | MANUAL + HARNESS connect-banner | P0 |
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
| L16 | Streams 1.9.1 — open a channel whose picture comes within 1.6 s | No big centre spinner at all; the banner says «Подключение…» at once (the state line is the owner's and is unchanged) | C2, C3, C4 | HARNESS streams P-S1 + TV probe `s-streams.mjs` (spinShows per zap) | P0 |
| L17 | Streams 1.9.1 — a slow open (> 1.6 s) / a rebuffer (> 1 s) | The big spinner appears only after 1.6 s (open) / 1 s (rebuffer) and goes the moment the picture moves; buffering itself unchanged (5 s / 10 s) | C2 | HARNESS streams P-S1, P-S2 + TV probe | P1 |
| L18 | Streams 1.9.1 — a stream that never plays (dead host, provider 429/404) | No spinner during «Нет сигнала — повтор через N с»; from the 4th failure no spinner at all, «Нет сигнала…» toast as before; retries continue with the same backoff | — | HARNESS streams P-S3 + TV: a dead channel 90 s, spinner time | P1 |
| L19 | Streams 1.9.1 — ◀▶ / a pick | The new name is on screen before the old stream is torn down; only the last of several quick choices is opened | C2, C3 | HARNESS streams P-S4 + TV probe (`name` vs `marks.stop`) | P1 |
| L20 | Streams 1.9.1 — an M3U entry in a format the TV cannot play (rtmp, srt, mms(h), a web page) | Picked: the old stream stops, «Этот канал в формате, который телевизор не воспроизводит», no spinner, no retries | — | HARNESS streams P-S8 | P2 |
| L22 | Streams 1.9.1 — «⚙ Настройки» → «Быстрое переключение каналов» (on by default): OK turns it off / on | «да / нет» in the row, a toast; the next zap uses it without a restart; kept after a restart | — | HARNESS streams P-S13 + TV 200-zap soak (no state errors, no leaks) | P1 |
| L21 | Streams 1.9.1 — archive from a programme's last 5 min | One request covering the next programme too (never a few seconds long); continuation into the next programme unchanged | C5 | HARNESS streams P-S7 + AUTO-TV M6 | P1 |

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
| X4b | «now» refresh (DEC-2026-10-26-now-refresh-2; supersedes X4's 60 s) | One `?t=` request per refresh, sent ≥ 10 s after the previous answer and ≥ 1 s after the last key; only rows on screen cause one (plus a re-read 5 min after the last attempt while a menu is open); menu open 60 min ≤ 30 list requests/h on the TV | — | HARNESS now-refresh-2, refresh-now + AUTO-TV M11 (request count) | P1 |

### Counts
86 use cases plus the key map (O6, 11 keys × 7 states): **P0 26 · P1 38 · P2 22**. Verification: **28 fully AUTO-TV**, 6 AUTO-TV with a MANUAL part, 52 MANUAL or HARNESS only (a person at the TV is needed for acceptance). Of the 26 P0 cases, 20 have AUTO-TV coverage; the other P0 cases (A1, A2, A5, N2, L11, L15) are MANUAL on the TV.
2026-10-26 (1.8.1): + B12 (P0, AUTO-TV G1 with a HARNESS part), B13 (P1), B14 (P2) — 89 use cases: **P0 27 · P1 39 · P2 23**.

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
| Owner 2026-10-26: «неизвестно, он кончается на этой странице или нет» — list-end line under the menu's channel column and the search results | B11, S1 (tests/browser/list-end.test.mjs, tests/list-end.test.js, AUTO-TV U0.list-end) |
| Owner 2026-10-26 (TV, after 703a2c1): one row fewer, the list-end line in its slot; the hint bar set apart from the list and the groups. Paging pin renamed «paging (pin): with one-line rows a page is still 13 channels» → «…a page is 12 channels and the list-end line takes the 13th slot» (13 → 12 rows, next page starts at 13 instead of 14). Soft grounds: hint bar #121927, groups #0b1019 on the menu's #06090f, divider rgba(141,153,173,.16) | B4, B11 (tests/browser/paging.test.mjs, tests/browser/list-end.test.mjs, AUTO-TV U0.list-end) |
| TV crash: platform call throws error 18 | L15 |
| D1 (7-day edge never starts) | R3 |
| D2 (continuation jumps ~50 s) | L7 |
| D4 (dry run 2026-10-26: ▼ after midnight has no programme on air) | P8 |
| DEC-2026-10-26-now-refresh-2 («now» refresh policy, retained last programme «(шла до HH:MM)») | U0, D1, D2, X4b, M11, Q1-TV1 … Q1-TV6 below |
| Owner 2026-10-26 (1.8.1): «указатель на группу и указатель на канал не сохраняются, теряются» — the group a channel is picked in is remembered (`zapGroup` in storage) and is the menu's and ◀ ▶'s group; browsing groups no longer changes it | B12, B13, B14 (tests/menu.test.js «remembered group» ×6, AUTO-TV G1) |

## DEC-2026-10-26-now-refresh-2 — «now» lines: desktop pins and TV acceptance cases (2026-10-26)

The decision (judges 3/3) and the policy are in [PERFORMANCE.md](PERFORMANCE.md) («Now» lines: the refresh policy). The owner: «Я хочу тебя предостеречь от регрессии. В прошлый раз ты улучшал производительность, в итоге потерял данные.» Nothing ships while any row below is red; a row worse than the 11:58 TV baseline (`tests/tv/results/2026-10-26-11-58-tv.md`) means the fix is reverted, never patched on top.

**Desktop pins** (`tests/now-refresh-2.test.js`, 18 tests; 15 are red on 37fb286; every one was mutation-proven: the mutant applied to a copy of the app via `KINOZAL_ROOT`, shown by `diff`, red, restored, `diff` clean, green):

| Must not lose | Test |
|---|---|
| No empty row during a provider outage — HTTP 500, timeout, empty body, not JSON, `{}`, records with no programme — at E+14/+16/+30/+60 min; retried every 60 s, never faster, never stopping; the first good answer clears every mark | `now retained (…): list answers «<fault>» for 60 min …` (6 tests) |
| No row lost on a partial answer (50 of 389, none on screen) | `now retained (…): every answer names only 50 of 389 channels …`, `now retained (B2): an answer naming 50 of 389 channels …` |
| D7: the placeholder never becomes the retained title | `now retained (D7): after «Нет данных» was replaced …` |
| A record that started is never erased by a later-only one; only a channel leaving the catalog loses its line | `now retained (B2): an answer naming only a later programme …`, `now retained (B2): a list reload that drops a channel …` |
| The ▼ panel never marks a retained, ended programme «в эфире» | `now retained (A7): during an outage the programme panel …` |
| No mark in the healthy case; 0 empty rows; every group filled after 30/40/60 min | `now healthy (…): the menu open 60 min … a key every 2 s …`, `now healthy (…): after 30, 40 and 60 min … every group …` |
| The playing row turns over at its end with no request | `now refresh (A3): the playing row …` |
| A request that crossed the end (sent E−1 s, answered E+2 s) re-asks at E+12 s, not E+62 s | `now refresh (A2): …` |
| Keys every 200 ms send nothing; one request 1 s after the last key | `now refresh (A6): …` |
| Ends off screen alone send nothing but the 5-min re-read | `now refresh (A1, B1): …` |

**2026-10-26, after the Codex REJECT on f0b31a7** — four more pins in `tests/now-refresh-2.test.js` (22 tests now; 4 of 4 red on f0b31a7, each fix removed alone turns its own pin red):

| Rule | Test |
|---|---|
| (a) during an outage with no key pressed a row is marked «(шла до HH:MM)» when its 15-min linger ends (a redraw with no answer) | `now retained (A7, Codex a): …` |
| (b) an answer that leaves out an ended row on screen confirms nothing for it: re-asked 10 s after that answer | `now refresh (A2, Codex b): …` |
| (c) a failed list is DUE again 60 s after the failure, also with nothing ending on screen | `now refresh (A5, Codex c): …` |
| (d) a show the provider still names 20–40 min after its end is re-asked every 60 s | `now refresh (A2, Codex d): …` |

**The menu text left over the picture (owner's bug, 2026-10-26).** After a channel was picked from the menu or search, the menu's rows stayed on screen over the video. Present since 88c1860 (menu hidden by `visibility`, `.guide.hidden`): every shown row and logo set an inline `visibility: visible`, which beats a hidden parent. Fixed in `js/listrows.js` (rows and logos use `inherit`; `js/ui.js` banner logo the same). Honest note: the earlier TV and dry checks (U0, M2, M11) read the rows' data and the banner, never what text was actually visible after the menu closed, so none of them could see it.
- Browser pin `tests/browser/menu-closed.test.mjs` (2 tests, headless Chrome): after a pick from the menu and from search, no element under `#guide` / `#search` has computed visibility `visible` with a box, and the banner is shown. Red on f0b31a7's js (2 of 2); the row mutant (`'visible'` back) red 2 of 2; the logo mutant red 1 of 2.
- TV runner: `U0.menu-closed` after every landing (first/middle/last channel of every group, TV and `--dry`): the elements with text under `#guide`/`#search` that are visible after the pick; 0 = PASS. Dry run 2026-10-26 13:41 on this tree: 33 of 33 PASS (`tests/tv/results/2026-10-26-13-41-dry.md`; its 6 `U0.rows` FAILs are live rows read 2–47 s after a show changed, the same class as the earlier dry runs). Not yet run on the TV.


**Replaced tests (NC-2: the expectation changed under this decision id; none deleted silently):**

| Old name (37fb286) | New name |
|---|---|
| now fresh (D6): with the menu open for 1 hour, a row is never more than 70 s behind the show on air | now fresh (DEC-2026-10-26-now-refresh-2): with the menu open for 1 hour, a row is never more than 5 s behind the show on air |
| now fresh (D6): after 40 min on one page, every page scrolled into view shows what is on air at once (≤ 70 s behind) | now fresh (DEC-2026-10-26-now-refresh-2): after 40 min on one page, paging at 200 ms sends nothing until the keys rest; one fresh request goes 1 s after the last key and the page is on air within 5 s of it |
| now line: refreshes are never closer than 60 s (send to send) | now line (DEC-2026-10-26-now-refresh-2): every refresh asks the provider-fresh list and is sent ≥ 10 s after the previous answer, also with a show on screen ending every 2 s |
| now line: a refresh is one /api/channel_now request and never per-channel guide requests (bound «≥ 2») | same name; exactly 23 refreshes in 2 h |
| now line: every refresh is justified … (bound «≥ 10») | same name; exactly 29 refreshes in 2 h |

Existing pins kept unchanged: D5 banner == row (`now never empty …`, `now line accuracy: the landing banner …`), D6 (`now fresh (D6, pin)`), D6b, D7, «Прямий», D1 archive cap (`tests/tv-run-fixes.test.js`). List-request fixtures accept `?t=`; the cache tests still tell the plain URL from the fresh one.

**TV acceptance cases (not run yet — results to be recorded here):**

| ID | Steps | Expected result |
|---|---|---|
| Q1-TV1 | U0 in every group, covering **all** rows (an unseen row is not green) | 0 empty rows; 0 rows more than 10 s late after a change; banner == row |
| Q1-TV2 | M11: menu open 60 min, list requests counted from the network log | ≤ 65 list requests/h (owner 2026-10-26: the open menu re-reads every 60 s; was ≤ 30/h); every one with `?t=` |
| Q1-TV3 | Fast page flipping (CH± held) through «Все каналы», requests counted | no request while the keys repeat; one ≈ 1 s after they stop; rows on air within ≈ 5 s |
| Q1-TV4 | Network cut 2 min during M11 | 0 empty rows; no mark (inside the 15-min linger); recovery at the next attempt |
| Q1-TV5 | Network cut 20 min during M11 | 0 empty rows; rows past the linger marked «(шла до HH:MM)», banner the same; marks gone after the first good answer |
| Q1-TV6 | Healthy soak on one stream, before/after, a real buffering counter (`Diag` `rebuffer`) | 0 rebuffers |

Run: `zsh tests/tv/launch.sh`, then `node tests/tv/accept/cdp-client.mjs <port> tests/tv/accept/q1-accept.mjs 60` (cuts simulated in the app). Results 2026-10-26: TEST-REPORT-2026-10-26.md §9.

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
- Zapping into a channel the provider removed tunes it like any other (DEC-2026-10-26-show-as-is): the app hides and skips nothing.

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

## DEC-2026-10-26-show-as-is — every channel the provider lists is shown (v1.8.3)

Owner, 2026-10-26: «бери всё, что даёт провайдер, не блокируй, показывай как есть». Found: from about 14:00 to 22:00 on 2026-10-26 the TV showed 11 of the provider's 18 Israeli channels (TV runs 14:02: «Израиль» 11/18 seen; 15:09 and 16:57: 339 channels, «Израиль» 11/11; provider at 22:42: 389 channels, 18 Israeli, all 18 streams 1080p/576p «ok»). Cause: the background health sweep (`js/health.js`) marked a channel «removed» when its stream answered the provider's placeholder and hid it from every group for 6 h, remembered across launches.

Change: no channel is hidden, skipped or marked by the app, and the app checks no key. The background sweep and the landing check are gone (`js/health.js` deleted): no stream request besides the channel tuned. Owner: «Ключ проверяет сам провайдер. Если ключ недействующий, просто место потока вернется на страницу с ошибкой» and «Нужно дать возможность в любой момент ввести ключ или поменять… он должен будет использоваться для работы»: the key screen (first run, or menu → BLUE at any time) saves the key and uses it at once, without the app's own check (`OttClub.checkKey` / `classify` removed).

| Test (`tests/health-check.test.js`) | On 3991b71 | On the fix |
|---|---|---|
| show-as-is: channels whose streams answer the "removed" clip all stay in the menu after 10 min | FAIL | PASS |
| show-as-is: zapping onto a "removed" channel tunes it, with no skip and no «отключён» message | FAIL | PASS |
| show-as-is: steady playback makes no background stream requests (old sweep: one per channel) | FAIL | PASS |
| show-as-is: a stream answering the provider's "no key" clip is tuned; the app adds no key message of its own | FAIL | PASS |
| key change (BLUE in the menu): the new key is saved and used even when the provider answers its «no key» clip (`tests/setup-and-key.test.js`) | FAIL | PASS |

Suite: 229 tests, 229 pass (with `--browser`). By name vs 3991b71 (231/231): 0 newly failing. Removed, because they encoded the old hide/skip policy: the three `P-D:` sweep tests, `connect banner: a channel found removed says «Канал отключён провайдером» on the banner`, `correctness (pin): the provider's "removed" clip still hides the channel`, `correctness: a generic HLS master with only BANDWIDTH is not hidden as "removed by the provider"` (nothing is hidden any more; covered by the first show-as-is test), `landing probe: a late "removed" answer does not override the archive show picked meanwhile` (the landing check no longer acts on «removed»).


**TV check of v1.8.3 (4e9fd3b), 2026-10-26 ~23:15, owner: «Сделай базовый прогон… Не надо полностью» and «Пройдись по тем каналам, которых не было».** Installed version read from the TV: 1.8.3. Basic: groups «Все каналы» 372 · «Израиль» **18** · «Национальные» 62 (the afternoon build showed 339 / 11 / 49); playing, one zap ▶ and back ◀, menu open and close — each PASS (media time advancing ~3 s per 3 s); no «отключён» on screen. Israeli group, every channel tuned inside the group (the afternoon's missing ones were not recorded by name, so all 18 were walked): **18/18 PLAYING**, media time advancing — Channel 9, 11, 12, 13, 14, 24, 5Sport, VIVA Premium, i24, Yam Tichoni, HOT Zone, YES Movies Action, HOT HBO at 1920×1080 (4.1–7.3 Mbit/s); HOP!, Good Life, Knesset Channel, Zoom at 720×576; KAN23 at 1024×576. Afterwards the channel and group on before (152 CineMan Action) were restored.

## DEC-2026-10-27-sources — «📡 Источники»: OTT Club, ten free playlists, the viewer's own (v1.8.4)

Owner, 2026-10-27: five (then up to ten) predefined free playlists and OTT Club in one menu, switch between them, add and delete one's own playlists (only those), change the OTT Club key there; groups follow the playlist (no Ukrainian channels → no «Украина» group, no music → no music group); Israeli then Ukrainian channels first; nothing filtered; the key taken exactly as entered, the provider judges it.

What changed: `js/overlays/sources.js` (new screen: menu → Blue, or the «📡 Источники» row), `Sources.list/activeId/addUser/switchTo/removeUser`, `CONFIG.FREE_PLAYLISTS` (iptv-org: Israel, Ukraine, Russian, English, news, kids, music, movies, documentary, sports), setup modes `key` / `playlist`, `OttClub.extractKey` (a non-OTT-Club link is a playlist; a typed key is used as is), `Country.detect` (iptv-org ids `.il@SD`, quality / `[Not 24/7]` suffixes), `M3U` (`General;News` → the specific group, English group names in Russian, Israeli then Ukrainian channels first). The groups column a shade darker than the list (owner).

| Test (`tests/sources.test.js`) | On 7ca71ce | On the change |
|---|---|---|
| sources: OTT Club, the ten built-in free playlists, then «+ Добавить свой плейлист» | FAIL | PASS |
| sources: a built-in free playlist cannot be removed (RED twice) | FAIL | PASS |
| sources: one's own playlist is added on the TV, listed, and removed by RED pressed twice | FAIL | PASS |
| sources: OK on a free playlist switches to it and does not reopen the last channel of another source | FAIL | PASS |
| key as entered: whatever is typed is saved as the OTT Club key, with no check of the app's own | FAIL | PASS |
| another provider's link with a key inside (/playlist/<key>/) is a playlist, not an OTT Club key | FAIL | PASS |
| playlists: Israeli channels first, then Ukrainian, then the rest in the playlist's order | FAIL | PASS |
| playlists: groups come from the playlist (iptv-org ids and "General;News" read right); no channel is filtered | FAIL | PASS |
| playlists: no Ukrainian channel -> no «Украина» group | FAIL | PASS |
| sources: each source keeps its own last channel and group; coming back reopens them | FAIL | PASS (mutation: not restoring `lastCh` turns it red) |

Owner, 2026-10-27: «меню выбора стримов должно быть по требованию… приложение всегда открывает последний стрим, последняя группа и последний канал». «📡 Источники» opens only on Blue in the menu or its row; the app starts on the last source; each source keeps its own last channel and group (`lastBySource`), so switching back reopens where the viewer was in it.

Renamed: `key change (BLUE in the menu): …` → `key change (menu → BLUE «Источники» → BLUE): …` (Blue in the menu now opens «Источники»). `now healthy … every row of every group …` skips the two service rows at the end (📡 Источники, ℹ О программе). Suite with `--browser`: 239 tests, 239 pass; by name vs 7ca71ce (229/229): 0 newly failing.

Desktop checks with the real playlists (headless Chrome, this tree): iptv-org Israel 34 channels, list ready in 536 ms, «Израиль» 32 of 34 (the other two are not Israeli by id or name); iptv-org English 3005 channels, list ready in 542 ms, 27 groups; «📡 Источники» opens in < 50 ms. Layout: 6 own playlists (19 rows): the list ends at 973 px, the hint starts at 1012 px; the last row scrolled into view sits at 915–973 px. Five channels of the Israel playlist played on the desktop (Kan 11, i24NEWS Hebrew, Now 14, Channel 9, Makan 33). Not yet on the TV.

### Review of v1.8.4 (2026-10-27): three experts, one batch of fixes

Owner: «review делают три эксперта: эксперт по производительности, независимый эксперт и Codex» and «исправляй всё одним пакетом». All three returned REJECT; every finding and what was done:

| # | Finding (reviewers) | Status |
|---|---|---|
| 1 | Adding a playlist / entering the key bypassed the switch: the left source's position was lost and the new one could reopen another source's channel (perf, independent, Codex) | APPLIED — one switch (`Sources.switchTo`) for every change; tests «adding one's own playlist keeps…», «entering the OTT Club key from a playlist…» |
| 2 | OK twice before the restart wiped the left source's saved position (independent, Codex) | APPLIED — `switchTo` runs once per page life; test «OK pressed twice…» |
| 3 | A playlist set up by 1.8.3 or built in was missing from «Источники» (independent, Codex) | APPLIED — listed at start (`addUser`); test «a playlist set up before…» |
| 4 | Translated group names changed M3U channel keys, so favourites / last channel were lost on upgrade (all three) | APPLIED — keys keep the playlist's own group text; test «channel keys keep…» |
| 5 | Two tests could not fail (the helper filtered empty groups) and the group-restore test never checked the group (independent, Codex) | APPLIED — unfiltered helper; group asserted (mutation: not restoring the group turns it red) |
| 6 | `GROUP_RU` plain object (`constructor`, `__proto__`) (all three) | APPLIED — `Util.dict()` |
| 7 | Deleting the active playlist re-created its saved position (independent, Codex) | APPLIED — the switch keeps no position for a removed playlist; test «removing the playlist being watched…» |
| 8 | OTT Club link check matched substrings / look-alike hosts (independent, Codex) | APPLIED — host name only; test «an OTT-Club-looking word…» |
| 9 | The key was trimmed (Codex) | APPLIED — kept exactly as typed; test «key as typed…» |
| 10 | A fresh install could not reach the free playlists (setup only) — against the README (Codex) | APPLIED — a fresh install plays the first free playlist; the first-run screen is gone; test «fresh install…» |
| 11 | «XXX» became the hidden «Для взрослых» — against «не фильтруем» (perf) | APPLIED — the provider's group stays as is; test «a provider group «XXX»…» |
| 12 | Key screen said «Поле пустое» for a link (all three) | APPLIED — says it is a playlist link; test «a playlist link typed on the key screen…» |
| 13 | «Переключаю…» never painted (perf) | APPLIED — the restart runs in its own task (`SWITCH_PAINT_MS`) |
| 14 | Regex literals rebuilt per channel (perf, independent) | APPLIED — hoisted (`IL_ID`, `UA_ID`, `NAME_SUFFIX`, `VAGUE_GROUP`) |
| 15 | `activeId()` read on every key in «Источники»; cursor jumped after a delete; `zapGroup` key owned twice; prefixes repeated (perf, independent) | APPLIED — read once per opening; cursor kept; `Zap.GROUP_STORE`; `FREE` / `USER` + `urlOf` / `idOfUrl` |
| 16 | `#EXTGRP` groups not read like `group-title` (independent) | APPLIED — same `groupName`; test |
| 17 | README: «other paid providers not supported» contradicted the M3U path; the 📡 row position (independent, Codex) | APPLIED |
| 18 | Up to 3005 channels never measured on the TV (perf F1, F2: longest task, offline copy) | measured on the TV — see below |
| 19 | No test proves the parse is sliced for 3000 channels (perf F9): the harness clock does not move during synchronous work, so `Date.now()` slicing cannot be observed there | OPEN — measured on the TV instead (row 18) |
| 20 | Each switch forgets the offline copy; switching back re-downloads up to 692 KB (perf F7) | OPEN — owner's call (a copy per source costs storage on the TV) |
| 21 | Logos load per visible row from many hosts (perf F8) | OPEN — bounded to 13 rows; measured with row 18 |

Owner, 2026-10-27: «ключ для OTT-клуба отправляется только в плейлист OTT-клуба и не отправляется в другие плейлисты». Two tests: `key privacy: with an OTT Club key saved, a free or own playlist never receives it (list, streams, guide, zaps, switching)` and `key privacy: on OTT Club the key goes only to the OTT Club server` — they check every page request and every address the player opens.

Removed with the first-run screen (replaced by the tests above): `P-R: pressing OK twice on the setup screen starts one list refresh, not two` (the double OK is now covered by «OK pressed twice…»), `key as entered: …`, `another provider's link with a key inside (/playlist/<key>/) is a playlist, not an OTT Club key` (new wording: «… is added as a playlist; the OTT Club key stays»).

About screen: author row (owner: «Добавь автора: Ярослав Руденко, и ссылку на LinkedIn profile»).

**TV check of v1.8.4 (this tree), 2026-10-27, owner: «Так, ты можешь прогонку сделать на телевизоре».** The TV had moved to `192.168.1.176` (found by scanning the network; see `docs/DEPLOY.md` §3 and `tools/find-tv.sh`). Installed version read from the TV: 1.8.4.

| Check | Result |
|---|---|
| Review rows 18–21: the 3005-channel iptv-org English playlist on the TV (fetched and parsed on the TV while OTT Club kept playing; a 10 ms interval measures the longest pause) | fetch 692 458 chars in 429 ms (longest pause 14 ms) · parse 3005 channels in 247 ms, **longest pause 27 ms** · favourites + groups for 3005 channels 18 ms (30 menu rows) · offline-copy stringify 18 ms · the TV's own list put back (389) and М1 still PLAYING. All under 50 ms: rows 18 and 19 closed by measurement (estimate was 75–125 ms) |
| Switch OTT Club → free «Израиль» | 34 channels, «Израиль» 32, PLAYING; OTT Club's last channel kept in `lastBySource` (1+1 Україна) |
| Switch back to OTT Club (`Sources.switchTo('ott')`) | 389 channels, «Израиль» 18; **the app reopened OTT Club's last channel (22 1+1 Україна) in its group («Украина»)**, PLAYING, media time +3.0 s per 3 s |
| Left as found | 350 М1 picked again (the owner's channel before the run), PLAYING |

Note on the run: the first scripted switch sent remote keys 300 ms apart, faster than the menu opens, so an OK landed in the channel menu (it tuned 1+1 Україна) and the switch went to «Израиль» instead of «На английском». The app did what those keys asked; the script now waits for each screen before the next key (TV scripts in the session scratchpad, not in the repo).

### Providers, not playlists; scroll bars; the picture fits the screen (2026-10-27)

Owner: «Источник — это … источник провайдера … Когда выбираешь провайдера, уже в нём все каналы группируются»; then, for iptv-org, «Весь iptv-org» and «если он отдаёт отдельно плейлисты … тогда это источник плейлистов». «📡 Провайдеры» lists OTT Club, the free **iptv-org** provider (OK opens its playlists: «Весь список» ~11 340 channels first, then Израиль · Украина · На русском · На английском · Новости · Детские · Музыка · Кино · Познавательные · Спорт; Back returns) and the viewer's own providers. A fresh install plays iptv-org's whole list.

Owner: «чтобы слева тоже было понятно, что внизу ещё есть пункты меню»; «справа от группы каналов … и справа от списка каналов … ползунок»; «очень элегантным, неярким и не сильно контрастным, но его должно быть видно». The groups column got the same «▼ ещё N групп» / «Конец списка» line as the channel list, and both columns a hair-thin grey-blue scroll bar (moved by a transform, hidden with the menu).

Owner: «изображение ложилось чётко на размер экрана, чтобы оно не было уже, и стрим адаптировался под разрешение и размер экрана телевизора»; «поставить себе отметку, чтобы мы не потеряли эту функциональность»; «в настройках … расширять ли автоматически экран на весь размер … По умолчанию да». **Picture fit (kept by tests):** every stream the player opens gets `setDisplayRect(0, 0, 1920, 1080)` (the whole TV screen), the display mode **full screen by default** (`PLAYER_DISPLAY_MODE_FULL_SCREEN`; was «Авто», which kept the stream's proportions and left 576p channels narrower), and adaptive quality from the best the bandwidth allows (`ADAPTIVE_INFO STARTBITRATE=HIGHEST`), so a stream that starts at a lower rendition grows to full quality on the same full-screen picture. «Картинка во весь экран» in «ℹ О программе» (default on; off = the stream's proportions); Green while watching cycles full screen → stream proportions → with borders.

| Test | Proves |
|---|---|
| `picture fit: every stream opened (start and each zap) gets the whole 1920×1080 screen, full screen by default, adaptive quality from the highest` | the pin (mutation: removing `setDisplayRect` turns it red) |
| `picture fit: GREEN cycles full screen → aspect-keeping → with borders → full screen, and the choice is kept` | the modes and their order |
| `picture fit: the setting «Картинка во весь экран» in «О программе» is on by default; OK turns it off (stream proportions) and on again` | the setting |
| `providers: OTT Club, the free iptv-org provider, «+ Добавить провайдера»; iptv-org opens its playlists («Весь список» first); Back returns` | the two levels |
| `providers: the built-in iptv-org provider and its playlists cannot be removed (RED twice)` | built in stays |
| `providers: OK on an iptv-org playlist switches to it; its provider row is marked as current` | switching |
| `menu: a scroll bar and «▼ ещё N групп» show that the groups column goes on below` | the groups column's hints |

Suite with `--browser`: 258 tests, 258 pass. One run had `paging: with mixed row heights, page-up in search results ends exactly one row before the previous page` fail once; alone it passed 3 of 3 and the next full run passed — a timing-sensitive browser test, recorded here, not a change in search.

### The menu's «▼ ещё N …» lines gave way to the scroll bars; lists never reach the hint bar (2026-10-27)

Owner: «у нас появились ползунки, поэтому есть смысл убрать внизу вот эти сообщения … по ползункам уже понятно, где мы» — the list-end lines under the menu's groups and channels are gone (the search results, which have no bar, keep theirs). «в меню «О программе» всё налазит на нижнюю строчку … нужно как-то отделить» — «О программе» is more compact (row 6 px padding, 24 px text, smaller icon) and its hint, like «Провайдеры», sits on its own band (#121927, a rule above it): the last row now ends at 827 px, the hint starts at 1008 px. «Есть телевизоры меньше … на всех размерах экранов списки не должны доходить до нижней подсказки»: the app is a fixed 1920×1080 canvas every screen scales as a whole; `tests/browser/hint-gap.test.mjs` measures the gap on the channel menu, search, «О программе» and «Провайдеры» at 1920×1080 and 1280×720 (≥ 8 px scaled) — the old «О программе» layout turns both of its checks red.

Replaced (they asserted the removed lines): `list end: a long group says «▼ ещё N каналов» …`, `list end: a group that fits one page says «Конец списка» at once`, `list end: with one-line rows a page holds 12 channels (was 13) and the line says «▼ ещё 33 канала» in the 13th slot`, `list end: after a channel is picked the line is not visible`, `list end: the menu says how many channels are below the page, and «Конец списка» on the last page`, `menu: a scroll bar and «▼ ещё N групп» …` → `scroll bar: in a long group the thumb starts at the top, moves down page by page and reaches the bottom; no list-end line under the menu`, `scroll bar: a group that fits one page shows no bar`, `list end: with one-line rows a page holds 12 channels (one row slot kept free above the hint bar)`, `scroll bar: after a channel is picked the bars are not visible`, `scroll bar: the menu's channel bar starts at the top and its thumb reaches the bottom on the last page (no list-end line in the menu)`, `menu: a scroll bar shows that the groups column goes on below`.

**Author link (2026-10-27, owner: «перейти на пункт автора, нажать «Ввод», и открылся браузер с моим LinkedIn-профайлом»).** «О программе» starts with the item «Автор — Ярослав Руденко · linkedin.com/in/yaroslav-rudenko-2303 · OK — открыть в браузере»; OK opens https://www.linkedin.com/in/yaroslav-rudenko-2303 in the TV's browser through Tizen app control (`operation/view`; new privilege `application.launch` in config.xml; a new tab on the desktop). Test: `about: «Автор» is the first item; OK on it opens the author's LinkedIn profile in the TV's browser` — renamed with the move to «⚙ Настройки» (the author is now the last item) to `settings: «Автор» (the last item) …` (`tests/picture-fit.test.js`).

### Interface language: «⚙ Настройки» with Russian, Ukrainian, Hebrew and English (2026-10-27)

Owner: «переименовать меню «О программе» в «Настройки» и добавить туда ещё возможность выбора языка … по умолчанию на русском, потом на украинском, потом на иврите, потом на английском»; «Мы переводим интерфейс. Название канала возвращает провайдер». `js/i18n.js` holds every text of the app's own in the four languages (one dictionary; Russian/Ukrainian plural forms, Hebrew/English one/other); `I18n.apply()` sets `lang` and `dir` on `<html>` and fills the page's marked texts (`data-t`, `data-tp`). Channel names, programmes and every group the provider gives (OTT Club's Russian groups, iptv-org's «News», any playlist's) are shown as given; only the groups the player forms itself are translated. «⚙ Настройки» (the menu's last row): «Язык интерфейса» (OK: Русский → Українська → עברית → English; saved; the app starts again in it), «Картинка во весь экран», «Каналы для взрослых», «Автор» (LinkedIn). Hebrew mirrors the layout (CSS `[dir="rtl"]`: the columns, scroll bars, highlight bars, banner, programme panel); time lines and switches keep running left to right. The playlist names left `config.js` (the dictionary is their one source).

| Test (`tests/i18n.test.js`) | Proves |
|---|---|
| `i18n: the dictionary has a non-empty text in all four languages for every key, and the same {n} placeholders` | no missing or broken translation |
| `i18n: Russian by default — the menu and «⚙ Настройки» are Russian` | the default |
| `i18n: in «⚙ Настройки» OK on «Язык интерфейса» goes Русский → Українська → עברית → English → Русский; each choice is saved and a fresh app starts in it` | the setting, through a real restart |
| `i18n: in English the menu, «Providers» and the free playlists are English; channel names stay as the provider gives them` | interface translated, provider data untouched |
| `i18n: in English an iptv-org playlist shows its groups as given; Israel and Ukraine pinned groups are English` | groups |
| `i18n: Hebrew is written right to left; Ukrainian uses its own plural forms` | direction and plurals |
| `i18n: groups the provider gives are shown as given in every language — iptv-org's «News» and «Kids», any playlist's; our own groups are translated` | owner's rule on groups (below) |
| `i18n: an entry with no name keeps the same key in every language (a favourite outlives a language change)` | keys never depend on the language |
| `i18n: the language switch keeps the channel being watched, and a double OK moves one language only` | the restart loses nothing; one step per restart |
| `i18n: every I18n key the code uses is in the dictionary` | no key missing (scan of `js/` and `index.html`) |
| `i18n: the Ukrainian, Hebrew and English texts carry no Russian, and Hebrew and English carry no Cyrillic at all` | nothing left untranslated |
| `i18n: Russian and Hebrew plural forms` | plurals |
| `tests/browser/i18n-rtl.test.mjs` (4 tests) | in a real page: every `[data-t]` text and the search placeholder are translated in English and Hebrew; in Hebrew the groups column is on the right and RIGHT/LEFT move toward groups/channels; the banner bar and the scrub ends run left to right (start on the left) |

**Review of the localization (2026-10-27): three auditors — native, localization, Codex (external).** All three REJECT; every finding is fixed in this tree:
- groups keep a language-independent id (`groupId`), and the menu, the remembered zap group and the offline copy use it;
- groups the provider gives are never translated (see the owner's rule below);
- an unnamed entry's key uses «канал» in every language;
- `I18n.t` fills placeholders in one pass, so a programme title containing `{1}` is not rewritten;
- a double OK before the restart is ignored;
- the current channel is saved before the restart;
- in Hebrew the menu arrows are mirrored, and the banner bar and scrub ends run left to right;
- the auditors' wording fixes for Hebrew, English and Ukrainian are applied (seconds/minutes «שנ׳/דק׳», LRM/RLM around Latin text, adult toasts, «network: {0}», the dedication on two lines), and the unused `st.title` is removed.

**Owner's rule on groups (2026-10-27):** «Если группы возвращает провайдер — то мы их показываем как есть, если мы сами их формируем нашей логикой — то нужно переводить». Groups the provider gives — OTT Club's, iptv-org's categories, any playlist's — are shown as given in every language. Groups our logic forms — Search, All channels, Favourites, Israel, Ukraine, «No group», Providers, Settings — are in the interface language. The category translations (`c.*`, 24 keys) were removed from the dictionary.
Restated the same day: «Если провайдер возвращает названия групп и названия каналов — мы их не переводим, мы переводим наши группы, которые мы сами искусственно создаём, текст интерфейса. То, что возвращается провайдером, не переводим и не можем перевести». So: the interface text and our own groups are translated; group names, channel names and programmes from the provider never are.

Still open, waiting for the owner: whether to translate the app's name (recommended: keep «Настин кинозал»). `Util.plural` was removed on 2026-10-27 (the owner's «фикси все находки»; its test now checks `I18n.n`).

Desktop screenshots (headless Chrome, this tree): the menu, «Настройки» and «Провайдеры» in Hebrew (right to left), English and Ukrainian — no overlap, the hint bars apart. Not yet on the TV.

### Localization review 3: every finding fixed in one batch (2026-10-27)

Owner: «Фикси все находки». Four reviewers (native technical, Codex external, the design expert, the performance engineer) reported 46 register items; this batch fixes every code item at once and records the rest below. Rules kept throughout: provider texts (channel names, programmes, groups — «Undefined» and «Без группы» included) are never translated; only the interface and our own groups are; mixed texts read as written and look the same; keys stay the same across languages and across the upgrade; the OTT Club key is never printed or logged; ES5 only (Chromium 47).

**How a provider text keeps its own reading order (`js/i18n.js`, `js/listrows.js`, `css/app.css`).**
- **Its direction** is the one of its first strong letter. Emoji and flags (UTF-16 surrogate pairs), digits (Arabic-Indic too), punctuation and symbols (× ★ ▶ «») are not letters and are skipped. A text with no letter at all (`123 · 456`) reads left to right.
- **In the list columns** (channels, groups, «now» lines, programmes, search titles) each text sits in its own element (`.x`) inside a flex cell. A text in the other script than the interface gets its own `dir`; the cell keeps it at the interface's start edge, so single-line rows share one edge, and a wrapped one keeps its own start edge on every line. The title's ★ and ▶ are elements of their own beside it, so they stay at the interface's ends.
- **In a sentence of ours** (the banner title and «now», search «group · programme», the panel and slider titles, «(… до HH:MM)», toasts) the provider text is embedded with LRE/RLE … PDF, and interface-direction marks (LRM/RLM) around it keep our · — ( ) on our side. Tizen 3's engine knows these; the isolate characters (FSI/LRI/RLI/PDI) are newer and are not used.
- **Technical texts** (a provider's host name, the picture size 1920×1080) always read left to right (`I18n.ltr`).
- **Hebrew hints** pin their arrow pairs left to right (LRM ◀ ▶ LRM, ▲ ▼, ← →), so they look as on the remote, and the search hint's arrow points the reading way («הקלידו שם ← OK»).

**Groups and the upgrade.** A playlist's channels with no group form our «No group» (id `''`, menu key `none`, translated); a provider group named «Undefined» or «Без группы» is the provider's and is shown as given. Saved keys keep their frozen words («канал», «Без группы»). A zap group remembered by 1.8.4 under a Russian category name («grp:Новостные», «grp:Детские», «grp:Без группы») is found again (the group holding the channel being watched, else the first in the menu) and remembered by its new key once. An offline copy written by 1.8.4 (v1) reads its group ids back from the channel keys.

**The offline copy (v2).** A row starts with the key and leaves out what the key or the place already gives: the number (its place), the id when the key holds it exactly (checked on write; an id with «|» or none is kept), and trailing empty values; an unnamed entry is written with an empty name and shown in the reader's language. Every channel comes back field for field (test below). The real 11 340-channel iptv-org list: see docs/PERFORMANCE.md (P-1). The copy stays a fallback and a first paint: the fresh list always downloads at boot and replaces it.

| Test | Proves (register item) |
|---|---|
| `tests/browser/mixed-text.test.mjs`, per he / en / ru: `mixed text: <lang> — channel names (emoji- and flag-first, digits only, wrapped) read as written; ★ before, ▶ after, at the interface ends; one edge and font` | 1, 2, 3, 22: 16 names incl. 🇮🇱/📺/🎬-first, digit-only, two that wrap (both directions, every line at its own start edge), the direction each cell gets, ★ and ▶ sides, one edge and one font |
| same file: `mixed text: <lang> — the «now» lines, the groups, the banner, search «group · programme», the programme panel, the archive title and «(… until HH:MM)» read as written` | 21, 22: every screen where provider text meets ours; panel titles that wrap in both directions keep one edge |
| `tests/browser/i18n-rtl.test.mjs`: `i18n browser: in en/he every [data-t] text and the search placeholder are the dictionary's, in en/he (no Russian left)` (renamed from `… are translated (no Russian left)`) | 24: each page text equals the dictionary's, Hebrew texts carry Hebrew, English texts carry Latin and no Hebrew; literal placeholder and titles |
| `i18n browser: in Hebrew the slider's «1 h 5 min behind live» reads right to left between its left-to-right ends` | 6 |
| `i18n browser: in Hebrew the hints' arrow pairs look as on the remote (◀ left of ▶, ▲ before ▼) and the search arrow points from the name to OK` | 7 |
| `i18n browser: the search results have no divider line beside them (no groups column there)` | 14 |
| `i18n browser: in ru/uk/he/en a message in «⚙ Settings» and «📡 Providers» covers neither the icon, the title nor a row` | 15 / 35: messages on these two screens sit on the hint band |
| `tests/browser/hint-gap.test.mjs`: `hint gap: on a 1280×720 screen in Hebrew the <screen> rows end at least 8 px (scaled) above the hint bar` (4 screens) | 13, 25: the canvas is on screen (scaled toward its right edge) and the gap holds |
| `tests/i18n.test.js`: `iso: a text's direction is its first letter's — emoji and flags (surrogate pairs), digits (Arabic-Indic too) and punctuation are skipped`; `iso: a text with no letter at all (digits, signs) reads left to right — embedded so in Hebrew, as given otherwise` | 1, 2 (exact strings) |
| `i18n: a provider of one's own (a host name) and the picture size read left to right in Hebrew; a track's language is wrapped as provider text` | 4, 5, 8, 29 (decimal separator from the dictionary) |
| `i18n: the language row starts with 🌐 in every language …`; `i18n: Hebrew uses one quotation style (") and its arrow pairs are pinned left to right` | 17; 16, 7 |
| `i18n: Russian and Hebrew plural forms` (now asserts the Hebrew words) | 20 |
| `i18n: in «⚙ Настройки» OK on «Язык интерфейса» goes …` and `i18n: the language switch keeps the channel being watched …` (both now boot a successor app from the previous one's storage) · new `i18n: a language change keeps the channel and the group: three restarts in a row, each from the previous app's storage …` | 23 |
| `i18n: an entry with no name is not taken for an Israeli channel in Hebrew (its placeholder «ערוץ» is not its name)` | found while fixing 9: `Country.detect` read the Hebrew placeholder as a name |
| `tests/groups-and-copy.test.js` (25 tests at fix batch 4): groups «Undefined» / «Без группы» / none; «General;News»; the 1.8.4 zap group and v1 copy; the copy across languages field for field (unnamed, «#2» duplicates, an id with «|», archive); group kept by id; freshness pins (the boot download replaces a saved copy; ~~an unchanged playlist downloaded on schedule but not parsed~~ — removed in batch 2, item 2: every downloaded list is parsed and applied; a changed one applied on the next refresh; ~~no Last-Modified → parsed every time~~ — superseded (batch 3, item 3) by «every downloaded playlist is parsed and applied», whatever the headers; OTT Club's list always applied; the open menu re-reads «now» every 60 s) | 9, 10, 11, 12, 36, 38 and the owner's freshness rule |
| `tests/logos-and-redraws.test.js` (6 tests): logos at once on the first opening and on a single step after a pause; none for pages flicked past, the resting page's after `NOW_QUIET_MS`, names and «now» lines never waiting; the menu laid out ahead after a failed first start; the banner logo not reloaded; one day read per panel key | 37, 39, 43, 44 |
| `tests/list-end.test.js`: `list end: the Russian plural of «канал» …` (now through `I18n.n`) | 26 |
| `tests/menu.test.js`: `eligibility (pin): an adult channel is not listed …` (default settings) | 32 (owner ruling below) |

Replaced (old names → new): the 6 `mixed text: <he|en|ru> interface, playing «Channel 9 [RU]» / «כאן 11 (HD)» — provider names read as written, ▶ at the interface end, one edge and one font per column` → the 6 `mixed text: <lang> — …` tests above (the old ones read the cell's first text node, which the per-text element replaced, and skipped wrapped names); `i18n browser: in en/he every [data-t] text and the search placeholder are translated (no Russian left)` → `… are the dictionary's, in en/he (no Russian left)`.

**Owner decision (2026-10-27): adult channels hidden by default.** Verbatim: «Для взрослых нужно скрывать по умолчанию всегда». The group «Для взрослых» is hidden until «Каналы для взрослых» is switched on in «⚙ Настройки» — the one exception to «не фильтруем». Pinned by `eligibility (pin): …` with default settings. Status: DEFERRED-USER-APPROVED (owner design).

**By design: switches are not mirrored in Hebrew** (design review F9). «On» keeps the knob on the right in every language; the blue colour carries the state. Kept.

**Register 2026-10-27 — status of every item** (file:line after this batch):

| # | Item | Status |
|---|---|---|
| 1 | first-strong detection: surrogates, punctuation, Arabic-Indic digits | APPLIED — js/i18n.js:215-241 (firstStrong, otherDir, iso) |
| 2 | no-letter names in RTL | APPLIED — js/i18n.js:231-234 (no letter: left to right) |
| 3 | wrapped provider text: lines 2+ at the wrong edge | APPLIED — js/listrows.js:8-12, :33-54; css/app.css:66-72 |
| 4 | host/URL provider labels | APPLIED — js/sources.js:73, :307 (`I18n.ltr`); js/overlays/sources.js (no `iso` on our own texts) |
| 5 | track language | APPLIED — js/avtracks.js:41 |
| 6 | Hebrew slider delta | APPLIED — css/app.css (`[dir="rtl"] .scrub-delta`) |
| 7 | Hebrew arrow pairs, search arrow | APPLIED — js/i18n.js (h.menu, h.prog, h.search, h.scrub, h.first, h.firstDesktop, st.hint) |
| 8 | 1920×1080 reversed in Hebrew | APPLIED — js/avtracks.js:20 (`I18n.ltr`) |
| 9 | «Undefined» / no group / provider «Без группы» | APPLIED — js/m3u.js groupId, js/i18n.js group, js/channels.js rebuild (key `none`), js/ottclub.js:78 |
| 10 | upgrade of `grp:<Russian>` and v1 copies | APPLIED — js/channels.js upgradedGroupKey, js/zap.js savedIndex, js/sources.js unpackV1, js/m3u.js groupIdOfKey |
| 11 | `unnamed` lost in the copy | APPLIED — js/sources.js row/pack (empty name) |
| 12 | copy writing the group id untested | APPLIED — tests/groups-and-copy.test.js |
| 13 | 1280×720 Hebrew fit | APPLIED — js/ui.js:11-16 (boot applies the language before the first fit; a language change restarts the app) |
| 14 | divider beside search results | APPLIED — css/app.css (`.search-wrap:before`) |
| 15 | toast over the app icon | APPLIED (= 35) |
| 16 | Hebrew quotation marks | APPLIED — js/i18n.js set.playlist |
| 17 | 🌐 on the language row | APPLIED — js/i18n.js st.language (4 languages) |
| 18 | switches not mirrored in Hebrew | owner design — kept (note above) |
| 19 | Tizen Hebrew font weight / 24 px grey | OPEN-NEEDS-TV (below) |
| 20–25 | tests | APPLIED — tables above |
| 26 | dead `Util.plural`, `I18n.has`, `I18n.LANGS` | APPLIED — removed; list-end test on `I18n.n` |
| 27 | `(groupId \|\| group)` fallbacks; duplicate eligibility rule | APPLIED — js/channels.js:12-13, js/country.js:35 (id only) |
| 28 | `DEFAULT_NAME` module state; duplicated «Без группы» literal | APPLIED — js/m3u.js:6-8 (frozen key words named once; the name passed per parse) |
| 29 | decimal separator outside the dictionary | APPLIED — js/i18n.js `num.decimal`, js/avtracks.js:11 |
| 30 | orphan comment; stale test comment | APPLIED — js/i18n.js, tests/sources.test.js:53 |
| 31 | docs | APPLIED — this section, README, docs/PERFORMANCE.md |
| 32 | adult hidden by default | DEFERRED-USER-APPROVED (owner decision above) |
| 33 | gap 40 px between groups and channels | APPLIED earlier — unchanged |
| 34 | scroll bars 6 px | APPLIED earlier — unchanged |
| 35 | toast over the icon | APPLIED — css/app.css (on «⚙ Настройки» and «📡 Провайдеры» a message sits on the hint band) |
| 36 | P-1 offline copy over the cap | APPLIED — js/sources.js row/fromRow (v2) |
| 37 | P-2 logos for every paged row | APPLIED — js/listrows.js setLogo/showLogos |
| 38 | P-3 identical list re-parsed | APPLIED then **REMOVED in batch 2** (review 4, REGISTER2 item 2: the `Last-Modified` + length skip kept a same-length rewrite stale; every downloaded list is parsed and applied) |
| 39 | P-4 menu laid out only at a first frame | APPLIED — js/app.js onError (laid out after a failed start; not at list time, so a starting stream keeps the bandwidth and the thread) |
| 40 | P-5 unsliced split | OPEN-NEEDS-TV |
| 41 | P-6 first layout before boot | OPEN-NEEDS-TV; the doc claim is corrected (docs/PERFORMANCE.md) |
| 42 | P-7 favourite toggle 34 ms | no change (measured cost recorded in docs/PERFORMANCE.md) |
| 43 | P-8 banner logo re-set | APPLIED — js/ui.js:28 |
| 44 | P-9 day list twice per key | APPLIED — js/overlays/panel.js |
| 45 | P-10 regexes per call | APPLIED — js/i18n.js `PLACEHOLDER`; the group regex is gone with item 9 |
| 46 | P-11 doc cadence | APPLIED — docs/PERFORMANCE.md («now» policy: 60 s) |

**Needs the TV** (the owner is away; the TV is not touched in this batch):
- the Hebrew font on Tizen 3: a real 600/700 weight next to Latin, and the 24 px grey «now» lines from the sofa (item 19);
- the localStorage quota on the TV (decides whether the 2.1 M-char copy of the default list is kept there) (P-1);
- the first page layout before boot and the menu's first layout (P-4, P-6, item 41);
- the 11 340-channel list on the TV: download time, the longest pause (the unsliced `split`, P-5, item 40), list ready;
- logo decoding and memory while paging (P-2);
- AVPlay's synchronous calls per zap (PE-23);
- the whole batch on the device: mixed names, wrapped names, Hebrew hints and the slider line, the toast on «⚙ Настройки».

**Added during the batch (owner, 2026-10-27).**
- **Version 1.9.0** («Не забудь поднять версию приложения»): `config.xml` and `CONFIG.VERSION` 1.8.4 → 1.9.0 (pinned equal by `config (pin): CONFIG.VERSION equals the widget version in config.xml`). The «1.8.4» in `js/channels.js` and `tests/groups-and-copy.test.js` names the release whose saved data is upgraded, not the current version, so it stays.
- **The channel list every hour** («Нужно сделать раз в час»): `PLAYLIST_REFRESH_MS` 6 h → 1 h, every provider. New test `refresh (owner 2026-10-27: «Нужно сделать раз в час»): the channel list and its groups are downloaded every hour, for every provider; a changed list is applied after one hour`. The «now» tests count the «now» requests (`?t=`) apart from the hourly catalog: `now refresh (A1, B1) …` still requires every re-read exactly 60 s after the previous answer, plus one immediate re-read after each catalog from the provider's cache (D6b); `now line: a refresh is one … request …` and `now line: every refresh is justified …` now expect 118 re-reads + 2 catalogs in 2 h with no «now» source more than 61 s from the next (was 119 re-reads, no catalog); `now retained … only 50 of 389 channels …` checks the marks within the first catalog hour (E+14/16/25; the hourly catalog names every channel again). The outage tests do not count an aborted request (cancelled by the catalog download and sent again after it) as a failed attempt.
- **A defect the hourly refresh exposed, fixed:** the catalog download aborts a «now» request in flight; when that download failed, nothing re-armed the «now» governor and the 60 s retries stopped (40 attempts in 61 min). `NowLines.cancel()` re-arms after an abort (`js/nowlines.js`). Pinned by the outage tests (mutation M56).
- **The first launch** («А если я первый раз установил плеер и запустил — мне он должен предложить выбрать источник — то меню, что мы сделали»; «Если я выбрал ОТТ Клуб — ещё и ввести код»): with nothing saved and nothing built in, «📡 Провайдеры» opens titled «Выберите, что смотреть» and nothing plays or downloads behind it. OK on a playlist starts it (the one switch), and every later launch opens the last source, group and channel. OK on OTT Club with no key opens the key screen at once (the key is saved exactly as typed and goes only to OTT Club); Back from the key screen returns to the choice. Back on the choice starts the free iptv-org channels, so the screen is never left with nothing. A key or playlist built in (`build.local.env`) is not a first launch. **This replaces Codex R7's behaviour** (a fresh install played the first free playlist at once). Tests: `tests/first-launch.test.js` (6); `fresh install (no key, no playlist): iptv-org's whole list plays at once — free out of the box` → renamed `fresh install (no key, no playlist): «📡 Провайдеры» opens to choose; Back plays iptv-org's whole list — free out of the box`.
- **Found while fixing, fixed:** an unnamed entry's Hebrew placeholder «ערוץ» made `Country.detect` take it for an Israeli channel (it jumped to the top in Hebrew); the Hebrew providers note read «iptv-org · OTT Club בחינם» (two Latin names merged into one run; an RLM separates them; pinned in `i18n browser: in Hebrew the hints' arrow pairs …`); on «⚙ Настройки» the message now takes the whole hint band instead of half-covering its words.
- **Residual (LOW, recorded):** a wrapped sentence of ours that holds provider text (the slider's «channel · programme» title, the banner title) still wraps its second line to the interface's edge; the per-text fix (item 3) is in the list cells. A logo that fails to load shows the browser's broken-image box (pre-existing; desktop screenshots, where the logo hosts are not reachable).

**Mutation proofs (VG-6), 2026-10-27.** Each mutant: the pattern counted exactly once before writing, the change verified on disk, the named tests run, the file restored and compared byte for byte with a copy taken before (`cmp` rc 0 for every row). 51 mutants, all **killed** after two corrections of the tests themselves: M21 (`EPG.label` without `iso`) first **survived**, because the mixed-text test compared only letters and digits and its titles had no neutral edges; the test now compares every visible character and has titles like «שידור חי!», «20:00 החדשות», «Live!», «(HD) Discovery», and M21 is killed (3 of 6). M59 (the watching hint over the first-launch choice) survived because the toast was checked after it had gone; it is checked at 3 s now and is killed. Three mutants (M1, M1b, M7) were first refused by the count guard (their pattern held `\u` escapes the spec had turned into characters) and ran after the spec was fixed.

**Desktop screenshots** of this tree (headless Chrome, not the TV): the menu, «⚙ Настройки» with a message, the programme panel, the slider, search, the banner with mixed names — in Hebrew and English; the menu with mixed names in Russian; the first-launch choice in Hebrew and English.

## Fix batch 2 — review 4 of 1.9.0 (2026-10-27)

Four reviewers (native, Codex, performance, design) read the whole uncommitted 1.9.0 change; their register is
`scratchpad/review4/REGISTER2.md` (33 items). Items 1–30 were fixed in one pass; 31–33 are the owner's decisions and the
code is unchanged for them. Version stays **1.9.0**. The stream path (AVPlay open/close, buffers, retry timings) is unchanged;
only *when* the hidden menu is laid out on a failing stream moved (item 13). No refresh interval was lengthened, no download is
skipped, no cache was added — one was removed (item 2).

**Coordinator decisions applied.** Item 2: the «skip the parse when `Last-Modified` and the length are unchanged» shortcut is
removed; every downloaded list is parsed and applied (owner: «Нужно сохранить баланс между производительностью и
достоверностью информации … актуальные списки каналов и групп»; «избыточного кеширования тоже не должно быть»). Item 1: any
state with no usable source goes to the source choice. Item 13: the menu is prepared from the player's 4th attempt. Item 21: a
fixed-width icon box, not `⚙️` (see the row). Item 22: a first-launch key prompt `set.keyFirst`.

| # | Item | Status | Where |
|---|---|---|---|
| 1 | no source + a saved last channel: request to '', fatal loop, empty own provider, menu unreachable | APPLIED | js/sources.js:27 `firstLaunch() = !mode()`; js/sources.js:84 `addUser` ignores an empty link; js/app.js:61-67 |
| 2 | skip-parse by `Last-Modified` + length kept a changed list | APPLIED (removed) | js/sources.js:132-147 (every list parsed and applied); js/net.js back to `done(err, text)` |
| 3 | 1.8.4 «Новостные» with both «News» and a literal «Новостные» | APPLIED | js/channels.js:58-81 `upgradedGroupKey` (the group holding the channel watched decides) |
| 4 | v1 migration stripped a genuine «#N» (Music#2) | APPLIED | js/m3u.js:9, :133-139 (`shown` tells a repeat's «#2» from the group's own) |
| 5 | non-spacing marks taken for strong letters | APPLIED | js/i18n.js:223-232 `MARK` (Unicode 16 Mn + Me, generated) |
| 6 | dead `!fromSaved` in the skip | APPLIED (gone with item 2) | js/sources.js:132-147 |
| 7 | `Zap.group()` wrote storage while answering a query | APPLIED | js/zap.js:91-103 (`savedIndex` pure; `onListApplied` migrates once); js/app.js:81 |
| 8 | v1 unnamed entry kept «Канал» | APPLIED (cheap) | js/sources.js:270-280 `unpackV1` (no id + key head «канал» → unnamed, named in the interface language) |
| 9 | no freshness pin for the playlist's guide on refresh | APPLIED (test) | tests/groups-and-copy.test.js «the playlist's own guide (url-tvg) is handed to the guide with every hourly list …» |
| 10 | search «group · programme» untested | APPLIED (test) | tests/browser/mixed-text.test.mjs (order asserted; group «Paramount+») |
| 11 | logo tests passed with no rows drawn | APPLIED (test) | tests/logos-and-redraws.test.js `wrongLogos` (≥ 12 rows, identity, name, logo, visible) |
| 12 | P4-1 offline-copy write one 52–58 ms task | APPLIED | js/sources.js:223-240 (three idle tasks; no write during a switch); js/util.js:20-34 `saveJson` |
| 13 | P4-2 menu prepared on the first player error | APPLIED | js/app.js:24-31 (from attempt 4) |
| 14 | P4-3 guide walk for a playlist with no guide URL | APPLIED | js/sources.js:192-197 `guideFrom` |
| 15 | P4-5 deferred logos for a closed menu | APPLIED | js/listrows.js:74-99 (`showLogos` skips a closed menu; a reopened one draws its waiting logos) |
| 16 | P4-4 doc numbers of the copy write | APPLIED | docs/PERFORMANCE.md P-1 row (correction) and the review-4 rows |
| 17 | TV-R1 single-sample TV rows | OPEN-NEEDS-TV | three repeat runs of `s-fullnav`, `s-stream`, the archive scenario on 1.9.0; judge by the median (coordinator's TV series) |
| 18 | Hebrew dedication in fake italic | APPLIED | css/app.css:244-245 |
| 19 | dead `direction: ltr` on `.switch` and `.scrub-bar` | APPLIED | css/app.css:236-243 (comment says why the rest stays) |
| 20 | `.setup-text` unbounded (uk 1761 px) | APPLIED | css/app.css:106 |
| 21 | «⚙» small, its name 14 px off | APPLIED (icon box) | js/overlays/menu.js:60-66; css/app.css:73-76. `⚙️` (U+FE0F) was **not** used: whether Tizen 3's fonts draw it as an emoji cannot be shown without the TV (not touched in this batch); the box aligns the names whatever the glyph's size |
| 22 | first-launch key prompt spoke of a saved key | APPLIED | js/i18n.js:56 `set.keyFirst` (4 languages); js/overlays/setup.js:18-19 |
| 23 | toast band rule fragile (specificity, 72 px ×3, z-index outside the block) | APPLIED | css/app.css:159 (`.about` in the z-index block), :162-168, :180-181 (72 px named both places) |
| 24 | a top toast over the menu covered rows 1–2 | APPLIED | css/app.css:162-168 (over the menu's hint band) |
| 25 | broken-image icon for a logo that fails | APPLIED | js/util.js:61-63 `hideBrokenImage`; js/listrows.js:21; js/ui.js:19, :26-30 |
| 26 | wrapped other-script text keeps its own start edge | no change (owner-accepted rule) | — |
| 27 | «⚙ Настройки» opens a screen titled «Настин кинозал» | owner decision (item 32) | — |
| 28 | `I18n.code` / `I18n.table` exported for tests only | APPLIED | js/i18n.js:259-264 (`code` no longer exported; `table` kept as a declared test seam) |
| 29 | free playlists built twice | APPLIED | js/sources.js:42-50, :66-73 (`list()` filters `freePlaylists()`) |
| 30 | «Без группы» literal repeated | APPLIED | js/m3u.js:141 exports `KEY_NO_GROUP`, `KEY_UNNAMED`; js/sources.js:277; js/channels.js:69 |
| 31 | Settings opens on the language row (one OK restarts in another language) | DEFERRED — owner decision | below |
| 32 | Settings title «Настин кинозал» vs «⚙ Настройки» | DEFERRED — owner decision | below |
| 33 | Hebrew weight 600 on Tizen's fallback font | OPEN-NEEDS-TV | below |

**Owner decisions** (code unchanged; the owner decides):
- **31.** «⚙ Настройки» opens with the cursor on «🌐 Язык интерфейса»; one accidental OK restarts the app in the next language, and coming back takes three more restarts. Options: open on another row (e.g. «Картинка во весь экран»), or ask for a second OK to confirm.
- **32.** The screen opened by «⚙ Настройки» is titled «Настин кинозал» (the app's name, with the dedication), not «Настройки».
- **33.** On the TV, Hebrew falls back from SamsungOne to a system font; whether weight 600 is real or synthetic there, and how the 24 px grey «now» lines read from the sofa, can only be judged on the TV (old register #19).

**Tests** (new names; nothing else renamed): `first-launch` «no source but a last channel saved …», «own providers: a link that is empty is never saved …», «the key prompt for OTT Club says what applies …»; `groups-and-copy` «every downloaded playlist is parsed and applied …», «the playlist's own guide (url-tvg) …», «a 1.8.4 «Новостные» on a list holding both …», «Zap.group() is a query …», «a 1.8.4 offline copy — a provider group «Music#2» …», «a switch to another provider under way keeps no copy …», «a copy longer than SNAPSHOT_MAX_CHARS is not kept …»; `logos-and-redraws` «logos (P4-5) …»; `i18n` «iso: a non-spacing mark …», «iso: the marks skipped are exactly Unicode's non-spacing marks …», «our rows with an icon are «<icon> <name>» …»; `sources` «providers: with two free providers each lists only its own playlists …»; new file `tests/browser/screen-details.test.mjs` (5: the Hebrew dedication, the key prompt width and first-launch text, the icon rows' edge, the toast over the menu, a logo that fails).
Renamed (old → new): `menu (P-4): a first channel that does not play — the menu is laid out ahead anyway, before any picture` → `menu (P-4): a first channel that does not play — the menu is laid out ahead from its 4th attempt («no signal»), never during the three silent retries (review 4, P4-2)`; `refresh (freshness): an unchanged playlist (same Last-Modified, same length) is downloaded on schedule but not parsed again; a changed one is applied on the next refresh` → `refresh (freshness): every downloaded playlist is parsed and applied — one rewritten with the same length under the same Last-Modified too (review 4, Codex 1: no validator stands in for the text)`.
Strengthened, same names: the two immediate-logo tests (Codex 2), the search sentence in the three `mixed text: <lang> — the «now» lines …` tests (F3), `i18n` tests reading the page's `lang` instead of `I18n.code()`.

**Evidence (desktop; the TV was not touched).** ES5 gate (acorn, ecmaVersion 5): 37 of 37 js files parse, rc 0. Full suite with the
browser tests: **350 tests, 350 pass, 0 fail**, rc 0 (JUnit `scratchpad/r28.xml`). By name against the 331 of `r27.xml`: newly
failing 0; newly absent 2 (the two renames above); 21 new names. Mutation proofs (VG-6), run on a private copy of the finished
tree: each pattern counted exactly once before writing, the change checked on disk, the named tests run, the file restored and
compared byte for byte with the tree (`cmp` rc 0 on every row). **29 mutants: 28 killed, 1 survived** — M26 (`guideFrom`
keeping an empty pending guide for a playlist with no `url-tvg`) is equivalent by behaviour (`EPG.load('')` does nothing); the
change it undoes is a cost change, proven by measurement (`PERSIST onFirstFrame sync` 16–17 → 0–0.5 ms at 6×). Mutants that first
survived and the test fixed for them: M14 (a reopened menu that does not draw its waiting logos — the test reopened on another
page; it now flicks back to the first page before closing), M16 (the search group without its embedding — the fixture's groups
were all read right by the bidi algorithm without it; a group «Paramount+» ending in a neutral sign is the case), M27 (free
playlists not filtered by provider — equivalent with one provider; a two-provider test was added), M29 (the copy's size cap —
untested before this batch; pinned now). M11 was first refused by the count guard (wrong pattern) and ran after the spec was
fixed.

**Desktop screenshots** (headless Chrome 1920×1080, not the TV; the stand refuses every stream and logo, and the buffering spinner
is hidden by an injected style): `scratchpad/shots-batch2/<he|uk|en>-01-settings-dedication`, `-02-key-prompt`,
`-03-key-prompt-first-launch`, `-04-menu-settings-row`, `-05-menu-toast`, `-06-menu-missing-logos` (18 files).

**Needs the TV** (added by this batch): the three-step copy write and the hourly parse of the 11 340-channel list on the device
(desktop 6×: tasks 15–23 / 31–36 / 15–22 ms; parse 203–220 ms wall, no long task); whether the menu laid out at «no signal»
(attempt 4) is noticed; the ⚙ icon box next to 🔍 📡 in Tizen's fonts; register item 17 (three repeat runs of the TV
scenarios, judged by the median) and item 33.

## Fix batch 3 — review 5 of 1.9.0 (2026-10-28)

Review 5 of fix batch 2: native APPROVE, performance APPROVE, design APPROVE, Codex REJECT (batch 2 item 15 incomplete). The
coordinator's register `scratchpad/batch3/REGISTER3.md` holds 7 items; all 7 were fixed in one pass. Version stays **1.9.0**.
The stream path (`js/player.js`, `js/playback.js`, `js/avtracks.js`), `js/net.js` and the banner are byte-identical to the
pre-batch tree. Every downloaded list is still parsed and applied every hour; the only work now skipped is rewriting the
offline copy when the downloaded text is byte-identical to the text that copy was written from (item 5).

| # | Item | Status | Where |
|---|---|---|---|
| 1 | Codex 15: logos loaded into the hidden menu rows while «📡 Провайдеры» (BLUE), «⚙ Настройки» or «🔍 Поиск» was open over it (13 picture requests) | APPLIED | js/listrows.js:6-7 (each row pool names the overlay that shows it); js/listrows.js:94-99 (`showLogos` serves only the pools of the overlay open now) |
| 2 | NB-1: the 1.8.4 group upgrade re-ran on every hourly list, so a literal «Новостные» kept by the first list (or picked in 1.9) could become «News» when the provider moved the channel | APPLIED | js/zap.js:6-10 (`zapGroupsSettled`: the keys 1.9 picked or already looked at), js/zap.js:57 (a pick settles its key), js/zap.js:99-109 (a list upgrades only a key not settled yet, then settles the result). Per key, not one flag: a source switched to brings back its own group, possibly one 1.8.4 wrote, and that one is still upgraded |
| 3 | NB-2: the «no Last-Modified → parsed every time» pin was still listed | APPLIED (wording) | this file, the `tests/groups-and-copy.test.js` row of the localization review 3 section |
| 4 | NB-3: during a provider switch the copy's rows and JSON idle steps still ran | APPLIED | js/sources.js:228-243 (`dropped(p)` checked at each of the three steps; the write-time check kept) |
| 5 | N5-2: every hourly apply rewrote the 2.14 M-char copy even when the list was unchanged | APPLIED | js/sources.js:9-12, :148, :178, :190-193 (the copy is wanted only when the downloaded text differs from `copiedFrom`, byte for byte), :245-251 (`copiedFrom` is set only by a successful write, reset by a failed one). The list itself is parsed and applied every time |
| 6 | NB-4 + design N1: the menu's toast stood 12 px above the hint band (72 vs 60 px) and grew upward | APPLIED | css/app.css:172-175 (`min-height: 60px; padding: 8px 40px` — one line is exactly the band; the text still wraps, never truncates) |
| 7 | design N2: the focused group row drew its ⚙ about 3 px further toward the edge | APPLIED | css/app.css:90-93 (a focused group grows from its start edge: `transform-origin` 0 / 100% in Hebrew). The focus scale itself is kept; the focused band now stays flush with the column's start edge and grows toward its end |

**New tests (9; none renamed, none removed):**
- `logos (P4-5): «📡 Провайдеры» (BLUE), «⚙ Настройки» or «🔍 Поиск» opened over the menu while its logos wait …` (red before: 13 logo writes).
- `upgrade: the 1.8.4 group is upgraded once …` — the first list keeps the literal, a later list and a restart do not move it, a group picked in 1.9 is not moved (red before: `grp:News`).
- `upgrade: a source switched to brings back its own group remembered by 1.8.4 — upgraded then …`.
- `offline copy: a switch under way stops the copy at the next idle step …` — before the rows: no rows, no JSON; during the rows: no JSON (red before: rows and JSON built).
- `offline copy (freshness): a downloaded list byte-identical to the one the copy was written from is parsed and applied, and the copy is not written again; the first list of a page life always writes it` — two identical hours: 3 parses, 3 applies, 1 write; one byte changed at the same length: written (red before: 3 writes).
- `offline copy (freshness): a list B whose copy is still being built when the list A … comes back — B's copy is dropped, A's stays`.
- `offline copy (freshness): a list whose copy could not be kept (too big) leaves none — the list the old copy came from, downloaded again, writes it again`.
- `screen details: a message over the channel menu ends where its hint band ends, one line exactly as tall; every message, in all four languages, wraps in at most 2 lines and never reaches the rows` — the 41 message keys on the code's toast lines, read from the code, each with a 63-character argument (red before: 984–1056 vs the band 996–1056).
- `screen details: the focused «⚙ Настройки» row draws its icon where the unfocused one does (within 1 px) — ru and he` (red before: 78.6 vs 82 px).

**Suite:** 359/359 (`tests/run.sh --browser`), by name against review 5's r29: 0 newly failing, 0 newly absent, 9 new.

**Mutation evidence:** 17 mutants on a private copy, each pattern counted once before writing, verified on disk, the named tests
run, the file restored and compared with `cmp` (rc 0 on every row): **17 killed, 0 survived.** A first design of item 2 (one
«upgraded» flag for all keys) was replaced before the final run: it would have left a 1.8.4 group remembered for another source
un-upgraded after a switch; the per-source test pins it (mutant N16).

**Desktop screenshots** (headless Chrome 1920×1080, not the TV; streams refused, the spinner hidden by an injected style, logos
served as numbered data-URI badges): `scratchpad/shots-batch3/<ru|he>-01-providers-over-menu`, `-02-menu-reopened-logos`,
`<ru|he|uk|en>-03-menu-toast-one-line`, `-04-menu-toast-two-lines`, `<ru|he>-05-settings-row-focused`, `-06-settings-row-unfocused`.

**Needs the TV:** the toast band against Tizen's font for the hint (60 px = 10 + 39 + 10 + 1 on desktop; the hint's `line-height`
is `normal`, so a different font could make the band 1–3 px taller or shorter than the toast); the held previous list text
(about 2.58 M chars, a two-byte string, ≈ 4.9 MB) in the TV's memory budget.

## Fix batch 4 — review 6 of 1.9.0 (2026-10-28)

Review 6 of fix batch 3: native APPROVE, performance APPROVE, Codex REJECT (batch 3 item 2 regression), design REJECT (batch 3
item 7 regression). The coordinator's register `scratchpad/batch4/REGISTER4.md` holds 4 items; all 4 were fixed in one pass.
Version stays **1.9.0**. The stream path (`js/player.js`, `js/playback.js`, `js/avtracks.js`), `js/net.js` and the banner are
untouched. Every downloaded list is still parsed and applied every hour.

| # | Item | Status | Where |
|---|---|---|---|
| 1 | Codex (batch 3 item 2 regression): the «already looked at» marks were kept by group key only, so OTT Club's own «Новостные», once settled, kept another source's 1.8.4 «Новостные» from becoming «News» after a switch | APPLIED | js/zap.js:8-12 (the marks are per source: `'<source id>\n<key>'`, as each source keeps its own group in `lastBySource`), js/zap.js:106 (the list checks the mark of the source on screen), js/zap.js:111-112 (`settle` / `mark`) |
| 2 | design (batch 3 item 7 regression): the focused group grew 1.02 from its start edge only; the column (`overflow: hidden`) cut its far end square (7.6 px) and the count jumped 7.2 px | APPLIED | css/app.css:90-93 (rule at :93) — a focused group does not grow (`transform: none`); the two `transform-origin` rules are gone. Channel rows keep their 1.02 |
| 3 | perf F3-1: the text the copy was written from could be a second 4.9 MB string equal to the one the list on screen holds | APPLIED | js/sources.js:194-196 (line :196) — a byte-identical download becomes the held text (`===` kept, no hash) |
| 4 | native N6-1: the `tests/groups-and-copy.test.js` row said 11 tests | APPLIED (wording) | this file, the localization review 3 section: 25 tests |

**Tests:** one new, one renamed (none removed):
- new `upgrade: OTT Club's own «Новостные» settled does not settle another source's 1.8.4 «Новостные» — upgraded to «News» after the switch (review 6, Codex)` — Codex's reproduction, and back to OTT Club its literal group is kept (red before: `grp:Новостные` instead of `grp:News`).
- renamed and extended: `screen details: a focused group does not grow — «⚙ Настройки» draws its icon and count where the unfocused row does, its band within the column, both ends round — ru and he (review 5, D-N2; review 6)` (was `… draws its icon where the unfocused one does (within 1 px) …`): computed transform `none`, icon and count within 1 px, band inside the column.

**Mutation evidence:** 9 mutants on a private copy (count 1 asserted, verified on disk, restored, `cmp` rc 0): **9 killed.** B1
(marks by key only again) is killed by the new test; the five batch-3 mutants of item 2 still die; N14/N15 now pin «no scale on
`.grow.focus`» (N15, the batch-3 rules back, measured 82.4 / 425.2 / band 60–447.6 against the column 60–440). Item 3 is not
observable from a test (string identity); its mutant is shown by the heap retainers probe instead: with the line,
`copiedFrom` shares the string the list's 42 167 slices point at; without it, a second 4.91 MB string.

**Desktop measurement** (headless Chrome 1920×1080, not the TV), the same row focused and unfocused: icon, label and count shift
0.0 px in Russian and Hebrew, the band equals the column (60–440 / 1480–1860), radius 14 px at both ends. Screenshots:
`scratchpad/shots-batch4/<ru|he>-b4-band-end-focused`, `-band-start-focused`, `-groups-column-focused`,
`-groups-column-row-unfocused`, `-settings-focused`.

### Fix batch 4, item 6 — the language is picked from a list (owner, 2026-10-28)

Owner: «когда ты нажимаешь кнопку на выбор языка, появилось какое-то меню или отдельная страница со всеми возможными
языками. Я там этот язык выбираю, и он применяется» — one OK moved to the next language, so reaching Ukrainian took several
restarts. Now «⚙ Настройки» → «🌐 Язык интерфейса» (its state reads «Русский · OK — выбрать») → OK opens the language list
(js/overlays/lang.js, markup in index.html `#lang`, the providers list's row style): Русский, Українська, עברית, English,
each written in itself in its own direction, all four starting on the interface's start edge (owner, 2026-10-28: «Выровняй
все языки по одному краю»; the row, its cursor bar and the ✓ follow the interface). The current one is marked ✓ and under the cursor. ▲▼
move (the list wraps), OK on another language applies it (the same restart as before: the channel being watched is
remembered, the language saved, the toast, the reload — the app comes back on the same channel and group), OK on the
current one or Back returns to «⚙ Настройки» on the language row with nothing changed; a second OK before the restart does
nothing. One OK never changes the language any more (this also answers the earlier risk of one accidental OK restarting in
another language). `I18n.next` is gone (no caller left); `I18n.langs`, `I18n.dirOf` and `I18n.code` serve the list.

**Tests** (red first: all 7 failed on the tree before the change — «OK on the language row did not open the language list»
×6 and the «OK — next» text):
- new `tests/lang-list.test.js` (7): the list opens with four rows in their own names, current marked and focused, nothing
  changed (all four languages); from English ▼ ▼ OK on Українська → Ukrainian once, same channel and group after the
  restart; Back (after moving) → settings on the language row, nothing changed, reopened on the current one; OK on the
  current one → no restart, nothing written; a double OK → one switch; each name in its own direction (dir/lang) in Russian
  and in Hebrew; the settings row no longer says «next» in any language.
- `tests/i18n.test.js`: `i18n: in «⚙ Настройки» OK on «Язык интерфейса» goes Русский → Українська → עברית → English → Русский; …`
  is renamed `i18n: in «⚙ Настройки» → «Язык интерфейса» the next language picked from the list each time — Українська, עברית,
  English, Русский; each choice is saved and a fresh app starts in it`; `… keeps the channel being watched, and a double OK
  moves one language only` and `… three restarts in a row …` keep their names and now pick through the list.
- `tests/browser/i18n-rtl.test.mjs`: new `i18n browser: the language list — all four names start on the interface's start
  edge (±1 px), each written in its own direction; the ✓ of the current one on the interface's end — ru and he (REGISTER4 #6)`; the
  toast check over full screens now includes the language list.
- `tests/browser/hint-gap.test.mjs`: the language list is one more screen (3 new tests: 1920×1080, 1280×720, Hebrew).
- `tests/menu.test.js`: the «one overlay at a time» check now includes `lang`.

**Mutation evidence:** 11 mutants (L1–L11: no list on OK, no double-OK guard, OK on the current restarts, Back to the menu,
cursor on the first row, names in the interface's direction, current not marked, the channel not remembered, the Hebrew
alignment rule removed, the empty ✓ box's margin kept, «OK — next» back): **11 killed**, every file restored (`cmp` rc 0).
After the owner's «Выровняй все языки по одному краю» the names align to the interface's start edge (`#lang .src-t` left,
right under `[dir="rtl"]`); 4 more mutants: the per-name alignment back, no Hebrew-interface rule, names without their own
direction — killed; the empty ✓ box's `display: none` — survived (with every name on the start edge the empty box at the
end moves nothing), so that rule was removed as dead CSS.

**Desktop screenshots** (headless Chrome 1920×1080, not the TV): `scratchpad/shots-batch4/<ru|he>-b6-settings-language-row`,
`-b6-language-list`, `-b6-language-list-cursor-moved`.

### Fix batch 4, item 5 — channel logos stay (owner, 2026-10-28; DEC-2026-10-28-logos-page-plus-next)

Owner: «иконки каналов … пропадают и появляются … когда я пролистываю список и возвращаюсь обратно, они заново загружаются,
как будто их и не было»; later: «иконки не должны мерцать, не должны прыгать, не должны исчезать и появляться». Design:
`scratchpad/batch4/LOGO-DESIGN.md` (performance expert), ported from its prototype. Cause, proven by trace: every redraw
within 1 s of the previous one hid each row's logo and dropped its `src` (`listrows.js` `setLogo`), and the pictures came
back 1 s after the last key — blank even with every picture in memory (145 of 222 frames in the owner's case).

Now `js/logos.js` owns every channel logo for the page's life: a loaded URL is painted in the frame its name is drawn in,
with no request; anything else leaves the fixed 72×48 box empty until it arrives — never another channel's picture; the
page on screen and the next one in the direction of travel are asked for after a pause or once the cursor stays 200 ms
(`LOGO_DWELL_MS`), 6 at a time, latest wish wins, nothing for a screen nobody sees (the menu laid out at the first frame
still loads its own page, as before); a 404 is asked once; the hourly list keeps unchanged URLs and forgets dropped ones;
the banner uses the same path. `docs/PERFORMANCE.md` records the logo-cache exception and the before/after numbers.

**Tests:**
- the harness has an image model (`tests/harness.js`): downloads per URL (`app.images.requests`), in-flight sharing, the
  page's memory cache, 404s not cached, `el.showing` = the picture painted (a new `src` keeps the previous one until the
  new one arrives; `removeAttribute('src')` drops it). It breaks no existing test.
- new `tests/logos-cache.test.js` (10). Red on the tree before the change: 6 (flick back: «page 1 at the key: empty ×13»;
  requests: 13 ≠ 26; nothing started after the key; a 404 asked again; the old picture not kept during an hourly change;
  the banner showed the previous channel's picture). Added while proving mutants: a menu closed while the opening's
  pictures are on their way starts none after (in test 8), a new wish shares downloads under way (test 9 of 10), and a URL
  the hourly list dropped is forgotten (in test 7).
- `tests/logos-and-redraws.test.js`, re-expected under the decision id, names unchanged: `writes` counts downloads, not
  `src` writes (the P4-5 tests keep `=== 0`); «CH− held through 10 pages …» presses every 150 ms (under the 200 ms dwell),
  `after <= 39` (the page after the first press + the page and the next at rest), and a row shows its own picture or an
  empty box.
- new `tests/browser/logo-box.test.mjs`: shown, empty (failed) and no-logo rows have the same 72×48 box and name edge, ru
  and he.

**Mutation evidence:** 12 mutants: 11 killed (404 not remembered, keep-old ignored, no gate, no `removeAttribute` before
the shared load, dwell 0, loaded logo not shown at once, no next-page prefetch, the wish in the key's task, the banner's
old code, no `retain`, in-flight sharing skipped). 1 survives by design: not keeping the loaded `Image` — the harness's
memory cache does not depend on it; on the TV it is what keeps the picture in Blink's memory cache (LOGO-DESIGN §9 P1/P2).

**Desktop, per frame** (6× CPU, 150 ms logos, `logo-probe.mjs`, before = the pre-batch tree): frames with a blank row —
owner's flick ↓3 ↑3 145 → 6 (0 requests on the way back), ▼ ×20 197 → 0, group change 74 → 0, CH− after a pause 9 → 0,
restart CH− ×2 69 → 0; hourly 1 changed URL: 1 request, 0 blank frames. Menu key latency unchanged (PERFORMANCE.md row).
Screenshots 40 ms after the last CH+ of the owner's flick (numbered badge logos): `scratchpad/shots-batch4/<ru|he>-b5-flick-back-40ms`.
**Needs the TV:** LOGO-DESIGN §9 P1 (Chromium 47 image semantics; R1/R2 alternatives ready), P2–P5.

## Fix batch 5 — review 7 of 1.9.0 (2026-10-28)

Review 7 of batch 4: native REJECT, Codex REJECT, performance APPROVE, design APPROVE. The register
`scratchpad/batch5/REGISTER5.md` holds 8 items; all 8 were fixed in one pass. Version stays **1.9.0**; the stream path is
untouched.

| # | Item | Status | Where |
|---|---|---|---|
| 1 | native F1: a logo that failed for a passing reason (503, Wi-Fi not up after standby) stayed empty for the page's life | APPLIED — DEC-2026-10-28-logo-retry-hourly | js/logos.js `retain`: a failed URL still in the list is forgotten at each hourly list, so it is asked for once more when wanted — never within the hour |
| 2 | native F2 (PF-13 T3): a logo download had no timeout; six that never answered held every slot | APPLIED | js/logos.js `load`: after `LOGO_TIMEOUT_MS` (8000, js/config.js) the download is given up — handlers detached, every element sharing it lets it go (`drop`), the slot freed (`done(url, im, false)`, once); the URL waits for the next hourly list (item 1) |
| 3 | Codex C7-1: a pooled row that passed to another channel wanting the same new URL kept the previous channel's picture while it loaded | APPLIED | js/logos.js `put(img, url, key)`: the `<img>` knows the channel it shows; only the same channel keeps its old picture while a new URL loads; js/listrows.js `setLogo` passes the key |
| 4 | Codex C7-2: the second (layout-correcting) fill of a page up was read as a move down, so the page below was asked for | APPLIED | js/listview.js `columns`: the direction is the cursor's, once per render, passed to both fills; js/listrows.js `schedule`/`wantPending` use it (kept when the cursor did not move; at the top, the page below) |
| 5 | native F3 + perf R7-P2: the banner's one-logo wish and the menu's page replaced each other | APPLIED | js/logos.js: one wish per consumer (`want(who, urls, open)`), the banner's first; js/listrows.js asks as its column (`channels`, `search`) and asks for nothing when its screen is not open; js/ui.js asks as `banner` |
| 6 | design N6-1 (owner: «не должны прыгать»): the focused channel row still grew 1.02, its logo moved ~12.8 px | APPLIED | css/app.css: `.focus` has no transform (the `.grow.focus` rule of batch 4 is now the same rule, removed) |
| 7 | native F4: eviction untested (E1/E2 survived) | APPLIED (test) | tests/logos-cache.test.js «beyond LOGO_KEEP …» |
| 8 | native F5 + perf R7-P1: the 4.9 MB text compared twice | APPLIED | js/sources.js: `if (!fromSaved && !copyFor) copiedFrom = text;` — one comparison |

**Tests** (red first on the tree before the change, `scratchpad/batch5/red.txt`):
- `tests/logos-cache.test.js`: the 404 test is renamed under DEC-2026-10-28-logo-retry-hourly («… asked for once within the hour — …
  the next hourly list asks for it once more …»; red: asked once only); new: a 503 shown after the next hourly list (red);
  a download that never answers given up after `LOGO_TIMEOUT_MS` (red: the rest of page 2 never started); a pooled row
  passing to another channel with the same new URL (red: «wrong:14»); page up with the layout's correcting fill asks for
  the page above, and at the top the page below (red: the page above not asked for); the banner and the menu keep their
  own wishes (red: the menu's page dropped by the banner; the banner's own logo dropped by the menu's leftover timer once
  the banner is not redrawn); eviction beyond `LOGO_KEEP` (green before: a pin, kills E1/E2); a row whose picture arrived
  on screen keeps it while the hourly list's new URL loads (a pin).
- `tests/groups-and-copy.test.js` «a list B whose copy is still being built …»: also asserts the copy on disk is not
  written again (a pin for item 8, same name).
- `tests/browser/logo-box.test.mjs`: new «the focused channel row does not grow …» (red on the tree before: the row scaled).
- `tests/harness.js`: `imageStatus` may answer `'hang'` (a host that never answers).

**Mutation evidence** (`scratchpad/batch5/mut-out.txt`, `mut-out2.txt`): 16 mutants, 13 killed (no hourly retry, retry
within the hour, no timeout, timeout without freeing the slot, put ignoring the channel, no cursor direction, never the
page above, nothing at the top, one wish for all, a closed menu emptying the banner's wish, native E1, native E2, the
focused row growing again, the held text following a changed list). 2 survive with a reason: a finished download putting
without the row's channel (every following redraw restores it — no visible effect found); the `copiedFrom` line removed
(memory only, as in batch 4 item 3).

**Desktop measurements** (not the TV): the designer's per-frame pixel probe (`review7/design-probe/frames.mjs`, 6× CPU):
0 wrong pictures in every phase; the owner's flick ↓3 ↑3 10 and 11 frames with a blank row (before 12; batch 4 10–11), 0 on
the flick repeated. Focused vs unfocused channel row: logo box and name edge shift 0 px in Russian and Hebrew. Copy writes
per unchanged hour 0. Menu key latency unchanged. Screenshots: `scratchpad/shots-batch5/<ru|he>-b5-focused-channel-row`,
`-b5-same-row-unfocused`.

### The «⚙ Настройки» screen is titled «Настройки» (owner, 2026-10-28: «экран - Настройки»)

The screen's title was the app's name («Настин кинозал»); it is now the name of its menu row, from the same key `g.settings`
(«⚙ Настройки» / «⚙ Налаштування» / «⚙ הגדרות» / «⚙ Settings»; no second copy of the text): `index.html` `#about-title`
(`data-t`) and `js/overlays/about.js` `open()`, as the language list and «Провайдеры» set theirs. The icon and the
dedication stay. Test: `tests/i18n.test.js` «the «⚙ Настройки» screen is titled as its menu row …» (red before: the title had
no translation). Mutants: the title not set on open — killed; another key — killed; the old literal in `index.html` — survives
(the title is set whenever the screen opens; the literal is only the page's text before that).

## Fix batch 7 — logos ahead of the viewer (owner, 2026-10-28; DEC-2026-10-28-logos-ahead)

Owner: «Видно, как они уродски дорисовываются во время навигации. На границе списков страниц навигация залипает на
переходах»; «хотелось бы по возможности не видеть, как дозагружаются иконки … частями, не всё сразу»; «навигация
максимально мягкая». The perf analyst measured (desktop 20×): the batch-4 pipeline asked for nothing while ▼ was held and
then burst 26 downloads on release (12 empty boxes at once, 551 ms to paint). Changes:

| Part | Where |
|---|---|
| No dwell; window = page on screen + 2 pages ahead + 1 behind, asked for on every fill, keys held too | js/listrows.js `schedule` (the URLs looked up lazily in Logos' idle slot) |
| The zap group's logos trickle in after the first picture (before the menu is opened); a zap pauses the trickle `LOGO_ZAP_PAUSE_MS` | js/zap.js (`Logos.hold()` in `land`, `Logos.want('group', …)` after the first frame), js/channels.js `logos(gi, from)` |
| A group highlighted in the menu goes first among the background loads | js/overlays/menu.js `render` (`Logos.want('highlight', …)`) |
| Paced starts: idle slots only, ≤ `LOGO_STARTS_PER_SLOT` per slot, ≤ `LOGO_PARALLEL` in flight, priority banner > list on screen > highlight > zap group | js/logos.js `want` / `ask` / `slot` / `serve` |
| Pictures arriving together go into the rows on screen ≤ `LOGO_PUTS_PER_FRAME` per frame; rows of a hidden screen get none (they get it when drawn) | js/logos.js `done` / `paint` / `track(img, shown)`; js/listrows.js tracks each pool with its overlay |
| The batch-4 pre-assignment of a loading picture into waiting rows (L10) is gone: `done` → frame queue is the one way a picture reaches a row | js/logos.js `load` |
| Constants | js/config.js (`LOGO_DWELL_MS` removed; `LOGO_STARTS_PER_SLOT` 3, `LOGO_SLOT_MIN_MS` 8, `LOGO_PUTS_PER_FRAME` 4, `LOGO_ZAP_PAUSE_MS` 3000, `LOGO_GROUP_MAX` 400) |

**Tests:** new `tests/logos-trickle.test.js` (7: no dwell; the window; the trickle before the menu, paused after a zap, no
src into hidden rows; the highlighted group first; ≤ 3 starts per idle slot; ≤ 4 pictures per frame; a closed menu's rows get
none). Red first: all 6 of the first version failed on the tree before (`scratchpad/batch7/red.txt`). `tests/logos-cache.test.js`
now turns the zap-group trickle off (its wish is dropped) to pin the menu's own requests; two tests renamed with new
expectations (the opening loads the two pages ahead; CH− held runs ahead, each picture once); the C7-2 test now checks the
order (pages ahead before the one behind); the eviction test uses `LOGO_KEEP` 60 (the window is 52). `tests/logos-and-redraws.test.js`:
the P-2 held test renamed (the group is loaded in the background). Mutation: 12/12 killed (`scratchpad/batch7/mut-out2.txt`).

**Acceptance (desktop 20× CPU, 3 runs per tree, `scratchpad/batch7/perf/agg.txt`):** logos seen arriving 0 in every phase
(1.8.4: 9–72 per cold phase); key→2nd frame medians equal or better; frames over 34 ms fewer in total, but two phases have
one frame more than 1.8.4 in one of three runs (▼ ×6 inside a page; CH− at 250 ms). TV measurement: the coordinator's run.

## Fix batch 8 — the TV regressions of batch 7 (2026-10-28)

The TV run of batch 7 (coordinator): logos seen arriving 0 and empty-box frames 0 in every phase; two regressions against
1.8.4 to fix. R1, boot: «channels ready» after a reload 1087 vs 799 ms. R2, cold CH− paging: key → 2nd frame 56–62 vs
44–54 ms.
- R1: js/logos.js `start()` — no idle slot, so no download, until the list is applied and the first picture is up
  (js/zap.js `onFirstFrame`), or until a screen of logos is opened (js/listrows.js `schedule`), so a stream that never
  plays still gets logos in the menu; `retain` returns at once when nothing is known yet (the first list).
- R2: js/listrows.js `fill` records each row's logo and `logos()` sets them once per render, after the last fill
  (js/listview.js `columns`); js/logos.js `put` keeps the `<img>`'s src and visibility in `logoSrc` / `logoVis` and writes
  them only on change (no `getAttribute` read); `track` hides a picture that fails through the same mirror.
- Tests, new `tests/logos-boot-and-keys.test.js` (3): nothing downloaded before the first picture, then they load (a pin:
  green before as well); a menu opened while no picture ever came gets its logos (red before: 13 downloaded while hidden
  and no picture); a page key sets each row's logo once, ▲ inside a page writes nothing (red before: 26 src writes on a
  page up with the layout's correcting fill).
- Mutation (`scratchpad/batch8/mut-out.txt`): 4 killed (no start gate; an opened screen does not start; visibility written
  when unchanged; logos set in every fill again). 3 survive: the correcting fill calling `logos()` once more (equivalent:
  same start, the mirror writes nothing — replaced by the «every fill» mutant, killed), src written when unchanged (put
  returns before it in every path a test reaches), and `retain`'s early return (performance only).
- Continued (second implementer): the start gate had also taken the logos away from the menu laid out ahead at the
  4th failed attempt (P4-2). On the desktop, which has no stream, this showed as 12 logos seen arriving and 25–28 frames with an
  empty box on «open menu». The rule's other half, «a screen of logos opened starts them», came too late for a hidden menu.
  js/app.js `prepareMenu` now starts Logos once a list is applied. New test 4: no download during the silent retries, then
  the hidden menu loads its page and opens with every box full. It is red without the fix (0 logos) and red on batch 7 (the
  banner's logo was downloaded during the silent retries).
  Test 3 gained an in-frame check: right after a page key, every row whose logo is already loaded shows it. It killed a
  mutant that deferred the logo writes to a 100 ms timer. A 0 ms timer survives: the harness runs due timers inside `press`.
  Suite 402/402. By-name against batch 7 r40: 0 newly failing, 0 absent, 4 new.
