<script setup lang="ts">
import playIcon from "@renderer/assets/play.svg";
import stopIcon from "@renderer/assets/stop.svg";
import {Button} from "primevue";
import {watch} from "vue";

const props = defineProps({
  src: {
    type: String,
    required: true
  },
  playing: Boolean,
  opened: Boolean
});

watch(props, value => {
  if (!value.opened) emit("update:playing", false);
});

const emit = defineEmits<{
  (e: "update:playing", arg: boolean): void
  (e: "disableDrag"): void
  (e: "open"): void
}>();

function updatePlaying(playing: boolean) {
  emit('update:playing', playing);
  if (playing) {
    emit("open");
    window.electron.ipcRenderer.invoke("slide", {
      type: "open",
      file: props.src,
      fileType: "image"
    });
  }
  else if (props.opened) {
    window.electron.ipcRenderer.invoke("slide", {type: "close"});
  }
}
</script>

<template>
  <Button @click="updatePlaying(!props.playing)"><img :src="!props.playing ? playIcon : stopIcon"></Button>
</template>

<style scoped>
button {
  margin-top: 23px;
}
</style>