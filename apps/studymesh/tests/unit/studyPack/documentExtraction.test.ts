import { beforeEach, describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'
import * as pdfjsLib from 'pdfjs-dist'
import {
  extractTextFromPdf,
  extractTextFromPptx,
} from '../../../src/studyPack/documentExtraction'

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument: vi.fn(),
}))

const makePptxFile = async (zip: JSZip, name = 'lecture.pptx') => {
  const bytes = await zip.generateAsync({ type: 'arraybuffer' })
  const file = new File([bytes], name, {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  })
  Object.defineProperty(file, 'arrayBuffer', {
    value: () => Promise.resolve(bytes),
  })

  return file
}

describe('document extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('extracts PPTX slide text and speaker notes in slide order', async () => {
    const zip = new JSZip()
    zip.file(
      'ppt/slides/slide2.xml',
      '<p:sld xmlns:p="p" xmlns:a="a"><a:t>Second slide</a:t></p:sld>',
    )
    zip.file(
      'ppt/slides/slide1.xml',
      '<p:sld xmlns:p="p" xmlns:a="a"><a:t>First slide</a:t></p:sld>',
    )
    zip.file(
      'ppt/notesSlides/notesSlide1.xml',
      '<p:notes xmlns:p="p" xmlns:a="a"><a:t>Remember example</a:t></p:notes>',
    )
    const file = await makePptxFile(zip)

    const result = await extractTextFromPptx(file)

    expect(result.warnings).toEqual([])
    expect(result.text).toContain('# lecture')
    expect(result.text.indexOf('## Slide 1')).toBeLessThan(
      result.text.indexOf('## Slide 2'),
    )
    expect(result.text).toContain('First slide')
    expect(result.text).toContain('Speaker notes:\nRemember example')
    expect(result.text).toContain('Second slide')
  })

  it('rejects files before reading bytes when size exceeds cap', async () => {
    const file = new File(['x'], 'huge.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    })
    const arrayBuffer = vi.fn()
    Object.defineProperty(file, 'size', {
      value: 26 * 1024 * 1024,
    })
    Object.defineProperty(file, 'arrayBuffer', {
      value: arrayBuffer,
    })

    await expect(extractTextFromPptx(file)).rejects.toThrow(
      'huge.pptx is too large to extract. Maximum document size is 25 MB.',
    )
    expect(arrayBuffer).not.toHaveBeenCalled()
  })

  it('rejects PDFs that exceed page cap', async () => {
    const destroy = vi.fn()
    vi.mocked(pdfjsLib.getDocument).mockReturnValue({
      promise: Promise.resolve({
        destroy,
        getPage: vi.fn(),
        numPages: 101,
      }),
    } as ReturnType<typeof pdfjsLib.getDocument>)
    const file = new File(['pdf'], 'long.pdf', { type: 'application/pdf' })
    Object.defineProperty(file, 'arrayBuffer', {
      value: () => Promise.resolve(new ArrayBuffer(3)),
    })

    await expect(extractTextFromPdf(file)).rejects.toThrow(
      'long.pdf has 101 pages. Maximum PDF page count is 100.',
    )
    expect(destroy).toHaveBeenCalled()
  })

  it('rejects PPTX files that exceed slide cap', async () => {
    const zip = new JSZip()

    for (let index = 1; index <= 201; index += 1) {
      zip.file(
        `ppt/slides/slide${index}.xml`,
        `<p:sld xmlns:p="p" xmlns:a="a"><a:t>Slide ${index}</a:t></p:sld>`,
      )
    }

    const file = await makePptxFile(zip, 'too-many-slides.pptx')

    await expect(extractTextFromPptx(file)).rejects.toThrow(
      'too-many-slides.pptx has 201 slides. Maximum PowerPoint slide count is 200.',
    )
  })

  it('rejects PPTX files that exceed ZIP entry cap', async () => {
    const zip = new JSZip()

    for (let index = 1; index <= 1501; index += 1) {
      zip.file(`docProps/custom${index}.xml`, '<root />')
    }

    const file = await makePptxFile(zip, 'too-many-entries.pptx')

    await expect(extractTextFromPptx(file)).rejects.toThrow(
      'too-many-entries.pptx has too many internal files to extract safely (1502). Maximum ZIP entry count is 1500.',
    )
  })

  it('rejects oversized PPTX XML entries', async () => {
    const zip = new JSZip()
    zip.file(
      'ppt/slides/slide1.xml',
      `<p:sld xmlns:p="p" xmlns:a="a"><a:t>${'x'.repeat(
        2 * 1024 * 1024 + 1,
      )}</a:t></p:sld>`,
    )
    const file = await makePptxFile(zip, 'oversized-entry.pptx')

    await expect(extractTextFromPptx(file)).rejects.toThrow(
      'oversized-entry.pptx contains an XML entry larger than 2 MB: ppt/slides/slide1.xml.',
    )
  })

  it('truncates extracted PPTX text at character cap with warning', async () => {
    const zip = new JSZip()
    zip.file(
      'ppt/slides/slide1.xml',
      `<p:sld xmlns:p="p" xmlns:a="a"><a:t>${'Long notes '.repeat(
        30000,
      )}</a:t></p:sld>`,
    )
    const file = await makePptxFile(zip, 'long-notes.pptx')

    const result = await extractTextFromPptx(file)

    expect(result.text).toHaveLength(250000)
    expect(result.warnings).toEqual([
      'long-notes.pptx extraction was truncated to 250,000 characters.',
    ])
  })
})
