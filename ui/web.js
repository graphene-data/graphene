import './app.css'
import {isLoading} from './internal/queryEngine.ts'

let socket = null
let errors = []

window.addEventListener('error', (event) => errors.push(event.error))
window.addEventListener('unhandledrejection', (event) => errors.push(event.reason))
connectWebSocket()

async function takeScreenshot (chartName = null) {
  if (!window.html2canvas) {
    let html2canvas = await import('html2canvas')
    window.html2canvas = html2canvas.default
  }

  // wait some time for queries to finish loading
  let startTime = Date.now()
  while (isLoading() && Date.now() - startTime < 20_000) {
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  let targetElement = chartName ? document.querySelector(`[name="${chartName}"]`) : document.body
  let canvas = targetElement && await window.html2canvas(targetElement, {useCORS: true, allowTaint: true, scale: 1})
  return {stillLoading: isLoading(), screenshot: canvas?.toDataURL('image/png')}
}

function connectWebSocket () {
  socket = new WebSocket(`ws://${window.location.host}/graphene-ws`)
  socket.onclose = () => setTimeout(connectWebSocket, 2000)

  socket.onopen = () => {
    socket.send(JSON.stringify({type: 'register', url: window.location.href}))
  }

  socket.onmessage = async (event) => {
    console.log('Got message', event.data)
    let {type, requestId, chart} = JSON.parse(event.data)

    if (type === 'view') {
      let {screenshot, stillLoading} = await takeScreenshot(chart)
      let serialErrs = errors.map(e => ({message: e.message, cause: e.cause}))
      socket.send(JSON.stringify({type: 'viewResponse', requestId, screenshot, stillLoading, errors: serialErrs}))
    }
  }
}
