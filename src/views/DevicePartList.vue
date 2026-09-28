<script setup lang="ts">
import { searchParts, type Part } from '@/api/partPriceApi'
import type { TableColumn } from '@nuxt/ui'
import axios from 'axios'
import { computed, h, onBeforeUnmount, ref, shallowRef, watch } from 'vue'

type PartsResponse = { data: Part[]; total: number }

// --- source state ---
const response = shallowRef<PartsResponse | null>(null)
const rows = ref<Part[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const isLoading = ref(false)
const error = ref<string | null>(null)

// --- search state ---
// `search` is bound to the inputs and changes on every keystroke.
// `appliedSearch` only updates after the user stops typing, and that is what triggers a fetch.
const search = ref({ brand: '', name: '', model: '' })
const appliedSearch = ref({ brand: '', name: '', model: '' })

let debounceTimer: ReturnType<typeof setTimeout> | undefined

watch(
  search,
  (val) => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      appliedSearch.value = { ...val }
      page.value = 1 // new search always starts at page 1
    }, 400)
  },
  { deep: true },
)

onBeforeUnmount(() => clearTimeout(debounceTimer))

function clearSearch() {
  clearTimeout(debounceTimer)
  search.value = { brand: '', name: '', model: '' }
  appliedSearch.value = { brand: '', name: '', model: '' }
  page.value = 1
}

const hasSearch = computed(() => Object.values(search.value).some((v) => v.trim() !== ''))

// --- derived state ---
const params = computed(() => ({
  page: page.value,
  pageSize: pageSize.value,
  brand: appliedSearch.value.brand.trim() || undefined,
  name: appliedSearch.value.name.trim() || undefined,
  model: appliedSearch.value.model.trim() || undefined,
}))

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const rangeStart = computed(() => (total.value === 0 ? 0 : (page.value - 1) * pageSize.value + 1))
const rangeEnd = computed(() => Math.min(page.value * pageSize.value, total.value))
const isEmpty = computed(() => !isLoading.value && !error.value && rows.value.length === 0)

// padding method
const pad = (n: number | string) => String(n).padStart(3, '0')

const columns = computed<TableColumn<Part>[]>(() => [
  {
    id: 'code',
    header: 'Qr-Code',
    accessorFn: (row) => `${row.year}-${pad(row.brandId)}-${pad(row.modelId)}-${pad(row.partId)}`,
  },
  { accessorKey: 'id', header: 'Product Id' },
  { accessorKey: 'brand', header: 'Brand' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'model', header: 'Model Number' },
  { accessorKey: 'partType', header: 'Part Name' },
  {
    id: 'quantity', // use id (not accessorKey) when accessorFn is used
    header: 'Quantity',
    accessorFn: (row) => row.quantity ?? 0,
    cell: ({ getValue }) => {
      const qty = getValue<number>()

      return h('div', { class: 'flex items-center gap-1.5' }, [
        h('span', `x${qty}`),
        qty <= 1 ? h('span', { class: 'text-red-500 font-semibold' }, '(Low Stock)') : null,
      ])
    },
  },
  {
    accessorKey: 'description',
    header: 'Detail',
    accessorFn: (row) => (row.description?.trim() === '' ? 'N/A' : row.description),
  },
  {
    id: 'print-label', // not a Part field, so it needs an id instead of accessorKey
    header: 'Label Print (not ready)',
  },
])

// --- fetching ---
let controller: AbortController | null = null

async function fetchParts() {
  controller?.abort()
  const current = new AbortController()
  controller = current

  isLoading.value = true
  error.value = null

  try {
    const result: any = await searchParts(params.value, current.signal)

    response.value = Array.isArray(result)
      ? { data: result, total: result.length }
      : { data: result?.data ?? [], total: result?.total ?? 0 }
  } catch (e) {
    if (axios.isCancel(e)) return
    error.value = axios.isAxiosError(e)
      ? (e.response?.data?.message ?? e.message)
      : 'Failed to load parts'
    response.value = null
  } finally {
    if (controller === current) isLoading.value = false
  }
}

// refetch whenever page, pageSize or an applied search term changes (and once on mount)
watch(params, fetchParts, { immediate: true })

// changing page size jumps back to page 1
watch(pageSize, () => {
  page.value = 1
})

watch(
  response,
  (val) => {
    rows.value = [...(val?.data ?? [])]
    total.value = val?.total ?? 0
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 mb-3">
    <UInput v-model="search.brand" icon="i-lucide-search" placeholder="Brand" size="sm" />
    <UInput v-model="search.name" icon="i-lucide-search" placeholder="Name" size="sm" />
    <UInput v-model="search.model" icon="i-lucide-search" placeholder="Model number" size="sm" />
    <UButton
      v-if="hasSearch"
      label="Clear"
      color="neutral"
      variant="ghost"
      size="sm"
      @click="clearSearch"
    />
  </div>

  <p v-if="error" class="text-red-500 text-sm">{{ error }}</p>

  <UTable
    :data="rows"
    :columns="columns"
    :loading="isLoading"
    :ui="{
      base: 'table-fixed',
      th: 'text-[10.5px]',
      td: 'text-[10.5px]',
    }"
    class="flex-1"
  />

  <p v-if="isEmpty" class="text-center text-sm text-muted py-4">
    {{ hasSearch ? 'No parts match your search.' : 'No parts found.' }}
  </p>

  <div class="flex items-center justify-between px-2 py-3">
    <span class="text-sm text-muted">
      Showing {{ rangeStart }}-{{ rangeEnd }} of {{ total }} (page {{ page }} of {{ totalPages }})
    </span>

    <UPagination
      v-model:page="page"
      active-color="neutral"
      :items-per-page="pageSize"
      :total="total"
    />
  </div>
</template>
