<p align="center">
  <img src="docs/icon.png" width="160" alt="Настин кинозал icon: a white daisy with the name Настя">
</p>

<h1 align="center">Настин кинозал</h1>

<p align="center">
  <b>Your old Samsung TV deserves a cinema that never freezes.</b><br>
  Free TV out of the box: 10 built‑in playlists · your own playlists · OTT Club for 389 channels and a 7‑day archive · zero stalls in 30 minutes of film playback.
</p>

<p align="center">
  <i>💐 Dedicated to my wife, Anastasia.<br>
  So that in her free time she can switch on the TV, rest, enjoy life and simply have a wonderful time.</i>
</p>

<p align="center">
  <img alt="Samsung Tizen 3.0+" src="https://img.shields.io/badge/Samsung%20Tizen-3.0%2B-1428A0?style=for-the-badge">
  <img alt="Pure ES5, no build step" src="https://img.shields.io/badge/ES5-no%20build%20step-2f7ee8?style=for-the-badge">
  <img alt="Hardware playback" src="https://img.shields.io/badge/playback-hardware%20AVPlay-34a853?style=for-the-badge">
  <img alt="Stalls measured" src="https://img.shields.io/badge/stalls-0%20in%2030%20min-brightgreen?style=for-the-badge">
</p>

<p align="center">
  <img src="docs/screenshots/channel-1plus1-voice-coaches.jpg" width="900" alt="1+1 Україна — «Голос країни»: the four coaches in the red chairs, in full HD">
</p>

---

## ▶ Turn your TV into a cinema tonight

That 2017 Samsung on your wall still has a great panel. Its apps don't. Menus throw JavaScript errors, channels freeze, and nothing gets updated any more.

**Настин кинозал (Nastin Kinozal) fixes that in one install.** It is a player written for the web engine your TV actually has, and it plays through the TV's own hardware decoder. Everything you open is fast, and every stream heals itself.

