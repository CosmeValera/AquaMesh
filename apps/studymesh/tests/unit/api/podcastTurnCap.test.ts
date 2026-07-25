import { describe, expect, it } from 'vitest'

import {
  alternatePodcastSpeakers,
  capPodcastTurns,
} from '../../../../../api/hosted-ai'

const buildTurns = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    speaker: (index % 2 === 0 ? 'hostA' : 'hostB') as 'hostA' | 'hostB',
    text: `turn ${index + 1}`,
  }))

describe('capPodcastTurns', () => {
  it('leaves a script inside the budget untouched', () => {
    const turns = buildTurns(18)

    expect(capPodcastTurns(turns)).toEqual(turns)
  })

  it('keeps the closing turn when the script overflows', () => {
    // The bug this guards: a plain .slice(0, 18) dropped the tail, so a real
    // episode ended mid-thought on a question the other host never answered.
    const turns = buildTurns(21)

    const capped = capPodcastTurns(turns)

    expect(capped.at(-1)).toEqual(turns.at(-1))
    expect(capped.length).toBeLessThanOrEqual(18)
  })

  it('does not leave the same host on both sides of the cut', () => {
    // 21 turns puts hostA at both index 16 and the end, so the seam would
    // otherwise have one host answering themselves.
    const capped = capPodcastTurns(buildTurns(21))

    const seamRepeats = capped.filter(
      (turn, index) => index > 0 && turn.speaker === capped[index - 1].speaker,
    )
    expect(seamRepeats).toEqual([])
  })

  it('spends the whole budget when the seam already alternates', () => {
    // 22 turns puts hostB at the end and hostA at index 16, so the seam is
    // already clean and no turn should be given up for it.
    const capped = capPodcastTurns(buildTurns(22))

    expect(capped.length).toBe(18)
    expect(capped.at(-1)?.text).toBe('turn 22')
  })
})

const speakersOf = (turns: { speaker: string }[]) =>
  turns.map((turn) => turn.speaker)

describe('alternatePodcastSpeakers', () => {
  it('leaves an already alternating script untouched', () => {
    const turns = buildTurns(6)

    expect(alternatePodcastSpeakers(turns)).toEqual(turns)
  })

  it('repairs the seams a live episode came back with', () => {
    // The real speaker sequence from the compound run: clean through turn 13,
    // then hostA/hostA, hostB/hostB, hostA/hostA once short question turns
    // landed next to the turns that answered the previous question.
    const live = [
      'hostA', 'hostB', 'hostA', 'hostB', 'hostA', 'hostB',
      'hostA', 'hostB', 'hostA', 'hostB', 'hostA', 'hostB',
      'hostA', 'hostA', 'hostB', 'hostB', 'hostA', 'hostA',
    ].map((speaker, index) => ({
      speaker: speaker as 'hostA' | 'hostB',
      text: `turn ${index + 1}`,
    }))

    const repaired = alternatePodcastSpeakers(live)

    expect(
      repaired.filter(
        (turn, index) => index > 0 && turn.speaker === repaired[index - 1].speaker,
      ),
    ).toEqual([])
    // Only the labels move; the dialogue itself must survive in order.
    expect(repaired.map((turn) => turn.text)).toEqual(live.map((t) => t.text))
  })

  it('keeps whichever host the model opened on', () => {
    const opened = alternatePodcastSpeakers([
      { speaker: 'hostB', text: 'one' },
      { speaker: 'hostB', text: 'two' },
      { speaker: 'hostA', text: 'three' },
    ])

    expect(speakersOf(opened)).toEqual(['hostB', 'hostA', 'hostB'])
  })

  it('handles an empty transcript', () => {
    expect(alternatePodcastSpeakers([])).toEqual([])
  })
})
