import { computed, ref, watch } from 'vue'

import { API_BASE } from '../config.js'
import { apiFetch } from '../utils/api.js'
import { STORAGE_KEYS } from '../utils/storage.js'

export const useArchiveAccounts = () => {
  const accounts = ref([])
  const selectedAccountIndex = ref(null)

  const activeAccount = computed(() => {
    if (selectedAccountIndex.value === null || selectedAccountIndex.value === undefined) return null
    return accounts.value[selectedAccountIndex.value] || null
  })

  watch(selectedAccountIndex, (value) => {
    if (value === null || value === undefined || value === '') return
    localStorage.setItem(STORAGE_KEYS.SELECTED_ACCOUNT_INDEX, String(value))
  })

  const ensureAccounts = async () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACCOUNTS) || '[]')
      accounts.value = Array.isArray(saved) ? saved : []
    } catch {
      accounts.value = []
    }

    try {
      const { data: res } = await apiFetch(`${API_BASE}/accounts`)
      if (res.ok && Array.isArray(res.data)) {
        accounts.value = res.data.map((account) => ({
          token: account.token,
          email: account.email,
          dsid: account.dsid,
          region: account.region || 'US'
        }))
        localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts.value))
      }
    } catch {}

    if (!accounts.value.length) {
      selectedAccountIndex.value = null
      return
    }

    const savedIndex = Number.parseInt(localStorage.getItem(STORAGE_KEYS.SELECTED_ACCOUNT_INDEX) || '', 10)
    selectedAccountIndex.value = Number.isInteger(savedIndex) && savedIndex >= 0 && savedIndex < accounts.value.length ? savedIndex : 0
  }

  const requireActiveAccount = async () => {
    await ensureAccounts()
    const account = activeAccount.value
    if (!account?.token) {
      throw new Error('请先在账号页登录 Apple ID')
    }
    return account
  }

  return {
    accounts,
    selectedAccountIndex,
    activeAccount,
    ensureAccounts,
    requireActiveAccount
  }
}
