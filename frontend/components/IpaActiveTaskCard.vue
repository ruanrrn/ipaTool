<template>
  <div class="queue-item">
    <!-- Icon -->
    <AppArtwork
      :src="task.artworkUrl"
      :alt="task.appName"
      :label="task.appName"
      class="queue-item__icon"
    />

    <!-- Info -->
    <div class="queue-item__info">
      <div class="queue-item__name">
        {{ task.appName }}
      </div>
      <div class="queue-item__meta">
        <span>版本 {{ task.version || '未知' }}</span>
        <span>{{ task.accountEmail || task.account?.email || '未知账号' }}</span>
      </div>

      <!-- Progress -->
      <div
        v-if="task.status !== 'failed' && task.progress !== undefined"
        class="queue-item__progress"
      >
        <ProgressBar
          :percent="task.progress"
          :color="task.stage === 'signing' ? 'var(--color-warning, #f59e0b)' : 'var(--color-primary, #10a37f)'"
          size="default"
        />
        <div class="queue-item__progress-info">
          <span>{{ localizeProgressStage(task.stage || '下载中') }} {{ task.progress }}%</span>
          <span v-if="task.fileSize">{{ formatFileSize(task.fileSize) }}</span>
        </div>
      </div>

      <!-- Error -->
      <div
        v-if="task.error"
        class="queue-item__error"
      >
        {{ task.error }}
      </div>
    </div>

    <!-- Actions -->
    <div class="queue-item__actions">
      <button
        class="q-btn q-btn--pause"
        :title="paused ? '继续任务' : '暂停任务'"
        @click="emit('toggle-pause', task.id)"
      >
        <SvgIcon
          v-if="!paused"
          class="h-[14px] w-[14px]"
          :icon="pauseIcon"
        />
        <SvgIcon
          v-else
          class="h-[14px] w-[14px]"
          :icon="playIcon"
        />
      </button>
      <button
        class="q-btn"
        title="取消任务"
        @click="emit('remove', task.id)"
      >
        <SvgIcon
          class="h-[14px] w-[14px]"
          :icon="closeIcon"
        />
      </button>
    </div>
  </div>
</template>

<script setup>
import AppArtwork from './AppArtwork.vue'
import ProgressBar from './ProgressBar.vue'
import SvgIcon from './SvgIcon.vue'
import { localizeProgressStage } from '../composables/useDownload.js'
import pauseIcon from '../assets/icons/pause-fill.svg?raw'
import playIcon from '../assets/icons/play-fill.svg?raw'
import closeIcon from '../assets/icons/close.svg?raw'

defineProps({
  task: { type: Object, required: true },
  paused: { type: Boolean, default: false }
})

const emit = defineEmits(['toggle-pause', 'remove'])

const formatFileSize = (bytes) => {
  if (!bytes) return '未知'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) { value /= 1024; unitIndex += 1 }
  return `${value.toFixed(value >= 100 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}
</script>

<style scoped>
/* Queue Item */
.queue-item {
 display: flex;
 align-items: center;
 gap: 12px;
 padding: 14px;
 background: var(--color-surface, #fff);
 border: 1px solid var(--color-border, #ebebeb);
 border-radius: 14px;
 transition: opacity 0.2s ease;
}
.queue-item:active {
 opacity: 0.8;
}
.dark .queue-item {
 background: var(--color-surface, #18181b);
 border-color: var(--color-surface-muted, #27272a);
}

/* Icon container — override AppArtwork sizing */
.queue-item__icon {
  width: 44px !important;
  height: 44px !important;
  border-radius: 11px !important;
  flex-shrink: 0;
}

/* Info area */
.queue-item__info {
  flex: 1;
  min-width: 0;
}

.queue-item__name {
 font-size: 14px;
 font-weight: 600;
 color: var(--color-text, #0d0d0d);
 white-space: nowrap;
 overflow: hidden;
 text-overflow: ellipsis;
}
.dark .queue-item__name {
 color: var(--color-text, #f5f5f5);
}

.queue-item__meta {
 display: flex;
 gap: 10px;
 font-size: 11px;
 color: var(--color-text-muted, #6e6e80);
 margin-top: 2px;
}
.dark .queue-item__meta {
 color: var(--color-text-muted, #a1a1aa);
}

/* Progress area */
.queue-item__progress {
 margin-top: 6px;
}

.queue-item__progress-info {
 display: flex;
 justify-content: space-between;
 font-size: 10px;
 color: var(--color-text-muted, #6e6e80);
 margin-top: 3px;
}
.dark .queue-item__progress-info {
 color: var(--color-text-muted, #a1a1aa);
}

/* Error text */
.queue-item__error {
 font-size: 11px;
 color: var(--color-danger, #ef4444);
 margin-top: 4px;
}

/* Actions */
.queue-item__actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

/* Action button base */
.q-btn {
 width: 32px;
 height: 32px;
 border-radius: 8px;
 border: 1px solid var(--color-border, #ebebeb);
 background: var(--color-surface, #fff);
 color: var(--color-text-muted, #6e6e80);
 font-size: 14px;
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

.q-btn--pause {
  color: var(--color-warning);
  border-color: var(--color-warning-border);
  background: var(--color-warning-bg);
}
.dark .q-btn--pause {
  color: var(--color-warning);
  border-color: rgba(245, 158, 11, 0.5);
  background: rgba(245, 158, 11, 0.1);
}
</style>
