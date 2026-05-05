<template>
  <div class="settings-page">
    <div class="settings-page__fixed px-5">
      <!-- Page Title -->
      <h1 class="page-title text-txt dark:text-txt-dark">
        设置
      </h1>
    </div>

    <div class="settings-page__scroll">
      <div class="settings-page__scroll-inner px-5">
        <!-- Section 1: Apple ID 账号 -->
        <p class="section-label text-txt-secondary dark:text-txt-dark-secondary">
          Apple ID 账号
        </p>
        <div class="settings-card">
          <!-- Account rows -->
          <div
            v-for="(account, index) in accounts"
            :key="getAccountKey(account, index)"
            class="settings-row settings-row--account"
          >
            <div class="sr-left">
              <div class="sr-icon sr-icon--apple">
                🍎
              </div>
              <div class="sr-label">
                {{ account.email }}
                <span
                  v-if="account.lastRefreshedAt != null"
                  class="sr-freshness"
                  :class="getFreshnessClass(account.lastRefreshedAt)"
                >
                  {{ getFreshnessLabel(account.lastRefreshedAt) }}
                </span>
              </div>
            </div>
            <div class="sr-right">
              <span>{{ getRegionLabel(account.region || 'US') }}</span>
              <button
                class="sr-btn sr-btn--refresh"
                :disabled="refreshingToken === account.token"
                @click.stop="handleRefreshAccount(account)"
              >
                <span v-if="refreshingToken === account.token" class="sr-btn__spinner" />
                <span v-else>↻</span>
              </button>
              <button
                class="sr-btn sr-btn--delete"
                @click.stop="handleDeleteAccount(account)"
              >
                ✕
              </button>
            </div>
          </div>

          <!-- Add Account row -->
          <button
            class="settings-row settings-row--interactive"
            @click="emit('navigate-to-account')"
          >
            <div class="sr-left">
              <div class="sr-icon sr-icon--add">
                +
              </div>
              <div class="sr-label sr-label--brand">
                添加账号
              </div>
            </div>
            <div class="sr-right">
              <span class="sr-arrow">›</span>
            </div>
          </button>
        </div>

        <!-- Section 2: GitHub PAT -->
        <p class="section-label text-txt-secondary dark:text-txt-dark-secondary">
          GitHub 贡献
        </p>
        <div class="settings-card settings-card--github">
          <div class="settings-row settings-row--stacked">
            <div class="github-token__header">
              <div class="sr-left">
                <div class="sr-icon sr-icon--github">GH</div>
                <div class="sr-label">GitHub PAT</div>
              </div>
              <span
                class="github-token__status"
                :class="githubTokenConfigured ? 'github-token__status--ok' : 'github-token__status--empty'"
              >
                {{ githubTokenConfigured ? '已配置' : '未配置' }}
              </span>
            </div>
            <div class="github-token__desc">
              用于把本地下架候选提交到官方 ipa-archive 仓库。PAT 只保存在后端，前端不回显明文。
            </div>
            <div
              v-if="githubTokenConfigured"
              class="github-token__meta"
            >
              <span v-if="githubTokenMasked">{{ githubTokenMasked }}</span>
              <span v-if="githubTokenUpdatedAt">更新于 {{ githubTokenUpdatedAt }}</span>
            </div>
            <input
              v-model="githubTokenInput"
              class="github-token__input"
              type="password"
              autocomplete="off"
              spellcheck="false"
              placeholder="粘贴 GitHub fine-grained PAT"
            >
            <div class="github-token__actions">
              <button
                class="github-token__btn github-token__btn--primary"
                :disabled="githubTokenSaving || !githubTokenInput.trim()"
                @click="handleSaveGithubToken"
              >
                {{ githubTokenSaving ? '保存中…' : '保存 PAT' }}
              </button>
              <button
                v-if="githubTokenConfigured"
                class="github-token__btn github-token__btn--danger"
                :disabled="githubTokenDeleting"
                @click="handleDeleteGithubToken"
              >
                {{ githubTokenDeleting ? '删除中…' : '删除' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Section 3: 外观 -->
        <p class="section-label text-txt-secondary dark:text-txt-dark-secondary">
          外观
        </p>
        <div class="settings-card">
          <button
            class="settings-row settings-row--interactive"
            @click="emit('navigate-to-appearance')"
          >
            <div class="sr-left">
              <div class="sr-icon sr-icon--appearance">
                🌙
              </div>
              <div class="sr-label">
                外观配置
              </div>
            </div>
            <div class="sr-right">
              <span>跟随系统</span><span class="sr-arrow">›</span>
            </div>
          </button>
        </div>

        <!-- Section 4: 安全 -->
        <p class="section-label text-txt-secondary dark:text-txt-dark-secondary">
          安全
        </p>
        <div class="settings-card">
          <button
            class="settings-row settings-row--interactive"
            @click="emit('navigate-to-changepassword')"
          >
            <div class="sr-left">
              <div class="sr-icon sr-icon--danger">
                🔑
              </div>
              <div class="sr-label sr-label--danger">
                修改账号密码
              </div>
            </div>
            <div class="sr-right">
              <span class="sr-arrow">›</span>
            </div>
          </button>
          <button
            class="settings-row settings-row--interactive"
            @click="confirmLogout"
          >
            <div class="sr-left">
              <div class="sr-icon sr-icon--danger">
                🚪
              </div>
              <div class="sr-label sr-label--danger">
                退出登录
              </div>
            </div>
            <div class="sr-right">
              <span class="sr-arrow">›</span>
            </div>
          </button>
        </div>

        <!-- Section 5: 关于 (bottom-pinned, margin-top 24px) -->
        <p class="section-label section-label--about text-txt-secondary dark:text-txt-dark-secondary">
          关于
        </p>
        <div class="settings-card settings-card--about">
          <div class="settings-row">
            <div class="sr-left">
              <div class="sr-icon sr-icon--neutral">
                ℹ️
              </div>
              <div class="sr-label">
                版本号
              </div>
            </div>
            <div class="sr-right">
              <span>v{{ appVersion }} · {{ buildId }}</span>
            </div>
          </div>
          <a
            href="https://github.com/ruanrrn/ipaTool"
            target="_blank"
            rel="noopener"
            class="settings-row settings-row--interactive"
          >
            <div class="sr-left">
              <div class="sr-icon sr-icon--neutral">🔗</div>
              <div class="sr-label">GitHub</div>
            </div>
            <div class="sr-right"><span class="sr-arrow">↗</span></div>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/* global __APP_VERSION__, __APP_BUILD_ID__ */
import { computed, onMounted, ref } from 'vue'
import { useAppStore } from '../stores/app'
import { useAccounts, accountIdentityKey } from '../composables/useAccounts'
import { formatRegion } from '../utils/region.js'
import { API_BASE } from '../config.js'
import { apiFetch } from '../utils/api.js'
import { Confirm } from './MobileConfirm.vue'
import { Toast } from './MobileToast.vue'

const emit = defineEmits(['logout', 'navigate-to-appearance', 'navigate-to-account', 'navigate-to-changepassword'])
const appStore = useAppStore()
const { accounts, loadAccounts } = useAccounts()
const appVersion = __APP_VERSION__
const buildId = __APP_BUILD_ID__

const refreshingToken = ref(null)
const githubTokenInput = ref('')
const githubTokenSaving = ref(false)
const githubTokenDeleting = ref(false)

const githubTokenConfigured = computed(() => appStore.githubTokenStatus.configured)
const githubTokenMasked = computed(() => appStore.githubTokenStatus.maskedToken)
const githubTokenUpdatedAt = computed(() => {
  const value = appStore.githubTokenStatus.updatedAt
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
})

const getAccountKey = (account, fallbackIndex = '') => accountIdentityKey(account) || account?.email || account?.token || account?.dsid || `account-${fallbackIndex}`

const getRegionLabel = (region) => formatRegion(region)

// ---- Account Freshness ----
// 后端返回 lastRefreshedAt = 距上次认证的秒数
// 后端 ACCOUNT_REFRESH_AFTER_SECS = 1800 (30 min)
const FRESHNESS_THRESHOLD = 1800

function getFreshnessLabel(lastRefreshedAt) {
  const secs = lastRefreshedAt || 0
  if (secs < 60) return '刚刚'
  if (secs < 3600) return `${Math.floor(secs / 60)}分钟前`
  if (secs < 86400) return `${Math.floor(secs / 3600)}小时前`
  return `${Math.floor(secs / 86400)}天前`
}

function getFreshnessClass(lastRefreshedAt) {
  const secs = lastRefreshedAt || 0
  if (secs < FRESHNESS_THRESHOLD * 0.7) return 'sr-freshness--fresh'   // <21 min
  if (secs < FRESHNESS_THRESHOLD) return 'sr-freshness--warning'       // <30 min
  return 'sr-freshness--stale'                                         // >=30 min
}

// ---- GitHub PAT ----
async function handleSaveGithubToken() {
  const token = githubTokenInput.value.trim()
  if (!token) return
  githubTokenSaving.value = true
  try {
    await appStore.saveGithubToken(token)
    githubTokenInput.value = ''
    Toast.success('GitHub PAT 已保存')
  } catch (error) {
    Toast.error(error.message || '保存 GitHub PAT 失败')
  } finally {
    githubTokenSaving.value = false
  }
}

async function handleDeleteGithubToken() {
  const confirmed = await Confirm.show({
    title: '确认删除 GitHub PAT？',
    message: `将删除当前用于社区归档贡献的 GitHub PAT${githubTokenMasked.value ? `（${githubTokenMasked.value}）` : ''}。删除后将无法发布贡献，直到重新配置。`
  })
  if (!confirmed) return

  githubTokenDeleting.value = true
  try {
    await appStore.deleteGithubToken()
    githubTokenInput.value = ''
    Toast.success('GitHub PAT 已删除')
  } catch (error) {
    Toast.error(error.message || '删除 GitHub PAT 失败')
  } finally {
    githubTokenDeleting.value = false
  }
}

onMounted(() => {
  loadAccounts().catch((error) => {
    console.warn('Failed to load accounts:', error)
  })

  appStore.loadGithubTokenStatus().catch((error) => {
    console.warn('Failed to load GitHub token status:', error)
  })
})

// ---- Logout ----
async function confirmLogout() {
  const confirmed = await Confirm.show({
    title: '确认退出登录？',
    message: '退出后需要重新输入用户名和密码登录。已下载的 IPA 文件不会删除。'
  })
  if (!confirmed) return

  await appStore.logoutAdmin()
  Toast.success('已退出登录')
  emit('logout', {
    confirm: false,
    performLogout: false,
    toast: false
  })
}

// ---- Refresh Account ----
async function handleRefreshAccount(account) {
  if (!account.token) return
  refreshingToken.value = account.token
  try {
    const { response, data } = await apiFetch(`${API_BASE}/login/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: account.token })
    })
    if (response.ok && data?.ok) {
      Toast.success(`${account.email} 刷新成功`)
      await loadAccounts()
    } else {
      Toast.error(data?.error || '刷新失败')
    }
  } catch {
    Toast.error('刷新请求失败')
  } finally {
    refreshingToken.value = null
  }
}

// ---- Delete Account ----
async function handleDeleteAccount(account) {
  if (!account?.token) return
  const confirmed = await Confirm.show({
    title: '确认删除账号？',
    message: `将删除账号 ${account.email || ''}，该账号正在进行的任务可能会受影响。`
  })
  if (!confirmed) return

  try {
    const { response, data } = await apiFetch(`${API_BASE}/accounts/${account.token}`, {
      method: 'DELETE'
    })
    if (response.ok) {
      Toast.success(`${account.email} 已删除`)
      await loadAccounts()
    } else {
      Toast.error(data?.error || '删除失败')
    }
  } catch {
    Toast.error('删除请求失败')
  }
}
</script>

<style scoped>
/* Page title */
.page-title {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.3;
  margin-bottom: 16px;
  color: var(--color-text, #0d0d0d);
}
.dark .page-title {
  color: var(--color-text, #f5f5f5);
}

.settings-page {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-size: var(--font-size-md);
}

.settings-page__fixed {
  flex-shrink: 0;
  padding-top: 20px;
}

.settings-page__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.settings-page__scroll-inner {
  padding-bottom: 24px;
}

/* Section label */
.section-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-muted, #6e6e80);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.section-label--about {
  margin-top: 24px;
}

/* Settings card */
.settings-card {
  background: var(--color-surface-muted, #f7f7f8);
  border: 1px solid var(--color-border, #ebebeb);
  border-radius: 14px;
  overflow: hidden;
  margin-bottom: 20px;
}
.settings-card--about {
  margin-bottom: 40px;
}
.dark .settings-card {
  background: var(--color-surface, #18181b);
  border-color: var(--color-surface-muted, #27272a);
}

/* Settings row */
.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 0.5px solid var(--color-border, #ebebeb);
}
.settings-row:last-child {
  border-bottom: none;
}
.settings-row--interactive {
  width: 100%;
  background: none;
  border: none;
  cursor: pointer;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: background 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}
.settings-row--interactive:active {
  background: var(--color-surface-hover, #ececec);
}
.settings-row--stacked {
  align-items: stretch;
  flex-direction: column;
  gap: 10px;
}
.github-token__header,
.github-token__actions,
.github-token__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.sr-icon--github {
  background: #24292f;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}
.github-token__status {
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 9px;
}
.github-token__status--ok {
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
}
.github-token__status--empty {
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
}
.github-token__desc,
.github-token__meta {
  color: var(--color-text-muted, #6e6e80);
  font-size: 13px;
  line-height: 1.5;
}
.github-token__input {
  width: 100%;
  border: 1px solid var(--color-border, #ebebeb);
  border-radius: 10px;
  background: var(--color-surface, #fff);
  color: var(--color-text, #0d0d0d);
  font-size: 14px;
  padding: 10px 12px;
  outline: none;
}
.github-token__input:focus {
  border-color: var(--color-primary, #2563eb);
}
.github-token__btn {
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  padding: 9px 13px;
}
.github-token__btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.github-token__btn--primary {
  background: var(--color-primary, #2563eb);
  color: #fff;
}
.github-token__btn--danger {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
}
.dark .github-token__input {
  background: var(--color-surface-muted, #27272a);
  border-color: var(--color-surface-muted, #27272a);
  color: var(--color-text, #f5f5f5);
}
.dark .settings-row {
  border-bottom-color: var(--color-surface-muted, #27272a);
}
.dark .settings-row--interactive:active {
  background: var(--color-surface, #27272a);
}

/* Row left */
.sr-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Icon */
.sr-icon {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  flex-shrink: 0;
}
.sr-icon--apple {
  background: var(--color-primary-soft, #ecfdf5);
}
.sr-icon--add {
  background: var(--color-surface-muted, #f7f7f8);
  font-size: 18px;
  font-weight: 700;
}
.dark .sr-icon--add {
  background: var(--color-surface-muted, #27272a);
}
.sr-icon--appearance {
  background: var(--color-surface-muted, #f7f7f8);
}
.dark .sr-icon--appearance {
  background: var(--color-surface-muted, #27272a);
}
.sr-icon--danger {
  background: var(--color-danger-soft, #fef2f2);
}
.dark .sr-icon--danger {
  background: rgba(239, 68, 68, 0.15);
}
.sr-icon--neutral {
  background: var(--color-surface-muted, #f7f7f8);
}
.dark .sr-icon--neutral {
  background: var(--color-surface-muted, #27272a);
}

/* Label */
.sr-label {
  font-size: 15px;
  color: var(--color-text, #0d0d0d);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.dark .sr-label {
  color: var(--color-text, #f5f5f5);
}
.sr-label--brand {
  color: var(--color-primary, #10a37f);
}
.sr-label--danger {
  color: var(--color-danger, #ef4444);
}

/* Account freshness indicator */
.sr-freshness {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 6px;
  white-space: nowrap;
}
.sr-freshness--fresh {
  color: #16a34a;
  background: rgba(22, 163, 74, 0.1);
}
.sr-freshness--warning {
  color: #d97706;
  background: rgba(217, 119, 6, 0.1);
}
.sr-freshness--stale {
  color: #dc2626;
  background: rgba(220, 38, 38, 0.1);
}
.dark .sr-freshness--fresh {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.12);
}
.dark .sr-freshness--warning {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.12);
}
.dark .sr-freshness--stale {
  color: #f87171;
  background: rgba(248, 113, 113, 0.12);
}

/* Row right */
.sr-right {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-text-muted, #6e6e80);
  font-size: 14px;
}
.dark .sr-right {
  color: var(--color-text-muted, #a1a1aa);
}
.sr-arrow {
  color: var(--color-text-tertiary, #c0c0c0);
}
.dark .sr-arrow {
  color: var(--color-text-tertiary, #71717a);
}

.dark .section-label {
  color: var(--color-text-muted, #a1a1aa);
}

.dark .sr-icon--apple {
  background: rgba(16, 163, 127, 0.15);
}

/* Account action buttons */
.sr-btn {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-base, 8px);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 16px;
  transition: background 0.15s ease, opacity 0.15s ease;
  flex-shrink: 0;
  background: transparent;
  color: var(--color-text-muted, #6e6e80);
}
.sr-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.sr-btn--refresh:active:not(:disabled) {
  background: var(--color-primary-soft, #ecfdf5);
  color: var(--color-primary, #10a37f);
}
.sr-btn--delete {
  color: var(--color-text-muted, #6e6e80);
}
.sr-btn--delete:active:not(:disabled) {
  background: var(--color-danger-soft, #fef2f2);
  color: var(--color-danger, #ef4444);
}
.dark .sr-btn {
  color: var(--color-text-muted, #a1a1aa);
}
.dark .sr-btn--refresh:active:not(:disabled) {
  background: rgba(16, 163, 127, 0.15);
}
.dark .sr-btn--delete:active:not(:disabled) {
  background: rgba(239, 68, 68, 0.15);
}

/* Refresh spinner */
.sr-btn__spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-text-tertiary, #c0c0c0);
  border-top-color: var(--color-primary, #10a37f);
  border-radius: 50%;
  animation: sr-spin 0.6s linear infinite;
}
@keyframes sr-spin {
  to { transform: rotate(360deg); }
}
</style>
