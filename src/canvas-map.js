import get from './ajax'
import Component from './component'
import createCanvas from './create-canvas'
import { loadImage } from './image-loader'
import { clamp, easing, interpolate } from './math2'
import * as Path from './path'
import { add, mult, sub } from './vector'

const getScroll = () => window.scrollY
const setCompositeOperation = (ctx, mode = 'source-over', fallback = null) => {
  ctx.globalCompositeOperation = mode
  const worked = ctx.globalCompositeOperation === mode
  if (!worked && fallback != null) ctx.globalCompositeOperation = fallback
  return worked
}
const drawCanvasSlice = (ctx, img, slice, target) => {
  const sliceScale = {
    x: img.width / slice.width,
    y: img.height / slice.height,
  }
  const targetSize = {
    width: target.width * sliceScale.x,
    height: target.height * sliceScale.y,
  }
  const targetScale = {
    x: targetSize.width / img.width,
    y: targetSize.height / img.height,
  }

  ctx.drawImage(
    img,
    Math.round(-slice.x * targetScale.x),
    Math.round(-slice.y * targetScale.y),
    Math.round(targetSize.width),
    Math.round(targetSize.height)
  )
}
const getBounds = (element, scroll) => {
  const bounds = element.getBoundingClientRect()
  return {
    top: bounds.top + scroll,
    bottom: bounds.bottom + scroll,
    left: bounds.left,
    right: bounds.right,
    height: bounds.height,
    width: bounds.width,
  }
}
const getNumericAttr = (el, attr, def = 1) => {
  const v = el.getAttribute(attr)
  return v == null ? def : Number.parseFloat(v)
}

