<template>
 <div
  id="app"
  :class="{ dark: isDark }"
  class="min-h-[100svh] bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-200"
 >
  <div
   v-if="authState === 'loading'"
   class="flex min-h-[100svh] items-center justify-center"
  >
   <div class="text-[var(--font-size-sm)] text-[var(--text-secondary)]">加载中...</div>
  </div>

  <Login
   v-else-if="authState === 'unauthenticated'"
   @login-success="onLoginSuccess"
  />

  <template v-else>
   <div class="mx-auto min-h-[100svh] max-w-[960px] px-4 pb-6 sm:px-6">
    <header class="sticky top-0 z-50 flex h-11 items-center justify-between border-b border-[var(--separator)] bg-[var(--bg-primary)]">
     <div class="flex items-center gap-3">
      <div class="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent-blue)] text-white">
       <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
       </svg>
      </div>
      <span class="text-[var(--font-size-xl)] font-semibold text-[var(--text-primary)]">ipaTool</span>
     </div>
     <div class="flex items-center gap-2">
      <button
       class="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] border border-[var(--separator)] bg-[var(--card-bg)] text-[var(--text-secondary)] transition-all duration-200 hover:text-[var(--accent-blue)]"
       :title="isDark ? '浅色模式' : '深色模式'"
       @click="toggleDark"
      >
       <svg v-if="isDark" class="h-[18px] w-[18px]" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd" /></svg>
       <svg v-else class="h-[18px] w-[18px]" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>
      </button>
      <button
       class="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] border border-[var(--separator)] bg-[var(--card-bg)] text-[var(--text-secondary)] transition-all duration-200 hover:text-[var(--accent-red)]"
       title="退出登录"
       @click="handleLogout"
      >
       <svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
      </button>
      <a
       href="https://github.com/ruanrrn/ipaTool"
       target="_blank"
       class="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] border border-[var(--separator)] bg-[var(--card-bg)] text-[var(--text-secondary)] transition-all duration-200 hover:text-[var(--accent-blue)]"
       title="GitHub"
      >
       <svg class="h-[18px] w-[18px]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
      </a>
     </div>
    </header>

    <div class="pt-3">
     <TabLayout
      @app-selected="handleAppSelected"
      @download-started="handleDownloadStarted"
      @accounts-updated="handleAccountsUpdated"
      @remove-item="handleRemoveItem"
      @clear-queue="handleClearQueue"
      @logout="handleLogout"
     />
    </div>
   </div>
  </template>
 </div>
</template>

<script setup>
import { onMounted, onUnmounted, watch, ref } from 'vue'

import { useDark } from './composables/useDark'
import { useAppStore } from './stores/app'
import { useNotifications } from './composables/useNotifications'
import TabLayout from './components/TabLayout.vue'
import Login from './components/Login.vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const { isDark, toggleDark } = useDark()
const appStore = useAppStore()
const notifications = useNotifications()

const authState = ref('loading')
const API_BASE = '/api'

async function checkAuth() {
 try {
 const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'same-origin' })
 const data = await res.json()
 if (data.ok && data.data) {
 authState.value = 'authenticated'
 appStore.setAuthUser(data.data)
 } else {
 authState.value = 'unauthenticated'
 }
 } catch {
 authState.value = 'unauthenticated'
 }
}

function onLoginSuccess() {
 authState.value = 'authenticated'
 appStore.checkAuth()
}

async function handleLogout() {
 try {
   await ElMessageBox.confirm('确定要退出登录吗？', '退出确认', {
     confirmButtonText: '退出',
     cancelButtonText: '取消',
     type: 'error',
     confirmButtonClass: 'danger-confirm-button',
     lockScroll: false,
   })
   await appStore.logoutAdmin()
   authState.value = 'unauthenticated'
   ElMessage.success('已退出登录')
 } catch {
   // user canceled
 }
}

const handleAppSelected = (app) => appStore.setSelectedApp(app)
const handleDownloadStarted = (task) => {
 appStore.addToQueue(task)
 appStore.activeTab = 'ipa'
}
const handleRemoveItem = (index) => appStore.removeFromQueue(index)
const handleClearQueue = () => appStore.clearQueue()
const handleAccountsUpdated = () => appStore.triggerAccountsUpdate()

const updateDarkClass = () => {
 const method = isDark.value ? 'add' : 'remove'
 document.documentElement.classList[method]('dark')
 document.body.classList[method]('dark')
}

onMounted(() => {
 isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
 updateDarkClass()
 checkAuth()
 notifications.init()
})

onUnmounted(() => {
 notifications.stopVersionPolling()
})

watch(isDark, updateDarkClass)
</script>
