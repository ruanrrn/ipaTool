<template>
  <div class="account-manager space-y-4">
    <!-- Header -->
    <div class="account-header">
      <div class="header-icon">
        <svg
          class="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      </div>
      <div class="header-text">
        <h2 class="text-xl font-bold text-primary">
          账号管理
        </h2>
        <p class="text-sm text-secondary">
          管理 Apple ID 账号
        </p>
      </div>
    </div>

    <!-- Account List -->
    <div
      v-if="accounts.length > 0"
      class="accounts-section"
    >
      <div class="section-header">
        <h3 class="section-title">
          已登录账号
        </h3>
        <span class="section-count">{{ accounts.length }}</span>
      </div>
      <div class="accounts-list">
        <div
          v-for="(account, index) in accounts"
          :key="getAccountKey(account, index)"
          class="account-item"
        >
          <div class="account-avatar">
            <el-icon><User /></el-icon>
          </div>
          <div class="account-info">
            <p class="account-email">
              {{ account.email }}
            </p>
            <p class="account-dsid">
              DSID: {{ account.dsid }}
            </p>
            <p class="account-region">
              <span
                class="region-badge"
                :class="`region-${(account.region || 'US').toLowerCase()}`"
              >
                {{ getRegionLabel(account.region || 'US') }}
              </span>
            </p>
          </div>
          <div class="account-actions">
            <el-button
              type="primary"
              :icon="Refresh"

              size="small"
              class="refresh-button "
              :title="account.hasSavedCredentials ? '刷新会话' : '未保存密码，无法自动刷新'"
              :disabled="!account.hasSavedCredentials"
              :loading="refreshingAccountKeys.has(getAccountKey(account, index))"
              @click="refreshAccount(account, index)"
            />
            <el-button
              type="danger"
              :icon="Delete"

              size="small"
              plain
              class="remove-button "
              title="删除账号"
              @click="removeAccount(account, index)"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="account-content">
      <!-- Add Account Form -->
      <div class="form-section">
        <div class="form-header">
          <h3 class="form-title">
            登录 Apple ID
          </h3>
          <p class="form-subtitle">
            支持多账号登录
          </p>
        </div>
        <div class="form-fields">
          <div class="form-field">
            <label class="field-label">邮箱</label>
            <el-input
              v-model="newAccount.email"
              type="email"
              placeholder="your@email.com"
              :disabled="logging"
              size="large"
              clearable
              class="form-input"
            >
              <template #prefix>
                <el-icon class="field-icon">
                  <User />
                </el-icon>
              </template>
            </el-input>
          </div>

          <div class="form-field">
            <label class="field-label">密码</label>
            <el-input
              v-model="newAccount.password"
              type="password"
              placeholder="••••••••"
              :disabled="logging"
              show-password
              size="large"
              class="form-input"
            >
              <template #prefix>
                <el-icon class="field-icon">
                  <Lock />
                </el-icon>
              </template>
            </el-input>
          </div>

          <div class="form-field">
            <label class="field-label">验证码</label>
            <el-input
              v-model="newAccount.code"
              type="text"
              placeholder="两步验证码（如需要）"
              :disabled="logging"
              size="large"
              clearable
              class="form-input"
              :class="{ 'mfa-highlight': mfaRequired }"
            >
              <template #prefix>
                <el-icon class="field-icon">
                  <Key />
                </el-icon>
              </template>
            </el-input>
            <p
              v-if="mfaRequired"
              class="mfa-hint"
            >
              ⚠️ 请输入受信任设备上收到的 6 位验证码
            </p>
          </div>

          <!-- 保存密码选项 -->
          <div class="form-field">
            <el-checkbox
              v-model="savePassword"
              :disabled="logging"
              class="save-password-checkbox"
            >
              <span class="checkbox-label">保存密码以便下次自动登录</span>
            </el-checkbox>
          </div>

          <el-button
            :disabled="logging || autoLogging || !isFormValid"
            :loading="logging"
            type="primary"
            size="large"
            class="submit-button "
            @click="loginAccount"
          >
            <template #icon>
              <el-icon><Right /></el-icon>
            </template>
            {{ logging ? '登录中...' : '登录' }}
          </el-button>

          <!-- 自动登录状态提示 -->
          <div
            v-if="autoLogging"
            class="auto-login-status"
          >
            <el-icon class="is-loading">
              <Loading />
            </el-icon>
            <span>正在自动登录保存的账号...</span>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-if="accounts.length === 0"
        class="empty-state"
      >
        <div class="empty-icon">
          <svg
            class="w-16 h-16 text-secondary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
        <h3 class="empty-title">
          暂无登录账号
        </h3>
        <p class="empty-description">
          登录 Apple ID 账号以开始使用
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { formatRegion } from '../utils/region.js'
import { useAccounts, dedupeAccounts, accountIdentityKey } from '../composables/useAccounts.js'
import {
	User,
	Lock,
	Key,
	Right,
	Delete,
	Loading,
	Refresh,
} from '@element-plus/icons-vue'

