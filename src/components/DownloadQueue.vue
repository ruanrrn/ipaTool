<template>
  <div class="space-y-4">
    <div class="card flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center space-x-3">
        <div class="hero-icon">
          <svg
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <line
              x1="8"
              y1="6"
              x2="21"
              y2="6"
            />
            <line
              x1="8"
              y1="12"
              x2="21"
              y2="12"
            />
            <line
              x1="8"
              y1="18"
              x2="21"
              y2="18"
            />
            <line
              x1="3"
              y1="6"
              x2="3.01"
              y2="6"
            />
            <line
              x1="3"
              y1="12"
              x2="3.01"
              y2="12"
            />
            <line
              x1="3"
              y1="18"
              x2="3.01"
              y2="18"
            />
          </svg>
        </div>
        <div>
          <h2 class="text-xl font-bold text-primary">
            下载队列
          </h2>
          <p class="text-sm text-secondary">
            {{ currentTasks.length }} 个当前任务 · {{ records.length }} 条记录 · 已占用 {{ formatStorageM(totalStorageBytes) }}
          </p>
        </div>
      </div>
      <div class="flex gap-2">
        <el-button
          size="small"
          plain
          @click="loadRecords"
        >
          刷新
        </el-button>
        <el-button
          size="small"
          type="danger"
          plain
          @click="cleanupServerFiles"
        >
          清理服务器文件
        </el-button>
      </div>
    </div>

    <section
      v-if="currentTasks.length > 0"
      class="space-y-4"
    >
      <h3 class="text-lg font-semibold text-primary">
        当前任务
      </h3>
      <div
        v-for="task in currentTasks"
        :key="task.id"
        class="queue-row"
      >
        <AppArtwork
          :src="task.artworkUrl"
          :alt="task.appName"
          :label="task.appName"
        />
        <div class="row-main">
          <div class="row-top">
            <div class="min-w-0">
              <div class="row-title">
                {{ task.appName }}
              </div>
              <div class="row-meta">
                <span>{{ task.artistName || '未知开发者' }}</span>
                <span>版本 {{ task.version || '未知' }}</span>
                <span>账号 {{ task.accountEmail || task.account?.email || '未知账号' }}</span>
              </div>
            </div>
            <el-tag
              :type="statusTagType(task.status)"
              size="small"
            >
              {{ statusLabel(task.status) }}
            </el-tag>
          </div>
          <div class="row-info">
            <span v-if="task.fileSize">大小 {{ formatFileSize(task.fileSize) }}</span>
            <span v-if="task.progress !== undefined">进度 {{ task.progress }}%</span>
            <span v-if="task.stage">阶段 {{ task.stage }}</span>
          </div>
          <el-progress
            v-if="task.status !== 'completed' && task.status !== 'failed' && task.progress !== undefined"
            :percentage="task.progress"
            :stroke-width="6"
          />
          <div
            v-if="task.error"
            class="row-error"
          >
            {{ task.error }}
          </div>
          <div class="row-actions">
            <el-button
              v-if="task.status === 'completed' && task.downloadUrl"
              type="primary"
              size="small"
              @click="download(task.downloadUrl)"
            >
              下载
            </el-button>
            <el-button
              v-if="task.status === 'completed' && task.otaInstallable && task.installUrl"
              type="primary"
              size="small"
              @click="install(task.installUrl)"
            >
              安装
            </el-button>
            <el-button
              v-else-if="task.status === 'completed' && task.installMethod === 'download_only'"
              size="small"
              type="primary"
              plain
              disabled
            >
              仅下载
            </el-button>
            <el-button
              size="small"
              type="danger"
              plain
              @click="removeTask(task.id)"
            >
              {{ task.status === 'completed' || task.status === 'failed' ? '移除' : '取消' }}
            </el-button>
          </div>
        </div>
      </div>
    </section>

    <section
      v-if="records.length > 0"
      class="space-y-4"
    >
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-lg font-semibold text-primary">
          下载记录
        </h3>
        <el-button
          size="small"
          type="danger"
          plain
          @click="clearAllRecords"
        >
          清空记录
        </el-button>
      </div>
      <div
        v-for="record in records"
        :key="record.id"
        class="queue-row"
      >
        <AppArtwork
          :src="record.artworkUrl"
          :alt="record.appName"
          :label="record.appName || 'IPA'"
        />
        <div class="row-main">
          <div class="row-top">
            <div class="min-w-0">
              <div class="row-title">
                {{ record.appName || '未命名 IPA' }}
              </div>
              <div class="row-meta">
                <span>{{ record.artistName || '未知开发者' }}</span>
                <span>版本 {{ record.version || '未知' }}</span>
                <span>账号 {{ record.accountEmail || '未知账号' }}</span>
              </div>
            </div>
            <el-tag
              :type="statusTagType(record.status)"
              size="small"
            >
              {{ statusLabel(record.status) }}
            </el-tag>
          </div>
          <div class="row-info">
            <span v-if="record.fileSize">大小 {{ formatFileSize(record.fileSize) }}</span>
            <span>{{ formatDate(record.downloadDate || record.createdAt) }}</span>
            <span>{{ record.fileExists ? '文件在服务器' : '文件缺失' }}</span>
          </div>
          <div
            v-if="record.error"
            class="row-error"
          >
            {{ record.error }}
          </div>
          <div class="row-actions">
            <el-button
              v-if="record.downloadUrl && record.fileExists"
              type="primary"
              size="small"
              @click="download(record.downloadUrl)"
            >
              下载
            </el-button>

            <el-button
              v-if="record.fileExists && record.otaInstallable && record.installUrl"
              type="primary"
              size="small"
              @click="install(record.installUrl)"
            >
              安装
            </el-button>
            <el-tooltip
              v-else-if="record.fileExists && record.installMethod === 'download_only'"
              :content="record.inspection?.summary || ''"
              :disabled="!record.inspection?.summary"
              placement="top"
            >
              <span>
                <el-button
                  size="small"
                  type="primary"
                  plain
                  disabled
                >
                  仅下载
                </el-button>
              </span>
            </el-tooltip>

            <el-button
              v-if="record.fileExists"
              size="small"
              type="danger"
              plain
              @click="cleanupRecordFile(record)"
            >
              清理安装包
            </el-button>
            <el-button
              size="small"
              type="danger"
              plain
              @click="removeRecord(record.id)"
            >
              删除记录
            </el-button>
          </div>
        </div>
      </div>
    </section>

    <div
      v-if="currentTasks.length === 0 && records.length === 0"
      class="empty-state py-12 text-center text-secondary"
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
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <p class="text-lg font-medium">
        暂无下载任务和记录
      </p>
      <p class="text-sm mt-2">
        完成后可在这里查看状态与操作
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppArtwork from './AppArtwork.vue'
import { useAppStore } from '../stores/app'

