import { computed, unref } from 'vue'

import {
  getVersionId,
  getVersionLabel,
  normalizeComparableValue,
  getVersionMatchScore
} from '../utils/version.js'

const TASK_FINAL_STATUSES = new Set(['completed', 'ready', 'failed', 'error'])

const getRefValue = (value) => unref(value)
const getTaskTime = (task) => new Date(task?.updatedAt || task?.timestamp || 0).getTime()

const hasTaskArtifacts = (task) => !!(task?.downloadUrl || task?.installUrl)
const isTaskReadyForActions = (task) => {
  if (!task || !hasTaskArtifacts(task)) return false
  return TASK_FINAL_STATUSES.has(task.status) || (task.progress ?? 0) >= 100
}

export function useCurrentVersionArtifacts({
  appid,
  appVerId,
  versions,
  selectedVersion,
  selectedApp,
  selectedAccount,
  accounts,
  downloadedIpaFiles,
  taskQueue,
  localizeProgressStage
}) {
  const selectedVersionRecord = computed(() => {
    const selectedVersionId = String(getRefValue(selectedVersion) || getRefValue(appVerId) || '')
    if (!selectedVersionId) return null
    return (getRefValue(versions) || []).find((version) => getVersionId(version) === selectedVersionId) || null
  })

  const currentVersionExactId = computed(() => normalizeComparableValue(getRefValue(appVerId) || getRefValue(selectedVersion) || ''))
  const currentVersionLabel = computed(() => normalizeComparableValue(getVersionLabel(selectedVersionRecord.value)))

  const getCurrentVersionMatchScore = (versionId, versionLabel) => getVersionMatchScore({
    currentVersionExactId: currentVersionExactId.value,
    currentVersionLabel: currentVersionLabel.value,
    versionId,
    versionLabel
  })

  const currentVersionTaskCandidates = computed(() => {
    const currentAppId = normalizeComparableValue(getRefValue(appid))
    const idx = getRefValue(selectedAccount)
    const account = idx === null || idx === undefined ? null : getRefValue(accounts)?.[idx]
    const currentAccountEmail = normalizeComparableValue(account?.email)

    if (!currentAppId || !currentAccountEmail) return []

    return (getRefValue(taskQueue) || [])
      .map((task) => {
        if (!task) return null
        const taskAppId = normalizeComparableValue(task.appId)
        const taskAccountEmail = normalizeComparableValue(task.accountEmail)
        if (taskAppId !== currentAppId || taskAccountEmail !== currentAccountEmail) return null

        const matchScore = getCurrentVersionMatchScore(task.versionId, task.version)
        if (matchScore < 0) return null

        return { task, matchScore }
      })
      .filter(Boolean)
      .sort((left, right) => {
        if (left.matchScore !== right.matchScore) return right.matchScore - left.matchScore
        const leftActive = TASK_FINAL_STATUSES.has(left.task?.status) ? 0 : 1
        const rightActive = TASK_FINAL_STATUSES.has(right.task?.status) ? 0 : 1
        if (leftActive !== rightActive) return rightActive - leftActive
        return getTaskTime(right.task) - getTaskTime(left.task)
      })
      .map(({ task }) => task)
  })

  const currentVersionReadyTask = computed(() => {
    return currentVersionTaskCandidates.value.find((task) => isTaskReadyForActions(task)) || null
  })

  const currentVersionActiveTask = computed(() => {
    if (currentVersionReadyTask.value) return null
    return currentVersionTaskCandidates.value.find((task) => {
      if (!task || TASK_FINAL_STATUSES.has(task.status)) return false
      if (hasTaskArtifacts(task)) return false
      return (task.progress ?? 0) < 100
    }) || null
  })

  const showCurrentVersionProgressCard = computed(() => !!currentVersionActiveTask.value)
  const currentVersionProgressPercent = computed(() => Number(currentVersionActiveTask.value?.progress ?? 0))
  const currentVersionProgressStage = computed(() => localizeProgressStage(currentVersionActiveTask.value?.stage || '准备中…'))
  const currentVersionProgressMode = computed(() => currentVersionActiveTask.value?.autoInstallRequested ? 'installing' : 'downloading')
  const currentVersionDownloadUrl = computed(() => currentVersionReadyTask.value?.downloadUrl || '')
  const currentVersionInstallUrl = computed(() => currentVersionReadyTask.value?.installUrl || '')
  const currentVersionFileSize = computed(() => Number(currentVersionReadyTask.value?.fileSize || 0))
  const currentVersionOtaInstallable = computed(() => !!currentVersionReadyTask.value?.otaInstallable)
  const currentVersionInstallMethod = computed(() => currentVersionReadyTask.value?.installMethod || '')
  const currentVersionInspection = computed(() => currentVersionReadyTask.value?.inspection || null)
  const currentVersionProgressButtonLabel = computed(() => {
    const percent = Math.max(0, Math.min(100, currentVersionProgressPercent.value))
    if (currentVersionProgressMode.value === 'installing') {
      return `${currentVersionProgressStage.value || '安装中'} ${percent}%`
    }
    return `${currentVersionProgressStage.value || '下载中'} ${percent}%`
  })

  const isCurrentVersionDownloaded = computed(() => {
    if (currentVersionReadyTask.value) return true
    if (!getRefValue(appid)) return false
    const idx = getRefValue(selectedAccount)
    if (idx === null || idx === undefined) return false
    const account = getRefValue(accounts)?.[idx]
    if (!account) return false

    const currentAppId = normalizeComparableValue(getRefValue(appid))
    const currentAccountEmail = normalizeComparableValue(account.email)

    return (getRefValue(downloadedIpaFiles) || []).some((file) => {
      const fileAppId = normalizeComparableValue(file.appId)
      const fileAccountEmail = normalizeComparableValue(file.accountEmail)
      if (fileAppId !== currentAppId || fileAccountEmail !== currentAccountEmail) return false

      return getCurrentVersionMatchScore(file.versionId, file.version) >= 0
    })
  })

  const resolveSelectedVersionPayload = () => {
    const resolvedVersionId = String(getRefValue(selectedVersion) || getRefValue(appVerId) || '')
    const resolvedRecord = (getRefValue(versions) || []).find((version) => getVersionId(version) === resolvedVersionId)
      || selectedVersionRecord.value
      || null

    const resolvedVersionLabel = getVersionLabel(resolvedRecord, getRefValue(selectedApp)?.version || '')

    return {
      versionId: resolvedVersionId,
      versionRecord: resolvedRecord,
      versionLabel: resolvedVersionLabel
    }
  }

  return {
    selectedVersionRecord,
    currentVersionReadyTask,
    currentVersionActiveTask,
    showCurrentVersionProgressCard,
    currentVersionProgressPercent,
    currentVersionProgressStage,
    currentVersionProgressMode,
    currentVersionDownloadUrl,
    currentVersionInstallUrl,
    currentVersionFileSize,
    currentVersionOtaInstallable,
    currentVersionInstallMethod,
    currentVersionInspection,
    currentVersionProgressButtonLabel,
    isCurrentVersionDownloaded,
    getCurrentVersionMatchScore,
    resolveSelectedVersionPayload
  }
}
