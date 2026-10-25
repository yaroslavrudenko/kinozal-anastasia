# Кинозал Анастасия

A fast IPTV player for Samsung Tizen TVs, built for an OTT Club playlist and tested against a 2017 UE50MU7000 (Tizen 3.0, Chromium 47 web engine).

## Why this project exists

Samsung TVs from 2017 and 2018 still have good panels, but their software has fallen behind.

- **The official OTT Club app on these TVs is stuck at version 1.0.6.** It is a 56 KB shell that downloads its menu from the provider's server. The Android app moves on (2.6x in 2026), but the code it sends to the TV now uses JavaScript that the TV's 2015-era web engine cannot run. The result is JavaScript errors in the menus, frozen screens, and channels that hang without recovering.
- **Samsung no longer updates these TVs.** The firmware is signed and locked, so the web engine cannot be upgraded. The only fix inside the TV is an app written for the engine the TV actually has.
- **The goal: a player that is fast, reliable and complete on old hardware.** It keeps every feature that matters to a viewer: all channels split into groups, a programme guide, a 7-day archive with rewind and fast-forward, sound tracks and picture modes. The app should never hang. A stalled stream reconnects by itself, and the interface stays responsive with a thousand channels.

The app is named after the person it was made for: a cinema at home, one that simply works.

## Design principles

- **Native playback first.** Video is decoded by the TV's hardware player (AVPlay), not in JavaScript.
- **Never block the UI.** Lists are virtualised and the programme guide is parsed in 12 ms slices.
- **Assume the network fails.** Every stall, error or network drop leads to an automatic reconnect with backoff.
- **Write for the oldest engine.** The code is plain ES5, checked with `acorn --ecma5`, and needs no build step.

## Features

- Full channel list from an M3U playlist, split into groups, plus "All channels" and a favourites group (yellow button).
- Hardware playback through Samsung AVPlay.
- Self-healing streams. Buffering longer than 12 s or a stalled clock for 8 s reconnects automatically, with backoff from 0.5 s to 15 s. Playback also reconnects when the network comes back.
- Archive (catch-up) for up to 7 days. Supports `catchup-source` templates, `shift` (`utc`/`lutc`) and flussonic URLs.
- Seeking: ◀ ▶ moves ±30 s and ⏪ ⏩ moves ±5 min. Key presses are batched into one request. Pause works on live channels.
- Programme guide from XMLTV (`url-tvg`). It is parsed in small time slices so the UI never freezes.
- Picture and sound: green cycles the display mode, red cycles the audio track, blue shows the resolution and bitrate.
- Virtualised lists: a large playlist costs the same as a small one.
- ES5 only, so it runs on the oldest Tizen TV web engines.

## Remote control

| Key | Live | Guide |
|---|---|---|
| ▲ ▼ / CH+ CH− | previous / next channel | move; CH+/CH− change the archive day in the programme column |
| ◀ ▶ | seek −/+30 s | switch column |
| OK | open the guide | play the channel or programme |
| 0–9 | channel number | — |
| ⏯ ⏪ ⏩ ⏹ | pause, seek ±5 min, back to live | — |
| Red / Green / Blue | audio track / display mode / stream info | — |
| Yellow | add or remove favourite | add or remove favourite |
| Back | back to live; press twice to exit | close |

## Build and install

The playlist URL is injected at build time. It is not stored in the repository: `js/config.js` holds the `__PLAYLIST_URL__` placeholder.

Signing needs a Samsung distributor certificate that includes the TV's DUID. Create it with the Tizen Certificate Manager and the Samsung Certificate Extension. Then build and install:

```sh
tizen build-web -- .
tizen package -t wgt -s <samsung-profile> -- .buildResult
sdb connect <tv-ip>:26101
tizen install -n *.wgt -t <tv-name>
```
