# TV measurements — 2026-10-27, version 1.8.4 (the baseline before 1.9.0)

The owner asked, verbatim: «Всю статистику измерений храни в репозитории, чтобы можно было проверять статистику». Every measurement taken on the TV is kept here, as the raw log next to its scenario, so any number below can be checked and re-run. The same scenarios run again on 1.9.0 give the after numbers: a regression is any row worse than here.

- **TV:** Samsung UE50MU7000, Tizen 3.0, at 192.168.1.176. App «Настин кинозал» 1.8.4, installed 2026-10-27 14:48.
- **Provider:** OTT Club, 389 channels.
- **Start and end channel of every run:** «188 Киномикс» in group «Кино». Every run restored it, and checked that the saved last channel is that channel again.

**How it was measured.** `scenarios/cdp.mjs` connects to the app's inspector (`sdb … debug`, port forwarded). Each `scenarios/s-*.mjs` drives the app with remote key events and reads its state. Run `node cdp.mjs <port> s-….mjs [args]`. The connection needs a fresh `sdb kill-server; sdb connect <tv>:26101`, opened in a Terminal window; see docs/DEPLOY.md.

**What «playing» means here.** The picture itself is not seen. AVPlay can draw into a plane that the inspector cannot capture. «To playing» is the time until AVPlay reports `PLAYING` **and** its playback time starts to advance. A «freeze» is a period in `PLAYING` with the playback time standing still for 2 s or more. «Spinner» is the time the app's own buffering indicator is visible. «AVPlay buffering» is the player's `onbufferingstart` → `onbufferingcomplete` time; it is invisible to the viewer unless the spinner shows.

## ⚠ Corrections found after the first commit (stream expert's review, 2026-10-27)

1. **Zap ▶ ×4 times in `watch-and-zaps.log` are NOT valid.** In that scenario the key's timestamp is the TV's `Date.now()` and it is subtracted from the Mac's clock (`scenarios/cdp.mjs` `key()` + `s-baseline2.mjs`), and the two clocks differ. Discard the 2133–2463 ms figures. A ◀▶ press goes through the same code path as a channel pick, which was measured correctly at 1.15–1.7 s.
2. **Every «spinner» figure here is understated.** The scenarios add 100 ms per sample, but each sample also includes a round trip to the TV inspector, so the real interval between samples is longer than 100 ms. The spinner is shown from the opening of the stream until the picture moves (`js/player.js:44`), so it is visible for about as long as «to playing»: ≈1.3–1.5 s at the median, not 0.5–1.0 s.
3. **Valid as measured:** «to playing» in the stream, group and archive tables (Mac clock on both sides, round trips included); the menu navigation timings (measured inside the TV page); the AVPlay buffering times, which come from the player's own events; the freeze and request counts; and the storage quota.
4. **Valid aggregate** (77 channel picks, Кино + Украина): key → playback moving median 1479 ms, p90 1663 ms, worst 6503 ms (176 Комедийное). Start-up buffering 44–395 ms. 0 rebuffers and 0 freezes while watching.

The scenarios are fixed before the 1.9.0 run: one clock, and the spinner measured inside the page.

## Storage — `storage-quota.log`

| Item | Value |
|---|---|
| localStorage in use | 57 768 chars in 13 keys |
| Free for one more key | ≈ 5 125 000 chars (±100 000) |

**Consequence:** the 2 500 000-char cap on the offline copy of a list fits the TV with room to spare (performance item P-1).

**Note on the probe:** it writes test strings of up to 16 M chars, and right after it the inspector connection dropped once. Do not re-run it on a TV someone is watching.

## Watching and zapping — `watch-and-zaps.log` (`s-baseline2.mjs`)

| Item | Value |
|---|---|
| 90 s watching «Киномикс» | spinner never shown, 360/360 samples `PLAYING` |
| Zap ▶ ×4 (189 Amedia Premium, 190 ТВ XXI, 191 Amedia Hit, 192 Киносемья) | ~~key → playing 2133–2463 ms~~ invalid (two clocks, see Corrections); spinner understated |

## Menu navigation — `menu-navigation.log` (`s-fullnav.mjs`)

Time is from the key to the second animation frame after it, i.e. the screen showing the result. The frame gap is the longest pause of the UI during the phase.

