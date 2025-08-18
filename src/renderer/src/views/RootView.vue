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
  Badge
} from "primevue";
import AudioPlayer from "@renderer/components/players/AudioPlayer.vue";
import addIcon from "@renderer/assets/add.svg";
import textIcon from "@renderer/assets/text.svg";
import type {CollectionFile, MediaFile, UploadedFile} from "@renderer/types.js";
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
          mediaFiles.value = files.map(({...file}) => ({...file, playing: false, editing: false}));
        }
      }))
  );
}

async function saveCollection() {
  console.log(collectionTitle.value);
  collectionPath.value = await window.electron.ipcRenderer.invoke("saveCollection", JSON.stringify({
    title: collectionTitle.value,
    files: mediaFiles.value.map(({title, file, type}) => ({title, file, type}))
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

async function addFile() {
  const files: Array<UploadedFile> = await window.electron.ipcRenderer.invoke("open");
  console.log(files);
  mediaFiles.value.push(...files.map(({type, file, filename, meta}) => {
    return {type, file, playing: false, editing: false, title: getTitle(filename, meta)};
  }));
  await saveCollection();
}

async function addLabel() {
  mediaFiles.value.push({
    type: "label",
    title: "label",
    file: "",
    playing: false,
    editing: false
  });
  await saveCollection();
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
  saveCollection();
}

function disableDrag() {
  isDraggingEnabled.value = false
  setTimeout(() => {
    isDraggingEnabled.value = true
  }, 100)
}
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
          <Button @click="addFile"><img :src="addIcon"></Button>
          <Button @click="addLabel"><img :src="textIcon"></Button>
        </div>
      </header>
      <Accordion class="tracks" v-model:value="openedFiles" multiple>
        <AccordionPanel
            v-for="({type, file, title, editing}, index) in mediaFiles"
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
            <header class="trackHeader">
              <template v-if="!editing">
                <span v-if="type !== 'label'" @click.prevent.stop="mediaFiles[index].editing = !editing">{{title}}</span>
                <Badge v-else @click.prevent.stop="mediaFiles[index].editing = !editing" severity="contrast">
                  <span class="label">{{title}}</span>
                </Badge>
              </template>
              <template v-else>
                <InputText v-model="mediaFiles[index].title" class="titleInput"/>
                <Button @click.prevent.stop="mediaFiles[index].editing = !editing" class="save">Save</Button>
              </template>
              <Button severity="danger" @click.prevent.stop="confirmDeleteTrack($event, index)">Remove</Button>
            </header>
          </AccordionHeader>
          <AccordionContent>
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