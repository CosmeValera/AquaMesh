import React, { useState, useCallback, useMemo } from 'react'
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Chip,
  LinearProgress,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slider,
  FormControlLabel,
  Switch,
  Tooltip,
  Collapse,
  Divider,
} from '@mui/material'
import {
  Quiz as QuizIcon,
  CheckCircle as CorrectIcon,
  Cancel as WrongIcon,
  Lightbulb as HintIcon,
  Timer as TimerIcon,
  Settings as SettingsIcon,
  Close as CloseIcon,
  Refresh as RegenerateIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  ContentCopy as CopyIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
} from '@mui/icons-material'
import { alpha } from '@mui/material/styles'

// ============================================================================
// Types
// ============================================================================

export type QuestionType = 'multiple-choice' | 'true-false' | 'fill-blank' | 'short-answer' | 'matching'

export interface QuizQuestion {
  id: string
  type: QuestionType
  question: string
  options?: string[] // for multiple choice
  correctAnswer: string | number // index for MC, string for others
  explanation?: string
  hint?: string
  difficulty: 'easy' | 'medium' | 'hard'
  points: number
  tags: string[]
  // For matching type
  matchPairs?: { left: string; right: string }[]
}

export interface QuizConfig {
  questionCount: number // 5 - 50
  questionTypes: QuestionType[]
  difficulty: 'balanced' | 'easy' | 'medium' | 'hard'
  includeHints: boolean
  includeExplanations: boolean
  timeLimit?: number // minutes, 0 = no limit
  shuffleQuestions: boolean
  shuffleOptions: boolean
  subject?: string
}

export interface QuizResult {
  quizId: string
  answers: Record<string, string | number>
  score: number
  totalPoints: number
  timeTaken: number // seconds
  completedAt: Date
}

export interface GeneratedQuiz {
  id: string
  title: string
  description: string
  config: QuizConfig
  questions: QuizQuestion[]
  createdAt: Date
  sourceMaterial?: string // context from which quiz was generated
}

const defaultQuizConfig: QuizConfig = {
  questionCount: 10,
  questionTypes: ['multiple-choice', 'true-false', 'fill-blank'],
  difficulty: 'balanced',
  includeHints: true,
  includeExplanations: true,
  timeLimit: 0,
  shuffleQuestions: false,
  shuffleOptions: true,
  subject: '',
}

// ============================================================================
// Mock AI Quiz Generator
// ============================================================================

