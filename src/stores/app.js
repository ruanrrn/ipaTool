import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  // 下载任务状态
  const downloadState = ref({
    selectedApp: null,
    appId: '',
    appVersionId: '',
    selectedAccountIndex: '',
    availableVersions: [],
    selectedVersionId: '',
    versionsLoaded: false,
    showProgressPanel: false,
    progressPercentage: 0,
    progressMessage: '',
    progressLogs: ''
  })

  // 下载任务队列
  const taskQueue = ref([])

  // 当前激活的页面标签
  const activeTab = ref('download')

  // 账号更新计数器
  const accountsUpdateCounter = ref(0)

  // 设置选中的应用
  const setSelectedApp = (app) => {
    downloadState.value.selectedApp = app
    if (app && app.trackId) {
      downloadState.value.appId = String(app.trackId)
    }
  }

  // 更新下载状态
  const updateDownloadState = (key, value) => {
    if (key in downloadState.value) {
      downloadState.value[key] = value
    }
  }

  // 添加任务到队列
  const addToQueue = (item) => {
    const existingIndex = taskQueue.value.findIndex(q => q.id === item.id)
    if (existingIndex >= 0) {
      // 更新现有任务
      taskQueue.value[existingIndex] = { ...taskQueue.value[existingIndex], ...item }
    } else {
      // 添加新任务
      taskQueue.value.push(item)
    }
  }

  // 更新队列任务
  const updateQueueItem = (id, updates) => {
    const index = taskQueue.value.findIndex(q => q.id === id)
    if (index >= 0) {
      taskQueue.value[index] = { ...taskQueue.value[index], ...updates }
    }
  }

  // 从队列移除任务
  const removeFromQueue = (index) => {
    taskQueue.value.splice(index, 1)
  }

  // 清空任务队列
  const clearQueue = () => {
    taskQueue.value = []
  }

  // 触发账号更新
  const triggerAccountsUpdate = () => {
    accountsUpdateCounter.value++
  }

  return {
    downloadState,
    taskQueue,
    activeTab,
    accountsUpdateCounter,
    setSelectedApp,
    updateDownloadState,
    addToQueue,
    updateQueueItem,
    removeFromQueue,
    clearQueue,
    triggerAccountsUpdate
  }
})
