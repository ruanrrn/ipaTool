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
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ queue.length }} 个任务 | {{ records.length }} 条记录</p>
        </div>
      </div>
      <div class="flex items-center space-x-2">
        <button
          @click="loadRecords"
          class="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          title="刷新记录"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 任务队列 -->
    <div v-if="queue.length > 0" class="mb-6">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">进行中的任务</h3>
      <el-space direction="vertical" :size="12" fill>
        <el-card
          v-for="task in queue"
          :key="task.id"
          shadow="hover"
          class="record-card"
        >
          <div class="flex items-start space-x-4">
            <el-image
              :src="task.artworkUrl || 'https://via.placeholder.com/60'"
              :alt="task.appName"
              class="w-12 h-12 rounded-lg shadow-md flex-shrink-0"
              fit="cover"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-2">
                <h3 class="font-semibold text-gray-900 dark:text-white truncate">{{ task.appName }}</h3>
                <el-tag
                  :type="task.status === 'completed' ? 'success' : task.status === 'failed' ? 'danger' : 'warning'"
                  size="small"
                  class="flex-shrink-0"
                >
                  {{ task.status === 'completed' ? '已完成' : task.status === 'failed' ? '失败' : '进行中' }}
                </el-tag>
              </div>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ task.artistName || '未知开发者' }}</p>
              <div class="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span>版本: {{ task.version }}</span>
                <span v-if="task.fileSize">大小: {{ formatFileSize(task.fileSize) }}</span>
                <span v-if="task.progress !== undefined">进度: {{ task.progress }}%</span>
              </div>
              <div v-if="task.status === 'completed' && task.installUrl" class="flex items-center gap-2 mt-3">
                <el-button
                  @click="install(task)"
                  type="primary"
                  size="small"
                  :icon="Download"
                >
                  安装
                </el-button>
                <el-button
                  @click="removeTask(task.id)"
                  type="danger"
                  size="small"
                  :icon="Delete"
                  plain
                >
                  移除
                </el-button>
              </div>
              <div v-else-if="task.status === 'failed'" class="flex items-center gap-2 mt-3">
                <p class="text-xs text-red-500">{{ task.error || '下载失败' }}</p>
                <el-button
                  @click="removeTask(task.id)"
                  type="danger"
                  size="small"
                  :icon="Delete"
                  plain
                >
                  移除
                </el-button>
              </div>
              <div v-else class="flex items-center gap-2 mt-3">
                <el-button
                  @click="removeTask(task.id)"
                  type="danger"
                  size="small"
                  :icon="Delete"
                  plain
                >
                  取消
                </el-button>
              </div>
            </div>
          </div>
        </el-card>
      </el-space>
    </div>

    <!-- 下载记录 -->
    <div v-if="records.length > 0">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">下载记录</h3>
        <el-button
          @click="clearAllRecords"
          type="danger"
          size="small"
          :icon="Delete"
          plain
        >
          清空全部
        </el-button>
      </div>
      <el-space direction="vertical" :size="12" fill>
        <el-card
          v-for="record in records"
          :key="record.id"
          shadow="hover"
          class="record-card"
        >
          <div class="flex items-start space-x-4">
            <el-image
              :src="record.artwork_url || 'https://via.placeholder.com/60'"
              :alt="record.app_name"
              class="w-12 h-12 rounded-lg shadow-md flex-shrink-0"
              fit="cover"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-2">
                <h3 class="font-semibold text-gray-900 dark:text-white truncate">{{ record.app_name }}</h3>
                <el-tag
                  :type="record.status === 'completed' ? 'success' : record.status === 'failed' ? 'danger' : 'warning'"
                  size="small"
                  class="flex-shrink-0"
                >
                  {{ record.status === 'completed' ? '已完成' : record.status === 'failed' ? '失败' : '下载中' }}
                </el-tag>
              </div>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ record.artist_name || '未知开发者' }}</p>
              <div class="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span>版本: {{ record.version || '未知' }}</span>
                <span v-if="record.file_size">大小: {{ formatFileSize(record.file_size) }}</span>
                <span>{{ formatDate(record.download_date) }}</span>
                <span v-if="record.status === 'downloading' && record.progress !== undefined">进度: {{ record.progress }}%</span>
              </div>
              <!-- 进度条 -->
              <div v-if="record.status === 'downloading' && record.progress !== undefined" class="mt-2">
                <el-progress :percentage="record.progress" :stroke-width="6" />
              </div>
              <!-- 错误信息 -->
              <div v-if="record.status === 'failed' && record.error" class="mt-2">
                <p class="text-xs text-red-500">错误: {{ record.error }}</p>
              </div>
              <div class="flex items-center gap-2 mt-3">
                <el-button
                  v-if="record.status === 'completed' && record.install_url"
                  @click="install(record)"
                  type="primary"
                  size="small"
                  :icon="Download"
                >
                  安装
                </el-button>
                <el-button
                  @click="removeRecord(record.id)"
                  type="danger"
                  size="small"
                  :icon="Delete"
                  plain
                >
                  删除
                </el-button>
              </div>
            </div>
          </div>
        </el-card>
      </el-space>
    </div>

    <!-- Empty State -->
    <div v-if="queue.length === 0 && records.length === 0" class="text-center py-12 text-gray-500 dark:text-gray-400">
      <svg class="mx-auto h-16 w-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p class="text-lg font-medium">暂无下载任务和记录</p>
      <p class="text-sm mt-2">下载的任务和记录会显示在这里</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, Delete } from '@element-plus/icons-vue'

