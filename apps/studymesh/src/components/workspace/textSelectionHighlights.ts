export interface StoredTextHighlight {
  id: string
  text: string
  occurrence: number
  createdAt: number
}

export interface TextSpan {
  start: number
  length: number
}

interface TextPoint {
  node: Text
  offset: number
}

export interface ContainerTextIndex {
  text: string
  points: TextPoint[]
}

const HIGHLIGHT_STORAGE_KEY = 'studymesh-text-highlights-v1'

export const TEXT_HIGHLIGHT_REGISTRY_NAME = 'studymesh-text-highlight'

export const MIN_HIGHLIGHT_TEXT_LENGTH = 2

const IGNORED_TEXT_HOSTS =
  'input, textarea, script, style, [contenteditable="true"], [data-text-selection-ignore="true"]'

const BOUNDARY_TAGS = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'BR',
  'DD',
  'DIV',
  'DL',
  'DT',
  'FIELDSET',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'FORM',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HR',
  'LI',
  'MAIN',
  'NAV',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'TD',
  'TH',
  'TR',
  'UL',
])

export const normalizeHighlightText = (value: string): string =>
  value.replace(/\s+/g, ' ').trim()

/**
 * Builds a whitespace-collapsed string for the container plus a map from every
 * character back to its DOM text node and offset. Highlights are anchored to
 * this normalized text so they survive re-renders and reloads without the app
 * ever mutating React-owned DOM. Block elements count as a space so text that
 * spans paragraphs matches what the browser reports for the selection.
 */
export const buildContainerTextIndex = (
  container: HTMLElement,
): ContainerTextIndex => {
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) {
          return NodeFilter.FILTER_ACCEPT
        }

        const element = node as Element
        if (element.matches(IGNORED_TEXT_HOSTS)) {
          return NodeFilter.FILTER_REJECT
        }

        return BOUNDARY_TAGS.has(element.tagName)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP
      },
    },
  )

  const points: TextPoint[] = []
  let text = ''
  let pendingSpace = false

  let current = walker.nextNode()
  while (current) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      pendingSpace = true
      current = walker.nextNode()
      continue
    }

    const node = current as Text
    const value = node.data
    for (let offset = 0; offset < value.length; offset += 1) {
      const char = value.charAt(offset)
      if (/\s/.test(char)) {
        pendingSpace = true
        continue
      }

      if (pendingSpace) {
        pendingSpace = false
        if (text.length > 0) {
          text += ' '
          points.push({ node, offset })
        }
      }

      text += char
      points.push({ node, offset })
    }

    current = walker.nextNode()
  }

  return { text, points }
}

const findOccurrenceStarts = (haystack: string, needle: string): number[] => {
  if (!needle) {
    return []
  }

  const starts: number[] = []
  let from = 0
  for (;;) {
    const index = haystack.indexOf(needle, from)
    if (index < 0) {
      break
    }

    starts.push(index)
    from = index + 1
  }

  return starts
}

const comparePointSafely = (range: Range, point: TextPoint): number => {
  try {
    return range.comparePoint(point.node, point.offset)
  } catch {
    return 1
  }
}

const collapsedRangeAt = (node: Node, offset: number): Range | null => {
  try {
    const range = document.createRange()
    range.setStart(node, offset)
    range.collapse(true)
    return range
  } catch {
    return null
  }
}

/**
 * First indexed character at or after a collapsed boundary. Because the points
 * are in document order, comparePoint is monotonic (-1 before, 0 at, 1 after)
 * and a binary search is enough.
 */
const findPointIndexAtBoundary = (
  index: ContainerTextIndex,
  boundary: Range,
): number => {
  let low = 0
  let high = index.points.length - 1
  let found = index.points.length

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    if (comparePointSafely(boundary, index.points[middle]) >= 0) {
      found = middle
      high = middle - 1
    } else {
      low = middle + 1
    }
  }

  return found
}

