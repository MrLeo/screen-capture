<template>
  <div class="control">
    <a href="javascript:void(0);" @click="screenCapture" class="btn" :class="{recording: recordState}">{{btnText}}</a>
  </div>
  <div class="imgs">
    <img v-for="item in screens" :key="item.time" :src="item.img" :alt="item.time">
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue"
import _ from 'lodash'

const btnText = ref('点击开始生成截屏')

const recordState = ref(false)
const desktop = ref(document.createElement("video"))
const camera = ref(document.createElement("video"))
desktop.value.autoplay = true
camera.value.autoplay = true

const canvasPreview = ref(document.createElement("canvas"))
canvasPreview.value.width = window.screen.width
canvasPreview.value.height = window.screen.height

const screens = ref([])

async function startCapture() {
  try {
    // https://developer.mozilla.org/zh-CN/docs/Web/API/Screen_Capture_API/%E4%BD%BF%E7%94%A8%E5%B1%8F%E5%B9%95%E6%8D%95%E8%8E%B7API
    desktop.value.srcObject = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" }, audio: false })
    console.log(`[LOG] -> startCapture ->`, desktop)
  } catch(err) {
    console.error("Error: " + err)
    new Map([
      [/AbortError/,'屏幕共享意外终止'],
      [/InvalidStateError/,'屏幕共享加载失败'],
      [/NotAllowedError/,'用户拒绝授予访问屏幕区域的权限，或者不允许当前浏览实例访问屏幕共享'],
      [/NotFoundError/,'没有可用于捕获的屏幕视频源'],
      [/NotReadableError/,'无法读取: 屏幕共享被其他资源占用'],
      [/OverconstrainedError/, '转换错误: 视频流解析失败'],
      [/TypeError/, '类型错误'],
      [/./, '浏览器不支持webrtc']
    ]).forEach((val,key)=> {
      if(key.test(""+err)) {
        alert(val)
        throw err
      }
    })
  }

  navigator.mediaDevices.getUserMedia({ audio: false, video: { width: 1280, height: 720 } }).then(function(mediaStream) {
    camera.value.srcObject = mediaStream
    camera.value.onloadedmetadata = function(e) {
      camera.value.play()
    }
  }).catch(function(err) { console.log(err.name + ": " + err.message); }); // 总是在最后检查错误
}

const stopCapture = () => {
  recordState.value=false

  try {
    const desktopSrcObject = desktop.value && desktop.value.srcObject
    if (desktopSrcObject && "getTracks" in desktopSrcObject) {
      const tracks = desktopSrcObject.getTracks()
      tracks.forEach(track => track.stop())
      desktop.value.srcObject = null
    }
  } catch (err) {
    console.log(`[error] -> stopCapture -> desktop`, err)
  }

  try {
    const cameraSrcObject = camera.value && camera.value.srcObject
    if (cameraSrcObject && "getTracks" in cameraSrcObject) {
      const tracks = cameraSrcObject.getTracks()
      tracks.forEach(track => track.stop())
      camera.value.srcObject = null
    }
  } catch (err) {
    console.log(`[error] -> stopCapture -> camera`, err)
  }
}

onMounted(()=>stopCapture())

function drawImage () {
  const ctx = canvasPreview.value.getContext('2d')
  if(!ctx) return stopCapture()
  ctx.drawImage(
    desktop.value,
    0,
    0,
    canvasPreview.value.width,
    canvasPreview.value.height
  )
}

async function setHistory () {
  try {
    screens.value.unshift({
      img: canvasPreview.value.toDataURL(),
      time: +new Date()
    })
  } catch (err) {
    console.log(`[LOG] -> si -> err`, err)
    stopCapture()
  }
}

let countdown = null

async function screenCapture(){
  if (recordState.value) {
    clearInterval(countdown)
    countdown = null
    btnText.value = '点击开始生成截屏'
    recordState.value = false
    return
  }

  if (!desktop.value.srcObject) await startCapture()
  recordState.value=true

  let times = 5
  countdown = setInterval(() => {
    if(times-- < 0) {
      times = 5
      btnText.value = `🛑  截屏自动生成中: ${times}s`
      drawImage()
      setHistory()
    }
  }, 1000)

}
</script>

<style scoped>
.control{
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}
.control .video{
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
}
.control video {
  /* width: 100vw;
  height: 100vh;
  position: absolute;
  top: 0;
  left: 0;
  transform: translateX(-110%); */
  
  width: 500px;
  border: 1px solid #eee;
  background: #000;
}
.control .btn {
  border: 1px solid #eee;
  padding: 10px 30px;
  width:500px;
  text-decoration: none;
  color: rgb(0, 0, 0);
  text-align: center;
  margin: 16px;
  border-radius: 5px;
}

@keyframes recording { 
  from { background-color: rgba(255, 0, 0, 1); } 
  to { background-color: rgba(255, 0, 0, 0.5); }
}
.control .btn.recording {
  background-color: rgba(255, 0, 0, 1);
  color:#fff;
  animation: 0.5s linear 0s infinite alternate recording;
}

.imgs{
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
}
.imgs img{
  margin: 10px;
  border: 1px solid #ccc;
  width: 100px;
}
</style>
