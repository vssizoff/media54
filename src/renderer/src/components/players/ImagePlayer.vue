<script setup lang="ts">
import playIcon from "@renderer/assets/play.svg";
import stopIcon from "@renderer/assets/stop.svg";
import {Button} from "primevue";

const props = defineProps({
  src: {
    type: String,
    required: true
  },
  playing: Boolean,
  opened: Boolean
});

const emit = defineEmits<{
  (e: "update:playing", arg: boolean): void
  (e: "disableDrag"): void
  (e: "open"): void
}>();

function updatePlaying(playing: boolean) {
  emit('update:playing', playing);
  if (playing) {
    window.electron.ipcRenderer.invoke("slide", {
      type: "open",
      file: props.src,
      fileType: "image"
    });
    console.log("open");
    emit("open");
  }
  else {
    window.electron.ipcRenderer.invoke("slide", {type: "close"});
  }
}
</script>

<template>
  <Button @click="updatePlaying(!props.playing)"><img :src="!props.playing ? playIcon : stopIcon"></Button>
</template>

<style scoped>

</style>