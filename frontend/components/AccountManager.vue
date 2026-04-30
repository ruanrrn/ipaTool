<template>
  <div class="appearance-page">
    <!-- Secondary page navigation bar -->
    <div class="ap-nav">
      <button
        class="ap-nav__back"
        @click="emit('close')"
      >
        <SvgIcon
          class="ap-nav__back-icon"
          :icon="arrowLeftIcon"
        />
        返回
      </button>
      <div class="ap-nav__title">
        添加 Apple ID
      </div>
      <div class="ap-nav__spacer" />
    </div>

    <div class="ap-body">
      <div class="ap-section">
        <div class="ap-section__title">
          登录 Apple ID
        </div>
        <div class="ap-card ap-card--form">
          <div class="ap-form">
            <MobileInput
              v-model="newAccount.email"
              type="email"
              label="邮箱"
              placeholder="your@email.com"
              :disabled="logging"
              clearable
              autocomplete="email"
            />

            <MobileInput
              v-model="newAccount.password"
              type="password"
              label="密码"
              placeholder="••••••••"
              :disabled="logging"
              autocomplete="current-password"
            />

            <MobileInput
              v-model="newAccount.memo"
              type="text"
              label="备注（可选）"
              placeholder="例：工作号、美区小号..."
              :disabled="logging"
              clearable
            />

            <div :class="{ 'ring-2 ring-brand ring-offset-2 dark:ring-offset-surface-dark-page rounded-xl': mfaRequired }">
              <MobileInput
                v-model="newAccount.code"
                type="text"
                label="验证码"
                placeholder="两步验证码（如需要）"
                :disabled="logging"
                clearable
                autocomplete="one-time-code"
                inputmode="numeric"
                :hint="mfaRequired ? '请输入受信任设备上收到的 6 位验证码' : ''"
              />
            </div>

            <label
              class="mobile-checkbox"
              :class="{ 'mobile-checkbox--disabled': logging }"
            >
              <input
                type="checkbox"
                class="mobile-checkbox__input"
                :checked="savePassword"
                :disabled="logging"
                @change="savePassword = $event.target.checked"
              >
              <span class="mobile-checkbox__box">
                <SvgIcon
                  class="mobile-checkbox__check"
                  :icon="checkboxCheckIcon"
                />
              </span>
              <span class="mobile-checkbox__label text-[14px] text-txt dark:text-txt-dark">保存密码以便下次自动登录</span>
            </label>

            <MobileButton
              :disabled="logging || autoLogging || !isFormValid"
              :loading="logging"
              type="primary"
              block
              class="!rounded-[12px]"
              @click="loginAccount"
            >
              {{ logging ? '添加中...' : '添加账号' }}
            </MobileButton>

            <div
              v-if="autoLogging"
              class="flex items-center justify-center gap-2 rounded-xl border border-bdr dark:border-bdr-dark bg-surface dark:bg-surface-dark-muted px-4 py-3 text-body text-txt-secondary dark:text-txt-dark-secondary"
            >
              <SvgIcon
                class="h-4 w-4 animate-spin"
                :icon="spinnerIcon"
              />
              <span>正在自动登录保存的账号...</span>
            </div>

            <p class="ap-form__hint">
              App Store 区域将根据账号信息自动匹配
            </p>
          </div>
        </div>
      </div>

      <div style="height: 40px;" />
    </div>
  </div>
</template>

<script setup>
import SvgIcon from './SvgIcon.vue'
import arrowLeftIcon from '../assets/icons/arrow-left.svg?raw'
import checkboxCheckIcon from '../assets/icons/checkbox-check.svg?raw'
import spinnerIcon from '../assets/icons/spinner.svg?raw'
import { ref, computed, onMounted } from 'vue'
import { API_BASE } from '../config.js'

import MobileButton from './MobileButton.vue'
import MobileInput from './MobileInput.vue'
import { Toast } from './MobileToast.vue'
import { useAccounts, dedupeAccounts } from '../composables/useAccounts.js'
import { apiFetch } from '../utils/api.js'

const emit = defineEmits(['accounts-updated', 'close'])

const { accounts, loadAccounts, loadSavedCredentials: useLoadSavedCredentials, persistAccounts, autoLoginAll: useAutoLoginAll } = useAccounts()
const savedCredentials = ref([])
const newAccount = ref({
  email: '',
  password: '',
  code: '',
  memo: '',
})
const logging = ref(false)
const autoLogging = ref(false)
const savePassword = ref(true)
const mfaRequired = ref(false)

const isFormValid = computed(() => {
  return newAccount.value.email && newAccount.value.password
})

const loadSavedCredentials = async () => {
  const creds = await useLoadSavedCredentials()
  if (creds) {
    savedCredentials.value = creds
  }
}


const saveAccounts = () => {
  persistAccounts()
  emit('accounts-updated', accounts.value)
}

