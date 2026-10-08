import 'lazysizes'
import 'glightbox/dist/css/glightbox.css'
import GLightbox from 'glightbox'
import CanvasMap from './canvas-map'

CanvasMap({
  textContainer: document.querySelector('.text'),
  mapSrc: 'img/map.svg',
  trailVisitedColor: '#AF3C43',
  fontPresentColor: '#5D5C56',
}).appendTo('.container')

// Photo lightbox: links with the same data-gallery value form one gallery.
// The photo in the lightbox gets the same alt text as the photo in the page.
for (const link of document.querySelectorAll('a[data-gallery]')) {
  link.dataset.alt = link.querySelector('img')?.alt || ''
}
GLightbox({ selector: 'data-gallery' })
