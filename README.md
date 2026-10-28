<p align="center">
  <img src="docs/icon.png" width="160" alt="Настин кинозал icon: a white daisy with the name Настя">
</p>

<h1 align="center">Настин кинозал · Nastin Kinozal</h1>

<p align="center">
  <b>A fast, modern IPTV player for the Samsung TV you already own — even a 2017 one.</b><br>
  Free channels from the first minute · your own playlists · OTT Club with a 7‑day archive · four interface languages.
</p>

<p align="center">
  <img alt="Samsung Tizen 3.0+ (2017)" src="https://img.shields.io/badge/Samsung%20Tizen-3.0%2B%20·%202017%20TVs-1428A0?style=for-the-badge">
  <img alt="Chromium 47 engine, plain ES5" src="https://img.shields.io/badge/Chromium%2047-plain%20ES5-2f7ee8?style=for-the-badge">
  <img alt="Hardware playback" src="https://img.shields.io/badge/playback-hardware%20AVPlay-34a853?style=for-the-badge"><br>
  <img alt="Four interface languages" src="https://img.shields.io/badge/interface-RU%20·%20UK%20·%20HE%20(RTL)%20·%20EN-8e44ad?style=for-the-badge">
  <img alt="Free channels built in" src="https://img.shields.io/badge/free%20channels-~11%20000%20built%20in-f39c12?style=for-the-badge">
  <img alt="Channel switch about 1 s on the TV" src="https://img.shields.io/badge/channel%20switch-~1.0%20s%20on%20the%20TV-brightgreen?style=for-the-badge">
</p>

<p align="center">
  <img src="docs/screenshots/channel-1plus1-voice-coaches.jpg" width="900" alt="1+1 Україна — «Голос країни»: the four coaches in the red chairs, in full HD">
</p>

<p align="center">
  <i>💐 Dedicated to my wife, Anastasia —<br>
  so that in her free time she can switch on the TV, rest, enjoy life and simply have a wonderful time.</i>
</p>

---

## The pitch

That 2017 Samsung on your wall still has a great panel. Its apps don't: menus throw JavaScript errors, channels freeze, and nothing is updated any more. Samsung's firmware is locked, so the TV's web engine will never be upgraded.

**Настин кинозал is written for the engine your TV actually has.** It plays through the TV's own hardware decoder, comes with free channels ready to watch, speaks your language, and was measured on a real 2017 TV at every release.

