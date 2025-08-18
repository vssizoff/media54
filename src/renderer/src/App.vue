<script setup lang="ts">
import {RouterView} from "vue-router";
import {ConfirmPopup} from "primevue";
</script>

<template>
  <teleport to="body">
    <ConfirmPopup/>
  </teleport>
  <RouterView/>
</template>

<style scoped>

</style>