<template>
  <div
    class="fav-item"
    @click="emit('open', item._ref)"
  >
    <AppArtwork
      :src="item.icon_url"
      :alt="item.name"
      :label="item.name"
      class="fav-item__icon"
    />
    <div class="fav-item__info">
      <div class="fav-item__name-row">
        <span class="fav-item__name">{{ item.name }}</span>
        <span
          v-if="item.version"
          class="fav-item__ver"
        >v{{ item.version }}</span>
      </div>
      <div class="fav-item__dev-row">
        <span v-if="item.artist_name">{{ item.artist_name }}</span>
        <span v-if="item.artist_name && item.region_label">&nbsp;·&nbsp;</span>
        <span v-if="item.region_label">{{ item.region_label }}</span>
      </div>
      <div
        v-if="item.description"
        class="fav-item__note"
      >
        {{ item.description }}
      </div>
    </div>
    <div class="fav-item__actions">
      <button
        class="fav-btn fav-btn--dl"
        :disabled="downloading"
        title="下载"
        @click.stop="emit('download', item)"
      >
        <SvgIcon
          class="h-[15px] w-[15px]"
          :icon="downloadIcon"
        />
      </button>
      <button
        class="fav-btn fav-btn--unfav"
        title="取消收藏"
        @click.stop="emit('remove', item)"
      >
        <SvgIcon
          class="h-[15px] w-[15px]"
          :icon="starFilledIcon"
        />
      </button>
    </div>
  </div>
</template>

<script setup>
import AppArtwork from './AppArtwork.vue'
import SvgIcon from './SvgIcon.vue'
import downloadIcon from '../assets/icons/download.svg?raw'
import starFilledIcon from '../assets/icons/star-filled.svg?raw'
import './ArchiveItemCard.css'

defineProps({
  item: { type: Object, required: true },
  downloading: { type: Boolean, default: false }
})

const emit = defineEmits(['open', 'download', 'remove'])
</script>
