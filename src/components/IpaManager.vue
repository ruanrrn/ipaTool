<template>
  <div class="space-y-4">
    <div class="card flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center space-x-3">
        <div class="hero-icon">
          <svg
            class="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 16V4m0 12l-4-4m4 4l4-4M5 20h14"
            />
          </svg>
        </div>
        <div>
          <h2 class="text-xl font-bold text-primary">
            IPA 管理
          </h2>
          <p class="text-sm text-secondary">
            管理服务器上的 IPA 文件 · 已占用 {{ formatStorageM(totalStorageBytes) }}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <el-checkbox
          :model-value="allSelected"
          :indeterminate="selectedCount > 0 && !allSelected"
          @change="toggleSelectAll"
        >
          全选
        </el-checkbox>
        <el-button
          size="small"
          type="danger"
          plain
          :disabled="selectedCount === 0"
          @click="removeSelectedArtifacts"
        >
          批量清理{{ selectedCount > 0 ? `（${selectedCount}）` : '' }}
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
            <el-button
              size="small"
              :loading="uploading"
              plain
            >
              <template #icon>
                <el-icon><UploadFilled /></el-icon>
              </template>
              {{ uploading ? `上传中 ${uploadProgress}%` : '上传 IPA' }}
            </el-button>
          </template>
        </el-upload>
        <el-button
          size="small"
          :loading="loading"
          plain
          @click="loadArtifacts"
        >
          刷新
        </el-button>
      </div>
    </div>

    <div
      v-if="artifacts.length > 0"
      class="space-y-4"
    >
      <div
        v-for="item in artifacts"
        :key="item.id"
        class="artifact-row"
      >
        <div class="artifact-check">
          <el-checkbox
            :model-value="selectedIds.includes(item.id)"
            @change="(checked) => toggleArtifact(item.id, checked)"
          />
        </div>
        <AppArtwork
          :src="item.artworkUrl"
          :alt="item.appName"
          :label="item.appName || item.fileName"
        />
        <div class="artifact-main">
          <div class="artifact-top">
            <div class="min-w-0">
              <div class="artifact-title">
                {{ item.appName || item.fileName }}
              </div>
              <div class="artifact-meta">
                <span>{{ item.artistName || '未知开发者' }}</span>
                <span>版本 {{ item.version || '未知' }}</span>
                <span>账号 {{ item.accountEmail || '未知账号' }}</span>
                <span>{{ formatFileSize(item.fileSize) }}</span>
              </div>
            </div>
            <el-tag
              size="small"
              type="primary"
            >
              {{ formatDate(item.modifiedAt) }}
            </el-tag>
          </div>
          <div class="artifact-path">
            {{ item.fileName || item.filePath?.split('/').pop() }}
          </div>
          <div class="artifact-actions">
            <el-button
              type="primary"
              size="small"
              @click="download(item.downloadUrl)"
            >
              下载
            </el-button>

            <el-button
              v-if="item.otaInstallable && item.installUrl"
              type="primary"
              size="small"
              @click="install(item.installUrl)"
            >
              安装
            </el-button>
            <el-tooltip
              v-else-if="item.installMethod === 'download_only' && item.inspection"
              :content="item.inspection.summary"
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
              v-else-if="item.installMethod === 'download_only'"
              size="small"
              type="primary"
              plain
              disabled
            >
              仅下载
            </el-button>
            <el-button
              v-else
              type="primary"
              size="small"
              disabled
            >
              安装
            </el-button>

            <el-button
              type="danger"
              size="small"
              plain
              @click="removeArtifact(item)"
            >
              删除
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-else
      class="empty-state py-14 text-center text-secondary"
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
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
        />
      </svg>
      <p class="text-lg font-medium">
        暂无 IPA 文件
      </p>
      <p class="text-sm mt-2">
        下载完成后会出现在这里
      </p>
    </div>

    <div
      v-if="uploading"
      class="-mt-2"
    >
      <el-progress
        :percentage="uploadProgress"
        :stroke-width="8"
      />
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
        <p class="text-primary">
          确定删除这个 IPA 文件吗？
        </p>
        <div
          v-if="pendingDeleteItem"
          class="inline-panel text-xs text-secondary break-all"
        >
          <div class="font-medium text-primary">
            {{ pendingDeleteItem.appName || pendingDeleteItem.fileName }}
          </div>
          <div class="mt-1">
            {{ pendingDeleteItem.fileName || pendingDeleteItem.filePath?.split('/').pop() }}
          </div>
        </div>
        <p class="text-xs text-secondary">
          只删除服务器上的这个 IPA 文件，不清数据库。
        </p>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <el-button
            :disabled="deletingArtifact"
            @click="closeDeleteDialog"
          >
            取消
          </el-button>
          <el-button
            type="danger"
            :loading="deletingArtifact"
            @click="confirmDeleteArtifact"
          >
            删除
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import AppArtwork from './AppArtwork.vue'

