<template>
  <div class="column welcome">
    <h1>早安，沈卿仪</h1>
    <p>当前工作：兼职UI设计师</p>
  </div>
  <div class="column control">
    <p class="status">已工作</p>
    <div class="timer">{{timer}}</div>
    <div class="btn" @click="workBtn=!workBtn">{{workBtnTxt}}</div>
    <a class="btn btn__leave" href="/admin/">离开工作</a>
  </div>
</template>

<script setup>
import _ from 'lodash'
import { computed, nextTick, onMounted, reactive, ref, watch, isRef } from "vue"
import dayjs from "dayjs"
import {saveLeancloud} from '../../common/leancloud'

const workBtn = ref(false)
const workBtnTxt = computed(()=>workBtn.value ? '休息一下':'开始工作')
const tim = ref(null)

// #region 工时计算
//开始时间
const startDate = ref(new Date())
//当前时间
const nowDate = ref(new Date())
// 历史合计工时缓存（相差的总秒数）
const totalSecondsHistory = ref(0)
// 总合计工时（相差的总秒数）
const totalSeconds = computed(()=>{
  let currentTotalSeconds = parseInt((nowDate.value - startDate.value) / 1000)
  if (currentTotalSeconds < 0) currentTotalSeconds = 0
  return currentTotalSeconds + totalSecondsHistory.value
})
//天数
const days = computed(()=>Math.floor(totalSeconds.value / (60 * 60 * 24)))
//小时数
const hours = computed(()=>Math.floor((totalSeconds.value % (60 * 60 * 24)) / (60 * 60)))
//分钟
const minutes = computed(()=>Math.floor((totalSeconds.value % (60 * 60 * 24)) % (60 * 60) / 60))
//秒
const seconds = computed(()=>((totalSeconds.value % (60 * 60 * 24)) % (60 * 60)) % 60)
// 页面显示
const timer = computed(()=> {
  const hour = _.padStart(hours.value, 2, 0)
  const minute = _.padStart(minutes.value, 2, 0)
  const second = _.padStart(seconds.value, 2, 0)
  if(~~hour) return [hour,minute,second].join(':')
  return [minute,second].join(':')
})
watch(workBtn,working=>{
  if(working){
    nowDate.value = startDate.value = new Date()
    tim.value = setInterval(()=>(nowDate.value = new Date()),1000)
  }else{
    clearInterval(tim.value)
    totalSecondsHistory.value = totalSeconds.value
    nowDate.value = startDate.value = new Date()
  }
})
// #endregion

// #region 获取屏幕和摄像头视频流
const desktop = ref(document.createElement("video"))
const camera = ref(document.createElement("video"))
desktop.value.autoplay = true
camera.value.autoplay = true

