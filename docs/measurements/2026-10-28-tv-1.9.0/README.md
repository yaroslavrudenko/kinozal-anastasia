# TV measurements — 2026-10-27/28, version 1.9.0 (compared with 1.8.4)

The owner asked to keep every measurement in the repository so it can be checked. These are the after numbers for 1.9.0; the baseline is `../2026-10-27-tv-1.8.4/`.

- **TV:** Samsung UE50MU7000, Tizen 3.0 / Chromium 47, at 192.168.1.176.
- **Provider:** OTT Club, 389 channels.
- **Start state:** every run restored the channel that was on.
  - Builds a and b: «188 Киномикс» in «Кино».
  - From build d on: «3 Channel 12 (Израиль)» in «Израиль», the channel the owner had left on.
- **How it is measured:** `scenarios/cdp.mjs` connects to the app's inspector and drives it with remote key events. Run `node cdp.mjs <port> <scenario> [args]`.
  - **Fixed since the 1.8.4 baseline:**
    - one clock: key time and result are both read inside the TV page;
    - the big spinner is timed exactly inside the page.
  - **Not comparable across the two series:** the 1.8.4 spinner figures are understated, so compare spinner rows only between 1.9.0 runs.
  - **After every launch,** scenarios wait 6 s before connecting: without the pause the inspector refused, see `b-batch2/failed-no-pause/`.

## Builds measured

| Folder | Build | Installed |
|---|---|---|
| `a-first-build/` | first 1.9.0 build (localisation, hourly list, first launch) | 2026-10-27 21:52 |
| `b-batch2/` | after fix batch 2 | 2026-10-27 23:42 |
| `d-batch4-items1-4/` | after fix batches 3 and 4 (items 1–4; logos not yet changed) | 2026-10-28 ~02:05 |
| `f-batch5/` | after fix batch 5: new logo pipeline, language list, no scale on focused rows | 2026-10-28 night |
| `logo-probes/` | image semantics of Chromium 47 (P1) and logo flicker before the fix (P2), on build d | |

## Channel logos — the owner's complaint (vanish / reappear while scrolling)

Owner's case: menu open, CH− ×3 then CH+ ×3, 250 ms apart. Per animation frame inside the page:
- **blank:** a row that should show a logo shows none;
- **wrong:** a row shows another channel's logo;
- **vanished:** a logo that was shown disappeared and came back.

| Phase | Build d (before) | Build f (after) |
|---|---|---|
| Owner's case: frames with a blank row | 96 of 281 (up to 12 rows) | **0 of 287** |
| Same again over pages already seen: blank frames, vanished | 92, 6 vanished | **0, 0** |
| Requests on the way back | 6 | **0** |
| Down ×12 at 150 ms: blank frames | 181 | **0** |
| Close + reopen | 0 | 0 |
| Wrong logo in any frame | 0 | **0** |

- **Restart of the app, same list:**
  - within the hour: the first opening had 0 blank frames; flicking pages already seen made 0 requests;
  - after more than an hour: the same. Logs: `f-batch5/P3-*`.
- **Layout:** the logo box stays 72×48 and the name at x 668 at the key, while flicking and after settling (`f-batch5/P5-layout.log`).
- **P1 (Chromium 47):** clearing `src` removes the old picture at once, and a URL held by a live `Image` completes synchronously (onload 4 ms). The design's default path stands.
- **Not measured:** device memory with the logo map. `P4-mem.log` returned no data; the probe needs fixing.
- **Note:** `f-batch5/logos-flick.log` (`s-logos.mjs`) counts channels that have no logo at all as blank, so its 271/271 is an artefact of that probe. `P2-after.log` (`t-logos.mjs`) separates them.

## Menu navigation (key → second animation frame, median ms; requests 0 everywhere)

| Action | 1.8.4 (Кино) | a (Кино) | b ×3 (Кино) | f ×3 (Кино) | f ×3 (Израиль) |
|---|---|---|---|---|---|
| Open menu (first) | 103 | 91 | 99 · 105 · 90 | **119 · 110 · 136** | 136 · 138 · 101 |
| Reopen menu | 74 | 87 | 90 · 75 · 79 | 75 · 76 · 99 | 75 · 76 · 94 |
| Pick a channel → playing | 1149 | 1204 | 1386 · 1136 · 1181 | 1318 · 1232 · 1291 | 1222 · 1280 · 1351 |

**Open item:** the first menu opening on build f is 10–35 ms slower than on builds a and b in the same group. On the desktop at 6× CPU it is unchanged. The cause is being attributed with a TV probe.

## Streams

| Item | 1.8.4 | 1.9.0 (a / b / d) |
|---|---|---|
| 90 s on one channel: spinner while watching | 0 | 0 in every run (360/360 samples PLAYING) |
| Zap ▶ ×4: key → playing (one clock) | invalid in 1.8.4 | a 1046–1398 · b ×3 median 1324 · d ×3 median 1326 ms |
| Six groups: to playing | 1137–1705 ms | 1095–1559 ms |
| Spinner while watching 30 s | 0 | 0 |
| Archive slider: to playing, position vs target | 1775–2135 ms, 0 s | 1420–1931 ms, 0 / −1 s |

## Groups (each channel watched 20 s)

| Group | 1.8.4: median / max (channels) | 1.9.0: median / max (channels, build) | Problems |
|---|---|---|---|
| Кино | 1411 / 6503 (40) | 1275 / 2446 (90, a) · 1378 / 34045 (90, d)\* · 1388 / 2153 (40, f) | 0 freezes, 0 spinner while watching |
| Украина | 1518 / 2431 (40) | 1419 / 2206 (90, a) · 1462 / 2381 (90, d) | 0 |
| Израиль | 1437 / 2167 (18) | 1293 / 2588 (18, a) · 1373 / 2074 (18, d) | 0 |
| Музыкальные | 1510 / 2265 (25) | 1336 / 1548 (25, a) · 1434 / 2176 (25, d) | 0 |

\* «177 Шокирующее» once took 34 s on build d. The player reported a bogus frame size (0×4176) and bitrate (3 Gbit/s), so the stream itself was broken. The same channel started in 1.23 s (1.8.4), 1.34 s (a) and 1.29 s (f).

## On air («now» lines and the banner)

`d-batch4-items1-4/on-air-{1,2,3}.log` and `f-batch5/on-air.log` check every visible menu row against the guide at that moment, then wait for a programme to end:
- 13 of 13 rows matched in every run, with 0 stale rows;
- the banner matched the guide;
- programme changes flipped in the row within 75 s (runs d-1, d-2, f).
- Run d-3 only shows that the row matches the guide: its programme kept the same title across the boundary.

## Language list (fix batch 4, item 6)

`f-batch5/language-list.log`, run on the TV:
- Settings → «🌐» → OK opens the list: Русский, Українська, עברית, English, all starting at x 280, each in its own direction (עברית rtl).
- Back returns to Settings with the language unchanged.
