<template>
  <div class="card">
    <div class="flex items-center space-x-3 mb-6">
      <div class="hero-icon">
        <svg
          class="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
      </div>
      <div>
        <h2 class="text-xl font-bold text-primary">
          下载与签名
        </h2>
        <p class="text-sm text-secondary">
          搜索应用、查询版本并下载IPA文件
        </p>
      </div>
    </div>

    <!-- Search Section -->
    <div class="space-y-4 mb-6">
      <!-- 账号选择提示 -->
      <div
        v-if="accounts.length === 0"
        class="status-panel p-4"
      >
        <div class="flex items-start space-x-3">
          <svg
            class="w-5 h-5 text-secondary mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div class="flex-1">
            <h4 class="font-semibold text-primary">
              需要先登录账号
            </h4>
            <p class="text-sm text-secondary mt-1">
              请先在"账号"标签页登录 Apple ID 账号，然后才能搜索应用。
            </p>
            <el-button 
              type="primary"
              size="small"
              class="mt-2"
              plain
              @click="goToAccountTab"
            >
              前往登录
            </el-button>
          </div>
        </div>
      </div>

      <!-- 账号选择区域 -->
      <div
        v-else
        class="status-panel p-4"
      >
        <div class="account-toolbar">
          <div class="flex items-center space-x-2 min-w-0">
            <svg
              class="w-4 h-4 flex-shrink-0 text-accent-blue"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span class="text-[var(--font-size-sm)] text-secondary whitespace-nowrap">
              搜索区域: <strong>{{ getRegionLabel(accounts[selectedAccount]?.region || 'US') }}</strong>
            </span>
          </div>
          <el-select 
            v-model="selectedAccount"
            placeholder="选择账号"
            class="account-quick-select"
            size="small"
            @change="handleAccountChange"
          >
            <el-option
              v-for="(account, index) in accounts"
              :key="index"
              :label="account.email"
              :value="index"
            >
              <div class="account-option-row">
                <span class="account-option-email">{{ account.email }}</span>
                <span
                  class="region-badge-mini"
                  :class="`region-${(account.region || 'US').toLowerCase()}`"
                >
                  {{ getRegionLabel(account.region || 'US') }}
                </span>
              </div>
            </el-option>
          </el-select>
        </div>
      </div>

      <!-- Search Mode Toggle -->
      <div class="inline-panel search-mode-row">
        <label class="flex items-center space-x-2 cursor-pointer">
          <input
            v-model="searchMode"
            type="radio"
            value="search"
            class="w-4 h-4 text-accent-blue focus:ring-primary-500"
          >
          <span class="text-sm font-medium text-primary">搜索应用</span>
        </label>
        <label class="flex items-center space-x-2 cursor-pointer">
          <input
            v-model="searchMode"
            type="radio"
            value="appid"
            class="w-4 h-4 text-accent-blue focus:ring-primary-500"
          >
          <span class="text-sm font-medium text-primary">直接输入 App ID</span>
        </label>
      </div>

      <el-input
        v-model="searchQuery"
        :placeholder="searchMode === 'search' ? '搜索应用名称、Bundle ID 或 App ID...' : '输入 App ID（纯数字）...'"
        :prefix-icon="Search"
        :loading="searching"
        :disabled="accounts.length === 0"
        clearable
        size="large"
        class="search-input"
        @input="handleSearch"
        @keyup.enter="handleSearch"
      />

      <!-- Direct App ID Confirm Button -->
      <div
        v-if="searchMode === 'appid' && searchQuery && /^\d+$/.test(searchQuery.trim()) && !searching"
        class="status-panel mt-3 flex items-center justify-between p-4"
      >
        <div class="flex-1">
          <p class="text-sm font-medium text-secondary">
            App ID: <span class="font-bold">{{ searchQuery.trim() }}</span>
          </p>
          <p class="text-xs text-secondary mt-1">
            即使未找到应用信息，也可以继续查询版本号
          </p>
        </div>
        <el-button
          type="primary"
          size="default"
          @click="confirmDirectAppId"
        >
          确认并继续
        </el-button>
      </div>

      <!-- Search Results -->
      <el-scrollbar
        v-if="searchResults.length > 0"
        max-height="256px"
      >
        <div class="space-y-2">
          <div
            v-for="app in searchResults"
            :key="app.trackId"
            class="search-result-item flex cursor-pointer items-center space-x-4 rounded-[var(--radius-card)] p-3 transition-all duration-200"
            @click="selectApp(app)"
          >
            <img 
              :src="app.artworkUrl100 || app.artworkUrl60"
              :alt="app.trackName"
              class="w-12 h-12 rounded-lg object-cover"
            >
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-primary truncate text-sm">
                {{ app.trackName }}
              </h3>
              <p class="text-xs text-secondary">
                {{ app.artistName }}
              </p>
            </div>
            <el-icon class="w-5 h-5 text-secondary flex-shrink-0">
              <ArrowRight />
            </el-icon>
          </div>
        </div>
      </el-scrollbar>
    </div>

    <div
      v-if="selectedApp"
      class="space-y-4"
    >
      <!-- Selected App Info -->
      <div class="selected-app-card selected-app-card p-4">
        <div class="flex items-center space-x-4">
          <img 
            v-if="!selectedApp.isDirectAppId"
            :src="selectedApp.artworkUrl100 || selectedApp.artworkUrl60"
            :alt="selectedApp.trackName"
            class="w-16 h-16 rounded-[var(--radius-artwork-lg)] object-cover"
          >
          <div 
            v-else
            class="w-16 h-16 rounded-[var(--radius-artwork)] object-cover border border-[var(--separator)] bg-[var(--card-bg)] flex items-center justify-center"
          >
            <svg
              class="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="font-semibold text-primary">
              {{ selectedApp.trackName }}
            </h3>
            <p class="text-sm text-secondary">
              {{ selectedApp.artistName }}
            </p>
            <p class="text-xs text-tertiary mt-1">
              版本: {{ selectedApp.version }} | ID: {{ selectedApp.trackId }}
              <span
                v-if="selectedApp.isDirectAppId"
                class="ml-2 px-2 py-0.5 inline-panel rounded-[var(--radius-control)] text-xs"
              >
                直接输入
              </span>
            </p>
            <div class="selected-app-badges mt-2">
              <span class="selected-app-badge">价格：{{ getSelectedAppPriceLabel() }}</span>
              <span class="selected-app-badge">大小：{{ getSelectedAppSizeLabel() }}</span>
              <span class="selected-app-badge">购买状态：{{ getPurchaseBehaviorLabel() }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Download Options -->
      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-primary mb-2">
            选择账号
            <span
              v-if="selectedAccount !== null && selectedAccount !== undefined && selectedAccount !== ''"
              class="ml-2 text-xs px-2 py-1 inline-panel rounded-[var(--radius-control)]"
            >
              商店区域: {{ getRegionLabel(accounts[selectedAccount]?.region || 'US') }}
            </span>
          </label>
          <el-select 
            v-model="selectedAccount"
            placeholder="请先登录账号"
            class="w-full form-select"
            :disabled="accounts.length === 0"
            @change="handleAccountChange"
          >
            <el-option
              v-for="(account, index) in accounts"
              :key="index"
              :label="account.email"
              :value="index"
            >
              <div class="flex items-center justify-between w-full">
                <span class="flex-1 truncate">{{ account.email }}</span>
                <span
                  class="region-badge ml-2"
                  :class="`region-${(account.region || 'US').toLowerCase()}`"
                >
                  {{ getRegionLabel(account.region || 'US') }}
                </span>
              </div>
            </el-option>
          </el-select>
          <p
            v-if="accounts.length === 0"
            class="text-xs text-secondary mt-1"
          >
            ⚠️ 请先登录账号
          </p>
          <p
            v-else
            class="text-xs text-secondary mt-1"
          >
            ✅ 搜索和下载将使用此账号的 {{ getRegionLabel(accounts[selectedAccount]?.region || 'US') }} 商店
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-primary mb-2">版本（历史版本下拉）</label>
          <el-select
            v-model="selectedVersion"
            placeholder="请先查询版本"
            class="w-full form-select"
            :disabled="!versionsFetched"
            :loading="fetchingVersions"
            @change="handleVersionChange"
          >
            <el-option
              v-for="version in versions"
              :key="version.external_identifier"
              :label="`${version.bundle_version} | ${version.created_at}`"
              :value="version.external_identifier"
            />
          </el-select>
        </div>

        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-secondary">
          <span>APPID: <strong class="font-mono">{{ appid || '—' }}</strong></span>
          <span>
            版本: <strong class="font-mono">{{ versions.find(v => v.external_identifier === selectedVersion)?.bundle_version || '最新' }}</strong>
          </span>
        </div>

        <el-space
          direction="vertical"
          :size="12"
          fill
          style="width: 100%"
        >
          <el-button
            :disabled="!appid || fetchingVersions"
            :loading="fetchingVersions"
            type="primary"
            class="w-full action-button"
            @click="fetchVersions"
          >
            <template #icon>
              <el-icon><Search /></el-icon>
            </template>
            查询版本
          </el-button>

          <el-button
            :disabled="(!selectedAccount && selectedAccount !== 0) || !appid"
            type="primary"
            plain
            class="w-full action-button"
            @click="addToBatchDraft"
          >
            <template #icon>
              <el-icon><Plus /></el-icon>
            </template>
            添加到批量下载
          </el-button>

          <el-button
            v-if="appStore.batchDraftItems.length > 0"
            type="primary"
            plain
            class="w-full action-button"
            @click="goToBatchTab"
          >
            查看批量任务（草稿 {{ appStore.batchDraftItems.length }}）
          </el-button>

          <el-button
            v-if="!claimRequired"
            :disabled="(!selectedAccount && selectedAccount !== 0) || downloadBlocked || isDirectLinkDownloading"
            :loading="isDirectLinkDownloading"
            :class="{ 'purchase-blocked-btn': paidPurchaseRequired }"
            :title="downloadBlockedReason"
            type="primary"
            class="w-full action-button"
            @click="directLinkDownload"
          >
            <template #icon>
              <el-icon><Download /></el-icon>
            </template>
            直链下载（仅下载文件）
          </el-button>

          <el-button
            v-if="!claimRequired"
            :disabled="(!selectedAccount && selectedAccount !== 0) || downloadBlocked"
            :loading="downloading"
            :class="{ 'purchase-blocked-btn': paidPurchaseRequired }"
            :title="downloadBlockedReason"
            type="primary"
            class="w-full action-button"
            @click="startDownloadWithProgress"
          >
            <template #icon>
              <el-icon><Download /></el-icon>
            </template>
            {{ downloading ? '处理中...' : '下载到服务器' }}
          </el-button>

          <div
            v-if="purchaseRequired"
            class="download-disabled-hint"
          >
            ⚠️ {{ downloadBlockedReason }}
          </div>

          <el-button
            v-if="purchaseRequired"
            :disabled="!selectedAccount && selectedAccount !== 0"
            type="primary"
            class="w-full action-button"
            @click="buyOrClaimSelectedApp"
          >
            <template #icon>
              <el-icon><ArrowRight /></el-icon>
            </template>
            {{ purchaseActionLabel }}
          </el-button>
        </el-space>
      </div>

      <!-- Progress Box -->
      <el-card
        v-if="showProgress"
        class="mt-4"
        shadow="never"
      >
        <div class="flex justify-between items-center mb-2">
          <span class="text-sm font-medium text-primary">{{ progressStage }}</span>
          <span class="text-sm font-bold text-accent-blue">{{ progressPercent }}%</span>
        </div>
        <el-progress 
          :percentage="progressPercent"
          :stroke-width="10"
          class="mb-3"
        />
        <el-scrollbar max-height="160px">
          <pre class="log-container rounded-[var(--radius-card)] p-3 text-xs whitespace-pre-wrap font-mono">{{ logs }}</pre>
        </el-scrollbar>
 
        <div
          v-if="showActionButtons && (downloadReadyUrl || downloadInstallUrl)"
          class="mt-4 space-y-3"
        >
          <!-- Environment Warning -->
          <div
            v-if="!isHttps && currentProtocol !== 'http:'"
            class="status-panel mb-3 p-3"
          >
            <div class="flex items-start space-x-2">
              <svg
                class="w-5 h-5 text-secondary mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div class="flex-1">
                <p class="text-sm text-secondary font-medium">
                  环境检测
                </p>
                <p class="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                  当前协议: {{ currentProtocol || '未知' }} | iOS 安装需要 HTTPS 环境
                </p>
              </div>
            </div>
          </div>
 
          <div class="grid gap-3 sm:grid-cols-2">
            <el-button
              v-if="downloadReadyUrl"
              type="primary"
              size="large"
              class="w-full"
              @click="downloadCompletedIpa"
            >
              <template #icon>
                <el-icon><Download /></el-icon>
              </template>
              下载 IPA{{ downloadReadyFileSize ? `（${formatFileSize(downloadReadyFileSize)}）` : '' }}
            </el-button>
            <a
              v-if="downloadOtaInstallable && downloadInstallUrl && isHttps"
              :href="downloadInstallUrl"
              class="block w-full"
            >
              <el-button
                type="primary"
                size="large"
                class="w-full"
              >
                <template #icon>
                  <el-icon><Download /></el-icon>
                </template>
                安装到设备
              </el-button>
            </a>
            <el-button
              v-else-if="downloadOtaInstallable && downloadInstallUrl"
              type="primary"
              size="large"
              class="w-full"
              @click="installDownloadedIpa"
            >
              <template #icon>
                <el-icon><Download /></el-icon>
              </template>
              安装到设备
            </el-button>
            <el-tooltip
              v-else-if="downloadInstallMethod === 'download_only' && downloadInspection && downloadInspection.summary"
              :content="downloadInspection.summary"
              placement="top"
            >
              <span class="block w-full">
                <el-tag
                  size="large"
                  type="primary"
                  class="w-full text-center"
                >仅下载</el-tag>
              </span>
            </el-tooltip>
            <el-tag
              v-else-if="downloadInstallMethod === 'download_only'"
              size="large"
              type="primary"
              class="w-full text-center"
            >
              仅下载
            </el-tag>
          </div>
          <p class="text-xs text-secondary text-center">
            下载和安装已分离，请按需手动操作
          </p>
          <p
            v-if="downloadInstallUrl && !isHttps"
            class="text-xs text-secondary mt-1 text-center"
          >
            ⚠️ 按 OpenList / Oplist 方案，OTA 安装必须满足 HTTPS + 有效证书 + 已签名 IPA；若在 Telegram 内置浏览器中打开，也请改用 Safari
          </p>
        </div>
      </el-card>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="!searching && searchResults.length === 0 && !searchQuery.trim()"
      class="text-center py-12 text-secondary"
    >
      <svg
        class="mx-auto h-16 w-16 mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </svg>
      <p class="text-lg font-medium">
        未选择应用
      </p>
      <p class="text-sm mt-2">
        请先在上方搜索并选择一个应用
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useAppStore } from '../stores/app'
import { useNotifications } from '../composables/useNotifications'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, ArrowRight, Download, Plus } from '@element-plus/icons-vue'
import { formatRegion } from '../utils/region.js'
import { useAccounts, dedupeAccounts, accountIdentityKey } from '../composables/useAccounts.js'

