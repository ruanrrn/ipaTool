import { ref } from 'vue'
import { API_BASE } from '../config.js'
import { apiFetch } from '../utils/api.js'
import { STORAGE_KEYS } from '../utils/storage.js'

/**
 * Shared account identity key — deduplicates by email/dsid/token.
 */
export const accountIdentityKey = (acc = {}) =>
  String(acc.email || acc.dsid || acc.token || '').trim().toLowerCase()

/**
 * Deduplicate an account list by identity key.
 */
export const dedupeAccounts = (list = []) => {
  const map = new Map()
  for (const acc of list) {
    const key = accountIdentityKey(acc)
    if (!key) continue
    map.set(key, acc)
  }
  return [...map.values()]
}

/**
 * Normalise a raw server account object into the canonical local shape.
 */
const normaliseAccount = (acc) => ({
  token: acc.token,
  email: acc.email,
  dsid: acc.dsid,
  region: acc.region || 'US',
  hasSavedCredentials: !!acc.hasSavedCredentials,
  lastRefreshedAt: acc.lastRefreshedAt ?? 0,
})

// --- Singleton state (shared across all consumers) ---
const accounts = ref([])

/**
 * Save current accounts list to localStorage and optionally notify parent.
 */
function persistAccounts() {
  accounts.value = dedupeAccounts(accounts.value)
  localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts.value))
}

/**
 * Load accounts from server, with auto-login restore fallback.
 * Optionally triggers auto-login for saved credentials when server has none.
 */
async function loadAccounts() {
  // Optimistic local load first
  const saved = localStorage.getItem(STORAGE_KEYS.ACCOUNTS)
  if (saved) {
    try { accounts.value = dedupeAccounts(JSON.parse(saved)) } catch { accounts.value = [] }
  }

  try {
    const { data } = await apiFetch(`${API_BASE}/accounts`, { credentials: 'include' })

    if (data.ok && data.data && data.data.length > 0) {
      accounts.value = dedupeAccounts(data.data.map(normaliseAccount))
      persistAccounts()
    } else if (data.ok && (!data.data || data.data.length === 0)) {
      // Server has no sessions — try auto-login restore
      try {
        const { data: autoData } = await apiFetch(`${API_BASE}/auto-login`, { credentials: 'include', method: 'POST' })
        if (autoData.ok && autoData.data?.succeeded?.length > 0) {
          const { data: retryData } = await apiFetch(`${API_BASE}/accounts`, { credentials: 'include' })
          if (retryData.ok && retryData.data) {
            accounts.value = dedupeAccounts(retryData.data.map(normaliseAccount))
            persistAccounts()
          }
        }
      } catch (e) {
        console.warn('Auto-login restore failed:', e)
      }
    }
  } catch (error) {
    console.error('Failed to load accounts from server:', error)
  }
}

/**
 * Auto-login all saved credentials (for AccountManager on mount).
 * Returns the raw result object from the server.
 */
async function autoLoginAll() {
  try {
    const { data } = await apiFetch(`${API_BASE}/auto-login`, {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!data.ok || !data.results) return data

    const { success = [] } = data.results

    // Add newly logged-in accounts
    for (const result of success) {
      if (!result.alreadyLoggedIn) {
        accounts.value.push(normaliseAccount({
          ...result,
          hasSavedCredentials: true,
        }))
      }
    }

    persistAccounts()
    await loadAccounts()
    return data
  } catch (error) {
    console.error('Auto login failed:', error)
    return null
  }
}

/**
 * Load saved credentials list (just metadata, no secrets).
 */
async function loadSavedCredentials() {
  try {
    const { data } = await apiFetch(`${API_BASE}/credentials`, { credentials: 'include' })
    return (data.ok && data.data) ? data.data : []
  } catch (error) {
    console.error('Failed to load saved credentials:', error)
    return []
  }
}

/**
 * Composable: provides shared reactive accounts list and helpers.
 *
 * @param {object} [options]
 * @param {boolean} [options.autoLogin=false] — Run autoLoginAll after loadAccounts
 */
export function useAccounts(_options = {}) {
  return {
    accounts,
    loadAccounts,
    autoLoginAll,
    loadSavedCredentials,
    persistAccounts,
    accountIdentityKey,
    dedupeAccounts,
    normaliseAccount,
  }
}
