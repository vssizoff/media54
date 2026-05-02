<script setup lang="ts">
import playIcon from "@renderer/assets/show.svg";
import stopIcon from "@renderer/assets/stop.svg";
import arrowIcon from "@renderer/assets/play.svg"
import {Button, InputNumber} from "primevue";
import {ref, watch} from "vue";

const props = defineProps({
  src: {
    type: String,
    required: true
  },
  playing: Boolean,
  opened: Boolean,
  max: {
    type: Number,
    default: 1
  }
});

const slide = ref(1);

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
      fileType: "pdf",
      slide: slide.value
    });
  }
  else if (props.opened) {
    window.electron.ipcRenderer.invoke("slide", {type: "close"});
  }
}

watch(slide, () => {
  if (props.opened) {
    window.electron.ipcRenderer.invoke("slide", {
      type: "pdfSlide",
      slide: slide.value
    });
  }
});
</script>

<template>
  <div class="container">
    <span class="preview"><img :src="`${src}/${slide}.png`"></span>
    <div class="control">
      <Button @click="updatePlaying(!props.playing)"><img :src="!props.playing ? playIcon : stopIcon"></Button>
      <Button @click="slide <= 1 || slide--"><img style="transform: rotate(180deg)" :src="arrowIcon"></Button>
      <InputNumber v-model="slide" :min="1" :max="max"/>
      <Button @click="slide >= max || slide++"><img :src="arrowIcon"></Button>
    </div>
  </div>
</template>

<style scoped>
.control {
  display: flex;
  gap: 10px;
  align-items: flex-end;
}

.preview {
  width: 10%;
  aspect-ratio: 16 / 9;
  border-radius: 10px;
  display: flex;
  justify-content: center;
  border: 1px solid white;

  img {
    height: 100%;
  }
}

.container {
  display: flex;
  gap: 20px;
}
</style>