const notifications = useNotifications()
const appStore = useAppStore()

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

// Make selectedApp reactive for template
const selectedApp = computed(() => props.selectedApp)

const emit = defineEmits(['download-started', 'app-selected'])

// 获取区域标签
const getRegionLabel = (region) => {
	return formatRegion(region)
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
 if (accounts.value.length > 0 && (selectedAccount.value === null || selectedAccount.value === undefined || selectedAccount.value === '')) {
 // 尝试从 localStorage 恢复上次选择的账号
 const savedAccountIndex = localStorage.getItem('ipa_selected_account_index')
 if (savedAccountIndex !== null && savedAccountIndex !== '' && !isNaN(parseInt(savedAccountIndex)) && parseInt(savedAccountIndex) < accounts.value.length) {
 selectedAccount.value = parseInt(savedAccountIndex)
 console.log(`[DownloadManager] Restored selected account: ${accounts.value[selectedAccount.value].email}`)
 } else {
 selectedAccount.value = 0
 console.log(`[DownloadManager] Auto-selected first account: ${accounts.value[0].email}`)
 }
 }
}

const { accounts } = useAccounts()
const selectedAccount = ref(null) // 改为 null 而不是空字符串

// 监听账号选择变化，保存到 localStorage
watch(selectedAccount, (newValue) => {
 if (newValue !== null && newValue !== undefined && newValue !== '') {
 localStorage.setItem('ipa_selected_account_index', String(newValue))
 console.log(`[DownloadManager] Saved selected account index: ${newValue}`)
 }
})
const appid = ref('')
const appVerId = ref('')
const versions = ref([])
const selectedVersion = ref('')
const versionsFetched = ref(false)
const fetchingVersions = ref(false)
const downloading = ref(false)
const isDirectLinkDownloading = ref(false)
const checkingPurchaseStatus = ref(false)
const purchaseStatusText = ref('待检测')
const purchaseStatus = ref({ purchased: null, needsPurchase: false, status: 'unknown', error: null })

