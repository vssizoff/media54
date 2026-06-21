<script setup lang="ts">
import {onMounted, type PropType, ref} from "vue";

const props = defineProps({
  controller: {
    type: Object as PropType<{init: (el: HTMLVideoElement | undefined) => void}>,
    required: true
  }
});

const videoPlayer = ref<HTMLVideoElement>();

onMounted(() => {
  props.controller.init(videoPlayer.value);
});
</script>

<template>
  <video ref="videoPlayer" muted/>
</template>

<style scoped>

</style>