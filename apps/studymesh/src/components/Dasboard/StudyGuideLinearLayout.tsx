import React, { useMemo } from 'react'
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material'

import type { DashboardLayout } from '../../state/store'
import StudyBlockView, { isStudyBlockType } from '../study/StudyBlockView'
import '../Layout/layout.scss'

interface StudyGuideComponentNode {
  id: string
  type: string
  props: Record<string, unknown>
}

interface StudyGuideCardGroup {
  id: string
  components: StudyGuideComponentNode[]
}

type StudyGuideLabelVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'subtitle1'
  | 'subtitle2'
  | 'body1'
  | 'body2'

const toMobileStudyGuideVariant = (
  variant: StudyGuideLabelVariant,
): StudyGuideLabelVariant => {
  if (variant === 'h1' || variant === 'h2') {
    return 'h5'
  }

  if (variant === 'h3' || variant === 'h4') {
    return 'h6'
  }

  return variant
}

const normalizeComparableTitle = (value: string): string =>
  value
    .trim()
    .replace(/^#{1,6}\s+/, '')
    .replace(/^\d+\s*[-.)]\s+/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()

const stripTrailingDuplicateTitle = (
  markdown: string,
  title: string,
): string => {
  const normalizedTitle = normalizeComparableTitle(title)
  if (!normalizedTitle) {
    return markdown
  }

  const lines = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  let lastContentIndex = lines.length - 1
  while (lastContentIndex >= 0 && !lines[lastContentIndex].trim()) {
    lastContentIndex -= 1
  }

  if (lastContentIndex < 0) {
    return ''
  }

  const lastLine = lines[lastContentIndex].trim()
  const lastLineTitle = lastLine.match(/^#{1,6}\s+(.+)$/)?.[1] || lastLine
  if (normalizeComparableTitle(lastLineTitle) !== normalizedTitle) {
    return markdown
  }

  return lines.slice(0, lastContentIndex).join('\n').replace(/\n+$/g, '')
}

const isKnowledgeBridgeGroup = (group: StudyGuideCardGroup | undefined) =>
  Boolean(
    group?.components.some(
      (component) =>
        component.type === 'StudyNoteBlock' &&
        Array.isArray(component.props.suggestedTypes) &&
        component.props.suggestedTypes.length === 0,
    ),
  )

const pageContentTitle = (group: StudyGuideCardGroup): string =>
  String(
    group.components.find((component) => component.type === 'Label')?.props
      .text || '',
  )

const cleanComponentForBridgePlacement = (
  component: StudyGuideComponentNode,
  title: string,
  shouldClean: boolean,
): StudyGuideComponentNode => {
  if (!shouldClean || component.type !== 'MarkdownBlock') {
    return component
  }

  const markdown = component.props.markdown
  if (typeof markdown !== 'string') {
    return component
  }

  return {
    ...component,
    props: {
      ...component.props,
      markdown: stripTrailingDuplicateTitle(markdown, title),
    },
  }
}

const collectStudyGuideComponentNodes = (
  node: DashboardLayout | undefined,
  path: string[] = [],
): StudyGuideComponentNode[] => {
  if (!node) {
    return []
  }

  const components = node.config?.customProps?.components
  if (Array.isArray(components)) {
    return components
      .filter(
        (component): component is StudyGuideComponentNode =>
          Boolean(component) &&
          typeof component === 'object' &&
          typeof component.type === 'string' &&
          typeof component.props === 'object' &&
          component.props !== null,
      )
      .map((component, index) => ({
        id: component.id || [...path, String(index)].join('-'),
        type: component.type,
        props: component.props,
      }))
  }

  return (node.children || []).flatMap((child, index) =>
    collectStudyGuideComponentNodes(child, [...path, String(index)]),
  )
}

// Mirrors mastery.ts's QUIZ_BLOCK_TYPES — deliberately not imported, since
// that set is about guide-wide mastery detection while this one is about
// which card group in THIS page's linear layout is the quiz.
const QUIZ_CARD_TYPES = new Set(['QuizCarouselBlock', 'FocusedQuizSessionBlock'])
const isQuizGroup = (group: StudyGuideCardGroup): boolean =>
  group.components.some((component) => QUIZ_CARD_TYPES.has(component.type))

const StudyGuideLinearLayout = ({
  layout,
  onAskAi,
  renderQuizGroup,
  renderPageEnd,
}: {
  layout?: DashboardLayout
  onAskAi?: (question: string) => void
  /** Wraps the page's first quiz card, when there is one. */
  renderQuizGroup?: (quizGroup: React.ReactNode) => React.ReactNode
  /** Rendered as the last child of the page container. */
  renderPageEnd?: (info: { quizGroupRendered: boolean }) => React.ReactNode
}) => {
  const theme = useTheme()
  const compactView = useMediaQuery(theme.breakpoints.down('lg'))
  const components = useMemo(
    () => collectStudyGuideComponentNodes(layout),
    [layout],
  )
  const cardGroups = useMemo<StudyGuideCardGroup[]>(() => {
    const groups: StudyGuideCardGroup[] = []
    let currentTextGroup: StudyGuideComponentNode[] = []

    const flushTextGroup = () => {
      if (currentTextGroup.length === 0) {
        return
      }

      groups.push({
        id: currentTextGroup.map((component) => component.id).join('-'),
        components: currentTextGroup,
      })
      currentTextGroup = []
    }

    components.forEach((component) => {
      if (component.type === 'Label' || component.type === 'MarkdownBlock') {
        currentTextGroup.push(component)
        return
      }

      flushTextGroup()
      groups.push({ id: component.id, components: [component] })
    })

    flushTextGroup()
    return groups
  }, [components])
  // First quiz group wins if a page somehow has two.
  const quizGroupIndex = useMemo(
    () => cardGroups.findIndex(isQuizGroup),
    [cardGroups],
  )
  const quizGroupRendered = Boolean(renderQuizGroup) && quizGroupIndex !== -1

  if (components.length === 0) {
    if (renderPageEnd) {
      return (
        <div className="studymesh-mobile-dashboard-layout">
          {renderPageEnd({ quizGroupRendered: false })}
        </div>
      )
    }

    return <div className="studymesh-mobile-dashboard-empty" />
  }

  return (
    <div className="studymesh-mobile-dashboard-layout">
      {cardGroups.map((group, groupIndex) => {
        const isPageContentCard =
          group.components[0]?.type === 'Label' &&
          group.components.some(
            (component) => component.type === 'MarkdownBlock',
          )
        const shouldCleanBridgeLeadIn =
          isPageContentCard &&
          isKnowledgeBridgeGroup(cardGroups[groupIndex + 1])
        const isContextBridgeCard = isKnowledgeBridgeGroup(group)
        const title = pageContentTitle(group)
        const card = (
          <section
            key={group.id}
            className={
              isPageContentCard
                ? 'studymesh-mobile-widget-card studymesh-study-page-card'
                : 'studymesh-mobile-widget-card'
            }
          >
            {group.components.map((rawComponent, index) => {
              const component = cleanComponentForBridgePlacement(
                rawComponent,
                title,
                shouldCleanBridgeLeadIn,
              )
              const isLast = index === group.components.length - 1

              if (component.type === 'Label') {
                const labelVariant =
                  (component.props.variant as StudyGuideLabelVariant) || 'body1'
                const renderedVariant = compactView
                  ? toMobileStudyGuideVariant(labelVariant)
                  : labelVariant
                const title = (
                  <Typography
                    variant={renderedVariant}
                    fontWeight={component.props.fontWeight as number}
                    gutterBottom={false}
                    sx={{
                      overflowWrap: 'anywhere',
                      lineHeight: compactView ? 1.18 : undefined,
                    }}
                  >
                    {String(component.props.text || '')}
                  </Typography>
                )

                return (
                  <Box key={component.id} sx={{ mb: isLast ? 0 : 2 }}>
                    {isPageContentCard ? (
                      <>
                        <Box className="studymesh-study-page-title-row">
                          {title}
                        </Box>
                        <Box className="studymesh-study-page-accent-rule" />
                      </>
                    ) : (
                      title
                    )}
                  </Box>
                )
              }

              return (
                <Box key={component.id} sx={{ mb: isLast ? 0 : 2 }}>
                  {isStudyBlockType(component.type) ? (
                    <StudyBlockView
                      type={component.type}
                      props={
                        isContextBridgeCard
                          ? { ...component.props, contextBridge: true }
                          : component.props
                      }
                      unframed={component.type === 'MarkdownBlock'}
                      onAskAi={onAskAi}
                    />
                  ) : null}
                </Box>
              )
            })}
          </section>
        )

        if (renderQuizGroup && groupIndex === quizGroupIndex) {
          return (
            <React.Fragment key={group.id}>
              {renderQuizGroup(card)}
            </React.Fragment>
          )
        }

        return card
      })}
      {renderPageEnd?.({ quizGroupRendered })}
    </div>
  )
}

export default StudyGuideLinearLayout
