<template>
  <MobileDialog
    :model-value="modelValue"
    title="手动输入版本 ID"
    position="bottom"
    @update:model-value="handleVisibleChange"
  >
    <div class="manual-version-dialog">
      <p class="manual-version-dialog__desc">
        当历史版本列表中没有目标版本时，可直接输入 App Store 版本 ID。
      </p>
      <MobileInput
        v-model="localVersionId"
        placeholder="例如：1234567890"
        clearable
        inputmode="numeric"
        autocomplete="off"
        class="manual-version-dialog__input"
        @keyup.enter="submit"
      />
      <p class="manual-version-dialog__hint">
        输入后会添加到当前版本列表并自动选中。
      </p>
    </div>
    <template #footer>
      <div class="manual-version-dialog__footer">
        <MobileButton
          size="small"
          @click="close"
        >
          取消
        </MobileButton>
        <MobileButton
          type="primary"
          size="small"
          :disabled="!trimmedVersionId"
          @click="submit"
        >
          确认
        </MobileButton>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import MobileDialog from './MobileDialog.vue'
import MobileInput from './MobileInput.vue'
import MobileButton from './MobileButton.vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'submit'])

const localVersionId = ref('')
const trimmedVersionId = computed(() => String(localVersionId.value || '').trim())

const close = () => emit('update:modelValue', false)

const handleVisibleChange = (visible) => {
  emit('update:modelValue', visible)
}

const submit = () => {
  if (!trimmedVersionId.value) return
  emit('submit', trimmedVersionId.value)
  close()
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) localVersionId.value = ''
  }
)
</script>

<style scoped>
.manual-version-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.manual-version-dialog__desc,
.manual-version-dialog__hint {
  margin: 0;
  font-size: var(--font-size-caption);
  line-height: 1.5;
  color: var(--color-txt-secondary);
}

.manual-version-dialog__input {
  width: 100%;
}

.manual-version-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
