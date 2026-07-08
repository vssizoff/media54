<script setup lang="ts">
import {onMounted, type PropType, ref, watch} from "vue";

const props = defineProps({
  controller: {
    type: Object as PropType<{init: (el: HTMLVideoElement | undefined) => void} | undefined>,
    required: true
  }
});

const videoPlayer = ref<HTMLVideoElement>();

onMounted(() => {
  if (props.controller) props.controller.init(videoPlayer.value);
});

watch(() => props.controller, () => {
  if (props.controller) props.controller.init(videoPlayer.value);
});
</script>

<template>
  <video ref="videoPlayer" muted/>
</template>

<style scoped>

</style>