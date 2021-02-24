<template>
  <div style="position: relative; width: 500px; margin: 0 auto;">
    <video ref="desktop" autoplay style="width: 500px;"></video>
    <video ref="camera" autoplay style="position: absolute; width: 100px; top: 0; left: 0;"></video>
  </div>
  <div class="control">
    <a href="javascript:void(0);" @click="screenCapture" class="btn" :class="{recording: recordState}">{{btnText}}</a>
  </div>
  <transition-group name="list" tag="div" class="imgs" ref="imgs">
    <div class="img-block" v-for="item in screens" :key="item.time">
      <img :src="item.img" :alt="item.time">
      <p>{{item.time}}</p>
    </div>
  </transition-group>


  <div class="imgs" v-if="fileList && fileList.length" ref="imgs2" style="margin-top: 100vh">
    <div class="img-block" v-for="item in fileList" :key="item.id">
      <img :src="item.attributes.url" :alt="item.attributes.name">
    </div>
  </div>
</template>

<script setup>
// This starter template is using Vue 3 experimental <script setup> SFCs
// Check out https://github.com/vuejs/rfcs/blob/script-setup-2/active-rfcs/0000-script-setup.md

// GitHub: https://github.com/MrLeo/screen-capture
// 浏览器截屏&录像Demo: https://dev.xuebin.me/screen-capture/
// codepen: https://codepen.io/MrLeo/pen/VwmrJMX

import _ from 'lodash'
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue"
import dayjs from "dayjs"
import 'viewerjs/dist/viewer.css'
import Viewer from 'viewerjs' // https://github.com/fengyuanchen/viewerjs
import AV from 'leancloud-storage'

AV.init({
  appId: "7qjY0VDwGw02BmgMqqGfDFO0-gzGzoHsz",
  appKey: "eYX7CBXn2T7iUGa9LAUnIt9q",
  serverURL: "https://7qjy0vdw.lc-cn-n1-shared.com"
})

const recordState = ref(false)
const desktop = ref(null)
const camera = ref(null)
// const desktop = ref(document.createElement("video"))
// const camera = ref(document.createElement("video"))
// desktop.value.autoplay = true
// camera.value.autoplay = true

const canvas = reactive({
  desktopCature: document.createElement("canvas"),
  cameraCature: document.createElement("canvas"),
  preview: document.createElement("canvas")
})
_.forEach(canvas, val => {
  val.width = window.screen.width
  val.height = window.screen.height
})

const times = ref(0)
const btnText = computed(()=> (recordState.value ? `🛑  截屏自动生成中: ${times.value}s` : '点击开始生成截屏'))

const imgs = ref(null)
const screens = ref([])
let viewer = ref(null)

const fileList = ref([])

let countdown = null

onMounted(()=>{
  stopCapture()

  viewer.value = new Viewer(imgs.value.$el)
  imgs.value.$el.addEventListener('show', function () {
    recordState.value = false
  })

  const query = new AV.Query('_File')
  query.limit(50)
  query.descending('createdAt')
  query.find().then((res) => {
    fileList.value = res
  })
})

watch(recordState, async (val) => {
  if ( val ) {
    if(!desktop.value.srcObject) {
      await startCapture()
    }

    countdown = setInterval(() => {
      if(--times.value <= 0) addImg()
    }, 1000)
  } else {
    clearCountdown()
  }
})

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

function stopCapture () {
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
    console.error(`[error] -> stopCapture -> camera`, err)
  }
}

function drawCature (name, source) {
  const cvs = canvas[name]
  const ctx = cvs.getContext('2d')

  cvs.width = source.value.videoWidth
  cvs.height = source.value.videoHeight

  ctx.drawImage(
    source.value,
    0,
    0,
    cvs.width,
    cvs.height
  )

  return ctx
}

function drawImage () {
  try {
    drawCature('desktopCature', desktop)
    drawCature('cameraCature', camera)
  
    const ctx = drawCature('preview', desktop)
    if(!ctx) throw new Error('error in canvas.getContext') 
  
    // 矩形摄像头
    const cameraW = 200
    const cameraH = cameraW / (camera.value.videoWidth / camera.value.videoHeight)
    ctx.drawImage(camera.value, 0, 0, cameraW, cameraH)
  
    // 圆形摄像头
    // ctx.save()
    // const r = 200
    // ctx.arc(r, r, r, 0, 2 * Math.PI)
    // ctx.clip()
    // ctx.drawImage(camera.value, 0, 0, r * 2, r * 2)
    // ctx.restore()
  } catch (err) {
    console.error(`[LOG] -> drawImage -> err`, err)
    stopCapture()
  }
}

async function setHistory () {
  try {
    const capture = {
      img: canvas.preview.toDataURL(),
      desktop: canvas.desktopCature.toDataURL(),
      camera: canvas.cameraCature.toDataURL(),
      time: dayjs().format('YYYY-MM-DD HH:mm:ss')
    }
    screens.value.unshift()
    saveLeancloud(capture)

    await nextTick()
    viewer.value.update()
  } catch (err) {
    console.log(`[LOG] -> setHistory -> err`, err)
    stopCapture()
  }
}

// https://leancloud.cn/docs/leanstorage_guide-js.html#hash632374954
function saveLeancloud(capture) {
  const name = `${+new Date()}_${_.random(10, true)}`
  
  const previewFile = new AV.File(`preview_${name}.png`, { base64: capture.desktop })
  previewFile.save().then((file) => {
    // console.log(`previewFile 文件保存完成。objectId：${file.id}`,file);
    capture.previewFile = {id: file.id, url: file.attributes.url}
  }, (error) => {
    // console.log(`[LOG] -> file.save -> error`, error)
  })

  const desktopFile = new AV.File(`desktop_${name}.png`, { base64: capture.desktop })
  desktopFile.save().then((file) => {
    // console.log(`desktopFile 文件保存完成。objectId：${file.id}`,file);
    capture.desktopFile = {id: file.id, url: file.attributes.url}
  }, (error) => {
    // console.log(`[LOG] -> file.save -> error`, error)
  })

  const cameraFile = new AV.File(`camera_${name}.png`, { base64: capture.camera })
  cameraFile.save().then((file) => {
    // console.log(`cameraFile 文件保存完成。objectId：${file.id}`,file);
    capture.cameraFile = {id: file.id, url: file.attributes.url}
  }, (error) => {
    // console.log(`[LOG] -> file.save -> error`, error)
  })
}

function addImg () {
  times.value = 5
  drawImage()
  setHistory()
}

function clearCountdown () {
  clearInterval(countdown)
  countdown = null
  times.value = 0
  addImg()
}

function screenCapture(){
  recordState.value = !recordState.value
}
</script>

<style>
html, body {
  padding: 0;
  margin: 0;
}

.control{
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
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
.imgs .img-block {
  width: 130px;
  margin: 10px;
  border: 1px solid #eee;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.imgs img{
  cursor: pointer;
  width: 100%;
}
.imgs p {
  padding: 0;
  margin: 0;
  color: #ccc;
  font-size: 10px;
}

.list-enter-active,
.list-leave-active, 
.list-move {
  transition: all 0.5s;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(-30px);
}
</style>
