<script setup lang="ts">
import { searchParts, type Part } from '@/api/partPriceApi'
import LabelPrintPopUp from '@/components/LabelPrintPopUp.vue'
import type { TableColumn } from '@nuxt/ui'
import axios from 'axios'
import { computed, h, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { updatePartQuantity } from '@/api/partPriceApi'
import { useToast } from '@nuxt/ui/runtime/composables/useToast.js'
type PartsResponse = { data: Part[]; total: number }

// --- source state ---
const response = shallowRef<PartsResponse | null>(null)
const rows = ref<Part[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(30)
const isLoading = ref(false)
const error = ref<string | null>(null)
//popup status
const slideOverOpen = ref(false)
const selectedPart = ref<Part | null>(null)

function printLabel(part: Part) {
  selectedPart.value = part
  slideOverOpen.value = true
}
//
const toast = useToast()

// edited quantities, keyed by part id. A row is "modified" only if it has an entry here.
const edits = ref<Record<string | number, number>>({})
const savingKey = ref<string | number | null>(null)
const keyOf = (p: Part) => `${p.brandId}-${p.modelId}-${p.partId}`
const currentQty = (p: Part) => edits.value[p.id] ?? p.quantity ?? 0
const isDirty = (p: Part) =>
  edits.value[p.id] !== undefined && edits.value[p.id] !== (p.quantity ?? 0)

function changeQty(p: Part, delta: number) {
  const next = Math.max(0, currentQty(p) + delta)
  if (next === (p.quantity ?? 0)) {
    delete edits.value[p.id] // back to the original value, so hide Confirm
  } else {
    edits.value[p.id] = next
  }
}

function cancelEdit(p: Part) {
  delete edits.value[p.id]
}

async function confirmQty(p: Part) {
  const newQty = edits.value[p.id]
  if (newQty === undefined) return

  savingKey.value = p.id
  try {
    await updatePartQuantity({
      partId: p.partId,
      quantity: newQty,
      modelId: p.modelId,
      brandId: p.brandId,
    })
    // update the table row locally and clear the edit
    rows.value = rows.value.map((r) => (r.id === p.id ? { ...r, quantity: newQty } : r))
    delete edits.value[p.id]
    toast.add({ title: 'Quantity updated', color: 'success' })
  } catch (e) {
    toast.add({ title: 'Failed to update quantity', color: 'error' })
  } finally {
    savingKey.value = null
  }
}

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
    header: 'Barcode',
    accessorFn: (row) => `${row.year}-${pad(row.brandId)}-${pad(row.modelId)}-${pad(row.partId)}`,
  },
  // { accessorKey: 'id', header: 'Product ID' },
  { accessorKey: 'brand', header: 'Brand' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'partType', header: 'Part Name' },
  {
    id: 'quantity', // use id (not accessorKey) when accessorFn is used
    header: 'Quantity',
    accessorFn: (row) => row.quantity ?? 0,
    cell: ({ getValue }) => {
      const qty = getValue<number>()

      return h('div', { class: 'flex items-center gap-1.5' }, [
        h('span', `x${qty}`),
        qty <= 1
          ? h('span', { class: 'text-red-500 font-semibold' }, '(Low Stock)')
          : h('span', { class: 'text-green-500 font-semibold' }, '(In Stock)'),
      ])
    },
  },
  { accessorKey: 'model', header: 'Model Number' },
  {
    accessorKey: 'description',
    header: 'Detail',
    accessorFn: (row) => (row.description?.trim() === '' ? 'N/A' : row.description),
  },
  {
    id: 'print-label', // not a Part field, so it needs an id instead of accessorKey
    header: 'Print',
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
  <div class="flex flex-col p-3" :style="{ height: `calc(100vh - 63px)` }">
    <div class="flex flex-wrap items-center gap-2 m-3">
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
        th: 'px-2 py-1.5 text-[10.5px]',
        td: 'px-2 py-1 text-[10.5px]',
      }"
      class="flex-1"
    >
      <template #quantity-cell="{ row }">
        <div class="flex items-center gap-1">
          <UButton
            icon="i-lucide-minus"
            color="neutral"
            variant="outline"
            size="2xs"
            :ui="{ base: 'rounded-sm' }"
            :disabled="currentQty(row.original) <= 0 || savingKey === keyOf(row.original)"
            @click="changeQty(row.original, -1)"
          />
          <span class="min-w-6 text-center">{{ currentQty(row.original) }}</span>
          <UButton
            icon="i-lucide-plus"
            color="neutral"
            variant="outline"
            size="2xs"
            :ui="{ base: 'rounded-sm' }"
            :disabled="savingKey === keyOf(row.original)"
            @click="changeQty(row.original, 1)"
          />

          <span
            class="font-semibold"
            :class="currentQty(row.original) <= 1 ? 'text-red-500' : 'text-green-500'"
          >
            {{ currentQty(row.original) <= 1 ? '(Low Stock)' : '(In Stock)' }}
          </span>

          <template v-if="isDirty(row.original)">
            <UButton
              label="Confirm"
              size="2xs"
              :ui="{ base: 'rounded-sm' }"
              :loading="savingKey === keyOf(row.original)"
              @click="confirmQty(row.original)"
            />
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="2xs"
              aria-label="Cancel"
              :ui="{ base: 'rounded-sm' }"
              :disabled="savingKey === keyOf(row.original)"
              @click="cancelEdit(row.original)"
            />
          </template>
        </div>
      </template>

      <template #print-label-cell="{ row }">
        <UButton
          icon="i-lucide-printer"
          color="neutral"
          variant="outline"
          size="xs"
          aria-label="Print label"
          @click="printLabel(row.original)"
        />
      </template>
    </UTable>

    <p v-if="isEmpty" class="text-center text-sm text-muted py-4">
      {{ hasSearch ? 'No parts match your search.' : 'No parts found.' }}
    </p>

    <div class="flex items-center justify-between px-2 py-3 border-t border-default">
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
  </div>
  <LabelPrintPopUp v-model:open="slideOverOpen" :current-part="selectedPart" />
</template>