const emit = defineEmits(['accounts-updated'])

const { accounts } = useAccounts()
const savedCredentials = ref([])
const newAccount = ref({
	email: '',
	password: '',
	code: '',
})
const logging = ref(false)
const autoLogging = ref(false)
const savePassword = ref(true) // 默认保存密码
const refreshingAccountKeys = ref(new Set()) // 正在刷新的账号集合
const mfaRequired = ref(false) // 是否处于 MFA 等待状态

const getAccountKey = (account, fallbackIndex = '') => accountIdentityKey(account) || account?.email || account?.token || account?.dsid || `account-${fallbackIndex}`

// 表单验证
const isFormValid = computed(() => {
	return newAccount.value.email && newAccount.value.password
})

const API_BASE = '/api'

// 加载保存的凭证列表（仅邮箱）
const loadSavedCredentials = async () => {
	try {
		const response = await fetch(`${API_BASE}/credentials`, { credentials: 'include' })
		const data = await response.json()

		if (data.ok && data.data) {
			savedCredentials.value = data.data
		}
	} catch (error) {
		console.error('Failed to load saved credentials:', error)
	}
}

const loadAccounts = async () => {
	// 先从 localStorage 加载（用于显示）
	const saved = localStorage.getItem('ipa_accounts')
	if (saved) {
		try {
			accounts.value = dedupeAccounts(JSON.parse(saved))
		} catch {
			accounts.value = []
		}
	}

	// 然后从服务器获取最新的已登录账号列表
	try {
		const response = await fetch(`${API_BASE}/accounts`, { credentials: 'include' })
		const data = await response.json()

		if (data.ok && data.data && data.data.length > 0) {
			// 同步服务器账号列表到本地
			accounts.value = dedupeAccounts(data.data.map((acc) => ({
				token: acc.token,
				email: acc.email,
				dsid: acc.dsid,
				region: acc.region || 'US',
				hasSavedCredentials: !!acc.hasSavedCredentials,
			})))
			saveAccounts()
		} else if (data.ok && (!data.data || data.data.length === 0)) {
			// 服务端无已登录账号，尝试用保存的凭证自动恢复
			try {
				const autoRes = await fetch(`${API_BASE}/auto-login`, { credentials: 'include', method: 'POST' })
				const autoData = await autoRes.json()
				if (autoData.ok && autoData.data?.succeeded?.length > 0) {
					const retryRes = await fetch(`${API_BASE}/accounts`, { credentials: 'include' })
					const retryData = await retryRes.json()
					if (retryData.ok && retryData.data) {
						accounts.value = dedupeAccounts(retryData.data.map((acc) => ({
							token: acc.token,
							email: acc.email,
							dsid: acc.dsid,
							region: acc.region || 'US',
							hasSavedCredentials: !!acc.hasSavedCredentials,
						})))
						saveAccounts()
					}
				}
			} catch (e) {
				console.warn('Auto-login restore failed:', e)
			}
		}
	} catch (error) {
		console.error('Failed to load accounts from server:', error)
	}
}

const saveAccounts = () => {
	accounts.value = dedupeAccounts(accounts.value)
	localStorage.setItem('ipa_accounts', JSON.stringify(accounts.value))
	emit('accounts-updated', accounts.value)
}