// Progress state - sync with store
const showProgress = ref(false)
const progressPercent = ref(0)
const progressStage = ref('等待任务…')
const logs = ref('')

// Search state
const searchMode = ref('search') // 'search' or 'appid'
const searchQuery = ref('')
const searchResults = ref([])
const searching = ref(false)
const currentSearchRequestId = ref(0)

// Download/install state
const downloadReadyUrl = ref('')
const downloadReadyFileSize = ref(0)
const downloadInstallUrl = ref('')
const downloadPackageKind = ref('')
const downloadOtaInstallable = ref(false)
const downloadInstallMethod = ref('')
const downloadInspection = ref(null)
const showActionButtons = ref(false)


const purchaseRequired = computed(() => !!purchaseStatus.value.needsPurchase)
const claimRequired = computed(() => {
 if (!purchaseRequired.value) return false
 const price = getSelectedAppPrice()
 return price !== null && price <= 0
})
const paidPurchaseRequired = computed(() => purchaseRequired.value && !claimRequired.value)
const downloadBlocked = computed(() => checkingPurchaseStatus.value || purchaseRequired.value)
const downloadBlockedReason = computed(() => {
 if (checkingPurchaseStatus.value) return '正在检测购买状态…'
 if (!purchaseRequired.value) return ''
 const price = getSelectedAppPrice()
 if (price !== null && price > 0) return '当前账号未购买：请先在 App Store 购买后再下载'
 return '当前账号未领取：请先在官方 App Store 点击“获取”后再下载'
})
const purchaseActionLabel = computed(() => {
 const price = getSelectedAppPrice()
 if (price !== null && price > 0) return '去购买'
 return '去 App Store 获取'
})

// HTTPS detection
const isHttps = ref(false)
const currentProtocol = ref('')

// Sync state with store on mount and update
const syncStateToStore = () => {
 appStore.updateDownloadState('selectedAccountIndex', selectedAccount.value)
 appStore.updateDownloadState('appId', appid.value)
 appStore.updateDownloadState('appVersionId', appVerId.value)
 appStore.updateDownloadState('availableVersions', versions.value)
 appStore.updateDownloadState('selectedVersionId', selectedVersion.value)
 appStore.updateDownloadState('versionsLoaded', versionsFetched.value)
 appStore.updateDownloadState('showProgressPanel', showProgress.value)
 appStore.updateDownloadState('progressPercentage', progressPercent.value)
 appStore.updateDownloadState('progressMessage', progressStage.value)
 appStore.updateDownloadState('progressLogs', logs.value)
}

const restoreStateFromStore = () => {
 const state = appStore.downloadState
 // 只恢复非 undefined 的值，避免覆盖自动选择的账号
 if (state.selectedAccountIndex !== undefined && state.selectedAccountIndex !== null && state.selectedAccountIndex !== '') {
 selectedAccount.value = state.selectedAccountIndex
 }
 if (state.appId !== undefined) appid.value = state.appId
 if (state.appVersionId !== undefined) appVerId.value = state.appVersionId
 if (state.availableVersions !== undefined) versions.value = state.availableVersions
 if (state.selectedVersionId !== undefined) selectedVersion.value = state.selectedVersionId
 if (state.versionsLoaded !== undefined) versionsFetched.value = state.versionsLoaded
 if (state.showProgressPanel !== undefined) showProgress.value = state.showProgressPanel
 if (state.progressPercentage !== undefined) progressPercent.value = state.progressPercentage
 if (state.progressMessage !== undefined) progressStage.value = state.progressMessage
 if (state.progressLogs !== undefined) logs.value = state.progressLogs
}

// Watch state changes and sync to store
watch([selectedAccount, appid, appVerId, versions, selectedVersion, versionsFetched, showProgress, progressPercent, progressStage, logs], () => {
 syncStateToStore()
}, { deep: true })

// 监听账号列表变化，自动选择账号
watch(accounts, () => {
 autoSelectFirstAccount()
}, { deep: true })

const API_BASE = '/api'

