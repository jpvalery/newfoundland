export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', () =>
      reject(new Error(`Failed to load image: ${src}`))
    )
    img.src = src
  })
}
