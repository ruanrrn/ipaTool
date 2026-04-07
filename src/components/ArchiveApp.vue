<template>
  <div class="space-y-4">
    <div class="card">
      <div class="flex items-center space-x-3 mb-2">
        <div class="hero-icon">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div>
          <h2 class="text-xl font-bold text-primary">收藏归档</h2>
          <p class="text-sm text-secondary">查看已收藏应用与已下架应用，选择历史版本后直接发起下载</p>
        </div>
      </div>

      <div class="archive-toolbar inline-panel">
        <div class="text-sm text-secondary">
          下载账号：
          <strong class="text-primary">{{ activeAccountLabel }}</strong>
        </div>
        <div class="archive-toolbar-actions">
          <el-select
            v-if="accounts.length > 1"
            v-model="selectedAccountIndex"
            size="small"
            class="archive-account-select"
            placeholder="选择账号"
          >
            <el-option
              v-for="(account, index) in accounts"
              :key="`${account.email}-${index}`"
              :label="`${account.email} · ${getRegionLabel(account.region || 'US')}`"
              :value="index"
            />
          </el-select>
          <el-button size="small" plain :loading="refreshing" @click="refreshAll">刷新</el-button>
        </div>
      </div>
    </div>

    <section class="card space-y-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-lg font-semibold text-primary">我的收藏</h3>
          <p class="text-sm text-secondary">保存在本地 data/archive/ 的应用</p>
        </div>
        <el-tag size="small" type="primary">{{ favorites.length }}</el-tag>
      </div>

      <div v-if="favoritesLoading" class="section-loading text-secondary">正在加载收藏…</div>
      <div v-else-if="favorites.length === 0" class="empty-state-card">暂无收藏</div>
      <div v-else class="space-y-3">
        <div
          v-for="app in favorites"
          :key="`favorite-${app.id}`"
          class="artifact-row archive-row"
          @click="prepareApp(app)"
        >
          <AppArtwork :src="app.icon_url" :alt="app.name" :label="app.name" />
          <div class="archive-main">
            <div class="archive-top">
              <div class="min-w-0">
                <div class="artifact-title">{{ app.name }}</div>
                <div class="artifact-meta">
                  <span>{{ app.bundle_id || 'Bundle ID 未知' }}</span>
                  <span>收藏于 {{ formatDateTime(app.added_at) }}</span>
                </div>
              </div>
              <el-tag size="small" type="success">已收藏</el-tag>
            </div>

            <div class="archive-actions">
              <el-select
                :model-value="selectedVersionByApp[app.id] || ''"
                size="small"
                filterable
                placeholder="选择版本"
                class="archive-version-select"
                :loading="loadingVersions[app.id]"
                @click.stop="prepareApp(app)"
                @change="(value) => setSelectedVersion(app.id, value)"
              >
                <el-option
                  v-for="version in getVersionOptions(app)"
                  :key="`${app.id}-${version.version_id}`"
                  :label="version.version || version.version_id"
                  :value="version.version_id"
                />
              </el-select>
              <el-button
                type="primary"
                size="small"
                :loading="downloadingAppId === app.id"
                @click.stop="downloadArchivedApp(app)"
              >
                <template #icon>
                  <el-icon><Download /></el-icon>
                </template>
                下载
              </el-button>
              <el-button
                type="danger"
                size="small"
                plain
                @click.stop="removeFavorite(app)"
              >
                <template #icon>
                  <el-icon><Delete /></el-icon>
                </template>
                取消收藏
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="card space-y-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-lg font-semibold text-primary">已下架应用</h3>
          <p class="text-sm text-secondary">来自 ruanrrn/ipa-archive 的公开归档数据</p>
        </div>
        <el-tag size="small">{{ delistedApps.length }}</el-tag>
      </div>

      <div v-if="delistedLoading" class="section-loading text-secondary">正在加载下架数据…</div>
      <div v-else-if="delistedApps.length === 0" class="empty-state-card">暂无下架应用数据</div>
      <div v-else class="space-y-3">
        <div
          v-for="app in delistedApps"
          :key="`delisted-${app.id}`"
          class="artifact-row archive-row"
          @click="prepareApp(app)"
        >
          <AppArtwork :src="app.icon_url" :alt="app.name" :label="app.name" />
          <div class="archive-main">
            <div class="archive-top">
              <div class="min-w-0">
                <div class="artifact-title">{{ app.name }}</div>
                <div class="artifact-meta">
                  <span>{{ app.bundle_id || 'Bundle ID 未知' }}</span>
                  <span v-if="app.artist_name">{{ app.artist_name }}</span>
                  <span v-if="app.added_at">收录于 {{ formatDateTime(app.added_at) }}</span>
                </div>
              </div>
              <el-tag size="small" type="warning">已下架</el-tag>
            </div>

            <div class="archive-actions">
              <el-select
                :model-value="selectedVersionByApp[app.id] || ''"
                size="small"
                filterable
                placeholder="选择版本"
                class="archive-version-select"
                :loading="loadingVersions[app.id]"
                @click.stop="prepareApp(app)"
                @change="(value) => setSelectedVersion(app.id, value)"
              >
                <el-option
                  v-for="version in getVersionOptions(app)"
                  :key="`${app.id}-${version.version_id}`"
                  :label="version.version || version.version_id"
                  :value="version.version_id"
                />
              </el-select>
              <el-button
                type="primary"
                size="small"
                :loading="downloadingAppId === app.id"
                @click.stop="downloadArchivedApp(app)"
              >
                <template #icon>
                  <el-icon><Download /></el-icon>
                </template>
                下载
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete, Download } from '@element-plus/icons-vue'
import AppArtwork from './AppArtwork.vue'
import { useAppStore } from '../stores/app'
import { formatRegion } from '../utils/region.js'