const API_BASE = '/api'
const uploadUrl = `${API_BASE}/upload-ipa`
const uploading = ref(false)
const uploadProgress = ref(0)

const artifacts = ref([])
const loading = ref(false)
const selectedIds = ref([])
const deleteDialogVisible = ref(false)
const deletingArtifact = ref(false)
const pendingDeleteItem = ref(null)
const totalStorageBytes = computed(() => artifacts.value.reduce((sum, item) => sum + Number(item.fileSize || 0), 0))
const selectedCount = computed(() => selectedIds.value.length)
const allSelected = computed(() => artifacts.value.length > 0 && selectedIds.value.length === artifacts.value.length)

const loadArtifacts = async () => {
 loading.value = true
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
 loading.value = false
 }
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

const deleteArtifactById = async (id) => {
 const response = await fetch(`${API_BASE}/ipa-files/${id}`, {
 method: 'DELETE',
 credentials: 'include'
 })
 const data = await response.json()
 if (data.ok) return { missing: false }
 if (response.status === 404 || data.error === 'IPA 文件不存在') {
 return { missing: true }
 }
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
 type: 'error',
 confirmButtonText: '批量清理',
 cancelButtonText: '取消',
 confirmButtonClass: 'danger-confirm-button',
 lockScroll: false
 })

 for (const id of [...selectedIds.value]) {
 await deleteArtifactById(id)
 }

 ElMessage.success(`已清理 ${selectedIds.value.length} 个安装包`)
 selectedIds.value = []
 await loadArtifacts()
 } catch (error) {
 if (error !== 'cancel') {
 ElMessage.error(error.message || '批量清理失败')
 }
 }
}

const toggleArtifact = (id, checked) => {
 if (checked) {
 if (!selectedIds.value.includes(id)) selectedIds.value.push(id)
 return
 }
 selectedIds.value = selectedIds.value.filter(item => item !== id)
}

const toggleSelectAll = (checked) => {
 selectedIds.value = checked ? artifacts.value.map(item => item.id) : []
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
 month: '2-digit',
 day: '2-digit',
 hour: '2-digit',
 minute: '2-digit'
 })
}

// Upload state
const uploadResult = ref({
 jobId: '',
 fileName: '',
 installUrl: null
})

const beforeUpload = (file) => {
 const isIPA = file.name.endsWith('.ipa')
 const isLt2G = file.size / 1024 / 1024 / 1024 < 2

 if (!isIPA) {
 ElMessage.error('只能上传 .ipa 格式的文件')
 return false
 }
 if (!isLt2G) {
 ElMessage.error('上传文件大小不能超过 2GB')
 return false
 }

 uploading.value = true
 uploadProgress.value = 0
 return true
}

const handleUploadProgress = (event) => {
 uploadProgress.value = Math.floor(event.percent)
}

const handleUploadSuccess = (response) => {
 uploading.value = false
 uploadProgress.value = 100

 if (response.ok) {
 uploadResult.value = {
 jobId: response.jobId,
 fileName: response.fileName,
 installUrl: response.installUrl
 }
 ElMessage.success('文件上传成功')
 // Refresh the artifact list after upload
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

onMounted(loadArtifacts)
</script>

<style scoped>
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

/* File name: avoid awkward single-letter wraps on mobile */
.artifact-path {
 display: block;
 margin-top: var(--space-1);
 font-size: var(--font-size-sm);
 color: var(--text-secondary);
 overflow-wrap: anywhere;
 word-break: break-word;
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
 .artifact-top {
  flex-direction: column;
  align-items: flex-start;
 }
}
</style>

