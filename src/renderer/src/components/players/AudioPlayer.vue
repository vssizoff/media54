<script setup lang="ts">
import {ref, watch} from "vue";
import Player from "@renderer/components/players/Player.vue";

const props = defineProps({
  src: {
    type: String,
    required: true
  },
  playing: Boolean,
  volume: Number
});

const emit = defineEmits<{
  (e: "update:playing", arg: boolean): void
  (e: "update:volume", arg: number): void
  (e: "disableDrag"): void
}>();

const audioRef = ref<HTMLAudioElement | null>(null)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(props.volume ?? 1)

watch(props, value => {
  if (value.playing) audioRef.value?.play();
  else audioRef.value?.pause();
});

watch(volume, value => {
  if (audioRef.value) audioRef.value.volume = value;
  emit("update:volume", value);
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
  }
}

const fadeTimeout = 1;

function fadeIn(left: number = 1000) {
  if (left <= 0) return;
  if (audioRef.value) audioRef.value.volume = (1000 - left) / 1000 * volume.value;
  setTimeout(() => fadeIn(left - 2), fadeTimeout);
}

function fadeOutPause(left: number = 1000) {
  if (left <= 0) {
    audioRef.value?.pause();
    emit('update:playing', false);
    return;
  }
  if (audioRef.value) audioRef.value.volume = left / 1000 * volume.value;
  setTimeout(() => fadeOutPause(left - 2), fadeTimeout);
}
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
    <Player
        v-if="props.src"
        :playing="props.playing"
        @update:playing="emit('update:playing', $event)"
        :currentTime="currentTime"
        @update:currentTime="seek"
        :duration="duration"
        v-model:volume="volume"
        @disableDrag="emit('disableDrag')"
        @fadeIn="audioRef?.play(); emit('update:playing', true); fadeIn()"
        @fadeOutPause="fadeOutPause"
    />
  </div>
</template>

<style scoped>

</style>