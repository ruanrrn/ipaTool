import { computed, ref, watch } from 'vue'
import { STORAGE_KEYS } from '../utils/storage.js'

const VALID_DARK_MODES = new Set(['system', 'light', 'dark'])

const isDark = ref(false)
const darkMode = ref('system')
let initialized = false
let systemThemeQuery = null
let removeSystemThemeListener = null

function getSystemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

function setDarkClass(value) {
  document.documentElement.classList.toggle('dark', value)
  document.body?.classList.toggle('dark', value)
}

function clearSystemThemeListener() {
  if (!removeSystemThemeListener) return
  removeSystemThemeListener()
  removeSystemThemeListener = null
  systemThemeQuery = null
}

function resolveInitialDarkMode() {
  const savedAppearance = localStorage.getItem(STORAGE_KEYS.DARK_MODE)
  if (VALID_DARK_MODES.has(savedAppearance)) return savedAppearance

  const legacyStored = localStorage.getItem(STORAGE_KEYS.DARK_MODE_LEGACY)
  if (legacyStored === 'true') return 'dark'
  if (legacyStored === 'false') return 'light'

  return 'system'
}

function applyDarkMode() {
  clearSystemThemeListener()

  if (darkMode.value === 'dark') {
    isDark.value = true
    return
  }

  if (darkMode.value === 'light') {
    isDark.value = false
    return
  }

  systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
  isDark.value = systemThemeQuery.matches

  const handleSystemThemeChange = (event) => {
    if (darkMode.value === 'system') {
      isDark.value = event.matches
    }
  }

  if (typeof systemThemeQuery.addEventListener === 'function') {
    systemThemeQuery.addEventListener('change', handleSystemThemeChange)
    removeSystemThemeListener = () => systemThemeQuery.removeEventListener('change', handleSystemThemeChange)
  } else {
    systemThemeQuery.addListener(handleSystemThemeChange)
    removeSystemThemeListener = () => systemThemeQuery.removeListener(handleSystemThemeChange)
  }
}

function initDarkState() {
  if (initialized) return
  initialized = true

  darkMode.value = resolveInitialDarkMode()
  applyDarkMode()

  watch(isDark, (value) => {
    localStorage.setItem(STORAGE_KEYS.DARK_MODE_LEGACY, String(value))
    setDarkClass(value)
  }, { immediate: true })
}

export function useDark() {
  initDarkState()

  const setDarkMode = (mode) => {
    const nextMode = VALID_DARK_MODES.has(mode) ? mode : 'system'
    darkMode.value = nextMode
    localStorage.setItem(STORAGE_KEYS.DARK_MODE, nextMode)
    applyDarkMode()
  }

  const setDark = (value) => {
    setDarkMode(value ? 'dark' : 'light')
  }

  const toggleDark = () => {
    setDark(!isDark.value)
  }

  return {
    isDark,
    darkMode,
    darkModeLabel: computed(() => {
      if (darkMode.value === 'dark') return '深色模式'
      if (darkMode.value === 'light') return '浅色模式'
      return '跟随系统'
    }),
    setDark,
    setDarkMode,
    toggleDark,
    getSystemPrefersDark
  }
}
