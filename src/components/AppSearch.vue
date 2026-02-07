<template>
  <div class="card">
    <div class="flex items-center space-x-3 mb-6">
      <div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">应用搜索</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">搜索应用或输入App ID</p>
      </div>
    </div>

    <div class="space-y-4">
      <!-- Search Input -->
      <div class="relative">
        <input
          v-model="searchQuery"
          @input="handleSearch"
          @keyup.enter="handleSearch"
          type="text"
          placeholder="搜索应用名称、Bundle ID 或 App ID..."
          class="input-field pl-12 pr-4 py-3"
        />
        <svg class="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <div v-if="searching" class="absolute right-4 top-1/2 transform -translate-y-1/2">
          <svg class="animate-spin h-5 w-5 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </div>

      <!-- Search Results -->
      <div v-if="searchResults.length > 0" class="space-y-2 max-h-96 overflow-y-auto">
        <div
          v-for="app in searchResults"
          :key="app.trackId"
          @click="selectApp(app)"
          class="flex items-center space-x-4 p-4 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-all duration-200 border border-transparent hover:border-primary-300 dark:hover:border-primary-700"
        >
          <img 
            :src="app.artworkUrl100 || app.artworkUrl60" 
            :alt="app.trackName"
            class="w-16 h-16 rounded-xl shadow-md object-cover"
          />
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold text-gray-900 dark:text-white truncate">{{ app.trackName }}</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ app.artistName }}</p>
            <div class="flex items-center space-x-2 mt-1">
              <span class="text-xs px-2 py-1 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded-full">
                {{ app.bundleId }}
              </span>
              <span class="text-xs text-gray-400">ID: {{ app.trackId }}</span>
            </div>
          </div>
          <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      <!-- No Results -->
      <div v-else-if="searchQuery && !searching && searchResults.length === 0" class="text-center py-8">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">未找到相关应用</p>
        <p class="text-xs text-gray-400 mt-1">请尝试使用完整的App ID搜索</p>
      </div>

      <!-- Quick Tips -->
      <div v-if="!searchQuery" class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <h4 class="font-semibold text-blue-900 dark:text-blue-300 mb-2">💡 搜索提示</h4>
        <ul class="text-sm text-blue-700 dark:text-blue-400 space-y-1">
          <li>• 输入应用名称（如"微信"）搜索应用</li>
          <li>• 输入Bundle ID（如"com.tencent.xin"）精确搜索</li>
          <li>• 输入App ID（如"414478124"）直接定位</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'

const emit = defineEmits(['app-selected'])

const searchQuery = ref('')
const searchResults = ref([])
const searching = ref(false)

const handleSearch = useDebounceFn(async () => {
  const query = searchQuery.value.trim()
  if (!query) {
    searchResults.value = []
    return
  }

  searching.value = true
  
  try {
    // Check if it's a numeric App ID
    if (/^\d+$/.test(query)) {
      // Direct App ID lookup
      const response = await fetch(`https://itunes.apple.com/lookup?id=${query}&country=CN`)
      const data = await response.json()
      
      if (data.results && data.results.length > 0) {
        searchResults.value = data.results.map(app => ({
          trackId: app.trackId,
          trackName: app.trackName,
          artistName: app.artistName,
          bundleId: app.bundleId,
          artworkUrl60: app.artworkUrl60,
          artworkUrl100: app.artworkUrl100,
          version: app.version,
          averageUserRating: app.averageUserRating,
          userRatingCount: app.userRatingCount
        }))
      } else {
        searchResults.value = []
      }
    } else {
      // Search by name or bundle ID
      const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&country=CN&media=software&limit=10`)
      const data = await response.json()
      
      if (data.results && data.results.length > 0) {
        searchResults.value = data.results.map(app => ({
          trackId: app.trackId,
          trackName: app.trackName,
          artistName: app.artistName,
          bundleId: app.bundleId,
          artworkUrl60: app.artworkUrl60,
          artworkUrl100: app.artworkUrl100,
          version: app.version,
          averageUserRating: app.averageUserRating,
          userRatingCount: app.userRatingCount
        }))
      } else {
        searchResults.value = []
      }
    }
  } catch (error) {
    console.error('Search error:', error)
    searchResults.value = []
  } finally {
    searching.value = false
  }
}, 500)

const selectApp = (app) => {
  emit('app-selected', app)
  searchQuery.value = ''
  searchResults.value = []
}
</script>