**[⬇ Install it](#-install) · [⭐ Star the repo](https://github.com/yaroslavrudenko/nastin-kinozal) · [💬 Tell us your TV model](https://github.com/yaroslavrudenko/nastin-kinozal/issues)**

## Why you'll want it

| | |
|---|---|
| 📺 **Runs on old TVs** | Built for Samsung Tizen 3.0 — the 2017 TVs and their Chromium 47 web engine. The whole app is plain ES5 (checked with `acorn --ecma5`), with no build step and no modern JavaScript that an old TV cannot run. Developed and measured on a Samsung UE50MU7000 from 2017. |
| ⚡ **Fast** | Measured on that TV: a channel switch takes **about 1.0 s** from key to picture; menu keys answer in **37–49 ms**; channel logos never pop in while you scroll; scrolling is smoother than in 1.8.4 (long frames when holding ▼: **15 → 2**). [The numbers ↓](#-performance-what-improved-and-why) |
| 🎬 **Quality picture, no fuss** | Hardware decoding up to 1080p, laid exactly over the whole screen; the buffering spinner only appears when a channel is really slow (over ~1.6 s); a stalled stream reconnects by itself. |
| ⏪ **TV you can rewind** | Up to 7 days of archive (with OTT Club or a playlist that has catch‑up): a timeline slider to scrub to any minute, and a programme guide where past shows play from the archive. |
| 🔄 **Always current** | Channel lists and groups are fetched again every hour and always applied. The "now on air" line in every row matched the guide in every TV check (**13 of 13 rows, 0 stale**). |
| 🌍 **Localized** | The whole interface in **Russian, Ukrainian, Hebrew** (full right‑to‑left layout) or **English**. Channel names and programmes stay exactly as your provider writes them, in any script. |
| 🆓 **Free streams out of the box** | The free provider **iptv-org** is built in with **11 ready playlists** — about 11 000 public channels from around the world. No key, no sign‑up. |
| 📡 **Your providers too** | Add any provider's M3U link on the TV, or enter your **OTT Club** key for 389 channels, the full guide and the 7‑day archive. |

## ✨ What's new

### 1.9.2

- **Logo work never delays startup:** logos are fetched only after the channel list and the first picture, so the list is ready as fast as before.
- **Paging into pages never seen before** is a little lighter on each key.

### 1.9.1

- **The big spinner stays away.** It used to appear on every channel change. Now it shows only when a channel takes longer than ~1.6 s to start: **0–1 times in 16 channel changes** on the TV.
- **Fast channel switching**, a new setting in **⚙ Settings**, on by default. The player is kept between channels: key → picture **984 ms** on the TV, and a 200‑switch soak test ran with **0 failures and no slowdown**.
- **No endless spinner on a dead channel**, and a stream in a format the TV cannot play is reported instead of being retried forever.
- **Archive near the end of a programme opens once**, not again and again.
- **No logo pop‑in at all:** while you scroll, 0 frames with logos being drawn in (1.8.4: 47–108 frames, up to 68 logos appearing on screen).

### 1.9.0

- **Four interface languages** — Russian, Ukrainian, Hebrew (right to left) and English, picked from a list in **⚙ Settings → 🌐 Interface language**.
- **Logos stay put.** The logos of the group you watch are loaded ahead in the background, so a list looks complete the moment you open it.
- **Hourly lists.** Channels and groups refresh every hour (was 6 hours). The offline copy on the TV is rewritten only when the list has really changed.
- **A welcoming first launch.** A fresh install shows **Choose what to watch**; choosing OTT Club asks for your key straight away.
- **Calmer lists.** The highlighted row no longer jumps or grows.
- **Clear naming.** The settings screen is titled **⚙ Settings**, like its row in the menu.
- **Adult channels are hidden by default.** Switch them on in **⚙ Settings → Adult channels**.
- **Every TV measurement is in the repository**, one folder per version, in [docs/measurements/](docs/measurements/).

## Everything it does

| Feature | What you get |
|---|---|
| 🔍 **Search** | Type part of a channel name or its number; results update as you type. |
| ★ **Favourites** | ⏯ (or Yellow) pins a channel. CH+ / CH− inside **★ Favourites** zaps through favourites only. |
| 🗂 **Groups** | **All channels**, **★ Favourites**, **Israel** and **Ukraine** first, then the provider's own groups exactly as it names them, and **No group** for channels it gives none. Empty groups are not shown. |
| 🇮🇱🇺🇦 **Israel and Ukraine with any provider** | A channel's country is recognised from its name, its playlist group, its guide id or the language of its programmes (`js/country.js`). |
| 📅 **Programme guide** | ▼ while watching: today's programmes, ◀ ▶ for other days, OK on a past show plays it from the archive. The guide loads per channel, only when you look at it. |
| ⏪ **Archive slider** | ▲ while watching: hold ◀ ▶ to scrub (faster as you hold), ▲ ▼ to jump between programmes, OK to watch from there. |
| 🏷 **Banner** | Channel, programme on air with its time range, what comes **Next**, a progress bar and a short tech line (resolution, codec, bitrate, sound). |
| 🔊 **Sound and picture** | Red picks the audio track; Green cycles **Full screen → Auto → Letterbox**. |
| 🧭 **Scroll bars** | A quiet scroll bar beside groups and channels shows where you are and where the list ends; lists never run into the hint bar on any screen size. |
| 💾 **Remembers you** | Each provider keeps your last channel and group; the app opens where you left off. |
| 🛡 **Survives bad networks** | Every stall, error or network drop reconnects with backoff (0.5 s up to 15 s). If the list server is down, the last list is shown and updates by itself. |
| 🔑 **Your key stays with OTT Club** | Used exactly as typed and only ever sent to OTT Club (pinned by tests). |
| 👤 **About** | **⚙ Settings** shows the version, build, TV model, Tizen and engine version, player, provider, channel count and buffer settings; **Author** opens the author's LinkedIn profile in the TV's browser. |

## See it in action

<table>
  <tr>
    <td><img src="docs/screenshots/ui-menu.jpg" alt="Channel menu: search, groups, channels with logos and what is on now"></td>
    <td><img src="docs/screenshots/ui-search.jpg" alt="Search: typing a few letters lists the matching channels"></td>
  </tr>
  <tr><td align="center"><b>OK · Channel menu</b>: groups, logos, what's on now</td><td align="center"><b>🔍 Search</b>: results as you type</td></tr>
  <tr>
    <td><img src="docs/screenshots/ui-slider.jpg" alt="Archive slider over the picture: scrub to any minute of the show"></td>
    <td><img src="docs/screenshots/ui-panel-1plus1.jpg" alt="Programme panel over 1+1 Україна: today's shows, the one on air highlighted"></td>
  </tr>
  <tr><td align="center"><b>▲ Archive slider</b>: scrub to any minute</td><td align="center"><b>▼ Programme guide</b>: past shows play from the archive</td></tr>
  <tr>
    <td><img src="docs/screenshots/channel-natgeowild.jpg" alt="Nat Geo Wild: a Nile crocodile close up, in full HD"></td>
    <td><img src="docs/screenshots/channel-discovery.jpg" alt="Discovery: sailing boats on the sea"></td>
  </tr>
  <tr><td align="center"><b>Nat Geo Wild</b> · full HD</td><td align="center"><b>Discovery</b> · documentary</td></tr>
  <tr>
    <td><img src="docs/screenshots/channel-channel9.jpg" alt="Channel 9, Israel, news"></td>
    <td><img src="docs/screenshots/channel-m1.jpg" alt="М1, Ukrainian music channel"></td>
  </tr>
  <tr><td align="center"><b>Channel 9</b> · Israel</td><td align="center"><b>М1</b> · Ukrainian music</td></tr>
</table>

<sub>The interface screenshots show the default Russian interface.</sub>

## 🆓 Start watching — free, in a minute

On the very first launch the app shows **Choose what to watch**:

| Choice | What happens |
|---|---|
| **iptv-org — free channels** | OK opens its playlists; OK on one starts it. No key, no sign‑up. |
| **OTT Club** | Asks for your key right away; Back returns to the choice. |
| **+ Add a provider** | Type or paste your provider's M3U link (`http://…` or `https://…`) and press OK. |

Back without a choice starts iptv-org's whole list. From then on the app opens on your last provider, group and channel.

**The free playlists built in** (all from the open [iptv-org](https://github.com/iptv-org/iptv) project, `js/config.js`):

| Playlist | |
|---|---|
| **The whole list — channels from around the world** | ~11 000 public channels (the default) |
| **Israel** · **Ukraine** | by country |
| **In Russian** · **In English — CNN, Bloomberg, DW, France 24, Euronews…** | by language |
| **News** · **Kids** · **Music** · **Movies** · **Documentary** · **Sports** | by category |

The player shows every channel a source lists and filters nothing — except adult channels, which stay hidden until you switch them on. A stream that does not play is the source's matter. No paid channels, keys or private playlists are included in this repository.

**Change provider any time:** OK (channel menu) → **Blue**, or the **📡 Providers** row just above **⚙ Settings**.

| Row in 📡 Providers | OK | Other keys |
|---|---|---|
| **OTT Club** | watch it | **Blue** — enter or change the key |
| **iptv-org — free channels** | open its playlists | built in, cannot be removed |
| your own providers | watch it | **Red** twice — remove it |
| **+ Add a provider** | type an M3U link | — |

The provider you are watching is marked **● now**.

**Want more?** [OTT Club](https://www.ottclub.tv) is built in: enter your key for **389 channels, the full programme guide and the 7‑day archive**. Any other paid provider works today through its M3U link. Built‑in support like OTT Club's (key, guide and archive from the provider's API) for other providers will come if there is interest — [tell us which one](https://github.com/yaroslavrudenko/nastin-kinozal/issues).

## 🌐 Interface languages

| Language | In the list | Direction |
|---|---|---|
| Russian (default) | Русский | left to right |
| Ukrainian | Українська | left to right |
| Hebrew | עברית | **right to left — the whole layout is mirrored** |
| English | English | left to right |

**Change it:** **⚙ Settings → 🌐 Interface language → OK**. The list shows all four languages, each written in itself, the current one marked ✓. Pick one with ▲ ▼ and press OK. The app restarts in that language on the same channel and group. Back, or OK on the current language, changes nothing. The 🌐 sign leads the row, so you can find it even in a language you cannot read.

- **Translated:** everything the app writes, including the groups the app forms itself — **🔍 Search, All channels, ★ Favourites, Israel, Ukraine, No group, 📡 Providers, ⚙ Settings**.
- **Never translated:** the provider's group names, channel names and programme titles. They appear exactly as the provider writes them, in any interface language.
- **Mixed scripts read correctly:** a Hebrew name in an English menu, or a Latin or Cyrillic one in the Hebrew menu, keeps its own direction, wrapped lines included. Technical text (host names, picture sizes) always reads left to right.

## 🎮 Remote control

The basic Samsung Smart Remote is enough; number and colour keys are optional.

| Key | While watching | In the menu and the guide |
|---|---|---|
| ◀ ▶ | previous / next channel | switch between groups and channels |
| ▲ | archive slider | move up |
| ▼ | programme guide (◀ ▶ change the day) | move down |
| OK | channel menu with **🔍 Search** | watch (the channel on screen is not restarted) |
| ⏯ | pause / play | add or remove a favourite |
| ⏪ ⏩ | archive slider, big steps | — |
| CH+ / CH− | next / previous channel | next / previous page, or archive day |
| Back | back to live; twice to exit | close |
| 0–9 | channel number | — |
| Red · Green · Blue | audio track · picture mode · stream info | Blue: **📡 Providers** |

## ⚙ Settings

OK (channel menu) → **⚙ Settings**, the last row of the groups. ▲ ▼ choose, OK opens or switches, Back closes.

| Row | What it does | Default |
|---|---|---|
| **🌐 Interface language** | opens the list of the four languages | Русский |
| **Fast channel switching** | keeps the player between channels for faster switching | on |
| **Full-screen picture** | yes — the picture fits the screen exactly · no — the stream's own proportions | yes |
| **Adult channels** | shown in the menu · hidden | hidden |
| **Author** | opens the author's LinkedIn profile in the TV's browser | — |

## ⚡ Performance: what improved and why

Every number below was measured **on the TV** (Samsung UE50MU7000, Tizen 3.0, Chromium 47, OTT Club with 389 channels), unless it is marked *desktop*. The raw logs and the scenarios that produced them are in the repository: [1.8.4](docs/measurements/2026-10-27-tv-1.8.4/README.md) · [1.9.0](docs/measurements/2026-10-28-tv-1.9.0/README.md) · [1.9.1](docs/measurements/2026-10-28-tv-1.9.1/).

### The story

| What you noticed | Why it happened | What we changed | Measured result |
|---|---|---|---|
| Logos appearing, vanishing and redrawing while scrolling | Logos were only requested once the cursor stopped, then many arrived at once | The page on screen, 2 pages ahead and 1 behind are requested on every key; the watched group's logos load in the background after the picture starts; each logo is kept in memory for the session and refreshed with the hourly list | Frames with logos popping in: **47–108 → 0**; logos drawn in on screen: **up to 68 → 0** |
| Jerky scrolling | Each page key wrote every row's logo several times | Each row's logo is set once per screen update, and only when it changes | Frames over 34 ms holding ▼: **15 → 2**; CH+ back: **23 → 1** |
| A spinner on every channel change | The spinner showed from the moment a stream opened until the picture moved | It shows only if the start takes longer than ~1.6 s | Spinner in 16 channel changes: **every time → 0–1** |
| Channel switching | A new player for every channel | **Fast channel switching**: the player is kept between channels | Key → picture **1063 → 984 ms**; 200 switches, **0 failures**, no slowdown |
| Lists out of date | The list was fetched every 6 hours | Every hour, and every list downloaded is applied | Lists at most 1 hour old |
| Needless storage writes | The offline copy was written even when nothing had changed | Written only when the list changed; written after the first picture, not before | **0** writes per unchanged hour; offline copy **500 KB → 44 KB** *(desktop)* |
| Slow, chatty zapping | Every ◀ ▶ downloaded a 205 KB guide, after a fixed 350 ms delay | Guides load once and only when needed; the key acts at once | Requests per 10 quick presses **20 → 3**; delay **350 → 0 ms** *(desktop)* |
| Busy when idle or failing | A failed guide was retried in a tight loop; background checks kept running | Backoff, and nothing runs while nothing changes | Failed‑guide requests in 10 min **12 007 → 5**; requests in a 10‑min pause **200 → 0** *(desktop)* |

### 1.8.4 → 1.9.0 → 1.9.1 on the TV

| Measure | 1.8.4 | 1.9.0 | 1.9.1 |
|---|---|---|---|
| Channel switch ▶ ◀, key → picture | 1063 ms | 982 ms | **984 ms** |
| Logo pop‑in while scrolling (frames) | 47–108 | — | **0** |
| Frames over 34 ms, holding ▼ | 15 | — | **2** |
| Frames over 34 ms, CH+ back | 23 | — | **1** |
| CH+ back, key → screen | 64 ms | — | **49 ms** |
| Group keys, key → screen | 50 ms | — | **37 ms** |
| Channel list load | 4047 ms | — | **3878 ms** |
| Channel by number (digits) | 2948 ms | — | **2842 ms** |
| Big spinner in 16 channel changes | every time | — | **0–1** |
| "Now" lines matching the guide | — | **13 / 13**, 0 stale | — |
| Four OTT Club groups, 20 s per channel | 0 freezes | 0 freezes, 0 spinner while watching | — |

"—" means the measure was not part of that run. More: [docs/PERFORMANCE.md](docs/PERFORMANCE.md).

### Our rule

Performance never costs freshness: no refresh is made rarer to look faster, and no cache is added that would show you an old list or an old "now on air" line.

## ✅ Testing

| | |
|---|---|
| **Automated tests** | **433 tests, all passing**, in 50 files: 38 behaviour suites and 12 headless‑browser layout suites. The browser suites check wrapping, paging, scroll bars, logo boxes, mixed‑direction text and the Hebrew right‑to‑left layout. |
| **Mutation‑proven fixes** | For every fix, the guard is removed and the test must turn red, then the guard is restored and it must turn green again. |
| **Independent reviews** | Every batch is reviewed by people who did not write it: a native code reviewer, Codex as an external reviewer, and a performance analyst (plus a designer for layout). The first full review raised 230 findings, and every one was given a status. |
| **On the real TV** | Every release is measured on a 2017 UE50MU7000. The scenarios drive the app with remote key events through its inspector and read the results inside the TV page, on one clock. The raw logs are committed next to each scenario. |
| **Acceptance plan** | The viewer's basic journey in every group, plus a matrix covering every channel, the high‑bitrate movie channels, Israel and Ukraine HD, long names and archives across midnight: [docs/TESTING.md](docs/TESTING.md). |

Highlights from the TV:
- **0 stalls, 0 rebuffers and 0 reconnects** across three movie channels watched for 10 minutes each.
- **0 freezes** across four OTT Club groups, watching each channel for 20 s (up to 90 channels per group).
- **8 of 8** archive opens on the heaviest movie channels played.
- **0 failures** in 200 channel switches with **Fast channel switching**.

## 📡 Your own playlists, in depth

Add any provider's **M3U link** in **📡 Providers → + Add a provider**, or build it in with `PLAYLIST_URL=` in `build.local.env`, because typing a long URL with a remote is slow. A link that carries the provider's own key (`…/playlist/<key>/…`, `?key=…`, `get.php?username=…&password=…`) is used as it is. From an extended M3U the player reads:

| Playlist attribute | What it gives you |
|---|---|
| `group-title` / `#EXTGRP` | the groups in the menu |
| `tvg-logo`, `tvg-id` | logos; programme guide matching |
| `url-tvg` / `x-tvg-url` in `#EXTM3U` | the programme guide (XMLTV, uncompressed) |
| `catchup`, `catchup-source`, `catchup-days` (or `tvg-rec`, `timeshift`) | the archive and the slider: `default` / `append` templates (`{utc}`, `{lutc}`, `{start}`, `{end}`, `{duration}`, `{offset}`, `{Y}{m}{d}{H}{M}{S}`), `shift` and `flussonic` |

Without catch‑up attributes, live TV, groups, favourites and search still work; only the archive is missing.

**The OTT Club key:** enter it in **📡 Providers** with **Blue** (or OK on the **OTT Club** row). It is saved exactly as typed, used at once and only ever sent to OTT Club. The player never judges the key itself: OTT Club does, and a key it refuses shows OTT Club's own error picture in the stream. A link from your OTT Club account works too. You can also build the key in with `OTT_KEY=` in `build.local.env`.

## 🚀 Install

**[docs/DEPLOY.md](docs/DEPLOY.md) is the full guide**, written from a real install. It covers Developer Mode, the Tizen CLI on Apple Silicon, the macOS local‑network trap, Samsung certificates without the broken Certificate Manager, and the **device profile without which every install fails with `118`**.

In short:

```sh
sdb connect <tv-ip>:26101 && sdb shell 0 getduid             # the TV's DUID
node tools/samsung-cert.mjs --duid <DUID> --name kinozal     # sign in to Samsung once; certificates + device profile
printf 'CERT_PROFILE=kinozal\nDEVICE_PROFILE=%s\nTV=<tv-ip>:26101\n' ~/tizen-studio-data/keystore/kinozal/device-profile.xml > build.local.env
./build.sh                                                   # sign, push the device profile, install, start
```

`build.local.env` stays on your machine and is never committed. The daisy icon appears among your TV's apps. A TV built with a key or a playlist in `build.local.env` skips **Choose what to watch** and starts on it. The choice also comes back whenever no provider is usable any more, so the player never tries to load an empty link.

**The TV's address can change** (the router hands it out): `./build.sh` and the TV test runs check the saved address and, if the TV is not there, scan the local network for it (`tools/find-tv.sh`; [docs/DEPLOY.md §3](docs/DEPLOY.md)).

## Why this project exists

- **The official OTT Club app on these TVs is stuck at version 1.0.6.** It is a 56 KB shell that downloads its menu from the provider's server. The Android app moves on (2.6x in 2026), but the code it sends to the TV now uses JavaScript that the TV's 2015‑era web engine cannot run: errors in the menus, frozen screens, channels that hang.
- **Samsung no longer updates these TVs.** The firmware is signed and locked; the only fix inside the TV is an app written for the engine it actually has.
- **The goal:** a player that is fast, reliable and complete on old hardware, with every feature a viewer cares about, and that never hangs.

«Настин кинозал» means "Nastya's cinema": a cinema at home, one that simply works.

### Design principles

- **Native playback first.** Video is decoded by the TV's hardware player (AVPlay), not in JavaScript.
- **Never block the screen.** Lists are virtualised, so a 1000‑channel playlist moves like a 10‑channel one; the guide loads one channel at a time.
- **Assume the network fails.** Every stall, error or network drop reconnects with backoff.
- **Never show a stale list.** Channels come from the provider at every start and every hour.
- **Write for the oldest engine.** Plain ES5, checked with `acorn --ecma5`, no build step.

## 🗺 Roadmap

**A universal player for any provider**
- [x] **📡 Providers**: OTT Club, 11 free playlists, your own M3U playlists (added and removed on the TV).
- [x] The interface in Russian, Ukrainian, Hebrew (right to left) and English.
- [ ] Other paid providers, if there is interest: Xtream Codes (server + login), possibly Stalker/MAG portals.
- [ ] Programme guide (XMLTV) by URL, independent of the playlist.
- [ ] Catch‑up formats always taken from the playlist itself.
- [ ] OTT Club as one built‑in preset instead of the default.

**Publish in the Samsung TV app store** (Samsung Apps, via Tizen Seller Office)
- [ ] No built‑in provider or channels: users bring their own subscription.
- [ ] A privacy policy.
- [ ] Store icons and screenshots.
- [ ] Samsung certification on several TV generations.

**Ideas**
- [ ] Enter the playlist from a phone by scanning a QR code on the TV.
- [ ] An LG webOS port and an Android TV build.
- [ ] Settings backup and restore.

## 📚 Documentation

| Document | What is in it |
|---|---|
| [docs/DEPLOY.md](docs/DEPLOY.md) | Installing on a TV, step by step |
| [docs/TESTING.md](docs/TESTING.md) | The TV acceptance plan and every test batch |
| [docs/PERFORMANCE.md](docs/PERFORMANCE.md) | Every performance change with its before/after numbers |
| [docs/measurements/](docs/measurements/) | Raw TV measurements per version |
| [docs/TEST-REPORT-2026-10-26.md](docs/TEST-REPORT-2026-10-26.md) | The TV test report of 2026‑10‑26 |

---

<p align="center">
  <b>Made with love for Настя: a cinema at home, one that simply works.</b><br>
  If it brought your old TV back to life, <a href="https://github.com/yaroslavrudenko/nastin-kinozal">give it a ⭐</a>.
</p>
