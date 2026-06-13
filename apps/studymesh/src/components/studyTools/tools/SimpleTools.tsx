import React, { useRef, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Chip,
  IconButton,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import SendIcon from '@mui/icons-material/Send'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import MicIcon from '@mui/icons-material/Mic'
import StopIcon from '@mui/icons-material/Stop'
import CloseIcon from '@mui/icons-material/Close'

import { useStudyTools } from '../StudyToolsProvider'

const id = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
const now = () => new Date().toISOString()

export const TodoTool = () => {
  const { state, updateState } = useStudyTools()
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'pending' | 'completed' | 'all'>('pending')
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [dueDate, setDueDate] = useState('')
  const [sort, setSort] = useState<'created' | 'due' | 'priority'>('created')
  const [lastCompletedId, setLastCompletedId] = useState<string | null>(null)
  const priorityRank = { high: 0, medium: 1, low: 2 }
  const items = state.todo.items.filter((item) =>
    (filter === 'all'
      ? true
      : filter === 'completed'
        ? item.completed
        : !item.completed) &&
    item.text.toLowerCase().includes(search.trim().toLowerCase()),
  ).sort((a, b) =>
    sort === 'priority'
      ? priorityRank[a.priority || 'medium'] - priorityRank[b.priority || 'medium']
      : sort === 'due'
        ? (a.dueDate || '9999').localeCompare(b.dueDate || '9999')
        : a.createdAt - b.createdAt,
  )

  const updateItems = (nextItems: typeof state.todo.items) =>
    updateState((current) => ({
      ...current,
      todo: { items: nextItems, updatedAt: now() },
    }))

  const add = () => {
    const text = draft.trim()
    if (!text) return
    updateItems([
      ...state.todo.items,
      {
        id: id('todo'),
        text,
        completed: false,
        createdAt: Date.now(),
        priority,
        dueDate: dueDate || undefined,
      },
    ])
    setDraft('')
    setDueDate('')
    setPriority('medium')
  }

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          size="small"
          label="New task"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && add()}
        />
        <Button variant="contained" onClick={add}>Add</Button>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        <TextField
          select
          size="small"
          label="Priority"
          value={priority}
          onChange={(event) => setPriority(event.target.value as typeof priority)}
        >
          <MenuItem value="low">Low</MenuItem>
          <MenuItem value="medium">Medium</MenuItem>
          <MenuItem value="high">High</MenuItem>
        </TextField>
        <TextField
          size="small"
          type="date"
          label="Due date"
          InputLabelProps={{ shrink: true }}
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
        />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 1 }}>
        <TextField
          size="small"
          label="Search tasks"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <TextField select size="small" label="Sort" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
          <MenuItem value="created">Created</MenuItem>
          <MenuItem value="due">Due date</MenuItem>
          <MenuItem value="priority">Priority</MenuItem>
        </TextField>
      </Box>
      {lastCompletedId && (
        <Button
          size="small"
          variant="outlined"
          onClick={() => {
            updateItems(state.todo.items.map((item) =>
              item.id === lastCompletedId ? { ...item, completed: false } : item,
            ))
            setLastCompletedId(null)
          }}
        >
          Undo completed task
        </Button>
      )}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Chip label={`${state.todo.items.filter((item) => !item.completed).length} pending`} />
        <Chip label={`${state.todo.items.filter((item) => item.completed).length} done`} />
      </Box>
      <Tabs value={filter} onChange={(_, value) => setFilter(value)}>
        <Tab value="pending" label="Pending" />
        <Tab value="completed" label="Done" />
        <Tab value="all" label="All" />
      </Tabs>
      {items.length === 0 && (
        <Typography color="text.secondary">No tasks here.</Typography>
      )}
      {items.map((item) => (
        <Box
          key={item.id}
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
            p: 1,
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <Checkbox
            inputProps={{ 'aria-label': `${item.completed ? 'Mark pending' : 'Mark complete'}: ${item.text}` }}
            checked={item.completed}
            onChange={() => {
              if (!item.completed) setLastCompletedId(item.id)
              updateItems(
                state.todo.items.map((entry) =>
                  entry.id === item.id
                    ? { ...entry, completed: !entry.completed }
                    : entry,
                ),
              )
            }}
          />
          {editingId === item.id ? (
            <TextField
              autoFocus
              fullWidth
              size="small"
              value={item.text}
              onChange={(event) =>
                updateItems(
                  state.todo.items.map((entry) =>
                    entry.id === item.id
                      ? { ...entry, text: event.target.value }
                      : entry,
                  ),
                )
              }
              onBlur={() => setEditingId(null)}
              onKeyDown={(event) => event.key === 'Enter' && setEditingId(null)}
            />
          ) : (
            <Typography
              sx={{
                flex: 1,
                flexBasis: 'calc(100% - 52px)',
                minWidth: 0,
                textDecoration: item.completed ? 'line-through' : 'none',
              }}
            >
              {item.text}
            </Typography>
          )}
          <Chip
            size="small"
            label={item.priority || 'medium'}
            color={item.priority === 'high' ? 'error' : item.priority === 'low' ? 'default' : 'warning'}
          />
          {item.dueDate && <Chip size="small" label={item.dueDate} variant="outlined" />}
          <IconButton
            aria-label={`Edit ${item.text}`}
            onClick={() => setEditingId(item.id)}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <Button
            size="small"
            onClick={() =>
              window.dispatchEvent(new CustomEvent('studymesh-pomodoro-focus-task', {
                detail: { label: item.text },
              }))
            }
          >
            Focus
          </Button>
          <IconButton
            aria-label={`Delete ${item.text}`}
            color="error"
            onClick={() =>
              updateItems(state.todo.items.filter((entry) => entry.id !== item.id))
            }
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      {state.todo.items.some((item) => item.completed) && (
        <Button
          variant="outlined"
          onClick={() =>
            updateItems(state.todo.items.filter((item) => !item.completed))
          }
        >
          Clear completed
        </Button>
      )}
    </Stack>
  )
}

export const ScratchpadTool = () => {
  const { state, updateState } = useStudyTools()
  const [revision, setRevision] = useState('')
  const words = state.scratchpad.content.trim()
    ? state.scratchpad.content.trim().split(/\s+/).length
    : 0
  const updateContent = (content: string) =>
    updateState((current) => ({
      ...current,
      scratchpad: { content, updatedAt: now() },
    }))
  return (
    <Stack spacing={1.5}>
      <Typography variant="caption" color="text.secondary">
          Autosaved {new Date(state.scratchpad.updatedAt).toLocaleTimeString()} · {words} words · {state.scratchpad.content.length} characters
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button size="small" onClick={() => updateContent(`# ${state.scratchpad.content}`)}>Heading</Button>
        <Button size="small" onClick={() => updateContent(`- [ ] ${state.scratchpad.content}`)}>Checklist</Button>
        <Button component="label" size="small">
          Import
          <input
            hidden
            type="file"
            accept="text/plain,.md"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = () => {
                setRevision(state.scratchpad.content)
                updateContent(String(reader.result || ''))
              }
              reader.readAsText(file)
            }}
          />
        </Button>
        <Button
          size="small"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([state.scratchpad.content], { type: 'text/plain' }),
            )
            const link = document.createElement('a')
            link.href = url
            link.download = 'studymesh-scratchpad.txt'
            link.click()
            URL.revokeObjectURL(url)
          }}
        >
          Export
        </Button>
        <Button
          size="small"
          disabled={!state.scratchpad.content.trim()}
          onClick={() =>
            updateState((current) => ({
              ...current,
              todo: {
                items: [...current.todo.items, {
                  id: id('todo'),
                  text: current.scratchpad.content.trim().slice(0, 240),
                  completed: false,
                  createdAt: Date.now(),
                  priority: 'medium',
                }],
                updatedAt: now(),
              },
            }))
          }
        >
          To Todo
        </Button>
        {revision && (
          <Button size="small" onClick={() => {
            const previous = state.scratchpad.content
            updateContent(revision)
            setRevision(previous)
          }}>
            Undo
          </Button>
        )}
        <Button size="small" color="error" onClick={() => {
          setRevision(state.scratchpad.content)
          updateContent('')
        }}>
          Clear
        </Button>
      </Box>
      <TextField
        multiline
        fullWidth
        minRows={20}
        placeholder="Write anything you want to remember..."
        value={state.scratchpad.content}
        onChange={(event) => updateContent(event.target.value)}
      />
    </Stack>
  )
}