const API_BASE = '/api'
const appStore = useAppStore()

const favorites = ref([])
const delistedApps = ref([])
const favoritesLoading = ref(false)
const delistedLoading = ref(false)
const refreshing = ref(false)
const downloadingAppId = ref('')
const selectedVersionByApp = ref({})
const loadedVersionsByApp = ref({})
const loadingVersions = ref({})
const accounts = ref([])
const selectedAccountIndex = ref(null)

const getRegionLabel = (region) => formatRegion(region)

const activeAccount = computed(() => {
  if (selectedAccountIndex.value === null || selectedAccountIndex.value === undefined) return null
  return accounts.value[selectedAccountIndex.value] || null
})

const activeAccountLabel = computed(() => {
  if (!activeAccount.value) return '未登录账号'
  return `${activeAccount.value.email} · ${getRegionLabel(activeAccount.value.region || 'US')}`
})

watch(selectedAccountIndex, (value) => {
  if (value === null || value === undefined || value === '') return
  localStorage.setItem('ipa_selected_account_index', String(value))
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
  if (!versionId) return null
  return {
    version_id: versionId,
    version: label
  }
}

const normalizeArchiveApp = (app, delisted = false) => ({
  id: String(app?.id ?? app?.app_id ?? app?.trackId ?? ''),
  name: app?.name ?? app?.app_name ?? app?.trackName ?? '未知应用',
  icon_url: app?.icon_url ?? app?.artworkUrl ?? app?.artworkUrl100 ?? app?.artworkUrl60 ?? '',
  bundle_id: app?.bundle_id ?? app?.bundleId ?? '',
  artist_name: app?.artist_name ?? app?.artistName ?? '',
  versions: Array.isArray(app?.versions) ? app.versions.map(normalizeVersion).filter(Boolean) : [],
  delisted: app?.delisted ?? delisted,
  added_at: app?.added_at ?? app?.updated_at ?? app?.created_at ?? '',
  added_by: app?.added_by ?? ''
})

const normalizeDelistedPayload = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.apps)) return payload.apps
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

