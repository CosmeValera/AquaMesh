import { describe, expect, it } from 'vitest'

import { createPartialJsonReader } from '../../../../../api/streamingJson'

const GUIDE = {
  title: 'CRISPR Gene Editing',
  folderName: 'Biology',
  emoji: '🧬',
  quickStart: {
    keyIdea:
      'CRISPR finds a chosen DNA sequence and cuts it, so the cell repairs it.',
    quickSummary:
      'A guide RNA carries the address, and a nuclease does the cutting.',
  },
  plannedLessons: [
    { title: 'Delivery methods', summary: 'Getting it into a cell.' },
  ],
  pages: [
    {
      title: 'What a nuclease is',
      summary: 'A protein that cuts DNA.',
      rawNotes: 'Cas9 is the best known one.\nIt makes a double-strand break.',
      pageIdeas: ['Cas9', 'double-strand break'],
    },
    {
      title: 'Guide RNA',
      summary: 'The address label.',
      rawNotes: 'About 20 bases long. Pairs with the target sequence.',
      pageIdeas: ['base pairing'],
    },
    {
      title: 'Off-target risk',
      summary: 'Similar sequences get cut too.',
      rawNotes: 'A "quoted" phrase and a backslash \\ both have to survive.',
      pageIdeas: ['specificity'],
    },
  ],
  // Last two, mirroring createMonolithGuideSchema: neither is needed for page 1
  // to be readable, so both are written after the pages.
  contextPlan: {
    targetParts: ['guide RNA', 'nuclease', 'repair'],
    selectedTopics: ['find-and-replace in a text editor'],
    correspondences: [
      { carries: 'the search box', from: 'find-and-replace', to: 'guide RNA' },
    ],
    reason: 'Both locate an exact string, then act on it.',
    breaksAt: 'A text editor never mis-cuts a similar-looking line.',
    personalizedQuickStart: {
      keyIdea: 'Think of it as find-and-replace running inside a living cell.',
      quickSummary: 'The guide RNA is the search box. The nuclease is the replace.',
    },
    bridgeBlock: {
      title: 'Like find-and-replace',
      body: 'You type a string, the editor locates it, then it swaps it out.',
    },
  },
  nextGuideIdeas: [
    {
      title: 'Base editing',
      summary: 'Change one letter, no double-strand break.',
    },
    {
      title: 'Off-target effects',
      summary: 'Why "close enough" matches are a problem.',
    },
  ],
}

const SOURCE = JSON.stringify(GUIDE)

/**
 * Every value the reader hands back must already be final. Containers may be
 * short or missing later keys, but nothing present is allowed to be torn.
 */
const expectFinishedSubsetOf = (partial: unknown, final: unknown) => {
  if (Array.isArray(partial)) {
    expect(Array.isArray(final)).toBe(true)
    const finalItems = final as unknown[]
    expect(partial.length).toBeLessThanOrEqual(finalItems.length)
    partial.forEach((item, index) =>
      expectFinishedSubsetOf(item, finalItems[index]),
    )
    return
  }

  if (partial && typeof partial === 'object') {
    expect(typeof final).toBe('object')
    const finalEntries = final as Record<string, unknown>
    Object.entries(partial as Record<string, unknown>).forEach(
      ([key, value]) => {
        expect(finalEntries).toHaveProperty(key)
        expectFinishedSubsetOf(value, finalEntries[key])
      },
    )
    return
  }

  expect(partial).toEqual(final)
}

const collectSnapshots = (chunkSize: number) => {
  const reader = createPartialJsonReader()
  const snapshots: unknown[] = []

  for (let index = 0; index < SOURCE.length; index += chunkSize) {
    if (reader.push(SOURCE.slice(index, index + chunkSize))) {
      const snapshot = reader.snapshot()
      if (snapshot) {
        snapshots.push(snapshot.value)
      }
    }
  }

  return { reader, snapshots }
}

