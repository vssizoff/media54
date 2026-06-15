<script setup lang="ts">
import {onMounted, ref, useTemplateRef, watch} from "vue";

const videoComponent = useTemplateRef<HTMLVideoElement>("videoComponent");

const src = ref("");
const type = ref("");
const currentTime = ref(0);
const currentSlide = ref(0);

type CommandType = {
  type: "open",
  file: string,
  fileType: "video" | "image" | "pdf",
  timecode: number,
  play: boolean,
  slide: number
} | {
  type: "close" | "pause" | "resume"
} | {
  type: "seek",
  timecode: number
} | {
  type: "pdfSlide",
  slide: number
};

onMounted(async () => {
  // const wjs = await import('wcjs-player');
  // console.log(wjs);
  window.electron.ipcRenderer.on("slide", (_, command: CommandType) => {
    console.log(command);
    if (command.type === "open") {
      videoComponent.value?.pause();
      src.value = "";
      type.value = "";
      setTimeout(() => {
        src.value = command.file;
        type.value = command.fileType;
        if (command.fileType === "video") {
          currentTime.value = command.timecode;
          setTimeout(async () => {
            console.log(videoComponent.value);
            // const player = new wjs.default(videoComponent.value).addPlayer({
            //   autoplay: true,
            //   wcjs: await import("wcjs-prebuilt")
            // });
            if (videoComponent.value) videoComponent.value.currentTime = currentTime.value;
            if (command.play) videoComponent.value?.play();
          }, 0.1);
        }
        if (command.fileType === "pdf") {
          currentSlide.value = command.slide;
        }
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
    if (command.type === "pdfSlide") {
      currentSlide.value = command.slide;
    }
  });
});

watch(currentTime, value => {
  if (videoComponent.value) videoComponent.value.currentTime = value;
});
</script>

<template>
  <div>
    <main ref="container">
<!--      <video v-if="type === 'video'" ref="videoComponent" muted height="auto">-->
<!--        <source :src="src">-->
<!--      </video>-->
      <div v-if="type === 'video'" ref="videoComponent" class="player"/>
      <img v-if="type === 'image'" :src="src">
      <img v-if="type === 'pdf'" :src="`${src}/${currentSlide}.png`">
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
  object-fit: contain; /* масштабирует видео, сохраняя пропорции, обрезая лишнее */
  position: absolute;
  top: 0;
  left: 0;
}
</style>