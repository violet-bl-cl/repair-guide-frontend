<template lang="html">
  <USlideover
    class="z-50"
    v-model:open="open"
    side="right"
    title="Print label"
    description="Review the part details before printing."
  >
    <template #body>
      <!-- Browser Support -->
      <p v-if="!supported" class="notice error" role="alert">
        This browser can't use Bluetooth printing. Open the page in Chrome or Edge, from https:// or
        http://localhost. Firefox and Safari don't support Web Bluetooth. On iPhone, use the Bluefy
        browser.
      </p>
      <ul v-if="warnings.length" class="notice warn">
        <li v-for="w in warnings" :key="w">{{ w }}</li>
      </ul>

      <!-- <div v-if="currentPart" class="space-y-3 text-sm">
        <div>Basic Information</div>
        <div><span class="text-muted">Barcode:</span> {{ barcode }}</div>
        <div><span class="text-muted">Brand:</span> {{ currentPart.brand }}</div>
        <div><span class="text-muted">Name:</span> {{ currentPart.name }}</div>
        <div><span class="text-muted">Part:</span> {{ currentPart.partType }}</div>
        <div><span class="text-muted">Model:</span> {{ currentPart.model }}</div>
        <div><span class="text-muted">Quantity:</span> {{ `x${currentPart.quantity}` }}</div>
      </div> -->

      <h1>Label printer Status</h1>
      <p class="status" :data-state="state">
        <span class="dot" aria-hidden="true"></span>
        <template v-if="state === 'connected' || state === 'printing'">Printer connected</template>
        <template v-else-if="state === 'connecting'">Connecting…</template>
        <template v-else>Not connected</template>
      </p>
      <p class="hint">50 × 20 mm. The preview is exactly what prints.</p>
      <USeparator orientation="horizontal" class="h-12" />
      <section class="bench" aria-label="Label preview">
        <div class="sticker">
          <canvas
            ref="preview"
            :aria-label="`Label for ${form.model}, code ${form.code}`"
            role="img"
          ></canvas>
        </div>
      </section>
      <USeparator orientation="horizontal" class="h-12" />
      <div class="flex items-center justify-between gap-4">
        <span>Name:</span>
        <input v-model="form.name" autocomplete="off" />
      </div>
      <div class="flex items-center justify-between gap-4">
        <span>Model:</span>
        <input v-model="form.model" autocomplete="off" />
      </div>
      <div class="flex items-center justify-between gap-4">
        <span>Part:</span>
        <input v-model="form.part" autocomplete="off" />
      </div>
      <div class="flex items-center justify-between gap-4">
        <span>Brand:</span>
        <input v-model="form.brand" autocomplete="off" />
      </div>
      <div class="flex items-center justify-between gap-4">
        <span>QR Code:</span>
        <input v-model="form.code" autocomplete="off" inputmode="text" />
      </div>
      <div class="flex items-center justify-between gap-4">
        <span>Footer:</span>
        <input v-model="form.footer" autocomplete="off" />
      </div>
      <USeparator orientation="horizontal" class="h-6" />
      <details class="more">
        <summary>Printer settings</summary>
        <div class="row">
          <label class="flex items-center justify-between gap-4">
            <span>Bytes per write</span>
            <UInputNumber
              v-model.number="form.chunk"
              type="number"
              min="20"
              max="512"
              step="10"
              :style="{ width: '150px' }"
            />
          </label>
        </div>
        <p class="text-muted">Lower this to 20 if the printout is garbled or missing parts.</p>
        <div class="row">
          <label class="flex items-center justify-between gap-4">
            <span>Text size (dots)</span>
            <UInputNumber
              v-model.number="form.textSize"
              type="number"
              :min="MIN_TEXT"
              :max="MAX_TEXT"
              :style="{ width: '150px' }"
            />
          </label>
        </div>
        <div class="row">
          <label class="flex items-center justify-between gap-4">
            <span>Text Weight</span>
            <UInputNumber
              v-model.number="form.textWeight"
              type="number"
              :min="MIN_TEXT"
              :max="MAX_TEXT"
              :style="{ width: '150px' }"
            />
          </label>
        </div>
        <label class="check">
          <input v-model="form.invert" type="checkbox" />
          <span>Invert the image (use if the label prints white on black)</span>
        </label>
      </details>

      <div class="actions">
        <UButton
          v-if="state === 'idle' || state === 'connecting'"
          :label="`${state === 'connecting' ? 'Connecting…' : 'Connect Printer'}`"
          icon=""
          :disabled="!supported || state === 'connecting'"
          @click="connect"
        />
        <UButton
          v-else
          :label="`${state === 'printing' ? 'Printing...' : 'Print Label'}`"
          icon=""
          :disabled="state === 'printing' || !hasCode"
          @click="disconnect"
        />
      </div>

      <button v-if="state === 'connected'" type="button" class="link" @click="disconnect">
        Disconnect
      </button>
    </template>

    <template #footer>
      <div class="flex items-end justify-between gap-2 w-full">
        <UFormField label="Print count">
          <UInputNumber v-model="form.copies" :min="1" :max="100" class="w-32" />
        </UFormField>

        <div class="flex gap-2">
          <UButton label="Cancel" color="neutral" variant="outline" @click="open = false" />
          <UButton
            label="Discoonect"
            icon="i-lucide-printer"
            :disabled="state === 'connected'"
            @click="disconnect"
          />
          <UButton
            label="Print"
            icon="i-lucide-printer"
            :disabled="!printCount || printCount < 1"
            @click="print"
          />
        </div>
      </div>
    </template>
  </USlideover>
