<template>
  <div class="account-chip">
    <span class="account-chip__dot" />
    <span class="account-chip__email">{{ email }}</span>
    <span
      v-if="region"
      class="account-chip__region"
    >{{ region }}</span>
    <span
      v-if="showArrow"
      class="account-chip__arrow"
    >
      <SvgIcon
        class="account-chip__arrow-icon"
        :icon="chevronDownIcon"
      />
    </span>
  </div>
</template>

<script setup>
import SvgIcon from './SvgIcon.vue'
import chevronDownIcon from '../assets/icons/chevron-down.svg?raw'

defineProps({
  email: {
    type: String,
    default: ''
  },
  region: {
    type: String,
    default: ''
  },
  showArrow: {
    type: Boolean,
    default: false
  }
})
</script>

<style scoped>
.account-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
  padding: 5px 10px;
  border-radius: 8px;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
}
.dark .account-chip {
  background: var(--color-surface-muted);
  border-color: var(--color-border);
}
.account-chip__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-primary);
  flex-shrink: 0;
}
.account-chip__email {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text);
}
.dark .account-chip__email {
  color: var(--color-text);
}
.account-chip__region {
  flex-shrink: 0;
  white-space: nowrap;
  font-size: 11px;
  color: var(--color-text-muted);
}
.dark .account-chip__region {
  color: var(--color-text-muted);
}
.account-chip__arrow {
  flex-shrink: 0;
  margin-left: auto;
  color: var(--color-text-tertiary);
  display: flex;
  align-items: center;
}
.account-chip__arrow-icon {
  width: 16px;
  height: 16px;
}
.dark .account-chip__arrow {
  color: var(--color-text-tertiary);
}
</style>
