<template>
  <div class="page">
    <vlc-video
        height="360"
        width="100%"
        controls
        :src="src"
    />
  </div>
</template>

<script setup lang="ts">
import VlcVideo from "@renderer/vlc-video/VlcVideo.vue"

const src = 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
</script>

<script lang="ts">
export default {
  components: {
    VlcVideo
  }
}
</script>

<style scoped>
.page {
  width: 100%;
  padding: 16px;
}
</style>