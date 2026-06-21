<template>
  <div class="player-container">
    <div class="video-wrapper">
      <VideoPlayer class="video-element" :controller="controller"/>
      <div v-if="controller?.isLoading" class="loading-overlay">Буферизация...</div>
    </div>

    <div class="controls">
      <button @click="togglePlay" :disabled="!controller?.isReady">
        {{ controller?.isPlaying ? '⏸' : '▶' }}
      </button>
<!--      <button @click="stop" :disabled="!isReady">⏹</button>-->

      <input
          type="range"
          :value="controller?.currentTime"
          :max="controller?.duration ?? 0"
          step="0.1"
          :disabled="!controller?.isReady"
          @input="onSeekInput"
          @change="onSeekChange"
          class="seek-bar"
      />

      <span class="time-display">
        {{ formatTime(controller?.currentTime) }} / {{ formatTime(controller?.duration) }}
      </span>

      <button @click="toggleMute">
        {{ isMuted ? '🔇' : '🔊' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {onMounted, onUnmounted, ref, watch} from 'vue';
import PlayerController from "@renderer/components/player/playerController";
import VideoPlayer from "@renderer/components/player/VideoPlayer.vue";

const props = defineProps({
  filePath: {
    type: String,
    required: true
  },
  title: {
    type: String,
    default: ''
  }
});

const videoPlayer = ref<HTMLVideoElement>();
const isMuted = ref(false);
const controller = ref<PlayerController>(new PlayerController());

onMounted(async () => {
  await controller.value.create(props.filePath);
});

function togglePlay() {
  controller.value.toggle();
}

function onSeekInput() {
  controller.value.seekInput()
}

async function onSeekChange(event) {
  await controller.value.seekChange(Number(event.target.value));
}

function toggleMute() {
  if (!videoPlayer.value) return;
  videoPlayer.value.muted = !videoPlayer.value.muted;
  isMuted.value = videoPlayer.value.muted;
}

function formatTime(seconds) {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

watch(() => props.filePath, async newPath => {
  controller.value.changeSource(newPath);
});

onUnmounted(() => {
  controller.value.cleanup();
});
</script>

<style scoped>
.player-container {
  width: 100%;
  max-width: 800px;
  background: #1a1a1a;
  border-radius: 8px;
  overflow: hidden;
  margin: 10px;
}

.video-wrapper {
  position: relative;
  width: 100%;
  background: #000;
  aspect-ratio: 16 / 9;
}

.video-element {
  width: 100%;
  height: 100%;
  display: block;
}

.loading-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #fff;
  background: rgba(0, 0, 0, 0.7);
  padding: 10px 20px;
  border-radius: 4px;
}

.controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  background: #2a2a2a;
}

.controls button {
  background: #444;
  color: #fff;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.controls button:hover:not(:disabled) {
  background: #555;
}

.controls button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.seek-bar {
  flex-grow: 1;
  cursor: pointer;
}

.time-display {
  color: #ccc;
  font-size: 13px;
  font-family: monospace;
  min-width: 100px;
  text-align: center;
}
</style>