const loadAccounts = async () => {
 const saved = localStorage.getItem('ipa_accounts')
 if (saved) {
 try {
 accounts.value = dedupeAccounts(JSON.parse(saved))
 } catch {
 accounts.value = []
 }
 }
 
 // 从服务器获取最新的账号列表
 try {
 const response = await fetch(`${API_BASE}/accounts`, { credentials: 'include' })
 const data = await response.json()
 
 if (data.ok && data.data) {
 accounts.value = dedupeAccounts(data.data.map(acc => ({
 token: acc.token,
 email: acc.email,
 dsid: acc.dsid,
 region: acc.region || 'US',
 hasSavedCredentials: !!acc.hasSavedCredentials,
 })))
 // 更新本地存储
 localStorage.setItem('ipa_accounts', JSON.stringify(accounts.value))
 
 // 自动选择第一个账号
 autoSelectFirstAccount()
 } else if (data.ok && (!data.data || data.data.length === 0)) {
 // 服务端无已登录账号，尝试用保存的凭证自动恢复
 try {
 const autoRes = await fetch(`${API_BASE}/auto-login`, { method: 'POST', credentials: 'include' })
 const autoData = await autoRes.json()
 if (autoData.ok && autoData.data?.succeeded?.length > 0) {
 // 自动登录成功，重新加载账号列表
 const retryRes = await fetch(`${API_BASE}/accounts`, { credentials: 'include' })
 const retryData = await retryRes.json()
 if (retryData.ok && retryData.data) {
 accounts.value = dedupeAccounts(retryData.data.map(acc => ({
 token: acc.token,
 email: acc.email,
 dsid: acc.dsid,
 region: acc.region || 'US',
 hasSavedCredentials: !!acc.hasSavedCredentials,
 })))
 localStorage.setItem('ipa_accounts', JSON.stringify(accounts.value))
 autoSelectFirstAccount()
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

const addLog = (message) => {
 const timestamp = new Date().toLocaleTimeString()
 logs.value += `[${timestamp}] ${message}\n`
}

// 跳转到账号标签页
const goToAccountTab = () => {
 const appStore = useAppStore()
 appStore.activeTab = 'settings'
}

// 跳转到批量下载标签页
const goToBatchTab = () => {
 appStore.activeTab = 'batch'
}

// 添加当前选择到批量下载草稿
const addToBatchDraft = () => {
 const account = accounts.value[selectedAccount.value]
 if (!account?.email) {
 ElMessage.warning('请先选择已登录账号')
 return
 }
 if (!appid.value) {
 ElMessage.warning('请先填写 APPID')
 return
 }

 const app = props.selectedApp || {}
 const appName = app.trackName || appid.value

 const verObj = versions.value.find(v => v.external_identifier === selectedVersion.value)
 const versionLabel = selectedVersion.value
 ? (verObj ? `${verObj.bundle_version} | ${verObj.created_at}` : String(selectedVersion.value))
 : '最新版本'

 const result = appStore.addBatchDraftItem({
 app_id: String(appid.value).trim(),
 app_name: appName,
 version: selectedVersion.value || null,
 version_label: versionLabel,
 account_email: account.email,
 account_region: account.region || 'US',
 })

 if (result.updated) {
  ElMessage.success('已更新批量草稿项')
 } else if (result.added) {
  ElMessage.success('已添加到批量下载草稿，可继续搜索下一个应用')
 }

 // 为下一次搜索准备：清除当前选择并滚动到顶部聚焦搜索框
 emit('app-selected', null)
 showProgress.value = false
 searchQuery.value = ''
 searchResults.value = []
 window.scrollTo({ top: 0, behavior: 'smooth' })
 setTimeout(() => {
  const input = document.querySelector('.search-input input')
  if (input) input.focus()
 }, 200)
}

// Search functionality - 使用所选账号的区域
const handleSearch = useDebounceFn(async () => {
  const query = searchQuery.value.trim()
  if (!query) {
    searchResults.value = []
    return
  }

  // In direct App ID mode, don't search automatically
  if (searchMode.value === 'appid') {
    return
  }

  // 检查是否已选择账号
  if (accounts.value.length === 0 || selectedAccount.value === '' || selectedAccount.value === null) {
    searchResults.value = []
    return
  }

  // 搜索新应用时清除旧的选中应用
  emit('app-selected', null)

  const requestId = ++currentSearchRequestId.value
 searching.value = true
 try {
 // 获取当前选择账号的区域
 const account = accounts.value[selectedAccount.value]
 const region = account?.region || 'US'
 let nextResults = []
 
 // Check if it's a numeric App ID
 if (/^\d+$/.test(query)) {
 // Direct App ID lookup
 const response = await fetch(`${API_BASE}/app-meta?appid=${encodeURIComponent(query)}&region=${encodeURIComponent(region)}`, { credentials: 'include' })
 const data = await response.json()

 if (data.ok && data.data) {
 nextResults = [data.data]
 }
 } else {
 // Search by name or bundle ID
 const response = await fetch(`${API_BASE}/search?term=${encodeURIComponent(query)}&region=${encodeURIComponent(region)}&media=software&limit=10`, { credentials: 'include' })
 const data = await response.json()

 if (data.ok) {
 nextResults = data.data || []
 }
 }

 if (requestId !== currentSearchRequestId.value) {
 return
 }

 searchResults.value = nextResults
 } catch (error) {
 console.error('Search failed:', error)
 if (requestId === currentSearchRequestId.value) {
 searchResults.value = []
 }
 } finally {
 if (requestId === currentSearchRequestId.value) {
 searching.value = false
 }
 }
}, 300)

const debouncedFetchVersions = useDebounceFn(() => {
 fetchVersions()
}, 400)

const selectApp = (app) => {
 emit('app-selected', app)
 searchQuery.value = ''
 searchResults.value = []
}

const confirmDirectAppId = () => {
 const appId = searchQuery.value.trim()
 if (/^\d+$/.test(appId)) {
 // Create a minimal app object with just the App ID
 const minimalApp = {
 trackId: appId,
 trackName: `App ID: ${appId}`,
 artistName: '未知开发者',
 bundleId: 'unknown.bundle',
 artworkUrl60: null,
 artworkUrl100: null,
 version: '未知',
 isDirectAppId: true // Flag to indicate this is a direct App ID input
 }
 emit('app-selected', minimalApp)
 searchQuery.value = ''
 searchResults.value = []
 }
}

// Watch for search mode changes
watch(searchMode, () => {
 searchQuery.value = ''
 searchResults.value = []
})

// Watch for selectedApp changes to auto-fill appid
watch(() => props.selectedApp, (newApp, oldApp) => {
  // Reset version-related state when switching apps (or clearing selection)
  versions.value = []
  selectedVersion.value = ''
  appVerId.value = ''
  versionsFetched.value = false

  if (newApp && newApp.trackId) {
    appid.value = String(newApp.trackId)
  } else {
    appid.value = ''
  }
}, { immediate: true })

// Watch for account and appid changes to auto-fetch versions
watch([selectedAccount, appid], ([newAccount, newAppid]) => {
 if (newAccount !== '' && newAccount !== null && newAppid) {
 // 自动查询版本
 debouncedFetchVersions()
 }
})

watch(
 [() => props.selectedApp?.trackId, selectedAccount],
 async ([trackId, accountIndex]) => {
 if (!trackId) {
 purchaseStatusText.value = '待检测'
 return
 }
 if (accountIndex === '' || accountIndex === null || accountIndex === undefined) {
 purchaseStatusText.value = '请选择账号后检测'
 return
 }
 await refreshSelectedAppMetadata()
 await refreshPurchaseStatus()
 },
 { immediate: true }
)

const fetchVersions = async () => {
 if (!appid.value) {
 ElMessage.warning('请填写 APPID')
 return
 }

 if (selectedAccount.value === '' || selectedAccount.value === null) {
 ElMessage.warning('请先选择账号')
 return
 }

 const account = accounts.value[selectedAccount.value]
 const region = account?.region || 'US'

 fetchingVersions.value = true
 addLog(`[查询] 正在查询 APPID=${appid.value} 的历史版本（区域：${getRegionLabel(region)}）...`)

 try {
 const response = await fetch(`${API_BASE}/versions?appid=${encodeURIComponent(appid.value)}&region=${encodeURIComponent(region)}`, { credentials: 'include' })
 const data = await response.json()

 if (!data.ok) {
 ElMessage.error(`查询失败：${data.error || '未知错误'}`)
 addLog(`[查询] 失败：${data.error || '未知错误'}`)
 return
 }

 versions.value = [...(data.data || [])].sort(compareVersionDesc)
 versionsFetched.value = true
 addLog(`[查询] 获取到 ${versions.value.length} 条版本记录`)
 } catch (error) {
 ElMessage.error(`查询失败：${error.message}`)
 addLog(`[查询] 失败：${error.message}`)
 } finally {
 fetchingVersions.value = false
 }
}

const handleVersionChange = () => {
 appVerId.value = selectedVersion.value || ''
}

const getSelectedAppPrice = () => {
 const price = Number(props.selectedApp?.price)
 return Number.isFinite(price) ? price : null
}

const getSelectedAppPriceLabel = () => {
 const formatted = props.selectedApp?.formattedPrice
 if (formatted && formatted !== '0' && formatted !== '0.00') return formatted
 const price = getSelectedAppPrice()
 if (price === null) return '未知'
 if (price <= 0) return '免费'
 return `${price}`
}

const getSelectedAppSizeLabel = () => {
 const size = Number(props.selectedApp?.fileSizeBytes)
 if (!Number.isFinite(size) || size <= 0) return '未知'
 return `${(size / 1024 / 1024).toFixed(size / 1024 / 1024 >= 100 ? 0 : 1)} M`
}

const getPurchaseBehaviorLabel = () => {
 if (checkingPurchaseStatus.value) return '检测中...'
 return purchaseStatusText.value
}

const compareVersionDesc = (a, b) => {
 const normalize = (value) => String(value || '')
 .split(/[^0-9A-Za-z]+/)
 .filter(Boolean)
 .map(part => (/^\d+$/.test(part) ? Number(part) : part.toLowerCase()))

 const av = normalize(a?.bundle_version)
 const bv = normalize(b?.bundle_version)
 const len = Math.max(av.length, bv.length)

 for (let i = 0; i < len; i += 1) {
 const left = av[i]
 const right = bv[i]
 if (left === undefined) return 1
 if (right === undefined) return -1
 if (left === right) continue
 if (typeof left === 'number' && typeof right === 'number') {
 return right - left
 }
 return String(right).localeCompare(String(left), undefined, { numeric: true, sensitivity: 'base' })
 }

 return String(b?.created_at || '').localeCompare(String(a?.created_at || ''))
}

const refreshSelectedAppMetadata = async () => {
 if (!props.selectedApp?.trackId) return

 const region = accounts.value[selectedAccount.value]?.region || 'US'
 const needsFill = !props.selectedApp?.formattedPrice || !props.selectedApp?.fileSizeBytes
 if (!needsFill) return

 try {
 const response = await fetch(`${API_BASE}/app-meta?appid=${encodeURIComponent(props.selectedApp.trackId)}&region=${encodeURIComponent(region)}`, {
 credentials: 'include'
 })
 const data = await response.json()
 const app = data?.data
 if (!data.ok || !app) return

 appStore.setSelectedApp({
 ...props.selectedApp,
 ...app,
 })
 } catch (error) {
 console.warn('Failed to enrich selected app metadata:', error)
 }
}

const refreshPurchaseStatus = async () => {
 if (!props.selectedApp?.trackId) {
 purchaseStatusText.value = '待检测'
 return
 }

 if (selectedAccount.value === null || selectedAccount.value === undefined || selectedAccount.value === '') {
 purchaseStatusText.value = '请选择账号后检测'
 return
 }

 const account = accounts.value[selectedAccount.value]
 if (!account?.token) {
 purchaseStatusText.value = '账号无效'
 return
 }

 checkingPurchaseStatus.value = true
 try {
 const response = await fetch(`${API_BASE}/purchase-status?token=${encodeURIComponent(account.token)}&appid=${encodeURIComponent(props.selectedApp.trackId)}${appVerId.value ? `&appVerId=${encodeURIComponent(appVerId.value)}` : ''}`, {
 credentials: 'include'
 })
 const data = await response.json()
 const payload = data?.data || {}

 if (!data.ok) throw new Error(data.error || '检测失败')

 purchaseStatus.value = {
 purchased: !!payload.purchased,
 needsPurchase: !!payload.needsPurchase,
 status: payload.status || 'unknown',
 error: payload.error || null
 }

 const price = getSelectedAppPrice()
 if (payload.purchased) {
 purchaseStatusText.value = price !== null && price > 0 ? '当前账号已购买' : '当前账号已领取'
 } else if (payload.needsPurchase) {
 purchaseStatusText.value = price !== null && price > 0 ? '当前账号未购买' : '当前账号未领取'
 } else {
 purchaseStatusText.value = payload.error ? `检测失败：${payload.error}` : '状态未知'
 }
 } catch (error) {
 purchaseStatusText.value = `检测失败`
 console.warn('Failed to refresh purchase status:', error)
 } finally {
 checkingPurchaseStatus.value = false
 }
}

const preflightPurchaseGate = async (account, modeLabel, retryFn) => {
 if (!account?.token || !props.selectedApp?.trackId) return true

 checkingPurchaseStatus.value = true
 try {
 const response = await fetch(`${API_BASE}/purchase-status?token=${encodeURIComponent(account.token)}&appid=${encodeURIComponent(props.selectedApp.trackId)}${appVerId.value ? `&appVerId=${encodeURIComponent(appVerId.value)}` : ''}`, {
 credentials: 'include'
 })
 const data = await response.json()
 const payload = data?.data || {}

 if (!data.ok) {
 throw new Error(data.error || '检测购买状态失败')
 }

 const price = getSelectedAppPrice()
 purchaseStatus.value = {
 purchased: !!payload.purchased,
 needsPurchase: !!payload.needsPurchase,
 status: payload.status || 'unknown',
 error: payload.error || null
 }

 if (payload.purchased) {
 purchaseStatusText.value = price !== null && price > 0 ? '当前账号已购买' : '当前账号已领取'
 return true
 }

 if (payload.needsPurchase) {
 purchaseStatusText.value = price !== null && price > 0 ? '当前账号未购买' : '当前账号未领取'
 ElMessage.warning(downloadBlockedReason.value || '当前账号未购买/未领取')
 return false
 }

 purchaseStatusText.value = payload.error ? `检测失败：${payload.error}` : '状态未知'
 await ElMessageBox.alert(
 `下载前购买状态校验失败：${payload.error || '状态未知'}。为避免错误下载，已中止。`,
 '无法开始下载',
 {
 confirmButtonText: '知道了',
 type: 'warning',
 lockScroll: false
 }
 )
 return false
 } catch (error) {
 purchaseStatusText.value = '检测失败'
 await ElMessageBox.alert(
 `下载前购买状态校验失败：${error.message || error}`,
 '无法开始下载',
 {
 confirmButtonText: '知道了',
 type: 'warning',
 lockScroll: false
 }
 )
 return false
 } finally {
 checkingPurchaseStatus.value = false
 }
}

const buyOrClaimSelectedApp = async () => {
 try {
 const account = await resolveActiveAccount()
 const price = getSelectedAppPrice()

 if (price === null) {
 await ElMessageBox.alert('价格未知，无法安全领取/购买。请先在搜索结果确认价格信息。', '无法领取', {
 confirmButtonText: '知道了',
 type: 'warning',
 lockScroll: false
 })
 return
 }

 if (price > 0) {
 await ElMessageBox.alert('这是付费应用，请先在 App Store 购买。购买完成后页面会自动恢复下载按钮。', '需要先购买', {
 confirmButtonText: '知道了',
 type: 'warning',
 lockScroll: false
 })
 return
 }

 const appName = props.selectedApp?.trackName || appid.value || '当前应用'
 const appStoreUrl = props.selectedApp?.trackViewUrl || `https://apps.apple.com/app/id${props.selectedApp.trackId}`
 await ElMessageBox.alert(
 `免费应用「${appName}」请先在官方 App Store 点击“获取”。完成后回到此页面刷新状态，再选择“直链下载”或“下载到服务器”。`,
 '请先到 App Store 获取',
 {
 confirmButtonText: '打开 App Store',
 type: 'info',
 lockScroll: false
 }
 ).catch(() => {})

 window.open(appStoreUrl, '_blank', 'noopener')
 await refreshPurchaseStatus()
 } catch (error) {
 ElMessage.warning(error.message || '领取失败')
 }
}

const handleNeedsPurchase = async (retryFn, modeLabel, account = null) => {
 const price = getSelectedAppPrice()
 const appName = props.selectedApp?.trackName || appid.value || '当前应用'
 const accountEmail = account?.email || accounts.value[selectedAccount.value]?.email || '未知账号'
 const accountRegion = getRegionLabel(account?.region || accounts.value[selectedAccount.value]?.region || 'US')

 if (price === null) {
 await ElMessageBox.alert(
 `应用：${appName}\n价格：未知\n账号：${accountEmail}\n区域：${accountRegion}\n\n当前无法确认该应用是否免费。为避免误触发付费购买，请先在搜索结果中确认价格；若为付费应用，请先在 App Store 完成购买。`,
 '无法自动购买',
 {
 confirmButtonText: '知道了',
 type: 'warning',
 lockScroll: false
 }
 )
 addLog(`[${modeLabel}] 未购买，但价格未知，已阻止自动购买`)
 return
 }

 if (price > 0) {
 await ElMessageBox.alert(
 `应用：${appName}\n价格：${getSelectedAppPriceLabel()}\n账号：${accountEmail}\n区域：${accountRegion}\n\n这是付费应用，当前不会自动触发购买。请先在 App Store 完成购买后，再回来下载。`,
 '付费应用无法自动购买',
 {
 confirmButtonText: '知道了',
 type: 'warning',
 lockScroll: false
 }
 )
 addLog(`[${modeLabel}] 未购买的付费应用，已提示先去 App Store 购买`)
 return
 }

 const confirmed = await ElMessageBox.confirm(
 `应用：${appName}\n价格：免费\n账号：${accountEmail}\n区域：${accountRegion}\n\n该应用是免费应用，但当前账号尚未领取。是否现在触发购买（领取）并继续下载？`,
 '免费应用需要先领取',
 {
 confirmButtonText: '领取并下载',
 cancelButtonText: '取消',
 type: 'warning',
 lockScroll: false
 }
 ).then(() => true).catch(() => false)

 if (confirmed) {
 addLog(`[${modeLabel}] 免费应用未购买，用户确认触发购买逻辑`)
 return retryFn(true)
 }

 addLog(`[${modeLabel}] 用户取消免费应用购买`)
}

const directLinkDownload = async (autoPurchase = false) => {
 if (!selectedAccount.value && selectedAccount.value !== 0) {
 ElMessage.warning('请选择登录账号')
 return
 }
 if (!appid.value) {
 ElMessage.warning('请填写 APPID')
 return
 }

 try {
 const account = await resolveActiveAccount()
 if (!autoPurchase) {
 const allowed = await preflightPurchaseGate(account, '直链', directLinkDownload)
 if (!allowed) return
 }

 if (isDirectLinkDownloading.value) return

 isDirectLinkDownloading.value = true
 addLog('[直链] 获取直链中…')
 const url = `${API_BASE}/download-url?token=${encodeURIComponent(account.token)}&appid=${encodeURIComponent(appid.value)}${appVerId.value ? `&appVerId=${encodeURIComponent(appVerId.value)}` : ''}${autoPurchase ? '&autoPurchase=true' : ''}`
 const response = await fetch(url, { credentials: 'include' })
 const data = await response.json()
 const payload = data?.data || data

 if (!data.ok) {
 if (data.needsPurchase && !autoPurchase) {
 ElMessage.warning(downloadBlockedReason.value || '当前账号未购买/未领取')
 return
 }
 ElMessage.error(`直链获取失败：${data.error || '未知错误'}`)
 addLog(`[直链] 失败：${data.error || '未知错误'}`)
 return
 }

 addLog(`[直链] 成功：文件名=${payload.fileName}，即将从 Apple CDN 直连下载`)
 addLog(`[直链] URL（部分）=${String(payload.url).slice(0, 80)}...`)

 // Trigger browser download
 const a = document.createElement('a')
 a.href = payload.url
 a.download = payload.fileName || ''
 a.rel = 'noopener'
 document.body.appendChild(a)
 a.click()
 a.remove()
 } catch (error) {
 ElMessage.error(`直链获取失败：${error.message}`)
 addLog(`[直链] 失败：${error.message}`)
 } finally {
 isDirectLinkDownloading.value = false
 }
}

const startDownloadWithProgress = async (autoPurchase = false) => {
 if (!selectedAccount.value && selectedAccount.value !== 0) {
 ElMessage.warning('请选择登录账号')
 return
 }
 if (!appid.value) {
 ElMessage.warning('请填写 APPID')
 return
 }

 try {
 const account = await resolveActiveAccount()
 if (!autoPurchase) {
 const allowed = await preflightPurchaseGate(account, '进度', startDownloadWithProgress)
 if (!allowed) return
 }

 // Reset progress
 showProgress.value = true
 progressPercent.value = 0
 progressStage.value = '准备中…'
 logs.value = ''
 downloadReadyUrl.value = ''
 downloadReadyFileSize.value = 0
 downloadInstallUrl.value = ''
 downloadPackageKind.value = ''
 downloadOtaInstallable.value = false
 downloadInstallMethod.value = ''
 downloadInspection.value = null
 showActionButtons.value = false
 addLog('[进度] 创建下载任务…')

 addLog(`[进度] 使用账号 ${account.email} 发起任务，token=${String(account.token).slice(0, 8)}…`)
 const response = await fetch(`${API_BASE}/start-download-direct`, {
 method: 'POST',
 credentials: 'include',
 headers: {
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({
 token: account.token,
 appid: appid.value,
 appVerId: appVerId.value ? String(appVerId.value) : undefined,
 autoPurchase: !!autoPurchase,
 appName: props.selectedApp?.trackName || undefined,
 bundleId: props.selectedApp?.bundleId || undefined,
 appVersion: props.selectedApp?.version || undefined,
 artworkUrl: props.selectedApp?.artworkUrl100 || props.selectedApp?.artworkUrl60 || undefined,
 artistName: props.selectedApp?.artistName || undefined
 })
 })
 const data = await response.json()

 if (!data.ok) {
 if (data.needsPurchase && !autoPurchase) {
 showProgress.value = false
 ElMessage.warning(downloadBlockedReason.value || '当前账号未购买/未领取')
 return
 }
 ElMessage.error(`创建任务失败：${data.error || '未知错误'}`)
 addLog(`[进度] 创建任务失败：${data.error || '未知错误'}`)
 return
 }

 const { jobId } = data
 addLog(`[进度] 任务已创建：${jobId}`)

 // 添加到队列 — 把 selectedApp 的图标/名称/开发者展平到顶层，供 DownloadQueue 直接渲染
 const app = props.selectedApp || {}
 const queueItem = {
 id: jobId,
 appName: app.trackName || appid.value,
 artworkUrl: app.artworkUrl100 || app.artworkUrl60 || '',
 artistName: app.artistName || '',
 version: app.version || '',
 app: app,
 account: account,
 accountEmail: account.email || '',
 status: 'downloading',
 progress: 0,
 logs: logs.value,
 timestamp: new Date().toISOString()
 }
 emit('download-started', queueItem)

 // Connect to SSE / fallback polling
 connectToSSE(jobId, queueItem)
 } catch (error) {
 ElMessage.error(`创建任务失败：${error.message}`)
 addLog(`[进度] 创建任务失败：${error.message}`)
 }
}

const pollJobStatus = (jobId, queueItem) => {
 addLog('[进度] SSE 不可用，自动切换为轮询模式')

 const markInterrupted = (message = '任务已失效，可能是服务重启或页面切换后丢失，请重新发起下载') => {
 clearInterval(timer)
 addLog(`[失败] ${message}`)
 const appStore = useAppStore()
 appStore.updateQueueItem(jobId, {
 status: 'failed',
 stage: 'interrupted',
 error: message
 })
 if (queueItem) {
 queueItem.status = 'failed'
 queueItem.error = message
 }
 }

 const timer = setInterval(async () => {
 try {
 const response = await fetch(`${API_BASE}/job-info?jobId=${encodeURIComponent(jobId)}`, { credentials: 'include' })
 const data = await response.json()
 if (response.status === 404) {
 markInterrupted(data?.error || '任务已不存在')
 return
 }
 if (!response.ok || !data.ok || !data.data) return

 const snapshot = data.data
 if (snapshot.progress != null) {
 progressPercent.value = snapshot.progress
 const appStore = useAppStore()
 appStore.updateQueueItem(jobId, { progress: snapshot.progress })
 }
 if (snapshot.stage) {
 progressStage.value = snapshot.stage
 const appStore = useAppStore()
 appStore.updateQueueItem(jobId, { stage: snapshot.stage })
 }
 if (snapshot.error) {
 addLog(`[错误] ${snapshot.error}`)
 }

 if (snapshot.status === 'ready') {
 clearInterval(timer)
 progressPercent.value = 100
 progressStage.value = '下载已完成'
 if (snapshot.installMethod === 'download_only') {
 addLog('[进度] 文件已保存到服务器，仅支持下载导出')
 } else {
 addLog('[进度] 文件已保存到服务器，可手动下载或安装')
 }

 const appStore = useAppStore()
 appStore.updateQueueItem(jobId, {
 status: 'completed',
 progress: 100,
 downloadUrl: snapshot.downloadUrl,
 installUrl: snapshot.installUrl,
 fileSize: snapshot.fileSize || 0,
 packageKind: snapshot.packageKind,
 otaInstallable: snapshot.otaInstallable,
 installMethod: snapshot.installMethod,
 inspection: snapshot.inspection
 })

 downloadReadyUrl.value = snapshot.downloadUrl || ''
 downloadReadyFileSize.value = snapshot.fileSize || 0
 downloadInstallUrl.value = snapshot.installUrl || ''
 downloadPackageKind.value = snapshot.packageKind || ''
 downloadOtaInstallable.value = !!snapshot.otaInstallable
 downloadInstallMethod.value = snapshot.installMethod || ''
 downloadInspection.value = snapshot.inspection || null
 showActionButtons.value = !!(snapshot.downloadUrl || snapshot.installUrl)
 } else if (snapshot.status === 'failed') {
 clearInterval(timer)
 addLog(`[失败] ${snapshot.error || '任务失败'}`)
 const appStore = useAppStore()
 appStore.updateQueueItem(jobId, {
 status: 'failed',
 error: snapshot.error || '任务失败'
 })
 if (queueItem) {
 queueItem.status = 'error'
 queueItem.error = snapshot.error || '任务失败'
 }
 }
 } catch (error) {
 clearInterval(timer)
 addLog(`[错误] 轮询任务状态失败：${error.message}`)
 const appStore = useAppStore()
 appStore.updateQueueItem(jobId, {
 status: 'failed',
 error: error.message
 })
 if (queueItem) {
 queueItem.status = 'error'
 queueItem.error = error.message
 }
 }
 }, 1500)
}

const connectToSSE = (jobId, queueItem) => {
 let es
 try {
 const origin = window.location.origin || `${window.location.protocol}//${window.location.host}`
 const sseUrl = new URL(`${API_BASE}/progress-sse?jobId=${encodeURIComponent(jobId)}`, origin).toString()
 es = new EventSource(sseUrl)
 } catch (error) {
 addLog(`[进度] SSE 初始化失败：${error.message}`)
 pollJobStatus(jobId, queueItem)
 return
 }

 es.addEventListener('progress', (ev) => {
 try {
 const data = JSON.parse(ev.data)
 
 if (data?.progress?.percent != null) {
 progressPercent.value = data.progress.percent
 // 更新队列项进度
 const appStore = useAppStore()
 appStore.updateQueueItem(jobId, { progress: data.progress.percent })
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
 const appStore = useAppStore()
 appStore.updateQueueItem(jobId, { stage: progressStage.value })
 }
 
 if (data?.error) {
 addLog(`[错误] ${data.error}`)
 const appName = props.selectedApp?.trackName || appid.value
 notifications.notifyDownloadFailed(appName, data.error)
 const appStore = useAppStore()
 appStore.updateQueueItem(jobId, {
 status: 'failed',
 error: data.error
 })
 }
 
 if (data.status === 'ready') {
 progressPercent.value = 100
 progressStage.value = '下载已完成'
 addLog('[进度] 文件已保存到服务器，可在任务完成后刷新获取交付信息')

 // 更新队列项状态
 const appStore = useAppStore()
 appStore.updateQueueItem(jobId, {
 status: 'completed',
 progress: 100
 })
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
 const appStore = useAppStore()
 appStore.updateQueueItem(jobId, { logs: logs.value })
 }
 } catch {}
 })

 es.addEventListener('end', (ev) => {
 try {
 const data = JSON.parse(ev.data || '{}')
 if (data.status === 'ready') {
 addLog('[完成] 任务已就绪')
 // 发送下载完成通知
 const appName = props.selectedApp?.trackName || appid.value
 notifications.notifyDownloadComplete(appName)
 // 获取任务信息，包括安装URL
 fetch(`${API_BASE}/job-info?jobId=${encodeURIComponent(jobId)}`, { credentials: 'include' })
 .then(res => res.json())
 .then(jobData => {
 if (jobData.ok && jobData.data) {
 downloadReadyUrl.value = jobData.data.downloadUrl || ''
 downloadReadyFileSize.value = jobData.data.fileSize || 0
 downloadInstallUrl.value = jobData.data.installUrl || ''
 downloadPackageKind.value = jobData.data.packageKind || ''
 downloadOtaInstallable.value = !!jobData.data.otaInstallable
 downloadInstallMethod.value = jobData.data.installMethod || ''
 downloadInspection.value = jobData.data.inspection || null
 showActionButtons.value = !!(jobData.data.downloadUrl || jobData.data.installUrl)

 if (jobData.data.otaInstallable && jobData.data.installUrl) {
 addLog('[安装] OTA 安装链接已生成')
 } else if (jobData.data.installMethod === 'download_only') {
 addLog('[交付] 该包不支持 OTA 安装，仅提供下载')
 }

 const appStore = useAppStore()
 appStore.updateQueueItem(jobId, {
 status: 'completed',
 progress: 100,
 downloadUrl: jobData.data.downloadUrl,
 installUrl: jobData.data.installUrl,
 fileSize: jobData.data.fileSize || 0,
 packageKind: jobData.data.packageKind,
 otaInstallable: jobData.data.otaInstallable,
 installMethod: jobData.data.installMethod,
 inspection: jobData.data.inspection
 })
 }
 })
 .catch(() => {
 // 忽略错误
 })
 } else if (data.status === 'failed') {
 addLog('[失败] 任务失败')
 const appName = props.selectedApp?.trackName || appid.value
 notifications.notifyDownloadFailed(appName)
 if (queueItem) {
 queueItem.status = 'error'
 }
 } else {
 addLog(`[结束] 任务结束：${data.status || 'unknown'}`)
 }
 } catch {}
 es.close()
 })

 es.onerror = () => {
 addLog('[错误] SSE 连接断开，切换为轮询模式')
 es.close()
 pollJobStatus(jobId, queueItem)
 }
}

// 监听账号更新
watch(() => props.accountsUpdated, async () => {
 ElMessage.info('检测到账号状态变化，正在刷新账号与购买状态…')
 await loadAccounts()
 await refreshSelectedAppMetadata()
 await refreshPurchaseStatus()
 if (appid.value && selectedAccount.value !== null && selectedAccount.value !== undefined && selectedAccount.value !== '') {
 await fetchVersions()
 }
 ElMessage.success('账号刷新完成，页面状态已同步')
})

const openInstallUrl = (url) => {
 if (!url) {
 ElMessage.warning('安装链接未生成')
 return
 }

 window.location.assign(url)
}

const installDownloadedIpa = async () => {
 if (!downloadInstallUrl.value) {
 ElMessage.warning('安装链接未生成')
 return
 }

 const isHttpsEnvironment = window.location.protocol === 'https:'
 const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

 if (!isHttpsEnvironment && !isLocalhost) {
 const action = await ElMessageBox.confirm(
 '按 OpenList / Oplist 的现成方案，OTA 安装必须使用 HTTPS + 有效证书；当前环境不是 HTTPS，iOS 不会响应安装。您现在可以先直接下载 IPA，或改用 HTTPS 域名后再试。',
 '无法开始 OTA 安装',
 {
 distinguishCancelAndClose: true,
 confirmButtonText: '直接下载文件',
 cancelButtonText: '取消操作',
 type: 'warning',
 center: true,
 lockScroll: false
 }
 ).then(
 () => 'download',
 () => 'cancel'
 ).catch(
 (action) => action === 'cancel' ? 'cancel' : 'close'
 )

 if (action === 'download') {
 downloadCompletedIpa()
 }
 return
 }

 if (isHttpsEnvironment) {
 ElMessage.success('正在打开安装链接...')
 openInstallUrl(downloadInstallUrl.value)
 } else if (isLocalhost) {
 const confirmed = await ElMessageBox.confirm(
 '当前是 localhost 环境。按 OpenList / Oplist 文档，OTA 安装需要 HTTPS + 有效证书；localhost 基本不会成功。若你只是想继续试一把可以继续，否则请先切到 HTTPS 域名。',
 '安装前检查',
 {
 confirmButtonText: '继续尝试',
 cancelButtonText: '取消',
 type: 'info',
 lockScroll: false
 }
 ).then(() => true).catch(() => false)

 if (confirmed) {
 openInstallUrl(downloadInstallUrl.value)
 }
 }
}

const downloadCompletedIpa = () => {
 if (!downloadReadyUrl.value) {
 ElMessage.warning('下载链接未生成')
 return
 }

 window.open(downloadReadyUrl.value, '_blank', 'noopener')
}

const formatFileSize = (bytes) => {
 if (!bytes) return ''
 const units = ['B', 'KB', 'MB', 'GB']
 let value = bytes
 let unitIndex = 0
 while (value >= 1024 && unitIndex < units.length - 1) {
 value /= 1024
 unitIndex += 1
 }
 return `${value.toFixed(value >= 100 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

onMounted(() => {
 loadAccounts()
 restoreStateFromStore()
 
 // 检测当前环境
 isHttps.value = window.location.protocol === 'https:'
 currentProtocol.value = window.location.protocol
 
 console.log(`[Environment] Protocol: ${currentProtocol.value}, HTTPS: ${isHttps.value}`)
})
</script>

<style scoped>
.download-disabled-hint {
 padding: var(--space-2-5) var(--space-3);
 border-radius: var(--radius-card);
 font-size: var(--font-size-sm);
 line-height: 1.4;
 border: var(--border-width-thin) solid var(--separator);
 background: var(--el-fill-color-light);
 color: var(--text-secondary);
}

.purchase-blocked-btn.is-disabled {
 opacity: 0.62 !important;
 filter: none;
 box-shadow: none !important;
}

.purchase-blocked-btn.is-disabled :deep(span),
.purchase-blocked-btn.is-disabled :deep(i),
.purchase-blocked-btn.is-disabled :deep(svg) {
 opacity: 1 !important;
}

.selected-app-badges {
 display: flex;
 flex-wrap: wrap;
 gap: var(--space-2);
}

.selected-app-badge,
.region-badge,
.region-badge-mini {
 display: inline-flex;
 align-items: center;
 padding: var(--space-1) var(--space-2);
 border-radius: var(--radius-control);
 border: var(--border-width-thin) solid var(--separator);
 font-size: var(--font-size-sm);
 line-height: 1;
 color: var(--text-secondary);
 background: transparent;
}

.search-input :deep(.el-input__wrapper) {
 padding: var(--space-2) var(--space-3);
}

.search-input :deep(.el-input__inner) {
 font-size: var(--font-size-md);
}

.account-toolbar {
 display: flex;
 align-items: center;
 justify-content: space-between;
 gap: var(--space-2);
}

.search-mode-row {
 display: flex;
 align-items: center;
 gap: var(--space-4);
 flex-wrap: wrap;
}

.account-quick-select {
 width: 320px;
 max-width: 100%;
}

.account-option-row {
 display: flex;
 align-items: center;
 gap: var(--space-2);
 width: 100%;
 min-width: 0;
}

.account-option-email {
 flex: 1;
 min-width: 0;
 overflow: hidden;
 text-overflow: ellipsis;
 white-space: nowrap;
}

.action-button {
 border-radius: var(--radius-control);
 font-weight: 500;
 height: var(--size-control-xl);
}

.log-container {
 padding: var(--space-4);
 font-family: 'SFMono-Regular', Consolas, monospace;
 font-size: var(--font-size-sm);
 line-height: 1.6;
 max-height: 300px;
 overflow-y: auto;
 background: var(--el-fill-color-light);
 border: var(--border-width-thin) solid var(--separator);
}

.log-entry {
 padding: var(--space-1) 0;
 border-bottom: var(--border-width-thin) solid var(--separator);
}

.log-entry:last-child {
 border-bottom: none;
}

.log-time,
.log-content,
.log-success,
.log-error,
.log-info {
 color: var(--text-secondary);
}

@media (max-width: 767px) {
 .action-button {
  height: var(--size-control-xl);
 }

 .account-toolbar {
  flex-direction: column;
  align-items: stretch;
 }

 .account-toolbar > div:first-child {
  width: 100%;
 }

 .search-mode-row {
  gap: var(--space-3);
 }

 .account-quick-select {
  width: 100%;
  margin-top: 0;
 }

 .search-result-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
 }

 .selected-app-card {
  padding: var(--space-3) !important;
 }
}
</style>

