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
          :disabled="!brandId || !partId || !form.name.trim() || !form.model.trim() || creating"
          @click="handleCreate"
        />
      </div>
    </template>
  </USlideover>
</template>

<script setup lang="ts">
import type { LabelForm } from '@/hooks/labelSetup'
import { partTypes } from '@/constants/parts'
import { brandNames } from '@/constants/brand'
import { findOrCreatePart } from '@/api/partPriceApi'
import axios from 'axios'
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
    form.copies = 1
    brandId.value = undefined
    partId.value = undefined
  }
})

async function handleCreate() {
  if (!brandId.value || !partId.value) return

  creating.value = true
  try {
    // The server finds the existing device (same brand + name + model) and reuses its
    // model number, or creates a new model number. modelId and year here are placeholders.
    const res = await findOrCreatePart({
      year: String(new Date().getFullYear()),
      modelId: 0,
      brandId: brandId.value,
      partId: partId.value,
      brand: form.brand,
      model: form.model.trim(),
      name: form.name.trim(),
      partType: form.part,
      quantity: 1,
    })

    form.code = res.barcode

    toast.add({
      title: res.modelCreated ? 'New model created' : 'Added to existing model',
      description: `Barcode ${res.barcode}`,
      color: 'success',
    })
  } catch (e) {
    // show the server's message, e.g. "This part already exists: 2026-01-030-001"
    const message = axios.isAxiosError(e)
      ? (e.response?.data?.message ?? e.message)
      : (e as Error).message

    toast.add({
      title: 'Could not create part',
      description: String(message),
      color: 'error',
    })
  } finally {
    creating.value = false
  }
}
</script>
