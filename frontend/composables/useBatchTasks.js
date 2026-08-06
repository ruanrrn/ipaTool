import { ref, computed } from 'vue'
import { API_BASE } from '../config.js'
import { apiFetch } from '../utils/api.js'

/**
 * 批量下载任务的队列管理 composable。
 *
 * 后端契约（server/src/database.rs）：
 *   BatchDownloadTask: { id, task_name, status, total_count, completed_count,
 *                        failed_count, created_at, updated_at, completed_at }
 *   BatchDownloadItem: { id, batch_id, app_id, app_name, version, account_email,
 *                        status, progress, error, retry_count, created_at }
 *
 * Task status:  "processing" | "completed"
 * Item status:  "pending" | "completed" | "failed"
 *
 * 该 composable 负责：
 *   - 拉取批量任务列表 + 每个 task 展开后的 items
 *   - 轮询进行中的任务（status=processing）以更新进度
 *   - 删除任务
 */

const POLL_INTERVAL_MS = 3000

export function useBatchTasks() {
  const tasks = ref([])
  const expandedTaskIds = ref(new Set())
  const itemCache = ref({}) // { [batchId]: items[] }
  const loading = ref(false)
  const error = ref(null)
  let pollTimer = null

  const activeTasks = computed(() =>
    tasks.value.filter(t => t.status === 'processing')
  )
  const completedTasks = computed(() =>
    tasks.value.filter(t => t.status === 'completed')
  )
  const hasAnyTasks = computed(() => tasks.value.length > 0)

  /** 拉取所有批量任务列表 */
  async function fetchTasks() {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiFetch(`${API_BASE}/batch-tasks`)
      if (data?.ok && Array.isArray(data.data)) {
        tasks.value = data.data
        // 展开的任务需要拉取 items
        for (const id of expandedTaskIds.value) {
          await fetchItems(id)
        }
      }
    } catch (e) {
      error.value = e?.message || '获取批量任务失败'
    } finally {
      loading.value = false
    }
  }

  /** 拉取单个任务的 items（仅展开时调用） */
  async function fetchItems(batchId) {
    try {
      const { data } = await apiFetch(`${API_BASE}/batch-tasks/${batchId}`)
      if (data?.ok && data.data?.items) {
        itemCache.value = { ...itemCache.value, [batchId]: data.data.items }
      }
    } catch {
      // 静默失败，items 可在下次轮询时重试
    }
  }

  /** 展开/收起任务详情 */
  async function toggleExpand(task) {
    const id = task.id
    if (!id) return
    if (expandedTaskIds.value.has(id)) {
      expandedTaskIds.value.delete(id)
      expandedTaskIds.value = new Set(expandedTaskIds.value)
    } else {
      expandedTaskIds.value.add(id)
      expandedTaskIds.value = new Set(expandedTaskIds.value)
      await fetchItems(id)
    }
  }

  /** 删除任务 */
  async function deleteTask(batchId) {
    try {
      const { data } = await apiFetch(`${API_BASE}/batch-tasks/${batchId}`, {
        method: 'DELETE',
      })
      if (data?.ok) {
        tasks.value = tasks.value.filter(t => t.id !== batchId)
        const next = { ...itemCache.value }
        delete next[batchId]
        itemCache.value = next
        expandedTaskIds.value.delete(batchId)
        expandedTaskIds.value = new Set(expandedTaskIds.value)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  /** 计算任务进度百分比 */
  function taskProgress(task) {
    if (!task || !task.total_count) return 0
    const done = (task.completed_count || 0) + (task.failed_count || 0)
    return Math.round((done / task.total_count) * 100)
  }

  /** 启动轮询（仅当有 processing 任务时） */
  function startPolling() {
    stopPolling()
    pollTimer = setInterval(async () => {
      if (activeTasks.value.length > 0) {
        await fetchTasks()
      }
    }, POLL_INTERVAL_MS)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  return {
    tasks,
    activeTasks,
    completedTasks,
    hasAnyTasks,
    expandedTaskIds,
    itemCache,
    loading,
    error,
    fetchTasks,
    fetchItems,
    toggleExpand,
    deleteTask,
    taskProgress,
    startPolling,
    stopPolling,
  }
}
