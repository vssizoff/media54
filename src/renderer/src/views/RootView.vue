<script setup lang="ts">
import {onMounted, ref} from "vue";
import {Accordion, AccordionContent, AccordionHeader, AccordionPanel, Button, InputText} from "primevue";
import AudioPlayer from "@renderer/components/AudioPlayer.vue";
import addIcon from "@renderer/assets/add.svg";
import * as mm from "music-metadata";

const displays = ref<Array<string>>([]);
const mediaFiles = ref<Array<{
  file: string,
  meta: mm.ICommonTagsResult,
  playing: boolean,
  title: string,
  editing: boolean
}>>([]);
const openedFiles = ref<Array<number>>([]);
const openingMap = ref(new Map<number, Array<NodeJS.Timeout>>);
const dragItemIndex = ref<number | null>(null);
const isDraggingEnabled = ref<boolean>(false);

onMounted(async () => {
  displays.value = (await window.electron.ipcRenderer.invoke("displays")).map(({label}) => label);
});

async function addFile() {
  const files = await window.electron.ipcRenderer.invoke("open");
  console.log(files);
  mediaFiles.value.push(...files.map(({file, meta, filename}: {file: string, meta: mm.ICommonTagsResult, filename: string}) => ({
    file, meta, playing: false, editing: false,
    title: `${filename} ${meta.artists?.join(", ") ?? meta.artist ?? meta.albumartist}: ${meta.title}`
  })));
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
</script>

<template>
  <main>
    <div class="media">
      <Button @click="addFile"><img :src="addIcon"></Button>
      <Accordion v-model:value="openedFiles" multiple>
        <AccordionPanel
            v-for="({file, meta, title, editing}, index) in mediaFiles"
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
            <AudioPlayer
                draggable="false"
                :src="file"
                :meta="meta"
                v-model:playing="mediaFiles[index].playing"
                @disableDrag="disableDrag"
            />
          </AccordionContent>
        </AccordionPanel>
      </Accordion>
    </div>
    <div class="controls">
      <ol>
        <li v-for="(display, index) in displays"><Button @click="openPresentation(index)">{{display}}</Button></li>
      </ol>
    </div>
  </main>
</template>

<style scoped>
main {
  margin: 20px;
  display: flex;

  .media {
    width: 80%;
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
</style>