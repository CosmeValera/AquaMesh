import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
} from '@mui/material'
import { alpha, type Theme } from '@mui/material/styles'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import CodeIcon from '@mui/icons-material/Code'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered'
import ChecklistIcon from '@mui/icons-material/Checklist'
import FormatQuoteIcon from '@mui/icons-material/FormatQuote'
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import ArticleIcon from '@mui/icons-material/Article'
import TableChartIcon from '@mui/icons-material/TableChart'
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'
import TitleIcon from '@mui/icons-material/Title'
import DataObjectIcon from '@mui/icons-material/DataObject'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { TableKit } from '@tiptap/extension-table'
import type { Editor } from '@tiptap/core'
import { createStudyGuidePageHref } from '../../studyGuides/pageLinks'
import { useInterfaceText } from '../../language/interfaceLanguage'

type EditorMode = 'rich' | 'source'

interface StudyGuidePageEditorProps {
  title: string
  markdown: string
  onChange: (title: string, markdown: string) => void
  pageLinks?: Array<{ title: string; dashboardKey: string }>
}

const SAVE_DELAY_MS = 450

const toolbarButtonSx = (active: boolean) => (theme: Theme) => ({
  width: 32,
  height: 32,
  border: 1,
  borderColor: active
    ? alpha(theme.palette.primary.main, 0.4)
    : alpha(theme.palette.text.primary, 0.22),
  bgcolor: active
    ? alpha(
        theme.palette.primary.main,
        theme.palette.mode === 'dark' ? 0.2 : 0.09,
      )
    : theme.palette.background.paper,
  color: active ? theme.palette.primary.main : theme.palette.text.secondary,
  '&:hover': {
    borderColor: theme.palette.primary.main,
    bgcolor: alpha(
      theme.palette.primary.main,
      theme.palette.mode === 'dark' ? 0.34 : 0.12,
    ),
    color: theme.palette.primary.main,
  },
  '&.Mui-disabled': {
    borderColor: theme.palette.divider,
    bgcolor: theme.palette.action.disabledBackground,
    color: theme.palette.text.disabled,
    opacity: 0.72,
  },
})

const normalizeMarkdown = (value: string) => value.replace(/\r\n/g, '\n')

const readEditorMarkdown = (editor: Editor): string => {
  try {
    return normalizeMarkdown(editor.getMarkdown())
  } catch {
    return ''
  }
}