const API_BASE = '/api'
const props = defineProps({
 queue: {
 type: Array,
 default: () => []
 }
})

const emit = defineEmits(['remove-item'])
const appStore = useAppStore()
const records = ref([])
const pollTimers = new Map()
const pollFailureCounts = new Map()
const MAX_POLL_FAILURES = 5
const currentTasks = computed(() => props.queue.filter(task => !['completed', 'ready'].includes(task?.status)))
const totalStorageBytes = computed(() => records.value.reduce((sum, item) => {
 if (!item?.fileExists) return sum
 return sum + Number(item.fileSize || 0)
}, 0))

const loadRecords = async () => {
 try {
 const response = await fetch(`${API_BASE}/download-records`, { credentials: 'include' })
 const data = await response.json()
 if (data.ok) {
 records.value = data.data || []
 } else {
 ElMessage.error(data.error || '加载记录失败')
 }
 } catch (error) {
 console.error('Failed to load download records:', error)
 ElMessage.error('加载记录失败')
 }
}

const removeRecord = async (id) => {
 try {
 await ElMessageBox.confirm('确定删除这条记录吗？', '确认删除', { type: 'error', confirmButtonClass: 'danger-confirm-button', lockScroll: false })
 const response = await fetch(`${API_BASE}/download-records/${id}`, {
 method: 'DELETE',
 credentials: 'include'
 })
 const data = await response.json()
 if (!data.ok) throw new Error(data.error || '删除失败')
 ElMessage.success('记录已删除')
 await loadRecords()
 } catch (error) {
 if (error !== 'cancel') {
 ElMessage.error(error.message || '删除失败')
 }
 }
}

const clearAllRecords = async () => {
 try {
 await ElMessageBox.confirm('确定清空全部下载记录吗？', '确认清空', {
 type: 'error',
 confirmButtonText: '清空',
 cancelButtonText: '取消',
 confirmButtonClass: 'danger-confirm-button',
 lockScroll: false
 })
 const response = await fetch(`${API_BASE}/download-records`, {
 method: 'DELETE',
 credentials: 'include'
 })
 const data = await response.json()
 if (!data.ok) throw new Error(data.error || '清空失败')
 ElMessage.success('记录已清空')
 await loadRecords()
 } catch (error) {
 if (error !== 'cancel') {
 ElMessage.error(error.message || '清空失败')
 }
 }
}