**[⬇ Install it on your TV](#-install) · [⭐ Star the repo](https://github.com/yaroslavrudenko/nastin-kinozal) · [💬 Tell us your TV model](https://github.com/yaroslavrudenko/nastin-kinozal/issues)**

---

> ### 📺 Watch free the moment you install it
> Настин кинозал comes with a **free provider built in: [iptv-org](https://github.com/iptv-org/iptv)** — its whole public list (**~11 000 channels from all over the world**) and its ready playlists: 🇮🇱 Israel · 🇺🇦 Ukraine · in Russian · **in English (CNN, Bloomberg, DW, France 24, Euronews, NBC News NOW, ABC News Live…)** · News · Kids · Music · Movies · Documentary · Sport. A fresh install starts playing iptv-org's whole list at once — no key, no sign‑up. Pick a provider and a playlist in **📡 Провайдеры**; inside, the channels are grouped as the provider gives them, Israeli and Ukrainian ones first. You can also **add your own providers** (an M3U link each) and switch between all of them on the TV.
>
> ### ⭐ Want more? Subscribe to OTT Club
> For **389 channels, a 7‑day archive with a real timeline slider and the full programme guide**, subscribe to [OTT Club](https://www.ottclub.tv): it is built in, enter your key and it works. Another paid provider works today if it gives you an **M3U link**: add it as your own playlist. **Built‑in support like OTT Club's (key, guide and archive from the provider's API) is not there yet for other paid providers; we will add it if there is interest** — [tell us which one](https://github.com/yaroslavrudenko/nastin-kinozal/issues).
>
> The free channels come from the open [iptv-org](https://github.com/iptv-org/iptv) project (publicly available channels). The player shows every channel a source lists and filters nothing (the one exception is your own setting: the adult group stays hidden until you switch it on in «ℹ О программе»): a stream that does not play is the source's matter. No paid channels, keys or private playlists are included in this repository. [How it works ↓](#-providers-ott-club-iptv-org-and-your-own)

## Why you'll love it

| | |
|---|---|
| 🎬 **Films never stop** | Hardware H.264 decoding, a 10‑second safety buffer, and a watchdog that reconnects a stalled stream on its own. Measured: three movie channels for 10 minutes each, **0 stalls, 0 rebuffers, 0 reconnects**. |
| ⏪ **Rewind TV like a video** | Press ▲ while watching and a timeline slider appears. Hold ◀ ▶ to scrub (it speeds up as you hold), jump between shows with ▲ ▼, and press OK to watch from that moment. Up to 7 days back. |
| 🔍 **Find any channel** | Type part of a name (or a number) in 🔍 Search at the top of the menu; results update as you type. |
| 📡 **Providers: free, your own, OTT Club** | The free iptv-org provider (whole list + 10 playlists), your own providers added on the TV, and OTT Club with your key — all in one **📡 Провайдеры** menu. Built‑in providers cannot be deleted; your own can. |
| 🖥 **The picture fits your screen** | Every stream is laid exactly over the TV's whole 1920×1080 screen and starts at the best quality your connection allows, then adapts. «Картинка во весь экран» in «ℹ О программе» is on by default; switch it off to keep a stream's own proportions (Green cycles the modes while watching). |
| 📺 **Every channel, in order** | Every channel the source lists, nothing filtered or hidden (adult channels only after you switch them on in «ℹ О программе»). 🇮🇱 Israeli channels come first, then 🇺🇦 Ukrainian ones, in every source. Groups follow the playlist: a group with no channels (say, no Ukrainian or no music channels) simply is not there. With OTT Club: **389 channels**, Israel first, then National, News, Documentary, Movies, Kids, Sport and more. |
| ★ **Your own favourites** | Press ⏯ (or Yellow) on any channel to pin it to ★ Favourites. CH+/CH− inside Favourites zaps through favourites only. |
| ⚡ **Instant on old hardware** | Virtualised lists keep a 1000‑channel playlist as fast as a 10‑channel one. The programme guide loads per channel, only when you look at it. |
| 🔊 **Picture and sound under control** | Every channel switch shows the stream briefly: resolution, codec, bitrate and sound (for example `1920×1080 · H264 · 7,5 Мбит/с · звук стерео`). Choose the audio track and the picture mode (auto, full screen or letter‑box). |

## See it in action

### Channels

<table>
  <tr>
    <td><img src="docs/screenshots/channel-m1.jpg" alt="М1, Ukrainian music channel"></td>
    <td><img src="docs/screenshots/channel-natgeowild.jpg" alt="Nat Geo Wild: a Nile crocodile close up, in full HD"></td>
  </tr>
  <tr><td align="center"><b>М1</b> · Ukrainian music</td><td align="center"><b>Nat Geo Wild</b> · wildlife</td></tr>
  <tr>
    <td><img src="docs/screenshots/channel-channel9.jpg" alt="Channel 9, Israel, news"></td>
    <td><img src="docs/screenshots/channel-cartoons90.jpg" alt="Cartoons 90: cartoons of the 90s"></td>
  </tr>
  <tr><td align="center"><b>Channel 9</b> · Israel, news</td><td align="center"><b>Cartoons 90</b> · cartoons of the 90s</td></tr>
  <tr>
    <td><img src="docs/screenshots/channel-discovery.jpg" alt="Discovery: sailing boats on the sea"></td>
    <td><img src="docs/screenshots/channel-cartoonsshort.jpg" alt="Cartoons Short: classic animation"></td>
  </tr>
  <tr><td align="center"><b>Discovery</b> · documentary</td><td align="center"><b>Cartoons Short</b> · classic animation</td></tr>
</table>

### The player

<table>
  <tr>
    <td><img src="docs/screenshots/ui-slider.jpg" alt="Archive slider over the picture: scrub to any minute of the show"></td>
    <td><img src="docs/screenshots/ui-panel-1plus1.jpg" alt="Programme panel over 1+1 Україна: today's shows, «Голос країни» on air highlighted"></td>
  </tr>
  <tr><td align="center"><b>▲ Archive slider</b>: scrub to any minute</td><td align="center"><b>▼ Programme</b>: past shows play from the archive</td></tr>
  <tr>
    <td><img src="docs/screenshots/ui-menu.jpg" alt="Channel menu: search, groups, channels with logos and what is on now"></td>
    <td><img src="docs/screenshots/ui-search.jpg" alt="Search: typing муз lists the music channels"></td>
  </tr>
  <tr><td align="center"><b>OK · Channel menu</b>: groups, logos, what's on</td><td align="center"><b>🔍 Search</b>: results as you type</td></tr>
</table>

## Remote control

The player works with the basic Samsung Smart Remote. No number or colour keys are needed.

| Key | While watching | In the guide |
|---|---|---|
| ◀ ▶ | previous / next channel | switch column |
| ▲ | archive slider: scrub to any minute | move up |
| ▼ | this channel's programme: ◀ ▶ change the day, OK watches | move down |
| OK | the channel menu with 🔍 Search | watch the channel or the show (the channel already on screen is not restarted) |
| ⏯ | pause / play | add or remove a favourite |
| ⏪ ⏩ | archive slider, big steps | — |
| CH+ / CH− | next / previous channel | archive day, or page through channels; a soft scroll bar beside the groups and beside the channels shows where you are and when the list ends |
| Back | back to live; press twice to exit | close |
| 0–9 · Red · Green · Blue | channel number · audio track · picture mode (full screen → stream proportions → with borders) · stream info | Blue: **📡 Провайдеры** |

## Why this project exists

Samsung TVs from 2017 and 2018 still have good panels, but their software has fallen behind.

- **The official OTT Club app on these TVs is stuck at version 1.0.6.** It is a 56 KB shell that downloads its menu from the provider's server. The Android app moves on (2.6x in 2026), but the code it sends to the TV now uses JavaScript that the TV's 2015-era web engine cannot run. The result is JavaScript errors in the menus, frozen screens, and channels that hang without recovering.
- **Samsung no longer updates these TVs.** The firmware is signed and locked, so the web engine cannot be upgraded. The only fix inside the TV is an app written for the engine the TV actually has.
- **The goal: a player that is fast, reliable and complete on old hardware.** It keeps every feature that matters to a viewer: all channels split into groups, a programme guide, a 7-day archive with rewind, sound tracks and picture modes. The app should never hang. A stalled stream reconnects by itself, and the interface stays responsive with a thousand channels.

The app is named after the person it was made for: «Настин кинозал» means "Nastya's cinema", a cinema at home, one that simply works.

## Design principles

- **Native playback first.** Video is decoded by the TV's hardware player (AVPlay), not in JavaScript.
- **Never block the UI.** Lists are virtualised, and the guide loads one channel at a time.
- **Assume the network fails.** Every stall, error or network drop leads to an automatic reconnect with backoff (0.5 s up to 15 s).
- **Never show a stale list.** Channels come from the provider on every start, and each one is re-checked in the background.
- **Write for the oldest engine.** The code is plain ES5, checked with `acorn --ecma5`, and needs no build step.

## Measured, not promised

| Check | Result |
|---|---|
| Movie channels, 3 × 10 min in parallel | 0 stalls · 0 rebuffers · 0 reconnects · buffer never below 12 s |
| Playback on the TV (UE50MU7000, Tizen 3.0) | hardware H.264 1920×1080, ~6 Mbit/s, `PLAYING` |
| Channel list request | ~0.1 s, 389 channels, 9 groups |
| Archive depth | 7 days; every hour complete |
| Archive on the TV (programme panel, slider) | first frame in 2.2 s; 60 s without a single failure |
| Archive that catches up with live | continues by itself, no "no signal" |
| Full channel re-check | 389 channels in ~9 s, in the background |

Open performance issues and every performance change, with before/after numbers: **[docs/PERFORMANCE.md](docs/PERFORMANCE.md)**.

## ⚡ Performance

In October 2026 six independent reviewers went through the whole player. The 230 findings were then fixed over six reviewed iterations, and 159 behaviour tests now guard the fixes.

On the TV (2026-10-25/26) the build passes the life-cycle test: close, open, exit and reopen, and Home → another app → back, twice. The heaviest movie channel, Viju+ Megahit at 1080p and 10.9 Mbit/s, plays without stalls. The acceptance plan is in [docs/TESTING.md](docs/TESTING.md).

**TV run of 2026-10-26** (automated runner `tests/tv/run.mjs`, builds f7ccc45 and 84fc43e): 11 channel groups, 349 channels in «Все каналы».
- **Channel list:** 0 empty «now» cells. The few rows that lagged had changed less than 60 s before (the refresh floor).
- **Zapping:** first frame on landing 0.7–2.0 s (median 1.0 s); a single zap 0.7–1.3 s; a burst of 10 presses lands right with 0 extra requests.
- **Archives:** 8 of 8 archive opens on the four heaviest movie channels play. The end of a recording continues within 2 s of the right moment. The 7-day archive edge plays (fixed in 84fc43e).
- **Stability:** 10 min without a stall; a 60 s pause sends no requests.
- **Open:** the tech-line check is being re-run, and the 60 s «now» refresh floor awaits the owner's decision.
- **Update, later on 2026-10-26:** the «now» refresh was redesigned (DEC-2026-10-26-now-refresh-2): only rows on screen ask the provider, the guide-known row turns over at its end with no request, a 10 s floor, and a row never goes blank — past 15 min without news it keeps the last programme marked «(шла до HH:MM)». Verified on the desktop; the TV run is pending ([docs/PERFORMANCE.md](docs/PERFORMANCE.md)).

Details: [docs/TESTING.md](docs/TESTING.md) (results of 2026-10-26).

The numbers below were measured on a desktop (harness and headless Chrome):

- **Zapping:** requests per 10 quick presses 20 → 3; a single press opens the channel after 0 ms instead of 350 ms.
- **Startup:** the channel list is parsed once instead of twice, with 0 storage writes before the first frame (was 2). The offline copy shrank from 500 KB to 44 KB. No long tasks over 50 ms (was 66–74 ms at 6× CPU).
- **Quiet when idle or failing:** 0 requests during a 10-minute pause (was 200). A failing guide makes 5 requests in 10 minutes instead of 12 007.
- **Memory:** full guides kept after 100 channels 100 → 24, with no descriptions stored.

The full before → after table and what is still to verify on the TV: **[docs/PERFORMANCE.md](docs/PERFORMANCE.md#summary-of-the-2026-performance-work)**.

## 📡 Providers: OTT Club, iptv-org and your own

**Open it:** press **OK** for the channel menu, then **Blue** (or pick the **📡 Провайдеры** row near the end of the groups, just above ℹ О программе). The list:

| Row | What it is | What you can do |
|---|---|---|
| **OTT Club** | the paid service the app was built for | **OK** watches it; **Blue** enters or changes your key |
| **iptv-org — бесплатные каналы** | the free provider; it gives its own playlists: **Весь список** (~11 000 channels, the default) · Израиль · Украина · На русском · На английском · Новости · Детские · Музыка · Кино · Познавательные · Спорт | **OK** opens its playlists, **OK** on one watches it, **Back** returns; built in, cannot be deleted |
| **your providers** | M3U links you added | **OK** watches it; **Red twice** deletes it |
| **+ Добавить провайдера** | add a link | type an `http://` or `https://` M3U link, **OK** |

Switching starts the app again on the chosen provider (or playlist), with its channels and groups; each one remembers its own last channel and group. The row in blue with **● сейчас** is the one you are watching. In the channel menu, a soft scroll bar beside the groups and beside the channels shows where you are in each list and when it ends; no list ever runs into the hint bar at the bottom, on any TV size.

**The OTT Club key.** Enter it at any time in 📡 Источники with **Blue** (or OK on the OTT Club row); it is saved exactly as typed and used at once, and it is only ever sent to OTT Club — never to a free or your own playlist. The player never checks the key itself: OTT Club judges it, and a key it refuses shows OTT Club's own error picture in the stream. A link from your OTT Club account works too (the key is taken from it). You can also build the key in with `OTT_KEY=` in `build.local.env`.

**Groups follow the source.** They come from the playlist (`group-title`; iptv-org's `General;News` becomes «Новостные», common English group names read in Russian). 🇮🇱 Israel and 🇺🇦 Ukraine groups appear when the source has such channels, and their channels open the list. A group with no channels is not shown.

**Your own playlist from any provider**: add its **M3U link** in 📡 Источники, or build it in with `PLAYLIST_URL=` in `build.local.env` — typing a long URL with a TV remote is slow. A link that carries the provider's own key (`…/playlist/<key>/…`, `?key=…`, `get.php?username=…&password=…`) is used as it is. From a standard extended M3U the player takes:

| Playlist attribute | What it gives you |
|---|---|
| `group-title` / `#EXTGRP` | the groups in the menu |
| `tvg-logo`, `tvg-id` | logos; programme guide matching |
| `url-tvg` / `x-tvg-url` in `#EXTM3U` | the programme guide (XMLTV, uncompressed) |
| `catchup`, `catchup-source`, `catchup-days` (or `tvg-rec`, `timeshift`) | the archive and the slider: `default` / `append` templates (`{utc}`, `{lutc}`, `{start}`, `{end}`, `{duration}`, `{offset}`, `{Y}{m}{d}{H}{M}{S}`), `shift` (`?utc=…&lutc=…`) and `flussonic` |

Without catch-up attributes, live TV, groups, favourites and search still work; only the archive is missing.

**🇮🇱 Israel and 🇺🇦 Ukraine groups work with any provider.** A channel's country is recognised from a tag in the name (`(Израиль)`, `IL:`, `[UA]`, `… UA`), the playlist group (`Israel`, `Україна` …), the guide id (`tvg-id` ending in `.il` / `.ua`, or iptv-org's `.il@SD`), Hebrew or Ukrainian text in the name or the show on air, and a list of well-known channel names (`js/country.js`). Israeli channels open the list (with OTT Club, Channel 9 first), Ukrainian ones follow.

## 🚀 Install

**[docs/DEPLOY.md](docs/DEPLOY.md) is the full guide**, written from a real install. It covers Developer Mode, the Tizen CLI on Apple Silicon, the macOS local-network trap, Samsung certificates without the broken Certificate Manager, and the **device profile without which every install fails with `118`**.

In short:

```sh
sdb connect <tv-ip>:26101 && sdb shell 0 getduid             # the TV's DUID
node tools/samsung-cert.mjs --duid <DUID> --name kinozal     # sign in to Samsung once; certificates + device profile
printf 'CERT_PROFILE=kinozal\nDEVICE_PROFILE=%s\nTV=<tv-ip>:26101\n' ~/tizen-studio-data/keystore/kinozal/device-profile.xml > build.local.env
./build.sh                                                   # sign, push the device profile, install, start
```

The daisy icon appears in your TV's apps.

## 🗺 Roadmap

**A universal player for any provider**
- [x] 📡 Источники: OTT Club, 10 free playlists, your own M3U playlists (added and deleted on the TV).
- [ ] Other paid providers, if there is interest: Xtream Codes (server + login), and possibly Stalker/MAG portals.
- [ ] Programme guide (XMLTV) by URL, independent of the playlist.
- [ ] Catch-up formats (`flussonic`, `shift`, templates) always taken from the playlist itself.
- [ ] OTT Club becomes one built-in preset instead of the default.
- Builds on what is already here: `js/m3u.js`, `js/epg.js`, `js/catchup.js` and the provider-independent 🇮🇱 Israel / 🇺🇦 Ukraine grouping in `js/country.js`.

**Publish in the Samsung TV app store** (Samsung Apps, via Tizen Seller Office)
- [ ] No built-in provider or channels: users bring their own subscription.
- [ ] A privacy policy.
- [ ] Store icons and screenshots.
- [ ] Pass Samsung certification on several TV generations.

**Ideas: more providers and platforms**
- [ ] Enter the playlist from a phone by scanning a QR code on the TV.
- [ ] An LG webOS port.
- [ ] An Android TV build.
- [ ] Settings backup and restore.

---

<p align="center">
  <b>Made with love for Настя: a cinema at home, one that simply works.</b><br>
  If it brought your old TV back to life, <a href="https://github.com/yaroslavrudenko/nastin-kinozal">give it a ⭐</a>.
</p>
- Test report 2026-10-26: [docs/TEST-REPORT-2026-10-26.md](docs/TEST-REPORT-2026-10-26.md)
