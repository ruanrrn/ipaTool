// Inline SVG icon components — 24×24 standard viewBox
import { h } from 'vue'

function svgIcon(pathData, viewBox = '0 0 24 24') {
  return {
    name: 'SvgIcon',
    render() {
      return h('svg', {
        viewBox,
        fill: 'currentColor',
        style: 'width:1em;height:1em;display:inline-block;vertical-align:-0.125em'
      }, [
        h('path', { d: pathData })
      ])
    }
  }
}

// Search — magnifying glass
export const Search = svgIcon(
  'M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  '0 0 24 24'
)

// ArrowRight
export const ArrowRight = svgIcon(
  'M5 12h14M12 5l7 7-7 7',
  '0 0 24 24'
)

// Download
export const Download = svgIcon(
  'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  '0 0 24 24'
)

// Plus
export const Plus = svgIcon(
  'M12 5v14M5 12h14',
  '0 0 24 24'
)

// Star (outline)
export const Star = svgIcon(
  'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  '0 0 24 24'
)

// StarFilled (solid)
export const StarFilled = svgIcon(
  'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  '0 0 24 24'
)

// Install (phone + download arrow)
export const Install = svgIcon(
  'M12 2v8M8 6l4 4 4-4M4 14h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z',
  '0 0 24 24'
)
