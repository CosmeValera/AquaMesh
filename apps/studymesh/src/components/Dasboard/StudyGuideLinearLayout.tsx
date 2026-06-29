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
  onAskAi,
}: {
  layout?: DashboardLayout
  onAskAi?: (question: string) => void
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

  if (components.length === 0) {
    return <div className="studymesh-mobile-dashboard-empty" />
  }

  return (
    <div className="studymesh-mobile-dashboard-layout">
      {cardGroups.map((group) => {
        const isPageContentCard =
          group.components[0]?.type === 'Label' &&
          group.components.some(
            (component) => component.type === 'MarkdownBlock',
          )
        return (
          <section
            key={group.id}
            className={
              isPageContentCard
                ? 'studymesh-mobile-widget-card studymesh-study-page-card'
                : 'studymesh-mobile-widget-card'
            }
          >
            {group.components.map((component, index) => {
              const isLast = index === group.components.length - 1

              if (component.type === 'Label') {
                const labelVariant =
                  (component.props.variant as StudyGuideLabelVariant) ||
                  'body1'
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
                      props={component.props}
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
    </div>
  )
}

export default StudyGuideLinearLayout