const loginAccount = async () => {
  if (!newAccount.value.email || !newAccount.value.password) {
    Toast.warning('请填写完整的账号信息')
    return
  }

  const existingAccount = accounts.value.find(
    (acc) => acc.email === newAccount.value.email,
  )
  if (existingAccount) {
    Toast.warning('该账号已登录，无需重复登录')
    return
  }

  logging.value = true

  try {
    const { response, data } = await apiFetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: newAccount.value.email,
        password: newAccount.value.password,
        mfa: newAccount.value.code || undefined,
        saveCredentials: savePassword.value,
        memo: newAccount.value.memo || undefined,
      }),
    })

    if (!response.ok && !data.ok) {
      Toast.error(`登录失败：${data.error || '服务器错误'}`)
      logging.value = false
      return
    }

    if (data.ok && data.data?.status === 'need_mfa') {
      mfaRequired.value = true
      Toast.show({
        type: 'warning',
        message: '此账号需要二次验证，请查看你的受信任设备上的验证码，填入后再次点击登录',
        duration: 8000,
      })
      logging.value = false
      return
    }

    if (data.ok && data.data?.status === 'mfa_failed') {
      Toast.error('验证码无效或已过期，请重新输入')
      newAccount.value.code = ''
      logging.value = false
      return
    }

    if (!data.ok) {
      const errMsg = data.error || '未知错误'
      Toast.error(`登录失败：${errMsg}`)
      if (errMsg.includes('密码') || errMsg.includes('BadLogin')) {
        mfaRequired.value = true
      }
      logging.value = false
      return
    }

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

    await loadSavedCredentials()
    saveAccounts()

    newAccount.value = { email: '', password: '', code: '', memo: '' }

    Toast.success(`登录成功：${data.data.email}`)
  } catch (error) {
    Toast.error(`网络错误：${error.message}`)
  } finally {
    logging.value = false
  }
}

const autoLoginAll = async () => {
  if (savedCredentials.value.length === 0) return

  autoLogging.value = true

  try {
    const data = await useAutoLoginAll()

    if (data && data.ok && data.results) {
      const { success = [], needCode = [], failed = [] } = data.results

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
        setTimeout(() => {
          if (success.length > 0 && needCode.length === 0 && failed.length === 0) {
          } else {
            Toast.show(message)
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
  await loadSavedCredentials()
  await loadAccounts()
  await autoLoginAll()
  emit('accounts-updated', accounts.value)
})

defineExpose({
  accounts,
})
</script>

<style scoped>
.appearance-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100svh;
  background: var(--color-bg-page, #f0f0f0);
}

.dark .appearance-page {
  background: var(--color-bg);
}

.ap-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 56px;
  margin: 0 calc(var(--space-5) * -1) 20px;
  padding: 0 var(--space-5);
  background: var(--color-bg-white, #fff);
  border-bottom: 1px solid var(--color-border-light, #f0f0f0);
  flex-shrink: 0;
}

.dark .ap-nav {
  background: var(--color-surface, #111111);
  border-bottom-color: var(--color-border, #27272a);
}

.ap-nav__back {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border: none;
  background: transparent;
  padding: 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--color-primary, #10a37f);
  cursor: pointer;
}

.ap-nav__back-icon {
  width: 20px;
  height: 20px;
}

.ap-nav__title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text, #0d0d0d);
}

.dark .ap-nav__title {
  color: var(--color-text, #f5f5f5);
}

.ap-nav__spacer {
  flex: 1;
}

.ap-body {
  flex: 1;
  overflow-y: auto;
}

.ap-section {
  padding: 20px 20px 0;
}

.ap-section__title {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-muted, #6e6e80);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.dark .ap-section__title {
  color: var(--color-text-muted, #a1a1aa);
}

.ap-card {
  background: var(--color-surface-muted, #f7f7f8);
  border: 1px solid var(--color-border, #ebebeb);
  border-radius: 14px;
  overflow: hidden;
}

.dark .ap-card {
  background: var(--color-surface, #18181b);
  border-color: var(--color-surface-muted, #27272a);
}

.ap-card--form {
  padding: 16px;
}

.ap-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ap-form__hint {
  padding-top: 8px;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-tertiary, #c0c0c0);
}

.dark .ap-form__hint {
  color: var(--color-text-tertiary, #71717a);
}

/* Inline checkbox styles for save-password */
.mobile-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  min-height: 22px;
  padding: 2px 0;
  box-sizing: border-box;
}

.mobile-checkbox__input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.mobile-checkbox__box {
 position: relative;
 display: inline-flex;
 align-items: center;
 justify-content: center;
 width: 22px;
 height: 22px;
 border: 2px solid var(--color-border-strong, #d1d5db);
 border-radius: 6px;
 background: var(--color-surface, #fff);
 transition: all 0.2s ease;
 flex-shrink: 0;
}

.mobile-checkbox__check {
  width: 12px;
  height: 10px;
  color: var(--color-text-inverse);
  opacity: 0;
  transform: scale(0.5);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

:deep(.mobile-checkbox--checked) .mobile-checkbox__box,
.mobile-checkbox:has(.mobile-checkbox__input:checked) .mobile-checkbox__box {
 background: var(--color-primary, #10a37f);
 border-color: var(--color-primary, #10a37f);
}

:deep(.mobile-checkbox--checked) .mobile-checkbox__check,
.mobile-checkbox:has(.mobile-checkbox__input:checked) .mobile-checkbox__check {
 opacity: 1;
 transform: scale(1);
}

.mobile-checkbox__label {
 font-size: 14px;
 font-family: -apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif;
 color: var(--color-text, #0d0d0d);
 line-height: 1.4;
}

.mobile-checkbox--disabled {
 opacity: 0.5;
 cursor: not-allowed;
 pointer-events: none;
}

/* Dark mode for inline checkbox */
.dark .mobile-checkbox__box {
 background: rgba(255, 255, 255, 0.08);
 border-color: rgba(255, 255, 255, 0.2);
}

.dark .mobile-checkbox:has(.mobile-checkbox__input:checked) .mobile-checkbox__box {
 background: var(--color-primary, #10a37f);
 border-color: var(--color-primary, #10a37f);
}

.dark .mobile-checkbox__label {
 color: var(--color-text, #f5f5f5);
}
</style>
