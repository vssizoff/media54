<script setup lang="ts">
import {onMounted, type PropType, ref} from "vue";
import PlayerController from "./playerController";

const props = defineProps({
  controller: {
    type: Object as PropType<PlayerController>,
    required: true
  }
});

const videoPlayer = ref<HTMLVideoElement>();

onMounted(() => {
  props.controller.init(videoPlayer.value);
});
</script>

<template>
  <video ref="videoPlayer"/>
</template>

<style scoped>

</style>