<script setup lang="ts">
import { createPart, getPartByIdentifiers, updatePartQuantity, type Part } from '@/api/partPriceApi'
import QRScanner, { type ScannedCode } from '@/components/QRScanner.vue'
import { brandNames } from '@/constants/brand'
import { partTypes } from '@/constants/parts'
import { ref } from 'vue'
// user textfields
const userInputs = ref<{
  part: {
    model: string
    description: string
  }
}>({
  part: {
    model: '',
    description: '',
  },
})
const isCreated = ref(false)
const nextQuantity = ref(0)

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
      nextQuantity.value = existingPart.quantity ?? 0
      resultMessage.value = `Name: ${scannedPart.value.name}\n Model: ${scannedPart.value.model}\n Part found. Update its quantity below.`
    } else {
      scannedPart.value = null
      nextQuantity.value = 0
      userInputs.value.part.model = ''
      userInputs.value.part.description = ''
      isCreated.value = true
      //add new input field for the apple and brand, description
      resultMessage.value = 'New part found. Update its model and description below.'
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to save part.'
  } finally {
    isLoading.value = false
  }
}

async function insertPart(): Promise<boolean> {
  if (!scannedCode.value || isLoading.value) return false

  isLoading.value = true
  errorMessage.value = ''

  try {
    const brandId = Number.parseInt(scannedCode.value.brandId)
    const modelId = Number.parseInt(scannedCode.value.modelId)
    const partId = Number.parseInt(scannedCode.value.partId)
    const brand = brandNames[brandId] ?? `Brand ${brandId}`
    const partType = partTypes[partId] ?? `Part ${partId}`
    const model = userInputs.value.part.model.trim()
    const description = userInputs.value.part.description.trim()

    scannedPart.value = await createPart({
      year: scannedCode.value.date,
      modelId,
      partId,
      brandId,
      brand,
      model,
      name: `${brand} ${model} ${partType}`,
      partType,
      quantity: 1,
      description,
    })
    nextQuantity.value = scannedPart.value.quantity ?? 1
    isCreated.value = false
    resultMessage.value = `New part created. Quantity: ${nextQuantity.value}.`
    return true
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to create part.'
    return false
  } finally {
    isLoading.value = false
  }
}

async function changeQuantity(amount: number): Promise<void> {
  if (!scannedPart.value) return
  nextQuantity.value = Math.max(0, nextQuantity.value + amount)
}
async function updateQuantity(): Promise<void> {
  if (!scannedPart.value || isLoading.value) return
  isLoading.value = true
  errorMessage.value = ''
  try {
    scannedPart.value = await updatePartQuantity({
      modelId: scannedPart.value.modelId,
      brandId: scannedPart.value.brandId,
      partId: scannedPart.value.partId,
      quantity: nextQuantity.value,
    })
    resultMessage.value = `Name: ${scannedPart.value.name}\n Model:${scannedPart.value.model}\n Quantity saved: ${nextQuantity.value}.`
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

      <!-- insert device scan -->
      <div v-if="isCreated" class="quantity-controls">
        <span
          >Model:
          <input
            v-model="userInputs.part.model"
            type="text"
            placeholder="model..."
            class="flex flex-start p-2 mb-4"
        /></span>
        <span
          >Description:
          <input
            v-model="userInputs.part.description"
            type="text"
            placeholder="description..."
            class="flex flex-start p-2 mb-4"
          />
        </span>
        <button :disabled="isLoading" @click="insertPart" class="export-button">
          {{ isLoading ? 'Creating...' : 'Create' }}
        </button>
      </div>

      <div v-if="scannedPart && !isLoading" class="quantity-controls">
        <span>Quantity: {{ nextQuantity ?? 0 }}</span>
        <button :disabled="isLoading || nextQuantity === 0" @click="changeQuantity(-1)">
          Decrease
        </button>
        <button :disabled="isLoading" @click="changeQuantity(1)">Increase</button>
        <button :disabled="isLoading" @click="updateQuantity()" class="export-button">
          Update Quantity
        </button>
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
