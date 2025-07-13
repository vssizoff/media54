<script lang="ts" setup>
import { type ComponentPublicInstance, nextTick, onMounted, ref, useTemplateRef, watch } from "vue";
import { Textarea } from "primevue";

const props = defineProps({
  modelValue: {
    type: String
  }
});

const emit = defineEmits({
  "update:modelValue"(_) {return true;}
});

const value = ref<string>(props.modelValue || "");
const height = ref<string>("64px");

const elem = useTemplateRef<ComponentPublicInstance & {$el: HTMLTextAreaElement}>("ref");

function scrollHeight() {
  return elem.value?.$el.scrollHeight;
}

function resize() {
  height.value = "auto";
  nextTick(() => {
    height.value = scrollHeight() + 2 + 'px';
  });
}

watch(value, () => {
  emit("update:modelValue", value.value);
  resize();
});

watch(props, () => {
  value.value = props.modelValue ?? "";
  resize();
});

onMounted(() => {
  resize();
  window.addEventListener("resize", () => resize());
});
</script>

<template>
<Textarea v-model="value" class="textarea" ref="ref"/>
</template>

<style scoped>
.textarea {
  min-width: 400px;
  width: 100%;
  resize: none;
  height: v-bind(height);
}
</style>