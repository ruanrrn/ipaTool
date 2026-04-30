<template>
  <div class="section-head">
    <h3 class="section-head__title">
      {{ title }}
    </h3>
    <a
      href="javascript:void(0)"
      class="section-head__link"
      @click.prevent="$emit('link-click')"
    >{{ linkText }}</a>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: ''
  },
  linkText: {
    type: String,
    default: '查看全部'
  }
})

defineEmits(['link-click'])
</script>

<style scoped>
.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.section-head__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}
.dark .section-head__title {
  color: var(--color-text);
}
.section-head__link {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-primary);
  text-decoration: none;
  cursor: pointer;
}
.section-head__link:active {
  opacity: 0.7;
}
</style>
