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
      <div v-if="isLoading" class="loading-overlay">Буферизация...</div>
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
let mediaSource = null;
let sourceBuffer = null;
let fetchController = null;
let isAppending = false;
let pendingBuffers = [];
let cleanupInterval = null;

onMounted(async () => {
  try {
    playerId = await window.electron.ipcRenderer.invoke('player-create');
    const info = await window.electron.ipcRenderer.invoke('player-get-info', playerId, props.filePath);
    duration.value = info.duration;

    await initMediaSource(0);
  } catch (err) {
    console.error('Failed to initialize player:', err);
    isLoading.value = false;
  }
});

async function initMediaSource(seekTime = 0) {
  // Очистка предыдущего состояния
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }

  if (fetchController) {
    fetchController.abort();
    fetchController = null;
  }

  if (mediaSource) {
    try {
      if (mediaSource.readyState === 'open') {
        mediaSource.endOfStream();
      }
    } catch (e) {
      // ignore
    }
  }

  isAppending = false;
  pendingBuffers = [];

  mediaSource = new MediaSource();
  videoPlayer.value.src = URL.createObjectURL(mediaSource);

  mediaSource.addEventListener('sourceopen', () => {
    console.log('[MSE] Source opened');
    onSourceOpen(seekTime);
  }, { once: true });

  mediaSource.addEventListener('sourceerror', (e) => {
    console.error('[MSE] Source error:', e);
    isLoading.value = false;
  });
}

function onSourceOpen(seekTime = 0) {
  // fMP4 с H.264 + AAC
  const mimeType = 'video/mp4; codecs="avc1.4D002A, mp4a.40.2"';

  if (!MediaSource.isTypeSupported(mimeType)) {
    // Fallback на более совместимый профиль
    const fallbackMime = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
    if (!MediaSource.isTypeSupported(fallbackMime)) {
      console.error('[MSE] No supported MIME type found');
      console.log('[MSE] Supported types:', MediaSource.isTypeSupported('video/mp4'));
      isLoading.value = false;
      return;
    }
    console.log('[MSE] Using fallback MIME type');
  }

  try {
    sourceBuffer = mediaSource.addSourceBuffer(mimeType);
  } catch (e) {
    console.error('[MSE] Failed to add SourceBuffer:', e);
    isLoading.value = false;
    return;
  }

  sourceBuffer.mode = 'segments';

  sourceBuffer.addEventListener('updateend', () => {
    isAppending = false;
    processPendingBuffers();
  });

  sourceBuffer.addEventListener('error', (e) => {
    console.error('[MSE] SourceBuffer error:', e);
    isLoading.value = false;
  });

  // Запуск очистки буфера
  cleanupInterval = setInterval(() => {
    cleanupBuffer();
  }, 5000);

  fetchStream(seekTime);
}

function processPendingBuffers() {
  if (isAppending || !sourceBuffer || sourceBuffer.updating || pendingBuffers.length === 0) {
    return;
  }

  const chunk = pendingBuffers.shift();

  try {
    isAppending = true;
    sourceBuffer.appendBuffer(chunk);
  } catch (e) {
    console.error('[MSE] appendBuffer error:', e);
    isAppending = false;
    // Если квад переполнен, ждем и пробуем снова
    if (e.name === 'QuotaExceededError') {
      pendingBuffers.unshift(chunk);
      setTimeout(() => processPendingBuffers(), 100);
    }
  }
}

async function fetchStream(seekTime = 0) {
  if (fetchController) {
    fetchController.abort();
  }

  fetchController = new AbortController();
  const streamUrl = await window.electron.ipcRenderer.invoke('player-get-url', playerId, props.filePath, seekTime);

  console.log('[Stream] Fetching:', streamUrl);

  try {
    const response = await fetch(streamUrl, {
      signal: fetchController.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    let totalReceived = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        console.log('[Stream] Done. Total received:', totalReceived, 'bytes');
        // Ждем пока все данные обработаются
        const waitForFinish = () => {
          if (isAppending || pendingBuffers.length > 0) {
            setTimeout(waitForFinish, 100);
          } else {
            if (mediaSource.readyState === 'open') {
              try {
                mediaSource.endOfStream();
              } catch (e) {
                // ignore
              }
            }
          }
        };
        waitForFinish();
        break;
      }

      totalReceived += value.length;
      pendingBuffers.push(value);
      processPendingBuffers();

      // Показываем готовность, когда есть достаточно буфера
      if (!isReady.value && sourceBuffer && sourceBuffer.buffered.length > 0) {
        const bufferedEnd = sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1);
        if (bufferedEnd > 1) {
          isReady.value = true;
          isLoading.value = false;
          console.log('[Player] Ready to play');
        }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('[Stream] Fetch error:', err);
      isLoading.value = false;
    }
  }
}

function cleanupBuffer() {
  if (!sourceBuffer || sourceBuffer.updating || isAppending || !videoPlayer.value) return;

  try {
    if (sourceBuffer.buffered.length > 0) {
      const start = sourceBuffer.buffered.start(0);
      const ct = videoPlayer.value.currentTime;

      if (ct - start > 30) {
        isAppending = true;
        sourceBuffer.remove(start, ct - 10);
      }
    }
  } catch (e) {
    isAppending = false;
  }
}

function onMetadataLoaded() {
  if (videoPlayer.value.duration && isFinite(videoPlayer.value.duration)) {
    duration.value = videoPlayer.value.duration;
  }
}

function onError(e) {
  console.error('[Video] Error:', e);
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

  await window.electron.ipcRenderer.invoke('player-stop', playerId);
  await initMediaSource(0);
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

  await window.electron.ipcRenderer.invoke('player-stop', playerId);
  await initMediaSource(currentTime.value);

  if (wasPlaying) {
    const tryPlay = () => {
      if (isReady.value) {
        videoPlayer.value.play();
        isPlaying.value = true;
      } else {
        setTimeout(tryPlay, 100);
      }
    };
    tryPlay();
  }
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

watch(() => props.filePath, async (newPath) => {
  if (!playerId) return;
  await window.electron.ipcRenderer.invoke('player-stop', playerId);
  await initMediaSource(0);
  isLoading.value = true;
  isReady.value = false;
});

onUnmounted(() => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
  if (fetchController) {
    fetchController.abort();
  }
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