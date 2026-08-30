# RabbitHole trailer

The trailer is cut by hand in **Microsoft Clipchamp**, exported, and committed as
a binary. The one exception is the "one guide opens three more" beat, which is
built from stills by `apps/studymesh/scripts/build-trailer-beat.mjs` and spliced
in with ffmpeg. This file is the storyboard and the asset inventory so the next
cut does not start from zero.

## Assets

| Path                                                | What it is                                                                                   |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `apps/studymesh/public/videos/trailer.mp4`          | The cut the app plays. 1920x1080, 30 fps, h264 + AAC. **This one ships.**                    |
| `apps/studymesh/public/videos/trailer-LinkedIn.mp4` | Higher-bitrate LinkedIn export. Referenced by nothing; repo weight only, and one cut behind. |
| `apps/studymesh/public/videos/trailer-bunny.mp4`    | ~9 s bunny animation used as the outro source.                                               |
| `apps/studymesh/public/videos/trailer-poster.jpg`   | 1280x720 poster frame shown before playback.                                                 |
| `apps/studymesh/public/voice/v0_*.mp3`              | Raw narration clips. Editor input; no code reads them.                                       |
| `readme_docs/trailer/reference/*.png`               | UI stills of the follow-up-guides flow. The beat below is built straight out of these.       |

`apps/studymesh/webpack.config.prod.js` copies **only** `trailer.mp4` and the
poster into `dist/`, and on purpose without `noErrorOnMissing`: a missing trailer
used to turn the landing hero into a black box, so the build fails loudly instead.

The player is `TrailerSection` in
`apps/studymesh/src/components/landing/StudyMeshLanding.tsx`. It starts paused on
the poster and unmuted, with custom controls (play/pause, ±5 s jog, scrubber,
mute, fullscreen on the frame rather than the `<video>`). The cut crops the
intro's 2 black pixel columns per side before scaling, so the picture is a true
16/9.

## Shape of the cut (measured with ffprobe/ffmpeg, not guessed)

- 0 → 45.4 s: UI screencast, average luma ≈ 208-218.
- 45.5 → 50.5 s: the bunny outro, luma ≈ 168-176.
- 51.0 → 57.4 s: static end card, luma pinned at 207.895, fading out from 56.5.
- 44.5 → 45.4 s the audio sits at -36…-41 dBFS, its quietest point outside head
  and tail, and jumps back to -20 dB at 45.5. **That trough at 45.0 s is the
  seam** any new material should be cut into: the join lands in near-silence and
  the bunny still starts on its own downbeat.

Re-run the probes after a re-export:

```
ffmpeg -v error -i trailer.mp4 -vf "fps=1,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" -f null -
ffmpeg -v error -i trailer.mp4 -af "aformat=channel_layouts=mono,asetnsamples=n=22050,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-" -f null -
```

## Voice-over

Plain, second-person, one short line per beat. Name new clips after their line,
the way `v0_12_*` and `v0_16`/`v0_17` do — the filenames are the only script this
repo keeps.

| File                                                                    | Duration                                                              |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `v0_01.mp3`                                                             | 2.82 s                                                                |
| `v0_02.mp3`                                                             | 3.11 s                                                                |
| `v0_03.mp3`                                                             | 3.60 s                                                                |
| `v0_04.mp3`                                                             | 2.32 s                                                                |
| `v0_05.mp3`                                                             | 1.62 s                                                                |
| `v0_06.mp3`                                                             | 1.33 s                                                                |
| `v0_07.mp3`                                                             | 2.51 s                                                                |
| `v0_08.mp3`                                                             | 2.51 s (alternate take of 07)                                         |
| `v0_09.mp3`                                                             | 5.28 s                                                                |
| `v0_10.mp3`                                                             | 1.20 s                                                                |
| `v0_11.mp3`                                                             | 3.29 s                                                                |
| `v0_12_1-curious-about-something.mp3`                                   | 1.52 s — "Curious about something?"                                   |
| `v0_12_2-rabbithole-turns-it-into-a-place-you-can-actually-explore.mp3` | 3.37 s — "RabbitHole turns it into a place you can actually explore." |
| `v0_13.mp3`                                                             | 9.01 s                                                                |
| `v0_14.mp3`                                                             | 2.87 s                                                                |
| `v0_15.mp3`                                                             | 5.80 s                                                                |
| `v0_16-finish-a-guide-and-it-opens-three-more.mp3`                      | 2.59 s — "Finish a guide, and it opens three more."                   |
| `v0_17-each-one-explained-through-what-you-just-learned.mp3`            | 2.64 s — "Each one explained through what you just learned."          |

## Beat: "one guide opens three more"

Finishing a guide's quiz hands the reader three follow-up guides, and every new
guide is explained through the skill just earned. The trailer sold everything
except that loop, so this beat goes in as the **climax: the last thing before the
bunny outro**, 9.73 s at the 45.0 s seam. The cut is now 66.57 s.

### It is designed, not recorded

A raw screenshot dropped edge to edge looks nothing like the rest of the trailer.
The existing frames have a house style, kept here as
`reference/style-19-trailer-card-frame.png` and
`reference/style-20-trailer-gradient-slide.png`:

- app screenshots sit in a **rounded white card with real padding and a soft
  shadow, on a periwinkle ground**, with a tilted chip label above the corner;
