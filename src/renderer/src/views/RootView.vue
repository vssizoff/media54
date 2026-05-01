<script setup lang="ts">
import {onMounted, ref} from "vue";
import {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionPanel,
  Button,
  InputText,
  Menu,
  useConfirm,
  Badge,
  ContextMenu
} from "primevue";
import AudioPlayer from "@renderer/components/players/AudioPlayer.vue";
import type {CollectionFile, MediaFile, UploadedFile} from "@renderer/types.js";
import * as mm from "music-metadata";
import VideoPlayer from "@renderer/components/players/VideoPlayer.vue";
import ImagePlayer from "@renderer/components/players/ImagePlayer.vue";
import blockIcon from "@renderer/assets/stop.svg";
import Slide from "@renderer/components/Slide.vue";
import PresentationPlayer from "@renderer/components/players/PresentationPlayer.vue";

import addIcon from "@renderer/assets/add.svg";
import textIcon from "@renderer/assets/text.svg";
import removeIcon from "@renderer/assets/remove.svg";
import dragIcon from "@renderer/assets/drag.svg";

import audioIcon from "@renderer/assets/audio.svg";
import videoIcon from "@renderer/assets/video.svg";
import imageIcon from "@renderer/assets/image.svg";
import presentationIcon from "@renderer/assets/presentation.svg";
import otherIcon from "@renderer/assets/other.svg";

const displays = ref<Array<string>>([]);
const mediaFiles = ref<Array<MediaFile>>([]);
const openedFiles = ref<Array<number>>([]);
const dragItemIndex = ref<number | null>(null);
const isDraggingEnabled = ref<boolean>(true);
const openedSlide = ref<number>(-1);
const collectionEditing = ref(false);
const collectionTitle = ref("New collection");
const collectionPath = ref("");
const menuItems = ref([
  {
    label: 'New',
    command() {
      window.electron.ipcRenderer.invoke("newCollection");
      collectionPath.value = "";
      collectionTitle.value = "New collection";
      block();
      mediaFiles.value = [];
    }
  }
]);

async function loadCollections() {
  menuItems.value.splice(1);
  menuItems.value.push(...(await window.electron.ipcRenderer.invoke("collections"))
      .map(([path, title]) => ({
        label: title,
        async command() {
          let {title, files}: {title: string, files: Array<CollectionFile>} = await window.electron.ipcRenderer.invoke("collection", path);
          collectionTitle.value = title;
          collectionPath.value = path;
          mediaFiles.value = files.map(({...file}, i) => ({...file, playing: false, editing: false, id: file.id ?? i}));
          openedFiles.value = mediaFiles.value.map(file => file.id);
        }
      }))
  );
}

async function saveCollection() {
  console.log(collectionTitle.value);
  collectionPath.value = await window.electron.ipcRenderer.invoke("saveCollection", JSON.stringify({
    title: collectionTitle.value,
    files: mediaFiles.value.map(({title, file, type, id, max}) => ({title, file, type, id, ...(max ? {max} : {})}))
  }));
  await loadCollections();
}

onMounted(async () => {
  displays.value = (await window.electron.ipcRenderer.invoke("displays")).map(({label, isPrimary, id}) =>
    label || (isPrimary ? "Primary display" : `Display ${id}`));
  await loadCollections();
});

function block() {
  openedSlide.value = -1;
  window.electron.ipcRenderer.invoke("slide", {type: "close"});
}

