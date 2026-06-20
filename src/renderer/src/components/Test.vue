<template>
  <div class="player-container">
    <div class="video-wrapper">
      <video
          ref="videoPlayer"
          class="video-element"
          @timeupdate="onTimeUpdate"
          @loadedmetadata="onMetadataLoaded"
          @error="onError"
      ></video>
      <div v-if="isLoading" class="loading-overlay">Загрузка...</div>
    </div>

    <div class="controls">
      <button @click="togglePlay" :disabled="!isReady">
        {{ isPlaying ? '⏸' : '▶' }}
      </button>
      <button @click="stop" :disabled="!isReady">⏹</button>

      <input
          type="range"
          v-model.number="currentTime"
          :max="duration"
          step="0.1"
          :disabled="!isReady"
          @input="onSeekInput"
          @change="onSeekChange"
          class="seek-bar"
      />

      <span class="time-display">
        {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
      </span>

      <button @click="toggleMute">
        {{ isMuted ? '🔇' : '🔊' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';

// Пропсы — путь к файлу и опциональный заголовок
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

const videoPlayer = ref(null);
const isPlaying = ref(false);
const isReady = ref(false);
const isLoading = ref(true);
const isMuted = ref(false);
const currentTime = ref(0);
const duration = ref(0);

let playerId = null;
let isSeeking = false;

onMounted(async () => {
  try {
    // 1. Создаем уникальный ID плеера
    playerId = await window.electron.ipcRenderer.invoke('player-create');

    // 2. Получаем метаданные
    const info = await window.electron.ipcRenderer.invoke('player-get-info', playerId, props.filePath);
    duration.value = info.duration;

    // 3. Получаем URL для стриминга
    const streamUrl = await window.electron.ipcRenderer.invoke('player-get-url', playerId, props.filePath, 0);

    // 4. Назначаем src и ждем загрузки
    videoPlayer.value.src = streamUrl;
    videoPlayer.value.load();
  } catch (err) {
    console.error('Failed to initialize player:', err);
    isLoading.value = false;
  }
});

function onMetadataLoaded() {
  isReady.value = true;
  isLoading.value = false;
  // Длительность может быть Infinity для live-стримов или пока не загрузилась полностью
  if (videoPlayer.value.duration && isFinite(videoPlayer.value.duration)) {
    duration.value = videoPlayer.value.duration;
  }
}

function onError(e) {
  console.error('Video error:', e);
  isLoading.value = false;
}

function togglePlay() {
  if (!videoPlayer.value) return;
  if (videoPlayer.value.paused) {
    videoPlayer.value.play();
    isPlaying.value = true;
  } else {
    videoPlayer.value.pause();
    isPlaying.value = false;
  }
}

async function stop() {
  if (!videoPlayer.value) return;
  videoPlayer.value.pause();
  isPlaying.value = false;
  currentTime.value = 0;

  // Перезапускаем стрим с начала
  await window.electron.ipcRenderer.invoke('player-stop', playerId);
  const newUrl = await window.electron.ipcRenderer.invoke('player-get-url', playerId, props.filePath, 0);
  videoPlayer.value.src = newUrl;
}

function onTimeUpdate() {
  if (!isSeeking && videoPlayer.value) {
    currentTime.value = videoPlayer.value.currentTime;
  }
}

function onSeekInput() {
  isSeeking = true;
}

async function onSeekChange() {
  isSeeking = false;
  if (!videoPlayer.value) return;

  const wasPlaying = !videoPlayer.value.paused;

  // Останавливаем текущий поток
  await window.electron.ipcRenderer.invoke('player-stop', playerId);

  // Получаем новый URL с параметром seek
  const newUrl = await window.electron.ipcRenderer.invoke('player-get-url', playerId, props.filePath, currentTime.value);

  videoPlayer.value.src = newUrl;

  videoPlayer.value.onloadedmetadata = () => {
    videoPlayer.value.currentTime = 0;
    if (wasPlaying) {
      videoPlayer.value.play();
      isPlaying.value = true;
    }
  };
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

// Реакция на смену файла
watch(() => props.filePath, async (newPath) => {
  if (!playerId) return;
  await window.electron.ipcRenderer.invoke('player-stop', playerId);
  const newUrl = await window.electron.ipcRenderer.invoke('player-get-url', playerId, newPath, 0);
  videoPlayer.value.src = newUrl;
  isLoading.value = true;
});

onUnmounted(() => {
  if (playerId) {
    window.electron.ipcRenderer.invoke('player-destroy', playerId);
  }
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