import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import PrimeVue from "primevue/config";
import Aura from "@primevue/themes/aura";
import {router} from "@renderer/router.js";
import {definePreset} from "@primevue/themes";

const app = createApp(App);

app.use(PrimeVue, {
  theme: {
    preset: definePreset(Aura, {

    })
  }
});

app.use(router);

app.mount('#app');