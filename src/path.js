import { clamp } from './math2'
import { sub } from './vector'

export function getPointAtLength(path, length) {
  const p = path.getPointAtLength(length)
  return { x: p.x, y: p.y }
}
export function getLength(path) {
  return path.getTotalLength()
}
export function getPointAtPercent(path, percent) {
  if (Array.isArray(path)) {
    return path[Math.round(clamp(percent) * (path.length - 1))]
  }
  return getPointAtLength(path, percent * getLength(path))
}
function distance(pointA, pointB) {
  const d = sub(pointA, pointB)
  return Math.sqrt(d.x * d.x + d.y * d.y)
}
export function getLengthAtPoint(
  path,
  point,
  subdivisionsPerIteration = 10,
  iterations = 5
) {
  const iterate = (lower, upper, iterationsLeft) => {
    const step = (upper - lower) / (subdivisionsPerIteration - 1)

    const closest = Array.from({ length: subdivisionsPerIteration }, (_, i) => {
      const length = lower + step * i
      return {
        length,
        distance: distance(point, getPointAtLength(path, length)),
      }
    })
      .sort((a, b) => a.distance - b.distance)
      .map((v) => v.length)
      .slice(0, 2)

    if (iterationsLeft === 1) return closest[0]

    return iterate(...closest.sort((a, b) => a - b), iterationsLeft - 1)
  }

  return iterate(0, getLength(path), iterations)
}
export function subdividePath(path, subdivisions, subdivideByDistance = false) {
  const length = getLength(path)

  if (subdivideByDistance) subdivisions = length / subdivisions

  const subdivisionLength = length / subdivisions
  return Array.from({ length: Math.floor(subdivisions) }, (_, i) =>
    getPointAtLength(path, i * subdivisionLength)
  )
}
