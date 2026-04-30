<template>
  <MobileCard
    v-if="showActionCard"
    class="progress-panel"
    shadow="never"
  >
    <!-- Environment Warning -->
    <div
      v-if="!isHttps && currentProtocol !== 'http:'"
      class="status-panel mb-3 p-3"
    >
      <div class="flex items-start space-x-2">
        <SvgIcon
          class="w-4 h-4 text-txt-secondary mt-0.5 flex-shrink-0"
          :icon="alertTriangleIcon"
        />
        <div class="flex-1">
          <p class="text-caption text-txt-secondary font-medium">
            环境检测
          </p>
          <p class="text-nano text-warning mt-1">
            当前协议: {{ currentProtocol || '未知' }} | iOS 安装需要 HTTPS 环境
          </p>
        </div>
      </div>
    </div>

    <!-- Download/Install Actions (when completed) -->
    <div
      v-if="downloadUrl || installUrl"
      class="grid gap-3 sm:grid-cols-2"
    >
      <MobileButton
        v-if="downloadUrl"
        type="primary"
        size="large"
        class="w-full"
        @click="$emit('download-ipa')"
      >
        <template #icon>
          <i><Download /></i>
        </template>
        下载 IPA{{ fileSize ? `（${formatFileSize(fileSize)}）` : '' }}
      </MobileButton>
      <a
        v-if="otaInstallable && installUrl && isHttps"
        :href="installUrl"
        class="block w-full"
      >
        <MobileButton
          type="primary"
          size="large"
          class="w-full"
        >
          <template #icon><i><Install /></i></template>
          安装到设备
        </MobileButton>
      </a>
      <MobileButton
        v-else-if="otaInstallable && installUrl"
        type="primary"
        size="large"
        class="w-full"
        @click="$emit('install-ipa')"
      >
        <template #icon>
          <i><Install /></i>
        </template>
        安装到设备
      </MobileButton>
      <MobileTag
        v-else-if="installMethod === 'download_only' && inspection && inspection.summary"
        size="large"
        type="primary"
        class="w-full text-center"
      >
        仅下载
      </MobileTag>
      <MobileTag
        v-else-if="installMethod === 'download_only'"
        size="large"
        type="primary"
        class="w-full text-center"
      >
        仅下载
      </MobileTag>
    </div>

    <p class="text-nano text-txt-secondary text-center">
      下载和安装已分离，请按需手动操作
    </p>
    <p
      v-if="installUrl && !isHttps"
      class="text-nano text-txt-secondary mt-1 text-center"
    >
      ⚠️ 按 OpenList / Oplist 方案，OTA 安装必须满足 HTTPS + 有效证书 + 已签名 IPA；若在 Telegram 内置浏览器中打开，也请改用 Safari
    </p>
  </MobileCard>
</template>

<script setup>
import { computed } from 'vue'
import MobileButton from './MobileButton.vue'
import MobileCard from './MobileCard.vue'
import MobileTag from './MobileTag.vue'
import SvgIcon from './SvgIcon.vue'
import { Download, Install } from './icons'
import alertTriangleIcon from '../assets/icons/alert-triangle.svg?raw'

defineEmits(['download-ipa', 'install-ipa'])

const props = defineProps({
  // Download result state
  downloadUrl: {
    type: String,
    default: ''
  },
  installUrl: {
    type: String,
    default: ''
  },
  fileSize: {
    type: Number,
    default: 0
  },
  otaInstallable: {
    type: Boolean,
    default: false
  },
  installMethod: {
    type: String,
    default: ''
  },
  inspection: {
    type: Object,
    default: null
  },
  // Environment
  isHttps: {
    type: Boolean,
    default: false
  },
  currentProtocol: {
    type: String,
    default: ''
  }
})

const showActionCard = computed(() => {
  return props.downloadUrl || props.installUrl
})

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}
</script>

<style scoped>
.progress-panel {
  margin-top: 16px;
}

.status-panel {
  border-radius: 14px;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
}

.dark .status-panel {
  background: var(--color-surface);
  border-color: var(--color-surface-muted);
}
</style>
