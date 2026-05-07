<template>
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
</template>

<script setup>
defineProps({
  appVersion: {
    type: String,
    required: true
  },
  buildId: {
    type: String,
    required: true
  }
})
</script>