const CanvasMap = (props) => {
  const object = {
    ready: false,

    canvas: null,
    ctx: null,

    map: null,
    mapScale: 1,
    mapScales: 2,
    mapMaxScale: 2.5,
    mapBuffer: null,
    mapBufferCtx: null,
    mapBufferScale: 0,
    mapBufferSize: { x: 2048, y: 2048 },
    mapBufferMargin: 400,
    mapBufferOffset: null,
    mapBufferLast: null,
    mapSVG: null,
    mapWidth: null,
    mapHeight: null,

    points: null,
    cameraPath: null,
    cameraBreakpoints: null,
    cameraSubdivisions: null,
    cameraSubdivisionSize: 1,
    cameraLength: 0,
    trailPath: null,
    trailBreakpoints: null,
    trailSubdivisions: null,
    trailSubdivisionSize: 1,
    trailLength: 0,

    sections: null,
    sectionsBounds: null,
    imagesBounds: null,

    lastScroll: 0,
    scrollAnim: null,
    scrollFrame: null,
    sectionsFrame: null,

    initialState() {
      return {
        sectionIndex: 0,
        section: null,
        sectionBounds: {
          top: 0,
          bottom: 0,
          height: 0,
        },
        cameraSegment: {
          start: 0,
          end: 0,
          length: 0,
        },
        trailSegment: {
          start: 0,
          end: 0,
          length: 0,
        },
        pos: 0,
        width: 0,
        height: 0,
        zoom: 1,
      }
    },
    defaultProps() {
      return {
        textContainer: null,
        mapSrc: null,

        trailColor: 'rgba(38, 46, 69, 0.33)',
        trailWidth: 2,
        trailDash: [2, 4],
        trailVisitedColor: '#DB466E',
        trailVisitedWidth: 4,

        pointRadius: null,

        pointFutureColor: '#aaa',
        pointPresentColor: null,
        pointPastColor: null,

        fontPastColor: '#666',
        fontPresentColor: '#000',
        fontFutureColor: '#aaa',
      }
    },
    init() {
      const width = window.innerWidth
      const height = window.innerHeight
      this.state = {
        width,
        height,
      }

      this.canvas = createCanvas(width, height)
      this.canvas.style.position = 'absolute'
      this.canvas.style.top = 0
      this.canvas.style.left = 0
      // Decoration only: the text tells the same story.
      this.canvas.setAttribute('aria-hidden', 'true')
      this.ctx = this.canvas.getContext('2d', { alpha: false })
      this.ctx.fillStyle = '#fff'
      this.ctx.fillRect(0, 0, this.state.width, this.state.height)
      this.container.appendChild(this.canvas)

      this.calculateSections()
      for (const img of this.props.textContainer.querySelectorAll('img')) {
        img.addEventListener('load', () => this.scheduleSectionsUpdate())
      }

      this.scrollAnim = { value: 0 }

      this.loadMap()
      window.addEventListener('resize', this.onResize.bind(this))
    },
    // Reads the paths and points from the SVG, then draws the map at each
    // scale. The path measures are slow, so this yields to the browser often.
    async loadMap() {
      const response = await get(this.props.mapSrc)
      this.mapSVG = Array.from(
        new DOMParser().parseFromString(response, 'image/svg+xml').childNodes
      ).find((node) => node.tagName?.toLowerCase() === 'svg')

      this.cameraPath = this.mapSVG.querySelector('#camera-path path')
      this.trailPath = this.mapSVG.querySelector('#trail-path path')

      const points = []
      for (const point of this.mapSVG.querySelectorAll('#points circle')) {
        const x = Number.parseFloat(point.getAttribute('cx'))
        const y = Number.parseFloat(point.getAttribute('cy'))
        points.push({
          x,
          y,
          length: await Path.getLengthAtPoint(this.trailPath, { x, y }),
          label: (point.getAttribute('id') || '').replace(/_/g, ' '),
          color: point.getAttribute('fill') || 'black',
          radius: Number.parseFloat(point.getAttribute('r')),
        })
      }
      this.points = points.sort((a, b) => a.length - b.length)

      this.cameraSubdivisions = await Path.subdividePath(
        this.cameraPath,
        this.cameraSubdivisionSize,
        true
      )
      this.cameraLength = Path.getLength(this.cameraPath)
      this.cameraBreakpoints = await this.setupBreakpoints((point) =>
        Path.getLengthAtPoint(this.cameraPath, point)
      )

      this.trailSubdivisions = await Path.subdividePath(
        this.trailPath,
        this.trailSubdivisionSize,
        true
      )
      // point.length is getLengthAtPoint(this.trailPath, point), from above.
      this.trailBreakpoints = await this.setupBreakpoints(
        (point) => point.length
      )
      this.trailLength = Path.getLength(this.trailPath)

      const img = await loadImage(this.props.mapSrc)
      this.mapWidth = img.width
      this.mapHeight = img.height
      // Fallback for browsers that report no size for the SVG (#27)
      if (this.mapHeight === 0) {
        this.mapWidth = 2040
        this.mapHeight = 1178
      }
      // Drawing the SVG at 2.5x is slow on phones: yield between the scales.
      this.map = []
      for (let i = 0; i < this.mapScales; i++) {
        await Path.yieldToMain()
        const scale = 1 + ((this.mapMaxScale - 1) / (this.mapScales - 1)) * i

        const map = createCanvas(this.mapWidth * scale, this.mapHeight * scale)
        const mapCtx = map.getContext('2d', { alpha: false })
        mapCtx.fillStyle = 'white'
        mapCtx.fillRect(0, 0, this.mapWidth * scale, this.mapHeight * scale)
        mapCtx.drawImage(
          img,
          0,
          0,
          this.mapWidth * scale,
          this.mapHeight * scale
        )
        this.map.push({ map, scale })
      }
      await Path.yieldToMain()

      this.mapBuffer = createCanvas(1, 1)
      this.mapBufferCtx = this.mapBuffer.getContext('2d', { alpha: false })
      this.updateMapBufferSize()
      this.mapBufferCtx.fillStyle = 'white'
      this.mapBufferCtx.fillRect(
        0,
        0,
        this.mapBufferSize.x,
        this.mapBufferSize.y
      )
      this.mapBufferOffset = { x: 0, y: 0 }
      this.mapBufferScale = this.mapScale

      this.ready = true
      document.addEventListener('scroll', this.onScroll.bind(this))
      this.onScroll()
    },
    async setupBreakpoints(getLength) {
      const breakpoints = []
      for (const [i, point] of this.points.entries()) {
        const length = await getLength(point)
        breakpoints.push(length)
        if (this.sections[i].getAttribute('data-stay') === 'true') {
          breakpoints.push(length)
        }
      }
      return breakpoints
    },
    getMapBufferSize() {
      return {
        x: this.state.width + this.mapBufferMargin * 2,
        y: this.state.height + this.mapBufferMargin * 2,
      }
    },
    updateMapBufferSize() {
      this.mapBufferSize = this.getMapBufferSize()

      this.mapBuffer.setAttribute('width', this.mapBufferSize.x)
      this.mapBuffer.setAttribute('height', this.mapBufferSize.y)

      this.mapBufferLast = {
        zoom: -1,
        pos: { x: -1, y: -1 },
      }
    },
    // Many images can load in the same frame: measure the sections once.
    scheduleSectionsUpdate() {
      if (this.sectionsFrame != null) return
      this.sectionsFrame = requestAnimationFrame(() => {
        this.sectionsFrame = null
        this.calculateSections()
        this.renderMap()
      })
    },
    calculateSections() {
      const scroll = getScroll()
      this.sections = Array.from(
        this.props.textContainer.querySelectorAll('.js-section')
      )
      this.sectionsBounds = this.sections.map((section) =>
        getBounds(section, scroll)
      )
      this.imagesBounds = this.sections.map((section) =>
        Array.from(section.querySelectorAll('.js-image'), (image) => ({
          ...getBounds(image, scroll),
          mapPos: Number.parseFloat(image.getAttribute('data-pos')),
        }))
      )
    },
    onScroll() {
      const scroll = getScroll()
      const d = Math.sqrt(clamp(Math.abs(scroll - this.lastScroll) / 10))
      this.lastScroll = scroll
      this.animateScroll(scroll, d * 0.2)
    },
    // Eases the map toward the scroll position with a quadratic ease-out (the
    // GSAP default this code used before). A new scroll event cancels the
    // running animation and starts from the current value, so animations of
    // quick scroll events never run on top of each other.
    animateScroll(target, duration) {
      cancelAnimationFrame(this.scrollFrame)
      const from = this.scrollAnim.value
      const start = performance.now()
      const step = (now) => {
        const p = duration > 0 ? clamp((now - start) / (duration * 1000)) : 1
        this.scrollAnim.value =
          p === 1 ? target : from + (target - from) * easing.quad.out(p)
        this.updateScroll(this.scrollAnim.value)
        if (p < 1) this.scrollFrame = requestAnimationFrame(step)
      }
      if (duration > 0) this.scrollFrame = requestAnimationFrame(step)
      else step(start)
    },

    updateScroll(scroll) {
      const sectionIndex = this.sectionsBounds.findIndex(
        (curSection, i, sections) => {
          if (i === sections.length - 1) return true

          const nextSection = sections[i + 1]
          return scroll < curSection.bottom || scroll < nextSection.top
        }
      )

      const sectionBounds = this.sectionsBounds[sectionIndex]
      const section = this.sections[sectionIndex]
      const pos = clamp(
        (scroll - sectionBounds.top) / sectionBounds.height,
        0,
        1
      )

      const cameraSegment = {
        start: this.cameraBreakpoints[sectionIndex],
        end: this.cameraBreakpoints[
          clamp(sectionIndex + 1, this.cameraBreakpoints.length - 1)
        ],
      }
      cameraSegment.length = cameraSegment.end - cameraSegment.start

      const trailSegment = {
        start: this.trailBreakpoints[sectionIndex],
        end: this.trailBreakpoints[
          clamp(sectionIndex + 1, this.trailBreakpoints.length - 1)
        ],
      }
      trailSegment.length = trailSegment.end - trailSegment.start

      this.state = {
        sectionIndex,
        section,
        sectionBounds,
        pos,
        cameraSegment,
        trailSegment,
      }
    },
    onResize() {
      this.state = {
        width: window.innerWidth,
        height: window.innerHeight,
      }
      this.canvas.width = this.state.width
      this.canvas.height = this.state.height
      this.calculateSections()

      // The map buffer and the paths only exist after the SVG has loaded.
      if (!this.ready) {
        this.ctx.fillStyle = '#fff'
        this.ctx.fillRect(0, 0, this.state.width, this.state.height)
        return
      }
      this.updateMapBufferSize()
      this.onScroll()
    },
    getMapForZoom(zoom) {
      let mapIndex = 0
      while (
        zoom > this.map[mapIndex].scale &&
        mapIndex < this.map.length - 1
      ) {
        mapIndex++
      }
      return this.map[mapIndex]
    },
    drawMapBuffer(ctx, pos, zoom) {
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, this.mapBufferSize.x, this.mapBufferSize.y)
      const map = this.getMapForZoom(zoom)

      const offset = sub(mult(pos, map.scale), this.mapBufferMargin)
      const scale = map.scale / zoom

      drawCanvasSlice(
        ctx,
        map.map,
        {
          ...offset,
          width: this.mapBufferSize.x * scale,
          height: this.mapBufferSize.y * scale,
        },
        {
          x: 0,
          y: 0,
          width: this.mapBufferSize.x,
          height: this.mapBufferSize.y,
        }
      )
      return { offset, scale, mapScale: map.scale }
    },
    getCameraPosAtPercent(percent) {
      return Path.getPointAtPercent(this.cameraSubdivisions, percent)
    },
    getMapSliceAtPercent(percent) {
      // quick fix bug #20
      if (Number.isNaN(percent)) percent = 1
      const cameraPos = this.getCameraPosAtPercent(percent)
      const zoom = this.getZoom()
      const width = this.state.width / zoom
      const height = this.state.height / zoom
      const center = {
        x: this.state.width > 720 ? 0.66 : 0.5,
        y: 0.33,
      }
      return {
        x: cameraPos.x - width * center.x,
        y: cameraPos.y - height * center.y,
        width,
        height,
        zoom,
        cameraPos,
      }
    },
    // The zoom follows the scroll position inside the current section:
    // data-zoom-start at its top, data-zoom-middle halfway, then the
    // data-zoom-start of the next section at its bottom.
    getZoom() {
      const { sectionIndex, pos } = this.state

      const section = this.sections[sectionIndex]
      const nextSection =
        this.sections[clamp(sectionIndex + 1, this.sections.length - 1)]

      const getStartZoom = (s) => getNumericAttr(s, 'data-zoom-start', 1)
      const getMiddleZoom = (s) =>
        getNumericAttr(s, 'data-zoom-middle', getStartZoom(s))

      const zoom1 = pos <= 0.5 ? getStartZoom(section) : getMiddleZoom(section)
      const zoom2 =
        pos <= 0.5 ? getMiddleZoom(section) : getStartZoom(nextSection)

      return interpolate(
        pos === 1 ? 1 : pos / 0.5 - Math.floor(pos / 0.5),
        zoom1,
        zoom2,
        easing.cubic.inOut
      )
    },
    renderMap() {
      if (!this.ready) return

      const ctx = this.ctx
      const { pos, cameraSegment, trailSegment } = this.state

      const trailPos = interpolate(
        pos,
        trailSegment.start,
        trailSegment.end,
        (v) => clamp(v * 1.2)
      )
      const trailTipIndex = Math.round(trailPos / this.trailSubdivisionSize)

      const mapSlice = this.getMapSliceAtPercent(
        interpolate(pos, cameraSegment.start, cameraSegment.end) /
          this.cameraLength
      )
      const zoom = mapSlice.zoom
      const inverseZoom = 1 / zoom

      const canvasPos = (x, y) =>
        typeof x === 'object'
          ? canvasPos(x.x, x.y)
          : [(x - mapSlice.x) * zoom, (y - mapSlice.y) * zoom]

      // Draws a soft wedge from the image to its place on the trail.
      const drawImagePointer = (image) => {
        const scroll = getScroll()

        const imageMapPos = Path.getPointAtPercent(
          this.trailSubdivisions,
          interpolate(image.mapPos, trailSegment.start, trailSegment.end) /
            this.trailLength
        )

        const halfWindowHeight = window.innerHeight / 2
        const falloff = halfWindowHeight * 1.2
        const imageMiddle = image.top + image.height / 2 - scroll
        const imageVisibility = easing.quad.out(
          clamp((falloff - Math.abs(halfWindowHeight - imageMiddle)) / falloff)
        )

        if (imageVisibility <= 0) return

        const [originX, originY] = canvasPos(imageMapPos)
        const origin = { x: originX, y: originY }

        const corner1 = [
          image.top - scroll < origin.y ? image.right : image.left,
          image.top - scroll,
        ]
        const corner2 = [
          image.bottom - scroll < origin.y ? image.left : image.right,
          image.right < origin.x ? image.bottom - scroll : image.top - scroll,
        ]

        const PI = Math.PI
        const PI2 = PI * 2
        const getAngle = (x, y) => Math.atan2(y - origin.y, x - origin.x)
        const angle1 = getAngle(...corner1) + PI2
        const angle2 = getAngle(...corner2) + PI2
        const angleDelta = Math.atan2(
          Math.sin(angle1 - angle2),
          Math.cos(angle1 - angle2)
        )
        const angleMiddle = angle1 - angleDelta / 2

        const radius = 2 * imageVisibility

        const angleOrigin = angleMiddle + PI / 2
        const originOffset = {
          x: (radius + 1) * Math.cos(angleOrigin),
          y: (radius + 1) * Math.sin(angleOrigin),
        }
        ctx.fillStyle = `rgba(220,220,202,${imageVisibility * 0.3})`
        setCompositeOperation(ctx, 'darken', 'source-over')

        ctx.beginPath()
        ctx.moveTo(origin.x + originOffset.x, origin.y + originOffset.y)
        ctx.lineTo(...corner1)
        ctx.lineTo(...corner2)
        ctx.lineTo(origin.x - originOffset.x, origin.y - originOffset.y)
        ctx.arc(origin.x, origin.y, radius, angleOrigin + PI, angleOrigin)
        ctx.fill()

        ctx.beginPath()
        ctx.arc(origin.x, origin.y, radius, angleOrigin, angleOrigin + PI2)
        ctx.fill()
        setCompositeOperation(ctx)

        ctx.fillStyle = '#405b54'
        ctx.beginPath()
        ctx.arc(origin.x, origin.y, 4 * imageVisibility, 0, PI2)
        ctx.fill()
      }

      const drawImagePointers = () => {
        this.imagesBounds[this.state.sectionIndex].forEach(drawImagePointer)
      }

      // Skips the points that fall outside the canvas.
      const drawSubdividedPath = (path, interval = 1, end = -1) => {
        ctx.beginPath()
        ctx.moveTo(...canvasPos(path[0]))
        const last = end === -1 ? path.length : clamp(end, path.length)
        let brokenPath = false
        for (let i = 1; i < last; i += interval) {
          const p = canvasPos(path[i])
          if (
            p[0] >= 0 &&
            p[1] >= 0 &&
            p[0] < this.state.width &&
            p[1] < this.state.height
          ) {
            if (brokenPath) ctx.moveTo(...p)
            else ctx.lineTo(...p)
            brokenPath = false
          } else {
            brokenPath = true
          }
        }
        ctx.stroke()
      }

      const drawTrail = () => {
        ctx.lineWidth = this.props.trailWidth
        ctx.strokeStyle = this.props.trailColor
        ctx.lineCap = 'round'
        ctx.setLineDash(this.props.trailDash)
        drawSubdividedPath(this.trailSubdivisions, 4)

        ctx.lineWidth = this.props.trailVisitedWidth
        ctx.setLineDash([])
        ctx.strokeStyle = this.props.trailVisitedColor
        ctx.lineCap = 'butt'
        drawSubdividedPath(this.trailSubdivisions, 2, trailTipIndex)
      }

      const isVisited = (point) => trailPos >= point.length

      // sets a value if the point has been visited, is being visited, or hasnt been visited yet
      const setByStatus = (i, past, present, future = null) => {
        const point = this.points[i]
        const nextPoint = this.points[i + 1] || null
        if (!isVisited(point)) return future ?? past
        if (nextPoint == null) return present
        if (isVisited(nextPoint)) return past
        return present
      }

      const drawPoint = (point, i) => {
        ctx.fillStyle = setByStatus(
          i,
          this.props.pointPastColor || point.color,
          this.props.pointPresentColor || point.color,
          this.props.pointFutureColor
        )
        ctx.beginPath()
        ctx.arc(
          ...canvasPos(point),
          this.props.pointRadius || point.radius,
          0,
          2 * Math.PI
        )
        ctx.fill()
      }

      const drawLabel = (point, i) => {
        const fontSize = 15
        ctx.font = `${setByStatus(i, 'normal', 'bold')} ${setByStatus(i, fontSize, fontSize * 1.2)}px Arial`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = setByStatus(
          i,
          this.props.fontPastColor,
          this.props.fontPresentColor,
          this.props.fontFutureColor
        )
        ctx.strokeStyle = '#e3dac9'
        ctx.lineWidth = 2
        const labelPos = canvasPos(add(point, { x: 20 * inverseZoom, y: 0 }))
        ctx.strokeText(point.label, ...labelPos)
        ctx.fillText(point.label, ...labelPos)
      }

      // The map buffer holds a margin around the view. It only redraws when
      // the view moves out of that margin or the zoom changes enough.
      let updatedBufferThisFrame = false
      const updateMapBuffer = () => {
        updatedBufferThisFrame = true
        const buffer = this.drawMapBuffer(this.mapBufferCtx, mapSlice, zoom)
        this.mapBufferScale = buffer.scale
        this.mapBufferOffset = buffer.offset
        this.mapScale = buffer.mapScale
      }
      const checkForBufferUpdate = () => {
        const zoomDelta = Math.abs(zoom - this.mapBufferLast.zoom)
        const dx = Math.abs(mapSlice.x - this.mapBufferLast.pos.x)
        const dy = Math.abs(mapSlice.y - this.mapBufferLast.pos.y)
        const optimalScale = this.getMapForZoom(zoom).scale

        if (
          dx < this.mapBufferMargin / 3 &&
          dy < this.mapBufferMargin / 3 &&
          zoomDelta < 1 &&
          !(zoom === optimalScale && this.mapBufferLast.zoom !== optimalScale)
        ) {
          return
        }

        this.mapBufferLast = {
          zoom,
          pos: { x: mapSlice.x, y: mapSlice.y },
        }
        updateMapBuffer()
      }
      const drawMap = () => {
        checkForBufferUpdate()

        if (updatedBufferThisFrame) {
          ctx.drawImage(
            this.mapBuffer,
            Math.round(-this.mapBufferMargin / this.mapBufferScale),
            Math.round(-this.mapBufferMargin / this.mapBufferScale)
          )
          return
        }
        drawCanvasSlice(
          ctx,
          this.mapBuffer,
          {
            x:
              (mapSlice.x * this.mapScale - this.mapBufferOffset.x) /
              this.mapBufferScale,
            y:
              (mapSlice.y * this.mapScale - this.mapBufferOffset.y) /
              this.mapBufferScale,
            width: (mapSlice.width * this.mapScale) / this.mapBufferScale,
            height: (mapSlice.height * this.mapScale) / this.mapBufferScale,
          },
          { x: 0, y: 0, width: this.state.width, height: this.state.height }
        )
      }

      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

      drawMap()
      drawTrail()
      this.points.forEach(drawPoint)
      this.points.forEach(drawLabel)
      drawImagePointers()

      // Fade the map out behind the text column.
      const blendWorks = setCompositeOperation(ctx, 'screen')

      const textRight = this.sectionsBounds[0].right
      const gradient = ctx.createLinearGradient(
        textRight,
        0,
        textRight + 200,
        0
      )
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.85)')
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, textRight + 200, this.state.height)

      if (blendWorks) setCompositeOperation(ctx)
    },
    render() {
      this.renderMap()
    },
  }

  return Object.assign(Component(props), object)
}

export default CanvasMap
