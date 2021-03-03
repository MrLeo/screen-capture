<template>
  <transition-group name="list" tag="div" class="imgs" ref="imgs">
    <div class="img-block" v-for="item in screens" :key="item.time">
      <img :src="item.attributes.url" :alt="item.attributes.name">
    </div>
  </transition-group>
</template>

<script setup>
import _ from 'lodash'
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue"
import {getLeancloud} from '../../common/leancloud'
import 'viewerjs/dist/viewer.css'
import Viewer from 'viewerjs' // https://github.com/fengyuanchen/viewerjs

const imgs = ref(null)
const screens = ref([])
let viewer = ref(null)

const tim = ref(null)
const timFun = async () => {
  const res = await getLeancloud()
  console.log(`[LOG] -> timFun -> res`, res)
  screens.value = res
  viewer.value.update()
}

onMounted(async ()=>{
  viewer.value = new Viewer(imgs.value.$el)
  imgs.value.$el.addEventListener('show', function () {
    clearInterval(timFun)
  })
  imgs.value.$el.addEventListener('hide', function () {
    tim.value = setInterval(timFun, 5000)
  })
  tim.value = setInterval(timFun, 5000)
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
  flex-wrap: wrap;
  padding: 50px 50px;
  color: #fff;
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

</style>