- statements get their own **pastel gradient slide** with a bold dark headline and
  white rows with a coloured accent bar.

So every frame of this beat is an HTML slide rendered through headless Chromium
(Playwright) at 1920x1080, holding the real screenshots. The palette was sampled
out of those two frames with ffmpeg, not guessed:

| Token            | Value                                                            |
| ---------------- | ---------------------------------------------------------------- |
| Ground           | `#C1D7FF`                                                        |
| Chip             | `#90AEE2`, white 600-weight type, rotated -1.4°                  |
| Ink              | `#1A1F30`                                                        |
| Row accents      | `#1A56DB`, `#0F766E`, `#A21567`                                  |
| Gradient corners | `#E3DCFB`, `#D2E8D1`, `#FEE1C1`, `#C5DEFF`, `#E5D5EB`, `#DDE6C9` |

Type is Readex Pro, the landing page's face.

### Shots

| #   | Slide          | Hold  | Content                                                                                           |
| --- | -------------- | ----- | ------------------------------------------------------------------------------------------------- |
| 1   | `quiz`         | 1.8 s | Chip "Quiz complete"; the whole result ring, right **and** wrong, from `21-quiz-results-card.png` |
| 2   | `ideas`        | 1.2 s | Chip "Three ways to go deeper"; the three follow-ups, none picked                                 |
| 3   | `picked`       | 1.2 s | Same frame, **cut** not dissolved: all three ticked, button reads "Create 3 guides"               |
| 4   | `building`     | 1.1 s | Chip "Building them for you"; **one** progress card, cropped out of the pair in the screenshot    |
| 5   | `quickstart`   | 2.0 s | Chip "Every new guide"; a real Quick Start with the `Via <skill>` tab                             |
| 6-8 | `message-1..3` | 3.9 s | Gradient slide: the headline, then one row landing every 0.5 s                                    |

Consecutive card slides alternate their push, in then out, so five framed
screenshots in a row do not read as a slideshow. Shot 4 shows a single progress
card on purpose: the screenshot holds two, and two cards straight after a button
that says "Create 3 guides" reads as a miscount.

The message slide reads:

> **Each one explained through what you already know.**
> Caffeine and dreams · Plan caffeine timing · Receptor blockers — each `via
Caffeine and adenosine signaling`

Rows that have not arrived keep their space, so the three renders never reflow.

The count has to hold across the beat, which is why the first shot uses the clean
results card rather than the browser screenshot whose button said "Create 2
guides". No modal and no Carrot cost: billing is not what this beat sells.

### Voice-over

Voice only, over silence, loudness-matched to `I=-16 TP=-1.5`:

- `v0_16` at +0.3 s, across shots 1-3.
- `v0_17` at +6.1 s, over the Quick Start and into the message slide.

**Do not add a music bed lifted out of `trailer.mp4`.** Its audio has the
trailer's own narration baked in, so any slice of it drags another voice line
("RabbitHole, on your laptop or your phone…") into the beat. There are no stems.
The 45.0 s seam is the trailer's quietest point, so the music fades under the
0.3 s join and comes back with the bunny.

### Building it

```
node apps/studymesh/scripts/build-trailer-beat.mjs beat
node apps/studymesh/scripts/build-trailer-beat.mjs splice
node apps/studymesh/scripts/build-trailer-beat.mjs install
```

`beat` renders the slides and writes `trailer-beat.mp4` to
`%TEMP%/rabbithole-trailer` (`TRAILER_BUILD_DIR` overrides it); the slide PNGs
land there too, which is the fastest way to check a design change. `splice` cuts
the trailer at 45.0 s, dissolves head → beat → tail with 0.3 s joins, and
re-encodes once (CRF 22, preset slow, AAC 128k, ~7.2 MB). `install` then copies
the result over `public/videos/trailer.mp4`.

`splice` must run against the **original** 57.4 s trailer; on an already-spliced
file it would insert the beat twice, so it refuses anything longer than 60 s.
Restore the original with `git checkout -- apps/studymesh/public/videos/trailer.mp4`
(or set `TRAILER_FORCE_SPLICE=1` if you really mean it).

## Recording checklist (for beats shot live)

- 1920x1080, 30 fps, browser at 100 % zoom, no devtools.
- Hide the **TWD** dev badge on the right edge.
- Hosted AI account with enough Carrots for two guides, so the modal shows a cost.
- Finish the guide's quiz above 50 % and leave the skill **un-claimed**, or the
  green flip never happens on camera.
- Start from a profile where those three follow-ups do not exist yet, or the cards
  render as already created and cannot be selected.
- Record the new guides in a second pass, once they exist, so there is no dead
  wait on camera.

## Export checks

- `ffprobe -v error -show_entries format=duration,size` on `trailer.mp4`: expected
  duration, 1920x1080, 30 fps, h264 + AAC stereo, file under ~8 MB.
- `npm --workspace studymesh run build` — fails loudly if `trailer.mp4` is missing
  or misnamed.
- `npm --workspace studymesh run start`, then on the landing page: poster shows,
  play/pause works, ±5 s jog and the scrubber track the new duration, mute and
  fullscreen still work.
- Watch the joins full screen: no stutter, and the "Via <skill>" tab text readable
  at 100 % scale.
