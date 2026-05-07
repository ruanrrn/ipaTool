import { ref } from 'vue'

import { API_BASE } from '../config.js'
import { apiFetch } from '../utils/api.js'
import { Toast } from '../components/MobileToast.vue'

export const useArchiveDownload = ({ appStore, requireActiveAccount, selectedVersionByApp, getVersionOptions, prepareApp, prepareCommunityApp }) => {
  const downloadingAppId = ref('')

  const startDirectDownload = async ({ account, app, versionId, versionLabel }) => {
    const { data: res } = await apiFetch(`${API_BASE}/start-download-direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: account.token,
        appid: app.id,
        appVerId: versionId,
        appName: app.name,
        bundleId: app.bundle_id || undefined,
        artworkUrl: app.icon_url || undefined,
        appVersion: versionLabel || undefined,
        artistName: app.artist_name || undefined
      })
    })
    if (!res.ok) {
      if (res.needsPurchase) {
        throw new Error(res.error || '当前账号未购买/未领取该应用')
      }
      throw new Error(res.error || '创建下载任务失败')
    }
    const payload = res.data || {}
    if (!payload.jobId) throw new Error('创建下载任务失败')
    return payload
  }

  const addDownloadToQueue = ({ payload, app, versionId, versionLabel, account }) => {
    appStore.addToQueue({
      id: payload.jobId,
      appId: String(app.id || ''),
      versionId: String(versionId || ''),
      appName: app.name,
      artworkUrl: app.icon_url || '',
      artistName: app.artist_name || '',
      version: versionLabel || '',
      account,
      accountEmail: account.email || '',
      status: payload.reused ? 'ready' : 'downloading',
      progress: 0,
      logs: '',
      timestamp: new Date().toISOString(),
      ...(payload.reused ? {
        recordId: payload.recordId,
        downloadUrl: payload.downloadUrl,
        installUrl: payload.installUrl,
        fileSize: payload.fileSize
      } : {})
    })
    appStore.activeTab = payload.reused ? 'history' : 'ipa'
  }

  const downloadArchivedApp = async (app, versionId = '', { onSuccess } = {}) => {
    const archiveKey = app.archive_key || app.id
    try {
      const account = await requireActiveAccount()
      let selectedVersion = versionId || selectedVersionByApp.value[archiveKey]
      if (!selectedVersion) {
        await prepareApp(app)
        selectedVersion = selectedVersionByApp.value[archiveKey]
      }
      if (!selectedVersion) {
        await prepareCommunityApp(app)
        selectedVersion = selectedVersionByApp.value[archiveKey]
      }
      if (!selectedVersion) throw new Error('请先选择版本')

      downloadingAppId.value = archiveKey
      const versionInfo = getVersionOptions(app).find((item) => item.version_id === selectedVersion)
      const payload = await startDirectDownload({
        account,
        app,
        versionId: selectedVersion,
        versionLabel: versionInfo?.version || ''
      })
      addDownloadToQueue({
        payload,
        app,
        versionId: selectedVersion,
        versionLabel: versionInfo?.version || '',
        account
      })
      onSuccess?.(payload)
      Toast.success(payload.reused ? '文件已就绪' : `已加入下载队列：${app.name} v${versionInfo?.version || selectedVersion}`)
    } catch (error) {
      Toast.error(error.message || '下载失败')
    } finally {
      downloadingAppId.value = ''
    }
  }

  const downloadArchivedVersion = async (item) => {
    const app = {
      id: item.appId,
      name: item.name,
      bundle_id: item.bundle_id,
      icon_url: item.icon_url,
      artist_name: item.artist_name
    }
    try {
      const account = await requireActiveAccount()
      if (!item.version_id) throw new Error('请先选择版本')
      downloadingAppId.value = item.archive_key || item.appId
      const payload = await startDirectDownload({
        account,
        app,
        versionId: item.version_id,
        versionLabel: item.version || ''
      })
      addDownloadToQueue({
        payload,
        app,
        versionId: item.version_id,
        versionLabel: item.version || '',
        account
      })
      Toast.success(payload.reused ? '文件已就绪' : `已加入下载队列：${item.name} v${item.version}`)
    } catch (error) {
      Toast.error(error.message || '下载失败')
    } finally {
      downloadingAppId.value = ''
    }
  }

  return {
    downloadingAppId,
    downloadArchivedApp,
    downloadArchivedVersion
  }
}
