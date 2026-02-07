<template>
  <div class="card">
    <div class="flex items-center space-x-3 mb-6">
      <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg">
        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </div>
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">下载与签名</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">搜索应用、查询版本并下载IPA文件</p>
      </div>
    </div>

    <!-- Search Section -->
    <div class="space-y-4 mb-6">
      <!-- 账号选择提示 -->
      <div v-if="accounts.length === 0" class="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
        <div class="flex items-start space-x-3">
          <svg class="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div class="flex-1">
            <h4 class="font-semibold text-orange-900 dark:text-orange-300">需要先登录账号</h4>
            <p class="text-sm text-orange-700 dark:text-orange-400 mt-1">请先在"账号"标签页登录 Apple ID 账号，然后才能搜索应用。</p>
            <el-button 
              @click="goToAccountTab" 
              type="warning" 
              size="small" 
              class="mt-2"
              plain
            >
              前往登录
            </el-button>
          </div>
        </div>
      </div>

      <!-- 搜索区域提示 -->
      <div v-else class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
        <div class="flex items-center space-x-2">
          <svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-sm text-blue-700 dark:text-blue-400">
            搜索区域: <strong>{{ getRegionLabel(accounts[selectedAccount]?.region || 'US') }}</strong>
            <span class="text-xs opacity-75 ml-1">(基于当前选择的账号)</span>
          </span>
        </div>
      </div>

      <el-input
        v-model="searchQuery"
        @input="handleSearch"
        @keyup.enter="handleSearch"
        placeholder="搜索应用名称、Bundle ID 或 App ID..."
        :prefix-icon="Search"
        :loading="searching"
        :disabled="accounts.length === 0"
        clearable
        size="large"
        class="search-input"
      />

      <!-- Search Results -->
      <el-scrollbar v-if="searchResults.length > 0" max-height="256px">
        <div class="space-y-2">
          <div
            v-for="app in searchResults"
            :key="app.trackId"
            @click="selectApp(app)"
            class="flex items-center space-x-4 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-all duration-200 border border-transparent hover:border-primary-300 dark:hover:border-primary-700"
          >
            <img 
              :src="app.artworkUrl100 || app.artworkUrl60" 
              :alt="app.trackName"
              class="w-12 h-12 rounded-lg shadow-md object-cover"
            />
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-gray-900 dark:text-white truncate text-sm">{{ app.trackName }}</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ app.artistName }}</p>
            </div>
            <el-icon class="w-5 h-5 text-gray-400 flex-shrink-0"><ArrowRight /></el-icon>
          </div>
        </div>
      </el-scrollbar>
    </div>

    <div v-if="selectedApp" class="space-y-4">
      <!-- Selected App Info -->
      <div class="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
        <div class="flex items-center space-x-4">
          <img 
            :src="selectedApp.artworkUrl100 || selectedApp.artworkUrl60" 
            :alt="selectedApp.trackName"
            class="w-16 h-16 rounded-xl shadow-md object-cover"
          />
          <div class="flex-1">
            <h3 class="font-semibold text-gray-900 dark:text-white">{{ selectedApp.trackName }}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ selectedApp.artistName }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">版本: {{ selectedApp.version }} | ID: {{ selectedApp.trackId }}</p>
          </div>
        </div>
      </div>

      <!-- Download Options -->
      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            选择账号
            <span v-if="selectedAccount !== '' && selectedAccount !== null" class="ml-2 text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">
              商店区域: {{ getRegionLabel(accounts[selectedAccount]?.region || 'US') }}
            </span>
          </label>
          <el-select 
            v-model="selectedAccount"
            placeholder="请先登录账号"
            class="w-full form-select"
            @change="handleAccountChange"
            :disabled="accounts.length === 0"
          >
            <el-option
              v-for="(account, index) in accounts"
              :key="index"
              :label="account.email"
              :value="index"
            >
              <div class="flex items-center justify-between w-full">
                <span class="flex-1 truncate">{{ account.email }}</span>
                <span class="region-badge ml-2" :class="`region-${(account.region || 'US').toLowerCase()}`">
                  {{ getRegionLabel(account.region || 'US') }}
                </span>
              </div>
            </el-option>
          </el-select>
          <p v-if="accounts.length === 0" class="text-xs text-orange-600 dark:text-orange-400 mt-1">
            ⚠️ 请先登录账号
          </p>
          <p v-else class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            ✅ 搜索和下载将使用此账号的 {{ getRegionLabel(accounts[selectedAccount]?.region || 'US') }} 商店
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">APPID</label>
          <el-input
            v-model="appid"
            placeholder="例如：1160172628"
            class="form-input"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">版本（历史版本下拉）</label>
          <el-select 
            v-model="selectedVersion"
            @change="handleVersionChange"
            placeholder="请先查询版本"
            class="w-full form-select"
            :disabled="!versionsFetched"
            :loading="fetchingVersions"
          >
            <el-option
              v-for="version in versions"
              :key="version.external_identifier"
              :label="`${version.bundle_version} | ${version.created_at}`"
              :value="version.external_identifier"
            />
          </el-select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">appVerId（自动填充）</label>
          <el-input
            v-model="appVerId"
            placeholder="external_identifier"
            readonly
            class="form-input"
          />
        </div>

        <el-space direction="vertical" :size="12" fill style="width: 100%">
          <el-button
            @click="fetchVersions"
            :disabled="!appid || fetchingVersions"
            :loading="fetchingVersions"
            type="info"
            class="w-full action-button"
          >
            <template #icon>
              <el-icon><Search /></el-icon>
            </template>
            查询版本
          </el-button>

          <el-button
            @click="directLinkDownload"
            :disabled="!selectedAccount && selectedAccount !== 0"
            type="info"
            class="w-full action-button"
          >
            <template #icon>
              <el-icon><Download /></el-icon>
            </template>
            直链：从苹果服务器下载
          </el-button>

          <el-button
            @click="startDownloadWithProgress"
            :disabled="!selectedAccount && selectedAccount !== 0"
            :loading="downloading"
            type="primary"
            class="w-full action-button"
          >
            <template #icon>
              <el-icon><Download /></el-icon>
            </template>
            {{ downloading ? '处理中...' : '带进度：签名后下载' }}
          </el-button>
        </el-space>
      </div>

      <!-- Progress Box -->
      <el-card v-if="showProgress" class="mt-4" shadow="never">
        <div class="flex justify-between items-center mb-2">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ progressStage }}</span>
          <span class="text-sm font-bold text-blue-600 dark:text-blue-400">{{ progressPercent }}%</span>
        </div>
        <el-progress 
          :percentage="progressPercent" 
          :stroke-width="10"
          class="mb-3"
        />
        <el-scrollbar max-height="160px">
          <pre class="bg-black rounded-lg p-3 text-green-400 text-xs whitespace-pre-wrap font-mono">{{ logs }}</pre>
        </el-scrollbar>
      </el-card>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-12 text-gray-500 dark:text-gray-400">
      <svg class="mx-auto h-16 w-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
      <p class="text-lg font-medium">未选择应用</p>
      <p class="text-sm mt-2">请先在上方搜索并选择一个应用</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useAppStore } from '../stores/app'
