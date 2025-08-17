<script setup lang="ts">
import {onMounted, ref, useTemplateRef, watch} from "vue";

const videoComponent = useTemplateRef<HTMLVideoElement>("videoComponent");

const src = ref("");
const type = ref("");
const currentTime = ref(0);

type CommandType = {
  type: "open",
  file: string,
  fileType: "video" | "image",
  timecode: number
} | {
  type: "close" | "pause" | "resume"
} | {
  type: "seek",
  timecode: number
};

onMounted(() => {
  window.electron.ipcRenderer.on("slide", (_, command: CommandType) => {
    console.log(command);
    if (command.type === "open") {
      src.value = command.file;
      type.value = command.fileType;
      currentTime.value = command.timecode;
      setTimeout(() => {
        console.log(videoComponent.value);
        if (videoComponent.value) videoComponent.value.currentTime = currentTime.value;
        videoComponent.value?.play();
      }, 0.1);
    }
    if (command.type === "close") {
      videoComponent.value?.pause();
      src.value = "";
      type.value = "";
    }
    if (command.type === "pause") {
      videoComponent.value?.pause();
    }
    if (command.type === "resume") {
      videoComponent.value?.play();
    }
    if (command.type === "seek") {
      currentTime.value = command.timecode;
    }
  });
});

watch(currentTime, value => {
  if (videoComponent.value) videoComponent.value.currentTime = value;
});
</script>

<template>
  <main>
    <video v-if="type === 'video'" ref="videoComponent" muted>
      <source :src="src">
    </video>
  </main>
</template>

<style scoped>
video {
  width: 100vw;
  height: 100vh;
  object-fit: contain;
}
</style>

<style>
body {
  background-color: black;
}
</style>