// This would call an AI in production
function generateQuestionsFromContent(
  content: string,
  config: QuizConfig,
): QuizQuestion[] {
  const questions: QuizQuestion[] = []
  const topics = content.split('\n\n').filter((t) => t.trim())

  // Generate questions based on available content
  const sampleMCQs = [
    { q: 'What is the primary goal of machine learning?', opts: ['Make computers think like humans', 'Allow systems to learn from data', 'Replace all human jobs', 'Create faster computers'], a: 1, d: 'medium' as const },
    { q: 'Which algorithm is commonly used for classification problems?', opts: ['Linear Regression', 'Decision Trees', 'K-Means', 'PCA'], a: 1, d: 'medium' as const },
    { q: 'What does "overfitting" mean in machine learning?', opts: ['Model performs well on training but poorly on new data', 'Model trains too slowly', 'Not enough data available', 'Too many features selected'], a: 0, d: 'medium' as const },
    { q: 'What is the purpose of a validation set?', opts: ['To test final model performance', 'To tune hyperparameters and prevent overfitting', 'To train the model', 'To clean the data'], a: 1, d: 'hard' as const },
    { q: 'Which technique helps prevent overfitting?', opts: ['Increase model complexity', 'Add more features', 'Regularization', 'Use more data'], a: 2, d: 'medium' as const },
  ]

  const sampleTF = [
    { q: 'Neural networks are inspired by the structure of the human brain.', a: true, d: 'easy' as const },
    { q: 'Gradient descent always finds the global minimum.', a: false, d: 'hard' as const },
    { q: 'Cross-validation helps estimate model performance on unseen data.', a: true, d: 'medium' as const },
    { q: 'More training data always leads to better model performance.', a: false, d: 'medium' as const },
    { q: 'Feature scaling is optional for distance-based algorithms.', a: false, d: 'medium' as const },
  ]

  const sampleFill = [
    { q: 'The _______ is a measure of how well a model generalizes to new data.', a: 'generalization', d: 'medium' as const },
    { q: '_______ learning uses labeled data to train models.', a: 'Supervised', d: 'easy' as const },
    { q: 'A _______ is the smallest unit in a neural network.', a: 'neuron', d: 'easy' as const },
    { q: 'The _______ error measures performance on training data.', a: 'training', d: 'medium' as const },
    { q: '_______ is used to estimate performance on unseen data.', a: 'Cross-validation', d: 'hard' as const },
  ]

  let idCounter = 1

  // Add multiple choice questions
  if (config.questionTypes.includes('multiple-choice')) {
    const mcCount = Math.min(sampleMCQs.length, Math.ceil(config.questionCount * 0.4))
    for (let i = 0; i < mcCount; i++) {
      questions.push({
        id: `q-${idCounter++}`,
        type: 'multiple-choice',
        question: sampleMCQs[i].q,
        options: sampleMCQs[i].opts,
        correctAnswer: sampleMCQs[i].a,
        explanation: `The correct answer is: ${sampleMCQs[i].opts[sampleMCQs[i].a]}`,
        hint: 'Think about the core concepts of machine learning',
        difficulty: sampleMCQs[i].d,
        points: sampleMCQs[i].d === 'easy' ? 5 : sampleMCQs[i].d === 'medium' ? 10 : 15,
        tags: ['machine-learning', 'fundamentals'],
      })
    }
  }

  // Add true/false questions
  if (config.questionTypes.includes('true-false')) {
    const tfCount = Math.min(sampleTF.length, Math.ceil(config.questionCount * 0.3))
    for (let i = 0; i < tfCount; i++) {
      questions.push({
        id: `q-${idCounter++}`,
        type: 'true-false',
        question: sampleTF[i].q,
        options: ['True', 'False'],
        correctAnswer: sampleTF[i].a ? 0 : 1,
        explanation: sampleTF[i].a ? 'This statement is correct.' : 'This statement is incorrect.',
        difficulty: sampleTF[i].d,
        points: sampleTF[i].d === 'easy' ? 5 : sampleTF[i].d === 'medium' ? 10 : 15,
        tags: ['machine-learning', 'concepts'],
      })
    }
  }

  // Add fill in the blank questions
  if (config.questionTypes.includes('fill-blank')) {
    const fbCount = Math.min(sampleFill.length, Math.ceil(config.questionCount * 0.3))
    for (let i = 0; i < fbCount; i++) {
      questions.push({
        id: `q-${idCounter++}`,
        type: 'fill-blank',
        question: sampleFill[i].q,
        correctAnswer: sampleFill[i].a,
        explanation: `The correct answer is: ${sampleFill[i].a}`,
        hint: 'Consider the context of machine learning terminology',
        difficulty: sampleFill[i].d,
        points: sampleFill[i].d === 'easy' ? 5 : sampleFill[i].d === 'medium' ? 10 : 15,
        tags: ['machine-learning', 'vocabulary'],
      })
    }
  }

  // Add short answer questions
  if (config.questionTypes.includes('short-answer')) {
    const saQuestions = [
      { q: 'Explain the difference between supervised and unsupervised learning.', d: 'hard' as const },
      { q: 'What is the purpose of the activation function in neural networks?', d: 'medium' as const },
      { q: 'Describe what overfitting is and how to prevent it.', d: 'medium' as const },
    ]
    const saCount = Math.min(saQuestions.length, Math.ceil(config.questionCount * 0.2))
    for (let i = 0; i < saCount; i++) {
      questions.push({
        id: `q-${idCounter++}`,
        type: 'short-answer',
        question: saQuestions[i].q,
        correctAnswer: 'Sample answer provided in explanation',
        explanation: 'Key points: supervised uses labeled data, unsupervised finds patterns without labels.',
        difficulty: saQuestions[i].d,
        points: 20,
        tags: ['machine-learning', 'theory'],
      })
    }
  }

  // Shuffle if needed
  if (config.shuffleQuestions) {
    questions.sort(() => Math.random() - 0.5)
  }

  return questions.slice(0, config.questionCount)
}

// ============================================================================
// Quiz Card Component
// ============================================================================

interface QuizCardProps {
  question: QuizQuestion
  questionNumber: number
  showAnswer: boolean
  userAnswer?: string | number
  onAnswer: (answer: string | number) => void
  onToggleHint: () => void
  onToggleExplanation: () => void
  isExpanded: boolean
  onToggleExpand: () => void
}

