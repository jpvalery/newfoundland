export function clamp(v, min = null, max = null) {
  if (min == null) {
    min = 0
    max = 1
  } else if (max == null) {
    max = min
    min = 0
  }
  return Math.min(max, Math.max(min, v))
}
export function interpolate(v, min, max, f = (x) => x) {
  return min + f(v) * (max - min)
}
export const easing = {
  quad: {
    out: (v) => -1 * v * (v - 2),
  },
  cubic: {
    inOut: (v) => {
      v /= 0.5
      if (v < 1) return 0.5 * v * v * v
      v -= 2
      return 0.5 * (v * v * v + 2)
    },
  },
}
