<template>
  <div class="version-picker">
    <!-- Fetching Versions (auto-triggered) -->
    <div
      v-if="fetchingVersions"
      class="version-picker__section version-picker__loading-section"
    >
      <div class="version-picker__loading-spinner" />
      <span>正在查询版本...</span>
    </div>

    <!-- Version List (radio style) -->
    <div
      v-else-if="versionsFetched && versions.length > 0"
      class="version-picker__section"
    >
      <div class="version-picker__section-header">
        <span class="version-picker__section-title">选择版本</span>
        <div class="version-picker__section-actions">
          <button
            type="button"
            class="version-picker__manual-btn"
            @click="emit('manual-version-request')"
          >
            手动输入版本 ID
          </button>
          <span class="version-picker__section-count">共 {{ versions.length }} 个</span>
        </div>
      </div>
      <div class="version-picker__version-list">
        <div
          v-for="(ver, idx) in versions"
          :key="ver.external_identifier || ver.version_id || ver.id || idx"
          class="version-radio-item"
          :class="{ 'version-radio-item--selected': selectedVersion === String(ver.external_identifier ?? ver.version_id ?? ver.id) }"
          @click="selectVersionRadio(ver)"
        >
          <div class="version-radio-item__radio">
            <div
              v-if="selectedVersion === String(ver.external_identifier ?? ver.version_id ?? ver.id)"
              class="version-radio-item__radio-fill"
            />
          </div>
          <div class="version-radio-item__content">
            <div class="version-radio-item__top">
              <span class="version-radio-item__ver">{{ ver.bundle_version || ver.version || ver.name || ver.version_id || '未知版本' }}</span>
              <span
                v-if="idx === 0"
                class="version-radio-item__badge-latest"
              >最新</span>
            </div>
            <div class="version-radio-item__meta">
              <span v-if="ver.created_at || ver.date">{{ ver.created_at || ver.date }}</span>
              <span>{{ getVersionSizeLabel(ver) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty result after fetched -->
    <div
      v-else-if="versionsFetched"
      class="version-picker__section version-picker__empty-section"
    >
      <p class="version-picker__empty-title">
        未查询到可用版本
      </p>
      <p
        v-if="appid"
        class="version-picker__appid-hint"
      >
        APPID: <strong class="font-mono">{{ appid }}</strong>
      </p>
    </div>

    <!-- Initial hint before fetch -->
    <div
      v-else-if="appid"
      class="version-picker__section"
    >
      <p class="version-picker__appid-hint">
        APPID: <strong class="font-mono">{{ appid }}</strong>
      </p>
    </div>
  </div>
</template>

<script setup>
import { getVersionId, normalizeVersionSize } from '../utils/version.js'

const props = defineProps({
  versions: {
    type: Array,
    default: () => []
  },
  selectedVersion: {
    type: String,
    default: ''
  },
  versionsFetched: {
    type: Boolean,
    default: false
  },
  fetchingVersions: {
    type: Boolean,
    default: false
  },
  appid: {
    type: String,
    default: ''
  },
  formatFileSize: {
    type: Function,
    required: true
  }
})

const emit = defineEmits(['version-selected', 'manual-version-request'])

const selectVersionRadio = (ver) => {
  const verId = getVersionId(ver)
  emit('version-selected', verId, ver)
}

const getVersionSizeLabel = (version) => {
  const versionSize = normalizeVersionSize(version)
  if (versionSize > 0) return props.formatFileSize(versionSize)
  return '大小未知'
}
</script>

<style scoped>
.version-picker {
  /* Container styles inherited from parent */
}

.version-picker__section {
  padding: 16px 0;
}

.version-picker__loading-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  gap: 12px;
  color: var(--color-txt-secondary);
}

.version-picker__loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.version-picker__empty-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.version-picker__empty-title {
  margin: 0;
  font-size: var(--font-size-body);
  font-weight: 600;
  color: var(--color-txt);
}

.version-picker__appid-hint {
  padding: 12px 16px;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  font-size: var(--font-size-caption);
  color: var(--color-txt-secondary);
}

.version-picker__section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.version-picker__section-title {
  font-size: var(--font-size-body);
  font-weight: 600;
  color: var(--color-txt);
}

.version-picker__section-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.version-picker__manual-btn {
  border: none;
  background: transparent;
  color: var(--color-primary);
  font-size: var(--font-size-caption);
  font-weight: 600;
  padding: 0;
  cursor: pointer;
}

.version-picker__section-count {
  font-size: var(--font-size-caption);
  color: var(--color-txt-secondary);
}

.version-picker__version-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: min(320px, 34vh);
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding-right: 4px;
}

.version-radio-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 12px;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-xl, 12px);
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.version-radio-item--selected {
  background: var(--color-bg-primary);
  border-color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(var(--color-primary-rgb), 0.1);
}

.version-radio-item:active {
  transform: scale(0.98);
}

.version-radio-item__radio {
  position: relative;
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-radius: 50%;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.version-radio-item--selected .version-radio-item__radio {
  border-color: var(--color-primary);
}

.version-radio-item__radio-fill {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 10px;
  height: 10px;
  background: var(--color-primary);
  border-radius: 50%;
}

.version-radio-item__content {
  flex: 1;
  min-width: 0;
}

.version-radio-item__top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.version-radio-item__ver {
  font-size: var(--font-size-body);
  font-weight: 500;
  color: var(--color-txt);
  flex-shrink: 0;
}

.version-radio-item__badge-latest {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  background: var(--color-primary);
  color: white;
  font-size: var(--font-size-nano);
  font-weight: 600;
  border-radius: 4px;
  flex-shrink: 0;
}

.version-radio-item__meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: var(--font-size-caption);
  color: var(--color-txt-secondary);
}

/* Dark mode styles */
.dark .version-radio-item {
  background: var(--dark-color-bg-secondary);
}

.dark .version-radio-item--selected {
  background: var(--dark-color-bg-primary);
  border-color: var(--dark-color-primary);
  box-shadow: 0 2px 8px rgba(var(--dark-color-primary-rgb), 0.15);
}

.dark .version-radio-item__radio {
  border-color: var(--dark-color-border);
}

.dark .version-radio-item--selected .version-radio-item__radio {
  border-color: var(--dark-color-primary);
}

.dark .version-radio-item__radio-fill {
  background: var(--dark-color-primary);
}

.dark .version-radio-item__ver {
  color: var(--dark-color-txt);
}

.dark .version-radio-item__badge-latest {
  background: var(--dark-color-primary);
}

.dark .version-radio-item__meta {
  color: var(--dark-color-txt-secondary);
}

.dark .version-picker__loading-spinner {
  border-color: var(--dark-color-border);
  border-top-color: var(--dark-color-primary);
}

.dark .version-picker__appid-hint {
  background: var(--dark-color-bg-secondary);
  color: var(--dark-color-txt-secondary);
}

.dark .version-picker__section-title {
  color: var(--dark-color-txt);
}

.dark .version-picker__section-count {
  color: var(--dark-color-txt-secondary);
}
</style>
