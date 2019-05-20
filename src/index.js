import CanvasMap from './canvas-map'

let map=CanvasMap({
  textContainer:document.querySelector('.text'),
  mapSrc:'img/map.svg',
  trailVisitedColor:'#DB466E',
  fontPresentColor:'#5D5C56',
}).appendTo('.container')