export const resolveHighlightSpan = (
  index: ContainerTextIndex,
  highlight: Pick<StoredTextHighlight, 'text' | 'occurrence'>,
): TextSpan | null => {
  const needle = normalizeHighlightText(highlight.text)
  const starts = findOccurrenceStarts(index.text, needle)
  if (!starts.length) {
    return null
  }

  const occurrence = Math.min(
    Math.max(Math.trunc(highlight.occurrence) || 0, 0),
    starts.length - 1,
  )

  return { start: starts[occurrence], length: needle.length }
}

export const buildRangeForSpan = (
  index: ContainerTextIndex,
  span: TextSpan,
): Range | null => {
  const first = index.points[span.start]
  const last = index.points[span.start + span.length - 1]
  if (!first || !last) {
    return null
  }

  const range = document.createRange()
  range.setStart(first.node, first.offset)
  range.setEnd(last.node, last.offset + 1)
  return range
}

export interface SelectionDescriptor {
  text: string
  occurrence: number
  span: TextSpan
}

/**
 * Turns a live selection range into a re-findable anchor: the selected text
 * plus which occurrence of that text inside the page it was.
 *
 * The span comes from the range boundaries rather than `range.toString()`,
 * because a selection crossing paragraphs or sections stringifies without any
 * separator ("...rates.Next.js...") while the page index keeps a boundary
 * space. Boundaries outside the container clamp to the indexed text, so a
 * selection that starts or ends beyond the page still resolves.
 */
export const describeSelection = (
  index: ContainerTextIndex,
  range: Range,
): SelectionDescriptor | null => {
  const startBoundary = collapsedRangeAt(range.startContainer, range.startOffset)
  const endBoundary = collapsedRangeAt(range.endContainer, range.endOffset)
  if (!startBoundary || !endBoundary) {
    return null
  }

  let start = findPointIndexAtBoundary(index, startBoundary)
  let end = findPointIndexAtBoundary(index, endBoundary)

  while (start < end && index.text.charAt(start) === ' ') {
    start += 1
  }

  while (end > start && index.text.charAt(end - 1) === ' ') {
    end -= 1
  }

  const text = index.text.slice(start, end)
  if (text.length < MIN_HIGHLIGHT_TEXT_LENGTH) {
    return null
  }

  const starts = findOccurrenceStarts(index.text, text)
  const occurrence = Math.max(starts.indexOf(start), 0)

  return {
    text,
    occurrence,
    span: { start, length: text.length },
  }
}

const spansOverlap = (a: TextSpan, b: TextSpan): boolean =>
  a.start < b.start + b.length && b.start < a.start + a.length

export const findHighlightsOverlappingSpan = (
  index: ContainerTextIndex,
  highlights: StoredTextHighlight[],
  span: TextSpan,
): string[] =>
  highlights
    .filter((highlight) => {
      const highlightSpan = resolveHighlightSpan(index, highlight)
      return Boolean(highlightSpan && spansOverlap(highlightSpan, span))
    })
    .map((highlight) => highlight.id)

const sanitizeStoredHighlight = (value: unknown): StoredTextHighlight | null => {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const record = value as Record<string, unknown>
  const text =
    typeof record.text === 'string' ? normalizeHighlightText(record.text) : ''
  if (text.length < MIN_HIGHLIGHT_TEXT_LENGTH) {
    return null
  }

  return {
    id: typeof record.id === 'string' && record.id ? record.id : createHighlightId(),
    text,
    occurrence:
      typeof record.occurrence === 'number' && record.occurrence > 0
        ? Math.trunc(record.occurrence)
        : 0,
    createdAt:
      typeof record.createdAt === 'number' ? record.createdAt : Date.now(),
  }
}

