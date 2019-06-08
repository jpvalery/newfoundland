import CanvasMap from './canvas-map'

let map=CanvasMap({
  textContainer:document.querySelector('.text'),
  mapSrc:'img/map.svg',
  trailVisitedColor:'#AF3C43',
  fontPresentColor:'#5D5C56',
}).appendTo('.container')
