# RabbitHole trailer

The trailer is cut by hand in **Microsoft Clipchamp**, exported, and committed as
a binary. `apps/studymesh/scripts/build-trailer-beat.mjs` then does two things to
that export with ffmpeg: it punches in on the opening, and it splices in the
"one guide opens three more" beat. This file is the storyboard and the asset
inventory so the next cut does not start from zero.

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
bunny outro**, 11.47 s at the 45.0 s seam. The cut is now 67.77 s.

### One scene, not a slideshow

Every element keeps its identity for the whole beat and moves; nothing cuts to a
replacement frame. That is why the layout is a set of keyframes measured off the
real DOM rather than a stack of separate slides, and why the section carries one
chip, **RabbitHoles**, instead of a caption per shot.

| Stage       | Kind      | What happens                                                                      |
| ----------- | --------- | --------------------------------------------------------------------------------- |
| `result`    | 1.6 s     | The quiz result alone, centred at 1.5x, titled with the skill it earned           |
| `open`      | 20 frames | It slides left and shrinks; an arrow draws to the right; the three picks arrive   |
| `pair`      | 1.0 s     | Held side by side                                                                 |
| `promote`   | 22 frames | The result fades out; the picks travel to top centre and grow back to full size   |
| `guide-1…3` | 2.2 s     | A coloured arrow and the guide it became, one at a time                           |
| `open-a`    | 24 frames | The column slides left and shrinks; the first guide lights; its Quick Start lands |
| `read-a`    | 1.5 s     | Held                                                                              |
| `open-b`    | 16 frames | The second guide lights; its Quick Start lands underneath the first               |
| `read-b`    | 3.5 s     | Held: picks, arrows, three guides, two connectors, two opened Quick Starts        |

The result card is titled `QUIZ COMPLETE / Caffeine and adenosine signaling`
(`QUIZ` in the script). The ring on its own says nothing about what was learned,
and that skill is what the three follow-ups then bridge from, so naming it there
makes the `via …` line under every guide land.

The final frame is the whole argument at once: three picks on top, a coloured
arrow under each, the guide each became, and two of them opened on the right —
different subjects, different key ideas, the same
`Via Caffeine and adenosine signaling` tab on both. Each Quick Start carries its
real key idea and a two-paragraph quick summary, set as type rather than pasted
as a screenshot so it stays readable at this size.

Details that matter if the layout is edited:

- Movement stages render **one PNG per frame**, not a dissolve between two end
  states: a cross-fade looks like a cross-fade, and these elements are meant to
  travel. Holds are single stills.
- Keyframes come from a measuring pass — the quiz card, the column, the picks
  card, each guide row's centre and each Quick Start's height are read off the
  page, then the positions are computed. Retune `RESULT_SCALE`, `PAIR_SCALE`,
  `PAIR_MARGIN`, `COLUMN_LEFT_X`, `SHIFT_SCALE` or `DETAIL` and everything
  re-derives, connectors included. The two opening stages are deliberately held
  large: at 1:1 the result read as a stamp in the middle of an empty frame, and
  the pair is sized to fill the width between thin margins.
- Connectors are **rounded right-angle elbows**, not beziers. A single curve over
  that short horizontal run hooked back under its own arrowhead.
- The hand-off arrow fades out in the first quarter of `promote`, because the
  column travels back past the quiz and an arrow whose head ends up behind its
  tail reads as a glitch.
- `CUT` is two frames, not one. `xfade` with a single-frame duration silently
  drops its second input, and the chain stops growing.

### The opening punch-in

The first shot after the logo is the New Quick Guide modal, which the recording
holds dead centre at about a third of the frame width — it read as a stamp on an
empty gradient. `splice` pushes in to **1.5x** (`OPENING_ZOOM`), holds, then
eases back to 1:1, both ramps smoothstepped.

The **logo card stays at 1:1**. The push runs 1.2 → 1.8 s, under the slow
dissolve that replaces the logo, so the modal is already at full size by the time
it is solid and the logo never scales. It holds to 2.7 s and is back to 1:1 by
3.4 s — before the recording itself starts sliding the modal up and bringing the
workspace in. So both ends are untouched, measured against the base cut: PSNR
≈ 67 dB over the logo and ≈ 51 dB from 3.4 s on, which is re-encode noise only.

