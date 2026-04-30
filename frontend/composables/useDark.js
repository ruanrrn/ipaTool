import { ref, watch } from 'vue'
import { STORAGE_KEYS } from '../utils/storage.js'

export function useDark() {
  const isDark = ref(false)

  // Load from localStorage
  const stored = localStorage.getItem(STORAGE_KEYS.DARK_MODE_LEGACY)
  if (stored !== null) {
    isDark.value = stored === 'true'
  }

  // Watch for changes and save to localStorage
  watch(isDark, (value) => {
    localStorage.setItem(STORAGE_KEYS.DARK_MODE_LEGACY, value)
    if (value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, { immediate: true })

  const toggleDark = () => {
    isDark.value = !isDark.value
  }

  return {
    isDark,
    toggleDark
  }
}
