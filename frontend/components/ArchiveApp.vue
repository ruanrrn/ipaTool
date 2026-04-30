<template>
  <div class="archive-page space-y-0">
    <div class="archive-page__fixed px-5">
      <!-- Page Title -->
      <h1 class="page-title text-txt dark:text-txt-dark">
        收藏
      </h1>

      <div class="archive-segment">
        <button
          class="archive-seg"
          :class="{ active: activeTab === 'favorites' }"
          @click="activeTab = 'favorites'"
        >
          收藏 ({{ favoriteVersionItems.length }})
        </button>
        <button
          class="archive-seg"
          :class="{ active: activeTab === 'delisted' }"
          @click="activeTab = 'delisted'"
        >
          已下架 ({{ delistedApps.length }})
        </button>
      </div>
    </div>

    <div class="archive-page__scroll">
      <div class="archive-page__scroll-inner px-5">
        <div
          v-show="activeTab === 'favorites'"
          class="archive-panel"
        >
          <div
            v-if="favoritesLoading"
            class="archive-empty archive-empty--loading"
          >
            <EmptyState
              type="loading"
              text=""
            />
          </div>
          <div
            v-else-if="favorites.length === 0"
            class="archive-empty"
          >
            <EmptyState
              type="empty"
              text="暂无收藏"
            />
          </div>
          <div
            v-else
            class="fav-list"
          >
            <div
              v-for="item in favoriteVersionItems"
              :key="`fav-${item.appId}-${item.version_id || item.version || 'default'}`"
              class="fav-item"
              @click="prepareApp(item._ref)"
            >
              <AppArtwork
                :src="item.icon_url"
                :alt="item.name"
                :label="item.name"
                class="fav-item__icon"
              />
              <div class="fav-item__info">
                <div class="fav-item__name-row">
                  <span class="fav-item__name">{{ item.name }}</span>
                  <span
                    v-if="item.version"
                    class="fav-item__ver"
                  >v{{ item.version }}</span>
                </div>
                <div class="fav-item__dev-row">
                  <span v-if="item.artist_name">{{ item.artist_name }}</span>
                  <span v-if="item.artist_name && (item.region_label)">&nbsp;·&nbsp;</span>
                  <span v-if="item.region_label">{{ item.region_label }}</span>
                </div>
                <div
                  v-if="item.description"
                  class="fav-item__note"
                >
                  {{ item.description }}
                </div>
              </div>
              <div class="fav-item__actions">
                <button
                  class="fav-btn fav-btn--dl"
                  :disabled="downloadingAppId === (item.archive_key || item.appId)"
                  title="下载"
                  @click.stop="downloadArchivedVersion(item)"
                >
                  <SvgIcon
                    class="h-[15px] w-[15px]"
                    :icon="downloadIcon"
                  />
                </button>
                <button
                  class="fav-btn fav-btn--unfav"
                  title="取消收藏"
                  @click.stop="removeFavoriteVersion(item)"
                >
                  <SvgIcon
                    class="h-[15px] w-[15px]"
                    :icon="starFilledIcon"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          v-show="activeTab === 'delisted'"
          class="archive-panel"
        >
          <div
            v-if="integrityWarnings.length"
            class="integrity-warnings"
          >
            <div
              v-for="w in integrityWarnings"
              :key="w.appId"
              class="integrity-warning"
            >
              ⚠️ {{ w.name }}：{{ w.message }}
            </div>
          </div>

          <div class="archive-section">
            <div class="archive-section__header">
              <div>
                <div class="archive-section__title">社区归档</div>
                <div class="archive-section__desc">读取官方下架索引，可直接查看和下载已公开归档版本</div>
              </div>
              <div class="archive-section__meta">{{ delistedApps.length }} 项</div>
            </div>

            <div
              v-if="delistedLoading"
              class="archive-empty archive-empty--loading"
            >
              <EmptyState type="loading" text="" />
            </div>
            <div
              v-else-if="delistedApps.length === 0"
              class="archive-empty"
            >
              <EmptyState type="empty" text="暂无社区下架归档" />
            </div>
            <div
              v-else
              class="fav-list"
            >
              <div
                v-for="app in delistedApps"
                :key="`delisted-${app.archive_key || app.id}`"
                class="fav-item"
                @click="prepareCommunityApp(app)"
              >
                <AppArtwork
                  :src="app.icon_url"
                  :alt="app.name"
                  :label="app.name"
                  class="fav-item__icon"
                />
                <div class="fav-item__info">
                  <div class="fav-item__name-row">
                    <span class="fav-item__name">{{ app.name }}</span>
                    <span
                      v-if="getSelectedVersion(app)"
                      class="fav-item__ver"
                    >v{{ getSelectedVersion(app) }}</span>
                  </div>
                  <div class="fav-item__dev-row">
                    <span v-if="app.artist_name">{{ app.artist_name }}</span>
                    <span v-if="app.artist_name && app.bundle_id">&nbsp;·&nbsp;</span>
                    <span v-if="app.bundle_id">{{ app.bundle_id }}</span>
                  </div>
                </div>
                <div class="fav-item__actions">
                  <button
                    class="fav-btn fav-btn--dl"
                    :disabled="downloadingAppId === (app.archive_key || app.id)"
                    title="下载"
                    @click.stop="downloadArchivedApp(app)"
                  >
                    <SvgIcon class="h-[15px] w-[15px]" :icon="downloadIcon" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="archive-section archive-section--contribution">
            <div class="archive-section__header">
              <div>
                <div class="archive-section__title">本地待贡献</div>
                <div class="archive-section__desc">从本地下载记录聚合，自动过滤社区已收录条目；配置 GitHub PAT 后可贡献</div>
              </div>
              <div class="archive-section__meta">{{ localCandidates.length }} 项</div>
            </div>

            <div
              v-if="localCandidatesLoading"
              class="archive-empty archive-empty--loading"
            >
              <EmptyState type="loading" text="" />
            </div>
            <div
              v-else-if="localCandidates.length === 0"
              class="archive-empty"
            >
              <EmptyState type="empty" text="暂无本地待贡献应用" />
            </div>
            <div
              v-else
              class="fav-list"
            >
              <div
                v-for="app in localCandidates"
                :key="`candidate-${app.archive_key || app.id}`"
                class="fav-item"
                @click="githubTokenConfigured ? prepareCandidateContribution(app) : null"
              >
                <AppArtwork
                  :src="app.icon_url"
                  :alt="app.name"
                  :label="app.name"
                  class="fav-item__icon"
                />
                <div class="fav-item__info">
                  <div class="fav-item__name-row">
                    <span class="fav-item__name">{{ app.name }}</span>
                    <span
                      v-if="getSelectedVersion(app)"
                      class="fav-item__ver"
                    >v{{ getSelectedVersion(app) }}</span>
                    <span class="fav-item__tag">待贡献</span>
                  </div>
                  <div class="fav-item__dev-row">
                    <span v-if="app.artist_name">{{ app.artist_name }}</span>
                    <span v-if="app.artist_name && app.bundle_id">&nbsp;·&nbsp;</span>
                    <span v-if="app.bundle_id">{{ app.bundle_id }}</span>
                  </div>
                </div>
                <div class="fav-item__actions">
                  <button
                    v-if="githubTokenConfigured"
                    class="fav-btn fav-btn--publish"
                    :disabled="contributingAppId === (app.archive_key || app.id)"
                    title="贡献到社区"
                    @click.stop="prepareCandidateContribution(app)"
                  >
                    ↑
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="fav-hint">
          点击 ★ 可取消收藏 · 同一应用可收藏多个版本
        </div>
      </div>
    </div>

    <!-- Publish Dialog -->
    <MobileDialog
      v-model="publishDialog.visible"
      title="发布到 GitHub"
    >
      <div class="space-y-3">
        <div class="text-sm text-txt-secondary dark:text-txt-dark-secondary">
          将 <strong class="text-txt dark:text-txt-dark">{{ publishDialog.appName }}</strong> 发布到 GitHub 仓库
        </div>
        <div
          v-if="publishDialog.warnings.length"
          class="text-sm text-yellow-600 dark:text-yellow-400 space-y-1"
        >
          <div v-for="(w, i) in publishDialog.warnings" :key="i">⚠️ {{ w }}</div>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm text-txt dark:text-txt-dark">备注（每行一条）</label>
          <textarea
            v-model="publishDialog.notes"
            rows="3"
            class="w-full rounded border border-border dark:border-border-dark bg-bg dark:bg-bg-dark px-3 py-2 text-sm text-txt dark:text-txt-dark focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="可选备注..."
          />
        </div>
        <div
          v-if="publishDialog.result"
          class="text-sm"
          :class="publishDialog.result.ok ? 'text-brand' : 'text-danger'"
        >
          {{ publishDialog.result.msg }}
        </div>
      </div>
      <template #footer>
        <div class="flex gap-2 justify-end">
          <MobileButton
            size="small"
            @click="publishDialog.visible = false"
          >
            取消
          </MobileButton>
          <MobileButton
            type="primary"
            size="small"
            :loading="publishDialog.loading"
            @click="doPublish"
          >
            确认发布
          </MobileButton>
        </div>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup>
