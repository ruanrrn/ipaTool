import { ref, watch } from 'vue'

import { accountIdentityKey } from './useAccounts.js'
import { formatRegion } from '../utils/region.js'
import { STORAGE_KEYS } from '../utils/storage.js'

export const normalizeAccountIndex = (value) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number.parseInt(String(value), 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

export function useDownloadAccountSelection({ accounts, loadAccounts, appStore }) {
  const selectedAccount = ref(null)
  const getRegionLabel = (region) => formatRegion(region)

  const resolveInitialSelectedAccount = () => {
    if (!Array.isArray(accounts.value) || accounts.value.length === 0) return null

    const storeIndex = normalizeAccountIndex(appStore.downloadState?.selectedAccountIndex)
    if (storeIndex !== null && accounts.value[storeIndex]) return storeIndex

    const savedAccountKey = localStorage.getItem(STORAGE_KEYS.SELECTED_ACCOUNT_KEY)
    if (savedAccountKey) {
      const matchedIndex = accounts.value.findIndex(account => accountIdentityKey(account) === savedAccountKey)
      if (matchedIndex >= 0) return matchedIndex
    }

    const savedAccountIndex = normalizeAccountIndex(localStorage.getItem(STORAGE_KEYS.SELECTED_ACCOUNT_INDEX))
    if (savedAccountIndex !== null && accounts.value[savedAccountIndex]) return savedAccountIndex

    return 0
  }

  const resolveActiveAccount = async () => {
    if (!selectedAccount.value && selectedAccount.value !== 0) {
      throw new Error('请选择登录账号')
    }

    const currentAccount = accounts.value[selectedAccount.value]
    if (!currentAccount) {
      throw new Error('当前账号不存在，请重新选择账号')
    }

    const targetEmail = currentAccount.email
    await loadAccounts()

    const freshIndex = accounts.value.findIndex(
      acc => accountIdentityKey(acc) === accountIdentityKey(currentAccount) || acc.token === currentAccount.token || acc.email === targetEmail
    )

    if (freshIndex < 0) {
      throw new Error('当前账号会话已失效，请到账号管理页重新登录')
    }

    selectedAccount.value = freshIndex
    return accounts.value[freshIndex]
  }

  watch(accounts, (nextAccounts) => {
    if (!Array.isArray(nextAccounts) || nextAccounts.length === 0) {
      selectedAccount.value = null
      return
    }

    const currentIndex = normalizeAccountIndex(selectedAccount.value)
    if (currentIndex !== null && nextAccounts[currentIndex]) {
      return
    }

    selectedAccount.value = resolveInitialSelectedAccount()
  }, { deep: true })

  return {
    selectedAccount,
    getRegionLabel,
    normalizeAccountIndex,
    resolveInitialSelectedAccount,
    resolveActiveAccount
  }
}
