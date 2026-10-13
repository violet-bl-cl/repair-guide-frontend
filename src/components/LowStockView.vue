<script setup lang="ts">
import { getLowStockParts, type Part } from '@/api/partPriceApi'
import type { TableColumn } from '@nuxt/ui'
import axios from 'axios'
import { ref, watch } from 'vue'

const rows = ref<Part[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(30)
const isLoading = ref(false)
const error = ref<string | null>(null)

let controller: AbortController | null = null

async function fetchLowStock() {
  controller?.abort()
  const current = new AbortController()
  controller = current

  isLoading.value = true
  error.value = null

  try {
    const result = await getLowStockParts(
      { page: page.value, pageSize: pageSize.value, maxQuantity: 1 },
      current.signal,
    )
    rows.value = result.data ?? []
    total.value = result.total ?? 0
  } catch (e) {
    if (axios.isCancel(e)) return
    error.value = 'Failed to load low stock parts'
  } finally {
    if (controller === current) isLoading.value = false
  }
}

// refetch on page change, and once on mount
watch(page, fetchLowStock, { immediate: true })

// lets a parent refresh the list, e.g. after a quantity update
defineExpose({ refresh: fetchLowStock })

const columns: TableColumn<Part>[] = [
  { accessorKey: 'brand', header: 'Brand' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'partType', header: 'Part Name' },
  { id: 'quantity', header: 'Qty', accessorFn: (row) => row.quantity ?? 0 },
  { accessorKey: 'model', header: 'Model' },
]
</script>

<template>
  <div class="flex flex-col" :style="{ height: 'calc(100% - 63px)' }">
    <div class="flex items-center justify-between px-2 py-1 border-b border-default">
      <span class="text-xs font-semibold">Low Stock</span>
      <span class="text-xs text-muted">{{ total }} items</span>
    </div>

    <p v-if="error" class="px-2 py-1 text-xs text-red-500">{{ error }}</p>

    <div class="relative flex-1 min-h-0">
      <UTable
        :data="rows"
        :columns="columns"
        :ui="{
          root: 'h-full overflow-auto',
          base: 'table-fixed',
          thead: 'sticky top-0 z-10 bg-default',
          th: 'px-2 py-1 text-[10.5px]',
          td: 'px-2 py-0.5 text-[10.5px]',
        }"
      >
        <template #quantity-cell="{ row }">
          <span class="font-semibold text-red-500">x{{ row.original.quantity ?? 0 }}</span>
        </template>
      </UTable>

      <div
        v-if="isLoading"
        class="absolute inset-0 z-20 flex items-center justify-center bg-default/60"
      >
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-primary" />
      </div>
    </div>

    <div class="flex items-center justify-end px-2 py-1 border-t border-default">
      <UPagination
        v-model:page="page"
        size="xs"
        active-color="neutral"
        :items-per-page="pageSize"
        :total="total"
      />
    </div>
  </div>
</template>
