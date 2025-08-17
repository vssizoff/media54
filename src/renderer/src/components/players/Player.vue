<script setup lang="ts">
import {Button, Slider, Popover} from "primevue";

import playIcon from "@renderer/assets/play.svg";
import pauseIcon from "@renderer/assets/pause.svg";
import fadeInIcon from "@renderer/assets/fadeIn.svg";
import fadeOutIcon from "@renderer/assets/fadeOut.svg";
// import fadeOutPauseIcon from "@renderer/assets/fadeOutPause.svg";
import volumeIcon from "@renderer/assets/volume.svg";
import {useTemplateRef} from "vue";

const props = defineProps({
  playing: Boolean,
  currentTime: {
    type: Number,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  volume: {
    type: Number,
    default: 1
  }
});

const emit = defineEmits<{
  (e: "update:playing", arg: boolean): void
  (e: "update:currentTime", arg: number): void
  (e: "update:volume", arg: number): void
  (e: "disableDrag"): void
  (e: "fadeIn"): void
  (e: "fadeOut"): void
  (e: "fadeOutPause"): void
}>();

const volumePopover = useTemplateRef("volumePopover");

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0')
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${mins}:${secs}`
}
</script>

<template>
  <div class="player">
    <Slider
        :modelValue="props.currentTime"
        @update:modelValue="time => emit('update:currentTime', Array.isArray(time) ? time[0] : time)"
        :max="props.duration"
        @mousedown.stop="emit('disableDrag')"
        @touchstart.stop="emit('disableDrag')"
    />
    <div class="playerMain">
      <div class="controls">
        <Button @click="emit('update:playing', !props.playing)"><img :src="!props.playing ? playIcon : pauseIcon"></Button>
        <Button @click="emit('fadeIn')"><img :src="fadeInIcon"></Button>
        <Button @click="emit('fadeOut')"><img :src="fadeOutIcon"></Button>
        <Button @click="emit('fadeOutPause')"><img :src="fadeOutIcon"><img :src="pauseIcon"></Button>
        <Button @click="volumePopover?.toggle"><img :src="volumeIcon"></Button>
        <Popover ref="volumePopover">
          <Slider
              class="slider"
              :modelValue="volume"
              @update:modelValue="value => emit('update:volume', Array.isArray(value) ? value[0] : value)"
              :min="0" :max="1" :step="0.01"
              @mousedown.stop="emit('disableDrag')"
              @touchstart.stop="emit('disableDrag')"
          />
        </Popover>
      </div>
      <span>{{formatTime(props.currentTime) }} / {{ formatTime(duration)}}</span>
    </div>
  </div>
</template>

<style scoped>
.player {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 0;

  .playerMain {
    display: flex;
    justify-content: space-between;

    .controls {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 80%;
    }
  }
}

.slider {
  width: 400px;
}
</style>