const confirm = useConfirm();
const confirmDelete = (event: MouseEvent) => {
  if (!event.currentTarget) return;
  confirm.require({
    // @ts-ignore
    target: event.currentTarget,
    message: 'Do you want to delete this collection? This action cannot be undone',
    rejectProps: {
      label: 'Cancel',
      severity: 'secondary',
      outlined: true
    },
    acceptProps: {
      label: 'Delete',
      severity: 'danger'
    },
    accept: async () => {
      await window.electron.ipcRenderer.invoke("deleteCollection", collectionPath.value);
      collectionPath.value = "";
      collectionTitle.value = "New collection";
      block();
      mediaFiles.value = [];
      await loadCollections();
    }
  });
};
const confirmDeleteTrack = (event: MouseEvent, index: number) => {
  if (!event.currentTarget) return;
  confirm.require({
    // @ts-ignore
    target: event.currentTarget,
    message: 'Do you want to delete this track? This action cannot be undone',
    rejectProps: {
      label: 'Cancel',
      severity: 'secondary',
      outlined: true
    },
    acceptProps: {
      label: 'Delete',
      severity: 'danger'
    },
    accept: async () => {
      if (openedSlide.value === index) block();
      mediaFiles.value.splice(index, 1);
      await saveCollection();
    }
  });
};

function getTitle(filename: string, meta: mm.ICommonTagsResult | undefined): string {
  if (meta === undefined) return filename;
  return `${filename} ${meta?.artists?.join(", ") ?? meta?.artist ?? meta?.albumartist ?? "unknown"}: ${meta?.title ?? "unknown"}`;
}

async function addFile(index: number = -1) {
  const files: Array<UploadedFile> = await window.electron.ipcRenderer.invoke("open");
  console.log(files);
  let maxIndex = Math.max(...mediaFiles.value.map(file => file.id), 0);
  console.log(maxIndex);
  mediaFiles.value.splice(index + 1, 0, ...files.map(({type, file, filename, meta, max}, i) => {
    openedFiles.value.push(maxIndex + i + 1);
    return {type, file, playing: false, editing: false, title: getTitle(filename, meta), id: maxIndex + i + 1, max};
  }));
  await saveCollection();
}

async function addLabel(index: number = -1) {
  let maxIndex = Math.max(...mediaFiles.value.map(file => file.id), 0);
  mediaFiles.value.splice(index + 1, 0, {
    type: "label",
    title: "label",
    file: "",
    playing: false,
    editing: false,
    id: maxIndex + 1
  });
  openedFiles.value.push(maxIndex + 1);
  await saveCollection();
}

function openPresentation(index: number) {
  window.electron.ipcRenderer.invoke("presentation", index);
}

function handleDragStart(e: Event, index: number) {
  setTimeout(() => {
    console.log(isDraggingEnabled.value);
    if (!isDraggingEnabled.value) {
      e.preventDefault()
      return
    }
    dragItemIndex.value = index
  }, 100);
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
  saveCollection();
}

function disableDrag() {
  isDraggingEnabled.value = false
  setTimeout(() => {
    isDraggingEnabled.value = true
  }, 100)
}

const contextMenu = ref();
const contextMenuIndex = ref<number>(0);
const contextMenuItems = ref([
  {
    label: "Add file below",
    img: addIcon,
    command() {
      addFile(contextMenuIndex.value);
    }
  },
  {
    label: "Add label below",
    img: textIcon,
    command() {
      addLabel(contextMenuIndex.value);
    }
  },
  {
    label: "Remove",
    img: removeIcon,
    command(event) {
      confirmDeleteTrack(event.originalEvent, contextMenuIndex.value);
    }
  }
]);
</script>

