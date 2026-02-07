import { ref, watch } from 'vue'

export function useDark() {
  const isDark = ref(false)

  // Load from localStorage
  const stored = localStorage.getItem('darkMode')
  if (stored !== null) {
    isDark.value = stored === 'true'
  }

  // Watch for changes and save to localStorage
  watch(isDark, (value) => {
    localStorage.setItem('darkMode', value)
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
