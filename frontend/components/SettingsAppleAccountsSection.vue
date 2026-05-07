<template>
  <p class="section-label text-txt-secondary dark:text-txt-dark-secondary">
    Apple ID 账号
  </p>
  <div class="settings-card">
    <div
      v-for="(account, index) in accounts"
      :key="getAccountKey(account, index)"
      class="settings-row settings-row--account"
    >
      <div class="sr-left">
        <div class="sr-icon sr-icon--apple">
          🍎
        </div>
        <div class="sr-label">
          {{ account.email }}
          <span
            v-if="account.lastRefreshedAt != null"
            class="sr-freshness"
            :class="getFreshnessClass(account.lastRefreshedAt)"
          >
            {{ getFreshnessLabel(account.lastRefreshedAt) }}
          </span>
        </div>
      </div>
      <div class="sr-right">
        <span>{{ getRegionLabel(account.region || 'US') }}</span>
        <button
          class="sr-btn sr-btn--refresh"
          :disabled="refreshingToken === account.token"
          @click.stop="emit('refresh-account', account)"
        >
          <span
            v-if="refreshingToken === account.token"
            class="sr-btn__spinner"
          />
          <span v-else>↻</span>
        </button>
        <button
          class="sr-btn sr-btn--delete"
          @click.stop="emit('delete-account', account)"
        >
          ✕
        </button>
      </div>
    </div>

    <button
      class="settings-row settings-row--interactive"
      @click="emit('navigate-to-account')"
    >
      <div class="sr-left">
        <div class="sr-icon sr-icon--add">
          +
        </div>
        <div class="sr-label sr-label--brand">
          添加账号
        </div>
      </div>
      <div class="sr-right">
        <span class="sr-arrow">›</span>
      </div>
    </button>
  </div>
</template>

<script setup>
const emit = defineEmits(['delete-account', 'navigate-to-account', 'refresh-account'])

defineProps({
  accounts: {
    type: Array,
    default: () => []
  },
  getAccountKey: {
    type: Function,
    required: true
  },
  getFreshnessClass: {
    type: Function,
    required: true
  },
  getFreshnessLabel: {
    type: Function,
    required: true
  },
  getRegionLabel: {
    type: Function,
    required: true
  },
  refreshingToken: {
    type: [String, Number, null],
    default: null
  }
})
</script>
