import { computed, ref } from 'vue'

import { API_BASE } from '../config.js'
import { apiFetch } from '../utils/api.js'
import { normalizeVersion, sortVersionsDesc } from '../utils/archiveNormalize.js'

const getArchiveKey = (app) => app?.archive_key || app?.id || ''
const hasVersionId = (version) => Boolean(String(version?.version_id || '').trim())

const mergeVersions = (...groups) => {
  const byId = new Map()
  const fallback = []

  for (const group of groups) {
    for (const raw of group || []) {
      const normalized = normalizeVersion(raw)
      if (!normalized) continue
      const id = String(normalized.version_id || '').trim()
      if (id) {
        byId.set(id, { ...(byId.get(id) || {}), ...normalized, version_id: id })
      } else {
        fallback.push(normalized)
      }
    }
  }

  return sortVersionsDesc([...byId.values(), ...fallback])
}

export const useArchiveVersions = ({ activeAccount } = {}) => {
  const selectedVersionByApp = ref({})
  const loadedVersionsByApp = ref({})
  const loadingVersions = ref({})

  const isVersionLoading = computed(() => (app) => Boolean(loadingVersions.value[getArchiveKey(app)]))

  const getVersionOptions = (app) => {
    const key = getArchiveKey(app)
    const loaded = loadedVersionsByApp.value[key]
    if (loaded?.length) return loaded
    return sortVersionsDesc(app?.versions || [])
  }

  const getSelectedVersionId = (app) => {
    const key = getArchiveKey(app)
    return selectedVersionByApp.value[key] || ''
  }

  const getSelectedVersion = (app) => {
    const versionId = getSelectedVersionId(app)
    if (!versionId) return ''
    const found = getVersionOptions(app).find((version) => version.version_id === versionId)
    return found ? found.version : ''
  }

  const setSelectedVersion = (appOrKey, versionId) => {
    const key = typeof appOrKey === 'string' ? appOrKey : getArchiveKey(appOrKey)
    if (!key) return
    selectedVersionByApp.value = {
      ...selectedVersionByApp.value,
      [key]: versionId
    }
  }

  const setLoadedVersions = (appOrKey, versions) => {
    const key = typeof appOrKey === 'string' ? appOrKey : getArchiveKey(appOrKey)
    if (!key) return
    const normalized = mergeVersions(versions).filter(hasVersionId)
    loadedVersionsByApp.value = {
      ...loadedVersionsByApp.value,
      [key]: normalized
    }
    if (!selectedVersionByApp.value[key] && normalized[0]) {
      setSelectedVersion(key, normalized[0].version_id)
    }
  }

  const applyVersionDefaults = (apps) => {
    const nextSelected = { ...selectedVersionByApp.value }
    const nextLoaded = { ...loadedVersionsByApp.value }

    for (const app of apps || []) {
      const key = getArchiveKey(app)
      if (!key) continue
      const options = getVersionOptions(app).filter(hasVersionId)
      if (options.length) {
        nextLoaded[key] = options
        if (!nextSelected[key]) {
          nextSelected[key] = options[0].version_id
        }
      }
    }

    loadedVersionsByApp.value = nextLoaded
    selectedVersionByApp.value = nextSelected
  }

  const fetchStoreVersions = async (app) => {
    const region = activeAccount?.value?.region || 'US'
    const { data: res } = await apiFetch(`${API_BASE}/versions?appid=${encodeURIComponent(app.id)}&region=${encodeURIComponent(region)}`)
    if (res?.ok && Array.isArray(res.data)) return res.data
    return []
  }

  const prepareVersions = async (app, { force = false } = {}) => {
    const key = getArchiveKey(app)
    if (!key) return []
    const cachedVersions = loadedVersionsByApp.value[key]
    if (!force && cachedVersions?.length) {
      return cachedVersions
    }
    if (loadingVersions.value[key]) return cachedVersions || getVersionOptions(app)

    loadingVersions.value = { ...loadingVersions.value, [key]: true }
    try {
      const baseVersions = app?.versions || []
      const storeVersions = await fetchStoreVersions(app).catch(() => [])
      const versions = mergeVersions(baseVersions, storeVersions).filter(hasVersionId)
      if (versions.length) {
        setLoadedVersions(key, versions)
      }
      return versions
    } finally {
      loadingVersions.value = { ...loadingVersions.value, [key]: false }
    }
  }

  return {
    selectedVersionByApp,
    loadedVersionsByApp,
    loadingVersions,
    isVersionLoading,
    getVersionOptions,
    getSelectedVersionId,
    getSelectedVersion,
    setSelectedVersion,
    setLoadedVersions,
    applyVersionDefaults,
    prepareVersions,
    mergeVersions
  }
}
