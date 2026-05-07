<template>
  <div class="queue-empty">
    <EmptyState
      type="empty"
      :text="text"
    />
  </div>
</template>

<script setup>
import EmptyState from './EmptyState.vue'

defineProps({
  text: { type: String, required: true }
})
</script>

<style scoped>
/* Queue empty state */
.queue-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 220px;
  padding: 8px 0 16px;
}

/* Dark mode for empty state background (inherits from page, no extra needed) */
</style>
