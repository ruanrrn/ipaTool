<template>
  <div id="app" :class="{ 'dark': isDark }" class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300">
    <!-- Header -->
    <header class="sticky top-0 z-50 glass-card border-b border-gray-200/50 dark:border-gray-700/50">
      <div class="container mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-gradient-to-br from-primary-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div>
              <h1 class="text-2xl font-bold gradient-text">IPA Tool</h1>
              <p class="text-xs text-gray-500 dark:text-gray-400">现代化IPA工具</p>
            </div>
          </div>
          
          <div class="flex items-center space-x-2">
            <button 
              @click="toggleDark" 
              class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              :title="isDark ? '切换到浅色模式' : '切换到深色模式'"
            >
              <svg v-if="isDark" class="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd" />
              </svg>
              <svg v-else class="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            </button>
            
            <a 
              href="https://github.com/ruanrrn/ipaTool" 
              target="_blank"
              class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="查看源代码"
            >
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content with Tab Layout -->
    <main class="container mx-auto px-4 py-8">
      <TabLayout 
        @app-selected="handleAppSelected"
        @download-started="handleDownloadStarted"
        @accounts-updated="handleAccountsUpdated"
        @remove-item="handleRemoveItem"
        @clear-queue="handleClearQueue"
      />
    </main>

    <!-- Footer -->
    <footer class="mt-16 py-8 border-t border-gray-200 dark:border-gray-700">
      <div class="container mx-auto px-4 text-center">
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          "直链"模式由浏览器原生下载器显示进度；"带进度"模式由后端SSE推送进度与实时日志。
        </p>
        <p class="text-gray-600 dark:text-gray-400 mb-2">
          Made with ❤️ by <a href="https://github.com/ruanrrn" class="text-primary-600 hover:underline" target="_blank">ruanrrn</a>
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-500">
          © 2024 IPA Tool. All rights reserved.
        </p>
        <div class="mt-4 flex justify-center space-x-4 text-sm">
          <a href="https://github.com/ruanrrn/ipaTool" class="text-primary-600 hover:underline" target="_blank">GitHub</a>
          <span class="text-gray-400">•</span>
          <a href="https://github.com/ruanrrn/ipaTool/issues" class="text-primary-600 hover:underline" target="_blank">反馈问题</a>
          <span class="text-gray-400">•</span>
          <a href="https://github.com/ruanrrn/ipaTool/stargazers" class="text-primary-600 hover:underline" target="_blank">支持我们</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { onMounted, watch } from 'vue'
import { useDark } from './composables/useDark'
import { useAppStore } from './stores/app'
import TabLayout from './components/TabLayout.vue'

const { isDark, toggleDark } = useDark()
const appStore = useAppStore()

const handleAppSelected = (app) => {
  appStore.setSelectedApp(app)
}

const handleDownloadStarted = (task) => {
  appStore.addToQueue(task)
  appStore.activeTab = 'queue'
}

const handleRemoveItem = (index) => {
  appStore.removeFromQueue(index)
}

const handleClearQueue = () => {
  appStore.clearQueue()
}

const handleAccountsUpdated = (accounts) => {
  appStore.triggerAccountsUpdate()
}

const updateDarkClass = () => {
  const html = document.documentElement
  const body = document.body
  
  if (isDark.value) {
    html.classList.add('dark')
    body.classList.add('dark')
  } else {
    html.classList.remove('dark')
    body.classList.remove('dark')
  }
}

onMounted(() => {
  // 初始化暗黑模式
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  isDark.value = prefersDark
  
  // 更新 html 和 body 标签的类
  updateDarkClass()
})

// 监听暗黑模式变化
watch(isDark, () => {
  updateDarkClass()
})
</script>