import { computed, onMounted, onActivated, reactive, ref, watch } from 'vue'
import { API_BASE } from '../config.js'

import { Toast } from './MobileToast.vue'
import AppArtwork from './AppArtwork.vue'
import SvgIcon from './SvgIcon.vue'
import EmptyState from './EmptyState.vue'
import { useAppStore } from '../stores/app'
import { STORAGE_KEYS } from '../utils/storage.js'
import MobileButton from './MobileButton.vue'
import MobileDialog from './MobileDialog.vue'
import { apiFetch } from '../utils/api.js'
import downloadIcon from '../assets/icons/download.svg?raw'
import starFilledIcon from '../assets/icons/star-filled.svg?raw'

const appStore = useAppStore()

const activeTab = computed({
  get: () => appStore.archiveTab || 'favorites',
  set: (value) => {
    appStore.archiveTab = value
  }
})

const favorites = ref([])
const delistedApps = ref([])
const localCandidatesRaw = ref([])
const remoteDelistedIds = ref(new Set())
const inReviewIds = ref(new Set())
const favoritesLoading = ref(false)
const delistedLoading = ref(false)
const localCandidatesLoading = ref(false)
const refreshing = ref(false)
const downloadingAppId = ref('')
const contributingAppId = ref('')
const selectedVersionByApp = ref({})
const loadedVersionsByApp = ref({})
const loadingVersions = ref({})
const accounts = ref([])
const selectedAccountIndex = ref(null)

