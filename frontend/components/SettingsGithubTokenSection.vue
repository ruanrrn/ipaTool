<template>
  <p class="section-label text-txt-secondary dark:text-txt-dark-secondary">
    GitHub 贡献
  </p>
  <div class="settings-card settings-card--github">
    <div class="settings-row settings-row--stacked">
      <div class="github-token__header">
        <div class="sr-left">
          <div class="sr-icon sr-icon--github">
            GH
          </div>
          <div class="sr-label">
            GitHub PAT
          </div>
        </div>
        <span
          class="github-token__status"
          :class="configured ? 'github-token__status--ok' : 'github-token__status--empty'"
        >
          {{ configured ? '已配置' : '未配置' }}
        </span>
      </div>
      <div class="github-token__desc">
        用于把本地下架候选提交到官方 ipa-archive 仓库。PAT 只保存在后端，前端不回显明文。
      </div>
      <div
        v-if="configured"
        class="github-token__meta"
      >
        <span v-if="maskedToken">{{ maskedToken }}</span>
        <span v-if="updatedAt">更新于 {{ updatedAt }}</span>
      </div>
      <input
        :value="modelValue"
        class="github-token__input"
        type="password"
        autocomplete="new-password"
        spellcheck="false"
        placeholder="粘贴 GitHub fine-grained PAT"
        @input="emit('update:modelValue', $event.target.value)"
      >
      <div class="github-token__actions">
        <button
          class="github-token__btn github-token__btn--primary"
          :disabled="saving || !modelValue.trim()"
          @click="emit('save')"
        >
          {{ saving ? '保存中…' : '保存 PAT' }}
        </button>
        <button
          v-if="configured"
          class="github-token__btn github-token__btn--danger"
          :disabled="deleting"
          @click="emit('delete')"
        >
          {{ deleting ? '删除中…' : '删除' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
const emit = defineEmits(['delete', 'save', 'update:modelValue'])

defineProps({
  configured: {
    type: Boolean,
    default: false
  },
  deleting: {
    type: Boolean,
    default: false
  },
  maskedToken: {
    type: String,
    default: ''
  },
  modelValue: {
    type: String,
    default: ''
  },
  saving: {
    type: Boolean,
    default: false
  },
  updatedAt: {
    type: String,
    default: ''
  }
})
</script>
