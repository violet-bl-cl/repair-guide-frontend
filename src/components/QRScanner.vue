<template>
  <div class="qr-scanner">
    <h2>QR scanner</h2>
    <p class="sub">
      Point the camera at a code. It's read automatically and logged to the console.
    </p>

    <div class="stage">
      <video ref="videoEl" playsinline muted></video>
      <div class="reticle" :class="{ hit: isHit }"></div>
    </div>

    <p class="status" :class="statusClass">{{ statusText }}</p>

    <button v-if="!isScanning" class="primary" @click="start">Start camera</button>
    <button v-else @click="stop">Stop camera</button>

    <div v-if="lastValue" class="result">
      <div class="label">Last scanned value</div>
      <div class="value">{{ lastValue }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import jsQR from 'jsqr'
import { onBeforeUnmount, ref, type Ref } from 'vue'

//exmaple code numbers 2026-01-041-001

const videoEl: Ref<HTMLVideoElement | null> = ref(null)
const isScanning = ref(false)
const isHit = ref(false)
const statusText = ref('Tap "Start camera" to begin.')
const statusClass = ref<'' | 'live' | 'err'>('')
const lastValue = ref('')
export type ScannedCode = {
  date: string
  brandId: string
  modelId: string
  partId: string
}

const scannedCode = ref<ScannedCode | null>(null)

let stream: MediaStream | null = null
let rafId: number | null = null
let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
let lastHitTime = 0

// Emits the scanned value to the parent component every time a NEW code is read
const emit = defineEmits<{
  scan: [value: string, parsed: ScannedCode]
}>()

function parseScannedCode(value: string): ScannedCode | null {
  const parts = value.split('-')
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) return null

  const [date, brandId, modelId, partId] = parts as [string, string, string, string]
  const removeLeadingZeros = (part: string): string => part.replace(/^0+/, '') || '0'

  return {
    date: removeLeadingZeros(date),
    brandId: removeLeadingZeros(brandId),
    modelId: removeLeadingZeros(modelId),
    partId: removeLeadingZeros(partId),
  }
}

function setStatus(text: string, cls: '' | 'live' | 'err' = '') {
  statusText.value = text
  statusClass.value = cls
}

async function start(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus('Camera access is not supported in this browser.', 'err')
    return
  }
  if (!videoEl.value) return

  try {
    setStatus('Requesting camera access…')
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    })
    videoEl.value.srcObject = stream
    await videoEl.value.play()

    canvas = document.createElement('canvas')
    ctx = canvas.getContext('2d', { willReadFrequently: true })

    isScanning.value = true
    setStatus('Scanning…', 'live')
    rafId = requestAnimationFrame(tick)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    setStatus('Camera error: ' + message, 'err')
    console.error('QR scanner camera error:', err)
  }
}

function stop(): void {
  if (rafId !== null) cancelAnimationFrame(rafId)
  rafId = null
  if (stream) {
    stream.getTracks().forEach((t) => t.stop())
    stream = null
  }
  isScanning.value = false
  isHit.value = false
  setStatus('Camera stopped. Tap "Start camera" to resume.')
}

function tick(): void {
  const video = videoEl.value
  if (video && ctx && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    let code: ReturnType<typeof jsQR> = null
    try {
      code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      })
    } catch (e) {
      console.error('jsQR decode error:', e)
    }

    const now = Date.now()
    if (code?.data) {
      isHit.value = true
      lastHitTime = now
      const parsedCode = parseScannedCode(code.data)
      if (!parsedCode) {
        scannedCode.value = null
        setStatus('Invalid code format. Expected date-brandId-modelId-partId.', 'err')
      } else {
        const normalizedValue = [
          parsedCode.date,
          parsedCode.brandId,
          parsedCode.modelId,
          parsedCode.partId,
        ].join('-')

        if (normalizedValue !== lastValue.value) {
          lastValue.value = normalizedValue
          scannedCode.value = parsedCode
          console.log('QR code scanned:', normalizedValue)
          emit('scan', normalizedValue, parsedCode)
          setStatus('Scanned ✓', 'live')
        }
      }
    } else if (now - lastHitTime > 400) {
      isHit.value = false
      if (stream) setStatus('Scanning…', 'live')
    }
  }
  rafId = requestAnimationFrame(tick)
}

onBeforeUnmount(stop)

defineExpose({ start, stop, scannedCode })
</script>

<style scoped>
.qr-scanner {
  max-width: 480px;
  margin: 0 auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
h2 {
  font-size: 1.3rem;
  font-weight: 650;
  margin: 0 0 4px;
}
.sub {
  margin: 0 0 16px;
  color: #6b7280;
  font-size: 0.9rem;
}
.stage {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: #000;
  border-radius: 14px;
  overflow: hidden;
}
video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.reticle {
  position: absolute;
  inset: 14%;
  border: 2px solid rgba(255, 255, 255, 0.55);
  border-radius: 12px;
  pointer-events: none;
  transition: border-color 0.15s ease;
}
.reticle.hit {
  border-color: #22c55e;
}
.status {
  margin-top: 12px;
  font-size: 0.88rem;
  color: #6b7280;
  min-height: 1.2em;
}
.status.live {
  color: #22c55e;
}
.status.err {
  color: #ef4444;
}
button {
  margin-top: 12px;
  width: 100%;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid #d1d5db;
  background: #fff;
  font-size: 0.95rem;
  font-weight: 550;
  cursor: pointer;
}
button.primary {
  background: #16a34a;
  border-color: #16a34a;
  color: #fff;
}
.result {
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 10px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
}
.result .label {
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 4px;
}
.result .value {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.95rem;
  word-break: break-word;
}
</style>
