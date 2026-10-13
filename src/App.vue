<script setup lang="ts">
import { computed, ref } from 'vue'
import { exportParts } from './api/partPriceApi'

const menus = [
  { label: '', icon: 'i-lucide-circle-dollar-sign', to: '/part-repair' },
  { label: '', icon: 'i-lucide-database-search', to: '/part-list' },
  { label: '', icon: 'i-lucide-scan-qr-code', to: '/part-scan' },
  {
    label: '',
    icon: 'i-lucide-sheet',
    onSelect: () => handleExport(),
  },
]
const isExporting = ref(false)
const exportFileName = computed(
  () => `all-device-parts-${new Date().toISOString().slice(0, 10)}.xlsx`,
)

async function handleExport(): Promise<void> {
  if (isExporting.value) return

  isExporting.value = true

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
  } finally {
    isExporting.value = false
  }
}
</script>

<template>
  <UApp :toaster="{ position: 'top-center' }">
    <UHeader>
      <template #left>
        <RouterLink to="/" class="flex items-center gap-2">
          <img src="/centuryImgbw.png" alt="Dashboard" class="h-8 w-auto" />
        </RouterLink>
      </template>

      <UNavigationMenu :items="menus" />

      <template #right>
        <UColorModeButton />
      </template>

      <template #body>
        <UNavigationMenu :items="menus" orientation="vertical" class="-mx-2.5" />
      </template>
    </UHeader>

    <UMain>
      <RouterView />
    </UMain>
  </UApp>
</template>

<style scoped></style>
