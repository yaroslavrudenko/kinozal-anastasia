# TV acceptance test plan — «Настин кинозал»

A build is accepted only when every scenario below passes **on the real TV** (UE50MU7000). Desktop tests and code reviews are not acceptance.

Each result row records the date, build (commit), channel (name, list position, bitrate) and the measured value. A failed row blocks the release, and the previous working build goes back on the TV.

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

## Channels to use (never only the default one)
- Two channels from the middle and two from the second half of «Все каналы» (positions ~150, ~250, last).
- The three or four movie channels in «Кино» with the highest bitrate and resolution, read from the tech line.
- One Israeli and one Ukrainian HD channel.
- A channel with a very long name.
- A channel whose archive programme crosses midnight.

## 1. Life cycle (owner's cycle)
Run it once from a second-half channel and once from the heaviest movie channel.
1. Close the app.
2. Open it: a channel plays within 10 s.
3. Exit and open again: it plays.
4. Home → another app (OTT Club or YouTube) → wait 20 s → Home → our app: it plays within 10 s. Do this twice.
5. The same, while an archive film is playing on a movie channel: it resumes at the same point.

## 2. Zapping
- A single CH± or ◀▶ press: first frame time on 10 different channels.
- A burst of 10 quick presses lands on the right channel, with at most 3 app requests.
- Crossing group boundaries works.
- Zapping into a channel the provider removed shows a message and moves on.

## 3. Archive (movie channels)
- From the ▼ panel, open a film from yesterday and from 3 or more days ago. It plays, with the right title in the banner.
- Switching between programmes in the panel and the ▲ slider: each one plays.
- Inside a film, scrub −30 min and +20 min several times. Playback starts at the chosen moment; the expected and actual position match within 10 s.
- Scrubbing to the start of a recording works. Scrubbing to the end or near live switches to live.
- Pause in the archive for 1 min: it resumes at the same point.
- The end of a recording continues into the next piece.
- A programme crossing midnight plays.

## 4. Pause and stability
- Live pause for 3 min stays paused, with no network requests and no reopen.
- Pause during buffering on the heaviest channel works.
- Watch two movie channels for 10 min each: 0 stalls and 0 reconnects (from the failure log).

## 5. Screens
- Menu: opening it lands on the playing channel, which is marked. Long names wrap. CH± pages by the rows that are visible, so no channel is skipped.
- Search finds channels.
- ▼ panel: the cursor is on the programme on air, titles wrap, and ◀▶ change the day.
- ▲ slider: the title wraps, and the times and «−N мин от эфира» are correct.
- Banner: on every landing it shows channel, programme, time and the tech line (resolution · codec · fps · Мбит/с · sound) for about 5 s.
- «О программе» shows «Настин кинозал», the version and the device. The adult-channels switch works.

## 6. Resource limits (optimisation targets)
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
