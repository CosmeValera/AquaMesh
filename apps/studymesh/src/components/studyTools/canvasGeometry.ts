import type { CanvasItem } from './types'

export type CanvasSide = 'top' | 'right' | 'bottom' | 'left'

export interface CanvasPoint {
  x: number
  y: number
}

export interface CanvasRoute {
  start: CanvasPoint
  end: CanvasPoint
  path: string
  label: CanvasPoint
  fromSide: CanvasSide
  toSide: CanvasSide
}

const anchor = (item: CanvasItem, side: CanvasSide): CanvasPoint => {
  if (side === 'top') return { x: item.x + item.width / 2, y: item.y }
  if (side === 'right') return { x: item.x + item.width, y: item.y + item.height / 2 }
  if (side === 'bottom') return { x: item.x + item.width / 2, y: item.y + item.height }
  return { x: item.x, y: item.y + item.height / 2 }
}

export const routeCanvasConnection = (
  from: CanvasItem,
  to: CanvasItem,
  lane = 0,
): CanvasRoute => {
  const fromCenter = { x: from.x + from.width / 2, y: from.y + from.height / 2 }
  const toCenter = { x: to.x + to.width / 2, y: to.y + to.height / 2 }
  const dx = toCenter.x - fromCenter.x
  const dy = toCenter.y - fromCenter.y
  const horizontal = Math.abs(dx) >= Math.abs(dy)
  const fromSide: CanvasSide = horizontal
    ? dx >= 0 ? 'right' : 'left'
    : dy >= 0 ? 'bottom' : 'top'
  const toSide: CanvasSide = horizontal
    ? dx >= 0 ? 'left' : 'right'
    : dy >= 0 ? 'top' : 'bottom'
  const start = anchor(from, fromSide)
  const end = anchor(to, toSide)
  const laneOffset = lane * 18
  const overlaps =
    from.x < to.x + to.width &&
    from.x + from.width > to.x &&
    from.y < to.y + to.height &&
    from.y + from.height > to.y

  if (overlaps) {
    const overlapStart = anchor(from, 'right')
    const overlapEnd = anchor(to, 'right')
    const outsideX = Math.max(from.x + from.width, to.x + to.width) + 60 + laneOffset
    return {
      start: overlapStart,
      end: overlapEnd,
      fromSide: 'right',
      toSide: 'right',
      label: { x: outsideX, y: (overlapStart.y + overlapEnd.y) / 2 },
      path: `M ${overlapStart.x} ${overlapStart.y} L ${outsideX} ${overlapStart.y} L ${outsideX} ${overlapEnd.y} L ${overlapEnd.x} ${overlapEnd.y}`,
    }
  }

  if (horizontal) {
    const middle = (start.x + end.x) / 2 + laneOffset
    const radius = Math.min(16, Math.abs(end.y - start.y) / 2)
    const direction = end.y >= start.y ? 1 : -1
    const xDirection = end.x >= start.x ? 1 : -1
    return {
      start,
      end,
      fromSide,
      toSide,
      label: { x: middle, y: (start.y + end.y) / 2 },
      path: `M ${start.x} ${start.y} L ${middle - xDirection * radius} ${start.y} Q ${middle} ${start.y} ${middle} ${start.y + direction * radius} L ${middle} ${end.y - direction * radius} Q ${middle} ${end.y} ${middle + xDirection * radius} ${end.y} L ${end.x} ${end.y}`,
    }
  }

  const middle = (start.y + end.y) / 2 + laneOffset
  const radius = Math.min(16, Math.abs(end.x - start.x) / 2)
  const direction = end.x >= start.x ? 1 : -1
  return {
    start,
    end,
    fromSide,
    toSide,
    label: { x: (start.x + end.x) / 2, y: middle },
    path: `M ${start.x} ${start.y} L ${start.x} ${middle - radius} Q ${start.x} ${middle} ${start.x + direction * radius} ${middle} L ${end.x - direction * radius} ${middle} Q ${end.x} ${middle} ${end.x} ${middle + radius} L ${end.x} ${end.y}`,
  }
}

export const canvasHandlePoint = (
  item: CanvasItem,
  side: CanvasSide,
): CanvasPoint => anchor(item, side)
