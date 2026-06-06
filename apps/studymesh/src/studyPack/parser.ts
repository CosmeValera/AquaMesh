import {
  StudyComparisonObject,
  StudyListObject,
  StudyObject,
  StudyPack,
  StudyPackParseOptions,
  StudyPackSourceFormat,
  StudyResourceObject,
  StudyTableObject,
} from './types'

interface LineRecord {
  text: string
  lineNumber: number
}

const DEFAULT_TITLE = 'Study Pack'

const slugify = (value: string): string => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'study-pack'
}

const cleanCell = (value: string): string => value.trim().replace(/^"|"$/g, '')

const buildId = (packId: string, kind: string, index: number): string =>
  `${packId}-${kind}-${index + 1}`

const normalizeNewlines = (source: string): string =>
  source.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

const getLines = (source: string): LineRecord[] =>
  normalizeNewlines(source)
    .split('\n')
    .map((text, index) => ({ text: text.trimEnd(), lineNumber: index + 1 }))

const isMarkdownTableDivider = (line: string): boolean =>
  /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)

const isComparisonTitle = (title?: string): boolean =>
  Boolean(title && /\b(vs\.?|versus|compare|comparison)\b/i.test(title))

const isSequenceTitle = (title?: string): boolean =>
  Boolean(title && /\b(steps?|order|sequence|timeline|process)\b/i.test(title))

const isReviewPrompt = (text: string): boolean =>
  /\b(review this|review later|ask teacher|ask about|need(?:s)? memorize|need review|probably important|remember this|important:|always confuse|i always confuse|i always flip|keep spelling)\b/i.test(
    text,
  )

const isConciseTerm = (value: string): boolean =>
  value.length > 0 &&
  value.length <= 60 &&
  !/[.!?]$/.test(value) &&
  value.split(/\s+/).length <= 8

const isSectionLabel = (value: string): boolean =>
  isConciseTerm(value) &&
  !/^(https?|docker|kubectl|npm|yarn|pnpm)\b/i.test(value)

const isDecorativeSeparator = (value: string): boolean =>
  value.length >= 8 && /^[#.\-@$*_=\s]+$/.test(value)

const looksLikeCodeBlock = (value: string): boolean => {
  const lines = value.split('\n').filter((line) => line.trim())
  if (lines.length < 2) {
    return false
  }

  const codeSignals = lines.filter((line) =>
    /[{};]|^\s*(location|server|http|events|upstream)\b|^\s*[A-Za-z_-]+\s+[^:]+;$/.test(
      line,
    ),
  )

  return codeSignals.length >= Math.max(2, Math.ceil(lines.length / 2))
}

const looksLikeCommand = (value: string): boolean =>
  /^(docker|kubectl|npm|yarn|pnpm|npx|git|curl|ssh|ansible|rundeck)\s+\S+/i.test(
    value,
  )

const inferCodeLanguage = (value: string): string => {
  if (/\b(location|server|upstream|proxy_pass|root|index)\b/.test(value)) {
    return 'nginx'
  }

  return 'text'
}

const trimBlankEdgeLines = (value: string): string => {
  const lines = value.split('\n')
  while (lines.length > 0 && !lines[0].trim()) {
    lines.shift()
  }
  while (lines.length > 0 && !lines[lines.length - 1].trim()) {
    lines.pop()
  }
  return lines.join('\n')
}

const splitPipeRow = (line: string): string[] =>
  line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cleanCell)

const parseCsvRow = (line: string): string[] => {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    const nextCharacter = line[index + 1]

    if (character === '"' && nextCharacter === '"') {
      current += '"'
      index += 1
    } else if (character === '"') {
      inQuotes = !inQuotes
    } else if (character === ',' && !inQuotes) {
      cells.push(cleanCell(current))
      current = ''
    } else {
      current += character
    }
  }

  cells.push(cleanCell(current))
  return cells
}

const looksLikeCsv = (lines: LineRecord[]): boolean => {
  const rows = lines.filter((line) => line.text.trim())
  if (rows.length < 2) {
    return false
  }

  const columnCounts = rows.map((line) => parseCsvRow(line.text).length)
  return (
    columnCounts[0] > 1 &&
    columnCounts.every((count) => count === columnCounts[0])
  )
}