const cleanupRecordFile = async (record) => {
 try {
 await ElMessageBox.confirm(`确定清理 ${record.appName || '该安装包'} 吗？`, '确认清理', {
 type: 'error',
 confirmButtonText: '清理安装包',
 cancelButtonText: '取消',
 confirmButtonClass: 'danger-confirm-button',
 lockScroll: false
 })
 const response = await fetch(`${API_BASE}/download-records/${record.id}/file`, {
 method: 'DELETE',
 credentials: 'include'
 })
 const data = await response.json()
 if (!data.ok) throw new Error(data.error || '清理失败')
 ElMessage.success(`已清理 ${formatStorageM(data.data?.freed_bytes || 0)}`)
 await loadRecords()
 } catch (error) {
 if (error !== 'cancel') {
 ElMessage.error(error.message || '清理失败')
 }
 }
}

const cleanupServerFiles = async () => {
 try {
 await ElMessageBox.confirm('确定清理服务器上的下载目录吗？', '确认清理', {
 type: 'error',
 confirmButtonText: '清理',
 cancelButtonText: '取消',
 confirmButtonClass: 'danger-confirm-button',
 lockScroll: false
 })
 const response = await fetch(`${API_BASE}/cleanup-downloads`, {
 method: 'POST',
 credentials: 'include'
 })
 const data = await response.json()
 if (!data.ok) throw new Error(data.error || '清理失败')
 ElMessage.success(`已释放 ${formatFileSize(data.data?.freed_bytes || 0)}`)
 await loadRecords()
 } catch (error) {
 if (error !== 'cancel') {
 ElMessage.error(error.message || '清理失败')
 }
 }
}

const isFinalStatus = (status) => ['completed', 'ready', 'failed', 'error'].includes(status)

const stopTaskPolling = (taskId) => {
 const timer = pollTimers.get(taskId)
 if (timer) {
 clearInterval(timer)
 pollTimers.delete(taskId)
 }
 pollFailureCounts.delete(taskId)
}

const markTaskInterrupted = (taskId, message = '任务已失效，可能是服务重启或页面切换后丢失，请重新发起下载') => {
 stopTaskPolling(taskId)
 appStore.updateQueueItem(taskId, {
 status: 'failed',
 stage: 'interrupted',
 error: message
 })
}

const syncTaskSnapshot = async (taskId, snapshot) => {
 const updates = {
 stage: snapshot.stage || '',
 progress: snapshot.progress ?? 0,
 error: snapshot.error || '',
 status: snapshot.status === 'ready' ? 'completed' : snapshot.status,
 packageKind: snapshot.packageKind,
 otaInstallable: snapshot.otaInstallable,
 installMethod: snapshot.installMethod,
 inspection: snapshot.inspection
 }

 if (snapshot.status === 'ready') {
 updates.progress = 100
 updates.downloadUrl = snapshot.downloadUrl
 updates.installUrl = snapshot.installUrl
 updates.fileSize = snapshot.fileSize || 0
 stopTaskPolling(taskId)
 await loadRecords()
 } else if (snapshot.status === 'failed') {
 stopTaskPolling(taskId)
 }

 appStore.updateQueueItem(taskId, updates)
}

const pollTaskStatus = async (taskId) => {
 try {
 const response = await fetch(`${API_BASE}/job-info?jobId=${encodeURIComponent(taskId)}`, {
 credentials: 'include'
 })

 if (response.status === 404) {
 markTaskInterrupted(taskId)
 return
 }

 const data = await response.json()
 if (!response.ok || !data.ok || !data.data) {
 if (response.status >= 400) {
 markTaskInterrupted(taskId, data?.error || '任务状态获取失败，请重新发起下载')
 }
 return
 }

 pollFailureCounts.delete(taskId)
 await syncTaskSnapshot(taskId, data.data)
 } catch (error) {
 const failureCount = (pollFailureCounts.get(taskId) || 0) + 1
 pollFailureCounts.set(taskId, failureCount)
 console.error('Failed to poll task status:', error)

 if (failureCount >= MAX_POLL_FAILURES) {
 markTaskInterrupted(taskId, '任务状态轮询多次失败，请检查网络或稍后重试')
 }
 }
}

const ensureTaskPolling = (task) => {
 if (!task?.id || isFinalStatus(task.status) || pollTimers.has(task.id)) return

 pollTaskStatus(task.id)
 const timer = setInterval(() => pollTaskStatus(task.id), 1500)
 pollTimers.set(task.id, timer)
}

const syncActiveTaskPolling = () => {
 const activeIds = new Set()

 for (const task of props.queue) {
 if (task?.id && !isFinalStatus(task.status)) {
 activeIds.add(task.id)
 ensureTaskPolling(task)
 }
 }

 for (const taskId of pollTimers.keys()) {
 if (!activeIds.has(taskId)) {
 stopTaskPolling(taskId)
 }
 }
}

