<template>
  <span
    class="svg-icon"
    aria-hidden="true"
    v-html="icon"
  />
</template>

<script setup>
defineProps({
  icon: {
    type: String,
    required: true
  }
})
</script>

<style scoped>
.svg-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 0;
}

.svg-icon :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
