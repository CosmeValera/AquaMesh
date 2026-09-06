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

const StudyGuideLinearLayout = ({
  layout,
  studyPathContext,
  onAskAi,
  footer,
}: {
  layout?: DashboardLayout
  /**
   * Rendered as the last card of the page. Kept inside this container so it
   * picks up the page's own width, centring and card gap instead of guessing
   * at them from outside.
   */
  footer?: React.ReactNode
  /**
   * Which guide and page these blocks belong to. Supplied by the view rather
   * than read out of the layout: blocks are only given this context at
   * generation time, so guides created before a block started needing it would
   * otherwise never get it. Blocks that carry their own copy keep it.
   */
  studyPathContext?: Record<string, unknown>
  onAskAi?: (question: string) => void
}) => {
  const theme = useTheme()
  const compactView = useMediaQuery(theme.breakpoints.down('lg'))
  const components = useMemo(
    () =>
      collectStudyGuideComponentNodes(layout).map((component) => ({
        ...component,
        props: { ...studyPathContext, ...component.props },
      })),
    [layout, studyPathContext],
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

  if (components.length === 0) {
    return footer ? (
      <div className="studymesh-mobile-dashboard-layout">{footer}</div>
    ) : (
      <div className="studymesh-mobile-dashboard-empty" />
    )
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
        return (
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
      })}
      {footer}
    </div>
  )
}

export default StudyGuideLinearLayout
