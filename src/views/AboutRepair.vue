<script lang="ts" setup>
import {
  exportParts,
  getPartByIdentifiers,
  getPrice,
  getPrices,
  type PriceResult,
} from '@/api/partPriceApi.ts'
import { appleDevice } from '@/data/appleDevice'
import { oppoDevice } from '@/data/oppoDevice'
import { samsungDevice } from '@/data/samsungDevice'
import type { DeviceModel } from '@/types/repairGuide'
import { FileSpreadsheet, ScanLine, TabletSmartphone } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import AppleIcon from './../components/icons/AppleIcon.vue'
import PriceList from './../components/PriceList.vue'
const allDevices = ref<DeviceModel[]>([...appleDevice, ...samsungDevice, ...oppoDevice])
const searchKeyword = ref('')

const filteredDevices = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()

  let devices = allDevices.value
  if (tabIndex.value === 1) {
    devices = devices.filter((d) => d.repairGuide.deviceType.brand === 'Apple')
  } else if (tabIndex.value === 2) {
    devices = devices.filter((d) => d.repairGuide.deviceType.brand === 'Samsung')
  } else if (tabIndex.value === 3) {
    devices = devices.filter((d) => d.repairGuide.deviceType.brand === 'Oppo')
  }

  if (!keyword) return devices
  return allDevices.value.filter((device) =>
    device.repairGuide.deviceType.model.toLowerCase().includes(keyword),
  )
})
//tab index for models
const tabIndex = ref(0)

const setTabIndex = (value: number) => {
  tabIndex.value = value
}

const pageIndex = ref(0)
const setPageIndex = (value: number) => {
  pageIndex.value = value
}

//get api here
// --- Single lookup ---
const secondUrl = ref(
  'https://nzsunnyway.co.nz/product/original-lcd-screen-for-samsung-galaxy-s25-ultra-sm-s938-with-black-frame-a-grade/',
)
const singleUrl = ref('https://nzsunnyway.co.nz/product/lcd-screen-samsung-a30s/')
const singleLoading = ref(false)
const singleError = ref<string | null>(null)
const singleResult = ref<PriceResult | null>(null)

async function handleSingleLookup() {
  singleLoading.value = true
  singleError.value = null
  singleResult.value = null

  try {
    singleResult.value = await getPrice(secondUrl.value)
  } catch (e: any) {
    singleError.value = e.response?.data?.message || e.message
  } finally {
    singleLoading.value = false
  }
}

// --- Bulk lookup ---
const bulkUrls = ref([
  'https://nzsunnyway.co.nz/product/lcd-screen-samsung-a30s/',
  'https://nzsunnyway.co.nz/product/lcd-screen-samsung-a50/',
])
const bulkLoading = ref(false)
const bulkError = ref<string | null>(null)
const bulkResults = ref<PriceResult[]>([])
const isExporting = ref(false)

const exportFileName = computed(
  () => `century-part-lists-${new Date().toISOString().slice(0, 10)}.xlsx`,
)

async function handleBulkLookup() {
  bulkLoading.value = true
  bulkError.value = null
  bulkResults.value = []

  try {
    bulkResults.value = await getPrices(bulkUrls.value)
  } catch (e: any) {
    bulkError.value = e.response?.data?.message || e.message
  } finally {
    bulkLoading.value = false
  }
}

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