import { Search, ArrowRight, Download } from '@element-plus/icons-vue'
import { storage } from '../composables/useStorage.js'
import { apiService } from '../services/api.js'

const props = defineProps({
  selectedApp: {
    type: Object,
    default: null
  },
  accountsUpdated: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['download-started', 'app-selected'])

// 获取区域标签
const getRegionLabel = (region) => {
  const regionMap = {
    'US': '🇺🇸 US',
    'CN': '🇨🇳 CN',
    'JP': '🇯🇵 JP',
    'GB': '🇬🇧 GB',
    'DE': '🇩🇪 DE',
    'FR': '🇫🇷 FR',
    'CA': '🇨🇦 CA',
    'AU': '🇦🇺 AU'
  }
  return regionMap[region] || region
}

// 处理账号选择变化
const handleAccountChange = () => {
  const account = accounts.value[selectedAccount.value]
  if (account) {
    console.log(`[DownloadManager] Selected account: ${account.email}, Region: ${account.region || 'US'}`)
  }
  
  // 清空之前查询的版本信息
  versions.value = []
  selectedVersion.value = ''
  appVerId.value = ''
  versionsFetched.value = false
  
  // 同步状态到store
  syncStateToStore()
}

// 自动选择第一个账号
const autoSelectFirstAccount = () => {
  if (accounts.value.length > 0 && (selectedAccount.value === '' || selectedAccount.value === null)) {
    selectedAccount.value = 0
    console.log(`[DownloadManager] Auto-selected first account: ${accounts.value[0].email}`)
  }
}

const accounts = ref([])
const selectedAccount = ref('')
const appid = ref('')
const appVerId = ref('')
const versions = ref([])
const selectedVersion = ref('')
const versionsFetched = ref(false)
const fetchingVersions = ref(false)
const downloading = ref(false)

// Progress state - sync with store
const showProgress = ref(false)
const progressPercent = ref(0)
const progressStage = ref('等待任务…')
const logs = ref('')

// Search state
const searchQuery = ref('')
const searchResults = ref([])
const searching = ref(false)

// Sync state with store on mount and update
const syncStateToStore = () => {
  const appStore = useAppStore()
  appStore.updateDownloadState('selectedAccount', selectedAccount.value)
  appStore.updateDownloadState('appid', appid.value)
  appStore.updateDownloadState('appVerId', appVerId.value)
  appStore.updateDownloadState('versions', versions.value)
  appStore.updateDownloadState('selectedVersion', selectedVersion.value)
  appStore.updateDownloadState('versionsFetched', versionsFetched.value)
  appStore.updateDownloadState('showProgress', showProgress.value)
  appStore.updateDownloadState('progressPercent', progressPercent.value)
  appStore.updateDownloadState('progressStage', progressStage.value)
  appStore.updateDownloadState('logs', logs.value)
}

const restoreStateFromStore = () => {
  const appStore = useAppStore()
  const state = appStore.downloadState
  if (state.selectedAccount !== undefined) selectedAccount.value = state.selectedAccount
  if (state.appid !== undefined) appid.value = state.appid
  if (state.appVerId !== undefined) appVerId.value = state.appVerId
  if (state.versions !== undefined) versions.value = state.versions
  if (state.selectedVersion !== undefined) selectedVersion.value = state.selectedVersion
  if (state.versionsFetched !== undefined) versionsFetched.value = state.versionsFetched
  if (state.showProgress !== undefined) showProgress.value = state.showProgress
  if (state.progressPercent !== undefined) progressPercent.value = state.progressPercent
  if (state.progressStage !== undefined) progressStage.value = state.progressStage
  if (state.logs !== undefined) logs.value = state.logs
}

// Watch state changes and sync to store
watch([selectedAccount, appid, appVerId, versions, selectedVersion, versionsFetched, showProgress, progressPercent, progressStage, logs], () => {
  syncStateToStore()
}, { deep: true })

const loadAccounts = async () => {
  try {
    const allAccounts = await storage.getAllAccounts()
    accounts.value = allAccounts
    // 自动选择第一个账号
    autoSelectFirstAccount()
  } catch (error) {
    console.error('Failed to load accounts:', error)
    accounts.value = []
  }
}

const addLog = (message) => {
  const timestamp = new Date().toLocaleTimeString()
  logs.value += `[${timestamp}] ${message}\n`
}

// 跳转到账号标签页
const goToAccountTab = () => {
  const appStore = useAppStore()
  appStore.activeTab = 'account'
}

// Search functionality - 使用所选账号的区域
const handleSearch = useDebounceFn(async () => {
  const query = searchQuery.value.trim()
  if (!query) {
    searchResults.value = []
    return
  }

  // 检查是否已选择账号
  if (accounts.value.length === 0 || selectedAccount.value === '' || selectedAccount.value === null) {
    searchResults.value = []
    return
  }

  searching.value = true
  try {
    // 获取当前选择账号的区域
    const account = accounts.value[selectedAccount.value]
    const region = account?.region || 'US'
    
    // 根据区域搜索应用
    const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&country=${region}&media=software&limit=10`)
    const data = await response.json()
    
    if (data.results) {
      searchResults.value = data.results
    } else {
      searchResults.value = []
    }
  } catch (error) {
    console.error('Search failed:', error)
    searchResults.value = []
  } finally {
    searching.value = false
  }
}, 300)

const selectApp = (app) => {
  emit('app-selected', app)
  searchQuery.value = ''
  searchResults.value = []
}

// Watch for selectedApp changes to auto-fill appid
watch(() => props.selectedApp, (newApp) => {
  if (newApp && newApp.trackId) {
    appid.value = String(newApp.trackId)
  }
}, { immediate: true })

// Watch for accounts changes to auto-select first account
watch(accounts, () => {
  autoSelectFirstAccount()
}, { deep: true, immediate: true })

// Watch for account and appid changes to auto-fetch versions
watch([selectedAccount, appid], ([newAccount, newAppid]) => {
  if (newAccount !== '' && newAccount !== null && newAppid) {
    // 自动查询版本
    fetchVersions()
  }
})

const fetchVersions = async () => {
  if (!appid.value) {
    alert('请填写 APPID')
    return
  }

  if (selectedAccount.value === '' || selectedAccount.value === null) {
    alert('请先选择账号')
    return
  }

  const account = accounts.value[selectedAccount.value]

  fetchingVersions.value = true
  addLog(`[查询] 正在查询 APPID=${appid.value} 的历史版本（区域：${getRegionLabel(account.region || 'US')}）...`)

  try {
    const result = await apiService.getApp(appid.value, account)

    if (!result.ok) {
      alert(`查询失败：${result.error || '未知错误'}`)
      addLog(`[查询] 失败：${result.error || '未知错误'}`)
      return
    }

    // 处理返回的版本数据
    const app = result.data
    versions.value = app && app.bundleId ? [{
      bundleId: app.bundleId,
      version: app.version,
      appVerId: app.appVerId || app.trackId,
      displayName: app.trackName || app.bundleId
    }] : []

    versionsFetched.value = true
    addLog(`[查询] 获取到 ${versions.value.length} 条版本记录`)
  } catch (error) {
    alert(`查询失败：${error.message}`)
    addLog(`[查询] 失败：${error.message}`)
  } finally {
    fetchingVersions.value = false
  }
}

const handleVersionChange = () => {
  appVerId.value = selectedVersion.value || ''
}

const directLinkDownload = async () => {
  if (!selectedAccount.value && selectedAccount.value !== 0) {
    alert('请选择登录账号')
    return
  }
  if (!appid.value) {
    alert('请填写 APPID')
    return
  }

  const account = accounts.value[selectedAccount.value]
  addLog('[直链] 获取直链中…')

  try {
    const result = await apiService.getDownloadUrl(appid.value, appVerId.value, account)

    if (!result.ok) {
      alert(`直链获取失败：${result.error || '未知错误'}`)
      addLog(`[直链] 失败：${result.error || '未知错误'}`)
      return
    }

    const { url, fileName } = result.data
    addLog(`[直链] 成功：文件名=${fileName}，即将从 Apple CDN 直连下载`)
    addLog(`[直链] URL（部分）=${String(url).slice(0, 80)}...`)

    // Trigger browser download
    const a = document.createElement('a')
    a.href = url
    a.download = fileName || ''
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } catch (error) {
    alert(`直链获取失败：${error.message}`)
    addLog(`[直链] 失败：${error.message}`)
  }
}

const startDownloadWithProgress = async () => {
  if (!selectedAccount.value && selectedAccount.value !== 0) {
    alert('请选择登录账号')
    return
  }
  if (!appid.value) {
    alert('请填写 APPID')
    return
  }

  const account = accounts.value[selectedAccount.value]
  
  // Reset progress
  showProgress.value = true
  progressPercent.value = 0
  progressStage.value = '准备中…'
  logs.value = ''
  addLog('[进度] 创建下载任务…')

  try {
    const response = await fetch(`${API_BASE}/start-download-direct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: account.token,
        appid: appid.value,
        appVerId: appVerId.value || undefined
      })
    })
    const data = await response.json()

    if (!data.ok) {
      alert(`创建任务失败：${data.error || '未知错误'}`)
      addLog(`[进度] 创建任务失败：${data.error || '未知错误'}`)
      return
    }

    const { jobId } = data
    addLog(`[进度] 任务已创建：${jobId}`)

    // 添加到队列
    const queueItem = {
      id: jobId,
      app: props.selectedApp || { trackName: appid.value, artworkUrl100: '', artworkUrl60: '' },
      account: account,
      status: 'downloading',
      progress: 0,
      logs: logs.value,
      timestamp: new Date().toISOString()
    }
    emit('download-started', queueItem)

    // Connect to SSE
    connectToSSE(jobId, queueItem)
  } catch (error) {
    alert(`创建任务失败：${error.message}`)
    addLog(`[进度] 创建任务失败：${error.message}`)
  }
}

