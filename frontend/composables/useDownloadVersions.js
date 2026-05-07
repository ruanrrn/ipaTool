import { ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'

import { API_BASE } from '../config.js'
import { apiFetch } from '../utils/api.js'
import {
  compareVersionDesc,
  createManualVersion,
  getVersionId,
  normalizeFetchedVersion,
  upsertManualVersion
} from '../utils/version.js'

export function useDownloadVersions({
  accounts,
  selectedAccount,
  rawConfirmDirectAppId,
  getRegionLabel,
  addLog,
  syncSelectedVersionNote,
  Toast
}) {
  const appid = ref('')
  const appVerId = ref('')
  const versions = ref([])
  const selectedVersion = ref('')
  const versionsFetched = ref(false)
  const fetchingVersions = ref(false)
  const showManualVersionDialog = ref(false)

  const fetchVersions = async () => {
    if (!appid.value) {
      Toast.warning('请填写 APPID')
      return
    }

    if (selectedAccount.value === '' || selectedAccount.value === null) {
      Toast.warning('请先选择账号')
      return
    }

    const account = accounts.value[selectedAccount.value]
    const region = account?.region || 'US'

    fetchingVersions.value = true
    addLog(`[查询] 正在查询 APPID=${appid.value} 的历史版本（区域：${getRegionLabel(region)}）...`)

    try {
      const { data } = await apiFetch(`${API_BASE}/versions?appid=${encodeURIComponent(appid.value)}&region=${encodeURIComponent(region)}`, { credentials: 'include' })

      if (!data.ok) {
        Toast.error(`查询失败：${data.error || '未知错误'}`)
        addLog(`[查询] 失败：${data.error || '未知错误'}`)
        return
      }

      versions.value = (data.data || [])
        .map(normalizeFetchedVersion)
        .filter(Boolean)
        .sort(compareVersionDesc)

      versionsFetched.value = true

      if (!selectedVersion.value && versions.value[0]) {
        selectedVersion.value = getVersionId(versions.value[0])
        appVerId.value = selectedVersion.value
        syncSelectedVersionNote({ force: true })
      }

      addLog(`[查询] 获取到 ${versions.value.length} 条版本记录`)
    } catch (error) {
      Toast.error(`查询失败：${error.message}`)
      addLog(`[查询] 失败：${error.message}`)
    } finally {
      fetchingVersions.value = false
    }
  }

  const debouncedFetchVersions = useDebounceFn(() => {
    fetchVersions()
  }, 400)

  const resetVersionStateForAppChange = ({ loading = false } = {}) => {
    versions.value = []
    selectedVersion.value = ''
    appVerId.value = ''
    versionsFetched.value = false
    fetchingVersions.value = loading
  }

  const confirmDirectAppId = () => {
    if (selectedAccount.value === '' || selectedAccount.value === null || selectedAccount.value === undefined) {
      Toast.warning('请先选择账号')
      return
    }

    resetVersionStateForAppChange({ loading: true })
    rawConfirmDirectAppId()
  }

  const handleVersionSelected = (verId) => {
    selectedVersion.value = verId
    appVerId.value = verId
    syncSelectedVersionNote({ force: true })
  }

  const handleManualVersionSubmit = (versionId) => {
    const manualVersion = createManualVersion(versionId)
    if (!manualVersion) {
      Toast.warning('请输入有效的版本 ID')
      return
    }

    versions.value = upsertManualVersion(versions.value, versionId)
    versionsFetched.value = true
    handleVersionSelected(manualVersion.external_identifier)
    Toast.success('已添加并选中手动版本 ID')
  }

  const setAppIdFromSelectedApp = (app) => {
    appid.value = app?.trackId ? String(app.trackId) : ''
  }

  const getSelectedVersionRecord = () => {
    const selectedVersionId = String(selectedVersion.value || appVerId.value || '')
    if (!selectedVersionId) return null
    return versions.value.find((version) => getVersionId(version) === selectedVersionId) || null
  }

  return {
    appid,
    appVerId,
    versions,
    selectedVersion,
    versionsFetched,
    fetchingVersions,
    showManualVersionDialog,
    fetchVersions,
    debouncedFetchVersions,
    resetVersionStateForAppChange,
    confirmDirectAppId,
    handleVersionSelected,
    handleManualVersionSubmit,
    setAppIdFromSelectedApp,
    getSelectedVersionRecord
  }
}
