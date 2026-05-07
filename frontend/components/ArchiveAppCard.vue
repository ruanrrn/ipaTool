<template>
  <div
    class="fav-item"
    @click="emit('open', app)"
  >
    <AppArtwork
      :src="app.icon_url"
      :alt="app.name"
      :label="app.name"
      class="fav-item__icon"
    />
    <div class="fav-item__info">
      <div class="fav-item__name-row">
        <span class="fav-item__name">{{ app.name }}</span>
        <span
          v-if="selectedVersion"
          class="fav-item__ver"
        >v{{ selectedVersion }}</span>
        <span
          v-if="tag"
          class="fav-item__tag"
        >{{ tag }}</span>
      </div>
      <div class="fav-item__dev-row">
        <span v-if="app.artist_name">{{ app.artist_name }}</span>
        <span v-if="app.artist_name && app.bundle_id">&nbsp;·&nbsp;</span>
        <span v-if="app.bundle_id">{{ app.bundle_id }}</span>
      </div>
    </div>
    <div class="fav-item__actions">
      <button
        v-if="action === 'download'"
        class="fav-btn fav-btn--dl"
        :disabled="busy"
        title="下载"
        @click.stop="emit('download', app)"
      >
        <SvgIcon
          class="h-[15px] w-[15px]"
          :icon="downloadIcon"
        />
      </button>
      <button
        v-else-if="action === 'publish'"
        class="fav-btn fav-btn--publish"
        :disabled="busy"
        title="贡献到社区"
        @click.stop="emit('publish', app)"
      >
        ↑
      </button>
    </div>
  </div>
</template>

<script setup>
import AppArtwork from './AppArtwork.vue'
import SvgIcon from './SvgIcon.vue'
import downloadIcon from '../assets/icons/download.svg?raw'
import './ArchiveItemCard.css'

defineProps({
  app: { type: Object, required: true },
  selectedVersion: { type: String, default: '' },
  action: { type: String, default: 'download' },
  busy: { type: Boolean, default: false },
  tag: { type: String, default: '' }
})

const emit = defineEmits(['open', 'download', 'publish'])
</script>
