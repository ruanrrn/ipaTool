<template>
  <!-- 移动端角标组件：图标的数字角标（如 tab 上的未读数） -->
  <span class="mobile-badge">
    <slot />
    <sup
      v-if="!hidden && (content !== '' && content !== undefined && content !== null)"
      :class="[
        'mobile-badge__content',
        `mobile-badge__content--${type}`,
        { 'mobile-badge__content--dot': isDot }
      ]"
    >
      <template v-if="!isDot">
        <slot name="content">
          {{ displayValue }}
        </slot>
      </template>
    </sup>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: {
    type: [String, Number],
    default: ''
  },
  max: {
    type: Number,
    default: 99
  },
  hidden: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    default: 'danger',
    validator: (value) => ['primary', 'danger'].includes(value)
  },
  isDot: {
    type: Boolean,
    default: false
  }
})

const content = computed(() => {
  if (props.isDot) return true
  return props.value
})

const displayValue = computed(() => {
  const val = props.value
  if (typeof val === 'number' && typeof props.max === 'number') {
    return val > props.max ? `${props.max}+` : val
  }
  return val
})
</script>

<style scoped>
.mobile-badge {
  position: relative;
  display: inline-flex;
  vertical-align: middle;
  -webkit-tap-highlight-color: transparent;
}

.mobile-badge__content {
  position: absolute;
  top: 0;
  right: 0;
  transform: translateY(-50%) translateX(50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 18px;
  min-width: 18px;
  padding: 0 var(--space-1);
  border-radius: var(--radius-full);
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  font-weight: 600;
  line-height: 1;
  color: var(--text-inverse);
  white-space: nowrap;
  z-index: 1;
  transition: var(--transition-default);
}

/* 小圆点模式 */
.mobile-badge__content--dot {
  width: 8px;
  height: 8px;
  min-width: 8px;
  padding: 0;
  right: 2px;
  top: 2px;
  transform: none;
}

/* 类型变体 */
.mobile-badge__content--danger {
  background: var(--accent-red);
}

.mobile-badge__content--primary {
  background: var(--accent-blue);
}

/* 深色模式 */
.dark .mobile-badge__content--danger {
  background: var(--accent-red);
}

.dark .mobile-badge__content--primary {
  background: var(--accent-blue);
}

/* 高对比度模式 */
@media (prefers-contrast: high) {
  .mobile-badge__content {
    border: 2px solid var(--text-inverse);
    font-weight: 700;
  }
}

/* 减少动画 */
@media (prefers-reduced-motion: reduce) {
  .mobile-badge__content {
    transition: none;
  }
}
</style>