const StudyGuidePageEditor: React.FC<StudyGuidePageEditorProps> = ({
  title,
  markdown,
  onChange,
  pageLinks = [],
}) => {
  const { t } = useInterfaceText()
  const [mode, setMode] = useState<EditorMode>('rich')
  const [titleValue, setTitleValue] = useState(title)
  const [sourceValue, setSourceValue] = useState(normalizeMarkdown(markdown))
  const [sourceError, setSourceError] = useState('')
  const [tableMenuAnchor, setTableMenuAnchor] = useState<HTMLElement | null>(
    null,
  )
  const [pageLinkMenuAnchor, setPageLinkMenuAnchor] =
    useState<HTMLElement | null>(null)
  const [tableRows, setTableRows] = useState(3)
  const [tableColumns, setTableColumns] = useState(3)
  const pendingRef = useRef({
    title,
    markdown: normalizeMarkdown(markdown),
  })
  const savedRef = useRef({
    title,
    markdown: normalizeMarkdown(markdown),
  })
  const editorPlaceholderRef = useRef(t('pageEditor.startWritingNotes'))
  const saveTimerRef = useRef<number | null>(null)
  const sourceValueRef = useRef(sourceValue)

  const flushSave = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    const pending = pendingRef.current
    const saved = savedRef.current
    if (pending.title === saved.title && pending.markdown === saved.markdown) {
      return
    }

    savedRef.current = pending
    onChange(pending.title, pending.markdown)
  }, [onChange])

  const scheduleSave = useCallback(
    (nextTitle: string, nextMarkdown: string) => {
      pendingRef.current = {
        title: nextTitle,
        markdown: normalizeMarkdown(nextMarkdown),
      }

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current)
      }

      saveTimerRef.current = window.setTimeout(flushSave, SAVE_DELAY_MS)
    },
    [flushSave],
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          autolink: true,
          linkOnPaste: true,
          openOnClick: false,
          HTMLAttributes: {
            rel: 'noopener noreferrer',
            target: '_blank',
          },
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({
        table: {
          resizable: false,
          HTMLAttributes: { class: 'studymesh-page-editor-table' },
        },
      }),
      Placeholder.configure({
        placeholder: ({ editor }) =>
          editor.isEmpty ? editorPlaceholderRef.current : '',
      }),
      Markdown.configure({
        indentation: { style: 'space', size: 2 },
      }),
    ],
    content: normalizeMarkdown(markdown),
    contentType: 'markdown',
    editorProps: {
      attributes: {
        'aria-label': t('pageEditor.pageBody'),
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      if (mode !== 'rich') {
        return
      }

      const nextMarkdown = readEditorMarkdown(activeEditor)
      setSourceValue(nextMarkdown)
      sourceValueRef.current = nextMarkdown
      scheduleSave(titleValue, nextMarkdown)
    },
  })

  useEffect(() => {
    sourceValueRef.current = sourceValue
  }, [sourceValue])

  useEffect(() => {
    editorPlaceholderRef.current = t('pageEditor.startWritingNotes')
  }, [t])

  useEffect(() => {
    return () => {
      flushSave()
    }
  }, [flushSave])

  const updateTitle = (nextTitle: string) => {
    setTitleValue(nextTitle)
    scheduleSave(nextTitle, sourceValueRef.current)
  }

  const updateSource = (nextMarkdown: string) => {
    const normalized = normalizeMarkdown(nextMarkdown)
    setSourceValue(normalized)
    sourceValueRef.current = normalized
    scheduleSave(titleValue, normalized)
  }

  const switchMode = (nextMode: EditorMode) => {
    if (nextMode === mode) {
      return
    }

    if (nextMode === 'rich' && editor) {
      try {
        editor.commands.setContent(sourceValueRef.current, {
          contentType: 'markdown',
          emitUpdate: false,
        })
        setSourceError('')
      } catch (error) {
        setSourceError(
          error instanceof Error
            ? error.message
            : t('pageEditor.couldNotParseMarkdown'),
        )
        return
      }
    }

    setMode(nextMode)
  }

  const setHeading = (level: 1 | 2 | 3) => {
    editor?.chain().focus().toggleHeading({ level }).run()
  }

  const setLink = () => {
    if (!editor) {
      return
    }

    const previousUrl = editor.getAttributes('link').href as string | undefined
    const nextUrl = window.prompt(
      t('pageEditor.linkUrl'),
      previousUrl || 'https://',
    )
    if (nextUrl === null) {
      return
    }

    const trimmed = nextUrl.trim()
    if (!trimmed) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: trimmed })
      .run()
  }

  const setStudyGuidePageLink = (dashboardKey: string) => {
    if (!editor) {
      return
    }

    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: createStudyGuidePageHref(dashboardKey) })
      .run()
    setPageLinkMenuAnchor(null)
  }

  const insertTable = (rows = tableRows, cols = tableColumns) => {
    editor
      ?.chain()
      .focus()
      .insertTable({ rows, cols, withHeaderRow: true })
      .run()
    setTableMenuAnchor(null)
  }

  const normalizeTableSize = (value: number, max: number): number =>
    Math.max(1, Math.min(max, Number.isFinite(value) ? value : 1))

  const updateTableRows = (value: string) => {
    setTableRows(normalizeTableSize(Number(value), 12))
  }

  const updateTableColumns = (value: string) => {
    setTableColumns(normalizeTableSize(Number(value), 8))
  }

  const ToolbarButton = ({
    label,
    active = false,
    disabled = false,
    onClick,
    children,
  }: {
    label: string
    active?: boolean
    disabled?: boolean
    onClick: () => void
    children: React.ReactNode
  }) => (
    <Tooltip title={label}>
      <span>
        <IconButton
          size="small"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          sx={toolbarButtonSx(active)}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  )

  const activeLinkHref = String(editor?.getAttributes('link').href || '')
  const studyGuidePageLinkActive = activeLinkHref.startsWith('studymesh-page:')
  const externalLinkActive =
    Boolean(editor?.isActive('link')) && !studyGuidePageLinkActive

  return (
    <Stack spacing={1.5} sx={{ maxWidth: 980, mx: 'auto' }}>
      <TextField
        label={t('pageEditor.pageTitle')}
        placeholder={t('pageEditor.pageTitle')}
        value={titleValue}
        onChange={(event) => updateTitle(event.target.value)}
        onBlur={flushSave}
        fullWidth
      />
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1.5,
          overflow: 'hidden',
          bgcolor: 'background.paper',
        }}
      >
        <Box
          sx={{
            px: 1,
            py: 0.75,
            borderBottom: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          <Tabs
            value={mode}
            onChange={(_event, value: EditorMode) => switchMode(value)}
            sx={{ minHeight: 34, mr: 'auto' }}
          >
            <Tab
              icon={<TitleIcon fontSize="small" />}
              iconPosition="start"
              label={t('pageEditor.richText')}
              value="rich"
              sx={{ minHeight: 34, py: 0.5 }}
            />
            <Tab
              icon={<DataObjectIcon fontSize="small" />}
              iconPosition="start"
              label={t('pageEditor.source')}
              value="source"
              sx={{ minHeight: 34, py: 0.5 }}
            />
          </Tabs>
          {mode === 'rich' ? (
            <Stack direction="row" gap={0.5} flexWrap="wrap">
              <ToolbarButton
                label={t('pageEditor.undo')}
                disabled={!editor?.can().undo()}
                onClick={() => editor?.chain().focus().undo().run()}
              >
                <UndoIcon fontSize="small" />
              </ToolbarButton>
              <ToolbarButton
                label={t('pageEditor.redo')}
                disabled={!editor?.can().redo()}
                onClick={() => editor?.chain().focus().redo().run()}
              >
                <RedoIcon fontSize="small" />
              </ToolbarButton>
              <Divider orientation="vertical" flexItem />
              {[1, 2, 3].map((level) => (
                <Button
                  key={level}
                  size="small"
                  variant={
                    editor?.isActive('heading', { level })
                      ? 'contained'
                      : 'outlined'
                  }
                  onClick={() => setHeading(level as 1 | 2 | 3)}
                  sx={{ minWidth: 38, px: 1, borderRadius: 1.5 }}
                >
                  H{level}
                </Button>
              ))}
              <ToolbarButton
                label={t('pageEditor.bold')}
                active={Boolean(editor?.isActive('bold'))}
                onClick={() => editor?.chain().focus().toggleBold().run()}
              >
                <FormatBoldIcon fontSize="small" />
              </ToolbarButton>
              <ToolbarButton
                label={t('pageEditor.italic')}
                active={Boolean(editor?.isActive('italic'))}
                onClick={() => editor?.chain().focus().toggleItalic().run()}
              >
                <FormatItalicIcon fontSize="small" />
              </ToolbarButton>
              <ToolbarButton
                label={t('pageEditor.inlineCode')}
                active={Boolean(editor?.isActive('code'))}
                onClick={() => editor?.chain().focus().toggleCode().run()}
              >
                <CodeIcon fontSize="small" />
              </ToolbarButton>
              <Divider orientation="vertical" flexItem />
              <ToolbarButton
                label={t('pageEditor.bulletList')}
                active={Boolean(editor?.isActive('bulletList'))}
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
              >
                <FormatListBulletedIcon fontSize="small" />
              </ToolbarButton>
              <ToolbarButton
                label={t('pageEditor.numberedList')}
                active={Boolean(editor?.isActive('orderedList'))}
                onClick={() =>
                  editor?.chain().focus().toggleOrderedList().run()
                }
              >
                <FormatListNumberedIcon fontSize="small" />
              </ToolbarButton>
              <ToolbarButton
                label={t('pageEditor.checklist')}
                active={Boolean(editor?.isActive('taskList'))}
                onClick={() => editor?.chain().focus().toggleTaskList().run()}
              >
                <ChecklistIcon fontSize="small" />
              </ToolbarButton>
              <ToolbarButton
                label={t('pageEditor.quote')}
                active={Boolean(editor?.isActive('blockquote'))}
                onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              >
                <FormatQuoteIcon fontSize="small" />
              </ToolbarButton>
              <ToolbarButton
                label={t('pageEditor.divider')}
                onClick={() =>
                  editor?.chain().focus().setHorizontalRule().run()
                }
              >
                <HorizontalRuleIcon fontSize="small" />
              </ToolbarButton>
              <Divider orientation="vertical" flexItem />
              <Tooltip title={t('pageEditor.linkStudyGuidePage')}>
                <span>
                  <IconButton
                    size="small"
                    aria-label={t('pageEditor.linkStudyGuidePage')}
                    disabled={pageLinks.length === 0}
                    onClick={(event) =>
                      setPageLinkMenuAnchor(event.currentTarget)
                    }
                    sx={toolbarButtonSx(
                      studyGuidePageLinkActive || Boolean(pageLinkMenuAnchor),
                    )}
                  >
                    <ArticleIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <ToolbarButton
                label={t('pageEditor.linkExternalPage')}
                active={externalLinkActive}
                onClick={setLink}
              >
                <LinkIcon fontSize="small" />
              </ToolbarButton>
              <ToolbarButton
                label={t('pageEditor.removeLink')}
                disabled={!editor?.isActive('link')}
                onClick={() =>
                  editor
                    ?.chain()
                    .focus()
                    .extendMarkRange('link')
                    .unsetLink()
                    .run()
                }
              >
                <LinkOffIcon fontSize="small" />
              </ToolbarButton>
              <Menu
                anchorEl={pageLinkMenuAnchor}
                open={Boolean(pageLinkMenuAnchor)}
                onClose={() => setPageLinkMenuAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                {pageLinks.map((pageLink) => (
                  <MenuItem
                    key={pageLink.dashboardKey}
                    onClick={() => setStudyGuidePageLink(pageLink.dashboardKey)}
                  >
                    {pageLink.title}
                  </MenuItem>
                ))}
              </Menu>
              <Tooltip title={t('pageEditor.insertTable')}>
                <span>
                  <IconButton
                    size="small"
                    aria-label={t('pageEditor.insertTable')}
                    onClick={(event) => setTableMenuAnchor(event.currentTarget)}
                    sx={toolbarButtonSx(Boolean(tableMenuAnchor))}
                  >
                    <TableChartIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Menu
                anchorEl={tableMenuAnchor}
                open={Boolean(tableMenuAnchor)}
                onClose={() => setTableMenuAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                <Stack spacing={1.25} sx={{ width: 220, p: 1.5 }}>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      label={t('pageEditor.rows')}
                      type="number"
                      value={tableRows}
                      size="small"
                      inputProps={{ min: 1, max: 12 }}
                      onChange={(event) => updateTableRows(event.target.value)}
                    />
                    <TextField
                      label={t('pageEditor.columns')}
                      type="number"
                      value={tableColumns}
                      size="small"
                      inputProps={{ min: 1, max: 8 }}
                      onChange={(event) =>
                        updateTableColumns(event.target.value)
                      }
                    />
                  </Stack>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => insertTable()}
                  >
                    {t('pageEditor.insertTable')}
                  </Button>
                </Stack>
              </Menu>
            </Stack>
          ) : null}
        </Box>
        {sourceError ? (
          <Alert severity="error" sx={{ borderRadius: 0 }}>
            {sourceError}
          </Alert>
        ) : null}
        {mode === 'rich' ? (
          <Box
            sx={(theme) => ({
              '& .tiptap': {
                minHeight: { xs: 'calc(100dvh - 300px)', md: 460 },
                px: { xs: 2, sm: 3 },
                py: { xs: 2, sm: 3 },
                outline: 'none',
                color: 'text.primary',
                fontSize: '0.96rem',
                lineHeight: 1.7,
              },
              '& .tiptap > *:first-of-type': { mt: 0 },
              '& .tiptap h1, & .tiptap h2, & .tiptap h3': {
                lineHeight: 1.25,
                marginTop: theme.spacing(2),
                marginBottom: theme.spacing(1),
              },
              '& .tiptap h1': { fontSize: '1.5rem', fontWeight: 600 },
              '& .tiptap h2': { fontSize: '1.25rem', fontWeight: 600 },
              '& .tiptap h3': { fontSize: '1.08rem', fontWeight: 600 },
              '& .tiptap p': { margin: theme.spacing(0.75, 0) },
              '& .tiptap a': {
                color: theme.palette.primary.main,
                textDecorationColor: alpha(theme.palette.primary.main, 0.45),
                textUnderlineOffset: 3,
              },
              '& .tiptap a[href^="studymesh-page:"]': {
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: 22,
                px: 0.75,
                borderRadius: 999,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.38)}`,
                backgroundColor: alpha(
                  theme.palette.primary.main,
                  theme.palette.mode === 'dark' ? 0.2 : 0.09,
                ),
                color: theme.palette.primary.main,
                fontWeight: 700,
                textDecoration: 'none',
              },
              '& .tiptap ul, & .tiptap ol': {
                paddingLeft: theme.spacing(3),
              },
              '& .tiptap code': {
                borderRadius: 6,
                padding: '0.1rem 0.35rem',
                backgroundColor:
                  theme.palette.mode === 'dark'
                    ? alpha(theme.palette.common.white, 0.08)
                    : alpha(theme.palette.grey[900], 0.06),
                fontFamily: 'JetBrains Mono, Consolas, monospace',
              },
              '& .tiptap pre': {
                overflowX: 'auto',
                borderRadius: 8,
                padding: theme.spacing(1.5, 2),
                backgroundColor:
                  theme.palette.mode === 'dark'
                    ? theme.palette.grey[100]
                    : theme.palette.grey[900],
                color:
                  theme.palette.mode === 'dark'
                    ? theme.palette.text.primary
                    : '#F8FAFC',
                border: `1px solid ${theme.palette.divider}`,
                fontFamily: 'JetBrains Mono, Consolas, monospace',
              },
              '& .tiptap blockquote': {
                borderLeft: `3px solid ${theme.palette.divider}`,
                marginLeft: 0,
                paddingLeft: theme.spacing(2),
                color: theme.palette.text.secondary,
              },
              '& .tiptap table': {
                borderCollapse: 'collapse',
                width: '100%',
                margin: theme.spacing(1, 0),
              },
              '& .tiptap th, & .tiptap td': {
                border: `1px solid ${theme.palette.divider}`,
                padding: theme.spacing(0.75),
                verticalAlign: 'top',
              },
              '& .tiptap th': { backgroundColor: theme.palette.action.hover },
              '& .tiptap ul[data-type="taskList"]': {
                listStyle: 'none',
                paddingLeft: 0,
              },
              '& .tiptap li[data-type="taskItem"]': {
                display: 'flex',
                gap: theme.spacing(0.75),
              },
              '& .tiptap .is-empty::before': {
                color: theme.palette.text.disabled,
                content: 'attr(data-placeholder)',
                float: 'left',
                height: 0,
                pointerEvents: 'none',
              },
            })}
          >
            <EditorContent editor={editor} />
          </Box>
        ) : (
          <Box sx={{ p: 2 }}>
            <TextField
              label={t('pageEditor.markdownSource')}
              value={sourceValue}
              onChange={(event) => updateSource(event.target.value)}
              onBlur={flushSave}
              fullWidth
              multiline
              minRows={18}
              InputProps={{
                sx: {
                  fontFamily: 'JetBrains Mono, Consolas, monospace',
                  alignItems: 'flex-start',
                },
              }}
            />
          </Box>
        )}
      </Box>
    </Stack>
  )
}

export default StudyGuidePageEditor
