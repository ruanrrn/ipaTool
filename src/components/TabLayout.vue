<template>
  <div
    class="tab-layout"
    :class="{ 'mobile-layout': isMobile }"
  >
    <div
      v-if="!isMobile"
      class="desktop-tabs"
    >
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['desktop-tab', appStore.activeTab === tab.id ? 'is-active' : '']"
        @click="appStore.activeTab = tab.id"
      >
        <el-badge
          v-if="tab.badge"
          :value="tab.badge"
          :max="99"
        >
          <svg
            class="h-[22px] w-[22px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            v-html="tab.svgPath"
          />
        </el-badge>
        <svg
          v-else
          class="h-[22px] w-[22px]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          v-html="tab.svgPath"
        />
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <div
      class="tab-content"
      :class="{ 'with-mobile-tabs': isMobile }"
    >
      <component
        :is="currentTabComponent"
        v-bind="currentTabProps"
        @app-selected="handleAppSelected"
        @download-started="handleDownloadStarted"
        @accounts-updated="handleAccountsUpdated"
        @remove-item="emit('remove-item', $event)"
        @clear-all="emit('clear-queue')"
        @logout="emit('logout')"
      />
    </div>

    <div
      v-if="isMobile"
      class="mobile-tabs-wrap"
    >
      <div
        class="mobile-tabs"
        :style="{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }"
      >
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="['mobile-tab', appStore.activeTab === tab.id ? 'is-active' : '']"
          @click="appStore.activeTab = tab.id"
        >
          <el-badge
            v-if="tab.badge"
            :value="tab.badge"
            :max="99"
          >
            <svg
              class="h-[22px] w-[22px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              v-html="tab.svgPath"
            />
          </el-badge>
          <svg
            v-else
            class="h-[22px] w-[22px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            v-html="tab.svgPath"
          />
          <span>{{ tab.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '../stores/app'
import DownloadManager from './DownloadManager.vue'
import IpaManager from './IpaManager.vue'
import ArchiveApp from './ArchiveApp.vue'
import Settings from './Settings.vue'

const appStore = useAppStore()
const emit = defineEmits(['app-selected', 'download-started', 'accounts-updated', 'remove-item', 'clear-queue', 'logout'])
const isMobile = ref(false)

const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
}

const handleAccountsUpdated = (v) => emit('accounts-updated', v)
const handleAppSelected = (app) => emit('app-selected', app)
const handleDownloadStarted = (task) => emit('download-started', task)

const activeQueueCount = computed(() => appStore.taskQueue.filter(task => !['completed', 'ready'].includes(task?.status)).length)

const tabs = computed(() => [
  {
    id: 'download',
    label: '下载',
    svgPath: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    badge: appStore.downloadState.selectedApp ? '1' : null
  },
  {
    id: 'ipa',
    label: 'IPA',
    svgPath: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    badge: activeQueueCount.value > 0 ? String(activeQueueCount.value) : null
  },
  {
    id: 'archive',
    label: '收藏',
    svgPath: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>'
  },
  {
    id: 'settings',
    label: '设置',
    svgPath: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>'
  }
])

const currentTabComponent = computed(() => {
  const map = {
    download: DownloadManager,
    ipa: IpaManager,
    archive: ArchiveApp,
    settings: Settings
  }
  return map[appStore.activeTab] || DownloadManager
})

const currentTabProps = computed(() => {
  if (appStore.activeTab === 'download') {
    return {
      selectedApp: appStore.downloadState.selectedApp,
      accountsUpdated: appStore.accountsUpdateCounter
    }
  }
  if (appStore.activeTab === 'ipa') {
    return { queue: appStore.taskQueue }
  }
  return {}
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
  gap: var(--space-2);
  min-height: calc(100vh - 72px);
  min-height: calc(100svh - 72px);
}

.desktop-tabs {
  display: flex;
  gap: var(--space-2);
  border-bottom: var(--border-width-thin) solid var(--separator);
}

.desktop-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  height: var(--size-control-lg);
  padding: 0 var(--space-3);
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.desktop-tab::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(var(--border-width-thin) * -1);
  height: 2px;
  border-radius: var(--radius-full);
  background: transparent;
}

.desktop-tab.is-active {
  color: var(--accent-blue);
}

.desktop-tab.is-active::after {
  background: var(--accent-blue);
}

.tab-content {
  flex: 1;
  min-height: 0;
}

.mobile-tabs-wrap {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  z-index: 50;
}

.mobile-tabs {
  display: grid;
  height: var(--size-tab-mobile);
  padding-bottom: env(safe-area-inset-bottom);
  border-top: var(--border-width-thin) solid var(--separator);
  background: var(--card-bg);
}

.mobile-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-0-5);
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.mobile-tab.is-active {
  color: var(--accent-blue);
}

.tab-content.with-mobile-tabs {
  /* Must match the actual fixed mobile tab bar height */
  padding-bottom: calc(var(--size-tab-mobile) + env(safe-area-inset-bottom) + var(--space-3));
}
</style>