const activeAccount = computed(() => {
  if (selectedAccountIndex.value === null || selectedAccountIndex.value === undefined) return null
  return accounts.value[selectedAccountIndex.value] || null
})

const githubTokenConfigured = computed(() => appStore.githubTokenStatus.configured)
const localCandidates = computed(() => {
  const remoteIds = remoteDelistedIds.value
  return localCandidatesRaw.value.filter((item) => item.id && !remoteIds.has(String(item.id)) && !inReviewIds.value.has(String(item.id)))
})

const normalizeArchiveList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.apps)) return payload.apps
  return []
}

watch(selectedAccountIndex, (value) => {
  if (value === null || value === undefined || value === '') return
  localStorage.setItem(STORAGE_KEYS.SELECTED_ACCOUNT_INDEX, String(value))
})

const normalizeVersion = (version) => {
  const versionId = String(
    version?.version_id
    ?? version?.appVersionId
    ?? version?.external_identifier
    ?? version?.id
    ?? ''
  )
  const label = String(
    version?.version
    ?? version?.bundle_version
    ?? version?.name
    ?? versionId
  )
  if (!versionId && !label) return null
  return {
    version_id: versionId,
    version: label,
    description: version?.description || '',
    size_bytes: version?.size_bytes ?? null,
    released_at: version?.released_at ?? null,
  }
}

const getArchiveKey = (app) => {
  const id = String(app?.id ?? app?.app_id ?? app?.trackId ?? '')
  const bundleId = app?.bundle_id ?? app?.bundleId ?? ''
  const kind = app?.delisted ? 'delisted' : 'fav'
  return `${kind}:${id}:${bundleId}`
}

const COMMUNITY_ARCHIVE_RAW = 'https://raw.githubusercontent.com/ruanrrn/ipa-archive/main'

const normalizeArchiveApp = (app, delisted = false) => {
  const iconAsset = app?.icon_asset ?? ''
  const resolvedIconUrl = (app?.icon_url ?? app?.artworkUrl ?? app?.artworkUrl100 ?? app?.artworkUrl60 ?? '') || (iconAsset ? `${COMMUNITY_ARCHIVE_RAW}/${iconAsset}` : '')
  const normalized = {
    id: String(app?.id ?? app?.app_id ?? app?.trackId ?? ''),
    name: app?.name ?? app?.app_name ?? app?.trackName ?? '未知应用',
    icon_url: resolvedIconUrl,
    icon_asset: iconAsset,
    bundle_id: app?.bundle_id ?? app?.bundleId ?? '',
    artist_name: app?.artist_name ?? app?.artistName ?? '',
    versions: Array.isArray(app?.versions) ? app.versions.map(normalizeVersion).filter(Boolean) : [],
    latest_version: app?.latest_version ?? '',
    delisted: app?.delisted ?? delisted,
    added_at: app?.added_at ?? app?.updated_at ?? app?.created_at ?? '',
    added_by: app?.added_by ?? '',
    notes: Array.isArray(app?.notes) ? app.notes : [],
    note: app?.note || ''
  }
  normalized.archive_key = getArchiveKey(normalized)
  return normalized
}

