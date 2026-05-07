import { computed, ref } from 'vue'

import { API_BASE } from '../config.js'
import { apiFetch } from '../utils/api.js'
import {
  normalizeArchiveList,
  normalizeArchiveApp,
  normalizeCandidateApp,
  normalizeDelistedPayload
} from '../utils/archiveNormalize.js'
import { Toast } from '../components/MobileToast.vue'

export const useArchiveData = ({ ensureAccounts, applyVersionDefaults, prepareVersions }) => {
  const favorites = ref([])
  const delistedApps = ref([])
  const localCandidatesRaw = ref([])
  const remoteDelistedIds = ref(new Set())
  const inReviewIds = ref(new Set())
  const favoritesLoading = ref(false)
  const delistedLoading = ref(false)
  const localCandidatesLoading = ref(false)
  const refreshing = ref(false)

  const localCandidates = computed(() => {
    const remoteIds = remoteDelistedIds.value
    return localCandidatesRaw.value.filter((item) => item.id && !remoteIds.has(String(item.id)) && !inReviewIds.value.has(String(item.id)))
  })

  const integrityWarnings = computed(() => {
    const warnings = []
    for (const delisted of delistedApps.value) {
      const match = favorites.value.find((favorite) => favorite.id === delisted.id && favorite.bundle_id !== delisted.bundle_id)
      if (match) {
        warnings.push({
          appId: delisted.id,
          name: delisted.name,
          message: `收藏版本 bundleId(${match.bundle_id}) 与下架版本(${delisted.bundle_id}) 不一致，可能非同一应用`
        })
      }
    }
    return warnings
  })

  const favoriteVersionItems = computed(() => {
    const items = []
    for (const app of favorites.value) {
      const versions = app.versions || []
      if (versions.length <= 1) {
        const version = versions[0] || {}
        items.push(createFavoriteVersionItem(app, version))
      } else {
        for (const version of versions) {
          items.push(createFavoriteVersionItem(app, version))
        }
      }
    }
    return items
  })

  const loadFavorites = async () => {
    favoritesLoading.value = true
    try {
      const { response, data: res } = await apiFetch(`${API_BASE}/archive`)
      if (response.status === 401) {
        favorites.value = []
        return
      }
      if (!response.ok || !res.ok) throw new Error(res.error || '加载收藏失败')
      favorites.value = normalizeArchiveList(res.data ?? res).map((item) => normalizeArchiveApp(item, false))
      applyVersionDefaults(favorites.value)
    } catch (error) {
      favorites.value = []
      console.warn('[ArchiveApp] loadFavorites failed:', error.message)
    } finally {
      favoritesLoading.value = false
    }
  }

  const loadContributingIds = async () => {
    try {
      const { data: res } = await apiFetch('/api/community/contributing-ids')
      if (res?.ok && res.data) {
        inReviewIds.value = new Set(res.data.in_review || [])
      }
    } catch (error) {
      console.warn('Failed to load contributing-ids:', error)
    }
  }

  const loadDelistedApps = async () => {
    delistedLoading.value = true
    try {
      const { response, data: res } = await apiFetch(`${API_BASE}/community/delisted-index`)
      if (!response.ok || !res.ok) {
        delistedApps.value = []
        return
      }
      delistedApps.value = normalizeDelistedPayload(res.data).map((item) => normalizeArchiveApp(item, true)).filter((item) => item.id)
      remoteDelistedIds.value = new Set(delistedApps.value.map((item) => String(item.id)).filter(Boolean))
      applyVersionDefaults(delistedApps.value)
      await loadContributingIds()
    } catch {
      delistedApps.value = []
    } finally {
      delistedLoading.value = false
    }
  }

  const loadLocalCandidates = async () => {
    localCandidatesLoading.value = true
    try {
      const { response, data: res } = await apiFetch(`${API_BASE}/local/delisted-candidates`)
      if (!response.ok || !res.ok) {
        localCandidatesRaw.value = []
        return
      }
      localCandidatesRaw.value = normalizeArchiveList(res.data).map(normalizeCandidateApp).filter((item) => item.id)
      applyVersionDefaults(localCandidates.value)
    } catch {
      localCandidatesRaw.value = []
    } finally {
      localCandidatesLoading.value = false
    }
  }

  const refreshAll = async () => {
    refreshing.value = true
    try {
      await Promise.all([ensureAccounts(), loadFavorites(), loadDelistedApps()])
      await loadLocalCandidates()
    } finally {
      refreshing.value = false
    }
  }

  const removeFavoriteVersion = async (item) => {
    try {
      const versionId = item.version_id
      const url = versionId
        ? `${API_BASE}/archive/${encodeURIComponent(item.appId)}/versions/${encodeURIComponent(versionId)}`
        : `${API_BASE}/archive/${encodeURIComponent(item.appId)}`
      const { data: res } = await apiFetch(url, { method: 'DELETE' })
      if (!res.ok) throw new Error(res.error || '取消收藏失败')
      await loadFavorites()
      Toast.success('已取消收藏')
    } catch (error) {
      Toast.error(error.message || '取消收藏失败')
    }
  }

  const prepareCommunityApp = async (app) => {
    const versions = await prepareVersions(app, { includeCommunity: true })
    if (versions.length || (app.versions?.length || 0) > 0) return
    try {
      const { response, data: res } = await apiFetch(`${API_BASE}/community/delisted/${encodeURIComponent(app.id)}`)
      if (!response.ok || !res.ok) return
      const fullApp = normalizeArchiveApp(res.data, true)
      const key = app.archive_key || app.id
      delistedApps.value = delistedApps.value.map((item) => (item.id === app.id ? { ...item, ...fullApp, archive_key: key } : item))
      applyVersionDefaults(delistedApps.value)
    } catch {}
  }

  return {
    favorites,
    delistedApps,
    localCandidates,
    remoteDelistedIds,
    inReviewIds,
    favoritesLoading,
    delistedLoading,
    localCandidatesLoading,
    refreshing,
    integrityWarnings,
    favoriteVersionItems,
    loadFavorites,
    loadDelistedApps,
    loadLocalCandidates,
    refreshAll,
    removeFavoriteVersion,
    prepareCommunityApp
  }
}

const createFavoriteVersionItem = (app, version) => ({
  appId: app.id,
  archive_key: app.archive_key,
  name: app.name,
  icon_url: app.icon_url,
  bundle_id: app.bundle_id,
  artist_name: app.artist_name,
  region_label: app.region_label,
  version_id: version.version_id || '',
  version: version.version || '',
  description: version.description || '',
  _ref: app
})
