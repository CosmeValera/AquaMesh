import React, { useState, useRef, useCallback } from 'react'
import { 
  Box, 
  Typography, 
  Paper, 
  IconButton, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemSecondaryAction,
  CircularProgress,
  Tooltip,
  FormHelperText
} from '@mui/material'
import { styled } from '@mui/material/styles'
import DeleteIcon from '@mui/icons-material/Delete'
import VisibilityIcon from '@mui/icons-material/Visibility'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import UploadFileIcon from '@mui/icons-material/UploadFile'

// Styled components
const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
})

// Styled drop zone
const DropZone = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isDragging' && prop !== 'isDisabled'
})<{ isDragging: boolean; isDisabled: boolean }>(({ isDragging, isDisabled, theme }) => ({
  width: '100%',
  border: `2px dashed ${isDragging ? theme.palette.primary.main : theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: isDragging 
    ? `${theme.palette.primary.main}0D`  // 5% opacity version of primary color
    : isDisabled 
      ? theme.palette.action.disabledBackground 
      : theme.palette.background.paper,
  padding: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: isDisabled ? 'not-allowed' : 'pointer',
  transition: 'all 0.2s ease-in-out',
  marginBottom: theme.spacing(2),
  '&:hover': {
    borderColor: !isDisabled && theme.palette.primary.main,
    backgroundColor: !isDisabled && `${theme.palette.primary.main}0D`
  }
}))

// File type interface
interface FileData {
  id: string
  name: string
  type: string
  size: number
  url: string
  file: File
}

// Props interface
interface DataUploadProps {
  label: string
  acceptedFileTypes: string
  maxFileSize: number // in MB
  allowMultiple: boolean
  helperText?: string
  onChange?: (files: FileData[]) => void
}

/**
 * DataUpload Component for the Widget Editor
 * Allows uploading and managing various file types including PDFs and images
 */
const DataUpload: React.FC<DataUploadProps> = ({
  label = 'Upload File',
  acceptedFileTypes = 'image/*,application/pdf',
  maxFileSize = 5, // Default 5MB
  allowMultiple = false,
  helperText,
  onChange
}) => {
  const [files, setFiles] = useState<FileData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // Process files function - used by both drag/drop and file input
  const processFiles = useCallback((uploadedFiles: FileList | File[]) => {
    if (!uploadedFiles || uploadedFiles.length === 0) {
      return
    }

    setLoading(true)
    setError(null)

    const newFiles: FileData[] = []
    const filePromises: Promise<void>[] = []
    
    // Validate file types
    const acceptedTypes = acceptedFileTypes.split(',')
    const fileArray = Array.from(uploadedFiles)

    fileArray.forEach(file => {
      // Check file size
      if (file.size > maxFileSize * 1024 * 1024) {
        setError(`File ${file.name} exceeds the maximum size of ${maxFileSize}MB`)
        return
      }

      // Check file type
      const fileType = file.type
      const isValidType = acceptedTypes.some(type => {
        if (type.includes('*')) {
          // Handle wildcard types like image/*
          const typePrefix = type.split('*')[0]
          return fileType.startsWith(typePrefix)
        }
        return type === fileType
      })

      if (!isValidType && acceptedTypes[0] !== '*') {
        setError(`File ${file.name} is not a valid file type. Accepted: ${acceptedFileTypes}`)
        return
      }

      // Read file
      const promise = new Promise<void>((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const result = e.target?.result as string
          newFiles.push({
            id: `file-${Date.now()}-${file.name}`,
            name: file.name,
            type: file.type,
            size: file.size,
            url: result,
            file
          })
          resolve()
        }
        reader.readAsDataURL(file)
      })

      filePromises.push(promise)
    })

    Promise.all(filePromises).then(() => {
      const updatedFiles = allowMultiple ? [...files, ...newFiles] : newFiles
      setFiles(updatedFiles)
      if (onChange) {
        onChange(updatedFiles)
      }
      setLoading(false)
      
      // Clear the input value to allow re-uploading the same file if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    })
  }, [files, allowMultiple, maxFileSize, acceptedFileTypes, onChange])

  // Handle file upload from input
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      processFiles(event.target.files)
    }
  }

  // Handle file deletion
  const handleDeleteFile = (id: string) => {
    const updatedFiles = files.filter(file => file.id !== id)
    setFiles(updatedFiles)
    if (onChange) {
      onChange(updatedFiles)
    }
    
    // Clear preview if the previewed file was deleted
    if (previewUrl && !updatedFiles.some(file => file.url === previewUrl)) {
      setPreviewUrl(null)
    }
  }

  // Handle file preview
  const handlePreviewFile = (file: FileData) => {
    setPreviewUrl(file.url)
  }

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) {
      return bytes + ' B'
    } else if (bytes < 1048576) {
      return (bytes / 1024).toFixed(1) + ' KB'
    } else {
      return (bytes / 1048576).toFixed(1) + ' MB'
    }
  }

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!loading) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!loading) {
      setIsDragging(true)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    
    if (loading) {
      return
    }
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files)
    }
  }

  // Handle click on drop zone
  const handleDropZoneClick = () => {
    if (!loading && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  // Get accepted file extensions for display
  const getFileTypesDisplay = (): string => {
    return acceptedFileTypes
      .split(',')
      .map(type => {
        if (type === 'image/*') {
          return 'Images'
        }
        if (type === 'application/pdf') {
          return 'PDFs'
        }
        if (type.includes('/')) {
          return type.split('/')[1].toUpperCase()
        }
        return type
      })
      .join(', ')
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Drag & Drop Zone */}
      <DropZone
        ref={dropZoneRef}
        isDragging={isDragging}
        isDisabled={loading}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleDropZoneClick}
      >
        {loading ? (
          <CircularProgress size={32} sx={{ mb: 1 }} />
        ) : (
          <UploadFileIcon fontSize="large" color="primary" sx={{ mb: 1, opacity: 0.8 }} />
        )}
        <Typography variant="body1" sx={{ mb: 0.5 }}>
          {isDragging ? 'Drop files here' : label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {isDragging 
            ? `Accepts ${getFileTypesDisplay()}` 
            : `Drag & drop or click to browse (${getFileTypesDisplay()})`}
        </Typography>
        <VisuallyHiddenInput 
          ref={fileInputRef}
          type="file" 
          accept={acceptedFileTypes}
          multiple={allowMultiple}
          onChange={handleFileUpload}
          disabled={loading}
        />
      </DropZone>
      
      {/* Helper Text */}
      {helperText && (
        <FormHelperText sx={{ mb: 1 }}>{helperText}</FormHelperText>
      )}
      
      {/* Error Message */}
      {error && (
        <Typography color="error" variant="body2" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}
      
      {/* File Preview */}
      {previewUrl && (
        <Paper 
          elevation={2} 
          sx={{ 
            p: 1, 
            mb: 2, 
            maxHeight: '300px', 
            overflow: 'auto',
            display: 'flex',
            justifyContent: 'center',
            position: 'relative'
          }}
        >
          <IconButton 
            size="small" 
            onClick={() => setPreviewUrl(null)}
            sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(255,255,255,0.7)' }}
          >
            <DeleteIcon />
          </IconButton>
          {previewUrl.startsWith('data:image') ? (
            <img 
              src={previewUrl} 
              alt="Preview" 
              style={{ maxWidth: '100%', maxHeight: '280px', objectFit: 'contain' }} 
            />
          ) : previewUrl.startsWith('data:application/pdf') ? (
            <Box sx={{ textAlign: 'center', p: 2 }}>
              <PictureAsPdfIcon fontSize="large" />
              <Typography variant="body2" sx={{ mt: 1 }}>
                PDF Preview not available. <a href={previewUrl} target="_blank" rel="noopener noreferrer">Open PDF</a>
              </Typography>
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', p: 2 }}>
              <InsertDriveFileIcon fontSize="large" />
              <Typography variant="body2" sx={{ mt: 1 }}>
                File Preview not available
              </Typography>
            </Box>
          )}
        </Paper>
      )}
      
      {/* File List */}
      {files.length > 0 && (
        <Paper elevation={1} sx={{ mb: 2 }}>
          <List dense>
            {files.map((file) => (
              <ListItem key={file.id}>
                <ListItemText
                  primary={file.name}
                  secondary={formatFileSize(file.size)}
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                  sx={{ mr: 8 }} // Make room for the actions
                />
                <ListItemSecondaryAction>
                  <Tooltip title="Preview">
                    <IconButton 
                      edge="end" 
                      size="small"
                      onClick={() => handlePreviewFile(file)}
                      sx={{ mr: 1 }}
                    >
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton 
                      edge="end" 
                      size="small"
                      onClick={() => handleDeleteFile(file.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  )
}

export default DataUpload 