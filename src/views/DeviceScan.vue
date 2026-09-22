<script setup lang="ts">
import {
  createPart,
  exportParts,
  getPartByIdentifiers,
  updatePartQuantity,
  type Part,
} from '@/api/partPriceApi'
import QRScanner, { type ScannedCode } from '@/components/QRScanner.vue'
import { computed, ref } from 'vue'

const brandNames: Record<number, string> = {
  1: 'Apple',
  2: 'Samsung',
  3: 'Oppo',
  4: 'Huawei',
  5: 'Nokia',
}

const appleModelNames: Record<number, string> = {
  1: 'iPhone 4',
  2: 'iPhone 5',
  3: 'iPhone 6',
  4: 'iPhone 6+',
  5: 'iPhone 6S+',
  6: 'iPhone 7',
  7: 'iPhone 7+',
  8: 'iPhone 8',
  9: 'iPhone 9',
  10: 'iPhone SE (1st)',
  11: 'iPhone SE (2nd)',
  12: 'iPhone X',
  13: 'iPhone XR',
  14: 'iPhone XS',
  15: 'iPhone XS Max',
  16: 'iPhone 11',
  17: 'iPhone 11 Pro',
  18: 'iPhone 11 Pro Max',
  19: 'iPhone 12',
  20: 'iPhone 12 Mini',
  21: 'iPhone 12 Pro',
  22: 'iPhone 12 Pro Max',
  23: 'iPhone 13',
  24: 'iPhone 13 Mini',
  25: 'iPhone 13 Pro',
  26: 'iPhone 13 Pro Max',
  27: 'iPhone 14',
  28: 'iPhone 14 Pro',
  29: 'iPhone 14 Pro Max',
  30: 'iPhone 14+',
  31: 'iPhone 15',
  32: 'iPhone 15 Pro',
  33: 'iPhone 15 Pro Max',
  34: 'iPhone 15+',
  35: 'iPhone 16',
  36: 'iPhone 16 Pro',
  37: 'iPhone 16 Pro Max',
  38: 'iPhone 16+',
  39: 'iPhone 17',
  40: 'iPhone 17 Air',
  41: 'iPhone 17 Pro',
  42: 'iPhone 17 Pro Max',
  43: 'iPhone 6s',
}

const partNames: Record<number, string> = {
  1: 'Screen',
  2: 'Battery',
  3: 'Back Glass',
  4: 'Charging Port',
  5: 'Front Camera',
  6: 'Back Camera',
  7: 'Motherboard',
}

const scannedPart = ref<Part | null>(null)
const scannedCode = ref<ScannedCode | null>(null)
const isLoading = ref(false)
const errorMessage = ref('')
const resultMessage = ref('')
const isExporting = ref(false)

const exportDate = computed(() => {
  return scannedCode.value?.date || new Date().toISOString().slice(0, 10)
})

const exportFileName = computed(() => `century-part-lists-${exportDate.value}.xlsx`)

async function handleScan(_value: string, code: ScannedCode): Promise<void> {
  if (isLoading.value) return

  isLoading.value = true
  errorMessage.value = ''
  resultMessage.value = ''
  scannedCode.value = code

  const identifiers = {
    modelId: Number(code.modelId),
    brandId: Number(code.brandId),
    partId: Number(code.partId),
  }
  const brand = brandNames[identifiers.brandId] ?? `Brand ${identifiers.brandId}`
  const model =
    identifiers.brandId === 1
      ? (appleModelNames[identifiers.modelId] ?? `Model ${identifiers.modelId}`)
      : `Model ${identifiers.modelId}`
  const partType = partNames[identifiers.partId] ?? `Part ${identifiers.partId}`

  try {
    const existingPart = await getPartByIdentifiers(
      identifiers.modelId,
      identifiers.brandId,
      identifiers.partId,
    )

    if (existingPart) {
      scannedPart.value = existingPart
      resultMessage.value = 'Part found. Update its quantity below.'
    } else {
      scannedPart.value = await createPart({
        year: code.date,
        ...identifiers,
        brand,
        model,
        name: `${brand} ${model} ${partType}`,
        partType,
        quantity: 1,
      })
      resultMessage.value = 'New part created with quantity 1.'
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to save part.'
  } finally {
    isLoading.value = false
  }
}

async function changeQuantity(amount: number): Promise<void> {
  if (!scannedPart.value || isLoading.value) return

  const currentQuantity = scannedPart.value.quantity ?? 0
  const nextQuantity = Math.max(0, currentQuantity + amount)
  isLoading.value = true
  errorMessage.value = ''

  try {
    scannedPart.value = await updatePartQuantity({
      modelId: scannedPart.value.modelId,
      brandId: scannedPart.value.brandId,
      partId: scannedPart.value.partId,
      quantity: nextQuantity,
    })
    resultMessage.value = `Quantity saved: ${nextQuantity}.`
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to update quantity.'
  } finally {
    isLoading.value = false
  }
}

async function handleExport(): Promise<void> {
  if (isExporting.value) return

  isExporting.value = true
  errorMessage.value = ''

  try {
    const file = await exportParts()
    const downloadUrl = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = exportFileName.value
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(downloadUrl)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to export parts.'
  } finally {
    isExporting.value = false
  }
}
</script>

<template>
  <div class="device-scan">
    <QRScanner @scan="handleScan" />

    <button class="export-button" :disabled="isExporting" @click="handleExport">
      {{ isExporting ? 'Exporting...' : `Export ${exportFileName}` }}
    </button>

    <section v-if="scannedCode" class="part-result">
      <p class="code">
        {{ scannedCode.date }}-{{ scannedCode.brandId }}-{{ scannedCode.modelId }}-{{
          scannedCode.partId
        }}
      </p>
      <p v-if="isLoading">Saving...</p>
      <p v-if="resultMessage" class="success">{{ resultMessage }}</p>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

      <div v-if="scannedPart" class="quantity-controls">
        <span>Quantity: {{ scannedPart.quantity ?? 0 }}</span>
        <button
          :disabled="isLoading || (scannedPart.quantity ?? 0) === 0"
          @click="changeQuantity(-1)"
        >
          Decrease
        </button>
        <button :disabled="isLoading" @click="changeQuantity(1)">Increase</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.device-scan {
  max-width: 480px;
  margin: 0 auto;
}

.part-result {
  margin-top: 16px;
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

.export-button {
  width: 100%;
  margin-top: 16px;
  padding: 10px 12px;
  border: 1px solid #2563eb;
  border-radius: 8px;
  background: #2563eb;
  color: #fff;
  cursor: pointer;
}

.export-button:disabled {
  cursor: wait;
  opacity: 0.7;
}

.code {
  margin: 0 0 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.success {
  color: #16a34a;
}

.error {
  color: #dc2626;
}

.quantity-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.quantity-controls span {
  margin-right: auto;
}

.quantity-controls button {
  width: auto;
  margin-top: 0;
  padding: 8px 12px;
}
</style>