onMounted(async () => {
  handleSingleLookup()
  handleBulkLookup()
  //testing
  const part = await getPartByIdentifiers(2, 1, 3)
  console.log(part)
})
</script>
<template>
  <div class="flex flex-col sticky repair-header top-0 z-10 w-[100%]">
    <div class="flex justify-between top-0 z-10 bg-white p-2 repair-header">
      <div>
        <input
          v-model="searchKeyword"
          type="text"
          placeholder="Search model: iPhone x..."
          class="flex flex-start p-2 mb-4"
        />
      </div>
      <div class="flex-end flex gap-0.5">
        <RouterLink
          to="/scan"
          aria-label="Open QR scanner"
          title="Open QR scanner"
          class="bg-[#16a34a] hover:bg-[#15803d] w-10 h-10 flex justify-center rounded items-center cursor-pointer"
        >
          <ScanLine :size="20" color="white" />
        </RouterLink>
        <button
          class="bg-[#2563eb] hover:bg-[#1d4ed8] w-10 h-10 flex justify-center rounded items-center cursor-pointer"
          :disabled="isExporting"
          aria-label="Export parts to Excel"
          title="Export parts to Excel"
          @click="handleExport"
        >
          <FileSpreadsheet :size="20" color="white" />
        </button>
        <div
          :style="{ backgroundColor: tabIndex === 0 ? '#b3b3b3' : '#ffffff' }"
          class="bg-[#ffffff] hover:bg-[#4c4c4c] w-10 h-10 flex justify-center rounded items-center cursor-pointer select-none"
          @click="setTabIndex(0)"
        >
          <TabletSmartphone :style="{ color: 'black' }" />
        </div>
        <div
          :style="{ backgroundColor: tabIndex === 1 ? '#b3b3b3' : '#ffffff' }"
          class="bg-[#ffffff] hover:bg-[#4c4c4c] w-10 h-10 flex justify-center rounded items-center cursor-pointer select-none"
          @click="setTabIndex(1)"
        >
          <AppleIcon />
        </div>
        <div
          :style="{ backgroundColor: tabIndex === 2 ? '#b3b3b3' : '#ffffff' }"
          class="bg-[#ffffff] hover:bg-[#4c4c4c] w-10 h-10 flex justify-center rounded items-center cursor-pointer select-none"
          @click="setTabIndex(2)"
        >
          <SamsungIcon />
        </div>
        <div
          :style="{ backgroundColor: tabIndex === 3 ? '#b3b3b3' : '#ffffff' }"
          class="bg-[#ffffff] hover:bg-[#4c4c4c] w-10 h-10 flex justify-center rounded items-center cursor-pointer select-none"
          @click="setTabIndex(3)"
        >
          <OppoIcon />
        </div>
      </div>
      <!-- <div name="find-my-imei" class="pl-2">
      <input
        v-model="searchKeyword"
        type="text"
        placeholder="Enter IMEI or SN..."
        class="flex flex-start p-2 mb-4"
      />
    </div> -->
    </div>
    <div class="flex repair-info bg-white text-xs border-b-1 sticky top-0 z-10 pb-2">
      <div
        class="p-2 text-sm rounded cursor-pointer"
        :style="{
          backgroundColor: pageIndex === 0 ? '#b3b3b3' : '#ffffff',
          fontWeight: pageIndex === 0 ? 'bold' : 'normal',
        }"
        @click="setPageIndex(0)"
      >
        21st Century
      </div>
      <div
        class="p-2 text-sm rounded cursor-pointer"
        :style="{
          backgroundColor: pageIndex === 1 ? '#b3b3b3' : '#ffffff',
          fontWeight: pageIndex === 1 ? 'bold' : 'normal',
        }"
        @click="setPageIndex(1)"
      >
        NZSunnyWay
      </div>
    </div>
  </div>
  <!-- API TEST -->
  <!-- <div>
    {{ singleResult || 'Get Price' }}
  </div> -->
  <!-- <div>{{ bulkResults }}</div> -->
  <div class="grid grid-cols-3 gap-4 justify-center min-width-[1000px] repair-list">
    <PriceList v-if="pageIndex === 0" :devices="filteredDevices" />
    <PriceList v-else-if="pageIndex === 1" :devices="filteredDevices" />
  </div>
</template>

<style scoped>
header {
  line-height: 1.5;
  max-height: 100vh;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

nav {
  width: 100%;
  font-size: 12px;
  text-align: center;
  margin-top: 2rem;
}

nav a.router-link-exact-active {
  color: var(--color-text);
}

nav a.router-link-exact-active:hover {
  background-color: transparent;
}

nav a {
  display: inline-block;
  padding: 0 1rem;
  border-left: 1px solid var(--color-border);
}

nav a:first-of-type {
  border: 0;
}

@media (min-width: 1024px) {
  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  .logo {
    margin: 0 2rem 0 0;
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }

  nav {
    text-align: left;
    margin-left: -1rem;
    font-size: 1rem;

    padding: 1rem 0;
    margin-top: 1rem;
  }
}
</style>
