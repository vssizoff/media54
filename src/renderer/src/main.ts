import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import PrimeVue from "primevue/config";
import Aura from "@primevue/themes/aura";
import {router} from "@renderer/router.js";

const app = createApp(App);

app.use(PrimeVue, {
  theme: {
    preset: Aura
  }
});

app.use(router);

app.mount('#app');