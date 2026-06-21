/* eslint-disable */
import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from '@mui/material'
import { EditComponentDialogProps } from '../../types/types'
import ChartPreview from '../preview/ChartPreview'
import PieChartEditor from '../editors/PieChartEditor'
import ButtonEditor from '../editors/ButtonEditor'
import SwitchEditor from '../editors/SwitchEditor'
import TextFieldEditor from '../editors/TextFieldEditor'
import LabelEditor from '../editors/LabelEditor'
import FlexBoxEditor from '../editors/FlexBoxEditor'
import GridBoxEditor from '../editors/GridBoxEditor'
import FieldSetEditor from '../editors/FieldSetEditor'
import KnowledgeBlockEditor from '../editors/KnowledgeBlockEditor'
import StudyBlockEditor from '../editors/StudyBlockEditor'
import { isStudyBlockType } from '../../../study/StudyBlockView'

const normalizeQuizBlockProps = (
  props: Record<string, unknown>,
): Record<string, unknown> => {
  const options = Array.isArray(props.options)
    ? props.options.map(String).filter(Boolean).slice(0, 4)
    : []

  while (options.length < 4) {
    options.push(`Option ${String.fromCharCode(65 + options.length)}`)
  }

  const correctIndex = Math.max(0, Math.min(3, Number(props.correctIndex || 0)))

  return {
    ...props,
    __blockType: 'QuizBlock',
    quizMode: 'multi',
    options,
    correctIndex,
    answer: String(props.answer || options[correctIndex] || ''),
  }
}

const normalizeStudyBlockProps = (
  componentType: string,
  props: Record<string, unknown>,
): Record<string, unknown> => {
  if (componentType === 'QuizBlock') {
    return normalizeQuizBlockProps(props)
  }

  if (componentType === 'QuizzSingle') {
    return {
      ...props,
      __blockType: 'QuizzSingle',
      quizMode: 'single',
      options: [],
      correctIndex: 0,
    }
  }

  return props
}