const sortVersionsDesc = (items) => [...items].sort((a, b) => String(b.version).localeCompare(String(a.version), undefined, { numeric: true, sensitivity: 'base' }))

const getVersionOptions = (app) => {
  const loaded = loadedVersionsByApp.value[app.id]
  if (loaded?.length) return loaded
  return sortVersionsDesc(app.versions || [])
}

const setSelectedVersion = (appId, versionId) => {
  selectedVersionByApp.value = {
    ...selectedVersionByApp.value,
    [appId]: versionId
  }
}

const ensureAccounts = async () => {
  try {
    const saved = JSON.parse(localStorage.getItem('ipa_accounts') || '[]')
    accounts.value = Array.isArray(saved) ? saved : []
  } catch {
    accounts.value = []
  }

  try {
    const response = await fetch(`${API_BASE}/accounts`, { credentials: 'include' })
    const data = await response.json()
    if (data.ok && Array.isArray(data.data)) {
      accounts.value = data.data.map((account) => ({
        token: account.token,
        email: account.email,
        dsid: account.dsid,
        region: account.region || 'US'
      }))
      localStorage.setItem('ipa_accounts', JSON.stringify(accounts.value))
    }
  } catch {}

  if (!accounts.value.length) {
    selectedAccountIndex.value = null
    return
  }

  const savedIndex = Number.parseInt(localStorage.getItem('ipa_selected_account_index') || '', 10)
  selectedAccountIndex.value = Number.isInteger(savedIndex) && savedIndex >= 0 && savedIndex < accounts.value.length ? savedIndex : 0
}

const applyVersionDefaults = (apps) => {
  const nextSelected = { ...selectedVersionByApp.value }
  const nextLoaded = { ...loadedVersionsByApp.value }

  for (const app of apps) {
    const options = getVersionOptions(app)
    if (options.length) {
      nextLoaded[app.id] = options
      if (!nextSelected[app.id]) {
        nextSelected[app.id] = options[0].version_id
      }
    }
  }

  loadedVersionsByApp.value = nextLoaded
  selectedVersionByApp.value = nextSelected
}

const loadFavorites = async () => {
  favoritesLoading.value = true
  try {
    const response = await fetch(`${API_BASE}/archive`, { credentials: 'include' })
    const data = await response.json()
    if (!data.ok) throw new Error(data.error || '加载收藏失败')
    favorites.value = (data.data || []).map((item) => normalizeArchiveApp(item, false))
    applyVersionDefaults(favorites.value)
  } catch (error) {
    favorites.value = []
    ElMessage.error(error.message || '加载收藏失败')
  } finally {
    favoritesLoading.value = false
  }
}

const loadDelistedApps = async () => {
  delistedLoading.value = true
  try {
    const response = await fetch(`${API_BASE}/archive/delisted`, { credentials: 'include' })
    const data = await response.json()
    if (!data.ok) throw new Error(data.error || '加载下架应用失败')
    delistedApps.value = normalizeDelistedPayload(data.data).map((item) => normalizeArchiveApp(item, true)).filter((item) => item.id)
    applyVersionDefaults(delistedApps.value)
  } catch (error) {
    delistedApps.value = []
    ElMessage.error(error.message || '加载下架应用失败')
  } finally {
    delistedLoading.value = false
  }
}

const refreshAll = async () => {
  refreshing.value = true
  await Promise.all([ensureAccounts(), loadFavorites(), loadDelistedApps()])
  refreshing.value = false
}

