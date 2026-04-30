import { onBeforeUnmount } from 'vue'
import { API_BASE } from '../config.js'
import { apiFetch } from '../utils/api.js'

/**
 * Job polling composable - polls job-info endpoint to track task progress
 * @param {Object} options - Configuration options
 * @param {Function} options.isFinalStatus - Function to check if status is final (completed/ready/failed/error)
 * @param {number} options.pollInterval - Polling interval in ms (default: 1500)
 * @param {number} options.maxFailures - Maximum consecutive failures before marking as failed (default: 5)
 * @param {Function} options.onComplete - Callback when task completes successfully
 * @param {Function} options.onFailed - Callback when task fails
 * @param {Function} options.onUpdate - Callback on each poll with task data
 * @param {Function} options.onError - Callback on poll error (non-fatal)
 * @param {Function} options.onInterrupted - Callback when task is interrupted (404 or max failures)
 * @returns {Object} Polling control methods
 */
export function useJobPolling(options = {}) {
  const {
    isFinalStatus = (status) => ['completed', 'ready', 'failed', 'error'].includes(status),
    pollInterval = 1500,
    maxFailures = 5,
    onComplete,
    onFailed,
    onUpdate,
    onError,
    onInterrupted
  } = options

  // Track polling state
  const pollTimers = new Map()
  const pollFailureCounts = new Map()

  /**
   * Stop polling for a specific task
   * @param {string} taskId - Task identifier
   */
  const stopPolling = (taskId) => {
    const timer = pollTimers.get(taskId)
    if (timer) {
      clearInterval(timer)
      pollTimers.delete(taskId)
    }
    pollFailureCounts.delete(taskId)
  }

  /**
   * Stop all active polling
   */
  const stopAllPolling = () => {
    for (const taskId of [...pollTimers.keys()]) {
      stopPolling(taskId)
    }
  }

  /**
   * Reset polling state for a task (stop and clear failure count)
   * @param {string} taskId - Task identifier
   */
  const resetPolling = (taskId) => {
    stopPolling(taskId)
    pollFailureCounts.delete(taskId)
  }

  /**
   * Perform single poll for a task
   * @param {string} taskId - Task identifier
   * @returns {Promise<Object|null>} Task data or null if error
   */
  const pollOnce = async (taskId) => {
    try {
      const { response, data } = await apiFetch(`${API_BASE}/job-info?jobId=${encodeURIComponent(taskId)}`)

      // Handle 404 - task no longer exists
      if (response.status === 404) {
        if (onInterrupted) {
          onInterrupted(taskId, '任务已不存在')
        }
        return null
      }

      // Handle other errors
      if (!response.ok || !data.ok || !data.data) {
        const failureCount = (pollFailureCounts.get(taskId) || 0) + 1
        pollFailureCounts.set(taskId, failureCount)

        if (onError) {
          onError(taskId, data?.error || '任务状态获取失败', failureCount)
        }

        // Max failures reached
        if (failureCount >= maxFailures) {
          stopPolling(taskId)
          if (onInterrupted) {
            onInterrupted(taskId, '轮询多次失败，请检查网络')
          }
        }
        return null
      }

      // Success - reset failure count
      pollFailureCounts.delete(taskId)

      const snapshot = data.data

      // Call update callback
      if (onUpdate) {
        onUpdate(taskId, snapshot)
      }

      return snapshot
    } catch (error) {
      const failureCount = (pollFailureCounts.get(taskId) || 0) + 1
      pollFailureCounts.set(taskId, failureCount)

      if (onError) {
        onError(taskId, error.message, failureCount)
      }

      // Max failures reached
      if (failureCount >= maxFailures) {
        stopPolling(taskId)
        if (onInterrupted) {
          onInterrupted(taskId, '轮询多次失败，请检查网络')
        }
      }

      return null
    }
  }

  /**
   * Start polling for a task
   * @param {string} taskId - Task identifier
   * @param {Object} options - Override options for this specific task
   * @returns {boolean} True if polling started, false if already polling or task is final
   */
  const startPolling = (taskId, taskOptions = {}) => {
    // Don't start if already polling
    if (pollTimers.has(taskId)) {
      return false
    }

    // Perform initial poll immediately
    pollOnce(taskId).then((snapshot) => {
      if (!snapshot) return

      // Check if task is already in final state
      const status = snapshot.status
      if (isFinalStatus(status)) {
        // Call appropriate callback
        if (status === 'ready' || status === 'completed') {
          if (onComplete) {
            onComplete(taskId, snapshot)
          }
        } else if (status === 'failed' || status === 'error') {
          if (onFailed) {
            onFailed(taskId, snapshot)
          }
        }
        return
      }

      // Start interval polling
      const interval = taskOptions.pollInterval || pollInterval
      const timer = setInterval(async () => {
        const result = await pollOnce(taskId)

        if (!result) return

        const currentStatus = result.status

        // Check for final status
        if (isFinalStatus(currentStatus)) {
          stopPolling(taskId)

          if (currentStatus === 'ready' || currentStatus === 'completed') {
            if (onComplete) {
              onComplete(taskId, result)
            }
          } else if (currentStatus === 'failed' || currentStatus === 'error') {
            if (onFailed) {
              onFailed(taskId, result)
            }
          }
        }
      }, interval)

      pollTimers.set(taskId, timer)
    })

    return true
  }

  /**
   * Ensure polling is active for a task (idempotent)
   * @param {Object} task - Task object with id and status
   * @returns {boolean} True if polling started or already active
   */
  const ensurePolling = (task) => {
    if (!task?.id) {
      return false
    }

    if (isFinalStatus(task.status)) {
      return false
    }

    if (pollTimers.has(task.id)) {
      return true
    }

    return startPolling(task.id)
  }

  /**
   * Sync polling with a list of tasks
   * Stops polling for tasks not in the list, starts polling for new tasks
   * @param {Array} tasks - Array of task objects
   * @param {string} taskKey - Key to identify tasks (default: 'id')
   */
  const syncPolling = (tasks, taskKey = 'id') => {
    const activeIds = new Set()

    for (const task of tasks) {
      const taskId = task?.[taskKey]
      if (taskId && !isFinalStatus(task.status)) {
        activeIds.add(taskId)
        ensurePolling(task)
      }
    }

    // Stop polling for tasks not in the list
    for (const taskId of pollTimers.keys()) {
      if (!activeIds.has(taskId)) {
        stopPolling(taskId)
      }
    }
  }

  /**
   * Get current polling status
   * @param {string} taskId - Task identifier
   * @returns {Object|null} Polling status or null if not polling
   */
  const getPollingStatus = (taskId) => {
    return {
      isActive: pollTimers.has(taskId),
      failureCount: pollFailureCounts.get(taskId) || 0
    }
  }

  // Auto-cleanup on unmount
  onBeforeUnmount(() => {
    stopAllPolling()
  })

  return {
    startPolling,
    stopPolling,
    resetPolling,
    stopAllPolling,
    ensurePolling,
    syncPolling,
    pollOnce,
    getPollingStatus
  }
}
