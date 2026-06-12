import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  Menu,
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

type EditorMode = 'rich' | 'source'

interface StudyGuidePageEditorProps {
  title: string
  markdown: string
  onChange: (title: string, markdown: string) => void
}

const SAVE_DELAY_MS = 450

const toolbarButtonSx = (active: boolean) => (theme: Theme) => ({
  width: 34,
  height: 34,
  border: 1,
  borderColor: active
    ? theme.palette.primary.main
    : alpha(theme.palette.text.primary, 0.22),
  bgcolor: active
    ? alpha(
        theme.palette.primary.main,
        theme.palette.mode === 'dark' ? 0.28 : 0.14,
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
}) => {
  const [mode, setMode] = useState<EditorMode>('rich')
  const [titleValue, setTitleValue] = useState(title)
  const [sourceValue, setSourceValue] = useState(normalizeMarkdown(markdown))
  const [sourceError, setSourceError] = useState('')
  const [tableMenuAnchor, setTableMenuAnchor] = useState<HTMLElement | null>(
    null,
  )
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
          editor.isEmpty ? 'Start writing notes...' : '',
      }),
      Markdown.configure({
        indentation: { style: 'space', size: 2 },
      }),
    ],
    content: normalizeMarkdown(markdown),
    contentType: 'markdown',
    editorProps: {
      attributes: {
        'aria-label': 'Page body',
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
            : 'Could not parse Markdown source.',
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
    const nextUrl = window.prompt('Link URL', previousUrl || 'https://')
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

  return (
    <Stack spacing={1.5} sx={{ maxWidth: 980, mx: 'auto' }}>
      <TextField
        label="Page title"
        value={titleValue}
        onChange={(event) => updateTitle(event.target.value)}
        onBlur={flushSave}
        fullWidth
      />
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
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
              label="Rich text"
              value="rich"
              sx={{ minHeight: 34, py: 0.5 }}
            />
            <Tab
              icon={<DataObjectIcon fontSize="small" />}
              iconPosition="start"
              label="Source"
              value="source"
              sx={{ minHeight: 34, py: 0.5 }}
            />
          </Tabs>
          {mode === 'rich' ? (
            <Stack direction="row" gap={0.5} flexWrap="wrap">
              <ToolbarButton
                label="Undo"
                disabled={!editor?.can().undo()}
                onClick={() => editor?.chain().focus().undo().run()}
              >
                <UndoIcon fontSize="small" />
              </ToolbarButton>
              <ToolbarButton
                label="Redo"
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
                label="Bold"
                active={Boolean(editor?.isActive('bold'))}
                onClick={() => editor?.chain().focus().toggleBold().run()}
              >
                <FormatBoldIcon fontSize="small" />
              </ToolbarButton>
              <ToolbarButton
                label="Italic"
                active={Boolean(editor?.isActive('italic'))}
                onClick={() => editor?.chain().focus().toggleItalic().run()}
              >
                <FormatItalicIcon fontSize="small" />
              </ToolbarButton>
              <ToolbarButton
                label="Inline code"
                active={Boolean(editor?.isActive('code'))}
                onClick={() => editor?.chain().focus().toggleCode().run()}
              >
                <CodeIcon fontSize="small" />
              </ToolbarButton>
              <Divider orientation="vertical" flexItem />
              <ToolbarButton
                label="Bullet list"
                active={Boolean(editor?.isActive('bulletList'))}
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
              >
                <FormatListBulletedIcon fontSize="small" />
              </ToolbarButton>
              <ToolbarButton
                label="Numbered list"
                active={Boolean(editor?.isActive('orderedList'))}
                onClick={() =>
                  editor?.chain().focus().toggleOrderedList().run()
                }
              >
                <FormatListNumberedIcon fontSize="small" />
              </ToolbarButton>
              <ToolbarButton
                label="Checklist"
                active={Boolean(editor?.isActive('taskList'))}
                onClick={() => editor?.chain().focus().toggleTaskList().run()}
              >
                <ChecklistIcon fontSize="small" />
              </ToolbarButton>
              <ToolbarButton
                label="Quote"
                active={Boolean(editor?.isActive('blockquote'))}
                onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              >
                <FormatQuoteIcon fontSize="small" />
              </ToolbarButton>
              <ToolbarButton
                label="Divider"
                onClick={() =>
                  editor?.chain().focus().setHorizontalRule().run()
                }
              >
                <HorizontalRuleIcon fontSize="small" />
              </ToolbarButton>
              <Divider orientation="vertical" flexItem />
              <ToolbarButton
                label="Add link"
                active={Boolean(editor?.isActive('link'))}
                onClick={setLink}
              >
                <LinkIcon fontSize="small" />
              </ToolbarButton>
              <ToolbarButton
                label="Remove link"
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
              <Tooltip title="Insert table">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Insert table"
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
                      label="Rows"
                      type="number"
                      value={tableRows}
                      size="small"
                      inputProps={{ min: 1, max: 12 }}
                      onChange={(event) => updateTableRows(event.target.value)}
                    />
                    <TextField
                      label="Columns"
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
                    Insert table
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
                py: 2.5,
                outline: 'none',
                color: 'text.primary',
                fontSize: '0.98rem',
                lineHeight: 1.7,
              },
              '& .tiptap > *:first-of-type': { mt: 0 },
              '& .tiptap h1, & .tiptap h2, & .tiptap h3': {
                lineHeight: 1.25,
                marginTop: theme.spacing(2),
                marginBottom: theme.spacing(1),
              },
              '& .tiptap h1': { fontSize: '1.6rem' },
              '& .tiptap h2': { fontSize: '1.32rem' },
              '& .tiptap h3': { fontSize: '1.12rem' },
              '& .tiptap p': { margin: theme.spacing(0.75, 0) },
              '& .tiptap ul, & .tiptap ol': {
                paddingLeft: theme.spacing(3),
              },
              '& .tiptap code': {
                borderRadius: 6,
                padding: '0.1rem 0.35rem',
                backgroundColor: theme.palette.action.hover,
                fontFamily: 'JetBrains Mono, Consolas, monospace',
              },
              '& .tiptap pre': {
                overflowX: 'auto',
                borderRadius: 8,
                padding: theme.spacing(1.5),
                backgroundColor: '#111827',
                color: '#f9fafb',
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
              label="Markdown source"
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
