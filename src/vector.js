const objNum = (op, obj, num) =>
  Object.fromEntries(Object.keys(obj).map((k) => [k, op(obj[k], num)]))

const objObj = (op, objA, objB) =>
  Object.fromEntries(Object.keys(objA).map((k) => [k, op(objA[k], objB[k])]))

const ops = {
  add: (a, b) => a + b,
  sub: (a, b) => a - b,
  mult: (a, b) => a * b,
}

function doOpOn(op, a, b) {
  if (typeof a === typeof b) {
    if (typeof a === 'number') return op(a, b)
    if (typeof a === 'object') return objObj(op, a, b)
  } else if (typeof a === 'object') {
    return objNum(op, a, b)
  }
}

export function mult(a, b) {
  return doOpOn(ops.mult, a, b)
}
export function sub(a, b) {
  return doOpOn(ops.sub, a, b)
}
export function add(a, b) {
  return doOpOn(ops.add, a, b)
}
