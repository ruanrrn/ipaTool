<template>
  <div class="space-y-4">
    <!-- Active download tasks (only visible when tasks exist) -->
    <section
      v-if="activeTasks.length > 0"
      class="space-y-4"
    >
      <div class="card flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center space-x-3">
          <div class="hero-icon">
            <svg
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </div>
          <div>
            <h2 class="text-xl font-bold text-primary">下载中</h2>
            <p class="text-sm text-secondary">{{ activeTasks.length }} 个任务进行中</p>
          </div>
        </div>
      </div>

      <div
        v-for="task in activeTasks"
        :key="task.id"
        class="task-row"
      >
        <AppArtwork
          :src="task.artworkUrl"
          :alt="task.appName"
          :label="task.appName"
        />
        <div class="task-main">
          <div class="task-top">
            <div class="min-w-0">
              <div class="task-title">{{ task.appName }}</div>
              <div class="task-meta">
                <span>版本 {{ task.version || '未知' }}</span>
                <span>账号 {{ task.accountEmail || task.account?.email || '未知账号' }}</span>
              </div>
            </div>
            <el-tag :type="statusTagType(task.status)" size="small">{{ statusLabel(task.status) }}</el-tag>
          </div>
          <div class="task-info">
            <span v-if="task.fileSize">大小 {{ formatFileSize(task.fileSize) }}</span>
            <span v-if="task.progress !== undefined">进度 {{ task.progress }}%</span>
            <span v-if="task.stage">阶段 {{ task.stage }}</span>
          </div>
          <el-progress
            v-if="task.status !== 'completed' && task.status !== 'failed' && task.progress !== undefined"
            :percentage="task.progress"
            :stroke-width="6"
          />
          <div v-if="task.error" class="task-error">{{ task.error }}</div>
          <div class="task-actions">
            <el-button v-if="task.status === 'completed' && task.downloadUrl" type="primary" size="small" @click="download(task.downloadUrl)">下载</el-button>
            <el-button v-if="task.status === 'completed' && task.otaInstallable && task.installUrl" type="primary" size="small" @click="install(task.installUrl)">安装</el-button>
            <el-button v-else-if="task.status === 'completed' && task.installMethod === 'download_only'" size="small" type="primary" plain disabled>仅下载</el-button>
            <el-button size="small" type="danger" plain @click="removeTask(task.id)">
              {{ task.status === 'completed' || task.status === 'failed' ? '移除' : '取消' }}
            </el-button>
          </div>
        </div>
      </div>
    </section>

    <!-- IPA files -->
    <div class="card flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center space-x-3">
        <div class="hero-icon">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
        </div>
        <div>
          <h2 class="text-xl font-bold text-primary">IPA 管理</h2>
          <p class="text-sm text-secondary">{{ artifacts.length }} 个文件 · 已占用 {{ formatStorageM(ipaStorageBytes) }}</p>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <el-button v-if="selectedCount > 0" size="small" type="danger" plain @click="removeSelectedArtifacts">
          清理{{ selectedCount }}个
        </el-button>
        <el-upload
          class="inline-upload"
          :action="uploadUrl"
          :show-file-list="false"
          accept=".ipa"
          :auto-upload="true"
          :on-success="handleUploadSuccess"
          :on-error="handleUploadError"
          :on-progress="handleUploadProgress"
          :before-upload="beforeUpload"
        >
          <template #trigger>
            <el-button size="small" :loading="uploading" plain>
              <template #icon><el-icon><UploadFilled /></el-icon></template>
              {{ uploading ? `上传中 ${uploadProgress}%` : '上传 IPA' }}
            </el-button>
          </template>
        </el-upload>
        <el-button size="small" :loading="ipaLoading" plain @click="loadArtifacts">刷新</el-button>
      </div>
    </div>

    <div v-if="artifacts.length > 0" class="space-y-4">
      <div v-for="item in artifacts" :key="item.id" class="artifact-row">
        <div class="artifact-check">
          <el-checkbox :model-value="selectedIds.includes(item.id)" @change="(checked) => toggleArtifact(item.id, checked)" />
        </div>
        <AppArtwork :src="item.artworkUrl" :alt="item.appName" :label="item.appName" />
        <div class="artifact-main">
          <div class="artifact-top">
            <div class="min-w-0">
              <div class="artifact-title">{{ item.appName }}</div>
              <div class="artifact-meta">
                <span>版本 {{ item.version || '未知' }}</span>
                <span>账号 {{ item.accountEmail || '未知账号' }}</span>
                <span>{{ formatFileSize(item.fileSize) }}</span>
              </div>
            </div>
          </div>
          <div class="artifact-actions">
            <el-button type="primary" size="small" @click="download(item.downloadUrl)">下载</el-button>
            <el-button v-if="item.otaInstallable && item.installUrl" type="primary" size="small" @click="install(item.installUrl)">安装</el-button>
            <el-tooltip v-else-if="item.installMethod === 'download_only' && item.inspection" :content="item.inspection.summary" placement="top">
              <span><el-button size="small" type="primary" plain disabled>仅下载</el-button></span>
            </el-tooltip>
            <el-button v-else-if="item.installMethod === 'download_only'" size="small" type="primary" plain disabled>仅下载</el-button>
            <el-button v-else type="primary" size="small" disabled>安装</el-button>
            <el-button type="danger" size="small" plain @click="removeArtifact(item)">删除</el-button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="activeTasks.length === 0 && artifacts.length === 0"
      class="empty-state py-12 text-center text-secondary"
    >
      <svg class="mx-auto h-16 w-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
      <p class="text-lg font-medium">暂无 IPA 文件</p>
      <p class="text-sm mt-2">下载完成后会出现在这里</p>
    </div>

    <div v-if="uploading" class="-mt-2">
      <el-progress :percentage="uploadProgress" :stroke-width="8" />
    </div>

    <el-dialog
      v-model="deleteDialogVisible"
      title="确认删除 IPA"
      width="min(92vw, 420px)"
      :close-on-click-modal="false"
      :close-on-press-escape="!deletingArtifact"
      :show-close="!deletingArtifact"
      :lock-scroll="false"
      destroy-on-close
    >
      <div class="space-y-3 text-sm">
        <p class="text-primary">确定删除这个 IPA 文件吗？</p>
        <div v-if="pendingDeleteItem" class="dialog-message-card">
          <div class="dialog-message-card__label">文件名称</div>
          <div class="dialog-message-card__value">{{ pendingDeleteItem.appName }}</div>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <el-button :disabled="deletingArtifact" @click="closeDeleteDialog">取消</el-button>
          <el-button type="danger" :loading="deletingArtifact" @click="confirmDeleteArtifact">确认</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import AppArtwork from './AppArtwork.vue'