const readHighlightStore = (): Record<string, StoredTextHighlight[]> => {
  try {
    const raw = window.localStorage.getItem(HIGHLIGHT_STORAGE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      return {}
    }

    const store: Record<string, StoredTextHighlight[]> = {}
    Object.entries(parsed as Record<string, unknown>).forEach(
      ([scopeKey, value]) => {
        if (!Array.isArray(value)) {
          return
        }

        const highlights = value
          .map(sanitizeStoredHighlight)
          .filter((highlight): highlight is StoredTextHighlight =>
            Boolean(highlight),
          )
        if (highlights.length) {
          store[scopeKey] = highlights
        }
      },
    )

    return store
  } catch {
    return {}
  }
}

export const createHighlightId = (): string =>
  `highlight-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const readStoredHighlights = (
  scopeKey: string,
): StoredTextHighlight[] => {
  if (!scopeKey) {
    return []
  }

  return readHighlightStore()[scopeKey] || []
}

export const writeStoredHighlights = (
  scopeKey: string,
  highlights: StoredTextHighlight[],
): void => {
  if (!scopeKey) {
    return
  }

  try {
    const store = readHighlightStore()
    if (highlights.length) {
      store[scopeKey] = highlights
    } else {
      delete store[scopeKey]
    }

    window.localStorage.setItem(HIGHLIGHT_STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Highlights are a convenience layer; storage failures stay silent.
  }
}

interface HighlightPaintHost {
  highlights?: {
    set: (name: string, highlight: Highlight) => void
    delete: (name: string) => void
  }
}

const highlightRegistry = (): HighlightPaintHost['highlights'] | null => {
  if (typeof window === 'undefined' || typeof CSS === 'undefined') {
    return null
  }

  if (typeof Highlight === 'undefined') {
    return null
  }

  return (CSS as unknown as HighlightPaintHost).highlights || null
}

export const supportsTextHighlightPainting = (): boolean =>
  Boolean(highlightRegistry())

/**
 * Paints stored highlights with the CSS Custom Highlight API so nothing in the
 * React-rendered DOM has to be wrapped or replaced. Returns the ids that still
 * resolve against the current page text.
 */
export const paintStoredHighlights = (
  container: HTMLElement,
  highlights: StoredTextHighlight[],
): string[] => {
  const registry = highlightRegistry()
  if (!registry) {
    return []
  }

  const index = buildContainerTextIndex(container)
  const ranges: Range[] = []
  const paintedIds: string[] = []

  highlights.forEach((highlight) => {
    const span = resolveHighlightSpan(index, highlight)
    const range = span ? buildRangeForSpan(index, span) : null
    if (!range) {
      return
    }

    ranges.push(range)
    paintedIds.push(highlight.id)
  })

  if (!ranges.length) {
    registry.delete(TEXT_HIGHLIGHT_REGISTRY_NAME)
    return paintedIds
  }

  registry.set(TEXT_HIGHLIGHT_REGISTRY_NAME, new Highlight(...ranges))
  return paintedIds
}

export const clearPaintedHighlights = (): void => {
  highlightRegistry()?.delete(TEXT_HIGHLIGHT_REGISTRY_NAME)
}

export const CITATION_HIGHLIGHT_REGISTRY_NAME = 'studymesh-citation-highlight'

const CITATION_QUOTE_MIN_WORD_COUNT = 4

const MARKDOWN_SYNTAX_REPLACEMENTS: Array<[RegExp, string]> = [
  [/!\[([^\]]*)]\([^)]*\)/g, '$1'],
  [/\[([^\]]+)]\([^)]*\)/g, '$1'],
  [/`{1,3}([^`]+)`{1,3}/g, '$1'],
  [/\*\*\*([^*]+)\*\*\*/g, '$1'],
  [/\*\*([^*]+)\*\*/g, '$1'],
  [/\*([^*]+)\*/g, '$1'],
  [/__([^_]+)__/g, '$1'],
  [/(^|[^A-Za-z0-9])_([^_]+)_(?![A-Za-z0-9])/g, '$1$2'],
  [/~~([^~]+)~~/g, '$1'],
  [/^\s{0,3}#{1,6}\s+/gm, ''],
  [/^\s{0,3}>\s?/gm, ''],
  [/^\s{0,3}(?:[-+*]|\d{1,3}[.)])\s+/gm, ''],
  [/\\([\\`*_{}[\]()#+\-.!])/g, '$1'],
  [/\|/g, ' '],
]

/**
 * Strips markdown syntax the page never renders. Chat source chunks are built
 * from the raw `markdown` prop (see dashboardChat/contextBuilder), so a model
 * asked to quote a source character-for-character hands back `**bold**`,
 * `` `code` ``, list bullets and link syntax that appear nowhere in the
 * rendered DOM text a highlight has to match against.
 */
export const stripMarkdownSyntax = (value: string): string =>
  MARKDOWN_SYNTAX_REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value,
  )

const findWindowedRange = (
  index: ContainerTextIndex,
  normalized: string,
): Range | null => {
  if (normalized.length < MIN_HIGHLIGHT_TEXT_LENGTH) {
    return null
  }

  const words = normalized.split(' ')
  const minWindow = Math.min(CITATION_QUOTE_MIN_WORD_COUNT, words.length)

  for (let windowSize = words.length; windowSize >= minWindow; windowSize -= 1) {
    for (let start = 0; start + windowSize <= words.length; start += 1) {
      const candidate = words.slice(start, start + windowSize).join(' ')
      if (candidate.length < MIN_HIGHLIGHT_TEXT_LENGTH) {
        continue
      }

      const span = resolveHighlightSpan(index, { text: candidate, occurrence: 0 })
      const range = span ? buildRangeForSpan(index, span) : null
      if (range) {
        return range
      }
    }
  }

  return null
}

/**
 * Resolves a quote to a Range even when it isn't a perfect substring of the
 * page text. Two things break an exact match: the quote is copied from raw
 * markdown while the page shows rendered text, and an LLM asked to copy a
 * source verbatim still drifts sometimes — a paraphrased lead-in, a trimmed
 * trailing clause — anywhere in the quote, not just at the end. So the markdown
 * is stripped first, then a failed full-quote match falls back to every
 * contiguous word window, longest and earliest first, down to a minimum
 * length, so any verbatim run inside the quote still anchors the highlight.
 */
export const resolveTransientHighlightRange = (
  container: HTMLElement,
  quote: string,
): Range | null => {
  const normalized = normalizeHighlightText(quote)
  if (normalized.length < MIN_HIGHLIGHT_TEXT_LENGTH) {
    return null
  }

  const index = buildContainerTextIndex(container)
  // Strip before collapsing whitespace: heading, bullet and blockquote markers
  // are line-anchored, so they only match while the quote still has newlines.
  const withoutMarkdown = normalizeHighlightText(stripMarkdownSyntax(quote))

  const candidates =
    withoutMarkdown && withoutMarkdown !== normalized
      ? [withoutMarkdown, normalized]
      : [normalized]

  for (const candidate of candidates) {
    const range = findWindowedRange(index, candidate)
    if (range) {
      return range
    }
  }

  return null
}

/**
 * Paints a one-off highlight (e.g. a chat citation jump) under its own
 * registry name so it never interferes with the user's saved highlights.
 * Returns the resolved Range so the caller can scroll it into view, or null
 * if the quote couldn't be found on the current page.
 */
export const paintTransientHighlight = (
  container: HTMLElement,
  quote: string,
  registryName: string,
): Range | null => {
  const range = resolveTransientHighlightRange(container, quote)
  const registry = highlightRegistry()

  if (range && registry) {
    registry.set(registryName, new Highlight(range))
  }

  return range
}

export const clearRegistryHighlight = (registryName: string): void => {
  highlightRegistry()?.delete(registryName)
}

export const buildSelectionAiPrompt = (
  text: string,
  contextLabel?: string | null,
): string => {
  const trimmed = normalizeHighlightText(text)
  const source = contextLabel
    ? `I am reading the page '${contextLabel}' in this study guide.`
    : 'I am reading this study guide.'

  return `${source}\n\nThis is the part I selected:\n\n'${trimmed}'\n\nHelp me understand it.`
}