const EditComponentDialog: React.FC<EditComponentDialogProps> = ({
  open,
  component,
  onClose,
  onSave,
}) => {
  const [editedProps, setEditedProps] = useState<Record<string, unknown>>({})
  // For chart preview - parsed data with proper typing
  const [parsedChartData, setParsedChartData] = useState<{
    labels: string[]
    datasets: Array<{
      label: string
      data: number[]
      backgroundColor?: string | string[]
    }>
  }>({
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
    datasets: [
      {
        label: 'Sales',
        data: [30, 20, 15, 25, 10],
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(153, 102, 255, 0.8)',
        ],
      },
    ],
  })

  useEffect(() => {
    if (component) {
      setEditedProps({ ...component.props })

      // Parse chart data if it's a chart component
      if (component.type === 'Chart') {
        try {
          const chartData = (component.props.data as string) || '{}'
          if (chartData.trim().startsWith('<')) {
            // Basic XML parsing logic here if needed
            // For now we'll skip XML support in the live preview
            setParsedChartData({
              labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
              datasets: [
                {
                  label: 'Sales',
                  data: [30, 20, 15, 25, 10],
                  backgroundColor: [
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(255, 206, 86, 0.8)',
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(153, 102, 255, 0.8)',
                  ],
                },
              ],
            })
          } else {
            // Parse JSON data
            const data = JSON.parse(chartData)
            setParsedChartData(data)
          }
        } catch (error) {
          console.error('Error parsing chart data:', error)
          // Set default data on error
          setParsedChartData({
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
            datasets: [
              {
                label: 'Sales',
                data: [30, 20, 15, 25, 10],
                backgroundColor: [
                  'rgba(255, 99, 132, 0.8)',
                  'rgba(54, 162, 235, 0.8)',
                  'rgba(255, 206, 86, 0.8)',
                  'rgba(75, 192, 192, 0.8)',
                  'rgba(153, 102, 255, 0.8)',
                ],
              },
            ],
          })
        }
      }
    }
  }, [component])

  // Update parsed chart data whenever edited props change
  useEffect(() => {
    if (component?.type === 'Chart') {
      try {
        const chartData = (editedProps.data as string) || '{}'
        if (chartData.trim().startsWith('<')) {
          // Skip XML for now in the live preview
        } else if (chartData.trim()) {
          // Only try to parse if there's actual data
          const data = JSON.parse(chartData)
          setParsedChartData(data)
        }
      } catch (error: unknown) {
        // Silently fail during editing - this will happen as user types
        // We'll keep the last valid parsed data
        if (error instanceof Error) {
          console.debug('Invalid JSON format while editing:', error.message)
        }
      }
    }
  }, [editedProps.data, component?.type])

  if (!component) {
    return null
  }

  const handleSave = () => {
    const updatedComponent = {
      ...component,
      props: normalizeStudyBlockProps(component.type, editedProps),
    }
    onSave(updatedComponent)
    onClose()
  }

  // Dedicated handler for prop changes from child editors
  const handlePropsChange = (updatedChildProps: Record<string, unknown>) => {
    setEditedProps((prevProps) => ({
      ...prevProps,
      ...updatedChildProps,
    }))
  }

  const renderPropsEdit = () => {
    if (isStudyBlockType(component.type)) {
      return (
        <StudyBlockEditor
          blockType={component.type}
          props={editedProps}
          onChange={handlePropsChange}
        />
      )
    }

    switch (component.type) {
      case 'SwitchEnable':
        // Pass the new handler
        return <SwitchEditor props={editedProps} onChange={handlePropsChange} />

      case 'FieldSet':
        // Pass the new handler
        return (
          <FieldSetEditor props={editedProps} onChange={handlePropsChange} />
        )

      case 'Label':
        // Pass the new handler
        return <LabelEditor props={editedProps} onChange={handlePropsChange} />

      case 'Button':
        // Pass the new handler
        return <ButtonEditor props={editedProps} onChange={handlePropsChange} />

      case 'TextField':
        // Pass the new handler
        return (
          <TextFieldEditor props={editedProps} onChange={handlePropsChange} />
        )

      case 'FlexBox':
        // Pass the new handler
        return (
          <FlexBoxEditor props={editedProps} onChange={handlePropsChange} />
        )

      case 'GridBox':
        // Pass the new handler
        return (
          <GridBoxEditor props={editedProps} onChange={handlePropsChange} />
        )

      case 'Chart': {
        const isPieChart = Boolean(
          (editedProps.chartType as string)?.toLowerCase() === 'pie' ||
            ((editedProps.data as string) &&
              (editedProps.data as string).includes('"type":"pie"')),
        )

        if (isPieChart) {
          return (
            <PieChartEditor
              initialData={(editedProps.data as string) || '{}'}
              onChange={(jsonData) => handlePropsChange({ data: jsonData })}
              title={(editedProps.title as string) || ''}
              description={(editedProps.description as string) || ''}
              onTitleChange={(title) => handlePropsChange({ title })}
              onDescriptionChange={(description) =>
                handlePropsChange({ description })
              }
            />
          )
        }

        return (
          <Box>
            <Typography variant="body1" sx={{ mb: 2 }}>
              This chart type editor is not yet enhanced with a custom
              interface.
            </Typography>
            <ChartPreview
              chartType="pie"
              title={(editedProps.title as string) || ''}
              description={(editedProps.description as string) || ''}
              data={parsedChartData}
            />
          </Box>
        )
      }
      case 'LongText':
      case 'ListBlock':
      case 'TableBlock':
      case 'ImageBlock':
      case 'PdfBlock':
        return (
          <KnowledgeBlockEditor
            props={editedProps}
            onChange={handlePropsChange}
          />
        )

      default:
        return <Typography>No editable properties</Typography>
    }
  }

  // Get the title text for the dialog
  const getDialogTitle = () => {
    if (isStudyBlockType(component.type)) {
      return `Edit ${component.type.replace('Block', '')}`
    }

    switch (component.type) {
      case 'SwitchEnable':
        return 'Edit Switch'
      case 'FieldSet':
        return 'Edit Field Set'
      case 'Label':
        return 'Edit Text Label'
      case 'Button':
        return 'Edit Button'
      case 'TextField':
        return 'Edit Text Field'
      case 'FlexBox':
        return 'Edit Flex Container'
      case 'GridBox':
        return 'Edit Grid Container'
      case 'Chart':
        return 'Edit Chart'
      case 'LongText':
        return 'Edit Long Text'
      case 'ListBlock':
        return 'Edit List'
      case 'TableBlock':
        return 'Edit Table'
      case 'ImageBlock':
        return 'Edit Image'
      case 'PdfBlock':
        return 'Edit PDF'
      default:
        return `Edit ${component.type}`
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '90dvh',
        },
      }}
    >
      <DialogTitle>{getDialogTitle()}</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {renderPropsEdit()}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          color="primary"
          data-onboarding-id="component-dialog-save"
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default EditComponentDialog