const prepareApp = async (app) => {
  const cachedVersions = loadedVersionsByApp.value[app.id]
  if (cachedVersions?.length) return
  if (loadingVersions.value[app.id]) return
  loadingVersions.value = { ...loadingVersions.value, [app.id]: true }
  try {
    const region = activeAccount.value?.region || 'US'
    const response = await fetch(`${API_BASE}/versions?appid=${encodeURIComponent(app.id)}&region=${encodeURIComponent(region)}`, { credentials: 'include' })
    const data = await response.json()
    if (data.ok && Array.isArray(data.data) && data.data.length) {
      const versions = sortVersionsDesc(data.data.map(normalizeVersion).filter(Boolean))
      loadedVersionsByApp.value = {
        ...loadedVersionsByApp.value,
        [app.id]: versions
      }
      if (!selectedVersionByApp.value[app.id] && versions[0]) {
        setSelectedVersion(app.id, versions[0].version_id)
      }
    } else if (!getVersionOptions(app).length) {
      ElMessage.warning('未获取到可用版本')
    }
  } catch (error) {
    if (!getVersionOptions(app).length) {
      ElMessage.warning(error.message || '加载版本失败')
    }
  } finally {
    loadingVersions.value = { ...loadingVersions.value, [app.id]: false }
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

const removeFavorite = async (app) => {
  try {
    const response = await fetch(`${API_BASE}/archive/${encodeURIComponent(app.id)}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    const data = await response.json()
    if (!data.ok) throw new Error(data.error || '取消收藏失败')
    favorites.value = favorites.value.filter((item) => item.id !== app.id)
    ElMessage.success('已取消收藏')
  } catch (error) {
    ElMessage.error(error.message || '取消收藏失败')
  }
}

const downloadArchivedApp = async (app) => {
  try {
    const account = await requireActiveAccount()
    let selectedVersion = selectedVersionByApp.value[app.id]
    if (!selectedVersion) {
      await prepareApp(app)
      selectedVersion = selectedVersionByApp.value[app.id]
    }
    if (!selectedVersion) throw new Error('请先选择版本')

    downloadingAppId.value = app.id
    const versionInfo = getVersionOptions(app).find((item) => item.version_id === selectedVersion)
    const response = await fetch(`${API_BASE}/start-download-direct`, {
      method: 'POST',
      credentials: 'include',
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
    const data = await response.json()
    if (!data.ok || !data.jobId) {
      throw new Error(data.error || '创建下载任务失败')
    }

    appStore.addToQueue({
      id: data.jobId,
      appName: app.name,
      artworkUrl: app.icon_url || '',
      artistName: app.artist_name || '',
      version: versionInfo?.version || '',
      account,
      accountEmail: account.email || '',
      status: 'downloading',
      progress: 0,
      logs: '',
      timestamp: new Date().toISOString()
    })
    appStore.activeTab = 'ipa'
    ElMessage.success('已加入下载队列')
  } catch (error) {
    ElMessage.error(error.message || '下载失败')
  } finally {
    downloadingAppId.value = ''
  }
}

const formatDateTime = (value) => {
  if (!value) return '未知时间'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

onMounted(refreshAll)
</script>

<style scoped>
.archive-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.archive-toolbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.archive-account-select {
  width: 280px;
  max-width: 100%;
}

/* Archive list rows: don't rely on IpaManager's scoped styles */
.archive-row {
  cursor: pointer;
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
}

.artifact-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.artifact-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3-5);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.archive-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.archive-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.archive-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.archive-actions :deep(.el-button) {
  margin: 0;
}

.archive-version-select {
  width: 220px;
  max-width: 100%;
}

.empty-state-card,
.section-loading {
  border-radius: var(--radius-card);
  border: var(--border-width-thin) dashed var(--separator);
  background: var(--card-bg);
  padding: var(--space-5);
  text-align: center;
}

@media (max-width: 767px) {
  .archive-top {
    flex-direction: column;
    align-items: flex-start;
  }

  /* Give the artwork + content room on narrow screens */
  .archive-row {
    padding: var(--space-3);
  }

  .archive-actions {
    display: grid;
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .archive-actions :deep(.el-button) {
    width: 100%;
    justify-content: center;
  }

  .archive-version-select,
  .archive-account-select {
    width: 100%;
  }
}
</style>
