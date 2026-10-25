# Кинозал Анастасия

A fast IPTV player for Samsung Tizen TVs, built for an OTT Club playlist and tested against a 2017 UE50MU7000 (Tizen 3.0, Chromium 47 web engine).

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