export const PrivateChatTool = ({ onClose }: { onClose?: () => void }) => {
  const { state, updateState } = useStudyTools()
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingAttachments, setPendingAttachments] = useState<
    NonNullable<(typeof state.privateChat.messages)[number]['attachments']>
  >([])
  const [recording, setRecording] = useState(false)
  const [mediaError, setMediaError] = useState('')
  const [search, setSearch] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const updateMessages = (messages: typeof state.privateChat.messages) =>
    updateState((current) => ({
      ...current,
      privateChat: { ...current.privateChat, messages, updatedAt: now() },
    }))
  const send = () => {
    const content = draft.trim()
    if (!content && pendingAttachments.length === 0) return
    updateMessages([
      ...state.privateChat.messages,
      {
        id: id('message'),
        content,
        createdAt: Date.now(),
        attachments: pendingAttachments,
      },
    ])
    setDraft('')
    setPendingAttachments([])
  }

  const addImages = (files: FileList | null) => {
    Array.from(files || []).forEach((file) => {
      if (file.size > 512 * 1024) {
        setMediaError(`${file.name} is larger than the 512 KB image limit.`)
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        setMediaError('')
        setPendingAttachments((current) => [
          ...current,
          {
            id: id('attachment'),
            type: 'image',
            dataUrl: String(reader.result || ''),
            name: file.name,
          },
        ])
      }
      reader.readAsDataURL(file)
    })
  }

  const toggleRecording = async () => {
    if (recording) {
      recorderRef.current?.stop()
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMediaError('Voice recording is not supported by this browser.')
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setMediaError('Microphone access was not granted.')
      return
    }
    const recorder = new MediaRecorder(stream)
    chunksRef.current = []
    recorder.ondataavailable = (event) => chunksRef.current.push(event.data)
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop())
      const recordingBlob = new Blob(chunksRef.current, { type: recorder.mimeType })
      if (recordingBlob.size > 1024 * 1024) {
        setMediaError('Voice note is larger than the 1 MB limit.')
        setRecording(false)
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        setMediaError('')
        setPendingAttachments((current) => [
          ...current,
          {
            id: id('attachment'),
            type: 'audio',
            dataUrl: String(reader.result || ''),
            name: 'Voice note',
          },
        ])
      }
      reader.readAsDataURL(recordingBlob)
      setRecording(false)
    }
    recorderRef.current = recorder
    recorder.start()
    setRecording(true)
  }

  return (
    <Stack spacing={1.5} sx={{ height: '100%', minHeight: 0, p: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Box sx={{ flex: 1 }}>
          <Typography fontWeight={900}>Private Chat</Typography>
          <Typography color="text.secondary" variant="caption">
            Message yourself without AI. Synced with your StudyMesh workspace.
          </Typography>
        </Box>
        <Button
          size="small"
          disabled={!state.privateChat.messages.length}
          onClick={() => {
            const text = state.privateChat.messages
              .map((message) => `[${new Date(message.createdAt).toLocaleString()}] ${message.content}`)
              .join('\n\n')
            const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
            const link = document.createElement('a')
            link.href = url
            link.download = 'studymesh-private-chat.txt'
            link.click()
            URL.revokeObjectURL(url)
          }}
        >
          Export
        </Button>
        {onClose && (
          <IconButton aria-label="Close Private Chat" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        )}
      </Box>
      <Stack spacing={1} sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {state.privateChat.messages
          .filter((message) =>
            message.content.toLowerCase().includes(search.trim().toLowerCase()),
          )
          .map((message) => (
          <Box
            key={message.id}
            sx={{
              alignSelf: 'flex-end',
              maxWidth: '88%',
              p: 1.25,
              borderRadius: 2,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
            }}
          >
            {editingId === message.id ? (
              <TextField
                autoFocus
                multiline
                fullWidth
                value={message.content}
                onChange={(event) =>
                  updateMessages(
                    state.privateChat.messages.map((entry) =>
                      entry.id === message.id
                        ? { ...entry, content: event.target.value, updatedAt: Date.now() }
                        : entry,
                    ),
                  )
                }
                onBlur={() => setEditingId(null)}
              />
            ) : (
              message.content && (
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{message.content}</Typography>
              )
            )}
            {message.attachments?.map((attachment) =>
              attachment.type === 'image' ? (
                <Box
                  key={attachment.id}
                  component="img"
                  src={attachment.dataUrl}
                  alt={attachment.name || 'Private chat image'}
                  sx={{ display: 'block', maxWidth: '100%', maxHeight: 360, borderRadius: 1, mt: 1 }}
                />
              ) : (
                <Box
                  key={attachment.id}
                  component="audio"
                  controls
                  src={attachment.dataUrl}
                  sx={{ display: 'block', maxWidth: '100%', mt: 1 }}
                />
              ),
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
              <Typography variant="caption" sx={{ opacity: 0.8, flex: 1 }}>
                {new Date(message.createdAt).toLocaleString()}
              </Typography>
              <IconButton
                size="small"
                aria-label="Edit message"
                sx={{ color: 'inherit' }}
                onClick={() => setEditingId(message.id)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                aria-label="Delete message"
                sx={{ color: 'inherit' }}
                onClick={() =>
                  updateMessages(
                    state.privateChat.messages.filter(
                      (entry) => entry.id !== message.id,
                    ),
                  )
                }
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
              {message.content && (
                <Button
                  size="small"
                  sx={{ color: 'inherit' }}
                  onClick={() =>
                    updateState((current) => ({
                      ...current,
                      todo: {
                        items: [...current.todo.items, {
                          id: id('todo'),
                          text: message.content,
                          completed: false,
                          createdAt: Date.now(),
                          priority: 'medium',
                        }],
                        updatedAt: now(),
                      },
                    }))
                  }
                >
                  To Todo
                </Button>
              )}
            </Box>
          </Box>
          ))}
      </Stack>
      <TextField
        size="small"
        label="Search private messages"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {pendingAttachments.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto' }}>
          {pendingAttachments.map((attachment) => (
            <Button
              key={attachment.id}
              size="small"
              variant="outlined"
              onClick={() =>
                setPendingAttachments((current) =>
                  current.filter((item) => item.id !== attachment.id),
                )
              }
            >
              {attachment.type === 'image' ? attachment.name : 'Voice note'} x
            </Button>
          ))}
        </Box>
      )}
      {mediaError && (
        <Typography color="error" variant="caption" role="status">
          {mediaError}
        </Typography>
      )}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <IconButton component="label" aria-label="Add images">
          <AttachFileIcon />
          <input hidden multiple type="file" accept="image/*" onChange={(event) => addImages(event.target.files)} />
        </IconButton>
        <IconButton
          aria-label={recording ? 'Stop voice note' : 'Record voice note'}
          color={recording ? 'error' : 'default'}
          onClick={() => void toggleRecording()}
        >
          {recording ? <StopIcon /> : <MicIcon />}
        </IconButton>
        <TextField
          multiline
          maxRows={5}
          fullWidth
          placeholder="Message yourself..."
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              send()
            }
          }}
        />
        <IconButton
          aria-label="Send private message"
          onClick={send}
          sx={{
            width: 56,
            height: 56,
            flex: '0 0 56px',
            alignSelf: 'flex-end',
            borderRadius: '50%',
            color: 'primary.contrastText',
            bgcolor: 'primary.main',
            '&:hover': { bgcolor: 'primary.dark' },
          }}
        >
          <SendIcon />
        </IconButton>
      </Box>
    </Stack>
  )
}
