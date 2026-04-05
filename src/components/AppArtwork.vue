<template>
  <div class="app-artwork bg-[var(--card-bg)] rounded-[var(--radius-artwork)]">
    <img
      v-if="imageSrc && !imageFailed"
      :src="imageSrc"
      :alt="altText"
      class="app-artwork-image"
      @error="imageFailed = true"
    >
    <div
      v-else
      class="app-artwork-fallback"
    >
      {{ fallbackText }}
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
 src: {
 type: String,
 default: ''
 },
 alt: {
 type: String,
 default: ''
 },
 label: {
 type: String,
 default: ''
 }
})

const imageFailed = ref(false)

watch(() => props.src, () => {
 imageFailed.value = false
})

const imageSrc = computed(() => props.src?.trim() || '')
const altText = computed(() => props.alt?.trim() || props.label?.trim() || 'App artwork')
const fallbackText = computed(() => {
 const text = props.label?.trim() || props.alt?.trim() || '?'
 return text.slice(0, 1).toUpperCase()
})
</script>

<style scoped>
.app-artwork {
 width: var(--size-artwork-md);
 height: var(--size-artwork-md);
 flex-shrink: 0;
 overflow: hidden;
 border-radius: var(--radius-artwork);
 border: var(--border-width-thin) solid var(--separator);
 background: var(--card-bg);
}

.app-artwork-image,
.app-artwork-fallback {
 width: 100%;
 height: 100%;
}

.app-artwork-image {
 display: block;
 object-fit: cover;
}

.app-artwork-fallback {
 display: flex;
 align-items: center;
 justify-content: center;
 color: var(--accent-blue);
 font-size: var(--font-size-2xl);
 font-weight: 600;
}
</style>

