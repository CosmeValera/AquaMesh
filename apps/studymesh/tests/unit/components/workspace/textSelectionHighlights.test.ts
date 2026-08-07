import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildContainerTextIndex,
  buildRangeForSpan,
  buildSelectionAiPrompt,
  describeSelection,
  findHighlightsOverlappingSpan,
  normalizeHighlightText,
  paintStoredHighlights,
  readStoredHighlights,
  resolveHighlightSpan,
  resolveTransientHighlightRange,
  supportsTextHighlightPainting,
  writeStoredHighlights,
  type StoredTextHighlight,
} from '../../../../src/components/workspace/textSelectionHighlights'

const renderContainer = (html: string): HTMLElement => {
  const container = document.createElement('div')
  container.innerHTML = html
  document.body.appendChild(container)
  return container
}

const selectText = (container: HTMLElement, text: string, skip = 0): Range => {
  const index = buildContainerTextIndex(container)
  let start = -1
  for (let attempt = 0; attempt <= skip; attempt += 1) {
    start = index.text.indexOf(text, start + 1)
  }

  if (start < 0) {
    throw new Error(`Text not found in container: ${text}`)
  }

  const range = buildRangeForSpan(index, { start, length: text.length })
  if (!range) {
    throw new Error(`Could not build a range for: ${text}`)
  }

  return range
}

const storedHighlight = (
  overrides: Partial<StoredTextHighlight> = {},
): StoredTextHighlight => ({
  id: 'highlight-1',
  text: 'context window',
  occurrence: 0,
  createdAt: 1,
  ...overrides,
})

