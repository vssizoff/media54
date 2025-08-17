<script setup lang="ts">
import {type PropType, ref, watch} from "vue";
import * as mm from "music-metadata";
import Player from "@renderer/components/players/Player.vue";

const props = defineProps({
  src: {
    type: String,
    required: true
  },
  meta: {
    type: Object as PropType<mm.ICommonTagsResult>,
    required: true
  },
  playing: Boolean
});

const emit = defineEmits<{
  (e: "update:playing", arg: boolean): void
  (e: "disableDrag"): void
}>();

const audioRef = ref<HTMLAudioElement | null>(null)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(1)

watch(props, value => {
  if (value.playing) audioRef.value?.play();
  else audioRef.value?.pause();
});

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
  }
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
    emit('update:playing', false);
    return;
  }
  volume.value = left / 1000 * volume0;
  setTimeout(() => fadeOutPause(left - 2, volume0), fadeTimeout);
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
        @fadeOut="fadeOut"
        @fadeOutPause="fadeOutPause"
    />
  </div>
</template>

<style scoped>

</style>