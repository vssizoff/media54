<script setup lang="ts">
import {onMounted, ref} from "vue";

const playerId = ref<number>();
const videoPlayer = ref<HTMLVideoElement>();

onMounted(async () => {
  try {
    // 1. Создаем уникальный ID плеера
    playerId.value = await window.electron.ipcRenderer.invoke('player-create');

    // 2. Получаем метаданные
    // const info = await window.electron.ipcRenderer.invoke('player-get-info', playerId, props.filePath);
    // duration.value = info.duration;

    // 3. Получаем URL для стриминга
    const streamUrl = await window.electron.ipcRenderer.invoke('player-get-url', playerId, "/home/sizoff/.media54/0/4.mp4", 0);

    // 4. Назначаем src и ждем загрузки
    if (!videoPlayer.value) return;
    videoPlayer.value.src = streamUrl;
    videoPlayer.value.load();
  } catch (err) {
    console.error('Failed to initialize player:', err);
  }
});
</script>

<template>
<video ref="videoPlayer" controls>
<!--  <source src="http://127.0.0.1:8000/test2">-->
</video>
</template>

<style scoped>

</style>