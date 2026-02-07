<template>
  <div class="tab-layout">
    <!-- Tab Content -->
    <div class="tab-content">
      <component 
        :is="currentTabComponent" 
        v-bind="currentTabProps" 
        @app-selected="handleAppSelected"
        @download-started="handleDownloadStarted"
        @accounts-updated="handleAccountsUpdated"
        @remove-item="emit('remove-item', $event)"
        @clear-all="emit('clear-queue')"
      />
    </div>

    <!-- Responsive Tab Bar -->
    <el-tabs 
      v-model="appStore.activeTab" 
      :position="isMobile ? 'bottom' : 'top'"
      class="tab-bar"
      :class="{ 'mobile-tabs': isMobile, 'desktop-tabs': !isMobile }"
    >
      <el-tab-pane
        v-for="tab in tabs"
        :key="tab.id"
        :name="tab.id"
      >
        <template #label>
          <div class="tab-label-wrapper">
            <el-icon class="tab-icon"><component :is="tab.icon" /></el-icon>
            <span class="tab-text">{{ tab.label }}</span>
            <el-badge 
              v-if="tab.badge" 
              :value="tab.badge" 
              class="tab-badge"
              :max="99"
            />
          </div>
        </template>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '../stores/app'
import { User, Download, List } from '@element-plus/icons-vue'
import AccountManager from './AccountManager.vue'
import DownloadManager from './DownloadManager.vue'
import DownloadQueue from './DownloadQueue.vue'

const appStore = useAppStore()
const emit = defineEmits(['app-selected', 'download-started', 'accounts-updated', 'remove-item', 'clear-queue'])
const isMobile = ref(true)

const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
}

const handleAccountsUpdated = (accounts) => {
  emit('accounts-updated', accounts)
}

const handleAppSelected = (app) => {
  emit('app-selected', app)
}

const handleDownloadStarted = (task) => {
  emit('download-started', task)
}

const tabs = computed(() => [
  {
    id: 'account',
    label: '账号',
    icon: User
  },
  {
    id: 'download',
    label: '下载',
    icon: Download,
    badge: appStore.downloadState.selectedApp ? '1' : null
  },
  {
    id: 'queue',
    label: '队列',
    icon: List,
    badge: appStore.taskQueue.length > 0 ? String(appStore.taskQueue.length) : null
  }
])

const currentTabComponent = computed(() => {
  const components = {
    account: AccountManager,
    download: DownloadManager,
    queue: DownloadQueue
  }
  return components[appStore.activeTab] || DownloadManager
})

const currentTabProps = computed(() => {
  switch (appStore.activeTab) {
    case 'download':
      return { 
        selectedApp: appStore.downloadState.selectedApp,
        accountsUpdated: appStore.accountsUpdateCounter
      }
    case 'queue':
      return { queue: appStore.taskQueue }
    default:
      return {}
  }
})

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<style scoped>
.tab-layout {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 180px);
}

.tab-content {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 80px;
}

/* Tab Bar 样式优化 */
.tab-bar :deep(.el-tabs__header) {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.dark .tab-bar :deep(.el-tabs__header) {
  background: rgba(31, 41, 55, 0.9);
  border-bottom: 1px solid rgba(55, 65, 81, 0.5);
}

.tab-bar :deep(.el-tabs__nav-wrap) {
  padding: 0 16px;
}

.tab-bar :deep(.el-tabs__nav) {
  border: none;
}

.tab-bar :deep(.el-tabs__item) {
  font-weight: 500;
  padding: 0 20px;
  height: 48px;
  line-height: 48px;
  color: #6b7280;
  transition: all 0.3s ease;
  border: none;
}

.dark .tab-bar :deep(.el-tabs__item) {
  color: #9ca3af;
}

.tab-bar :deep(.el-tabs__item:hover) {
  color: #3b82f6;
}

.dark .tab-bar :deep(.el-tabs__item:hover) {
  color: #60a5fa;
}

.tab-bar :deep(.el-tabs__item.is-active) {
  color: #3b82f6;
}

.dark .tab-bar :deep(.el-tabs__item.is-active) {
  color: #60a5fa;
}

.tab-bar :deep(.el-tabs__active-bar) {
  background-color: #3b82f6;
  height: 3px;
  border-radius: 3px 3px 0 0;
}

.tab-label-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative;
}

.tab-icon {
  font-size: 18px;
  transition: transform 0.2s ease;
}

.tab-bar :deep(.el-tabs__item:hover) .tab-icon {
  transform: scale(1.1);
}

.tab-text {
  font-size: 14px;
  font-weight: 500;
}

.tab-badge :deep(.el-badge__content) {
  background-color: #ef4444;
  border-color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  min-width: 18px;
  height: 18px;
  line-height: 18px;
  padding: 0 5px;
}

.dark .tab-badge :deep(.el-badge__content) {
  background-color: #ef4444;
  border-color: #1f2937;
}

/* 移动端标签栏样式 */
.tab-bar.mobile-tabs :deep(.el-tabs__header) {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  top: auto;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  border-bottom: none;
  z-index: 100;
  padding: 0;
  margin: 0;
}

.dark .tab-bar.mobile-tabs :deep(.el-tabs__header) {
  border-top: 1px solid rgba(55, 65, 81, 0.5);
}

.tab-bar.mobile-tabs :deep(.el-tabs__nav-wrap) {
  padding: 0;
}

.tab-bar.mobile-tabs :deep(.el-tabs__nav) {
  width: 100%;
  display: flex;
  justify-content: space-around;
}

.tab-bar.mobile-tabs :deep(.el-tabs__item) {
  flex: 1;
  text-align: center;
  padding: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 56px;
  line-height: 1;
}

.tab-bar.mobile-tabs .tab-label-wrapper {
  flex-direction: column;
  gap: 2px;
}

.tab-bar.mobile-tabs .tab-icon {
  font-size: 20px;
}

.tab-bar.mobile-tabs .tab-text {
  font-size: 11px;
}

.tab-bar.mobile-tabs :deep(.el-tabs__active-bar) {
  display: none;
}

.tab-bar.mobile-tabs :deep(.el-tabs__item.is-active) {
  background: rgba(59, 130, 246, 0.1);
}

.dark .tab-bar.mobile-tabs :deep(.el-tabs__item.is-active) {
  background: rgba(59, 130, 246, 0.2);
}

.tab-bar.mobile-tabs .tab-badge :deep(.el-badge__content) {
  position: absolute;
  top: 0;
  right: -12px;
  transform: translate(0, 0);
}

.tab-bar.mobile-tabs .tab-label-wrapper {
  position: relative;
}

/* 桌面端标签栏样式 */
.tab-bar.desktop-tabs :deep(.el-tabs__header) {
  border-radius: 12px;
  margin: 0 16px;
}

.tab-bar.desktop-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

/* 移动端内容区域底部留白 */
@media (max-width: 767px) {
  .tab-content {
    padding-bottom: 70px;
  }
}
</style>