describe('textSelectionHighlights anchoring', () => {
  it('collapses whitespace so anchors survive markup line breaks', () => {
    const container = renderContainer(
      '<p>Each session\n   burns   tokens</p><p><strong>in</strong> two places</p>',
    )

    expect(buildContainerTextIndex(container).text).toBe(
      'Each session burns tokens in two places',
    )
    expect(normalizeHighlightText('  burns \n tokens  ')).toBe('burns tokens')
  })

  it('records which occurrence of a repeated phrase was selected', () => {
    const container = renderContainer(
      '<p>The context window fills up. Later the context window fills up again.</p>',
    )
    const index = buildContainerTextIndex(container)

    const first = describeSelection(index, selectText(container, 'context window'))
    const second = describeSelection(
      index,
      selectText(container, 'context window', 1),
    )

    expect(first).toMatchObject({ text: 'context window', occurrence: 0 })
    expect(second).toMatchObject({ text: 'context window', occurrence: 1 })
  })

  it('re-finds a stored highlight after the page re-renders', () => {
    const container = renderContainer(
      '<p>The context window fills up. Later the context window fills up again.</p>',
    )
    const highlight = storedHighlight({ occurrence: 1 })

    // Same content, freshly rendered nodes, as React would produce.
    container.innerHTML =
      '<section><p>The <em>context window</em> fills up.</p><p>Later the context window fills up again.</p></section>'

    const index = buildContainerTextIndex(container)
    const span = resolveHighlightSpan(index, highlight)
    const range = span ? buildRangeForSpan(index, span) : null

    expect(span).toEqual({ start: index.text.lastIndexOf('context window'), length: 14 })
    expect(range?.toString()).toBe('context window')
  })

  it('anchors a selection that spans paragraphs and sections', () => {
    const container = renderContainer(
      '<section><p>It is about continuous change.</p></section><section><h2>Core idea</h2><p>Next.js may feel familiar.</p></section>',
    )
    const index = buildContainerTextIndex(container)
    const paragraphs = container.querySelectorAll('p')
    const first = paragraphs[0].firstChild as Text
    const last = paragraphs[1].firstChild as Text
    const range = document.createRange()
    range.setStart(first, first.data.indexOf('continuous'))
    range.setEnd(last, last.data.indexOf(' may'))

    // The browser stringifies across blocks with no separator, so the anchor
    // has to come from the range boundaries instead.
    expect(range.toString()).toBe('continuous change.Core ideaNext.js')

    const descriptor = describeSelection(index, range)

    expect(descriptor?.text).toBe('continuous change. Core idea Next.js')
    expect(descriptor?.occurrence).toBe(0)
    expect(
      buildRangeForSpan(index, descriptor!.span)?.toString(),
    ).toBe('continuous change.Core ideaNext.js')
  })

  it('re-finds a cross-paragraph highlight after the page re-renders', () => {
    const container = renderContainer(
      '<p>It is about continuous change.</p><p>Next.js may feel familiar.</p>',
    )
    const highlight = storedHighlight({ text: 'change. Next.js' })

    container.innerHTML =
      '<div><p>It is about <em>continuous</em> change.</p><p>Next.js may feel familiar.</p></div>'

    const index = buildContainerTextIndex(container)
    const span = resolveHighlightSpan(index, highlight)

    expect(span).toEqual({
      start: index.text.indexOf('change. Next.js'),
      length: 15,
    })
    expect(buildRangeForSpan(index, span!)?.toString()).toBe('change.Next.js')
  })

  it('trims boundary whitespace out of the stored anchor', () => {
    const container = renderContainer('<p>Each session burns tokens.</p>')
    const index = buildContainerTextIndex(container)
    const textNode = container.querySelector('p')?.firstChild as Text
    const range = document.createRange()
    range.setStart(textNode, textNode.data.indexOf(' session'))
    range.setEnd(textNode, textNode.data.indexOf(' tokens') + 1)

    expect(describeSelection(index, range)?.text).toBe('session burns')
  })

  it('ignores text inside inputs and editable regions', () => {
    const container = renderContainer(
      '<p>Visible copy</p><textarea>hidden draft</textarea><div contenteditable="true">editor text</div>',
    )

    expect(buildContainerTextIndex(container).text).toBe('Visible copy')
  })

  it('returns no anchor when the selection is shorter than a highlightable word', () => {
    const container = renderContainer('<p>a b</p>')
    const index = buildContainerTextIndex(container)

    expect(describeSelection(index, selectText(container, 'a'))).toBeNull()
  })

  it('detects highlights overlapping the current selection', () => {
    const container = renderContainer(
      '<p>Each session burns tokens in two places.</p>',
    )
    const index = buildContainerTextIndex(container)
    const highlights = [
      storedHighlight({ id: 'a', text: 'burns tokens' }),
      storedHighlight({ id: 'b', text: 'two places' }),
    ]
    const selection = describeSelection(
      index,
      selectText(container, 'session burns'),
    )

    expect(selection).not.toBeNull()
    expect(
      findHighlightsOverlappingSpan(index, highlights, selection!.span),
    ).toEqual(['a'])
  })
})

describe('textSelectionHighlights storage', () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(
      (key: string) => store.get(key) ?? null,
    )
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(
      (key: string, value: string) => {
        store.set(key, value)
      },
    )
  })

  it('round-trips highlights per page scope', () => {
    writeStoredHighlights('guide-1:page-2', [storedHighlight()])

    expect(readStoredHighlights('guide-1:page-2')).toEqual([storedHighlight()])
    expect(readStoredHighlights('guide-1:page-3')).toEqual([])
  })

  it('drops malformed stored entries instead of throwing', () => {
    store.set(
      'studymesh-text-highlights-v1',
      JSON.stringify({
        'guide-1:page-2': [
          { id: 'keep', text: 'context window', occurrence: 1, createdAt: 5 },
          { id: 'drop', text: ' ' },
          'nonsense',
        ],
      }),
    )

    expect(readStoredHighlights('guide-1:page-2')).toEqual([
      { id: 'keep', text: 'context window', occurrence: 1, createdAt: 5 },
    ])
  })

  it('clears the scope when the last highlight is removed', () => {
    writeStoredHighlights('guide-1:page-2', [storedHighlight()])
    writeStoredHighlights('guide-1:page-2', [])

    expect(readStoredHighlights('guide-1:page-2')).toEqual([])
  })
})

