<script setup lang="ts">
import {onMounted, ref, useTemplateRef, watch} from "vue";
import type {CollectionFile} from "@renderer/types";
import PlayerController from "@renderer/components/player/playerController";
import VideoPlayer from "@renderer/components/player/VideoPlayer.vue";

const videoComponent = useTemplateRef<HTMLVideoElement>("videoComponent");

const currentTime = ref(0);
const currentSlide = ref(0);

type CommandType = {
  type: "open",
  id: number,
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

const files = ref<Array<CollectionFile>>([]);
const filesMap = ref(new Map<number, CollectionFile>());
const videoPlayers = ref(new Map<number, PlayerController>());
const current = ref<number>();

onMounted(async () => {
  // const wjs = await import('wcjs-player');
  // console.log(wjs);
  window.electron.ipcRenderer.on("slide", (_, command: CommandType) => {
    console.log(command);
    if (command.type === "open") {
      current.value = command.id;
      // videoComponent.value?.pause();
      // src.value = "";
      // type.value = "";
      // setTimeout(() => {
      //   src.value = command.file;
      //   type.value = command.fileType;
      //   if (command.fileType === "video") {
      //     currentTime.value = command.timecode;
      //     setTimeout(async () => {
      //       console.log(videoComponent.value);
      //       if (videoComponent.value) videoComponent.value.currentTime = currentTime.value;
      //       if (command.play) videoComponent.value?.play();
      //     }, 0.1);
      //   }
      //   if (command.fileType === "pdf") {
      //     currentSlide.value = command.slide;
      //   }
      // }, 0.1);
      if (command.fileType === "pdf") {
        currentSlide.value = command.slide;
      }
    }
    if (command.type === "close") {
      // videoComponent.value?.pause();
      // src.value = "";
      // type.value = "";
      current.value = undefined;
    }
    if (command.type === "pause") {
      // videoComponent.value?.pause();
    }
    if (command.type === "resume") {
      // videoComponent.value?.play();
      videoPlayers.value.get(current.value ?? -1)?.play();
    }
    if (command.type === "seek") {
      // currentTime.value = command.timecode;
    }
    if (command.type === "pdfSlide") {
      currentSlide.value = command.slide;
    }
  });

  window.electron.ipcRenderer.on("collection", async (_, collection) => {
    files.value = collection.files;
    filesMap.value = new Map(files.value.map(file => ([file.id, file])));
    console.log(files.value.filter(file => file.type === "video"));
    videoPlayers.value = new Map(files.value.filter(file => file.type === "video").map(file => {
      let controller = new PlayerController();
      console.log(file.file.slice(7));
      controller.create(file.file.slice(7));
      return [file.id, controller];
    }));
  });
});

watch(currentTime, value => {
  if (videoComponent.value) videoComponent.value.currentTime = value;
});
</script>

<template>
  <div>
    <main ref="container">
      <template v-for="({id}) in files">
        <template v-show="id == current">
<!--          {{id}} {{filesMap.get(id)?.type}}-->
<!--        <video v-if="type === 'video'" ref="videoComponent" muted height="auto">-->
<!--          <source :src="src">-->
<!--        </video>-->
          <VideoPlayer :controller="videoPlayers.get(id)"/>
          <img v-if="filesMap.get(id)?.type === 'image'" :src="filesMap.get(id)?.file">
          <img v-if="filesMap.get(id)?.type === 'presentation'" :src="`${filesMap.get(id)?.file}/${currentSlide}.png`">
        </template>
      </template>
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