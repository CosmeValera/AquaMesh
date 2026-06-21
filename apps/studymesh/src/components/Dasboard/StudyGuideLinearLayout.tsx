import React, { useMemo } from 'react'
import { Box, Typography } from '@mui/material'

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

const StudyGuideLinearLayout = ({ layout }: { layout?: DashboardLayout }) => {
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
      {cardGroups.map((group) => (
        <section key={group.id} className="studymesh-mobile-widget-card">
          {group.components.map((component, index) => (
            <Box
              key={component.id}
              sx={{
                mb: index === group.components.length - 1 ? 0 : 2,
              }}
            >
              {component.type === 'Label' ? (
                <Typography
                  variant={
                    (component.props.variant as
                      | 'h1'
                      | 'h2'
                      | 'h3'
                      | 'h4'
                      | 'h5'
                      | 'h6'
                      | 'subtitle1'
                      | 'subtitle2'
                      | 'body1'
                      | 'body2') || 'body1'
                  }
                  fontWeight={component.props.fontWeight as number}
                  gutterBottom={Boolean(component.props.gutterBottom)}
                >
                  {String(component.props.text || '')}
                </Typography>
              ) : isStudyBlockType(component.type) ? (
                <StudyBlockView type={component.type} props={component.props} />
              ) : null}
            </Box>
          ))}
        </section>
      ))}
    </div>
  )
}

export default StudyGuideLinearLayout