| Action | Median | Max | Longest frame gap | Requests |
|---|---|---|---|---|
| Open menu (OK) | 103 ms | 103 ms | 83 ms | 0 |
| Channels ▼ ×12 | 40 ms | 63 ms | 50 ms | 0 |
| Channels ▲ ×6 | 35 ms | 39 ms | 33 ms | 0 |
| Page CH− ×5 | 43 ms | 63 ms | 50 ms | 0 |
| Page CH+ ×5 | 53 ms | 74 ms | 67 ms | 0 |
| To groups (◀) | 28 ms | 28 ms | 17 ms | 0 |
| Groups ▼ through all 14 | 31 ms | 70 ms | 50 ms | 0 |
| Groups ▲ back ×13 | 40 ms | 64 ms | 50 ms | 0 |
| Group ▼ ×2 + into channels | 21 ms | 35 ms | 50 ms | 0 |
| Pick a channel (OK) | menu closed in 221 ms | — | — | — |
| Pick a channel → playing | 1149 ms | — | — | — |
| Reopen menu | 74 ms | — | 67 ms | 0 |
| Close menu (Back) | 27 ms | — | 17 ms | 0 |

An earlier run of the same scenario, whose key timings did not record, saw a 117 ms frame gap once.

## Streams from six groups — `streams-six-groups.log` (`s-stream.mjs`)

Each channel was watched for 30 s.

| Group · channel | To playing | Spinner at start | Spinner while watching | AVPlay buffering while watching |
|---|---|---|---|---|
| Израиль · 2 Channel 11 | 1308 ms | 600 ms | 0 | 183 ms |
| Украина · 20 ICTV | 1284 ms | 700 ms | 0 | 301 ms |
| Новостные · 64 BBC News UK | 1137 ms | 600 ms | 0 | 180 ms |
| Кино · 139 Fox | 1185 ms | 500 ms | 0 | 145 ms |
| Детские · 234 JimJam | 1280 ms | 500 ms | 0 | 167 ms |
| Спорт · 256 Setanta Sports+ | 1705 ms | 900 ms | 0 | 340 ms |
| Archive on «Киномикс» (▲, ◀ ×4, OK) | 1621 ms | 600 ms | — | — |
| Back to live | 1208 ms | — | — | — |

## Group «Кино» — `group-kino.log` (`s-group.mjs 20000 40 Кино`)

The first 40 channels of the group (138–177) were checked. Each was watched for 20 s.

| Item | Value |
|---|---|
| Channels with a problem | **0** (no freeze, no spinner while watching, all `PLAYING`) |
| To playing | median 1411 ms, max 6503 ms |
| Slow starts | 176 Комедийное: 6503 ms, spinner 3600 ms, once; 153 CineMan Thriller: 2678 ms |
| AVPlay buffering while watching | 44–395 ms |
| Resolution | all 1920×1080, except 174 Комедия at 720×576 |
| Highest bitrates | 146 Дорама 12.2 Mbit/s · 145 Kinosweet 11.4 · 143 Твій Серіал 10.8 · 138 KinoKazka 10.8 |

172 Cinema declares 100 Mbit/s. This is the stream's own figure, not the real rate.

**Not yet covered:** channels 178 onwards of «Кино» (including 188 Киномикс itself).

## Archive and the slider — `archive-slider.log` (`s-archive.mjs`)

The run was on «Киномикс», whose archive goes back 7 days. Each case was watched for 15 s after the start.

| Case | Slider target | To playing | Position vs target | Spinner at start | While watching |
|---|---|---|---|---|---|
| ◀ ×3 (90 s back) | «прямой эфир» | — | — | — | plays live by design: within LIVE_SNAP_MS (2 min) of live, the archive plays live |
| ◀ held ×20 | −1 h 3 min, «Дыхание шторма» | 1884 ms | 0 s | 800 ms | spinner 0, freezes 0 |
| ▲ previous programme ×2 | −6 h 31 min, «Терминатор 2» | 2135 ms | 0 s | 1000 ms | spinner 0, freezes 0 |
| ◀ held ×60 | −14 h 14 min, «Остров на троих» | 1775 ms | 0 s | 800 ms | spinner 0, freezes 0 |
| In archive: ▶ ×4 | −14 h 12 min | 1876 ms | 0 s | 900 ms | spinner 0, freezes 0 |
| Back to live | — | 2134 ms | — | — | — |

## Group «Украина» — `group-ukraine.log` (`s-group.mjs 20000 40 Украина`)

The first 40 channels of the group were checked. Each was watched for 20 s.

| Item | Value |
|---|---|
| Channels with a problem | **0** |
| To playing | median 1518 ms, max 2431 ms |
| Starts over 3 s | none |

Several channels declare 100 Mbit/s: 53 Капучино ТВ, 54 ATR, 56 Раі, 57 11 Канал Дніпро, 73 Новини Live. This is the stream's own figure.

**Not yet covered:** the rest of the group, if it has more than 40 channels.

## Pending in this series

- Groups «Израиль» and «Музыкальные»: running.
- The rest of «Кино» and «Украина».
- A second try of «176 Комедийное».