const connectToSSE = (jobId, queueItem) => {
  const es = new EventSource(`${API_BASE}/progress-sse?jobId=${encodeURIComponent(jobId)}`)

  es.addEventListener('progress', (ev) => {
    try {
      const data = JSON.parse(ev.data)
      
      if (data?.progress?.percent != null) {
        progressPercent.value = data.progress.percent
        // 更新队列项进度
        if (queueItem) {
          queueItem.progress = data.progress.percent
        }
      }
      
      if (data?.progress?.stage) {
        const stageMap = {
          'auth': '获取下载信息',
          'download-start': '开始下载',
          'download-progress': '下载中',
          'merge': '合并分块',
          'sign': '写入签名',
          'done': '完成'
        }
        progressStage.value = stageMap[data.progress.stage] || data.progress.stage
        // 更新队列项状态
        if (queueItem) {
          queueItem.stage = progressStage.value
        }
      }
      
      if (data?.error) {
        addLog(`[错误] ${data.error}`)
        if (queueItem) {
          queueItem.status = 'error'
          queueItem.error = data.error
        }
      }
      
      if (data.status === 'ready') {
        progressStage.value = '准备下载文件…'
        const a = document.createElement('a')
        a.href = `${API_BASE}/download-file?jobId=${encodeURIComponent(jobId)}`
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        a.remove()
        
        progressPercent.value = 100
        progressStage.value = '已开始下载'
        addLog('[进度] 文件下载已开始')
        
        // 更新队列项状态
        if (queueItem) {
          queueItem.status = 'completed'
          queueItem.progress = 100
        }
      }
    } catch (e) {
      console.error(e)
    }
  })

  es.addEventListener('log', (ev) => {
    try {
      const { line } = JSON.parse(ev.data)
      if (line) {
        addLog(line)
        if (queueItem) {
          queueItem.logs = logs.value
        }
      }
    } catch (_) {}
  })

  es.addEventListener('end', (ev) => {
    try {
      const data = JSON.parse(ev.data || '{}')
      if (data.status === 'ready') {
        addLog('[完成] 任务已就绪')
      } else if (data.status === 'failed') {
        addLog('[失败] 任务失败')
        if (queueItem) {
          queueItem.status = 'error'
        }
      } else {
        addLog(`[结束] 任务结束：${data.status || 'unknown'}`)
      }
    } catch (_) {}
    es.close()
  })

  es.onerror = () => {
    addLog('[错误] SSE 连接断开')
    if (queueItem) {
      queueItem.status = 'error'
      queueItem.error = 'SSE 连接断开'
    }
    es.close()
  }
}

