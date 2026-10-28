# Documentation — Настин кинозал

Start here. Each document has one job; the long ones open with a short summary.

| I want to… | Read |
|---|---|
| Install the app on a Samsung TV | [DEPLOY.md](DEPLOY.md) |
| Know what is tested and how a build is accepted | [TESTING.md](TESTING.md) — summary at the top, then the acceptance plan and the log of every test batch |
| See how fast it is and why | [PERFORMANCE.md](PERFORMANCE.md) — summary at the top, then the governing rule, the backlog and the change log |
| Check a number against the raw data | [measurements/](measurements/) — one folder per TV run: scenarios, raw logs, tables |
| Read the TV test report of 2026-10-26 | [TEST-REPORT-2026-10-26.md](TEST-REPORT-2026-10-26.md) |

## TV measurement runs

| Folder | Version | What it measured |
|---|---|---|
| [2026-10-27-tv-1.8.4](measurements/2026-10-27-tv-1.8.4/README.md) | 1.8.4 | the baseline: menu navigation, streams from six groups, four groups channel by channel, archive slider, storage quota |
| [2026-10-28-tv-1.9.0](measurements/2026-10-28-tv-1.9.0/README.md) | 1.9.0 | logos while scrolling, menu navigation, streams, groups, "now" lines, the language list |
| [2026-10-28-tv-1.9.1](measurements/2026-10-28-tv-1.9.1/) | 1.9.1 | logo pop-in, long frames, key timings, channel switching, the buffering spinner, a 200-switch soak |

All runs use the same TV (Samsung UE50MU7000, Tizen 3.0, Chromium 47) and the same provider (OTT Club, 389 channels). Since 1.9.0 the key time and the result are read on one clock, inside the TV page. So spinner figures can be compared between 1.9.x runs but not with 1.8.4 (see the 1.8.4 folder's corrections).

## Conventions in these documents

- **Interface labels are given in English**, exactly as the English interface shows them (`js/i18n.js`, the `en` column): **📡 Providers**, **⚙ Settings → 🌐 Interface language**, **All channels**, **★ Favourites**, **Choose what to watch**, **+ Add a provider**.
- **Provider names are quoted as the provider gives them.** OTT Club's groups and channels (for example «Кино», «188 Киномикс») are not translated, because the app does not translate them either.
- **Every number names its source:** *TV* (measured on the device, raw log in measurements/), *desktop* (headless Chrome or the harness), or *estimate*.
- The owner's own words are quoted verbatim in Russian, followed by an English translation.
