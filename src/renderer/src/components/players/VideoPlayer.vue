<script setup lang="ts">
import {onMounted, ref, watch} from "vue";
import Player from "@renderer/components/players/Player.vue";

const props = defineProps({
  src: {
    type: String,
    required: true
  },
  playing: Boolean,
  opened: Boolean
});

const emit = defineEmits<{
  (e: "update:playing", arg: boolean): void
  (e: "disableDrag"): void
  (e: "open"): void
  (e: "close"): void
}>();

const audioRef = ref<HTMLAudioElement | null>(null)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(1)
const visible = ref(false);

watch(props, value => {
  visible.value = value.opened;
});

function updatePlaying(playing: boolean) {
  emit('update:playing', playing);
  if (playing) {
    emit("open");
    audioRef.value?.play();
    visible.value = true;
    if (props.opened) {
      window.electron.ipcRenderer.invoke("slide", {type: "resume"});
    }
    else {
      window.electron.ipcRenderer.invoke("slide", {
        type: "open",
        file: props.src,
        timecode: currentTime.value,
        fileType: "video",
        play: true
      });
    }
  }
  else {
    audioRef.value?.pause();
    if (props.opened) window.electron.ipcRenderer.invoke("slide", {type: "pause"});
  }
}

function updateVisible(visible_: boolean): void {
  visible.value = visible_;
  if (visible_) {
    if (!props.opened) {
      window.electron.ipcRenderer.invoke("slide", {
        type: "open",
        file: props.src,
        timecode: currentTime.value,
        fileType: "video",
        play: props.playing
      });
      console.log("open");
      emit("open");
    }
  }
  else {
    if (props.opened) window.electron.ipcRenderer.invoke("slide", {type: "close"});
    emit("close");
  }
}

function playAudio() {
  emit('update:playing', true);
  audioRef.value?.play();
  visible.value = true;
}

watch(volume, value => {
  if (audioRef.value) audioRef.value.volume = value;
});

function onTimeUpdate() {
  if (audioRef.value) currentTime.value = audioRef.value.currentTime
}

function onLoadedMetadata() {
  if (audioRef.value) duration.value = audioRef.value.duration
}

function seek(value: number) {
  if (audioRef.value) {
    audioRef.value.currentTime = value;
    if (props.opened) window.electron.ipcRenderer.invoke("slide", {
      type: "seek",
      timecode: value,
    });
  }
  if (preview.value) preview.value.currentTime = value;
}

const fadeTimeout = 1;

function fadeIn(left: number = 1000, volume0 = volume.value) {
  if (left <= 0) return;
  volume.value = (1000 - left) / 1000 * volume0;
  setTimeout(() => fadeIn(left - 2, volume0), fadeTimeout);
}

function fadeOut(left: number = 1000, volume0 = volume.value) {
  if (left <= 0) return;
  volume.value = left / 1000 * volume0;
  setTimeout(() => fadeOut(left - 2, volume0), fadeTimeout);
}

function fadeOutPause(left: number = 1000, volume0 = volume.value) {
  if (left <= 0) {
    volume.value = volume0;
    audioRef.value?.pause();
    updatePlaying(false);
    return;
  }
  volume.value = left / 1000 * volume0;
  setTimeout(() => fadeOutPause(left - 2, volume0), fadeTimeout);
}

const preview = ref<HTMLVideoElement | null>(null);

function revertPreview() {
  if (preview.value) preview.value.currentTime = 10;
}

onMounted(() => {
  setTimeout(() => {
    revertPreview();
  }, 0.1);
});
</script>

<template>
  <div class="audio-player">
    <audio
        v-if="props.src"
        ref="audioRef"
        :src="props.src"
        @timeupdate="onTimeUpdate"
        @loadedmetadata="onLoadedMetadata"
    />
    <div class="preview">
      <video muted ref="preview" @click="revertPreview">
        <source :src="src">
      </video>
    </div>
    <Player
        class="player"
        isVideo
        v-if="props.src"
        :playing="props.playing"
        @update:playing="updatePlaying($event)"
        @playAudio="playAudio"
        :visible="visible"
        @update:visible="updateVisible($event)"
        :currentTime="currentTime"
        @update:currentTime="seek"
        :duration="duration"
        v-model:volume="volume"
        @disableDrag="emit('disableDrag')"
        @fadeIn="audioRef?.play(); emit('update:playing', true); fadeIn()"
        @fadeOut="fadeOut"
        @fadeOutPause="fadeOutPause"
    />
  </div>
</template>

<style scoped>
div {
  display: flex;
  gap: 20px;
  justify-content: flex-end;
}

.preview {
  width: 10%;
  aspect-ratio: 16 / 9;
  border-radius: 10px;
  display: flex;
  justify-content: center;
  border: 1px solid white;
  overflow: hidden;

  video {
    height: 100%;
  }
}

.player {
  width: 90%;
}
</style>