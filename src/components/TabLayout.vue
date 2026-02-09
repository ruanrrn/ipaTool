<template>
  <div class="tab-layout" :class="{ 'mobile-layout': isMobile, 'desktop-layout': !isMobile }">
    <!-- Desktop: Tab Bar at Top -->
    <div v-if="!isMobile" class="desktop-tab-bar-wrapper">
      <el-tabs 
        v-model="appStore.activeTab" 
        class="tab-bar desktop-tabs"
      >
        <el-tab-pane
          v-for="tab in tabs"
          :key="tab.id"
          :name="tab.id"
        >
          <template #label>
            <div class="tab-label-wrapper">
              <el-badge 
                v-if="tab.badge" 
                :value="tab.badge" 
                class="tab-badge"
                :max="99"
              >
                <div class="tab-label-content">
                  <el-icon class="tab-icon"><component :is="tab.icon" /></el-icon>
                  <span class="tab-text">{{ tab.label }}</span>
                </div>
              </el-badge>
              <div v-else class="tab-label-content">
                <el-icon class="tab-icon"><component :is="tab.icon" /></el-icon>
                <span class="tab-text">{{ tab.label }}</span>
              </div>
            </div>
          </template>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- Tab Content -->
    <div class="tab-content" :class="{ 'with-desktop-tabs': !isMobile, 'with-mobile-tabs': isMobile }">
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

    <!-- Mobile: Tab Bar at Bottom -->
    <div v-if="isMobile" class="mobile-tab-bar-wrapper">
      <el-tabs 
        v-model="appStore.activeTab" 
        class="tab-bar mobile-tabs"
      >
        <el-tab-pane
          v-for="tab in tabs"
          :key="tab.id"
          :name="tab.id"
        >
          <template #label>
            <div class="tab-label-wrapper">
              <el-badge 
                v-if="tab.badge" 
                :value="tab.badge" 
                class="tab-badge"
                :max="99"
              >
                <div class="tab-label-content">
                  <el-icon class="tab-icon"><component :is="tab.icon" /></el-icon>
                  <span class="tab-text">{{ tab.label }}</span>
                </div>
              </el-badge>
              <div v-else class="tab-label-content">
                <el-icon class="tab-icon"><component :is="tab.icon" /></el-icon>
                <span class="tab-text">{{ tab.label }}</span>
              </div>
            </div>
          </template>
        </el-tab-pane>
      </el-tabs>
    </div>
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

.desktop-layout {
  flex-direction: column;
}

.mobile-layout {
  flex-direction: column;
}

.tab-content {
  flex: 1;
  overflow-y: auto;
}

.tab-content.with-desktop-tabs {
  padding-top: 0;
  padding-bottom: 24px;
}

.tab-content.with-mobile-tabs {
  padding-bottom: 100px;  /* 增加底部间距，防止被 tab 栏遮盖 */
}

/* Tab Bar 样式优化 */
.tab-bar :deep(.el-tabs__header) {
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  transition: all 0.3s ease;
}

.dark .tab-bar :deep(.el-tabs__header) {
}

/* Desktop Tab Bar */
.desktop-tab-bar-wrapper {
  position: sticky;
  top: 0;
  margin: 0 -48px;
  z-index: 100;
 
}

.dark .desktop-tab-bar-wrapper {
}

.tab-bar.desktop-tabs :deep(.el-tabs__header) {
  border-bottom: 0;
  margin: 0;
  padding: 12px 24px;
}

.dark .tab-bar.desktop-tabs :deep(.el-tabs__header) {
  border-bottom: 0;
}

.tab-bar :deep(.el-tabs__nav-wrap) {
  padding: 0;
}

.tab-bar :deep(.el-tabs__nav) {
  border: none;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.03);
  padding: 4px;
}

.dark .tab-bar :deep(.el-tabs__nav) {
  background: rgba(255, 255, 255, 0.05);
}

.tab-bar :deep(.el-tabs__item) {
  font-weight: 500;
  padding: 0 24px;
  height: 44px;
  line-height: 44px;
  color: #6b7280;
  transition: all 0.3s ease;
  border: none;
  border-radius: 8px;
  position: relative;
}

.tab-bar :deep(.el-tabs__item:hover) {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.08);
}

.dark .tab-bar :deep(.el-tabs__item:hover) {
  color: #60a5fa;
  background: rgba(96, 165, 250, 0.15);
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
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.dark .tab-bar :deep(.el-tabs__item.is-active) {
  color: #60a5fa;
  background: rgba(0, 0, 0, 0.2);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.tab-bar :deep(.el-tabs__active-bar) {
  display: none;
}

.tab-label-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative;
  width: 100%;
}

.tab-label-content {
  display: flex;
  align-items: center;
  gap: 6px;
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
  position: absolute;
  top: -5px;
  right: -5px;
  background-color: #ef4444;
  border-color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  min-width: 18px;
  height: 18px;
  line-height: 18px;
  padding: 0 5px;
  z-index: 10;
}

.dark .tab-badge :deep(.el-badge__content) {
  background-color: #ef4444;
  border-color: #1f2937;
}

/* 移动端标签栏样式 */
.mobile-tab-bar-wrapper {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  top: auto;
  z-index: 100;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);  /* 添加顶部阴影 */
  padding-bottom: env(safe-area-inset-bottom);  /* 适配 iPhone X 等设备的底部安全区域 */
}

.dark .mobile-tab-bar-wrapper {
  background: rgba(31, 41, 55, 0.98);
  border-top: 1px solid rgba(55, 65, 81, 0.5);
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.2);
}

.tab-bar.mobile-tabs :deep(.el-tabs__header) {
  border: none;
  padding: 0;
  margin: 0;
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
  top: -4px;
  right: -8px;
  transform: translate(0, 0);
  z-index: 10;
}

.tab-bar.mobile-tabs .tab-label-wrapper {
  position: relative;
  padding-top: 4px;
}

/* 桌面端标签栏样式 */
.tab-bar.desktop-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.tab-bar.desktop-tabs :deep(.el-tabs__nav-wrap) {
  padding: 0 24px;
}

.tab-bar.desktop-tabs :deep(.el-tabs__nav) {
  gap: 4px;
}

.tab-bar.desktop-tabs :deep(.el-tabs__item) {
  padding: 0 28px;
  font-size: 14px;
}

/* 移动端内容区域底部留白 */
@media (max-width: 767px) {
  .tab-content.with-mobile-tabs {
    padding-bottom: 120px;  /* 确保有足够的底部间距，避免被 tab 栏遮挡 */
  }
}
</style>
