import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import PrimeVue from "primevue/config";
import Aura from "@primevue/themes/aura";
import {router} from "@renderer/router.js";
import {definePreset} from "@primevue/themes";
import ConfirmationService from 'primevue/confirmationservice';

import {
  GlobalWorkerOptions,
} from 'vue-pdf-embed/dist/index.essential.mjs'
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
GlobalWorkerOptions.workerSrc = PdfWorker

const app = createApp(App);

app.use(PrimeVue, {
  theme: {
    preset: definePreset(Aura, {

    })
  }
});

app.use(router);
app.use(ConfirmationService);

app.mount('#app');