const detectFormat = (
  source: string,
  requestedFormat?: StudyPackSourceFormat,
): StudyPackSourceFormat => {
  if (requestedFormat && requestedFormat !== 'paste') {
    return requestedFormat
  }

  const lines = getLines(source)
  if (
    lines.some((line, index) => {
      const nextLine = lines[index + 1]
      return (
        line.text.includes('|') &&
        Boolean(nextLine) &&
        isMarkdownTableDivider(nextLine.text)
      )
    })
  ) {
    return 'markdown-table'
  }

  if (looksLikeCsv(lines)) {
    return 'csv'
  }

  if (
    lines.some((line) =>
      /^(#{1,6}\s+|q:\s+|a:\s+|[-*]\s+\[[ xX]\]\s+|.+\s+::\s+.+)/.test(
        line.text.trim(),
      ),
    )
  ) {
    return 'quick-syntax'
  }

  if (lines.some((line) => /^#{1,6}\s+/.test(line.text.trim()))) {
    return 'markdown'
  }

  return requestedFormat || 'text'
}

export const detectMarkdownSource = (source: string): boolean => {
  const lines = getLines(source)
  const nonEmptyLines = lines.map((line) => line.text.trim()).filter(Boolean)

  if (nonEmptyLines.length < 2) {
    return false
  }

  let score = 0

  if (nonEmptyLines.some((line) => /^#{1,6}\s+\S+/.test(line))) {
    score += 2
  }

  if (nonEmptyLines.some((line) => /^```[\w-]*\s*$/.test(line))) {
    score += 2
  }

  if (
    lines.some((line, index) => {
      const nextLine = lines[index + 1]
      return (
        line.text.includes('|') &&
        Boolean(nextLine) &&
        isMarkdownTableDivider(nextLine.text)
      )
    })
  ) {
    score += 2
  }

  if (
    nonEmptyLines.some((line) => /\[[^\]]+\]\(https?:\/\/[^)]+\)/.test(line))
  ) {
    score += 1
  }

  if (
    nonEmptyLines.filter((line) => /^[-*]\s+\[[ xX]\]\s+\S+/.test(line))
      .length >= 1
  ) {
    score += 2
  }

  if (nonEmptyLines.filter((line) => /^[-*]\s+\S+/.test(line)).length >= 2) {
    score += 1
  }

  if (nonEmptyLines.filter((line) => /^\d+[.)]\s+\S+/.test(line)).length >= 2) {
    score += 1
  }

  if (nonEmptyLines.some((line) => /^>\s+\S+/.test(line))) {
    score += 1
  }

  return score >= 2
}

const inferTitle = (source: string, options: StudyPackParseOptions): string => {
  if (options.title?.trim()) {
    return options.title.trim()
  }

  const heading = getLines(source).find((line) =>
    /^#{1,2}\s+/.test(line.text.trim()),
  )
  if (heading) {
    return heading.text.replace(/^#{1,6}\s+/, '').trim()
  }

  const firstReadableLine = getLines(source)
    .map((line) => line.text.trim())
    .find((line) => line && !isDecorativeSeparator(line))
  if (firstReadableLine && isConciseTerm(firstReadableLine.replace(/:$/, ''))) {
    return firstReadableLine.replace(/:$/, '').trim()
  }

  return DEFAULT_TITLE
}

const splitSentences = (value: string): string[] =>
  value
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)

const stripCitations = (value: string): string =>
  value.replace(/\s*\[\d+(?:[-,\s]\d+)*\]/g, '').replace(/\s{2,}/g, ' ').trim()

const cleanDefinitionTerm = (value: string): string =>
  stripCitations(value)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^[\s"'“”‘’]+|[\s"'“”‘’.,:;]+$/g, '')
    .replace(/^(?:la|el|las|los|un|una|unos|unas|the|a|an)\s+/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

const normalizeFactKey = (value: string): string =>
  stripCitations(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()

const isInformativeFactSentence = (value: string): boolean => {
  const sentence = stripCitations(value)
  if (!sentence || /^\[\d+\]$/.test(sentence)) {
    return false
  }

  return sentence.split(/\s+/).length >= 5
}

const looksLikeInformativeProse = (sentences: string[]): boolean => {
  const wordCount = sentences.join(' ').split(/\s+/).filter(Boolean).length

  return sentences.length >= 2 || wordCount >= 18
}

const extractDefinitionOpening = (
  sentence: string,
): { term: string; definition: string } | undefined => {
  const cleanedSentence = stripCitations(sentence)
  const match = cleanedSentence.match(
    /^(.+?)\s+(se define como|is defined as|consiste en|refers to|es|son|is|are)\s+(.+)$/iu,
  )
  if (!match) {
    return undefined
  }

  const term = cleanDefinitionTerm(match[1])
  const definition = stripCitations(match[3]).replace(/\s+$/g, '').trim()
  if (
    !isConciseTerm(term) ||
    definition.split(/\s+/).length < 4 ||
    /^(?:this|that|it|esto|eso)$/i.test(term)
  ) {
    return undefined
  }

  return { term, definition }
}

const extractProseKnowledge = (
  value: string,
): { definition?: { term: string; definition: string }; facts: string[] } => {
  const sentences = splitSentences(stripCitations(value))
  const firstSentence = sentences[0] || ''
  const hasDefinitionCue =
    /\b(se define como|is defined as|consiste en|refers to|es|son|is|are)\b/iu.test(
      firstSentence,
    )
  const looksEncyclopedic =
    looksLikeInformativeProse(sentences) &&
    (hasDefinitionCue || sentences.some(isInformativeFactSentence))

  if (!looksEncyclopedic) {
    return { facts: [] }
  }

  const definition = hasDefinitionCue
    ? extractDefinitionOpening(firstSentence)
    : undefined
  const seenFacts = new Set<string>()
  const facts = sentences
    .slice(definition ? 1 : 0)
    .map(stripCitations)
    .filter(isInformativeFactSentence)
    .filter((sentence) => {
      const key = normalizeFactKey(sentence)
      if (!key || seenFacts.has(key)) {
        return false
      }

      seenFacts.add(key)
      return true
    })
    .slice(0, 6)

  return { definition, facts }
}

const extractInlineDefinitions = (
  value: string,
): Array<{ term: string; definition: string }> => {
  const definitions: Array<{ term: string; definition: string }> = []
  const segments = value
    .split(/(?<=[.!?])\s+|;\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean)

  for (const segment of segments) {
    const parts = segment.split(/\s+=\s+/)

    for (let index = 1; index < parts.length; index += 1) {
      const rawTerm = parts[index - 1]
        .split(/[.,;!?]/)
        .pop()
        ?.replace(
          /^(and|but|so|while|remember|need memorize|important)\s+/i,
          '',
        )
        .trim()
      const definition = parts[index]
        .split(/[.;!?]/)[0]
        .replace(/\s+\b(and|but|so|while|then)\s*$/i, '')
        .trim()

      if (
        rawTerm &&
        isConciseTerm(rawTerm) &&
        definition.split(/\s+/).length >= 2
      ) {
        definitions.push({ term: rawTerm, definition })
      }
    }
  }

  return definitions
}

const extractInlineSequence = (
  value: string,
): { title: string; steps: string[] } | undefined => {
  const match = value.match(
    /\b([\w\s/-]{2,50}?\b(?:order|sequence|steps?|process|timeline))\s*:\s*([^.!?\n]+)/i,
  )
  if (!match) {
    return undefined
  }

  const steps = match[2]
    .split(/,|->|→|;|\s+then\s+/i)
    .map((step) => step.trim())
    .filter((step) => step.length > 0 && step.length <= 80)

  if (steps.length < 2) {
    return undefined
  }

  return {
    title: match[1].trim(),
    steps,
  }
}

const createReviewPromptFromText = (
  packId: string,
  index: number,
  lineNumber: number,
  text: string,
  tags: string[],
): StudyObject => ({
  id: buildId(packId, 'reviewPrompt', index),
  kind: 'reviewPrompt',
  title: 'Review later',
  sourceLine: lineNumber,
  tags,
  prompt: text,
  reason: '',
  status: 'needsReview',
})

const createResource = (
  packId: string,
  index: number,
  line: LineRecord,
  label: string,
  url: string,
  tags: string[],
): StudyResourceObject => {
  const lowerUrl = url.toLowerCase()
  const resourceType = lowerUrl.endsWith('.pdf')
    ? 'pdf'
    : /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/.test(lowerUrl)
    ? 'image'
    : 'link'

  return {
    id: buildId(packId, 'resource', index),
    kind: 'resource',
    sourceLine: line.lineNumber,
    tags,
    url,
    label: label || url,
    resourceType,
  }
}

const parseMarkdownTables = (
  lines: LineRecord[],
  packId: string,
  defaultTags: string[],
): StudyObject[] => {
  const tables: StudyObject[] = []
  let currentHeading: string | undefined

  for (let index = 0; index < lines.length - 1; index += 1) {
    const line = lines[index]
    const divider = lines[index + 1]
    const headingMatch = line.text.trim().match(/^#{1,6}\s+(.+)$/)

    if (headingMatch) {
      currentHeading = headingMatch[1].trim()
    }

    if (!line.text.includes('|') || !isMarkdownTableDivider(divider.text)) {
      continue
    }

    const headers = splitPipeRow(line.text)
    const rows: string[][] = []
    let cursor = index + 2

    while (cursor < lines.length && lines[cursor].text.includes('|')) {
      rows.push(splitPipeRow(lines[cursor].text))
      cursor += 1
    }

    if (isComparisonTitle(currentHeading)) {
      tables.push({
        id: buildId(packId, 'comparison', tables.length),
        kind: 'comparison',
        title: currentHeading || `Comparison ${tables.length + 1}`,
        sourceLine: line.lineNumber,
        tags: defaultTags,
        columns: headers,
        rows,
      } satisfies StudyComparisonObject)
    } else {
      tables.push({
        id: buildId(packId, 'table', tables.length),
        kind: 'table',
        title: `Table ${tables.length + 1}`,
        sourceLine: line.lineNumber,
        tags: defaultTags,
        headers,
        rows,
      } satisfies StudyTableObject)
    }

    index = cursor - 1
  }

  return tables
}

const getMarkdownTableLineNumbers = (lines: LineRecord[]): Set<number> => {
  const lineNumbers = new Set<number>()

  for (let index = 0; index < lines.length - 1; index += 1) {
    const line = lines[index]
    const divider = lines[index + 1]

    if (!line.text.includes('|') || !isMarkdownTableDivider(divider.text)) {
      continue
    }

    lineNumbers.add(line.lineNumber)
    lineNumbers.add(divider.lineNumber)

    let cursor = index + 2
    while (cursor < lines.length && lines[cursor].text.includes('|')) {
      lineNumbers.add(lines[cursor].lineNumber)
      cursor += 1
    }

    index = cursor - 1
  }

  return lineNumbers
}

const parseCsv = (
  lines: LineRecord[],
  packId: string,
  defaultTags: string[],
): StudyObject[] => {
  const rows = lines.filter((line) => line.text.trim())
  const parsedRows = rows.map((line) => parseCsvRow(line.text))
  const headers = parsedRows[0] || []
  const dataRows = parsedRows.slice(1)
  const normalizedHeaders = headers.map((header) => header.toLowerCase())
  const termIndex = normalizedHeaders.findIndex((header) =>
    ['term', 'word', 'concept'].includes(header),
  )
  const definitionIndex = normalizedHeaders.findIndex((header) =>
    ['definition', 'answer', 'meaning'].includes(header),
  )
  const questionIndex = normalizedHeaders.findIndex(
    (header) => header === 'question',
  )
  const answerIndex = normalizedHeaders.findIndex(
    (header) => header === 'answer',
  )

  if (termIndex >= 0 && definitionIndex >= 0) {
    return dataRows.map((row, index) => ({
      id: buildId(packId, 'term', index),
      kind: 'term',
      sourceLine: rows[index + 1]?.lineNumber || index + 2,
      tags: defaultTags,
      term: row[termIndex] || '',
      definition: row[definitionIndex] || '',
    }))
  }

  if (questionIndex >= 0 && answerIndex >= 0) {
    return dataRows.map((row, index) => ({
      id: buildId(packId, 'qa', index),
      kind: 'qa',
      sourceLine: rows[index + 1]?.lineNumber || index + 2,
      tags: defaultTags,
      question: row[questionIndex] || '',
      answer: row[answerIndex] || '',
    }))
  }

  return [
    {
      id: buildId(packId, 'table', 0),
      kind: 'table',
      title: 'CSV Table',
      sourceLine: rows[0]?.lineNumber || 1,
      tags: defaultTags,
      headers,
      rows: dataRows,
    },
  ]
}

const flushParagraph = (
  objects: StudyObject[],
  packId: string,
  paragraphLines: LineRecord[],
  title: string | undefined,
  defaultTags: string[],
): void => {
  const body = paragraphLines
    .map((line) => line.text.trim())
    .join('\n')
    .trim()
  const rawBody = trimBlankEdgeLines(
    paragraphLines.map((line) => line.text).join('\n'),
  )
  if (!body) {
    return
  }

  const paragraphItems = paragraphLines
    .map((line) => line.text.trim())
    .filter(Boolean)

  if (looksLikeCodeBlock(rawBody)) {
    objects.push({
      id: buildId(packId, 'code', objects.length),
      kind: 'code',
      title: title || 'Code note',
      sourceLine: paragraphLines[0]?.lineNumber || 1,
      tags: defaultTags,
      code: rawBody,
      language: inferCodeLanguage(rawBody),
      caption: title || '',
    })
    return
  }

  const pipeRows = paragraphItems
    .filter((item) => item.includes('|'))
    .map((item) => item.split('|').map(cleanCell))
  if (pipeRows.length >= 2 && isComparisonTitle(title)) {
    const titleColumns = (title || '')
      .replace(/:$/, '')
      .split(/\s+(?:vs\.?|versus|and)\s+/i)
      .map((item) => item.trim())
      .filter(Boolean)
    objects.push({
      id: buildId(packId, 'comparison', objects.length),
      kind: 'comparison',
      title: title || 'Comparison',
      sourceLine: paragraphLines[0]?.lineNumber || 1,
      tags: defaultTags,
      columns: titleColumns.length >= 2 ? titleColumns : ['Item A', 'Item B'],
      rows: pipeRows,
    } satisfies StudyComparisonObject)
    return
  }

  if (
    paragraphItems.length >= 2 &&
    /\b(symbols?|review|memorize|remember|terms?|ideas?|topics?)\b/i.test(
      title || '',
    ) &&
    paragraphItems.every((item) => item.length <= 100)
  ) {
    objects.push({
      id: buildId(packId, 'list', objects.length),
      kind: 'list',
      title,
      sourceLine: paragraphLines[0]?.lineNumber || 1,
      tags: defaultTags,
      items: paragraphItems,
      ordered: false,
      checklist: false,
    })
    return
  }

  const sequence = extractInlineSequence(body)
  if (sequence) {
    objects.push({
      id: buildId(packId, 'sequence', objects.length),
      kind: 'sequence',
      title: title || sequence.title,
      sourceLine: paragraphLines[0]?.lineNumber || 1,
      tags: defaultTags,
      steps: sequence.steps,
      ordered: true,
      interactiveChecklist: false,
    })
  }

  for (const definition of extractInlineDefinitions(body)) {
    objects.push({
      id: buildId(packId, 'term', objects.length),
      kind: 'term',
      title,
      sourceLine: paragraphLines[0]?.lineNumber || 1,
      tags: defaultTags,
      term: definition.term,
      definition: definition.definition,
    })
  }

  for (const sentence of splitSentences(body).filter(isReviewPrompt)) {
    objects.push(
      createReviewPromptFromText(
        packId,
        objects.length,
        paragraphLines[0]?.lineNumber || 1,
        sentence,
        defaultTags,
      ),
    )
  }

  const proseKnowledge = extractProseKnowledge(body)
  if (proseKnowledge.definition) {
    objects.push({
      id: buildId(packId, 'term', objects.length),
      kind: 'term',
      title,
      sourceLine: paragraphLines[0]?.lineNumber || 1,
      tags: defaultTags,
      term: proseKnowledge.definition.term,
      definition: proseKnowledge.definition.definition,
    })
  }

  if (proseKnowledge.facts.length >= 1) {
    objects.push({
      id: buildId(packId, 'list', objects.length),
      kind: 'list',
      title: proseKnowledge.definition
        ? `${proseKnowledge.definition.term} Key facts`
        : 'Key facts',
      sourceLine: paragraphLines[0]?.lineNumber || 1,
      tags: defaultTags,
      items: proseKnowledge.facts,
      ordered: false,
      checklist: false,
    })
  }

  objects.push({
    id: buildId(packId, 'note', objects.length),
    kind: 'note',
    title,
    sourceLine: paragraphLines[0]?.lineNumber || 1,
    tags: defaultTags,
    body,
  })
}

const parseTextLike = (
  lines: LineRecord[],
  packId: string,
  defaultTags: string[],
): StudyObject[] => {
  const objects: StudyObject[] = []
  const paragraphLines: LineRecord[] = []
  const tableLineNumbers = getMarkdownTableLineNumbers(lines)
  let currentHeading: string | undefined
  let pendingQuestion: { question: string; line: LineRecord } | undefined
  let listBuffer: StudyListObject | undefined
  let codeFence:
    | {
        language: string
        line: LineRecord
        lines: string[]
      }
    | undefined

  const flushList = () => {
    if (listBuffer && listBuffer.items.length > 0) {
      if (isSequenceTitle(listBuffer.title)) {
        objects.push({
          id: buildId(packId, 'sequence', objects.length),
          kind: 'sequence',
          title: listBuffer.title || 'Sequence',
          sourceLine: listBuffer.sourceLine,
          tags: listBuffer.tags,
          steps: listBuffer.items,
          ordered: true,
          interactiveChecklist: listBuffer.checklist,
        })
      } else {
        objects.push(listBuffer)
      }
    }
    listBuffer = undefined
  }

  const flushText = () => {
    flushParagraph(
      objects,
      packId,
      paragraphLines.splice(0),
      currentHeading,
      defaultTags,
    )
  }

  for (const line of lines) {
    const trimmed = line.text.trim()
    const codeFenceMatch = trimmed.match(/^```([\w-]*)\s*$/)
    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/)
    const hashCommentMatch = trimmed.match(/^#\s*(.+)$/)
    const sectionLabelMatch = trimmed.match(/^(.+):$/)
    const quickSyntaxMatch = trimmed.match(
      /^(Flashcard|Quiz|Reveal|Sequence|Comparison|Checklist|Definition|Formula|Example)::\s*(.*)$/i,
    )
    const qaQuestionMatch = trimmed.match(/^(?:q|question):\s*(.+)$/i)
    const qaAnswerMatch = trimmed.match(/^(?:a|answer):\s*(.+)$/i)
    const termMatch = trimmed.match(/^(.+?)\s*(?:->|::|=|:)\s*(.+)$/)
    const unorderedMatch = trimmed.match(/^[-*]\s+(\[[ xX]\]\s+)?(.+)$/)
    const orderedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/)
    const markdownLinkMatch = trimmed.match(
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/,
    )
    const bareUrlMatch = trimmed.match(/(https?:\/\/\S+)/)

    if (codeFence) {
      if (codeFenceMatch) {
        objects.push({
          id: buildId(packId, 'code', objects.length),
          kind: 'code',
          title: currentHeading || 'Code note',
          sourceLine: codeFence.line.lineNumber,
          tags: defaultTags,
          code: codeFence.lines.join('\n').trimEnd(),
          language:
            codeFence.language || inferCodeLanguage(codeFence.lines.join('\n')),
          caption: currentHeading || '',
        })
        codeFence = undefined
      } else {
        codeFence.lines.push(line.text)
      }
      continue
    }

    if (codeFenceMatch) {
      flushText()
      flushList()
      codeFence = {
        language: codeFenceMatch[1] || '',
        line,
        lines: [],
      }
      continue
    }

    if (!trimmed) {
      flushText()
      flushList()
      continue
    }

    if (isDecorativeSeparator(trimmed)) {
      flushText()
      flushList()
      continue
    }

    if (tableLineNumbers.has(line.lineNumber)) {
      flushText()
      flushList()
      continue
    }

    if (headingMatch) {
      flushText()
      flushList()
      currentHeading = headingMatch[1].trim()
      continue
    }

    if (hashCommentMatch && !headingMatch) {
      flushText()
      flushList()
      const label = hashCommentMatch[1].trim().replace(/#+$/, '').trim()
      if (label && !isDecorativeSeparator(label)) {
        currentHeading = label
      }
      continue
    }

    if (sectionLabelMatch && isSectionLabel(sectionLabelMatch[1].trim())) {
      flushText()
      flushList()
      currentHeading = sectionLabelMatch[1].trim()
      continue
    }

    if (quickSyntaxMatch) {
      flushText()
      flushList()
      const label = quickSyntaxMatch[1].toLowerCase()
      const body = quickSyntaxMatch[2].trim()

      if (!body) {
        currentHeading = quickSyntaxMatch[1]
        continue
      }

      if (label === 'flashcard') {
        const [question, answer] = body
          .split(/\s+(?:\||->)\s+/)
          .map((value) => value.trim())

        if (question && answer) {
          objects.push({
            id: buildId(packId, 'qa', objects.length),
            kind: 'qa',
            title: 'Flashcard',
            sourceLine: line.lineNumber,
            tags: defaultTags,
            question,
            answer,
          })
        } else {
          pendingQuestion = { question: body, line }
        }
        continue
      }

      if (label === 'quiz') {
        const parts = body
          .split(/\s+(?:\||->)\s+|\s*;\s*/)
          .map((value) => value.trim())
          .filter(Boolean)
        const [question, answer, ...wrongOptions] = parts

        if (question && answer && wrongOptions.length > 0) {
          objects.push({
            id: buildId(packId, 'quiz', objects.length),
            kind: 'quiz',
            title: 'Quiz',
            sourceLine: line.lineNumber,
            tags: defaultTags,
            quizMode: 'multipleChoice',
            question,
            options: [answer, ...wrongOptions],
            correctIndex: 0,
            answer,
            explanation: '',
          })
        } else if (question && answer) {
          const options = [
            answer,
            'Not supported by these notes',
            'The opposite of the note explanation',
          ]
          objects.push({
            id: buildId(packId, 'quiz', objects.length),
            kind: 'quiz',
            title: 'Quiz',
            sourceLine: line.lineNumber,
            tags: defaultTags,
            quizMode: 'multipleChoice',
            question,
            options,
            correctIndex: 0,
            answer,
            explanation: '',
          })
        } else {
          pendingQuestion = { question: body, line }
        }
        continue
      }

      if (label === 'reveal') {
        const [prompt, hiddenText] = body
          .split(/\s+(?:\||->)\s+/)
          .map((value) => value.trim())

        objects.push({
          id: buildId(packId, 'reveal', objects.length),
          kind: 'reveal',
          title: currentHeading || 'Reveal answer',
          sourceLine: line.lineNumber,
          tags: defaultTags,
          prompt: prompt || currentHeading || 'Prompt',
          hiddenText: hiddenText || body,
        })
        continue
      }

      if (label === 'sequence') {
        const [title, rawSteps] = body.includes('|')
          ? body.split(/\s+\|\s+/, 2).map((value) => value.trim())
          : [currentHeading || 'Sequence', body]
        objects.push({
          id: buildId(packId, 'sequence', objects.length),
          kind: 'sequence',
          title: title || 'Sequence',
          sourceLine: line.lineNumber,
          tags: defaultTags,
          steps: rawSteps
            .split(/;|,|\n/)
            .map((item) => item.trim())
            .filter(Boolean),
          ordered: true,
          interactiveChecklist: false,
        })
        continue
      }

      if (label === 'checklist') {
        objects.push({
          id: buildId(packId, 'list', objects.length),
          kind: 'list',
          title: 'Checklist',
          sourceLine: line.lineNumber,
          tags: defaultTags,
          items: body
            .split(/;|\n/)
            .map((item) => item.trim())
            .filter(Boolean),
          ordered: false,
          checklist: true,
        })
        continue
      }

      if (label === 'definition') {
        const definitionParts = body.split(/\s+-\s+|:\s+|=\s+/)
        const term =
          definitionParts.length > 1 ? definitionParts[0] : currentHeading
        const definition =
          definitionParts.length > 1
            ? definitionParts.slice(1).join(': ')
            : body

        objects.push({
          id: buildId(packId, 'term', objects.length),
          kind: 'term',
          title: currentHeading,
          sourceLine: line.lineNumber,
          tags: defaultTags,
          term: term || 'Definition',
          definition,
        })
        continue
      }

      objects.push({
        id: buildId(packId, 'note', objects.length),
        kind: 'note',
        title: quickSyntaxMatch[1],
        sourceLine: line.lineNumber,
        tags: defaultTags,
        body,
      })
      continue
    }

    if (qaQuestionMatch) {
      flushText()
      flushList()
      pendingQuestion = { question: qaQuestionMatch[1].trim(), line }
      continue
    }

    if (qaAnswerMatch && pendingQuestion) {
      objects.push({
        id: buildId(packId, 'qa', objects.length),
        kind: 'qa',
        title: currentHeading,
        sourceLine: pendingQuestion.line.lineNumber,
        tags: defaultTags,
        question: pendingQuestion.question,
        answer: qaAnswerMatch[1].trim(),
      })
      pendingQuestion = undefined
      continue
    }

    const reviewSentences = splitSentences(trimmed).filter(isReviewPrompt)
    if (
      (reviewSentences.length === 1 && reviewSentences[0] === trimmed) ||
      /^(need memorize|review this|review later|important:)/i.test(trimmed)
    ) {
      flushText()
      flushList()
      objects.push(
        createReviewPromptFromText(
          packId,
          objects.length,
          line.lineNumber,
          trimmed,
          defaultTags,
        ),
      )
      continue
    }

    if (markdownLinkMatch || bareUrlMatch) {
      flushText()
      flushList()
      const label = markdownLinkMatch?.[1] || currentHeading || 'Reference'
      const url = markdownLinkMatch?.[2] || bareUrlMatch?.[1] || ''
      objects.push(
        createResource(packId, objects.length, line, label, url, defaultTags),
      )
      continue
    }

    if (looksLikeCommand(trimmed)) {
      flushText()
      flushList()
      objects.push({
        id: buildId(packId, 'code', objects.length),
        kind: 'code',
        title: currentHeading || 'Command',
        sourceLine: line.lineNumber,
        tags: defaultTags,
        code: trimmed,
        language: 'shell',
        caption: currentHeading || '',
      })
      continue
    }

    const inlineSequence = extractInlineSequence(trimmed)
    if (inlineSequence) {
      flushText()
      flushList()
      objects.push({
        id: buildId(packId, 'sequence', objects.length),
        kind: 'sequence',
        title: currentHeading || inlineSequence.title,
        sourceLine: line.lineNumber,
        tags: defaultTags,
        steps: inlineSequence.steps,
        ordered: true,
        interactiveChecklist: false,
      })
      continue
    }

    if (
      termMatch &&
      isConciseTerm(termMatch[1].trim()) &&
      !/[.!?]/.test(termMatch[1].trim())
    ) {
      flushText()
      flushList()
      objects.push({
        id: buildId(packId, 'term', objects.length),
        kind: 'term',
        title: currentHeading,
        sourceLine: line.lineNumber,
        tags: defaultTags,
        term: termMatch[1].trim(),
        definition: termMatch[2].trim(),
      })
      continue
    }

    if (unorderedMatch || orderedMatch) {
      flushText()
      const checklist = Boolean(unorderedMatch?.[1])
      const ordered = Boolean(orderedMatch)
      const item = (unorderedMatch?.[2] || orderedMatch?.[1] || '').trim()

      if (
        !listBuffer ||
        listBuffer.ordered !== ordered ||
        listBuffer.checklist !== checklist
      ) {
        flushList()
        listBuffer = {
          id: buildId(packId, 'list', objects.length),
          kind: 'list',
          title: currentHeading,
          sourceLine: line.lineNumber,
          tags: defaultTags,
          items: [],
          ordered,
          checklist,
        }
      }

      listBuffer.items.push(item)
      continue
    }

    paragraphLines.push(line)
  }

  if (pendingQuestion) {
    paragraphLines.push({
      text: `Q: ${pendingQuestion.question}`,
      lineNumber: pendingQuestion.line.lineNumber,
    })
  }

  if (codeFence) {
    objects.push({
      id: buildId(packId, 'code', objects.length),
      kind: 'code',
      title: currentHeading || 'Code note',
      sourceLine: codeFence.line.lineNumber,
      tags: defaultTags,
      code: codeFence.lines.join('\n').trimEnd(),
      language:
        codeFence.language || inferCodeLanguage(codeFence.lines.join('\n')),
      caption: currentHeading || '',
    })
  }

  flushText()
  flushList()

  return objects
}

const pushMarkdownNote = (
  objects: StudyObject[],
  packId: string,
  lines: LineRecord[],
  title: string | undefined,
  defaultTags: string[],
): void => {
  const body = trimBlankEdgeLines(
    lines
      .map((line) => line.text)
      .join('\n')
      .replace(/^\s*>\s?/gm, ''),
  )

  if (!body.trim()) {
    return
  }

  objects.push({
    id: buildId(packId, 'note', objects.length),
    kind: 'note',
    title,
    sourceLine: lines[0]?.lineNumber || 1,
    tags: defaultTags,
    body,
  })
}

export const parseMarkdownSections = (
  lines: LineRecord[],
  packId: string,
  defaultTags: string[],
): StudyObject[] => {
  const objects: StudyObject[] = []
  const sectionLines: LineRecord[] = []
  let currentHeading: string | undefined
  let pendingQuestion: { question: string; line: LineRecord } | undefined
  let listBuffer: StudyListObject | undefined
  let codeFence:
    | {
        language: string
        line: LineRecord
        lines: string[]
      }
    | undefined

  const flushSection = () => {
    pushMarkdownNote(
      objects,
      packId,
      sectionLines.splice(0),
      currentHeading,
      defaultTags,
    )
  }

  const flushList = () => {
    if (listBuffer && listBuffer.items.length > 0) {
      if (isSequenceTitle(listBuffer.title)) {
        objects.push({
          id: buildId(packId, 'sequence', objects.length),
          kind: 'sequence',
          title: listBuffer.title || 'Sequence',
          sourceLine: listBuffer.sourceLine,
          tags: listBuffer.tags,
          steps: listBuffer.items,
          ordered: true,
          interactiveChecklist: listBuffer.checklist,
        })
      } else {
        objects.push(listBuffer)
      }
    }
    listBuffer = undefined
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const trimmed = line.text.trim()
    const nextLine = lines[index + 1]
    const codeFenceMatch = trimmed.match(/^```([\w-]*)\s*$/)
    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/)
    const qaQuestionMatch = trimmed.match(/^(?:q|question):\s*(.+)$/i)
    const qaAnswerMatch = trimmed.match(/^(?:a|answer):\s*(.+)$/i)
    const quickSyntaxMatch = trimmed.match(
      /^(Flashcard|Quiz|Reveal|Sequence|Comparison|Checklist|Definition|Formula|Example)::\s*(.*)$/i,
    )
    const termMatch = trimmed.match(/^(.+?)\s*(?:->|::|=|:)\s*(.+)$/)
    const unorderedMatch = trimmed.match(/^[-*]\s+(\[[ xX]\]\s+)?(.+)$/)
    const orderedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/)
    const markdownLinkMatch = trimmed.match(
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/,
    )
    const bareUrlMatch = trimmed.match(/(https?:\/\/\S+)/)

    if (codeFence) {
      if (codeFenceMatch) {
        objects.push({
          id: buildId(packId, 'code', objects.length),
          kind: 'code',
          title: currentHeading || 'Code note',
          sourceLine: codeFence.line.lineNumber,
          tags: defaultTags,
          code: codeFence.lines.join('\n').trimEnd(),
          language:
            codeFence.language || inferCodeLanguage(codeFence.lines.join('\n')),
          caption: currentHeading || '',
        })
        codeFence = undefined
      } else {
        codeFence.lines.push(line.text)
      }
      continue
    }

    if (codeFenceMatch) {
      flushSection()
      flushList()
      codeFence = {
        language: codeFenceMatch[1] || '',
        line,
        lines: [],
      }
      continue
    }

    if (!trimmed) {
      sectionLines.push(line)
      continue
    }

    if (headingMatch) {
      flushSection()
      flushList()
      currentHeading = headingMatch[1].trim()
      pendingQuestion = undefined
      continue
    }

    if (
      line.text.includes('|') &&
      nextLine &&
      isMarkdownTableDivider(nextLine.text)
    ) {
      flushSection()
      flushList()
      const headers = splitPipeRow(line.text)
      const rows: string[][] = []
      let cursor = index + 2

      while (cursor < lines.length && lines[cursor].text.includes('|')) {
        rows.push(splitPipeRow(lines[cursor].text))
        cursor += 1
      }

      if (isComparisonTitle(currentHeading)) {
        objects.push({
          id: buildId(packId, 'comparison', objects.length),
          kind: 'comparison',
          title: currentHeading || `Comparison ${objects.length + 1}`,
          sourceLine: line.lineNumber,
          tags: defaultTags,
          columns: headers,
          rows,
        } satisfies StudyComparisonObject)
      } else {
        objects.push({
          id: buildId(packId, 'table', objects.length),
          kind: 'table',
          title: currentHeading || `Table ${objects.length + 1}`,
          sourceLine: line.lineNumber,
          tags: defaultTags,
          headers,
          rows,
        } satisfies StudyTableObject)
      }

      index = cursor - 1
      continue
    }

    if (qaQuestionMatch) {
      flushSection()
      flushList()
      pendingQuestion = { question: qaQuestionMatch[1].trim(), line }
      continue
    }

    if (qaAnswerMatch && pendingQuestion) {
      objects.push({
        id: buildId(packId, 'qa', objects.length),
        kind: 'qa',
        title: currentHeading,
        sourceLine: pendingQuestion.line.lineNumber,
        tags: defaultTags,
        question: pendingQuestion.question,
        answer: qaAnswerMatch[1].trim(),
      })
      pendingQuestion = undefined
      continue
    }

    if (quickSyntaxMatch) {
      flushSection()
      flushList()
      const label = quickSyntaxMatch[1].toLowerCase()
      const body = quickSyntaxMatch[2].trim()

      if (label === 'definition' || label === 'formula') {
        const definitionParts = body.split(/\s+-\s+|:\s+|=\s+/)
        const term =
          definitionParts.length > 1 ? definitionParts[0] : currentHeading
        const definition =
          definitionParts.length > 1
            ? definitionParts.slice(1).join(': ')
            : body

        objects.push({
          id: buildId(packId, 'term', objects.length),
          kind: 'term',
          title: currentHeading,
          sourceLine: line.lineNumber,
          tags: defaultTags,
          term: term || 'Definition',
          definition,
        })
        continue
      }

      if (label === 'flashcard') {
        const [question, answer] = body
          .split(/\s+(?:\||->)\s+/)
          .map((value) => value.trim())

        if (question && answer) {
          objects.push({
            id: buildId(packId, 'qa', objects.length),
            kind: 'qa',
            title: currentHeading || 'Flashcard',
            sourceLine: line.lineNumber,
            tags: defaultTags,
            question,
            answer,
          })
        }
        continue
      }
    }

    if (markdownLinkMatch || bareUrlMatch) {
      flushSection()
      flushList()
      const label = markdownLinkMatch?.[1] || currentHeading || 'Reference'
      const url = markdownLinkMatch?.[2] || bareUrlMatch?.[1] || ''
      objects.push(
        createResource(packId, objects.length, line, label, url, defaultTags),
      )
      continue
    }

    if (
      termMatch &&
      isConciseTerm(termMatch[1].trim()) &&
      !/[.!?]/.test(termMatch[1].trim())
    ) {
      flushSection()
      flushList()
      objects.push({
        id: buildId(packId, 'term', objects.length),
        kind: 'term',
        title: currentHeading,
        sourceLine: line.lineNumber,
        tags: defaultTags,
        term: termMatch[1].trim(),
        definition: termMatch[2].trim(),
      })
      continue
    }

    if (unorderedMatch || orderedMatch) {
      flushSection()
      const checklist = Boolean(unorderedMatch?.[1])
      const ordered = Boolean(orderedMatch)
      const item = (unorderedMatch?.[2] || orderedMatch?.[1] || '').trim()

      if (
        !listBuffer ||
        listBuffer.ordered !== ordered ||
        listBuffer.checklist !== checklist
      ) {
        flushList()
        listBuffer = {
          id: buildId(packId, 'list', objects.length),
          kind: 'list',
          title: currentHeading,
          sourceLine: line.lineNumber,
          tags: defaultTags,
          items: [],
          ordered,
          checklist,
        }
      }

      listBuffer.items.push(item)
      continue
    }

    flushList()
    sectionLines.push(line)
  }

  if (pendingQuestion) {
    sectionLines.push({
      text: `Q: ${pendingQuestion.question}`,
      lineNumber: pendingQuestion.line.lineNumber,
    })
  }

  if (codeFence) {
    objects.push({
      id: buildId(packId, 'code', objects.length),
      kind: 'code',
      title: currentHeading || 'Code note',
      sourceLine: codeFence.line.lineNumber,
      tags: defaultTags,
      code: codeFence.lines.join('\n').trimEnd(),
      language:
        codeFence.language || inferCodeLanguage(codeFence.lines.join('\n')),
      caption: currentHeading || '',
    })
  }

  flushSection()
  flushList()

  return objects
}

const parseMarkdownBlock = (
  source: string,
  packId: string,
  title: string,
  defaultTags: string[],
): StudyObject[] => [
  {
    id: buildId(packId, 'markdown', 0),
    kind: 'markdown',
    title,
    sourceLine: 1,
    tags: defaultTags,
    markdown: normalizeNewlines(source).trim(),
  },
]

export const parseStudyPack = (
  source: string,
  options: StudyPackParseOptions = {},
): StudyPack => {
  const title = inferTitle(source, options)
  const packId = options.packId || slugify(title)
  const sourceFormat = detectFormat(source, options.sourceFormat)
  const lines = getLines(source)
  const defaultTags = options.defaultTags || []
  const tableObjects =
    sourceFormat === 'csv' || sourceFormat === 'markdown'
      ? []
      : parseMarkdownTables(lines, packId, defaultTags)
  const objects =
    sourceFormat === 'csv'
      ? parseCsv(lines, packId, defaultTags)
      : sourceFormat === 'markdown'
      ? parseMarkdownBlock(source, packId, title, defaultTags)
      : [...tableObjects, ...parseTextLike(lines, packId, defaultTags)]
  const warnings =
    objects.length === 0
      ? ['No study objects were detected in the source.']
      : []

  return {
    id: packId,
    title,
    sourceFormat,
    objects,
    warnings,
  }
}
