<template>
  <div class="video-container">
    <canvas ref="videoCanvas" :width="videoWidth" :height="videoHeight"></canvas>
    <div class="controls">
      <button @click="play">Play</button>
      <button @click="stop">Stop</button>
      <input
          type="range"
          v-model="seekPosition"
          :max="duration"
          @change="seek"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import {onMounted, onUnmounted, ref} from 'vue';
import {type VideoFrame, type VideoInfo} from "@renderer/types";

const videoCanvas = ref<HTMLCanvasElement>();
const videoWidth = ref(1280);
const videoHeight = ref(720);
const duration = ref(0);
const fps = ref(0);
const playerId = ref<number>();

const seekPosition = ref(0);
let ctx: CanvasRenderingContext2D | null = null;
let animationFrameId: NodeJS.Timeout | null = null;

let frameQueue: Array<VideoFrame> = [];

onMounted(async () => {
  if (!videoCanvas.value) return;
  ctx = videoCanvas.value.getContext('2d');

  playerId.value = await window.electron.ipcRenderer.invoke("createPlayer");

  window.electron.ipcRenderer.on(`video-frame-${playerId.value}`, (_, frame: VideoFrame) => {
    // console.log(frame);
    frameQueue.push(frame);
    if (!animationFrameId) {
      // renderNextFrame();
      animationFrameId = setInterval(() => renderNextFrame(), 1000 / fps.value);
    }
  })

  // Загрузка видео (пример)
  const info: VideoInfo = await window.electron.ipcRenderer.invoke(`video-load-${playerId.value}`, '/home/sizoff/.media54/3/3.mp4');
  videoWidth.value = info.width;
  videoHeight.value = info.height;
  duration.value = info.duration;
  fps.value = info.fps;
});

function renderNextFrame() {
  console.log("frame");
  if (!ctx) return;
  if (frameQueue.length === 0) {
    animationFrameId = null;
    return;
  }

  const frame = frameQueue.shift();
  if (!frame) return;

  // Создаем ImageData из RGB данных
  const imageData = ctx.createImageData(frame.width || videoWidth.value, frame.height || videoHeight.value);

  // Конвертируем RGB в RGBA (добавляем alpha канал)
  for (let i = 0, j = 0; i < frame.data.length; i += 3, j += 4) {
    imageData.data[j] = frame.data[i];     // R
    imageData.data[j + 1] = frame.data[i + 1]; // G
    imageData.data[j + 2] = frame.data[i + 2]; // B
    imageData.data[j + 3] = 255;           // A
  }

  // console.log(frame.width || videoWidth.value, frame.height || videoHeight.value, imageData);
  ctx.putImageData(imageData, 0, 0);

  // Рендерим следующий кадр с учетом FPS
  // animationFrameId = requestAnimationFrame(renderNextFrame);
  // animationFrameId = requestAnimationFrame(() => undefined);
  // animationFrameId = 1;
  // setTimeout(renderNextFrame, 0.1);
}

async function play() {
  await window.electron.ipcRenderer.invoke(`video-play-${playerId.value}`, 0);
}

async function stop() {
  await window.electron.ipcRenderer.invoke(`video-stop-${playerId.value}`);
  frameQueue = [];
}

async function seek() {
  await window.electron.ipcRenderer.invoke(`video-seek-${playerId.value}`, seekPosition.value);
}

onUnmounted(() => {
  if (animationFrameId) {
    // cancelAnimationFrame(animationFrameId);
    clearInterval(animationFrameId);
  }
  window.electron.ipcRenderer.removeAllListeners(`video-frame-${playerId.value}`);
});
</script>

<style scoped>
.video-container {
  //display: flex;
  //flex-direction: column;
  //align-items: center;
}

canvas {
  //border: 1px solid #ccc;
  //max-width: 100%;
}

.controls {
  margin-top: 10px;
  display: flex;
  gap: 10px;
  align-items: center;
}
</style>