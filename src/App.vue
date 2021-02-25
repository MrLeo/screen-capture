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


  <div class="imgs" v-if="fileList && fileList.length" style="margin-top: 100vh">
    <div class="img-block" v-for="item in fileList" :key="item.id">
      <img v-if="item.attributes.url" :src="item.attributes.url" :alt="item.attributes.name">
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

const btnText = computed(()=> (recordState.value ? `🛑  截屏自动生成中` : '点击开始生成截屏'))

const imgs = ref(null)
const screens = ref([])
let viewer = ref(null)

const fileList = ref([])

let countdown = null

onMounted(()=>{
  stopCapture()
  recordState.value=true

  viewer.value = new Viewer(imgs.value.$el)
  imgs.value.$el.addEventListener('show', function () {
    recordState.value = false
  })
  imgs.value.$el.addEventListener('hide', function () {
    recordState.value = true
  })

  getLeancloud()
})

watch(recordState, async (val) => {
  if ( val ) {
    if(!desktop.value.srcObject) {
      await startCapture()
      await nextTick()
    }

    countdown = setInterval(() => { addImg() }, 1000)
  } else {
    clearCountdown()
  }
})

async function getDisplayMedia() {
  try {
    // https://developer.mozilla.org/zh-CN/docs/Web/API/Screen_Capture_API/%E4%BD%BF%E7%94%A8%E5%B1%8F%E5%B9%95%E6%8D%95%E8%8E%B7API
    const captureStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" }, audio: false })
    desktop.value.srcObject = captureStream
    console.log(`[LOG] -> getDisplayMedia ->`, captureStream, desktop)
    captureStream.addEventListener('removetrack', (event) => {
      console.log(`${event.track.kind} track removed`);
    })
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
}
async function getUserMedia() {
  try {
    const captureStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: 1280, height: 720 } })
    camera.value.srcObject = captureStream
    console.log(`[LOG] -> getUserMedia ->`, captureStream, camera)
    captureStream.addEventListener('removetrack', (event) => {
      console.log(`${event.track.kind} track removed`);
    })
  } catch(err) {
    console.log(err.name + ": " + err.message)
  }
}
async function startCapture() {
  try {
    Promise.all([
      getDisplayMedia(),
      getUserMedia()
    ])
  } catch (err) {
    console.error(`[LOG] -> startCapture -> err`, err)
  }
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
    console.error(`[error] -> stopCapture -> desktop`, err)
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
  if(!_.get(source,'value.srcObject.active')) return

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

function drawImg () {
  drawCature('desktopCature', desktop)
  drawCature('cameraCature', camera)

  if(!_.get(desktop,'value.srcObject.active')) return
  const ctx = drawCature('preview', desktop)
  if(!ctx) throw new Error('error in canvas.getContext') 

  if(!_.get(camera,'value.srcObject.active')) return
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
}

function isCanvasBlank(canvas) {
    var blank = document.createElement('canvas');//系统获取一个空canvas对象
    blank.width = canvas.width;
    blank.height = canvas.height;
    return canvas.toDataURL() == blank.toDataURL();//比较值相等则为空
}

async function setHistory () {
  const capture = {
    img: isCanvasBlank(canvas.preview) ? '' : canvas.preview.toDataURL(),
    desktop: isCanvasBlank(canvas.desktopCature) ? '' : canvas.desktopCature.toDataURL(),
    camera: isCanvasBlank(canvas.cameraCature) ? '' : canvas.cameraCature.toDataURL(),
    time: dayjs().format('YYYY-MM-DD HH:mm:ss')
  }
  screens.value.unshift(capture)
  saveLeancloud(capture)

  await nextTick()
  viewer.value.update()
}

function addImg () {
  if(!_.get(desktop,'value.srcObject.active') && !_.get(camera,'value.srcObject.active')){
    recordState.value = false
    return
  }
  drawImg()
  setHistory()
}

function clearCountdown () {
  clearInterval(countdown)
  countdown = null
}

function screenCapture(){
  recordState.value = !recordState.value
}

// https://leancloud.cn/docs/leanstorage_guide-js.html#hash632374954
function saveLeancloud(capture) {
  const name = `${+new Date()}_${_.random(10, true)}`
  window.addEventListener('beforeunload', (event) => {
    // Cancel the event as stated by the standard.
    event.preventDefault()
    // Chrome requires returnValue to be set.
    event.returnValue = '截图生成中，请稍等'

    return '截图生成中，请稍等'
  })
  if(capture.desktop){
    const desktopFile = new AV.File(`desktop_${name}.png`, { base64: capture.desktop })
    desktopFile.save().then((file) => {
      window.removeEventListener('beforeunload')
      // console.log(`desktopFile 文件保存完成。objectId：${file.id}`,file);
      capture.desktopFile = {id: file.id, url: file.attributes.url}
    }, (error) => {
      // console.log(`[LOG] -> file.save -> error`, error)
    })
  }
  
  if(capture.camera){
    const cameraFile = new AV.File(`camera_${name}.png`, { base64: capture.camera })
    cameraFile.save().then((file) => {
      window.removeEventListener('beforeunload')
      // console.log(`cameraFile 文件保存完成。objectId：${file.id}`,file);
      capture.cameraFile = {id: file.id, url: file.attributes.url}
    }, (error) => {
      // console.log(`[LOG] -> file.save -> error`, error)
    })
  }
}

function getLeancloud () {
  const query = new AV.Query('_File')
  query.limit(1000)
  query.descending('createdAt')
  query.find().then((res) => {
    fileList.value = res
  })
}

AV.init({
  appId: "7qjY0VDwGw02BmgMqqGfDFO0-gzGzoHsz",
  appKey: "eYX7CBXn2T7iUGa9LAUnIt9q",
  serverURL: "https://7qjy0vdw.lc-cn-n1-shared.com"
})
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
