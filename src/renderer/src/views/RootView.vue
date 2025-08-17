<script setup lang="ts">
import {onMounted, ref} from "vue";
import {Accordion, AccordionContent, AccordionHeader, AccordionPanel, Button, InputText} from "primevue";
import AudioPlayer from "@renderer/components/players/AudioPlayer.vue";
import addIcon from "@renderer/assets/add.svg";
import textIcon from "@renderer/assets/text.svg";
import type {MediaFile, UploadedFile} from "@renderer/types.js";
import * as mm from "music-metadata";
import VideoPlayer from "@renderer/components/players/VideoPlayer.vue";
import ImagePlayer from "@renderer/components/players/ImagePlayer.vue";
import blockIcon from "@renderer/assets/stop.svg";
import Slide from "@renderer/components/Slide.vue";

const displays = ref<Array<string>>([]);
const mediaFiles = ref<Array<MediaFile>>([]);
const openedFiles = ref<Array<number>>([]);
const openingMap = ref(new Map<number, Array<NodeJS.Timeout>>);
const dragItemIndex = ref<number | null>(null);
const isDraggingEnabled = ref<boolean>(true);
const openedSlide = ref<number>(-1);

onMounted(async () => {
  displays.value = (await window.electron.ipcRenderer.invoke("displays")).map(({label, isPrimary, id}) =>
      label || (isPrimary ? "Primary display" : `Display ${id}`));
});

function getTitle(filename: string, meta: mm.ICommonTagsResult | undefined): string {
  if (meta === undefined) return filename;
  return `${filename} ${meta?.artists?.join(", ") ?? meta?.artist ?? meta?.albumartist ?? "unknown"}: ${meta?.title ?? "unknown"}`;
}

async function addFile() {
  const files: Array<UploadedFile> = await window.electron.ipcRenderer.invoke("open");
  console.log(files);
  mediaFiles.value.push(...files.map(({type, file, path, filename, meta}) => {
    if (type === "audio" || type === "video") return {
      type, file, path, meta, filename, playing: false, editing: false,
      title: getTitle(filename, meta)
    };
    return {type, file, path, filename, playing: false, editing: false, title: filename};
  }));
}

function addLabel() {
  mediaFiles.value.push({
    type: "label",
    title: "label",
    file: "",
    path: "",
    filename: "",
    playing: false,
    editing: false,
    meta: undefined
  });
}

function openPresentation(index: number) {
  window.electron.ipcRenderer.invoke("presentation", index);
}

function open(index: number) {
  openingMap.value.set(index, [...(openingMap.value.get(index) ?? []), setTimeout(() => openedFiles.value.push(index), 0)]);
}

function close(index: number) {
  openingMap.value.get(index)?.forEach(timeout => clearTimeout(timeout));
  openingMap.value.delete(index);
  openedFiles.value = openedFiles.value.filter(i => i != index || mediaFiles.value[index].playing)
}

function handleDragStart(e: Event, index: number) {
  if (!isDraggingEnabled.value) {
    e.preventDefault()
    return
  }
  dragItemIndex.value = index
}

function handleDragOver(index: number) {
  if (!isDraggingEnabled.value || dragItemIndex.value === index || dragItemIndex.value === null) return;
  const draggedItem = mediaFiles.value[dragItemIndex.value];
  mediaFiles.value.splice(dragItemIndex.value, 1);
  mediaFiles.value.splice(index, 0, draggedItem);
  dragItemIndex.value = index
}

function handleDrop() {
  dragItemIndex.value = null
}

function disableDrag() {
  isDraggingEnabled.value = false
  setTimeout(() => {
    isDraggingEnabled.value = true
  }, 100)
}

function block() {
  openedSlide.value = -1;
  window.electron.ipcRenderer.invoke("slide", {type: "close"});
}
</script>

<template>
  <main>
    <div class="media">
      <div class="add">
        <Button @click="addFile"><img :src="addIcon"></Button>
        <Button @click="addLabel"><img :src="textIcon"></Button>
      </div>
      <Accordion class="tracks" v-model:value="openedFiles" multiple>
        <AccordionPanel
            v-for="({type, file, meta, title, editing}, index) in mediaFiles"
            :value="index"
            :key="file"
            draggable="true"
            @dragstart="handleDragStart($event, index)"
            @mouseenter="open(index)"
            @mouseleave="close(index)"
            @dragover.prevent="handleDragOver(index)"
            @drop="handleDrop"
            @dragenter.prevent
            @dragleave.prevent
            :class="{ 'dragging': dragItemIndex === index }"
        >
          <AccordionHeader>
            <span v-if="!editing" @click.prevent.stop="mediaFiles[index].editing = !editing">{{title}}</span>
            <template v-else>
              <InputText v-model="mediaFiles[index].title" class="titleInput"/>
              <Button @click.prevent.stop="mediaFiles[index].editing = !editing" class="save">Save</Button>
            </template>
          </AccordionHeader>
          <AccordionContent>
            <div class="players">
              <AudioPlayer
                  v-if="type === 'audio'"
                  draggable="false"
                  :src="file"
                  :meta="meta"
                  v-model:playing="mediaFiles[index].playing"
                  @disableDrag="disableDrag"
              />
              <VideoPlayer
                  v-if="type === 'video'"
                  draggable="false"
                  :src="file"
                  :meta="meta"
                  v-model:playing="mediaFiles[index].playing"
                  @disableDrag="disableDrag"
                  :opened="openedSlide === index"
                  @open="openedSlide = index"
              />
              <ImagePlayer
                  v-if="type === 'image'"
                  draggable="false"
                  :src="file"
                  v-model:playing="mediaFiles[index].playing"
                  @disableDrag="disableDrag"
                  :opened="openedSlide === index"
                  @open="openedSlide = index"
              />
            </div>
          </AccordionContent>
        </AccordionPanel>
      </Accordion>
    </div>
    <div class="controls">
      <Slide class="slide"/>
      <ul>
        <li v-for="(display, index) in displays"><Button @click="openPresentation(index)">{{display}}</Button></li>
      </ul>
      <div class="buttons">
        <Button><img :src="blockIcon" alt="block" @click="block"></Button>
      </div>
    </div>
  </main>
</template>

<style scoped>
main {
  padding: 10px;
  display: flex;
  height: 100%;

  .media {
    width: 70%;
    margin-right: 10px;

    .add {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-bottom: 10px;
    }

    .tracks {
      border-radius: 30px;
      overflow: hidden;
    }
  }
}

.dragging {
  opacity: 0.5;
  background-color: #f0f0f0;
}

.titleInput {
  width: 100%;
}

.save {
  margin: 10px;
}

.controls {
  display: flex;
  flex-direction: column;
  background-color: rgba(0,0,0,0.4);
  height: 100%;
  border-radius: 40px;
  padding: 10px;
  width: 30%;

  ul {
    margin: 20px 0;
    display: flex;
    flex-direction: column;
    padding-left: 0;
    gap: 10px;

    li button {
      width: 100%;
    }
  }
}

.slide {
  width: 100%;
  aspect-ratio: 16 / 9;
  background-color: black;
  border-radius: 30px;
  overflow: hidden;
}

.players {
  padding: 10px 20px 20px 20px;
}
</style>

<style>
:root {
  --p-accordion-content-padding: 0 !important;
}

.p-accordioncontent {
  transition-duration: .8s !important;
}

html, body {
  height: 100%;
  padding: 0;
  margin: 0;
}

#app {
  height: 100%;
}

body {
  background-image: url('../assets/wavy-lines.svg');
}
</style>