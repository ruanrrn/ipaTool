<template>
  <div class="card">
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center space-x-3">
        <div class="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </div>
        <div>
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">下载队列</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ queue.length }} 个任务</p>
        </div>
      </div>
      <button
        v-if="queue.length > 0"
        @click="clearAll"
        class="px-3 py-1 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
      >
        清空队列
      </button>
    </div>

    <div v-if="localQueue.length > 0">
      <el-space direction="vertical" :size="12" fill>
        <el-card
          v-for="(item, index) in localQueue"
          :key="item.id || index"
          shadow="hover"
          class="queue-item-card"
        >
          <div class="flex items-start space-x-4">
            <el-image
              :src="item.app.artworkUrl100 || item.app.artworkUrl60"
              :alt="item.app.trackName"
              class="w-12 h-12 rounded-lg shadow-md flex-shrink-0"
              fit="cover"
            />
            <div class="flex-1 min-w-0" style="overflow: hidden;">
              <div class="flex items-center justify-between gap-2">
                <h3 class="font-semibold text-gray-900 dark:text-white truncate" style="flex: 1; min-width: 0;">{{ item.app.trackName }}</h3>
                <el-tag
                  :type="getStatusTagType(item.status)"
                  size="small"
                  class="flex-shrink-0"
                >
                  {{ getStatusText(item.status) }}
                </el-tag>
              </div>
              <p class="text-sm text-gray-500 dark:text-gray-400 truncate">{{ item.account.email }}</p>
              
              <!-- Progress Bar -->
              <div v-if="item.status === 'downloading' || item.status === 'signing' || (item.progress > 0 && item.progress < 100)" class="mt-3">
                <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span>{{ item.stage || (item.status === 'downloading' ? '下载中' : '处理中') }}</span>
                  <span>{{ item.progress }}%</span>
                </div>
                <el-progress 
                  :percentage="item.progress" 
                  :stroke-width="8"
                  :status="item.status === 'error' ? 'exception' : item.status === 'completed' ? 'success' : ''"
                />
              </div>

              <!-- Action Buttons -->
              <div v-if="item.status === 'completed'" class="mt-3 flex items-center space-x-2">
                <el-button
                  @click="downloadFile(item)"
                  type="primary"
                  size="small"
                  :icon="Download"
                >
                  下载文件
                </el-button>
                <el-button
                  @click="removeItem(index)"
                  type="danger"
                  size="small"
                  :icon="Delete"
                >
                  删除
                </el-button>
              </div>

              <!-- Error Message -->
              <el-alert
                v-if="item.status === 'error'"
                :title="item.error || '处理失败，请重试'"
                type="error"
                :closable="false"
                class="mt-2"
                show-icon
              />
            </div>
          </div>
        </el-card>
      </el-space>
    </div>

    <!-- Empty State -->
    <el-empty
      v-else
      description="队列为空"
      :image-size="160"
    >
      <template #description>
        <p class="text-gray-500 dark:text-gray-400">下载和签名任务将显示在这里</p>
      </template>
    </el-empty>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useAppStore } from '../stores/app'
import { Download, Delete } from '@element-plus/icons-vue'
import { ElMessageBox, ElMessage } from 'element-plus'

const API_BASE = '/api'
const appStore = useAppStore()