async function getDisplayMedia() {
  try {
    // https://developer.mozilla.org/zh-CN/docs/Web/API/Screen_Capture_API/%E4%BD%BF%E7%94%A8%E5%B1%8F%E5%B9%95%E6%8D%95%E8%8E%B7API
    const captureStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" }, audio: false })
    desktop.value.srcObject = captureStream
    console.log(`[LOG] -> getDisplayMedia ->`, captureStream, desktop)
    captureStream.addEventListener('removetrack', (event) => {
      console.log(`${event.track.kind} track removed`);
    })
    captureStream.onremovetrack = () => console.log('getDisplayMedia onremovetrack')
    captureStream.onaddtrack = () => console.log('getDisplayMedia onaddtrack')
    captureStream.onactive = () => console.log('getDisplayMedia onactive')
    captureStream.oninactive = () => console.log('getDisplayMedia oninactive')
  } catch(err) {
    console.error("getDisplayMedia Error: " + err)
    _.forEach([
      [/AbortError/,'屏幕共享意外终止'],
      [/InvalidStateError/,'屏幕共享加载失败'],
      [/NotAllowedError/,'用户拒绝授予访问屏幕区域的权限，或者不允许当前浏览实例访问屏幕共享'],
      [/NotFoundError/,'没有可用于捕获的屏幕视频源'],
      [/NotReadableError/,'无法读取: 屏幕共享被其他资源占用'],
      [/OverconstrainedError/, '转换错误: 视频流解析失败'],
      [/TypeError/, '类型错误'],
      [/./, '浏览器不支持webrtc']
    ], (val,key)=> {
      if(val[0].test(""+err)) {
        alert(val[1])
        return false
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
    captureStream.onremovetrack = () => console.log('getDisplayMedia onremovetrack')
    captureStream.onaddtrack = () => console.log('getDisplayMedia onaddtrack')
    captureStream.onactive = () => console.log('getDisplayMedia onactive')
    captureStream.oninactive = () => console.log('getDisplayMedia oninactive')
  } catch(err) {
    console.log("getUserMedia Error:" + err.name + ": " + err.message)
  }
}

function stopCapture (source) {
  try {
    const target = isRef(source) ? source.value : source
    const desktopSrcObject = target && target.srcObject
    if (desktopSrcObject && "getTracks" in desktopSrcObject) {
      const tracks = desktopSrcObject.getTracks()
      tracks.forEach(track => track.stop())
      target.srcObject = null
    }
  } catch (err) {
    console.error(`[error] -> stopCapture -> `, err)
  }
}

function startCapture() {
  if (!desktop.value.srcObject) getDisplayMedia()
  if (!camera.value.srcObject) getUserMedia()
}
// #endregion

// #region 绘制并保存截图
const canvas = reactive({
  desktopCature: document.createElement("canvas"),
  cameraCature: document.createElement("canvas"),
  preview: document.createElement("canvas")
})
_.forEach(canvas, val => (val.width = window.screen.width) && (val.height = window.screen.height))

function drawCature (name, source) {
  const target = isRef(source) ? source.value : source
  if(!_.get(target,'srcObject.active')) return

  const cvs = canvas[name]
  const ctx = cvs.getContext('2d')

  cvs.width = target.videoWidth
  cvs.height = target.videoHeight

  ctx.drawImage(
    target,
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

function saveImg () {
  if(!(_.get(desktop.value,'srcObject.active') && _.get(camera.value,'srcObject.active'))) return

  drawImg()
  
  const name = `${+new Date()}_${_.random(10, true)}`
  !isCanvasBlank(canvas.desktopCature) && saveLeancloud({base64: canvas.desktopCature.toDataURL(), prefix: 'desktop', name})
  !isCanvasBlank(canvas.cameraCature) && saveLeancloud({base64: canvas.cameraCature.toDataURL(), prefix: 'camera', name})
}
// #endregion

const captureTim = ref(null)
watch(workBtn,working=>{
  if(working){
    startCapture()
    captureTim.value = setInterval(()=>{
      saveImg()
    },1000)
  }else{
    clearInterval(captureTim.value)
    stopCapture()
  }
})
</script>

<style>
html,body {
  padding: 0;
  margin: 0;
  height: 100vh;
  overflow: auto;
}
body::before{
  content:'';
  position:absolute;
  top:0;
  left:0;
  bottom: 0;
  right: 0;
  width:100vw;
  height:100vh;
  background: transparent url(../../assets/bg.jpeg) center center/cover no-repeat;
  -webkit-filter: blur(5px);
  -moz-filter: blur(5px);
  -ms-filter: blur(5px);
  -o-filter: blur(5px);
  filter: blur(5px);
  z-index:-1;
}
#app{
  display: flex;
  justify-content: space-around;
  padding: 100px 50px;
  color: #fff;
}
.control{
  display: flex;
  flex-direction: column;
  align-items: center;
}
.control .timer {
  width: 250px;
  height: 250px;
  border-radius: 50%;
  border: 1px solid #fff;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 70px;
  font-weight: bolder;
}
.control .status {
  font-size: 24px;
}
.btn{
  display: block;
  padding: 10px 20px;
  cursor: pointer;
  border: 1px solid #fff;
  margin-top: 40px;
}
.btn.btn__leave{
  position: absolute;
  top: 30px;
  right: 30px;
}
</style>