const QuizCard: React.FC<QuizCardProps> = ({
  question,
  questionNumber,
  showAnswer,
  userAnswer,
  onAnswer,
  onToggleHint,
  onToggleExplanation,
  isExpanded,
  onToggleExpand,
}) => {
  const difficultyColors = {
    easy: '#4CAF50',
    medium: '#FF9800',
    hard: '#F44336',
  }

  return (
    <Paper
      elevation={2}
      sx={{
        mb: 2,
        overflow: 'hidden',
        borderLeft: `4px solid ${difficultyColors[question.difficulty]}`,
      }}
    >
      {/* Question Header */}
      <Box
        sx={{
          p: 2,
          bgcolor: 'grey.50',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
        onClick={onToggleExpand}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            Q{questionNumber}.
          </Typography>
          <Chip
            label={question.type.replace('-', ' ')}
            size="small"
            sx={{ fontSize: '0.65rem', textTransform: 'capitalize' }}
          />
          <Chip
            label={question.difficulty}
            size="small"
            sx={{
              fontSize: '0.65rem',
              bgcolor: difficultyColors[question.difficulty],
              color: 'white',
              textTransform: 'capitalize',
            }}
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {question.points} pts
          </Typography>
          {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
        </Box>
      </Box>

      {/* Question Body */}
      <Box sx={{ p: 2 }}>
        <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
          {question.question}
        </Typography>

        {/* Multiple Choice */}
        {question.type === 'multiple-choice' && question.options && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {question.options.map((opt, idx) => {
              const isCorrect = idx === question.correctAnswer
              const isSelected = userAnswer === idx
              let bgColor = 'transparent'
              if (showAnswer) {
                bgColor = isCorrect ? 'success.50' : isSelected ? 'error.50' : 'transparent'
              } else if (isSelected) {
                bgColor = 'primary.50'
              }

              return (
                <Box
                  key={idx}
                  onClick={() => !showAnswer && onAnswer(idx)}
                  sx={{
                    p: 1.5,
                    border: '2px solid',
                    borderColor: isSelected && !showAnswer ? 'primary.main' : 'divider',
                    borderRadius: 1,
                    bgcolor: bgColor,
                    cursor: showAnswer ? 'default' : 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': showAnswer ? {} : { borderColor: 'primary.light', bgcolor: 'grey.50' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          border: '2px solid',
                          borderColor: isSelected ? 'primary.main' : 'grey.400',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          bgcolor: isSelected ? 'primary.main' : 'transparent',
                          color: isSelected ? 'white' : 'text.secondary',
                        }}
                      >
                        {String.fromCharCode(65 + idx)}
                      </Box>
                      <Typography variant="body2">{opt}</Typography>
                    </Box>
                    {showAnswer && (
                      <Box>
                        {isCorrect && <CorrectIcon color="success" fontSize="small" />}
                        {!isCorrect && isSelected && <WrongIcon color="error" fontSize="small" />}
                      </Box>
                    )}
                  </Box>
                </Box>
              )
            })}
          </Box>
        )}

        {/* True/False */}
        {question.type === 'true-false' && (
          <Box sx={{ display: 'flex', gap: 2 }}>
            {['True', 'False'].map((opt, idx) => {
              const isCorrect = (idx === 0) === question.correctAnswer
              const isSelected = userAnswer === idx
              let bgColor = 'transparent'
              if (showAnswer) {
                bgColor = isCorrect ? 'success.50' : isSelected ? 'error.50' : 'transparent'
              }

              return (
                <Button
                  key={opt}
                  variant={isSelected && !showAnswer ? 'contained' : 'outlined'}
                  onClick={() => !showAnswer && onAnswer(idx)}
                  disabled={showAnswer}
                  sx={{ flex: 1, py: 2 }}
                  color={showAnswer ? (isCorrect ? 'success' : isSelected ? 'error' : 'primary') : 'primary'}
                >
                  {opt}
                </Button>
              )
            })}
          </Box>
        )}

        {/* Fill in the blank */}
        {question.type === 'fill-blank' && (
          <Box>
            <TextField
              fullWidth
              placeholder="Type your answer..."
              value={userAnswer || ''}
              onChange={(e) => !showAnswer && onAnswer(e.target.value)}
              disabled={showAnswer}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: showAnswer
                    ? String(userAnswer).toLowerCase() === String(question.correctAnswer).toLowerCase()
                      ? 'success.50'
                      : 'error.50'
                    : 'grey.50',
                },
              }}
            />
            {showAnswer && (
              <Box sx={{ mt: 1, p: 1, bgcolor: 'success.50', borderRadius: 1 }}>
                <Typography variant="caption" color="success.main">
                  Correct answer: {question.correctAnswer}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Short Answer */}
        {question.type === 'short-answer' && (
          <TextField
            fullWidth
            multiline
            rows={3}
            placeholder="Type your answer..."
            value={userAnswer || ''}
            onChange={(e) => !showAnswer && onAnswer(e.target.value)}
            disabled={showAnswer}
          />
        )}

        {/* Hint */}
        {question.hint && !showAnswer && (
          <Box sx={{ mt: 2 }}>
            <Button
              size="small"
              startIcon={<HintIcon />}
              onClick={onToggleHint}
              sx={{ color: 'text.secondary' }}
            >
              Show Hint
            </Button>
            <Collapse in={false}>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                {question.hint}
              </Typography>
            </Collapse>
          </Box>
        )}

        {/* Explanation (shown after answer) */}
        {showAnswer && question.explanation && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'info.50', borderRadius: 1, border: '1px solid', borderColor: 'info.main' }}>
            <Typography variant="subtitle2" color="info.main" gutterBottom>
              💡 Explanation
            </Typography>
            <Typography variant="body2">{question.explanation}</Typography>
          </Box>
        )}
      </Box>
    </Paper>
  )
}