describe('createPartialJsonReader', () => {
  it('rebuilds the whole document once the root closes', () => {
    const { reader } = collectSnapshots(7)
    const snapshot = reader.snapshot()

    expect(snapshot?.complete).toBe(true)
    expect(snapshot?.value).toEqual(GUIDE)
  })

  it('keeps the accumulated text untouched', () => {
    const { reader } = collectSnapshots(13)

    expect(reader.text()).toBe(SOURCE)
  })

  it.each([1, 3, 17, 64, 512])(
    'never emits a torn value at chunk size %i',
    (chunkSize) => {
      const { snapshots } = collectSnapshots(chunkSize)

      expect(snapshots.length).toBeGreaterThanOrEqual(4)
      snapshots.forEach((value) => expectFinishedSubsetOf(value, GUIDE))
    },
  )

  it('exposes the title and Quick Start long before the pages arrive', () => {
    const reader = createPartialJsonReader()
    const pagesAt = SOURCE.indexOf('"pages"')
    reader.push(SOURCE.slice(0, pagesAt))
    const value = reader.snapshot()?.value as Record<string, unknown>

    expect(value.title).toBe(GUIDE.title)
    expect(value.quickStart).toEqual(GUIDE.quickStart)
    expect(value.pages).toBeUndefined()
    expect(reader.snapshot()?.complete).toBe(false)
  })

  it('exposes page 1 long before the bridge arrives', () => {
    // This is the whole point of the field order: the guide is readable at
    // page 1, and the bridge is still being written well after that.
    const reader = createPartialJsonReader()
    reader.push(SOURCE.slice(0, SOURCE.indexOf('"contextPlan"')))
    const value = reader.snapshot()?.value as Record<string, unknown>

    expect((value.pages as unknown[])[0]).toEqual(GUIDE.pages[0])
    expect(value.contextPlan).toBeUndefined()
    expect(value.nextGuideIdeas).toBeUndefined()
  })

  it('grows the page array one finished page at a time', () => {
    const reader = createPartialJsonReader()
    const finishedCounts = new Set<number>()

    for (const char of SOURCE) {
      if (!reader.push(char)) {
        continue
      }

      const pages = (reader.snapshot()?.value as { pages?: unknown[] })?.pages
      if (!Array.isArray(pages)) {
        continue
      }

      expectFinishedSubsetOf(pages, GUIDE.pages)
      // Only the element still being written may be short of its final keys.
      finishedCounts.add(
        pages.filter(
          (page, index) =>
            JSON.stringify(page) === JSON.stringify(GUIDE.pages[index]),
        ).length,
      )
    }

    expect([...finishedCounts].sort()).toEqual([0, 1, 2, 3])
  })

  it('reveals a page title before the rest of that page is written', () => {
    const reader = createPartialJsonReader()
    const secondPageTitleEnd =
      SOURCE.indexOf('"Guide RNA"') + '"Guide RNA"'.length + 1
    reader.push(SOURCE.slice(0, secondPageTitleEnd))
    const pages = (reader.snapshot()?.value as { pages: Record<string, unknown>[] })
      .pages

    expect(pages).toHaveLength(2)
    expect(pages[0]).toEqual(GUIDE.pages[0])
    expect(pages[1].title).toBe('Guide RNA')
    expect(pages[1].rawNotes).toBeUndefined()
  })

  it('returns nothing before the first safe point', () => {
    const reader = createPartialJsonReader()
    reader.push('{"title": "half a str')

    expect(reader.snapshot()).toBeUndefined()
  })

  it('is unfazed by braces and quotes inside string values', () => {
    const tricky = JSON.stringify({
      a: 'a {brace} and a [bracket] and an escaped \\" quote',
      b: 'done',
    })
    const reader = createPartialJsonReader()
    reader.push(tricky)

    expect(reader.snapshot()?.value).toEqual(JSON.parse(tricky))
  })
})