const normalizeDelistedPayload = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.apps)) return payload.apps
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

const normalizeCandidateApp = (app) => {
  const normalized = normalizeArchiveApp(app, true)
  normalized.already_archived_locally = Boolean(app?.already_archived_locally)
  return normalized
}

const sortVersionsDesc = (items) => [...items].sort((a, b) => String(b.version).localeCompare(String(a.version), undefined, { numeric: true, sensitivity: 'base' }))

const integrityWarnings = computed(() => {
  const warnings = []
  for (const delisted of delistedApps.value) {
    const match = favorites.value.find(f => f.id === delisted.id && f.bundle_id !== delisted.bundle_id)
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

const getVersionOptions = (app) => {
  const key = app.archive_key || app.id
  const loaded = loadedVersionsByApp.value[key]
  if (loaded?.length) return loaded
  return sortVersionsDesc(app.versions || [])
}

const getSelectedVersion = (app) => {
  const key = app.archive_key || app.id
  const versionId = selectedVersionByApp.value[key]
  if (!versionId) return ''
  const options = getVersionOptions(app)
  const found = options.find(v => v.version_id === versionId)
  return found ? found.version : ''
}

const favoriteVersionItems = computed(() => {
  const items = []
  for (const app of favorites.value) {
    const versions = app.versions || []
    if (versions.length <= 1) {
      // 单版本或无版本：保持原条目
      const v = versions[0] || {}
      items.push({
        appId: app.id,
        archive_key: app.archive_key,
        name: app.name,
        icon_url: app.icon_url,
        bundle_id: app.bundle_id,
        artist_name: app.artist_name,
        region_label: app.region_label,
        version_id: v.version_id || '',
        version: v.version || '',
        description: v.description || '',
        _ref: app  // 保留对原始 app 对象的引用
      })
    } else {
      // 多版本：每个版本一个条目
      for (const v of versions) {
        items.push({
          appId: app.id,
          archive_key: app.archive_key,
          name: app.name,
          icon_url: app.icon_url,
          bundle_id: app.bundle_id,
          artist_name: app.artist_name,
          region_label: app.region_label,
          version_id: v.version_id || '',
          version: v.version || '',
          description: v.description || '',
          _ref: app
        })
      }
    }
  }
  return items
})

const setSelectedVersion = (appId, versionId) => {
  selectedVersionByApp.value = {
    ...selectedVersionByApp.value,
    [appId]: versionId
  }
}

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

const applyVersionDefaults = (apps) => {
  const nextSelected = { ...selectedVersionByApp.value }
  const nextLoaded = { ...loadedVersionsByApp.value }

  for (const app of apps) {
    const key = app.archive_key || app.id
    const options = getVersionOptions(app)
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
    // 加载审核中的 app IDs
    try {
      const { data: res } = await apiFetch('/api/community/contributing-ids')
      if (res?.ok && res.data) {
        inReviewIds.value = new Set(res.data.in_review || [])
      }
    } catch (e) {
      console.warn('Failed to load contributing-ids:', e)
    }
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

const prepareApp = async (app) => {
  const key = app.archive_key || app.id
  const cachedVersions = loadedVersionsByApp.value[key]
  if (cachedVersions?.length) return
  if (loadingVersions.value[key]) return
  loadingVersions.value = { ...loadingVersions.value, [key]: true }
  try {
    const region = activeAccount.value?.region || 'US'
    const { data: res } = await apiFetch(`${API_BASE}/versions?appid=${encodeURIComponent(app.id)}&region=${encodeURIComponent(region)}`)
    if (res.ok && Array.isArray(res.data) && res.data.length) {
      const versions = sortVersionsDesc(res.data.map(normalizeVersion).filter(Boolean))
      loadedVersionsByApp.value = {
        ...loadedVersionsByApp.value,
        [key]: versions
      }
      if (!selectedVersionByApp.value[key] && versions[0]) {
        setSelectedVersion(key, versions[0].version_id)
      }
    } else if (!getVersionOptions(app).length) {
      Toast.warning('未获取到可用版本')
    }
  } catch (error) {
    if (!getVersionOptions(app).length) {
      Toast.warning(error.message || '加载版本失败')
    }
  } finally {
    loadingVersions.value = { ...loadingVersions.value, [key]: false }
  }
}

const requireActiveAccount = async () => {
  await ensureAccounts()
  const account = activeAccount.value
  if (!account?.token) {
    throw new Error('请先在账号页登录 Apple ID')
  }
  return account
}

const removeFavoriteVersion = async (item) => {
  try {
    const versionId = item.version_id
    const url = versionId
      ? `${API_BASE}/archive/${encodeURIComponent(item.appId)}/versions/${encodeURIComponent(versionId)}`
      : `${API_BASE}/archive/${encodeURIComponent(item.appId)}`
    const { data: res } = await apiFetch(url, { method: 'DELETE' })
    if (!res.ok) throw new Error(res.error || '取消收藏失败')
    // 重新加载列表
    await loadFavorites()
    Toast.success('已取消收藏')
  } catch (error) {
    Toast.error(error.message || '取消收藏失败')
  }
}

const downloadArchivedApp = async (app) => {
  try {
    const account = await requireActiveAccount()
    const archiveKey = app.archive_key || app.id
    let selectedVersion = selectedVersionByApp.value[archiveKey]
    if (!selectedVersion) {
      await prepareApp(app)
      selectedVersion = selectedVersionByApp.value[archiveKey]
    }
    if (!selectedVersion) {
      await prepareCommunityApp(app)
      selectedVersion = selectedVersionByApp.value[archiveKey]
    }
    if (!selectedVersion) throw new Error('请先选择版本')

    downloadingAppId.value = archiveKey
    const versionInfo = getVersionOptions(app).find((item) => item.version_id === selectedVersion)
    const { data: res } = await apiFetch(`${API_BASE}/start-download-direct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: account.token,
        appid: app.id,
        appVerId: selectedVersion,
        appName: app.name,
        bundleId: app.bundle_id || undefined,
        artworkUrl: app.icon_url || undefined,
        appVersion: versionInfo?.version || undefined,
        artistName: app.artist_name || undefined
      })
    })
    if (!res.ok) {
      if (res.needsPurchase) {
        throw new Error(res.error || '当前账号未购买/未领取该应用')
      }
      throw new Error(res.error || '创建下载任务失败')
    }
    const payload = res.data || {}
    const jobId = payload.jobId
    if (!jobId) throw new Error('创建下载任务失败')

    appStore.addToQueue({
      id: jobId,
      appName: app.name,
      artworkUrl: app.icon_url || '',
      artistName: app.artist_name || '',
      version: versionInfo?.version || '',
      account,
      accountEmail: account.email || '',
      status: payload.reused ? 'ready' : 'downloading',
      progress: 0,
      logs: '',
      timestamp: new Date().toISOString(),
      ...(payload.reused ? {
        recordId: payload.recordId,
        downloadUrl: payload.downloadUrl,
        installUrl: payload.installUrl,
        fileSize: payload.fileSize
      } : {})
    })
    appStore.activeTab = payload.reused ? 'history' : 'ipa'
    Toast.success(payload.reused ? '文件已就绪' : '已加入下载队列')
  } catch (error) {
    Toast.error(error.message || '下载失败')
  } finally {
    downloadingAppId.value = ''
  }
}

const downloadArchivedVersion = async (item) => {
  try {
    const account = await requireActiveAccount()
    if (!item.version_id) throw new Error('请先选择版本')
    downloadingAppId.value = item.archive_key || item.appId
    const { data: res } = await apiFetch(`${API_BASE}/start-download-direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: account.token,
        appid: item.appId,
        appVerId: item.version_id,
        appName: item.name,
        bundleId: item.bundle_id || undefined,
        artworkUrl: item.icon_url || undefined,
        appVersion: item.version || undefined,
        artistName: item.artist_name || undefined
      })
    })
    if (!res.ok) {
      if (res.needsPurchase) {
        throw new Error(res.error || '当前账号未购买/未领取该应用')
      }
      throw new Error(res.error || '下载失败')
    }
    const payload = res.data || {}
    if (!payload.jobId) throw new Error('创建下载任务失败')

    appStore.addToQueue({
      id: payload.jobId,
      appName: item.name,
      artworkUrl: item.icon_url || '',
      artistName: item.artist_name || '',
      version: item.version || '',
      account,
      accountEmail: account.email || '',
      status: payload.reused ? 'ready' : 'downloading',
      progress: 0,
      logs: '',
      timestamp: new Date().toISOString(),
      ...(payload.reused ? {
        recordId: payload.recordId,
        downloadUrl: payload.downloadUrl,
        installUrl: payload.installUrl,
        fileSize: payload.fileSize
      } : {})
    })
    appStore.activeTab = payload.reused ? 'history' : 'ipa'
    Toast.success(payload.reused ? '文件已就绪' : `已加入下载队列：${item.name} v${item.version}`)
  } catch (error) {
    Toast.error(error.message || '下载失败')
  } finally {
    downloadingAppId.value = ''
  }
}

const prepareCommunityApp = async (app) => {
  await prepareApp(app)
  if ((app.versions?.length || 0) > 0) return
  try {
    const { response, data: res } = await apiFetch(`${API_BASE}/community/delisted/${encodeURIComponent(app.id)}`)
    if (!response.ok || !res.ok) return
    const fullApp = normalizeArchiveApp(res.data, true)
    const key = app.archive_key || app.id
    delistedApps.value = delistedApps.value.map((item) => (item.id === app.id ? { ...item, ...fullApp, archive_key: key } : item))
    applyVersionDefaults(delistedApps.value)
  } catch {}
}

const openPublishDialog = (prepared) => {
  publishDialog.visible = true
  publishDialog.appId = prepared.app_id || prepared.app?.id || ''
  publishDialog.appName = prepared.app?.name || ''
  publishDialog.warnings = prepared.warnings || []
  publishDialog.notes = (prepared.app?.notes || []).join('\n')
  publishDialog.iconDataUrl = prepared.icon_data_url || ''
  publishDialog.result = null
}

const prepareCandidateContribution = async (app) => {
  if (!githubTokenConfigured.value) {
    Toast.warning('请先到设置页配置 GitHub PAT')
    return
  }
  if (remoteDelistedIds.value.has(String(app.id))) {
    Toast.warning('该应用已存在于社区归档，无需重复贡献')
    return
  }
  contributingAppId.value = app.archive_key || app.id
  try {
    const { response, data: res } = await apiFetch(`${API_BASE}/community/prepare-contribution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: app.id,
        notes: [],
      }),
    })
    if (!response.ok || !res.ok) throw new Error(res.error || '生成贡献预览失败')
    const prepared = res.data
    if (!prepared.github_token_configured) {
      Toast.warning('尚未配置 GitHub PAT，发布前请先到设置页保存')
    }
    openPublishDialog({
      ...prepared,
      icon_data_url: prepared.icon_data_url || app.icon_url || '',
    })
  } catch (error) {
    Toast.error(error.message || '生成贡献预览失败')
  } finally {
    contributingAppId.value = ''
  }
}

// ---- Publish ----
const publishDialog = reactive({
  visible: false,
  appId: '',
  appName: '',
  notes: '',
  iconDataUrl: '',
  warnings: [],
  loading: false,
  result: null,
})

const doPublish = async () => {
  publishDialog.loading = true
  publishDialog.result = null
  try {
    let iconBase64 = null
    if (publishDialog.iconDataUrl) {
      const match = publishDialog.iconDataUrl.match(/^data:[^;]+;base64,(.+)$/)
      if (match) iconBase64 = match[1]
    }
    const notes = publishDialog.notes.split('\n').map(s => s.trim()).filter(Boolean)
    const { response, data: res } = await apiFetch(`${API_BASE}/community/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: publishDialog.appId,
        notes,
        icon_data_base64: iconBase64,
      }),
    })
    if (!response.ok || !res.ok) throw new Error(res.error || '发布失败')
    const d = res.data
    const msg = d.pr_url
      ? `✅ PR 已创建: ${d.pr_url}\n提交文件: ${d.files_committed?.join(', ') || ''}`
      : `✅ 已提交到分支，请手动创建 PR`
    publishDialog.result = { ok: true, msg }
    Toast.success('发布成功')
  } catch (e) {
    publishDialog.result = { ok: false, msg: e.message || '发布失败' }
    Toast.error(e.message || '发布失败')
  } finally {
    publishDialog.loading = false
  }
}

