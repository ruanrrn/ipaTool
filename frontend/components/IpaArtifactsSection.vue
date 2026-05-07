<template>
  <div class="queue-panel">
    <IpaQueueEmptyState
      v-if="artifacts.length === 0"
      text="暂无已完成文件"
    />
    <div
      v-else
      class="queue-list queue-list--completed"
    >
      <IpaArtifactCard
        v-for="item in artifacts"
        :key="item.id"
        :item="item"
        @download="emit('download', $event)"
        @install="emit('install', $event)"
        @remove="emit('remove-artifact', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import IpaArtifactCard from './IpaArtifactCard.vue'
import IpaQueueEmptyState from './IpaQueueEmptyState.vue'

defineProps({
  artifacts: { type: Array, default: () => [] }
})

const emit = defineEmits(['download', 'install', 'remove-artifact'])
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

.queue-list--completed {
  padding-top: 8px;
}
</style>
