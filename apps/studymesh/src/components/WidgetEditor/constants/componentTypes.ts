import TextFieldsIcon from '@mui/icons-material/TextFields'
import InputIcon from '@mui/icons-material/Input'
import SmartButtonIcon from '@mui/icons-material/SmartButton'
import ToggleOnIcon from '@mui/icons-material/ToggleOn'
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt'
import FlexibleIcon from '@mui/icons-material/Dashboard'
import GridViewIcon from '@mui/icons-material/GridView'
import PieChartIcon from '@mui/icons-material/PieChart'
import ImageIcon from '@mui/icons-material/Image'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import SubjectIcon from '@mui/icons-material/Subject'
import TableChartIcon from '@mui/icons-material/TableChart'
import StyleIcon from '@mui/icons-material/Style'
import QuizIcon from '@mui/icons-material/Quiz'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import AutoStoriesIcon from '@mui/icons-material/AutoStories'
import CodeIcon from '@mui/icons-material/Code'
import { ComponentType } from '../types/types'

// Building blocks that can be added to a widget.
export const COMPONENT_TYPES: ComponentType[] = [
  // UI Components
  {
    type: 'Label',
    label: 'Display Text',
    defaultProps: { text: 'Display Text' },
    category: 'UI Components',
    icon: TextFieldsIcon,
    tooltip: 'Shows a short piece of text, such as a title, status, or note.',
  },
  {
    type: 'TextField',
    label: 'Answer Box',
    defaultProps: {
      label: 'Answer Box',
      placeholder: 'Enter text...',
      defaultValue: '',
    },
    category: 'UI Components',
    icon: InputIcon,
    tooltip: 'Lets someone type a value, note, or answer into the widget.',
  },
  {
    type: 'Button',
    label: 'Button',
    defaultProps: {
      text: 'Button',
      variant: 'contained',
      clickAction: 'none',
      chartLabelSource: 'static',
      chartValueSource: 'static',
      chartLabel: 'New value',
      chartValue: 1,
    },
    category: 'UI Components',
    icon: SmartButtonIcon,
    tooltip:
      'Adds a button for actions like confirming a step, opening a link, or showing a message.',
  },
  {
    type: 'SwitchEnable',
    label: 'Switch',
    defaultProps: { label: 'Switch', defaultChecked: false },
    category: 'UI Components',
    icon: ToggleOnIcon,
    tooltip:
      'Adds a simple on/off choice, such as Enabled, Open, or Needs review.',
  },
  {
    type: 'Chart',
    label: 'Pie Chart',
    defaultProps: {
      title: '',
      chartType: 'pie',
      height: 400,
      description: '',
      data: `{
        "labels": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        "datasets": [
          {
            "data": [30, 20, 15, 25, 10, 5],
            "backgroundColor": [
              "rgba(255, 99, 132, 0.8)",
              "rgba(54, 162, 235, 0.8)",
              "rgba(255, 206, 86, 0.8)",
              "rgba(75, 192, 192, 0.8)",
              "rgba(153, 102, 255, 0.8)",
              "rgba(255, 159, 64, 0.8)"
            ]
          }
        ]
      }`,
    },
    category: 'UI Components',
    icon: PieChartIcon,
    tooltip:
      'Shows a pie chart for simple breakdowns, such as ticket types or incident causes.',
  },
  {
    type: 'LongText',
    label: 'Long Text',
    defaultProps: {
      __blockType: 'LongText',
      title: 'Study note',
      text: 'Write a longer explanation, theorem, research note, or lesson summary here.',
      callout: true,
    },
    category: 'Knowledge Blocks',
    icon: SubjectIcon,
    tooltip:
      'Adds a larger note block for explanations, study summaries, or wiki-style writing.',
  },
  {
    type: 'FlashcardBlock',
    label: 'Flashcard',
    defaultProps: {
      __blockType: 'FlashcardBlock',
      front: 'Question or term',
      back: 'Answer or explanation',
      hint: '',
      tag: '',
      selfGrade: true,
    },
    category: 'Study Blocks',
    icon: StyleIcon,
    tooltip:
      'Adds a flip card for active recall, with a question on the front and answer on the back.',
  },
  {
    type: 'QuizBlock',
    label: 'Quiz',
    defaultProps: {
      __blockType: 'QuizBlock',
      quizMode: 'multi',
      question: 'Question',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctIndex: 0,
      answer: 'Option A',
      explanation: 'Explain why the answer is correct.',
      hint: '',
      optionFeedback: [],
      shuffleOptions: false,
    },
    category: 'Study Blocks',
    icon: QuizIcon,
    tooltip:
      'Adds a multiple-choice quiz with exactly four selectable answers.',
  },
  {
    type: 'QuizzSingle',
    label: 'Quiz Single',
    defaultProps: {
      __blockType: 'QuizzSingle',
      quizMode: 'single',
      question: 'Question',
      answer: 'Expected answer',
      explanation: 'Explain why the answer is correct.',
    },
    category: 'Study Blocks',
    icon: QuizIcon,
    tooltip: 'Adds a typed-answer quiz with an answer box.',
  },
  {
    type: 'StudyNoteBlock',
    label: 'Study Note',
    defaultProps: {
      __blockType: 'StudyNoteBlock',
      title: 'Study note',
      text: 'Raw study note text',
      suggestedTypes: ['definition', 'flashcard', 'review'],
    },
    category: 'Study Blocks',
    icon: AutoStoriesIcon,
    tooltip:
      'Adds a flexible study note with suggested ways to turn it into study material.',
  },
  {
    type: 'MarkdownBlock',
    label: 'Markdown',
    defaultProps: {
      __blockType: 'MarkdownBlock',
      title: 'Markdown notes',
      markdown:
        '# Study notes\n\n## Topic\n\nWrite Markdown notes with lists, tables, links, and code blocks.',
    },
    category: 'Study Blocks',
    icon: AutoStoriesIcon,
    tooltip:
      'Adds a rendered Markdown note block for imported .md files or pasted Markdown.',
  },
  {
    type: 'CodeBlock',
    label: 'Code Note',
    defaultProps: {
      __blockType: 'CodeBlock',
      title: 'Code note',
      code: 'location / {\n  root /var/www/example.com;\n  index index.html index.htm;\n}',
      language: 'text',
      caption: '',
    },
    category: 'Study Blocks',
    icon: CodeIcon,
    tooltip:
      'Adds a formatted code or configuration snippet for technical notes.',
  },
  {
    type: 'DefinitionBlock',
    label: 'Definition',
    defaultProps: {
      __blockType: 'DefinitionBlock',
      term: 'Term',
      definition: 'Definition',
      example: '',
      makeFlashcard: true,
    },
    category: 'Study Blocks',
    icon: MenuBookIcon,
    tooltip:
      'Adds a term and definition card that can also be studied like a flashcard.',
  },
  {
    type: 'ComparisonBlock',
    label: 'Comparison',
    defaultProps: {
      __blockType: 'ComparisonBlock',
      title: 'Comparison',
      columns: ['Item A', 'Item B'],
      rows: [
        ['Point about A', 'Point about B'],
        ['Another point about A', 'Another point about B'],
      ],
    },
    category: 'Study Blocks',
    icon: CompareArrowsIcon,
    tooltip: 'Compares concepts, tools, people, events, or ideas.',
  },
  {
    type: 'ReviewPromptBlock',
    label: 'Review Prompt',
    defaultProps: {
      __blockType: 'ReviewPromptBlock',
      title: 'Review this',
      prompt: 'Topic to review',
      reason: '',
      status: 'needsReview',
    },
    category: 'Study Blocks',
    icon: ReportProblemIcon,
    tooltip:
      'Marks something as important, confusing, or worth reviewing later.',
  },
  {
    type: 'ListBlock',
    label: 'List',
    defaultProps: {
      __blockType: 'ListBlock',
      title: 'Key ideas',
      items: 'Definition\nExample\nPractice question',
      ordered: false,
      interactiveChecklist: false,
    },
    category: 'Knowledge Blocks',
    icon: FormatListBulletedIcon,
    tooltip:
      'Adds a clean list for concepts, steps, references, or quick study bullets.',
  },
  {
    type: 'TableBlock',
    label: 'Table',
    defaultProps: {
      __blockType: 'TableBlock',
      title: 'Reference table',
      headers: ['Concept', 'Definition', 'Example'],
      rows: [
        ['Term', 'Short explanation', 'Use case'],
        ['Related idea', 'How it connects', 'Practice note'],
      ],
    },
    category: 'Knowledge Blocks',
    icon: TableChartIcon,
    tooltip:
      'Adds a structured table for comparisons, definitions, references, or study data.',
  },
  {
    type: 'ImageBlock',
    label: 'Image',
    defaultProps: {
      __blockType: 'ImageBlock',
      src: '',
      alt: 'Knowledge image',
      caption: 'Diagram or reference image',
      maxHeight: 260,
    },
    category: 'Knowledge Blocks',
    icon: ImageIcon,
    tooltip: 'Adds an image/diagram block using an image URL.',
  },
  {
    type: 'PdfBlock',
    label: 'PDF',
    defaultProps: {
      __blockType: 'PdfBlock',
      src: '',
      title: 'Reference PDF',
      height: 420,
    },
    category: 'Knowledge Blocks',
    icon: PictureAsPdfIcon,
    tooltip: 'Embeds a PDF reference by URL, with an open-link fallback.',
  },

  // Layout Containers
  {
    type: 'FieldSet',
    label: 'Grouped Section',
    defaultProps: { legend: 'Grouped Section', collapsed: false },
    category: 'Layout Containers',
    icon: ViewQuiltIcon,
    tooltip:
      'Groups related items under one heading. It can be opened or collapsed.',
  },
  {
    type: 'FlexBox',
    label: 'Flexible Group',
    defaultProps: {
      direction: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      spacing: 0,
      wrap: 'wrap',
    },
    category: 'Layout Containers',
    icon: FlexibleIcon,
    tooltip:
      'Places items next to each other or stacks them, with simple spacing controls.',
  },
  {
    type: 'GridBox',
    label: 'Grid Group',
    defaultProps: {
      columns: 2,
      rows: 1,
      spacing: 2,
    },
    category: 'Layout Containers',
    icon: GridViewIcon,
    tooltip: 'Arranges items into clear columns, like cards on a dashboard.',
  },
]

/**
 * Get a component icon by type
 */
export const getComponentIcon = (type: string) => {
  const componentType = COMPONENT_TYPES.find((c) => c.type === type)
  return componentType?.icon || null
}

/**
 * Get components organized by category
 */
export const getComponentsByCategory = () => {
  const categories: Record<string, ComponentType[]> = {}

  COMPONENT_TYPES.forEach((component) => {
    if (!categories[component.category]) {
      categories[component.category] = []
    }
    categories[component.category].push(component)
  })

  return categories
}