const props = defineProps({
  queue: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['remove-item', 'clear-all'])

// 本地队列状态，用于实时更新
const localQueue = ref([])
const eventSources = ref(new Map()) // Map<jobId, EventSource>

// 连接SSE获取实时进度
const connectToSSE = (jobId, index) => {
  if (eventSources.value.has(jobId)) return
  
  const es = new EventSource(`${API_BASE}/progress-sse?jobId=${encodeURIComponent(jobId)}`)
  eventSources.value.set(jobId, es)
  
  es.addEventListener('progress', (ev) => {
    try {
      const data = JSON.parse(ev.data)
      if (data?.progress?.percent != null && localQueue.value[index]) {
        localQueue.value[index].progress = data.progress.percent
        // 同步到store
        appStore.updateQueueItem(jobId, { progress: data.progress.percent })
      }
      
      if (data?.progress?.stage && localQueue.value[index]) {
        const stageMap = {
          'auth': '获取下载信息',
          'download-start': '开始下载',
          'download-progress': '下载中',
          'merge': '合并分块',
          'sign': '写入签名',
          'done': '完成'
        }
        localQueue.value[index].stage = stageMap[data.progress.stage] || data.progress.stage
        appStore.updateQueueItem(jobId, { stage: localQueue.value[index].stage })
      }
      
      if (data.status === 'ready' && localQueue.value[index]) {
        localQueue.value[index].status = 'completed'
        localQueue.value[index].progress = 100
        appStore.updateQueueItem(jobId, { status: 'completed', progress: 100 })
      }
      
      if (data.error && localQueue.value[index]) {
        localQueue.value[index].status = 'error'
        localQueue.value[index].error = data.error
        appStore.updateQueueItem(jobId, { status: 'error', error: data.error })
      }
    } catch (e) {
      console.error('SSE parse error:', e)
    }
  })
  
  es.addEventListener('end', (ev) => {
    try {
      const data = JSON.parse(ev.data || '{}')
      if (data.status === 'failed' && localQueue.value[index]) {
        localQueue.value[index].status = 'error'
        appStore.updateQueueItem(jobId, { status: 'error' })
      }
    } catch (_) {}
    es.close()
    eventSources.value.delete(jobId)
  })
  
  es.onerror = () => {
    if (localQueue.value[index]) {
      localQueue.value[index].status = 'error'
      localQueue.value[index].error = '连接断开'
      appStore.updateQueueItem(jobId, { status: 'error', error: '连接断开' })
    }
    es.close()
    eventSources.value.delete(jobId)
  }
}

// 组件卸载时关闭所有SSE连接
onUnmounted(() => {
  eventSources.value.forEach(es => es.close())
  eventSources.value.clear()
})

// 同步props.queue到localQueue
watch(() => props.queue, (newQueue) => {
  localQueue.value = [...newQueue]
  // 为新的downloading任务建立SSE连接
  newQueue.forEach((item, index) => {
    if ((item.status === 'downloading' || item.status === 'signing') && item.id && !eventSources.value.has(item.id)) {
      connectToSSE(item.id, index)
    }
  })
}, { immediate: true, deep: true })

const getStatusTagType = (status) => {
  const types = {
    pending: 'info',
    downloading: 'primary',
    signing: 'warning',
    completed: 'success',
    error: 'danger'
  }
  return types[status] || 'info'
}

const getStatusText = (status) => {
  const texts = {
    pending: '等待中',
    downloading: '下载中',
    signing: '签名中',
    completed: '已完成',
    error: '失败'
  }
  return texts[status] || '未知'
}

const downloadFile = (item) => {
  if (item.id) {
    const a = document.createElement('a')
    a.href = `${API_BASE}/download-file?jobId=${encodeURIComponent(item.id)}`
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } else {
    ElMessage.error('无法下载：任务ID不存在')
  }
}

const removeItem = (index) => {
  emit('remove-item', index)
}

const clearAll = () => {
  ElMessageBox.confirm(
    '确定要清空所有任务吗？',
    '确认操作',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    emit('clear-all')
  }).catch(() => {
    // 用户取消
  })
}
</script>

<style scoped>
.queue-item-card :deep(.el-card__body) {
  padding: 16px;
}

.queue-item-card :deep(.el-image__inner) {
  border-radius: 8px;
}

.queue-item-card :deep(.el-progress-bar__outer) {
  border-radius: 6px;
}

.queue-item-card :deep(.el-progress-bar__inner) {
  border-radius: 6px;
}

.queue-item-card :deep(.el-tag) {
  border-radius: 6px;
  font-weight: 500;
}

.queue-item-card :deep(.el-button) {
  border-radius: 8px;
  font-weight: 500;
}

.queue-item-card :deep(.el-alert) {
  border-radius: 8px;
}

/* 状态标签颜色优化 */
.queue-item-card :deep(.el-tag--success) {
  background-color: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.3);
  color: #059669;
}

.dark .queue-item-card :deep(.el-tag--success) {
  background-color: rgba(16, 185, 129, 0.2);
  border-color: rgba(16, 185, 129, 0.4);
  color: #34d399;
}

.queue-item-card :deep(.el-tag--danger) {
  background-color: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: #dc2626;
}

.dark .queue-item-card :deep(.el-tag--danger) {
  background-color: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
  color: #f87171;
}

.queue-item-card :deep(.el-tag--warning) {
  background-color: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.3);
  color: #d97706;
}

.dark .queue-item-card :deep(.el-tag--warning) {
  background-color: rgba(245, 158, 11, 0.2);
  border-color: rgba(245, 158, 11, 0.4);
  color: #fbbf24;
}

.queue-item-card :deep(.el-tag--info) {
  background-color: rgba(107, 114, 128, 0.1);
  border-color: rgba(107, 114, 128, 0.3);
  color: #4b5563;
}

.dark .queue-item-card :deep(.el-tag--info) {
  background-color: rgba(107, 114, 128, 0.2);
  border-color: rgba(107, 114, 128, 0.4);
  color: #9ca3af;
}
</style>