Only the first 3.5 s go through `zoompan`; the rest of the head is passed through
untouched and the two are concatenated. Resampling the whole head would have
softened 40 s of screencast text for the sake of three seconds.

1.5x is a deliberate ceiling. The modal is ~705 px wide in the source, so filling
80 % of the frame would mean a 2.15x blow-up, and the softness shows.

### Where the beat sits

`SEAM` is 45.0 s, the trailer's quietest point, and the head dissolves into the
beat there over 0.3 s.

`TAIL_START` is **45.83 s**, not 45.0: the half second after the seam is the
previous gradient slide still holding, and resuming the tail there flashed
"Ask it something you have actually been wondering about" back onto the screen
after the beat had already replaced that thought. 45.83 is chosen precisely — the
base cut has true digital silence from 45.55 to 45.82 and the outro's first voice
line starts immediately after it, so the join lands in that gap without clipping a
word, and the picture is already the bunny.

The beat → tail join is a **hard cut on both streams**, unlike the head → beat
join. Crossfading it ramped that first voice line up from silence over 0.3 s,
which is audible however short the fade is. `concat` on video and audio keeps the
two streams the same length, so nothing drifts.

### Voice-over

Voice only, over silence, loudness-matched to `I=-16 TP=-1.5`:

- `v0_16` at +0.3 s, over the result and the picks.
- `v0_17` at +6.1 s, as the first Quick Start opens.

**Do not add a music bed lifted out of `trailer.mp4`.** Its audio has the
trailer's own narration baked in, so any slice of it drags another voice line
("RabbitHole, on your laptop or your phone…") into the beat. There are no stems.
The seam is quiet, so the music fades under the 0.3 s join and comes back with the
bunny.

### Palette

Sampled out of the trailer's own frames with ffmpeg, kept as
`reference/style-19-trailer-card-frame.png` and
`reference/style-20-trailer-gradient-slide.png`:

| Token          | Value                                           |
| -------------- | ----------------------------------------------- |
| Ground         | `#C1D7FF`                                       |
| Chip           | `#90AEE2`, white 600-weight type, rotated -1.4° |
| Ink            | `#1A1F30`                                       |
| Accents        | `#1A56DB`, `#0F766E`, `#A21567`                 |
| Hand-off arrow | `#5A6B99`                                       |

Type is Readex Pro, the landing page's face. Cards are white, 20-22 px radius,
with a soft shadow — the same frame the rest of the trailer puts the app in.

### Building it

```
node apps/studymesh/scripts/build-trailer-beat.mjs beat
node apps/studymesh/scripts/build-trailer-beat.mjs splice
node apps/studymesh/scripts/build-trailer-beat.mjs install
```

`beat` renders every frame through headless Chromium and writes
`trailer-beat.mp4` to `%TEMP%/rabbithole-trailer` (`TRAILER_BUILD_DIR` overrides
it). The PNGs land there too — `still-*.png` for the holds and `seq-<stage>-*.png`
for the movement — which is the fastest way to check a design change. `splice`
cuts at 45.0 s, dissolves the head into the beat, hard-cuts into the tail, and re-encodes once
(CRF 22, preset slow, AAC 128k). `install` copies the result over
`public/videos/trailer.mp4`.

**Splice against the pre-beat cut, not the shipped one.** Once a spliced trailer
is committed, the working copy already carries a beat and splicing it again
stacks a second one, so `splice` refuses anything longer than 60 s. Point it at
the base instead:

```
git show 5901b02:apps/studymesh/public/videos/trailer.mp4 > %TEMP%/rabbithole-trailer/trailer-base.mp4
TRAILER_BASE=%TEMP%/rabbithole-trailer/trailer-base.mp4 node apps/studymesh/scripts/build-trailer-beat.mjs splice
```

`5901b02` ("Improve trailer 3") is the last cut without this beat, 57.43 s.
`TRAILER_FORCE_SPLICE=1` overrides the guard if you really mean it.

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
