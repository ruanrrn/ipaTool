<template>
  <div
    id="app"
    :class="{ dark: isDark }"
    class="h-[100dvh] min-h-[100svh] overflow-hidden bg-surface-page text-txt transition-colors duration-200 dark:bg-surface-dark-page dark:text-txt-dark"
  >
    <div
      v-if="authState === 'loading'"
      class="flex h-full items-center justify-center overflow-hidden"
    >
      <div class="text-label text-txt-secondary dark:text-txt-dark-secondary">
        加载中...
      </div>
    </div>

    <Login
      v-else-if="authState === 'unauthenticated'"
      @login-success="onLoginSuccess"
    />

    <Login
      v-else-if="authState === 'force_password_change'"
      force-password-change
      @login-success="onLoginSuccess"
    />

    <template v-else>
      <div class="mx-auto h-full max-w-[960px] overflow-hidden">
        <TabLayout
          @app-selected="handleAppSelected"
          @download-started="handleDownloadStarted"
          @accounts-updated="handleAccountsUpdated"
          @remove-item="handleRemoveItem"
          @clear-queue="handleClearQueue"
          @logout="handleLogout"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue'
import { API_BASE } from './config.js'
import { apiFetch } from './utils/api.js'

import { useDark } from './composables/useDark'
import { useAppStore } from './stores/app'
import { useNotifications } from './composables/useNotifications'
import { STORAGE_KEYS } from './utils/storage.js'
import { applyAccentColor } from './utils/theme'

const TabLayout = defineAsyncComponent(() => import('./components/TabLayout.vue'))
const Login = defineAsyncComponent(() => import('./components/Login.vue'))

const { isDark } = useDark()
const appStore = useAppStore()
const notifications = useNotifications()

const authState = ref('loading')

const preventGestureZoom = (event) => {
 event.preventDefault()
}

const preventMultiTouchZoom = (event) => {
 if (event.touches && event.touches.length > 1) {
  event.preventDefault()
 }
}

const preventCtrlWheelZoom = (event) => {
 if (event.ctrlKey) {
  event.preventDefault()
 }
}

const lockRootViewport = () => {
 document.documentElement.style.overflow = 'hidden'
 document.body.style.overflow = 'hidden'
 document.body.style.overscrollBehavior = 'none'
}

const unlockRootViewport = () => {
 document.documentElement.style.overflow = ''
 document.body.style.overflow = ''
 document.body.style.overscrollBehavior = ''
}

async function checkAuth() {
 try {
 const { data } = await apiFetch(`${API_BASE}/auth/me`, { credentials: 'same-origin' })
 if (data.ok && data.data) {
 appStore.setAuthUser(data.data)
 authState.value = data.data.is_default ? 'force_password_change' : 'authenticated'
 } else {
 authState.value = 'unauthenticated'
 }
 } catch {
 authState.value = 'unauthenticated'
 }
}

async function onLoginSuccess() {
 const isAuthenticated = await appStore.checkAuth()
 authState.value = isAuthenticated && appStore.authState.user?.is_default
   ? 'force_password_change'
   : 'authenticated'
}

async function handleLogout(options = {}) {
 try {
   const shouldConfirm = options?.confirm !== false
   if (shouldConfirm) {
     const { Confirm } = await import('./components/MobileConfirm.vue')
     const ok = await Confirm.show({
       title: '退出确认',
       message: '确定要退出登录吗？',
       confirmText: '退出',
       cancelText: '取消',
       type: 'danger',
     })
     if (!ok) return
   }

   if (options?.performLogout !== false) {
     await appStore.logoutAdmin()
   }

   authState.value = 'unauthenticated'
   if (options?.toast !== false) {
     const { Toast } = await import('./components/MobileToast.vue')
     Toast.success('已退出登录')
   }
 } catch {
   // user canceled
 }
}

const handleAppSelected = (app) => appStore.setSelectedApp(app)
const handleDownloadStarted = (task) => {
 appStore.addToQueue(task)
}
const handleRemoveItem = (index) => appStore.removeFromQueue(index)
const handleClearQueue = () => appStore.clearQueue()
const handleAccountsUpdated = () => appStore.triggerAccountsUpdate()

onMounted(() => {
 // Apply saved accent color
 const savedAccentColor = localStorage.getItem(STORAGE_KEYS.ACCENT_COLOR)
 if (savedAccentColor) {
   applyAccentColor(savedAccentColor)
 }
 lockRootViewport()
 document.addEventListener('gesturestart', preventGestureZoom, { passive: false })
 document.addEventListener('gesturechange', preventGestureZoom, { passive: false })
 document.addEventListener('touchmove', preventMultiTouchZoom, { passive: false })
 window.addEventListener('wheel', preventCtrlWheelZoom, { passive: false })
 // If savedAppearance === 'light', useDark already loaded isDark=false, no action needed
 checkAuth()
 notifications.init()
})

onUnmounted(() => {
 unlockRootViewport()
 document.removeEventListener('gesturestart', preventGestureZoom)
 document.removeEventListener('gesturechange', preventGestureZoom)
 document.removeEventListener('touchmove', preventMultiTouchZoom)
 window.removeEventListener('wheel', preventCtrlWheelZoom)
 notifications.stopVersionPolling()
})

</script>

<style scoped>
:global(html),
:global(body),
:global(#app) {
 height: 100%;
 overflow: hidden;
 overscroll-behavior: none;
}

#app {
 isolation: isolate;
}
</style>
