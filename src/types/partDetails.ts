export type PartDetails = {
  createdTime: string
  id: number
  modelId: number
  brandId: number
  partId: number
  qrCodeId: string
  quantity: number
  product: {
    partType: string
    brand: string
    year: string
    releasedYear: string
    name: string
    description: string
  }
}
