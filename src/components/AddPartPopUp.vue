<template lang="html">
  <USlideover
    class="z-50"
    v-model:open="open"
    side="right"
    title="Print label"
    description="Review the part details before printing."
  >
    <template #body>
      <div class="space-y-4">
        <div class="flex items-center justify-between gap-4">
          <span class="shrink-0">Name:</span>
          <UInput v-model="form.name" autocomplete="off" class="w-56" />
        </div>

        <div class="flex items-center justify-between gap-4">
          <span class="shrink-0">Model:</span>
          <UInput v-model="form.model" autocomplete="off" class="w-56" />
        </div>

        <div class="flex items-center justify-between gap-4">
          <span class="shrink-0">Brand:</span>
          <USelect
            v-model="brandId"
            :items="brandItems"
            placeholder="Select brand"
            class="w-56"
            :ui="{ content: 'z-[100]' }"
          />
        </div>

        <div class="flex items-center justify-between gap-4">
          <span class="shrink-0">Part:</span>
          <USelectMenu
            v-model="partId"
            :items="partItems"
            value-key="value"
            placeholder="Select part"
            class="w-56"
            :ui="{ content: 'z-[100]' }"
          />
        </div>

        <p v-if="form.code" class="text-sm text-muted">Barcode: {{ form.code }}</p>
      </div>
    </template>

    <template #footer>
      <div class="flex items-end justify-between gap-2 w-full">
        <UButton label="Cancel" color="neutral" variant="outline" @click="open = false" />
        <UButton
          label="Create part"
          icon="i-lucide-plus"
          :loading="creating"
          :disabled="!brandId || !partId || creating"
          @click="handleCreate"
        />
      </div>
    </template>
  </USlideover>
</template>

<script setup lang="ts">
import type { LabelForm } from '@/hooks/labelSetup'
import { partTypes } from '@/constants/parts' // adjust
import { brandNames } from '@/constants/brand'
import { createPart, getMaxModelId } from '@/api/partPriceApi'
import { reactive, ref, watch } from 'vue'
import { useToast } from '@nuxt/ui/runtime/composables/useToast.js'

const open = defineModel<boolean>('open', { default: false })
const toast = useToast()

const form = reactive<LabelForm>({
  name: '',
  model: '',
  part: '',
  brand: '',
  code: '',
  footer: '21st Century Electronics Limited',
  copies: 1,
  chunk: 100,
  textSize: 18,
  textWeight: 600,
  invert: false,
})

const toItems = (record: Record<number, string>) =>
  Object.entries(record).map(([id, label]) => ({ label, value: Number(id) }))

const brandItems = toItems(brandNames)
const partItems = toItems(partTypes)

const brandId = ref<number | undefined>()
const partId = ref<number | undefined>()
const creating = ref(false)

watch(brandId, (id) => {
  form.brand = id ? (brandNames[id] ?? '') : ''
})
watch(partId, (id) => {
  form.part = id ? (partTypes[id] ?? '') : ''
})

watch(open, (isOpen) => {
  if (!isOpen) {
    form.name = ''
    form.model = ''
    form.brand = ''
    form.part = ''
    form.code = ''
    brandId.value = undefined
    partId.value = undefined
  }
})

const pad = (n: number, len = 3) => String(n).padStart(len, '0')

async function handleCreate() {
  if (!brandId.value || !partId.value) return

  creating.value = true
  try {
    // 1. highest model number used by this brand
    const { maxModelId } = await getMaxModelId(brandId.value)
    const modelId = maxModelId + 1
    const year = String(new Date().getFullYear())

    // 2. create the part with the next model number
    const created = await createPart({
      year,
      brandId: brandId.value,
      modelId,
      partId: partId.value,
      brand: form.brand,
      model: form.model,
      name: form.name,
      partType: form.part,
      quantity: 1,
    })

    // 3. show the new barcode so it can be printed
    form.code = `${year}-${pad(brandId.value, 2)}-${pad(modelId)}-${pad(partId.value)}`

    toast.add({
      title: 'Part created',
      description: `Barcode ${form.code}`,
      color: 'success',
    })
    return created
  } catch (e) {
    toast.add({
      title: 'Could not create part',
      description: (e as Error).message,
      color: 'error',
    })
  } finally {
    creating.value = false
  }
}
</script>
