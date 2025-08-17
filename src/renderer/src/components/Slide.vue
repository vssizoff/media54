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
      if (command.fileType === "video") {
        currentTime.value = command.timecode;
        setTimeout(() => {
          console.log(videoComponent.value);
          if (videoComponent.value) videoComponent.value.currentTime = currentTime.value;
          videoComponent.value?.play();
        }, 0.1);
      }
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
  <div>
    <main>
      <video v-if="type === 'video'" ref="videoComponent" muted>
        <source :src="src">
      </video>
      <img v-if="type === 'image'" :src="src">
    </main>
  </div>
</template>

<style scoped>
main {
  width: 100%; /* или нужная ширина родителя */
  height: 100%; /* или нужная высота родителя */
  overflow: hidden; /* скрывает части видео, выходящие за границы */
  position: relative; /* для правильного позиционирования видео */
}

video, img {
  width: 100%;
  height: 100%;
  object-fit: scale-down; /* масштабирует видео, сохраняя пропорции, обрезая лишнее */
  position: absolute;
  top: 0;
  left: 0;
}
</style>