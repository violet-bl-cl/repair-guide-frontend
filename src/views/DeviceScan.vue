<script setup lang="ts">
import { createPart, getPartByIdentifiers, updatePartQuantity, type Part } from '@/api/partPriceApi'
import QRScanner, { type ScannedCode } from '@/components/QRScanner.vue'
import { ref } from 'vue'

const scannedPart = ref<Part | null>(null)
const scannedCode = ref<ScannedCode | null>(null)
const isLoading = ref(false)
const errorMessage = ref('')
const resultMessage = ref('')

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
</script>

<template>
  <div class="device-scan">
    <QRScanner @scan="handleScan" />

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