const API_BASE = '/api'

const props = defineProps({
  queue: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['remove-item', 'clear-queue'])

const records = ref([])
const loading = ref(false)

// 加载下载记录
const loadRecords = async () => {
  loading.value = true
  try {
    const response = await fetch(`${API_BASE}/download-records`)
    const data = await response.json()
    if (data.ok) {
      records.value = data.data || []
    }
  } catch (error) {
    console.error('Failed to load download records:', error)
    ElMessage.error('加载下载记录失败')
  } finally {
    loading.value = false
  }
}

// 删除记录
const removeRecord = async (id) => {
  try {
    await ElMessageBox.confirm('确定要删除这条记录吗？', '确认删除', {
      type: 'warning'
    })

    const response = await fetch(`${API_BASE}/download-records/${id}`, {
      method: 'DELETE'
    })
    const data = await response.json()

    if (data.ok) {
      ElMessage.success('删除成功')
      await loadRecords()
    } else {
      ElMessage.error(data.error || '删除失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to delete record:', error)
      ElMessage.error('删除失败')
    }
  }
}

// 清空所有记录
const clearAllRecords = async () => {
  try {
    await ElMessageBox.confirm('确定要清空所有下载记录吗？此操作不可恢复！', '确认清空', {
      type: 'warning',
      confirmButtonText: '确定清空',
      cancelButtonText: '取消'
    })

    const response = await fetch(`${API_BASE}/download-records`, {
      method: 'DELETE'
    })
    const data = await response.json()

    if (data.ok) {
      ElMessage.success('清空成功')
      await loadRecords()
    } else {
      ElMessage.error(data.error || '清空失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to clear records:', error)
      ElMessage.error('清空失败')
    }
  }
}

// 移除任务
const removeTask = (id) => {
  emit('remove-item', id)
}

// 安装（如果有安装URL）
const install = (item) => {
  const url = item.installUrl || item.install_url
  if (url) {
    window.location.href = url
  } else {
    ElMessage.warning('该记录没有安装链接')
  }
}

// 格式化文件大小
const formatFileSize = (bytes) => {
  if (!bytes) return '未知'
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return '未知'
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(() => {
  loadRecords()
})
</script>

<style scoped>
.card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.dark .card {
  background: #1f2937;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.record-card {
  transition: all 0.2s ease;
}

.record-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* 移动端响应式 */
@media (max-width: 767px) {
  .card {
    padding: 12px;
  }
  
  .record-card :deep(.el-card__body) {
    padding: 12px;
  }
}
</style>