const removeTask = async (id) => {
  const task = props.queue.find(t => t?.id === id)
  if (!task) { stopTaskPolling(id); emit('remove-item', id); return }
  const isActive = !isFinalStatus(task.status)
  if (isActive) {
    try {
      await ElMessageBox.confirm(
        `任务「${task.appName || '未知'}」仍在进行中，确定取消吗？`,
        '确认取消任务',
        { type: 'error', confirmButtonText: '取消任务', cancelButtonText: '继续等待', confirmButtonClass: 'danger-confirm-button', lockScroll: false }
      )
    } catch { return }
  }
  stopTaskPolling(id)
  emit('remove-item', id)
}
const download = (url) => window.open(url, '_blank', 'noopener')

const rewriteToCurrentOrigin = (rawUrl) => {
 const url = new URL(rawUrl, window.location.origin)
 url.protocol = window.location.protocol
 url.host = window.location.host
 return url.toString()
}

const buildInstallUrl = (installUrl) => {
 if (!installUrl) return null

 try {
 if (installUrl.startsWith('itms-services://')) {
 const itmsMatch = installUrl.match(/itms-services:\/\/\?action=download-manifest&url=(.+)/)
 if (!itmsMatch) return installUrl

 const manifestUrl = rewriteToCurrentOrigin(decodeURIComponent(itmsMatch[1]))
 return `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestUrl)}`
 }

 const url = new URL(installUrl, window.location.origin)
 if (url.pathname === '/api/public/install' || url.pathname === '/api/install') {
 const manifest = url.searchParams.get('manifest')
 if (manifest) {
 const rewrittenManifest = rewriteToCurrentOrigin(manifest)
 return `itms-services://?action=download-manifest&url=${encodeURIComponent(rewrittenManifest)}`
 }
 return installUrl
 }

 return rewriteToCurrentOrigin(installUrl)
 } catch {
 return installUrl
 }
}

const install = (installUrl) => {
 const url = buildInstallUrl(installUrl)
 if (url) {
 window.location.href = url
 }
}

const statusTagType = (status) => {
 if (status === 'completed' || status === 'ready') return 'success'
 if (status === 'failed' || status === 'error') return 'danger'
 return 'warning'
}

const statusLabel = (status) => {
 if (status === 'completed' || status === 'ready') return '已完成'
 if (status === 'failed' || status === 'error') return '失败'
 return '进行中'
}

const formatFileSize = (bytes) => {
 if (!bytes) return '未知'
 const units = ['B', 'KB', 'MB', 'GB']
 let value = bytes
 let unitIndex = 0
 while (value >= 1024 && unitIndex < units.length - 1) {
 value /= 1024
 unitIndex += 1
 }
 return `${value.toFixed(value >= 100 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

const formatStorageM = (bytes) => `${(Number(bytes || 0) / 1024 / 1024).toFixed(1)} M`

const formatDate = (value) => {
 if (!value) return '未知时间'
 const date = new Date(value)
 if (Number.isNaN(date.getTime())) return value
 return date.toLocaleString('zh-CN', {
 year: 'numeric',
 month: '2-digit',
 day: '2-digit',
 hour: '2-digit',
 minute: '2-digit'
 })
}

watch(
 () => props.queue.map(task => `${task?.id}:${task?.status}:${task?.progress}:${task?.stage}`),
 () => {
 syncActiveTaskPolling()
 },
 { immediate: true }
)

onMounted(() => {
 loadRecords()
 syncActiveTaskPolling()
})

onBeforeUnmount(() => {
 for (const taskId of [...pollTimers.keys()]) {
 stopTaskPolling(taskId)
 }
})
</script>

<style scoped>
.queue-row {
 display: flex;
 align-items: flex-start;
 gap: var(--space-3);
 padding: var(--space-4);
 border-radius: var(--radius-card);
 border: var(--border-width-thin) solid var(--separator);
 background: var(--card-bg);
}

.row-main {
 min-width: 0;
 flex: 1;
 display: flex;
 flex-direction: column;
 gap: var(--space-2);
}

.row-top {
 display: flex;
 align-items: flex-start;
 justify-content: space-between;
 gap: var(--space-3);
}

.row-title {
 font-size: var(--font-size-md);
 font-weight: 600;
 color: var(--text-primary);
 white-space: nowrap;
 overflow: hidden;
 text-overflow: ellipsis;
}

.row-meta,
.row-info {
 display: flex;
 flex-wrap: wrap;
 gap: var(--space-2) var(--space-3-5);
 font-size: var(--font-size-sm);
 color: var(--text-secondary);
}

.row-actions {
 display: flex;
 flex-wrap: wrap;
 gap: var(--space-2);
 align-items: center;
}

.row-actions :deep(.el-button) {
 margin: 0;
}

.row-error {
 font-size: var(--font-size-sm);
 color: var(--text-secondary);
}

@media (max-width: 767px) {
 .row-top {
  flex-direction: column;
  align-items: flex-start;
 }

 /* Mobile: keep action buttons aligned and avoid lonely wrap */
 .row-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
 }

 .row-actions :deep(.el-button) {
  width: 100%;
  justify-content: center;
 }
}
</style>