// 监听账号更新
watch(() => props.accountsUpdated, () => {
  loadAccounts()
})

onMounted(() => {
  loadAccounts()
  restoreStateFromStore()
})
</script>

<style scoped>
.search-input :deep(.el-input__wrapper) {
  border-radius: 12px;
  padding: 8px 16px;
}

.search-input :deep(.el-input__inner) {
  font-size: 15px;
}

.form-select :deep(.el-select__wrapper) {
  border-radius: 12px;
}

.form-input :deep(.el-input__wrapper) {
  border-radius: 12px;
}

.action-button {
  border-radius: 12px;
  font-weight: 500;
  height: 44px;
}

.action-button :deep(.el-icon) {
  font-size: 18px;
}

.log-container {
  background-color: rgba(0, 0, 0, 0.03);
  border-radius: 12px;
  padding: 16px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.6;
  max-height: 300px;
  overflow-y: auto;
}

.dark .log-container {
  background-color: rgba(0, 0, 0, 0.3);
}

.log-entry {
  padding: 4px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.dark .log-entry {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.log-entry:last-child {
  border-bottom: none;
}

.log-time {
  color: #9ca3af;
  font-size: 12px;
}

.dark .log-time {
  color: #6b7280;
}

.log-content {
  color: #374151;
}

.dark .log-content {
  color: #d1d5db;
}

.log-success {
  color: #059669;
}

.dark .log-success {
  color: #34d399;
}

.log-error {
  color: #dc2626;
}

.dark .log-error {
  color: #f87171;
}

/* 区域徽章样式 */
.region-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.region-us {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.15) 100%);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.dark .region-us {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(37, 99, 235, 0.25) 100%);
  color: #60a5fa;
  border-color: rgba(59, 130, 246, 0.4);
}

.region-cn {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.15) 100%);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.dark .region-cn {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(220, 38, 38, 0.25) 100%);
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.4);
}

.region-jp {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.15) 100%);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.dark .region-jp {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(5, 150, 105, 0.25) 100%);
  color: #34d399;
  border-color: rgba(16, 185, 129, 0.4);
}

.region-gb,
.region-de,
.region-fr,
.region-ca,
.region-au {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(124, 58, 237, 0.15) 100%);
  color: #8b5cf6;
  border: 1px solid rgba(139, 92, 246, 0.3);
}

.dark .region-gb,
.dark .region-de,
.dark .region-fr,
.dark .region-ca,
.dark .region-au {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(124, 58, 237, 0.25) 100%);
  color: #a78bfa;
  border-color: rgba(139, 92, 246, 0.4);
}

.log-info {
  color: #2563eb;
}

.dark .log-info {
  color: #60a5fa;
}
</style>
