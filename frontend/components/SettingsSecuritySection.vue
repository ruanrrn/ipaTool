<template>
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
      @click="emit('logout')"
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
</template>

<script setup>
const emit = defineEmits(['logout', 'navigate-to-changepassword'])
</script>
