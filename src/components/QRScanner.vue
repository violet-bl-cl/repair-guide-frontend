<template>
  <div class="qr-scanner">
    <h2>QR scanner</h2>
    <p class="sub">
      Point the camera at a code. It's read automatically and logged to the console.
    </p>

    <div class="stage" @click="onStageTap">
      <video ref="videoEl" playsinline muted></video>
      <div class="reticle" :class="{ hit: isHit }"></div>
      <div v-if="isScanning && focusHint" class="focus-hint">{{ focusHint }}</div>
      <div
        v-if="focusPoint"
        class="focus-ring"
        :style="{ left: focusPoint.x + '%', top: focusPoint.y + '%' }"
      ></div>
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

// Focus UI state
const focusHint = ref('')
const focusPoint = ref<{ x: number; y: number } | null>(null)
let focusPointTimeout: ReturnType<typeof setTimeout> | null = null

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

// Non-standard but widely supported on Chrome/Android (incl. Samsung) media-capture-image-capture types
type ExtendedTrackCapabilities = MediaTrackCapabilities & {
  focusMode?: string[]
  focusDistance?: { min: number; max: number; step: number }
}
type ExtendedConstraintSet = MediaTrackConstraintSet & {
  focusMode?: string
  pointsOfInterest?: { x: number; y: number }[]
}

// Emits the scanned value to the parent component every time a NEW code is read
const emit = defineEmits<{
  scan: [value: string, parsed: ScannedCode]
}>()

function parseScannedCode(value: string): ScannedCode | null {
  const parts = value.split('-')
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) return null

  const [date, brandId, modelId, partId] = parts as [string, string, string, string]
  const removeLeadingZeros = (value: string): string => value.replace(/^0+(?=\d)/, '')

  return {
    date,
    brandId: removeLeadingZeros(brandId),
    modelId: removeLeadingZeros(modelId),
    partId: removeLeadingZeros(partId),
  }
}

function setStatus(text: string, cls: '' | 'live' | 'err' = '') {
  statusText.value = text
  statusClass.value = cls
}

/**
 * Tries to force continuous autofocus on the active video track.
 * Many Android/Samsung cameras default to a "locked" or slow-refocus
 * mode over getUserMedia, which makes close-up QR codes stay blurry.
 * This applies `focusMode: 'continuous'` when the device reports support for it.
 */
async function enableContinuousFocus(track: MediaStreamTrack): Promise<void> {
  const caps = track.getCapabilities?.() as ExtendedTrackCapabilities | undefined
  if (!caps?.focusMode) {
    focusHint.value = ''
    return
  }

  if (caps.focusMode.includes('continuous')) {
    try {
      await track.applyConstraints({
        advanced: [{ focusMode: 'continuous' } as ExtendedConstraintSet],
      })
      focusHint.value = ''
      return
    } catch (e) {
      console.warn('Continuous focus constraint rejected:', e)
    }
  }

  // Device can focus, but only supports single-shot / manual — offer tap-to-focus
  if (caps.focusMode.includes('single-shot') || caps.focusMode.includes('manual')) {
    focusHint.value = 'Blurry? Tap the video to focus'
  } else {
    focusHint.value = ''
  }
}

/**
 * Fires a one-shot focus at the tapped point, for devices (many Samsung
 * phones included) that don't support continuous autofocus over getUserMedia.
 */
async function onStageTap(evt: MouseEvent): Promise<void> {
  if (!isScanning.value || !stream) return
  const track = stream.getVideoTracks()[0]
  if (!track) return

  const caps = track.getCapabilities?.() as ExtendedTrackCapabilities | undefined
  const target = evt.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const xPct = ((evt.clientX - rect.left) / rect.width) * 100
  const yPct = ((evt.clientY - rect.top) / rect.height) * 100

  focusPoint.value = { x: xPct, y: yPct }
  if (focusPointTimeout) clearTimeout(focusPointTimeout)
  focusPointTimeout = setTimeout(() => (focusPoint.value = null), 700)

  if (!caps?.focusMode) return

  const normX = (evt.clientX - rect.left) / rect.width
  const normY = (evt.clientY - rect.top) / rect.height

  try {
    if (caps.focusMode.includes('single-shot')) {
      await track.applyConstraints({
        advanced: [
          {
            focusMode: 'single-shot',
            pointsOfInterest: [{ x: normX, y: normY }],
          } as ExtendedConstraintSet,
        ],
      })
    } else if (caps.focusMode.includes('continuous')) {
      // Re-nudge continuous focus toward the tapped region on devices that support it
      await track.applyConstraints({
        advanced: [
          {
            focusMode: 'continuous',
            pointsOfInterest: [{ x: normX, y: normY }],
          } as ExtendedConstraintSet,
        ],
      })
    }
  } catch (e) {
    console.warn('Tap-to-focus constraint rejected:', e)
  }
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
      video: {
        facingMode: { ideal: 'environment' },
        // Ask for continuous focus up front where the browser supports it (Chrome/Android)
        advanced: [{ focusMode: 'continuous' } as ExtendedConstraintSet],
      } as MediaTrackConstraints,
      audio: false,
    })
    videoEl.value.srcObject = stream
    await videoEl.value.play()

    canvas = document.createElement('canvas')
    ctx = canvas.getContext('2d', { willReadFrequently: true })

    const track = stream.getVideoTracks()[0]
    if (track) await enableContinuousFocus(track)

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
  focusHint.value = ''
  focusPoint.value = null
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
          // stop when its done
          stop()
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
  cursor: pointer;
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
.focus-hint {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 0.78rem;
  padding: 5px 10px;
  border-radius: 999px;
  pointer-events: none;
  white-space: nowrap;
}
.focus-ring {
  position: absolute;
  width: 56px;
  height: 56px;
  margin-left: -28px;
  margin-top: -28px;
  border: 2px solid #fff;
  border-radius: 50%;
  pointer-events: none;
  animation: focus-pulse 0.6s ease-out;
}
@keyframes focus-pulse {
  0% {
    transform: scale(1.3);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 0.7;
  }
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
