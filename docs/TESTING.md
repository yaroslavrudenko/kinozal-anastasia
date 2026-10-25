# TV acceptance test plan — «Настин кинозал»

A build is accepted only when every scenario below passes **on the real TV** (UE50MU7000). Desktop tests and code reviews are not acceptance.

Each result row records the date, build (commit), channel (name, list position, bitrate) and the measured value. A failed row blocks the release, and the previous working build goes back on the TV.

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
