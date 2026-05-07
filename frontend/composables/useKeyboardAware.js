// useKeyboardAware — exposes `--kb-inset-bottom` on <html> for iOS Safari
// keyboard avoidance. Components can `padding-bottom: var(--kb-inset-bottom)`
// to keep their bottom content clear of the soft keyboard.
//
// Mounted once globally from App.vue.

import { onMounted, onBeforeUnmount } from 'vue'

export function useKeyboardAware() {
  let onResize
  let raf

  const apply = () => {
    const vv = window.visualViewport
    if (!vv) return
    const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
    document.documentElement.style.setProperty('--kb-inset-bottom', `${inset}px`)
  }

  onMounted(() => {
    if (typeof window === 'undefined' || !('visualViewport' in window)) return
    onResize = () => {
      // throttle via rAF — visualViewport fires often during keyboard transitions
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = null
        apply()
      })
    }
    window.visualViewport.addEventListener('resize', onResize)
    window.visualViewport.addEventListener('scroll', onResize)
    apply()
  })

  onBeforeUnmount(() => {
    if (typeof window === 'undefined' || !('visualViewport' in window)) return
    if (onResize) {
      window.visualViewport.removeEventListener('resize', onResize)
      window.visualViewport.removeEventListener('scroll', onResize)
    }
    if (raf) {
      cancelAnimationFrame(raf)
      raf = null
    }
    document.documentElement.style.removeProperty('--kb-inset-bottom')
  })
}
