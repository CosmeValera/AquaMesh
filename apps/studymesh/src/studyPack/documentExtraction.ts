import JSZip from 'jszip'
import * as pdfjsLib from 'pdfjs-dist'

export interface ExtractedDocumentNotes {
  text: string
  warnings: string[]
}

const MAX_FILE_BYTES = 25 * 1024 * 1024
const MAX_PDF_PAGES = 100
const MAX_PPTX_SLIDES = 200
const MAX_ZIP_ENTRIES = 1500
const MAX_XML_ENTRY_BYTES = 2 * 1024 * 1024
const MAX_EXTRACTED_TEXT_CHARS = 250000

const getFileTitle = (file: File) =>
  file.name.replace(/\.[^.]+$/, '') || 'Notes'

const formatBytes = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`

const assertFileSize = (file: File) => {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      `${file.name} is too large to extract. Maximum document size is ${formatBytes(MAX_FILE_BYTES)}.`,
    )
  }
}

const normalizeText = (value: string) =>
  value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const getUtf8ByteLength = (value: string) =>
  new TextEncoder().encode(value).length

const applyExtractedTextLimit = (
  fileName: string,
  text: string,
  warnings: string[],
) => {
  if (text.length <= MAX_EXTRACTED_TEXT_CHARS) {
    return text
  }

  warnings.push(
    `${fileName} extraction was truncated to ${MAX_EXTRACTED_TEXT_CHARS.toLocaleString()} characters.`,
  )

  return text.slice(0, MAX_EXTRACTED_TEXT_CHARS).trimEnd()
}

const configurePdfWorker = () => {
  if (typeof window === 'undefined') {
    return
  }

  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
}

export const extractTextFromPdf = async (
  file: File,
): Promise<ExtractedDocumentNotes> => {
  assertFileSize(file)
  configurePdfWorker()

  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const pages: string[] = []
  const warnings: string[] = []

  if (pdf.numPages > MAX_PDF_PAGES) {
    if (pdf.destroy) {
      await pdf.destroy()
    }

    throw new Error(
      `${file.name} has ${pdf.numPages} pages. Maximum PDF page count is ${MAX_PDF_PAGES}.`,
    )
  }

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const pageText = normalizeText(
      content.items
        .map((item) =>
          'str' in item && typeof item.str === 'string' ? item.str : '',
        )
        .filter(Boolean)
        .join(' '),
    )

    if (pageText) {
      pages.push(`## Page ${pageNumber}\n\n${pageText}`)
    } else {
      warnings.push(
        `${file.name} page ${pageNumber} has no selectable text. Scanned pages need OCR in a later iteration.`,
      )
    }
  }

  if (pdf.destroy) {
    await pdf.destroy()
  }

  const text =
    pages.length > 0 ? `# ${getFileTitle(file)}\n\n${pages.join('\n\n')}` : ''

  return {
    text: applyExtractedTextLimit(file.name, text, warnings),
    warnings,
  }
}

const getZipEntryCount = (zip: JSZip) => Object.keys(zip.files).length

const getZipEntrySize = (entry: JSZip.JSZipObject) => {
  const entryWithData = entry as JSZip.JSZipObject & {
    _data?: { uncompressedSize?: number }
  }

  return entryWithData._data?.uncompressedSize
}

const readXmlEntry = async (
  zip: JSZip,
  path: string,
  fileName: string,
): Promise<string> => {
  const entry = zip.file(path)

  if (!entry) {
    return ''
  }

  const entrySize = getZipEntrySize(entry)

  if (entrySize !== undefined && entrySize > MAX_XML_ENTRY_BYTES) {
    throw new Error(
      `${fileName} contains an XML entry larger than ${formatBytes(MAX_XML_ENTRY_BYTES)}: ${path}.`,
    )
  }

  const xml = await entry.async('string')

  if (getUtf8ByteLength(xml) > MAX_XML_ENTRY_BYTES) {
    throw new Error(
      `${fileName} contains an XML entry larger than ${formatBytes(MAX_XML_ENTRY_BYTES)}: ${path}.`,
    )
  }

  return xml
}

const getXmlText = (xml: string): string => {
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  const textNodes = Array.from(document.getElementsByTagName('a:t'))

  return normalizeText(
    textNodes
      .map((node) => node.textContent || '')
      .filter(Boolean)
      .join('\n'),
  )
}

const getOrderedXmlPaths = (
  zip: JSZip,
  pattern: RegExp,
): Array<{ path: string; number: number }> =>
  Object.keys(zip.files)
    .map((path) => {
      const match = path.match(pattern)
      return match ? { path, number: Number(match[1]) } : null
    })
    .filter((item): item is { path: string; number: number } => Boolean(item))
    .sort((first, second) => first.number - second.number)

export const extractTextFromPptx = async (
  file: File,
): Promise<ExtractedDocumentNotes> => {
  assertFileSize(file)
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const zipEntryCount = getZipEntryCount(zip)

  if (zipEntryCount > MAX_ZIP_ENTRIES) {
    throw new Error(
      `${file.name} has too many internal files to extract safely (${zipEntryCount}). Maximum ZIP entry count is ${MAX_ZIP_ENTRIES}.`,
    )
  }

  const slides = getOrderedXmlPaths(zip, /^ppt\/slides\/slide(\d+)\.xml$/)

  if (slides.length > MAX_PPTX_SLIDES) {
    throw new Error(
      `${file.name} has ${slides.length} slides. Maximum PowerPoint slide count is ${MAX_PPTX_SLIDES}.`,
    )
  }

  const notesBySlide = new Map(
    getOrderedXmlPaths(zip, /^ppt\/notesSlides\/notesSlide(\d+)\.xml$/).map(
      (note) => [note.number, note.path],
    ),
  )
  const sections: string[] = []

  for (const slide of slides) {
    const slideXml = await readXmlEntry(zip, slide.path, file.name)
    const slideText = slideXml ? getXmlText(slideXml) : ''
    const notesPath = notesBySlide.get(slide.number)
    const notesXml = notesPath
      ? await readXmlEntry(zip, notesPath, file.name)
      : ''
    const notesText = notesXml ? getXmlText(notesXml) : ''
    const parts = [slideText, notesText ? `Speaker notes:\n${notesText}` : '']
      .filter(Boolean)
      .join('\n\n')

    if (parts) {
      sections.push(`## Slide ${slide.number}\n\n${parts}`)
    }
  }

  const warnings =
    sections.length > 0
      ? []
      : [`${file.name} did not contain extractable slide text.`]
  const text =
    sections.length > 0
      ? `# ${getFileTitle(file)}\n\n${sections.join('\n\n')}`
      : ''

  return {
    text: applyExtractedTextLimit(file.name, text, warnings),
    warnings,
  }
}
