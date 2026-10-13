<template lang="html">
  <USlideover
    class="z-50"
    v-model:open="open"
    side="right"
    title="Print label"
    description="Review the part details before printing."
  >
    <template #body>
      <div v-if="currentPart" class="space-y-3 text-sm">
        <div>Basic Information</div>
        <div><span class="text-muted">Barcode:</span> {{ barcode }}</div>
        <div><span class="text-muted">Brand:</span> {{ currentPart.brand }}</div>
        <div><span class="text-muted">Name:</span> {{ currentPart.name }}</div>
        <div><span class="text-muted">Part:</span> {{ currentPart.partType }}</div>
        <div><span class="text-muted">Model:</span> {{ currentPart.model }}</div>
        <div><span class="text-muted">Quantity:</span> {{ `x${currentPart.quantity}` }}</div>
      </div>
    </template>

    <template #footer>
      <div class="flex items-end justify-between gap-2 w-full">
        <UFormField label="Print count">
          <UInputNumber v-model="printCount" :min="1" :max="100" class="w-32" />
        </UFormField>

        <div class="flex gap-2">
          <UButton label="Cancel" color="neutral" variant="outline" @click="open = false" />
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

function print() {
  console.log('implement print here')
}
const barcode = computed(() =>
  props.currentPart
    ? `${props.currentPart.year}-${pad(props.currentPart.brandId)}-${pad(props.currentPart.modelId)}-${pad(props.currentPart.partId)}`
    : '',
)

const printCount = ref(1)

// reset to 1 each time the panel opens
watch(open, (isOpen) => {
  if (isOpen) printCount.value = 1
})
</script>
<style lang="scss"></style>
