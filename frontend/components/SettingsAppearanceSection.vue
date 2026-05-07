<template>
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
</template>

<script setup>
const emit = defineEmits(['navigate-to-appearance'])
</script>
