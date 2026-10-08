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
// Gives the main thread back to the browser, so input and paint can happen.
// The fallback uses a message, because chained setTimeout(0) calls get a 4ms
// minimum delay.
const channel = new MessageChannel()
const pending = []
channel.port1.onmessage = () => pending.shift()()
export const yieldToMain = () =>
  globalThis.scheduler?.yield
    ? globalThis.scheduler.yield()
    : new Promise((resolve) => {
        pending.push(resolve)
        channel.port2.postMessage(null)
      })

function distance(pointA, pointB) {
  const d = sub(pointA, pointB)
  return Math.sqrt(d.x * d.x + d.y * d.y)
}
export async function getLengthAtPoint(
  path,
  point,
  subdivisionsPerIteration = 10,
  iterations = 5
) {
  const iterate = async (lower, upper, iterationsLeft) => {
    await yieldToMain()
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
// Each getPointAtLength() call measures the path again from its start, so a
// 1px subdivision of the trail takes about 0.5s on a fast laptop (more on a
// phone). The loop yields every few milliseconds to keep the page responsive.
const TIME_SLICE_MS = 6
export async function subdividePath(
  path,
  subdivisions,
  subdivideByDistance = false
) {
  const length = getLength(path)

  if (subdivideByDistance) subdivisions = length / subdivisions

  const subdivisionLength = length / subdivisions
  const points = new Array(Math.floor(subdivisions))
  let deadline = performance.now() + TIME_SLICE_MS
  for (let i = 0; i < points.length; i++) {
    points[i] = getPointAtLength(path, i * subdivisionLength)
    if (performance.now() > deadline) {
      await yieldToMain()
      deadline = performance.now() + TIME_SLICE_MS
    }
  }
  return points
}