<template>
  <main>
    <Menu :model="menuItems"/>
    <div class="media">
      <header class="collection">
        <header class="collectionHeader">
          <template v-if="!collectionEditing">
            <span>{{collectionTitle}}</span>
            <Button @click="collectionEditing = !collectionEditing" class="save">Edit</Button>
            <Button severity="danger" @click="confirmDelete($event)" :disabled="collectionPath === ''">Remove</Button>
          </template>
          <template v-else>
            <InputText v-model="collectionTitle" class="titleInput"/>
            <Button @click="collectionEditing = !collectionEditing; saveCollection()" class="save">Save</Button>
          </template>
        </header>
        <div class="add">
          <Button @click="addFile()"><img :src="addIcon"></Button>
          <Button @click="addLabel()"><img :src="textIcon"></Button>
        </div>
      </header>
      <Accordion class="tracks" v-model:value="openedFiles" multiple>
        <AccordionPanel
            v-for="({type, file, title, editing, id, max}, index) in mediaFiles"
            :value="id"
            :key="id"
            @dragover.prevent="handleDragOver(index)"
            @drop="handleDrop"
            @dragenter.prevent
            @dragleave.prevent
            :class="{ 'dragging': dragItemIndex === index }"
            @contextmenu="contextMenuIndex = index; contextMenu.show($event)"
        >
          <AccordionHeader>
            <header class="trackHeader">
              <template v-if="!editing">
                <div v-if="type !== 'label'" @click.prevent.stop="mediaFiles[index].editing = !editing" class="title">
                  <img :src="dragIcon"
                       :draggable="isDraggingEnabled"
                       @dragstart="handleDragStart($event, index)">
                  <img :src="type === 'audio' ? audioIcon : type === 'image' ? imageIcon : type === 'video' ? videoIcon : type === 'presentation' ? presentationIcon : otherIcon"/>
                  <h4>{{title}}</h4>
                </div>
                <Badge v-else @click.prevent.stop="mediaFiles[index].editing = !editing" severity="contrast">
                  <span class="label">{{title}}</span>
                </Badge>
              </template>
              <template v-else>
                <InputText v-model="mediaFiles[index].title" class="titleInput"/>
                <Button @click.prevent.stop="mediaFiles[index].editing = !editing" class="save">Save</Button>
              </template>
            </header>
          </AccordionHeader>
          <AccordionContent
              class="trackContent"
              @dragstart.prevent.stop
              :draggable="false"
          >
            <div class="players" v-if="type != 'label' && type != 'other'">
              <AudioPlayer
                  v-if="type === 'audio'"
                  draggable="false"
                  :src="file"
                  v-model:playing="mediaFiles[index].playing"
                  @disableDrag="disableDrag"
              />
              <VideoPlayer
                  v-if="type === 'video'"
                  draggable="false"
                  :src="file"
                  v-model:playing="mediaFiles[index].playing"
                  @disableDrag="disableDrag"
                  :opened="openedSlide === index"
                  @open="openedSlide = index"
                  @close="openedSlide = -1"
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
              <PresentationPlayer
                  v-if="type === 'presentation'"
                  draggable="false"
                  :src="file"
                  v-model:playing="mediaFiles[index].playing"
                  @disableDrag="disableDrag"
                  :opened="openedSlide === index"
                  @open="openedSlide = index"
                  :max="max"
              />
            </div>
          </AccordionContent>
        </AccordionPanel>
      </Accordion>
      <ContextMenu ref="contextMenu" :model="contextMenuItems">
        <template #item="{ item }">
          <span class="contextMenuEntry">
            <img :src="item.img" style="filter: invert(1)">
            <span>{{item.label}}</span>
          </span>
        </template>
      </ContextMenu>
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
    margin: 0 10px;

    .collection {
      margin-bottom: 10px;
      display: flex;
      flex-direction: row;
      justify-content: space-between;

      .add, .collectionHeader  {
        display: flex;
        gap: 10px;
        align-items: center;
      }
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

.trackHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  margin-right: 10px;
}

.label {
  font-size: 16px;
}

.trackContent {
  position: relative;
}

.floatAdd {
  position: absolute;
  bottom: -10px;
  right: 10px;
  display: flex;
  gap: 10px;
  align-items: center;
  opacity: 0;
  transition: opacity 0.3s;
  width: 100%;
  justify-content: flex-end;

  &:hover {
    opacity: 1;
  }
}

.title {
  display: flex;
  gap: 10px;
}

.contextMenuEntry {
  display: flex;
  gap: 10px;
  cursor: pointer;
}
</style>

<style>
:root {
  --p-accordion-content-padding: 0 !important;
}

.p-accordioncontent {
  transition-duration: .8s !important;
}

.p-accordionheader {
  padding: 5px 10px 0 10px !important;
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