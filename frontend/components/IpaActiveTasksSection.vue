<template>
  <div class="queue-panel">
    <IpaQueueEmptyState
      v-if="tasks.length === 0"
      text="队列为空"
    />
    <div
      v-else
      class="queue-list"
    >
      <IpaActiveTaskCard
        v-for="task in tasks"
        :key="task.id"
        :task="task"
        :paused="pausedTaskIds.includes(task.id)"
        @toggle-pause="emit('toggle-pause', $event)"
        @remove="emit('remove-task', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import IpaActiveTaskCard from './IpaActiveTaskCard.vue'
import IpaQueueEmptyState from './IpaQueueEmptyState.vue'

defineProps({
  tasks: { type: Array, default: () => [] },
  pausedTaskIds: { type: Array, default: () => [] }
})

const emit = defineEmits(['toggle-pause', 'remove-task'])
</script>

<style scoped>
.queue-panel {
  display: flex;
  flex-direction: column;
}

.queue-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 8px;
}
</style>
