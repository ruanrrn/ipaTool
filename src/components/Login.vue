<template>
  <div class="flex min-h-[100svh] items-center justify-center px-4 py-10 sm:px-6">
    <div class="w-full max-w-[420px]">
      <div class="card overflow-hidden">
        <div class="mb-6 flex items-start gap-4">
          <div class="hero-icon">
            <svg
              class="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 11c0-1.657 1.343-3 3-3s3 1.343 3 3v3H6v-3c0-1.657 1.343-3 3-3s3 1.343 3 3zm0 0V8m0-4h.01"
              />
            </svg>
          </div>
          <div>
            <p class="mb-1 text-[var(--font-size-sm)] text-secondary">
              安全登录
            </p>
            <h2 class="text-[var(--font-size-xl)] font-semibold text-primary">
              管理员登录
            </h2>
          </div>
        </div>

        <el-form
          ref="loginFormRef"
          :model="loginForm"
          :rules="loginRules"
          label-position="top"
          class="login-form"
        >
          <el-form-item
            label="用户名"
            prop="username"
          >
            <el-input
              v-model="loginForm.username"
              autocomplete="username"
              placeholder="请输入用户名"
              size="large"
              @keyup.enter="handleLogin"
            />
          </el-form-item>

          <el-form-item
            label="密码"
            prop="password"
          >
            <el-input
              v-model="loginForm.password"
              type="password"
              show-password
              autocomplete="current-password"
              placeholder="请输入密码"
              size="large"
              @keyup.enter="handleLogin"
            />
          </el-form-item>

          <el-button
            type="primary"
            size="large"
            class="mt-4 !h-11 w-full !rounded-[var(--radius-control)]"
            :loading="loginLoading"
            @click="handleLogin"
          >
            登录
          </el-button>
        </el-form>

        <div
          v-if="appStore.authState.user?.is_default"
          class="status-panel warning mt-6 p-4"
        >
          <el-alert
            type="warning"
            show-icon
            :closable="false"
            title="检测到仍在使用默认密码，必须先修改密码后才能进入系统"
          />
        </div>
      </div>

      <el-dialog
        v-model="showChangePassword"
        title="首次登录：请修改用户名和密码"
        width="min(92vw, 420px)"
        :close-on-click-modal="false"
        :close-on-press-escape="false"
        :show-close="false"
        :lock-scroll="false"
        align-center
      >
        <el-form
          ref="pwdFormRef"
          :model="pwdForm"
          :rules="pwdRules"
          label-position="top"
          class="login-form"
        >
          <el-form-item
            label="新用户名"
            prop="new_username"
          >
            <el-input
              v-model="pwdForm.new_username"
              autocomplete="off"
              placeholder="请输入新用户名"
              @keyup.enter="handleChangePassword"
            />
          </el-form-item>
          <el-form-item
            label="当前密码"
            prop="current_password"
          >
            <el-input
              v-model="pwdForm.current_password"
              type="password"
              show-password
              autocomplete="current-password"
              placeholder="请输入当前密码"
              @keyup.enter="handleChangePassword"
            />
          </el-form-item>
          <el-form-item
            label="新密码"
            prop="new_password"
          >
            <el-input
              v-model="pwdForm.new_password"
              type="password"
              show-password
              autocomplete="new-password"
              placeholder="请输入新密码"
              @keyup.enter="handleChangePassword"
            />
          </el-form-item>
          <el-form-item
            label="确认新密码"
            prop="confirm_password"
          >
            <el-input
              v-model="pwdForm.confirm_password"
              type="password"
              show-password
              autocomplete="new-password"
              placeholder="请再次输入新密码"
              @keyup.enter="handleChangePassword"
            />
          </el-form-item>
        </el-form>

        <template #footer>
          <el-button
            type="primary"
            class="!rounded-[var(--radius-control)]"
            :loading="pwdLoading"
            @click="handleChangePassword"
          >
            修改密码
          </el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'

const emit = defineEmits(['login-success'])
const appStore = useAppStore()

const loginFormRef = ref(null)
const loginLoading = ref(false)

const loginForm = reactive({
 username: '',
 password: ''
})

const loginRules = {
 username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
 password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const showChangePassword = ref(false)
const pwdFormRef = ref(null)
const pwdLoading = ref(false)

const pwdForm = reactive({
 new_username: '',
 current_password: '',
 new_password: '',
 confirm_password: ''
})

const pwdRules = {
 current_password: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
 new_password: [{ required: true, message: '请输入新密码', trigger: 'blur' }],
 confirm_password: [
 { required: true, message: '请确认新密码', trigger: 'blur' },
 {
 validator: (_, value, callback) => {
 if (value !== pwdForm.new_password) {
 callback(new Error('两次输入的新密码不一致'))
 } else {
 callback()
 }
 },
 trigger: 'blur'
 }
 ]
}

watch(
 () => appStore.authState.user?.is_default,
 (isDefault) => {
 if (isDefault) {
 showChangePassword.value = true
 }
 },
 { immediate: true }
)

const handleLogin = async () => {
 if (!loginFormRef.value) return

 try {
 await loginFormRef.value.validate()

 loginLoading.value = true
 const user = await appStore.loginAdmin(loginForm.username, loginForm.password)

 if (user?.is_default) {
 showChangePassword.value = true
 pwdForm.current_password = loginForm.password
 pwdForm.new_username = ''
 } else {
 ElMessage.success('登录成功')
 emit('login-success')
 }
 } catch (e) {
 ElMessage.error(e?.message || '登录失败')
 } finally {
 loginLoading.value = false
 }
}

const handleChangePassword = async () => {
 if (!pwdFormRef.value) return

 try {
 await pwdFormRef.value.validate()

 pwdLoading.value = true

 const res = await fetch('/api/auth/change-password', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json'
 },
 credentials: 'include',
 body: JSON.stringify({
 current_password: pwdForm.current_password,
 new_password: pwdForm.new_password,
 new_username: pwdForm.new_username.trim() || undefined
 })
 })

 if (!res.ok) {
 let msg = '修改密码失败'
 try {
 const json = await res.json()
 msg = json?.error || msg
 } catch {}
 throw new Error(msg)
 }

 const json = await res.json()

 ElMessage.success('密码修改成功，请使用新密码重新登录')
 showChangePassword.value = false

 // Clear form
 pwdForm.new_username = ''
 pwdForm.current_password = ''
 pwdForm.new_password = ''
 pwdForm.confirm_password = ''

 // Properly logout: clear server session + cookie + local state
 await appStore.logoutAdmin()

 // Reload the page to force App.vue to re-check auth state.
 // Without this, the local authState in App.vue stays stale and
 // the user sees a blank/broken state instead of the login form.
 window.location.reload()
 } catch (e) {
 ElMessage.error(e?.message || '修改密码失败')
 } finally {
 pwdLoading.value = false
 }
}
</script>

<style scoped>
/* Element Plus 的校验错误提示是 absolute 定位，el-form-item 需要保留足够的底部空间。
   之前用 tailwind 的 space-y-* 会把 margin-bottom 覆盖成 0，导致错误提示压到下方按钮上。
*/
.login-form :deep(.el-form-item) {
  margin-bottom: 18px;
}

.login-form :deep(.el-form-item.is-error) {
  margin-bottom: 22px;
}
</style>
