import { describe, expect, it } from 'vitest'

import { routeCanvasConnection } from '../../../../src/components/studyTools/canvasGeometry'
import type { CanvasItem } from '../../../../src/components/studyTools/types'

const card = (id: string, x: number, y: number): CanvasItem => ({
  id,
  x,
  y,
  width: 200,
  height: 120,
  content: '',
  color: '#fff',
})

describe('Canvas connection routing', () => {
  it('uses horizontal edges for side-by-side cards', () => {
    const route = routeCanvasConnection(card('a', 0, 0), card('b', 400, 20))

    expect(route.fromSide).toBe('right')
    expect(route.toSide).toBe('left')
    expect(route.start.x).toBe(200)
    expect(route.end.x).toBe(400)
  })

  it('mirrors rounded routing cleanly from right to left', () => {
    const route = routeCanvasConnection(card('a', 400, 20), card('b', 0, 0))

    expect(route.fromSide).toBe('left')
    expect(route.toSide).toBe('right')
    expect(route.start.x).toBe(400)
    expect(route.end.x).toBe(200)
    expect(route.path).toContain('Q')
  })

  it('uses vertical edges for stacked cards', () => {
    const route = routeCanvasConnection(card('a', 0, 0), card('b', 20, 300))

    expect(route.fromSide).toBe('bottom')
    expect(route.toSide).toBe('top')
    expect(route.start.y).toBe(120)
    expect(route.end.y).toBe(300)
  })

  it('places parallel connections in separate lanes', () => {
    const from = card('a', 0, 0)
    const to = card('b', 400, 0)

    expect(routeCanvasConnection(from, to, -1).path).not.toBe(
      routeCanvasConnection(from, to, 1).path,
    )
  })

  it('routes outside overlapping cards', () => {
    const route = routeCanvasConnection(card('a', 0, 0), card('b', 80, 40))

    expect(route.fromSide).toBe('right')
    expect(route.toSide).toBe('right')
    expect(route.label.x).toBeGreaterThan(280)
  })
})
