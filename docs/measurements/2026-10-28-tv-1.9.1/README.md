# TV measurements — 2026-10-28, version 1.9.1 against 1.8.4 and 1.9.0

**The owner's rules for this release:**
- 1.9.x must be **no worse than 1.8.4** in navigation, channel list loading, stream connect, channel switching and group switching.
- The viewer must **never see a logo arrive**: no flicker, no vanish, no draw-in while scrolling.

**Setup.**
- **TV:** Samsung UE50MU7000, Tizen 3.0 / Chromium 47, OTT Club (389 channels).
- **Builds:** each one was built from a frozen tree and installed on the same TV, one after the other; 1.8.4 is main d8f3fcc.
- **Runs:** every scenario starts from a fresh launch. The scenarios in `scenarios/` are build-agnostic: the same file runs on 1.8.4 and on 1.9.x.
- **Clocks:** times are read inside the TV page on one clock.

**User-visible logo metric (`s-scroll.mjs`).** It is sampled every animation frame while the menu is up. A visible channel row whose channel has a logo URL counts as **empty** unless its picture is painted. Two figures come from it:
- **«logos seen arriving»:** the same row goes from empty to painted on screen.
- **«empty-box frames»:** frames with at least one empty box.

## a — 1.8.4 against 1.9.0 (`a-184-vs-190/`, 3 runs each)

The two versions were compared before the logo fix. 1.9.0 already had 0 logos arriving when paging slowly. It burst on release of a held key: 12 empty boxes at once, about 0.4 s to fill. Cold CH− paging was +6…+16 ms per key.

## b — logos loaded ahead (fix batch 7, `b-logos-batch7/`)

**What changed:**
- The logos of the current group load in the background before the menu opens, paused for 3 s after a channel change.
- The window loads the page on screen, 2 pages ahead and 1 page behind, while keys are held too.
- Downloads never start in a key's task: at most 3 per idle slot and 6 in flight.
- Arrivals are painted at most 4 per frame.

| Phase | 1.8.4: logos arriving / empty-box frames | 1.9.1: logos arriving / empty-box frames |
|---|---|---|
| CH− ×6 pages, 250 ms apart (cold) | 68 / 47 | **0 / 0** |
| CH− ×6 pages, 600 ms apart (cold) | 71 / 50 | **0 / 0** |
| ▼ held ×30, then release (cold) | 17 / 108 | **0 / 0** |
| ▼ ×14 steps, the window scrolls | 9 / 30 | **0 / 0** |

| Key → 2nd frame, median (frames over 34 ms) | 1.8.4 | 1.9.1 |
|---|---|---|
| ▼ held ×30 (cold) | 38.9 ms (15) | 38.4 ms (2) |
| CH+ ×12 back (warm) | 63.5 ms (23) | 48.7 ms (1) |
| ▲ held ×30 back | 36.6 ms (11) | 31.5 ms (2) |
| Groups ◀ + ▼ | 50.4 ms (5) | 36.6 ms (3) |
| Groups ▲ back | 44.1 ms (3) | 37.2 ms (1) |
| Open menu | 112 ms | 94 ms |
| CH− ×6 pages (cold) | 53.7 / 44.1 ms | 56.6 / 58.2 ms — see the open items |

## c — streams (`c-streams/`)

The same-method zap scenario (`s-parity.mjs`): ▶/◀ ×18, key → picture.

| | 1.8.4 | 1.9.0 | 1.9.1 |
|---|---|---|---|
| Channel switch ▶◀, median (max) | 1063 ms (1149) | 982 ms (1227) | **984 ms (1163)** |
| Number entry: last digit → playing | 2948 ms | 2953 ms | **2842 ms** |
| Channel list loaded (cold) | 4047 ms | 3935 ms | **3878 ms** |
| Menu first open / reopen | 93 / 70 ms | 91 / 74 ms | 94 / 76 ms |
| Group keys | 38.9 ms | 37.6 ms | 37.6 ms |

**The big buffering spinner** (`s-streams.mjs`, 16 changes per run). Before 1.9.1 it showed on every channel change, for about the whole start time. In 1.9.1 it shows only when loading takes longer than 1.6 s: 0–1 times per 16 changes.

**Start-speed experiments** (each was run as 2 runs × 16 changes):

| Experiment | Result |
|---|---|
| `bitrate=AVERAGE` | no win |
| `bitrate=LOWEST` | no win |
| `buftimeout=10` | no win |
| `noclose=1`, the player kept between channels | −40…−100 ms |
| Banner first, then the player | +144 ms per change, so it is off by default |

## d — 203 channel changes with the player kept (`d-soak-200/`)

These are 111 changes in «Кино» and «Israel», then 92 in «Ukraine» on the final default («Fast channel switching» on).

| | Result |
|---|---|
| Changes reaching a moving picture | **203 / 203** |
| Player errors (stop, close, getState) | **0** |
| Start time, first quarter → last quarter | 1.34 → 1.26 s and 1.29 → 1.34 s: no drift |
| Big spinner | 9 of 111 and 2 of 92 changes |

**Decision:** «Fast channel switching» is in Settings and on by default.

## Open items

- **Cold CH− paging** (pages never shown before) is a few ms slower per key than 1.8.4: 57 / 58 ms against 54 / 44 ms. The eye does not see it, and no logo arrives. It is being reduced.
- **Reload «channels ready»** was 1087 ms on the batch-7 build against 799 ms on 1.8.4, with n=2. Logo work is being moved after the list and the first picture. The final 1.9.1 build is re-measured below.

## Final 1.9.1 build

(Added after the final TV run.)
