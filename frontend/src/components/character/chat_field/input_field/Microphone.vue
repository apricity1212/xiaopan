<script setup>
import KeyboardIcon from "@/components/character/icons/KeyboardIcon.vue";
import {onBeforeUnmount, onMounted, ref} from "vue";
import {MicVAD} from "@ricky0123/vad-web";
import api from "@/js/http/api.js";

const emit = defineEmits(['close', 'send', 'stop'])
const isSpeaking = ref(false)

let vadInstance = null;

const startRecording = async () => {
  // const baseUrl = "http://127.0.0.1:8000/static/frontend/vad/";
  const baseUrl = "http://localhost:5173/vad/";
  try {
    vadInstance = await MicVAD.new({
      baseAssetPath: baseUrl,
      onSpeechStart: () => {
        isSpeaking.value = true;
        emit('stop')
      },
      onSpeechEnd: (audio) => {
        isSpeaking.value = false;
        const pcm16 = float32ToInt16(audio);
        sendToBackend(pcm16);
      },
      ortConfig: (ort) => {
        ort.env.wasm.wasmPaths = baseUrl;
        ort.env.logLevel = "error";
      },
      positiveSpeechThreshold: 0.6,
      negativeSpeechThreshold: 0.5,
      minSpeechFrames: 3,
      redemptionFrames: 2,
    });

    await vadInstance.start();
  } catch (e) {
    console.error("VAD 初始化失败:", e);
  }
};
// 将 Float32 转为 Int16 (PCM 格式)
const float32ToInt16 = (buffer) => {
  let l = buffer.length;
  // 这里定义了 buf 变量
  const buf = new Int16Array(l);
  while (l--) {
    let s = Math.max(-1, Math.min(1, buffer[l]));
    buf[l] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  // 最后必须返回 buf.buffer
  return buf.buffer;
};

const sendToBackend = async (arrayBuffer) => {
  const blob = new Blob([arrayBuffer], { type: "audio/pcm" })
  const formData = new FormData()
  formData.append("audio", blob, 'voice.pcm')

  try {
    const res = await api.post('/api/friend/message/asr/asr/', formData)
    const data = res.data

    // 👇 加这三行！看看后端到底返回了什么鬼东西！
    console.log("🔥 语音识别结果返回啦：", data);
    if (!data.text) {
        alert("警告：后端返回了空的识别结果！");
    }

    if (data.result === 'success') {
      emit('send', data.text)
    }
  } catch (err) {
    console.error(err)
  }
};

onMounted(() => {
  startRecording()
})




onBeforeUnmount(() => {
  if (vadInstance) {
    vadInstance.destroy()
    vadInstance = null
  }
})
</script>

<template>
  <div class="absolute bottom-4 left-2 h-12 w-86 flex items-center bg-black/30 backdrop-blur-sm rounded-2xl">
    <div v-if="isSpeaking" class="flex items-center justify-center gap-1 h-6 flex-1">
      <div
        v-for="i in 32" :key="i"
        class="w-0.5 bg-blue-400 rounded-full animate-wave"
        :style="{ animationDelay: `${i * 0.1}s` }"
      ></div>
    </div>
    <div v-else class="text-white/50 text-base w-full text-center">
      语音输入
    </div>
    <div @click="emit('close')" class="absolute right-2 w-8 h-8 flex justify-center items-center cursor-pointer">
      <KeyboardIcon />
    </div>
  </div>
</template>

<style scoped>
.animate-wave {
  height: 4px;
  animation: wave-animation 0.6s ease-in-out infinite alternate;
}

@keyframes wave-animation {
  0% { height: 4px; opacity: 0.3; }
  100% { height: 20px; opacity: 1; }
}
</style>
