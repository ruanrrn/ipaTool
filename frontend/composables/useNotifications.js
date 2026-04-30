import { ref, watch } from 'vue'
import { STORAGE_KEYS } from '../utils/storage.js'

// --- Singleton state shared across all consumers ---
const permission = ref(
  typeof Notification !== 'undefined' ? Notification.permission : 'denied'
)

const defaultSettings = {
  versionUpdate: true,
  downloadComplete: true,
  downloadFailed: true
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NOTIFICATION_SETTINGS)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...defaultSettings, ...parsed }
    }
  } catch { /* ignore */ }
  return { ...defaultSettings }
}

const settings = ref(loadSettings())

watch(settings, (val) => {
  localStorage.setItem(STORAGE_KEYS.NOTIFICATION_SETTINGS, JSON.stringify(val))
}, { deep: true })

// --- Interval-based version check ---
let versionCheckTimer = null

/**
 * Periodically check subscribed apps for new versions.
 * Uses the existing /api/check-updates endpoint.
 */
function startVersionPolling(intervalMs = 30 * 60 * 1000) {
  stopVersionPolling()
  // Run once immediately, then periodically
  _checkForUpdates()
  versionCheckTimer = setInterval(_checkForUpdates, intervalMs)
}

function stopVersionPolling() {
  if (versionCheckTimer) {
    clearInterval(versionCheckTimer)
    versionCheckTimer = null
  }
}

async function _checkForUpdates() {
  if (!settings.value.versionUpdate) return
  try {
    const res = await fetch('/api/check-updates')
    const data = await res.json()
    if (data.ok && data.data?.updates?.length > 0) {
      for (const update of data.data.updates) {
        send(
          `🔄 ${update.app_name} 有新版本`,
          `${update.current_version} → ${update.latest_version}`,
          { tag: `version-${update.app_id}` }
        )
      }
    }
  } catch { /* silent */ }
}

// --- Core send ---

/**
 * Send a browser notification.
 * Respects user settings and permission state.
 */
function send(title, body, options = {}) {
  if (typeof Notification === 'undefined') return
  if (permission.value !== 'granted') return
  // Don't notify if tab is focused and user prefers not to be disturbed (optional future enhancement)
  try {
    // Deduplicate by tag
    const n = new Notification(title, {
      body,
      icon: '/favicon.ico',
      ...options
    })
    n.onclick = () => {
      window.focus()
      n.close()
    }
  } catch { /* silent */ }
}

/**
 * Initialize: start version polling if enabled.
 * Call once from App.vue on mount.
 */
function init() {
  if (settings.value.versionUpdate) {
    startVersionPolling()
  }
}

/**
 * Notification helpers for specific events.
 */
function notifyDownloadComplete(appName, fileName) {
  if (!settings.value.downloadComplete) return
  send(
    `✅ 下载完成`,
    `${appName}${fileName ? ` — ${fileName}` : ''}`,
    { tag: `dl-complete-${Date.now()}` }
  )
}

function notifyDownloadFailed(appName, error) {
  if (!settings.value.downloadFailed) return
  send(
    `❌ 下载失败`,
    `${appName}${error ? `：${error}` : ''}`,
    { tag: `dl-failed-${Date.now()}` }
  )
}

export function useNotifications() {
  return {
    init,
    stopVersionPolling,
    notifyDownloadComplete,
    notifyDownloadFailed
  }
}
