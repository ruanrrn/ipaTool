<template>
  <!-- 移动端优化的卡片组件 -->
  <div
    :class="[
      'mobile-card',
      `mobile-card--${variant}`,
      {
        'is-clickable': clickable,
        'is-bordered': bordered,
        'is-elevated': elevated,
        'is-full-width': fullWidth
      }
    ]"
    @click="handleClick"
  >
    <!-- 卡片头部 -->
    <div
      v-if="$slots.header"
      class="mobile-card__header"
    >
      <slot name="header" />
    </div>

    <!-- 卡片主体 -->
    <div class="mobile-card__body">
      <slot />
    </div>

    <!-- 卡片底部 -->
    <div
      v-if="$slots.footer"
      class="mobile-card__footer"
    >
      <slot name="footer" />
    </div>

    <!-- 点击时的触摸反馈层 -->
    <div
      v-if="clickable"
      class="mobile-card__ripple"
    />
  </div>
</template>

<script setup>
const props = defineProps({
  variant: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'primary', 'success', 'warning', 'danger'].includes(value)
  },
  clickable: {
    type: Boolean,
    default: false
  },
  bordered: {
    type: Boolean,
    default: true
  },
  elevated: {
    type: Boolean,
    default: false
  },
  fullWidth: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['click'])

const handleClick = (e) => {
  if (props.clickable) {
    emit('click', e)
  }
}
</script>

<style scoped>
.mobile-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--card-bg);
  border-radius: var(--radius-card);
  overflow: hidden;
  transition: all 0.2s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

/* 尺寸 */
.mobile-card.is-full-width {
  width: 100%;
}

/* 边框 */
.mobile-card.is-bordered {
  border: 1px solid var(--separator);
}

/* 阴影 */
.mobile-card.is-elevated {
  box-shadow: var(--shadow-elevated-hover);
}

/* 可点击 */
.mobile-card.is-clickable {
  cursor: pointer;
  min-height: 48px;
  min-width: 48px;
}

/* 变体 */
.mobile-card--default {
  /* 默认样式 */
}

.mobile-card--primary {
  background: rgba(10, 132, 255, 0.05);
  border-color: rgba(10, 132, 255, 0.2);
}

.mobile-card--success {
  background: rgba(34, 197, 94, 0.05);
  border-color: rgba(34, 197, 94, 0.2);
}

.mobile-card--warning {
  background: rgba(245, 158, 11, 0.05);
  border-color: rgba(245, 158, 11, 0.2);
}

.mobile-card--danger {
  background: rgba(239, 68, 68, 0.05);
  border-color: rgba(239, 68, 68, 0.2);
}

/* 悬停效果（仅桌面） */
@media (hover: hover) and (pointer: fine) {
  .mobile-card.is-clickable:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-elevated-hover);
  }

  .mobile-card--primary.is-clickable:hover {
    background: rgba(10, 132, 255, 0.08);
  }

  .mobile-card--success.is-clickable:hover {
    background: rgba(34, 197, 94, 0.08);
  }

  .mobile-card--warning.is-clickable:hover {
    background: rgba(245, 158, 11, 0.08);
  }

  .mobile-card--danger.is-clickable:hover {
    background: rgba(239, 68, 68, 0.08);
  }
}

/* 触摸反馈（移动端） */
@media (hover: none) and (pointer: coarse) {
  .mobile-card.is-clickable:active {
    transform: scale(0.98);
  }
}

/* 内容区域 */
.mobile-card__header {
  padding: var(--space-4);
  border-bottom: 1px solid var(--separator);
  background: rgba(0, 0, 0, 0.02);
}

.mobile-card__body {
  padding: var(--space-4);
  flex: 1;
}

.mobile-card__footer {
  padding: var(--space-4);
  border-top: 1px solid var(--separator);
  background: rgba(0, 0, 0, 0.02);
}

/* 涟漪效果 */
.mobile-card__ripple {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(10, 132, 255, 0.1);
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

@media (hover: none) and (pointer: coarse) {
  .mobile-card.is-clickable:active .mobile-card__ripple {
    opacity: 1;
  }
}

/* 深色模式 */
.dark .mobile-card__header,
.dark .mobile-card__footer {
  background: rgba(255, 255, 255, 0.02);
  border-color: rgba(255, 255, 255, 0.05);
}

.dark .mobile-card--primary {
  background: rgba(10, 132, 255, 0.1);
  border-color: rgba(10, 132, 255, 0.3);
}

.dark .mobile-card--success {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.3);
}

.dark .mobile-card--warning {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.3);
}

.dark .mobile-card--danger {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
}

.dark .mobile-card__ripple {
  background: rgba(52, 211, 153, 0.1);
}

/* 高对比度模式 */
@media (prefers-contrast: high) {
  .mobile-card.is-bordered {
    border-width: 2px;
  }

  .mobile-card__header,
  .mobile-card__footer {
    border-width: 2px;
  }
}

/* 减少动画 */
@media (prefers-reduced-motion: reduce) {
  .mobile-card,
  .mobile-card__ripple {
    transition: none;
  }

  .mobile-card.is-clickable:active {
    transform: none;
  }

  .mobile-card.is-clickable:hover {
    transform: none;
  }
}

/* 响应式 */
@media (max-width: 767px) {
  .mobile-card__header,
  .mobile-card__body,
  .mobile-card__footer {
    padding: var(--space-3);
  }
}
</style>