// ============================================================================
// Main Quiz Generator Panel
// ============================================================================

interface QuizGeneratorPanelProps {
  sourceMaterial?: string
  onQuizGenerated?: (quiz: GeneratedQuiz) => void
  onClose?: () => void
}

const QuizGeneratorPanel: React.FC<QuizGeneratorPanelProps> = ({
  sourceMaterial = 'Machine Learning is a subset of AI that enables systems to learn from data. Neural networks are inspired by the human brain. Deep learning uses multiple layers. Overfitting occurs when a model performs well on training but poorly on new data. Regularization helps prevent overfitting.',
  onQuizGenerated,
  onClose,
}) => {
  const [config, setConfig] = useState<QuizConfig>(defaultQuizConfig)
  const [generatedQuiz, setGeneratedQuiz] = useState<GeneratedQuiz | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string | number>>({})
  const [showHint, setShowHint] = useState<string | null>(null)
  const [quizComplete, setQuizComplete] = useState(false)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)

  // Timer effect
  React.useEffect(() => {
    if (startTime && !quizComplete) {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [startTime, quizComplete])

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)

    // Simulate AI generation delay
    await new Promise((r) => setTimeout(r, 1500))

    const questions = generateQuestionsFromContent(sourceMaterial, config)

    const quiz: GeneratedQuiz = {
      id: `quiz-${Date.now()}`,
      title: config.subject ? `Quiz: ${config.subject}` : 'AI-Generated Quiz',
      description: `A ${config.difficulty} difficulty quiz with ${questions.length} questions`,
      config,
      questions,
      createdAt: new Date(),
      sourceMaterial,
    }

    setGeneratedQuiz(quiz)
    setIsGenerating(false)
    setCurrentQuestion(0)
    setAnswers({})
    setShowAnswer(false)
    setQuizComplete(false)
    setStartTime(Date.now())
    setElapsedTime(0)

    onQuizGenerated?.(quiz)
  }, [config, sourceMaterial, onQuizGenerated])

  const handleAnswer = useCallback((questionId: string, answer: string | number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }))
  }, [])

  const handleNext = useCallback(() => {
    if (currentQuestion < (generatedQuiz?.questions.length || 0) - 1) {
      setCurrentQuestion((c) => c + 1)
      setShowAnswer(false)
      setShowHint(null)
    } else {
      setQuizComplete(true)
    }
  }, [currentQuestion, generatedQuiz])

  const handlePrev = useCallback(() => {
    if (currentQuestion > 0) {
      setCurrentQuestion((c) => c - 1)
      setShowAnswer(false)
    }
  }, [currentQuestion])

  const handleSubmitAnswer = useCallback(() => {
    setShowAnswer(true)
  }, [])

  const handleRetry = useCallback(() => {
    setCurrentQuestion(0)
    setAnswers({})
    setShowAnswer(false)
    setShowHint(null)
    setQuizComplete(false)
    setStartTime(Date.now())
    setElapsedTime(0)
  }, [])

  const calculateScore = useMemo(() => {
    if (!generatedQuiz) return { score: 0, total: 0, percentage: 0 }

    let score = 0
    let total = 0

    for (const q of generatedQuiz.questions) {
      total += q.points
      const answer = answers[q.id]
      if (answer !== undefined) {
        if (q.type === 'fill-blank' || q.type === 'short-answer') {
          // Partial credit for text answers
          const correct = String(answer).toLowerCase().trim() === String(q.correctAnswer).toLowerCase().trim()
          if (correct) score += q.points
          else if (q.type === 'short-answer') score += q.points * 0.5 // Partial credit
        } else {
          if (answer === q.correctAnswer) score += q.points
        }
      }
    }

    return {
      score,
      total,
      percentage: total > 0 ? Math.round((score / total) * 100) : 0,
    }
  }, [generatedQuiz, answers])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        width: Math.min(600, '95vw'),
        maxHeight: '90vh',
        overflow: 'auto',
        borderRadius: 3,
        zIndex: 9999,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          bgcolor: 'primary.dark',
          color: 'primary.contrastText',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <QuizIcon />
          <Typography variant="h6">📝 AI Quiz Generator</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton size="small" onClick={() => setShowSettings(!showSettings)} sx={{ color: 'inherit' }}>
            <SettingsIcon fontSize="small" />
          </IconButton>
          {onClose && (
            <IconButton size="small" onClick={onClose} sx={{ color: 'inherit' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Settings Panel */}
      {showSettings && !generatedQuiz && (
        <Box sx={{ p: 2, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" gutterBottom>
            🎛️ Quiz Settings
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Number of Questions: {config.questionCount}
            </Typography>
            <Slider
              value={config.questionCount}
              min={5}
              max={50}
              step={5}
              onChange={(_, v) => setConfig((c) => ({ ...c, questionCount: v as number }))}
              marks={[{ value: 10, label: '10' }, { value: 25, label: '25' }, { value: 50, label: '50' }]}
            />
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Difficulty
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {(['easy', 'medium', 'hard', 'balanced'] as const).map((d) => (
                <Chip
                  key={d}
                  label={d}
                  size="small"
                  variant={config.difficulty === d ? 'filled' : 'outlined'}
                  onClick={() => setConfig((c) => ({ ...c, difficulty: d }))}
                  sx={{ cursor: 'pointer', textTransform: 'capitalize' }}
                />
              ))}
            </Box>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Question Types
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {(['multiple-choice', 'true-false', 'fill-blank', 'short-answer'] as const).map((t) => (
                <Chip
                  key={t}
                  label={t.replace('-', ' ')}
                  size="small"
                  variant={config.questionTypes.includes(t) ? 'filled' : 'outlined'}
                  onClick={() => setConfig((c) => ({
                    ...c,
                    questionTypes: c.questionTypes.includes(t)
                      ? c.questionTypes.filter((x) => x !== t)
                      : [...c.questionTypes, t],
                  }))}
                  sx={{ cursor: 'pointer', textTransform: 'capitalize' }}
                />
              ))}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.includeHints}
                  onChange={(e) => setConfig((c) => ({ ...c, includeHints: e.target.checked }))}
                  size="small"
                />
              }
              label={<Typography variant="caption">Hints</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={config.includeExplanations}
                  onChange={(e) => setConfig((c) => ({ ...c, includeExplanations: e.target.checked }))}
                  size="small"
                />
              }
              label={<Typography variant="caption">Explanations</Typography>}
            />
          </Box>
        </Box>
      )}

      {/* Main Content */}
      <Box sx={{ p: 2 }}>
        {!generatedQuiz ? (
          <>
            {/* Pre-generation UI */}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Generate an AI-powered quiz from your study materials. Configure settings above, then click generate.
            </Typography>

            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={handleGenerate}
              disabled={isGenerating}
              startIcon={isGenerating ? null : <QuizIcon />}
              sx={{ py: 2 }}
            >
              {isGenerating ? 'Generating Quiz...' : '🎯 Generate AI Quiz'}
            </Button>
          </>
        ) : quizComplete ? (
          <>
            {/* Results Screen */}
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography variant="h4" gutterBottom>
                {calculateScore.percentage >= 70 ? '🎉' : calculateScore.percentage >= 50 ? '👍' : '📚'}{' '}
                Quiz Complete!
              </Typography>

              <Box sx={{ my: 3 }}>
                <Typography variant="h2" color="primary" fontWeight={700}>
                  {calculateScore.percentage}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {calculateScore.score} / {calculateScore.total} points
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mb: 3 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Time Taken
                  </Typography>
                  <Typography variant="h6">{formatTime(elapsedTime)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Questions
                  </Typography>
                  <Typography variant="h6">
                    {generatedQuiz.questions.length}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Difficulty
                  </Typography>
                  <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                    {generatedQuiz.config.difficulty}
                  </Typography>
                </Box>
              </Box>

              <LinearProgress
                variant="determinate"
                value={calculateScore.percentage}
                sx={{ height: 10, borderRadius: 5, mb: 2 }}
                color={calculateScore.percentage >= 70 ? 'success' : calculateScore.percentage >= 50 ? 'warning' : 'error'}
              />

              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                <Button variant="outlined" startIcon={<RegenerateIcon />} onClick={handleRetry}>
                  Retry Quiz
                </Button>
                <Button variant="contained" onClick={() => setGeneratedQuiz(null)}>
                  New Quiz
                </Button>
              </Box>
            </Box>
          </>
        ) : (
          <>
            {/* Quiz in Progress */}
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2">
                Question {currentQuestion + 1} of {generatedQuiz.questions.length}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TimerIcon fontSize="small" color="action" />
                <Typography variant="body2">{formatTime(elapsedTime)}</Typography>
              </Box>
            </Box>

            <LinearProgress
              variant="determinate"
              value={((currentQuestion + 1) / generatedQuiz.questions.length) * 100}
              sx={{ mb: 3, height: 6, borderRadius: 3 }}
            />

            {showHint !== null && generatedQuiz.questions[currentQuestion]?.hint && (
              <Box sx={{ mb: 2, p: 1.5, bgcolor: 'warning.50', borderRadius: 1, border: '1px solid', borderColor: 'warning.main' }}>
                <Typography variant="caption" color="warning.main">
                  💡 Hint: {generatedQuiz.questions[currentQuestion].hint}
                </Typography>
              </Box>
            )}

            <QuizCard
              question={generatedQuiz.questions[currentQuestion]}
              questionNumber={currentQuestion + 1}
              showAnswer={showAnswer}
              userAnswer={answers[generatedQuiz.questions[currentQuestion].id]}
              onAnswer={(a) => handleAnswer(generatedQuiz.questions[currentQuestion].id, a)}
              onToggleHint={() => setShowHint(showHint ? null : generatedQuiz.questions[currentQuestion].id)}
              onToggleExplanation={() => {}}
              isExpanded={true}
              onToggleExpand={() => {}}
            />

            <Box sx={{ display: 'flex', gap: 1, mt: 3 }}>
              <Button
                variant="outlined"
                onClick={handlePrev}
                disabled={currentQuestion === 0}
              >
                Previous
              </Button>

              {!showAnswer ? (
                <Button
                  variant="contained"
                  onClick={handleSubmitAnswer}
                  disabled={answers[generatedQuiz.questions[currentQuestion].id] === undefined}
                >
                  Check Answer
                </Button>
              ) : (
                <Button variant="contained" onClick={handleNext} fullWidth>
                  {currentQuestion < generatedQuiz.questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
                </Button>
              )}
            </Box>
          </>
        )}
      </Box>
    </Paper>
  )
}

export default QuizGeneratorPanel

// ============================================================================
// Hook for Quiz Generator
// ============================================================================

const QUIZ_HISTORY_KEY = 'studymesh-quiz-history'

export function useQuizGenerator() {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [quizHistory, setQuizHistory] = useState<GeneratedQuiz[]>([])

  const openPanel = useCallback(() => setIsPanelOpen(true), [])
  const closePanel = useCallback(() => setIsPanelOpen(false), [])

  const saveQuiz = useCallback((quiz: GeneratedQuiz) => {
    setQuizHistory((prev) => {
      const next = [quiz, ...prev].slice(0, 20) // Keep last 20 quizzes
      localStorage.setItem(QUIZ_HISTORY_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  // Load from localStorage on mount
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(QUIZ_HISTORY_KEY)
      if (stored) {
        setQuizHistory(JSON.parse(stored))
      }
    } catch (e) {
      console.error('Failed to load quiz history:', e)
    }
  }, [])

  return {
    isPanelOpen,
    quizHistory,
    openPanel,
    closePanel,
    saveQuiz,
    QuizGeneratorPanel: QuizGeneratorPanel as React.FC<QuizGeneratorPanelProps>,
  }
}