describe('resolveTransientHighlightRange', () => {
  it('resolves an exact verbatim quote to a Range', () => {
    const container = renderContainer(
      '<p>Kubernetes schedules containers across a cluster of worker nodes.</p>',
    )

    const range = resolveTransientHighlightRange(
      container,
      'Kubernetes schedules containers across a cluster of worker nodes.',
    )

    expect(range?.toString()).toBe(
      'Kubernetes schedules containers across a cluster of worker nodes.',
    )
  })

  it('falls back to a shorter leading phrase when the tail of the quote drifted', () => {
    const container = renderContainer(
      '<p>Kubernetes schedules containers across a cluster of worker nodes.</p>',
    )

    // The model kept the first clause verbatim but paraphrased the rest.
    const range = resolveTransientHighlightRange(
      container,
      'Kubernetes schedules containers across a cluster, replacing failed pods as needed.',
    )

    expect(range?.toString()).toBe('Kubernetes schedules containers across a')
  })

  it('falls back to an inner phrase when the start of the quote drifted', () => {
    const container = renderContainer(
      '<p>It wraps one or more containers that share networking and storage.</p>',
    )

    // The model paraphrased the subject ("A Pod" instead of "It") but kept
    // the rest of the sentence verbatim — a leading-only fallback would never
    // find this since every prefix still starts with the paraphrased words.
    const range = resolveTransientHighlightRange(
      container,
      'A Pod wraps one or more containers that share networking and storage.',
    )

    expect(range?.toString()).toBe(
      'wraps one or more containers that share networking and storage.',
    )
  })

  it('matches a quote copied out of the raw markdown of the page', () => {
    // The page renders markdown; the chat context the model quotes from is the
    // raw markdown prop, so its "verbatim" quote carries syntax the DOM has no
    // text for.
    const container = renderContainer(
      '<h2>Control plane</h2><p>The control plane schedules pods onto worker nodes and keeps the cluster at its desired state.</p>',
    )

    const range = resolveTransientHighlightRange(
      container,
      '## Control plane\n\nThe **control plane** schedules `pods` onto [worker nodes](/nodes) and keeps the cluster at its *desired state*.',
    )

    expect(range?.toString()).toContain('schedules pods onto worker nodes')
  })

  it('matches a quote copied out of a markdown bullet list', () => {
    const container = renderContainer(
      '<ul><li>A Pod wraps one or more containers that share networking and storage.</li></ul>',
    )

    const range = resolveTransientHighlightRange(
      container,
      '- A **Pod** wraps one or more containers that share networking and storage.',
    )

    expect(range?.toString()).toBe(
      'A Pod wraps one or more containers that share networking and storage.',
    )
  })

  it('keeps underscores that belong to the text instead of stripping them', () => {
    const container = renderContainer(
      '<p>Set the node_selector field before scheduling the workload.</p>',
    )

    const range = resolveTransientHighlightRange(
      container,
      'Set the `node_selector` field before scheduling the workload.',
    )

    expect(range?.toString()).toBe(
      'Set the node_selector field before scheduling the workload.',
    )
  })

  it('returns null when nothing in the container resembles the quote', () => {
    const container = renderContainer('<p>Docker builds container images.</p>')

    expect(
      resolveTransientHighlightRange(container, 'Kubernetes schedules containers.'),
    ).toBeNull()
  })
})

describe('textSelectionHighlights painting and prompts', () => {
  it('degrades quietly when the CSS Custom Highlight API is missing', () => {
    const container = renderContainer('<p>Each session burns tokens.</p>')

    expect(supportsTextHighlightPainting()).toBe(false)
    expect(paintStoredHighlights(container, [storedHighlight()])).toEqual([])
  })

  it('builds an AI Chat prompt that quotes the selection and page', () => {
    expect(buildSelectionAiPrompt('  burns   tokens ', 'Token budgets')).toBe(
      "I am reading the page 'Token budgets' in this study guide.\n\nThis is the part I selected:\n\n'burns tokens'\n\nHelp me understand it.",
    )
  })
})