const loginAccount = async () => {
	if (!newAccount.value.email || !newAccount.value.password) {
		ElMessage.warning('请填写完整的账号信息')
		return
	}

	// 检查账号是否已存在
	const existingAccount = accounts.value.find(
		(acc) => acc.email === newAccount.value.email,
	)
	if (existingAccount) {
		ElMessage.warning('该账号已登录，无需重复登录')
		return
	}

	logging.value = true

	try {
		const response = await fetch(`${API_BASE}/login`, {
			credentials: 'include',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				email: newAccount.value.email,
				password: newAccount.value.password,
				mfa: newAccount.value.code || undefined,
				saveCredentials: savePassword.value,
			}),
		})

		const data = await response.json()

		// Network/server error
		if (!response.ok && !data.ok) {
			ElMessage.error(`登录失败：${data.error || '服务器错误'}`)
			logging.value = false
			return
		}

		// MFA needed — first round, no code provided yet
		if (data.ok && data.data?.status === 'need_mfa') {
			mfaRequired.value = true
			ElMessage({
				type: 'warning',
				message: '此账号需要二次验证，请查看你的受信任设备上的验证码，填入后再次点击登录',
				duration: 8000,
			})
			logging.value = false
			return
		}

		// MFA code was wrong/expired — keep the session, let user retry
		if (data.ok && data.data?.status === 'mfa_failed') {
			ElMessage.error('验证码无效或已过期，请重新输入')
			newAccount.value.code = ''
			logging.value = false
			return
		}

		// Business logic error (bad password, account locked, etc.)
		if (!data.ok) {
			const errMsg = data.error || '未知错误'
			ElMessage.error(`登录失败：${errMsg}`)
			// If it looks like a credential error, hint about MFA
			if (errMsg.includes('密码') || errMsg.includes('BadLogin')) {
				mfaRequired.value = true
			}
			logging.value = false
			return
		}

		// Login success
		mfaRequired.value = false
		accounts.value = dedupeAccounts([
			...accounts.value,
			{
				token: data.data.token,
				email: data.data.email,
				dsid: data.data.dsid,
				region: data.data.region || 'US',
				hasSavedCredentials: !!savePassword.value,
			}
		])

		// 更新保存的凭证列表
		await loadSavedCredentials()

		saveAccounts()

		// 重置表单
		newAccount.value = { email: '', password: '', code: '' }

		ElMessage.success(`登录成功：${data.data.email}`)
	} catch (error) {
		ElMessage.error(`网络错误：${error.message}`)
	} finally {
		logging.value = false
	}
}

const removeAccount = async (accountOrIndex, indexArg) => {
	const index = typeof accountOrIndex === 'number' ? accountOrIndex : indexArg ?? accounts.value.findIndex((item) => getAccountKey(item) === getAccountKey(accountOrIndex))
	const account = typeof accountOrIndex === 'number' ? accounts.value[index] : accountOrIndex
	if (!account || index < 0) return

	try {
		await ElMessageBox.confirm(
			'确定要删除这个账号吗？',
			'确认删除',
			{
				type: 'error',
				confirmButtonText: '删除',
				cancelButtonText: '取消',
				confirmButtonClass: 'danger-confirm-button',
				lockScroll: false,
			}
		)
	} catch {
		// user canceled
		return
	}

	// 从服务器删除账号（会同时删除保存的凭证）
	try {
		const response = await fetch(`${API_BASE}/accounts/${account.token}`, {
			credentials: 'include',
			method: 'DELETE',
		})

		if (response.ok) {
			accounts.value.splice(index, 1)
			saveAccounts()
			// 更新保存的凭证列表
			await loadSavedCredentials()
		} else {
			ElMessage.warning('删除失败')
		}
	} catch (error) {
		console.error('Failed to remove account:', error)
		ElMessage.warning('删除失败')
	}
}

// 刷新账号会话
const refreshAccount = async (accountOrIndex, indexArg) => {
	const account = typeof accountOrIndex === 'number' ? accounts.value[accountOrIndex] : accountOrIndex
	const accountKey = getAccountKey(account, typeof accountOrIndex === 'number' ? accountOrIndex : indexArg)
	if (!account) return

	if (!account.hasSavedCredentials) {
		ElMessage.warning('这个账号没有保存密码，无法自动刷新。请重新登录并勾选“保存密码”。')
		return
	}

	refreshingAccountKeys.value = new Set(refreshingAccountKeys.value).add(accountKey)
	ElMessage.info(`检测到数据库已有账号，正在刷新 ${account.email} 的会话…`)

	try {
		const response = await fetch(`${API_BASE}/login/refresh`, {
			credentials: 'include',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ token: account.token })
		})

		const data = await response.json()

		if (data.ok) {
			// 刷新账号列表以获取最新信息
			await loadSavedCredentials()
			await loadAccounts()
			ElMessage.success('账号会话已刷新，页面状态已自动同步')
		} else {
			const errMsg = data.error || '刷新失败'
			if (errMsg.includes('未找到保存的密码')) {
				ElMessage.error('刷新失败：这个账号没有保存密码。请重新登录并勾选“保存密码”。')
			} else {
				ElMessage.error(`刷新失败: ${errMsg}`)
			}
		}
	} catch (error) {
		console.error('Failed to refresh account:', error)
		ElMessage.warning('刷新失败，请检查网络连接')
	} finally {
		const nextRefreshingKeys = new Set(refreshingAccountKeys.value)
		nextRefreshingKeys.delete(accountKey)
		refreshingAccountKeys.value = nextRefreshingKeys
	}
}

