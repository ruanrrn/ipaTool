import { reactive, ref } from 'vue'

import { API_BASE } from '../config.js'
import { apiFetch } from '../utils/api.js'
import { Toast } from '../components/MobileToast.vue'

export const useArchivePublish = ({ githubTokenConfigured, remoteDelistedIds }) => {
  const contributingAppId = ref('')
  const publishDialog = reactive({
    visible: false,
    appId: '',
    appName: '',
    notes: '',
    iconDataUrl: '',
    warnings: [],
    loading: false,
    result: null,
  })

  const openPublishDialog = (prepared) => {
    publishDialog.visible = true
    publishDialog.appId = prepared.app_id || prepared.app?.id || ''
    publishDialog.appName = prepared.app?.name || ''
    publishDialog.warnings = prepared.warnings || []
    publishDialog.notes = (prepared.app?.notes || []).join('\n')
    publishDialog.iconDataUrl = prepared.icon_data_url || ''
    publishDialog.result = null
  }

  const prepareCandidateContribution = async (app) => {
    if (!githubTokenConfigured.value) {
      Toast.warning('请先到设置页配置 GitHub PAT')
      return
    }
    if (remoteDelistedIds.value.has(String(app.id))) {
      Toast.warning('该应用已存在于社区归档，无需重复贡献')
      return
    }
    contributingAppId.value = app.archive_key || app.id
    try {
      const { response, data: res } = await apiFetch(`${API_BASE}/community/prepare-contribution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: app.id,
          notes: [],
        }),
      })
      if (!response.ok || !res.ok) throw new Error(res.error || '生成贡献预览失败')
      const prepared = res.data
      if (!prepared.github_token_configured) {
        Toast.warning('尚未配置 GitHub PAT，发布前请先到设置页保存')
      }
      openPublishDialog({
        ...prepared,
        icon_data_url: prepared.icon_data_url || app.icon_url || '',
      })
    } catch (error) {
      Toast.error(error.message || '生成贡献预览失败')
    } finally {
      contributingAppId.value = ''
    }
  }

  const doPublish = async () => {
    publishDialog.loading = true
    publishDialog.result = null
    try {
      let iconBase64 = null
      if (publishDialog.iconDataUrl) {
        const match = publishDialog.iconDataUrl.match(/^data:[^;]+;base64,(.+)$/)
        if (match) iconBase64 = match[1]
      }
      const notes = publishDialog.notes.split('\n').map((item) => item.trim()).filter(Boolean)
      const { response, data: res } = await apiFetch(`${API_BASE}/community/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: publishDialog.appId,
          notes,
          icon_data_base64: iconBase64,
        }),
      })
      if (!response.ok || !res.ok) throw new Error(res.error || '发布失败')
      const data = res.data
      const msg = data.pr_url
        ? `✅ PR 已创建: ${data.pr_url}\n提交文件: ${data.files_committed?.join(', ') || ''}`
        : '✅ 已提交到分支，请手动创建 PR'
      publishDialog.result = { ok: true, msg }
      Toast.success('发布成功')
    } catch (error) {
      publishDialog.result = { ok: false, msg: error.message || '发布失败' }
      Toast.error(error.message || '发布失败')
    } finally {
      publishDialog.loading = false
    }
  }

  return {
    contributingAppId,
    publishDialog,
    prepareCandidateContribution,
    doPublish
  }
}