</template>
<script setup lang="ts">
import type { Part } from '@/api/partPriceApi'
import { computed, ref, watch } from 'vue'

const props = defineProps<{ currentPart: Part | null }>()
const open = defineModel<boolean>('open', { default: false })

const pad = (n: number | string) => String(n).padStart(3, '0')
const companyPad = (n: number | string) => String(n).padStart(2, '0')
const barcode = computed(() =>
  props.currentPart
    ? `${props.currentPart.year}-${companyPad(props.currentPart.brandId)}-${pad(props.currentPart.modelId)}-${pad(props.currentPart.partId)}`
    : '',
)

const printCount = ref(1)

// reset to 1 each time the panel opens
function fillForm(part: Part | null) {
  form.name = String(part?.name ?? '')
  form.model = String(part?.model ?? '')
  form.part = String(part?.partType ?? '')
  form.brand = String(part?.brand ?? '')
  form.code = barcode.value
}

// Refill each time the panel opens or a different part is selected
watch(
  [() => props.currentPart, open],
  ([part, isOpen]) => {
    if (isOpen) {
      fillForm(part)
      form.copies = 1
    }
  },
  { immediate: true },
)

import { onBeforeUnmount, reactive, watchEffect } from 'vue'
import type { LabelForm } from './../hooks/labelSetup'
import { buildLabelBytes, renderLabel, MAX_TEXT, MIN_TEXT } from './../hooks/labelRender'
import { BlePrinter } from './../hooks/bluetoothPrinter'

type State = 'idle' | 'connecting' | 'connected' | 'printing'

const supported = typeof navigator !== 'undefined' && 'bluetooth' in navigator

const form = reactive<LabelForm>({
  name: `${props.currentPart?.name}`,
  model: `${props.currentPart?.model}`,
  part: `${props.currentPart?.partType}`,
  brand: `${props.currentPart?.brand}`,
  code: barcode.value,
  footer: '21st Century Electronics Limited',
  copies: 1,
  chunk: 100,
  textSize: 18,
  textWeight: 600,
  invert: false,
})

const printer = new BlePrinter()
const state = ref<State>('idle')
const message = ref('')
const isError = ref(false)

const hasCode = computed(() => form.code.trim().length > 0)

// The preview is the exact picture that gets sent to the printer.
const preview = ref<HTMLCanvasElement | null>(null)
const warnings = ref<string[]>([])

watchEffect(
  () => {
    if (preview.value) warnings.value = renderLabel(preview.value, form).warnings
  },
  { flush: 'post' },
)

function say(text: string, error = false) {
  message.value = text
  isError.value = error
}

async function connect() {
  say('')
  state.value = 'connecting'
  try {
    const name = await printer.connect(() => {
      if (state.value !== 'idle')
        say('The printer disconnected. Connect again to keep printing.', true)
      state.value = 'idle'
    })
    state.value = 'connected'
    say(`Connected to ${name}.`)
  } catch (e) {
    state.value = 'idle'
    const err = e as Error
    // NotFoundError just means the person closed the device picker.
    if (err.name !== 'NotFoundError') say(err.message, true)
  }
}

async function print() {
  say('')
  state.value = 'printing'
  try {
    const bytes = buildLabelBytes(form)
    await printer.send(bytes, {
      chunkSize: Math.max(20, Number(form.chunk) || 100),
    })
    say('Sent to the printer.')
  } catch (e) {
    say(`Printing failed: ${(e as Error).message}`, true)
  } finally {
    state.value = printer.connected ? 'connected' : 'idle'
  }
}

function disconnect() {
  state.value = 'idle'
  printer.disconnect()
  say('')
}

onBeforeUnmount(() => printer.disconnect())
</script>
<style lang="scss"></style>