// 自动登录所有保存的账号
const autoLoginAll = async () => {
	if (savedCredentials.value.length === 0) return

	autoLogging.value = true

	try {
		const response = await fetch(`${API_BASE}/auto-login`, {
			credentials: 'include',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
		})

		const data = await response.json()

		if (data.ok && data.results) {
			const { success, needCode, failed } = data.results

			// 添加成功登录的账号
			success.forEach((result) => {
				if (!result.alreadyLoggedIn) {
					accounts.value.push({
						token: result.token,
						email: result.email,
						dsid: result.dsid,
						region: result.region || 'US',
						hasSavedCredentials: true,
					})
				}
			})

			saveAccounts()
			await loadAccounts()

			// 显示自动登录结果
			if (success.length > 0 || needCode.length > 0 || failed.length > 0) {
				let message = ''
				if (success.length > 0) {
					message += `成功登录 ${success.length} 个账号`
				}
				if (needCode.length > 0) {
					if (message) message += '，'
					message += `${needCode.length} 个账号需要验证码`
				}
				if (failed.length > 0) {
					if (message) message += '，'
					message += `${failed.length} 个账号登录失败`
				}

				// 延迟显示，避免打扰用户
				setTimeout(() => {
					if (
						success.length > 0 &&
						needCode.length === 0 &&
						failed.length === 0
					) {
						// 全部成功，不显示提示
					} else {
						ElMessage.info(message)
					}
				}, 500)
			}
		}
	} catch (error) {
		console.error('Auto login failed:', error)
	} finally {
		autoLogging.value = false
	}
}

onMounted(async () => {
	// 先加载保存的凭证列表
	await loadSavedCredentials()

	// 加载已登录账号
	await loadAccounts()

	// 尝试自动登录保存的账号
	await autoLoginAll()

	emit('accounts-updated', accounts.value)
})

// 获取区域标签
const getRegionLabel = (region) => {
		return formatRegion(region)
}

// 暴露账号列表供其他组件使用
defineExpose({
	accounts,
})
</script>

<style scoped>
.account-manager {
 padding: 0;
}

.account-header {
 display: flex;
 align-items: center;
 gap: var(--space-3);
 margin-bottom: var(--space-3);
}

.header-icon {
 width: var(--size-artwork-sm);
 height: var(--size-artwork-sm);
}

.header-text h2,
.form-title,
.section-title,
.empty-title {
 font-size: var(--font-size-xl);
 font-weight: 600;
 color: var(--text-primary);
 margin: 0;
}

.header-text p,
.form-subtitle,
.field-label,
.account-dsid,
.account-region,
.empty-description,
.checkbox-label,
.mfa-hint,
.save-password-checkbox :deep(.el-checkbox__label) {
 font-size: var(--font-size-sm);
 color: var(--text-secondary);
}

.account-content,
.form-fields,
.accounts-list {
 display: flex;
 flex-direction: column;
 gap: var(--space-3);
}

.form-header,
.section-header {
 display: flex;
 align-items: center;
 justify-content: space-between;
 margin-bottom: var(--space-3);
}

.form-field {
 display: flex;
 flex-direction: column;
 gap: var(--space-2);
}

.field-icon {
 color: var(--text-secondary);
 font-size: var(--font-size-lg);
}

.submit-button {
 width: 100%;
 height: var(--size-control-xl);
 margin-top: var(--space-2);
}

.account-item {
 display: flex;
 align-items: center;
 gap: var(--space-3);
 padding: var(--space-4);
 border: var(--border-width-thin) solid var(--separator);
 border-radius: var(--radius-card);
 background: var(--card-bg);
}

.account-avatar {
 width: var(--size-artwork-sm);
 height: var(--size-artwork-sm);
 flex-shrink: 0;
}

.account-info {
 flex: 1;
 min-width: 0;
}

.account-email {
 margin: 0 0 var(--space-0-5);
 font-size: var(--font-size-md);
 font-weight: 600;
 color: var(--text-primary);
 overflow: hidden;
 text-overflow: ellipsis;
 white-space: nowrap;
}

.region-badge {
 padding: 0 var(--space-2);
}

.account-actions {
 display: flex;
 align-items: center;
 gap: var(--space-2);
}

.empty-state {
 text-align: center;
 padding: var(--space-6) var(--space-4);
 border-style: solid;
}

.empty-icon {
 display: flex;
 justify-content: center;
 margin-bottom: var(--space-3);
 color: var(--text-secondary);
}

.auto-login-status {
 display: flex;
 align-items: center;
 justify-content: center;
 gap: var(--space-2);
 padding: var(--space-3);
 font-size: var(--font-size-sm);
 background: var(--el-fill-color-light);
 border: var(--border-width-thin) solid var(--separator);
 border-radius: var(--radius-card);
 color: var(--text-secondary);
}

.auto-login-status .el-icon {
 font-size: var(--font-size-lg);
}

.mfa-highlight :deep(.el-input__wrapper) {
 border-color: var(--el-color-primary-light-5) !important;
}

@media (max-width: 640px) {
 .account-item {
  align-items: flex-start;
 }
}
</style>

