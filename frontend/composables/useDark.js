import { ref, watch } from 'vue'
import { STORAGE_KEYS } from '../utils/storage.js'

const isDark = ref(false)
let initialized = false

function setDarkClass(value) {
  document.documentElement.classList.toggle('dark', value)
  document.body?.classList.toggle('dark', value)
}

function initDarkState() {
  if (initialized) return
  initialized = true

  const savedAppearance = localStorage.getItem(STORAGE_KEYS.DARK_MODE)
  const legacyStored = localStorage.getItem(STORAGE_KEYS.DARK_MODE_LEGACY)

  if (savedAppearance === 'dark') {
    isDark.value = true
  } else if (savedAppearance === 'light') {
    isDark.value = false
  } else if (legacyStored !== null) {
    isDark.value = legacyStored === 'true'
  } else {
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  setDarkClass(isDark.value)

  watch(isDark, (value) => {
    localStorage.setItem(STORAGE_KEYS.DARK_MODE_LEGACY, String(value))
    setDarkClass(value)
  }, { immediate: true })
}

export function useDark() {
  initDarkState()

  const setDark = (value) => {
    isDark.value = Boolean(value)
  }

  const toggleDark = () => {
    setDark(!isDark.value)
  }

  return {
    isDark,
    setDark,
    toggleDark
  }
}
