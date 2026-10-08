const isFunction = (v) => typeof v === 'function'
const callIfFunction = (thisObj, f, ifNot = undefined) => {
  if (isFunction(f)) return f.call(thisObj)
  if (isFunction(ifNot)) return ifNot.call(thisObj)
  return ifNot
}

const Component = (props = null) => ({
  _state: null,
  _props: null,
  _hasToRender: false,
  _container: null,

  get hasToRender() {
    return this._hasToRender
  },
  set hasToRender(value) {
    if (value === this._hasToRender) return
    this._hasToRender = value

    if (value) requestAnimationFrame(this.startRendering.bind(this))
  },

  get state() {
    if (this._state == null) {
      this._state = callIfFunction(this, this.initialState, {})
    }
    return this._state
  },
  set state(value) {
    // TODO: diff to test if it should render
    this._state = Object.assign({}, this.state, value)
    this.hasToRender = true
  },

  get props() {
    if (this._props == null) {
      this._props = Object.assign(
        {},
        callIfFunction(this, this.defaultProps, {}),
        props
      )
    }
    return this._props
  },
  set props(value) {
    // TODO: diff to test if it should render
    this._props = Object.assign({}, this.props, value)
    this.hasToRender = true
  },

  get container() {
    return this._container
  },

  appendTo(element) {
    this._container =
      typeof element === 'string' ? document.querySelector(element) : element

    callIfFunction(this, this.init)

    return this
  },

  startRendering() {
    if (!this.hasToRender) return
    callIfFunction(this, this.render)
    this.hasToRender = false
  },
})

export default Component
