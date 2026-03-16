<script setup>
import SendIcon from "@/components/character/icons/SendIcon.vue";
import MicIcon from "@/components/character/icons/MicIcon.vue";
import {onUnmounted, ref, useTemplateRef} from "vue";
import streamApi from "@/js/http/streamApi.js";
import Microphone from "@/components/character/chat_field/input_field/Microphone.vue";

const props = defineProps(['friendId'])
const emit = defineEmits(['pushBackMessage', 'addToLastMessage'])
const inputRef = useTemplateRef('input-ref')
const message = ref('')
let processId = 0
const showMic = ref(false)

let mediaSource = null;
let sourceBuffer = null;
let audioPlayer = new Audio(); // 全局播放器实例
let audioQueue = [];           // 待写入 Buffer 的二进制队列
let isUpdating = false;        // Buffer 是否正在写入

const initAudioStream = () => {
    audioPlayer.pause();
    audioQueue = [];
    isUpdating = false;

    mediaSource = new MediaSource();
    audioPlayer.src = URL.createObjectURL(mediaSource);

    mediaSource.addEventListener('sourceopen', () => {
        try {
            sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
            sourceBuffer.addEventListener('updateend', () => {
                isUpdating = false;
                processQueue();
            });
            // 👇 极其关键：必须加上这行！建立连接后立马把队列里积压的音频放出来！
      processQueue();
        } catch (e) {
            console.error("MSE AddSourceBuffer Error:", e);
        }
    });

    // ========== 重点修改这里 ==========
    // 强制尝试播放，如果被拦截，静默处理掉，不要让它报错中断后续逻辑
    const playPromise = audioPlayer.play();
    if (playPromise !== undefined) {
        playPromise.catch(e => {
            console.warn("浏览器拦截了自动播放，需等待用户产生交互行为");
        });
    }
};

const processQueue = () => {
    if (isUpdating || audioQueue.length === 0 || !sourceBuffer || sourceBuffer.updating) {
        return;
    }

    isUpdating = true;
    const chunk = audioQueue.shift();
    try {
        sourceBuffer.appendBuffer(chunk);
    } catch (e) {
        console.error("SourceBuffer Append Error:", e);
        isUpdating = false;
    }
};

const stopAudio = () => {
    audioPlayer.pause();
    audioQueue = [];
    isUpdating = false;

    if (mediaSource) {
        if (mediaSource.readyState === 'open') {
            try {
                mediaSource.endOfStream();
            } catch (e) {
            }
        }
        mediaSource = null;
    }

    if (audioPlayer.src) {
        URL.revokeObjectURL(audioPlayer.src);
        audioPlayer.src = '';
    }
};

const handleAudioChunk = (base64Data) => {  // 将语音片段添加到播放器队列中
    try {
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        audioQueue.push(bytes);
        processQueue();
    } catch (e) {
        console.error("Base64 Decode Error:", e);
    }
};

onUnmounted(() => {
    audioPlayer.pause();
    audioPlayer.src = '';
});

function focus() {
  inputRef.value.focus()
}

// 注意：直接完整复制下面这整个 handleSend 函数
const handleSend = async (voiceText) => {
  // 1. 智能判断：如果是语音传来的字，强制塞进输入框
  if (typeof voiceText === 'string' && voiceText.trim() !== '') {
    message.value = voiceText;
  }

  // 2. 如果什么都没输入，直接拦截
  if (!message.value || !message.value.trim()) {
    return;
  }

  // 3. 把文字保存下来，瞬间清空输入框并收起麦克风
  const content = message.value;
  console.log("✅ 聊天框已接住文字：", content);

  message.value = '';
  showMic.value = false;

  // 👇 极其关键的一行！就是你刚才不小心删掉的“内鬼”！用来防止旧消息串台！
  ++processId;
  const curId = processId;

  // 4. 先把我们的提问和AI的空对话框渲染到屏幕上
  try {
    emit('pushBackMessage', {role: 'user', content: content, id: crypto.randomUUID()});
    emit('pushBackMessage', {role: 'ai', content: '', id: crypto.randomUUID()});
  } catch (e) {
    console.error("❌ 渲染消息报错：", e);
  }

  // 👇👇👇 就是这里！加上这一行，提前唤醒并准备好播放器！ 👇👇👇
  initAudioStream();

  // 5. 向后端大模型发送流式请求
  try {
    await streamApi('/api/friend/message/chat/', {
      body: {
        friend_id: props.friendId,
        message: content,
      },
      onmessage(data, isDone) {
        // 👇 这里用到了 curId，如果不定义就会全线崩溃
        if (curId !== processId) return;

        if (data.content) {
          emit('addToLastMessage', data.content);
        }
        if (data.audio) {
          // 👇 加上这行日志，就像装了个雷达！
          console.log("🎵 收到后端发来的语音包啦！大小：", data.audio.length);
          handleAudioChunk(data.audio);

        }
      },
      onerror(err) {
        console.error("❌ 大模型流式返回出错:", err);
      },
    });
  } catch (err) {
    console.error("❌ 请求发送失败:", err);
  }
};

function close() {
  ++ processId
  showMic.value = false
  stopAudio()
}
function openMic() {
  // 真正的“免死金牌”：趁着你点鼠标这一瞬间，立刻静默解锁播放器！
  audioPlayer.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
  audioPlayer.play().catch(e => {});

  // 然后正常展开麦克风面板
  showMic.value = true;
}

function handleStop() {
  ++ processId
  stopAudio()
}

defineExpose({
  focus,
  close,
})
</script>

<template>
  <form v-if="!showMic" @submit.prevent="handleSend" class="absolute bottom-4 left-2 h-12 w-86 flex items-center">
    <input
        ref="input-ref"
        v-model="message"
        class="input bg-black/30 backdrop-blur-sm text-white text-base w-full h-full rounded-2xl pr-20"
        type="text"
        placeholder="文本输入..."
    >
    <div @click="handleSend" class="absolute right-2 w-8 h-8 flex justify-center items-center cursor-pointer">
      <SendIcon />
    </div>
    <div @click="openMic" class="absolute right-12 w-8 h-8 flex justify-center items-center cursor-pointer">
  <MicIcon />
</div>
  </form>
  <Microphone
      v-else
      @close="showMic = false"
      @send="handleSend"
      @stop="handleStop"
  />
</template>

<style scoped>

</style>