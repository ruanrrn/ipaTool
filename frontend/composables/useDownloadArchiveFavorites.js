import { computed, ref } from 'vue'

import { API_BASE } from '../config.js'
import { apiFetch } from '../utils/api.js'
import { compareVersionDesc, getVersionId, getVersionLabel } from '../utils/version.js'

export function useDownloadArchiveFavorites({
  accounts,
  selectedAccount,
  selectedApp,
  versions,
  selectedVersion,
  appVerId,
  syncVersionSelectionNote,
  Toast
}) {
  const archivedVersionsByApp = ref({})
  const archivedVersionNotes = ref({})
  const favoriteLoading = ref(false)
  const versionNote = ref('')

  const getArchivedVersionSet = (appId) => {
    const archivedVersions = archivedVersionsByApp.value[String(appId)]
    return archivedVersions instanceof Set ? archivedVersions : new Set()
  }

  const syncSelectedVersionNote = ({ force = false } = {}) => {
    const currentVersionId = String(selectedVersion.value || appVerId.value || '')
    if (!currentVersionId) {
      if (force) versionNote.value = ''
      return
    }

    const nextNote = archivedVersionNotes.value[currentVersionId] || ''
    if (force || !versionNote.value) {
      versionNote.value = nextNote
    }

    if (typeof syncVersionSelectionNote === 'function') {
      syncVersionSelectionNote(versionNote.value)
    }
  }

  const getCurrentArchiveVersion = () => {
    const version = versions.value.find(item => getVersionId(item) === selectedVersion.value)
      || versions.value[0]

    return {
      versionId: getVersionId(version) || String(appVerId.value || ''),
      versionLabel: getVersionLabel(version, selectedApp.value?.version || '')
    }
  }

  const isCurrentAppFavorited = computed(() => {
    if (!selectedApp.value?.trackId) return false
    const { versionId } = getCurrentArchiveVersion()
    if (!versionId) return false
    return getArchivedVersionSet(selectedApp.value.trackId).has(versionId)
  })

  const getArchivedVersionCount = (appId) => getArchivedVersionSet(appId).size

  const isAppFavorited = (trackId) => {
    return getArchivedVersionCount(trackId) > 0
  }

  const loadArchivedAppIds = async () => {
    try {
      const { data } = await apiFetch(`${API_BASE}/archive`, { credentials: 'include' })
      if (!data.ok || !Array.isArray(data.data)) return
      const notes = {}
      archivedVersionsByApp.value = data.data.reduce((acc, item) => {
        const appId = String(item?.id || item?.app_id || '')
        if (!appId) return acc

        acc[appId] = new Set(
          (Array.isArray(item?.versions) ? item.versions : [])
            .map(version => {
              const vId = String(version?.version_id || version?.external_identifier || version?.id || '')
              if (vId && version?.description) notes[vId] = version.description
              return vId
            })
            .filter(Boolean)
        )
        return acc
      }, {})
      archivedVersionNotes.value = notes
      syncSelectedVersionNote()
    } catch (error) {
      console.warn('Failed to load archive apps:', error)
    }
  }

  const quickToggleFavorite = async (app) => {
    if (!app?.trackId) {
      Toast.warning('应用信息无效')
      return
    }

    if (favoriteLoading.value) return
    favoriteLoading.value = true

    try {
      const appId = String(app.trackId)
      const archivedVersions = [...getArchivedVersionSet(appId)]

      if (archivedVersions.length > 0) {
        const { data } = await apiFetch(`${API_BASE}/archive/${encodeURIComponent(appId)}`, {
          method: 'DELETE',
          credentials: 'include'
        })
        if (!data.ok) throw new Error(data.error || '取消收藏失败')

        const nextMap = { ...archivedVersionsByApp.value }
        delete nextMap[appId]
        archivedVersionsByApp.value = nextMap
        Toast.success(`已取消收藏（共移除 ${archivedVersions.length} 个版本）`)
        return
      }

      const region = accounts.value[selectedAccount.value]?.region || 'US'
      const { data: versionData } = await apiFetch(`${API_BASE}/versions?appid=${encodeURIComponent(appId)}&region=${encodeURIComponent(region)}`, {
        credentials: 'include'
      })
      if (!versionData.ok || !Array.isArray(versionData.data) || versionData.data.length === 0) {
        throw new Error(versionData.error || '未获取到可收藏的版本')
      }

      const latestVersion = [...versionData.data].sort(compareVersionDesc)[0]
      const versionId = getVersionId(latestVersion)
      const versionLabel = getVersionLabel(latestVersion, versionId)
      if (!versionId) {
        throw new Error('版本信息无效')
      }

      const { data } = await apiFetch(`${API_BASE}/archive`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          app_id: appId,
          app_name: app.trackName || `App ID: ${appId}`,
          icon_url: app.artworkUrl100 || app.artworkUrl60 || null,
          bundle_id: app.bundleId || null,
          artist_name: app.artistName || null,
          versions: [{
            version_id: versionId,
            version: versionLabel
          }]
        })
      })
      if (!data.ok) throw new Error(data.error || '收藏失败')

      archivedVersionsByApp.value = {
        ...archivedVersionsByApp.value,
        [appId]: new Set([versionId])
      }
      Toast.success('已收藏')
    } catch (error) {
      Toast.error(error.message || '收藏失败')
    } finally {
      favoriteLoading.value = false
    }
  }

  const toggleFavoriteApp = async () => {
    const app = selectedApp.value
    if (!app?.trackId) {
      Toast.warning('请先选择应用')
      return
    }
    if (favoriteLoading.value) return

    favoriteLoading.value = true
    try {
      const appId = String(app.trackId)
      const { versionId, versionLabel } = getCurrentArchiveVersion()

      if (!versionId) {
        Toast.warning('请先查询并选择版本后再收藏')
        return
      }

      if (getArchivedVersionSet(appId).has(versionId)) {
        const { data } = await apiFetch(`${API_BASE}/archive/${encodeURIComponent(appId)}/versions/${encodeURIComponent(versionId)}`, {
          method: 'DELETE',
          credentials: 'include'
        })
        if (!data.ok) throw new Error(data.error || '取消收藏失败')

        const nextMap = { ...archivedVersionsByApp.value }
        const nextVersions = new Set(getArchivedVersionSet(appId))
        nextVersions.delete(versionId)

        if (nextVersions.size === 0) {
          delete nextMap[appId]
        } else {
          nextMap[appId] = nextVersions
        }

        archivedVersionsByApp.value = nextMap
        Toast.success(`已取消收藏版本 ${versionLabel || versionId}`)
        return
      }

      const payload = {
        app_id: appId,
        app_name: app.trackName || `App ID: ${appId}`,
        icon_url: app.artworkUrl100 || app.artworkUrl60 || null,
        bundle_id: app.bundleId || null,
        versions: [{
          version_id: versionId,
          version: versionLabel || versionId,
          description: versionNote.value || null
        }]
      }

      const { response, data } = await apiFetch(`${API_BASE}/archive`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      if (!data.ok) throw new Error(data.error || '收藏失败')
      const nextMap = { ...archivedVersionsByApp.value }
      const nextVersions = new Set(getArchivedVersionSet(appId))
      nextVersions.add(versionId)
      nextMap[appId] = nextVersions
      archivedVersionsByApp.value = nextMap
      Toast.success(`已收藏版本 ${versionLabel || versionId}`)
    } catch (error) {
      Toast.error(error.message || '收藏失败')
    } finally {
      favoriteLoading.value = false
    }
  }

  return {
    archivedVersionsByApp,
    archivedVersionNotes,
    favoriteLoading,
    versionNote,
    getArchivedVersionSet,
    getArchivedVersionCount,
    getCurrentArchiveVersion,
    isCurrentAppFavorited,
    isAppFavorited,
    loadArchivedAppIds,
    quickToggleFavorite,
    toggleFavoriteApp,
    syncSelectedVersionNote
  }
}