onMounted(async () => {
  await Promise.all([
    refreshAll(),
    appStore.loadGithubTokenStatus().catch((error) => {
      console.warn('[ArchiveApp] loadGithubTokenStatus failed:', error.message)
    })
  ])
})

onActivated(async () => {
  await Promise.all([
    refreshAll(),
    appStore.loadGithubTokenStatus().catch((error) => {
      console.warn('[ArchiveApp] loadGithubTokenStatus failed:', error.message)
    })
  ])
})
</script>

<style scoped>
.archive-page {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-size: var(--font-size-md);
}

.archive-page__fixed {
  flex-shrink: 0;
  padding-top: 20px;
}

.archive-page__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.archive-page__scroll-inner {
  padding-bottom: 24px;
}

.archive-panel {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

/* Page title */
.page-title {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.3;
  margin-bottom: 16px;
}

/* Toolbar */
.fav-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.fav-account-select {
  width: 200px;
  max-width: 100%;
}

/* Empty state */
.archive-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 220px;
  padding: 8px 0 16px;
}

/* Favorite Item */
.fav-item {
 display: flex;
 align-items: center;
 gap: 12px;
 padding: 14px;
 background: var(--color-surface, #fff);
 border: 1px solid var(--color-border, #ebebeb);
 border-radius: 14px;
 margin-bottom: 8px;
 cursor: pointer;
 transition: opacity 0.2s ease;
}
.fav-item:active {
 opacity: 0.8;
}
.dark .fav-item {
 background: var(--color-surface, #18181b);
 border-color: var(--color-surface-muted, #27272a);
}

/* Segment Control */
.archive-segment {
 display: flex;
 gap: 0;
 background: var(--color-surface-muted, #f7f7f8);
 border-radius: 12px;
 padding: 3px;
 margin-bottom: 0;
}
.dark .archive-segment {
 background: var(--color-surface, #18181b);
}

.archive-seg {
 flex: 1;
 padding: 9px;
 text-align: center;
 font-size: 13px;
 font-weight: 500;
 border-radius: 10px;
 color: var(--color-text-muted, #6e6e80);
 border: none;
 background: transparent;
 cursor: pointer;
 transition: all 0.2s ease;
 -webkit-tap-highlight-color: transparent;
}
.dark .archive-seg {
 color: var(--color-text-muted, #a1a1aa);
}

.archive-seg.active {
 background: var(--color-surface, #fff);
 color: var(--color-text, #0d0d0d);
 box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
.dark .archive-seg.active {
 background: var(--color-surface-muted, #27272a);
 color: var(--color-text, #f5f5f5);
 box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.dark .fav-item {
 background: var(--color-surface, #18181b);
 border-color: var(--color-surface-muted, #27272a);
}

/* Favorite list container — gap handled by fav-item margin-bottom */
.fav-list {
  padding-top: 8px;
}

.archive-section {
  margin-top: 16px;
}

.archive-section--contribution {
  margin-top: 22px;
}

.archive-section__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: nowrap;
}

.archive-section__header > div:first-child {
  min-width: 0;
  flex: 1;
  max-width: calc(100% - 56px);
}

.archive-section__meta {
  flex-shrink: 0;
  white-space: nowrap;
}

.archive-section__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text, #0d0d0d);
}

.archive-section__desc,
.archive-section__meta,
.fav-item__meta {
  font-size: 12px;
  color: var(--color-text-muted, #6e6e80);
}

.archive-section__desc {
  margin-top: 4px;
}

.dark .archive-section__title {
  color: var(--color-text, #f5f5f5);
}

.dark .archive-section__desc,
.dark .archive-section__meta,
.dark .fav-item__meta {
  color: var(--color-text-muted, #a1a1aa);
}

/* Icon — override AppArtwork sizing */
.fav-item__icon {
  width: 44px !important;
  height: 44px !important;
  border-radius: 11px !important;
  flex-shrink: 0;
}

/* Info area */
.fav-item__info {
  flex: 1;
  min-width: 0;
}

.fav-item__name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  min-width: 0;
  max-width: 100%;
}

.fav-item__name {
 font-size: 14px;
 font-weight: 600;
 color: var(--color-text, #0d0d0d);
 white-space: nowrap;
 overflow: hidden;
 text-overflow: ellipsis;
 min-width: 0;
 flex: 0 1 auto;
}
.dark .fav-item__name {
 color: var(--color-text, #f5f5f5);
}

.fav-item__ver {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  border: 1px solid var(--color-primary-border);
  border-radius: 10px;
  padding: 2px 7px;
  line-height: 1.2;
  flex-shrink: 0;
}
:global(.dark) .fav-item__ver {
  background: rgba(16, 163, 127, 0.15);
  border-color: rgba(16, 163, 127, 0.3);
  color: var(--color-primary);
}

.fav-item__dev-row {
 font-size: 11px;
 color: var(--color-text-muted, #6e6e80);
 margin-top: 2px;
 white-space: nowrap;
 overflow: hidden;
 text-overflow: ellipsis;
}
.dark .fav-item__dev-row {
 color: var(--color-text-muted, #a1a1aa);
}

/* Note */
.fav-item__note {
  font-size: 11px;
  color: var(--color-text-muted, #6e6e80);
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
  line-height: 1.3;
  font-style: italic;
}

.fav-item__tag {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  border: 1px solid var(--color-primary-border);
  border-radius: 999px;
  padding: 2px 8px;
}
.fav-item__note::before {
  content: '"';
}
.fav-item__note::after {
  content: '"';
}
.dark .fav-item__note {
  color: var(--color-text-muted, #a1a1aa);
}

/* Actions — horizontal layout matching design */
.fav-item__actions {
  display: flex;
  flex-direction: row;
  gap: 6px;
  flex-shrink: 0;
  align-items: center;
}

.fav-version-select {
  width: 140px;
  max-width: 100%;
}

/* Favorite buttons */
.fav-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--color-border, #ebebeb);
  background: var(--color-surface, #fff);
  color: var(--color-text-muted, #6e6e80);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
  padding: 0;
  flex-shrink: 0;
}
.dark .fav-btn {
  background: var(--color-surface, #18181b);
  border-color: var(--color-surface-muted, #27272a);
  color: var(--color-text-muted, #a1a1aa);
}
.fav-btn:active {
  opacity: 0.7;
}
.fav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.fav-btn svg {
  width: 15px;
  height: 15px;
}

.fav-btn--dl {
  color: var(--color-primary);
  border-color: var(--color-primary-border);
}
.dark .fav-btn--dl {
  background: rgba(16, 163, 127, 0.15);
  border-color: rgba(16, 163, 127, 0.3);
  color: var(--color-primary);
}

.fav-btn--unfav {
  color: var(--color-danger);
  border-color: var(--color-danger-border);
}
.dark .fav-btn--unfav {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: var(--color-danger-hover);
}

.fav-btn--publish {
  color: var(--color-primary);
  border-color: var(--color-primary-border);
  font-size: 16px;
  font-weight: 700;
}
.dark .fav-btn--publish {
  background: rgba(16, 163, 127, 0.15);
  border-color: rgba(16, 163, 127, 0.3);
  color: var(--color-primary);
}

/* Action button (shared with IpaManager) */
.q-btn {
 width: 32px;
 height: 32px;
 border-radius: 8px;
 border: 1px solid var(--color-border, #ebebeb);
 background: var(--color-surface, #fff);
 color: var(--color-text-muted, #6e6e80);
 display: flex;
 align-items: center;
 justify-content: center;
 cursor: pointer;
 transition: all 0.2s ease;
 -webkit-tap-highlight-color: transparent;
 padding: 0;
}
.dark .q-btn {
 background: var(--color-surface, #18181b);
 border-color: var(--color-surface-muted, #27272a);
 color: var(--color-text-muted, #a1a1aa);
}
.q-btn:active {
  opacity: 0.7;
}

/* Bottom hint */
.fav-hint {
 font-size: 11px;
 color: var(--color-text-tertiary, #c0c0c0);
 text-align: center;
 padding: 12px 0;
}
.dark .fav-hint {
 color: var(--color-text-tertiary, #71717a);
}

/* Delisted section — visually minimal */
.fav-delisted-section {
 margin-top: 20px;
 opacity: 0.7;
}

/* Integrity warnings */
.integrity-warnings {
  margin-bottom: 12px;
}
.integrity-warning {
  font-size: 12px;
  color: var(--color-warning, #f59e0b);
  background: var(--color-warning-soft, rgba(245, 158, 11, 0.1));
  border: 1px solid var(--color-warning-border, rgba(245, 158, 11, 0.3));
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 6px;
  line-height: 1.4;
}
.dark .integrity-warning {
  color: #fbbf24;
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.25);
}
.fav-delisted-title {
 font-size: 12px;
 font-weight: 500;
 color: var(--color-text-muted, #6e6e80);
 margin-bottom: 10px;
}
.dark .fav-delisted-title {
 color: var(--color-text-muted, #a1a1aa);
}

.dark .archive-empty {
 color: var(--color-text-muted, #a1a1aa);
}

/* Spin animation */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.animate-spin {
  animation: spin 1s linear infinite;
}

@media (max-width: 767px) {
  .fav-account-select {
    width: 100%;
  }
}
</style>