import { useAppStore } from '../stores/app'

const API_BASE = '/api'
const uploadUrl = `${API_BASE}/upload-ipa`

const props = defineProps({
  queue: { type: Array, default: () => [] }
})
const emit = defineEmits(['remove-item'])
const appStore = useAppStore()

// ── Shared helpers ──

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
  } catch { return installUrl }
}

const install = (installUrl) => {
  const url = buildInstallUrl(installUrl)
  if (url) window.location.href = url
}

const formatFileSize = (bytes) => {
  if (!bytes) return '未知'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) { value /= 1024; unitIndex += 1 }
  return `${value.toFixed(value >= 100 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

const formatStorageM = (bytes) => `${(Number(bytes || 0) / 1024 / 1024).toFixed(1)} M`

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

// ── Active download tasks ──

const pollTimers = new Map()
const pollFailureCounts = new Map()
const MAX_POLL_FAILURES = 5

// Only show tasks that are NOT in a final state
const activeTasks = computed(() => props.queue.filter(task => !['completed', 'ready'].includes(task?.status)))

const isFinalStatus = (status) => ['completed', 'ready', 'failed', 'error'].includes(status)

const stopTaskPolling = (taskId) => {
  const timer = pollTimers.get(taskId)
  if (timer) { clearInterval(timer); pollTimers.delete(taskId) }
  pollFailureCounts.delete(taskId)
}

const markTaskInterrupted = (taskId, message = '任务已失效，可能是服务重启，请重新发起下载') => {
  stopTaskPolling(taskId)
  appStore.updateQueueItem(taskId, { status: 'failed', stage: 'interrupted', error: message })
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
    // Refresh IPA list when download completes
    await loadArtifacts()
  } else if (snapshot.status === 'failed') {
    stopTaskPolling(taskId)
  }
  appStore.updateQueueItem(taskId, updates)
}

const pollTaskStatus = async (taskId) => {
  try {
    const response = await fetch(`${API_BASE}/job-info?jobId=${encodeURIComponent(taskId)}`, { credentials: 'include' })
    if (response.status === 404) { markTaskInterrupted(taskId); return }
    const data = await response.json()
    if (!response.ok || !data.ok || !data.data) {
      if (response.status >= 400) markTaskInterrupted(taskId, data?.error || '任务状态获取失败')
      return
    }
    pollFailureCounts.delete(taskId)
    await syncTaskSnapshot(taskId, data.data)
  } catch (error) {
    const failureCount = (pollFailureCounts.get(taskId) || 0) + 1
    pollFailureCounts.set(taskId, failureCount)
    if (failureCount >= MAX_POLL_FAILURES) markTaskInterrupted(taskId, '轮询多次失败，请检查网络')
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
    if (task?.id && !isFinalStatus(task.status)) { activeIds.add(task.id); ensureTaskPolling(task) }
  }
  for (const taskId of pollTimers.keys()) {
    if (!activeIds.has(taskId)) stopTaskPolling(taskId)
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
        { type: 'error', confirmButtonText: '确认', cancelButtonText: '取消', confirmButtonClass: 'danger-confirm-button', lockScroll: false }
      )
    } catch { return }
  }
  stopTaskPolling(id)
  emit('remove-item', id)
}

// ── IPA artifacts ──

const artifacts = ref([])
const ipaLoading = ref(false)
const selectedIds = ref([])
const deleteDialogVisible = ref(false)
const deletingArtifact = ref(false)
const pendingDeleteItem = ref(null)
const uploading = ref(false)
const uploadProgress = ref(0)

const ipaStorageBytes = computed(() => artifacts.value.reduce((sum, item) => sum + Number(item.fileSize || 0), 0))
const selectedCount = computed(() => selectedIds.value.length)

const loadArtifacts = async () => {
  ipaLoading.value = true
  try {
    const response = await fetch(`${API_BASE}/ipa-files`, { credentials: 'include' })
    const data = await response.json()
    if (!data.ok) throw new Error(data.error || '加载失败')
    artifacts.value = data.data || []
    const validIds = new Set(artifacts.value.map(item => item.id))
    selectedIds.value = selectedIds.value.filter(id => validIds.has(id))
  } catch (error) {
    ElMessage.error(error.message || '加载失败')
  } finally {
    ipaLoading.value = false
  }
}

const deleteArtifactById = async (id) => {
  const response = await fetch(`${API_BASE}/ipa-files/${id}`, { method: 'DELETE', credentials: 'include' })
  const data = await response.json()
  if (data.ok) return { missing: false }
  if (response.status === 404 || data.error === 'IPA 文件不存在') return { missing: true }
  throw new Error(data.error || '删除失败')
}

const removeArtifact = (item) => {
  pendingDeleteItem.value = item
  deleteDialogVisible.value = true
}

const closeDeleteDialog = () => {
  if (deletingArtifact.value) return
  deleteDialogVisible.value = false
  pendingDeleteItem.value = null
}

const confirmDeleteArtifact = async () => {
  if (!pendingDeleteItem.value) return
  deletingArtifact.value = true
  const item = pendingDeleteItem.value
  try {
    const result = await deleteArtifactById(item.id)
    selectedIds.value = selectedIds.value.filter(id => id !== item.id)
    deleteDialogVisible.value = false
    pendingDeleteItem.value = null
    if (result.missing) {
      ElMessage.warning('文件已不存在，列表已刷新')
    } else {
      ElMessage.success('IPA 已删除')
    }
    await loadArtifacts()
  } catch (error) {
    ElMessage.error(error.message || '删除失败')
  } finally {
    deletingArtifact.value = false
  }
}

const removeSelectedArtifacts = async () => {
  if (selectedIds.value.length === 0) return
  try {
    await ElMessageBox.confirm(`确定批量清理 ${selectedIds.value.length} 个安装包吗？`, '确认批量清理', {
      type: 'error', confirmButtonText: '确认', cancelButtonText: '取消', confirmButtonClass: 'danger-confirm-button', lockScroll: false
    })
    for (const id of [...selectedIds.value]) { await deleteArtifactById(id) }
    ElMessage.success(`已清理 ${selectedIds.value.length} 个安装包`)
    selectedIds.value = []
    await loadArtifacts()
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(error.message || '批量清理失败')
  }
}

const toggleArtifact = (id, checked) => {
  if (checked) { if (!selectedIds.value.includes(id)) selectedIds.value.push(id); return }
  selectedIds.value = selectedIds.value.filter(item => item !== id)
}

// Upload

const beforeUpload = (file) => {
  const isIPA = file.name.endsWith('.ipa')
  const isLt2G = file.size / 1024 / 1024 / 1024 < 2
  if (!isIPA) { ElMessage.error('只能上传 .ipa 格式的文件'); return false }
  if (!isLt2G) { ElMessage.error('上传文件大小不能超过 2GB'); return false }
  uploading.value = true
  uploadProgress.value = 0
  return true
}

const handleUploadProgress = (event) => { uploadProgress.value = Math.floor(event.percent) }

const handleUploadSuccess = (response) => {
  uploading.value = false
  uploadProgress.value = 100
  if (response.ok) {
    ElMessage.success('文件上传成功')
    loadArtifacts()
  } else {
    ElMessage.error(response.error || '上传失败')
  }
}

const handleUploadError = (error) => {
  uploading.value = false
  uploadProgress.value = 0
  ElMessage.error('上传失败：' + error.message)
}

// ── Lifecycle ──

watch(
  () => props.queue.map(task => `${task?.id}:${task?.status}:${task?.progress}:${task?.stage}`),
  () => { syncActiveTaskPolling() },
  { immediate: true }
)

onMounted(() => {
  loadArtifacts()
  syncActiveTaskPolling()
})

onBeforeUnmount(() => {
  for (const taskId of [...pollTimers.keys()]) stopTaskPolling(taskId)
})
</script>

<style scoped>
.task-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-card);
  border: var(--border-width-thin) solid var(--separator);
  background: var(--card-bg);
}

.task-main {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.task-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.task-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-meta,
.task-info {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3-5);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.task-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.task-actions :deep(.el-button) {
  margin: 0;
}

.task-error {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.artifact-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-card);
  border: var(--border-width-thin) solid var(--separator);
  background: var(--card-bg);
}

.artifact-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.artifact-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-3);
}

.artifact-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.artifact-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3-5);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.inline-upload {
  display: inline-flex;
}

.artifact-check {
  display: flex;
  align-items: center;
  padding-top: var(--space-1);
}

.artifact-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.artifact-actions :deep(.el-button) {
  margin: 0;
}

@media (max-width: 767px) {
  .task-top {
    flex-direction: column;
    align-items: flex-start;
  }

  .task-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
  }

  .task-actions :deep(.el-button) {
    width: 100%;
    justify-content: center;
  }

  .artifact-top {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
