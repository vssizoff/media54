import {createRouter, createWebHashHistory} from "vue-router";

export const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        {
            name: "root",
            path: "/",
            component: () => import("@renderer/views/RootView.vue")
        },
        {
            name: "presentation",
            path: "/presentation",
            component: () => import("@renderer/views/PresentationView.vue")
        }
    ]
});