import type { AxiosResponse } from 'axios'
import { apiClient } from './apiClient'

export type PriceResult = {
  url: string
  title: string | null
  price: number | null
  currency: string | null
  found: boolean
}

export type ScrapedPart = {
  partName: string
  retailPrice: number
  title: string
  description: string
  isOriginal: boolean
}

export type Part = {
  _id?: string
  id: number
  year: string
  modelId: number
  brandId: number
  partId: number
  partType?: string
  brand?: string
  quantity?: number
  model?: string
  name?: string
  description?: string
}

export type CreatePartInput = {
  year: string
  modelId: number
  brandId: number
  partId: number
  partType?: string
  brand?: string
  quantity?: number
  model?: string
  name?: string
  description?: string
}

export type UpdatePartQuantityInput = {
  modelId: number
  brandId: number
  partId: number
  quantity: number
}

export type LoginInput = {
  username: string
  password: string
}

export type LoginResponse = {
  access_token: string
}

export type Profile = {
  sub: number
  username: string
}

/* Authentication */

export async function login(
  credentials: LoginInput,
): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>(
    '/auth/login',
    credentials,
  )

  return data
}

export async function getProfile(): Promise<Profile> {
  const { data } = await apiClient.get<Profile>('/auth/profile')
  return data
}

/* Parts */

export async function getParts(): Promise<Part[]> {
  const { data } = await apiClient.get<Part[]>('/parts')
  return data
}

export async function getPartById(id: string): Promise<Part> {
  const { data } = await apiClient.get<Part>(`/parts/${id}`)
  return data
}

export async function getPartByIdentifiers(
  modelId: number,
  brandId: number,
  partId: number,
): Promise<Part> {
  const { data } = await apiClient.get<Part>(
    `/parts/by-ids/${modelId}/${brandId}/${partId}`,
  )

  return data
}

export async function createPart(
  part: CreatePartInput,
): Promise<Part> {
  const { data } = await apiClient.post<Part>('/parts', part)
  return data
}

export async function updatePartQuantity(
  input: UpdatePartQuantityInput,
): Promise<Part> {
  const { data } = await apiClient.patch<Part>(
    '/parts/update-quantity',
    input,
  )

  return data
}

export async function deletePart(id: string): Promise<Part | null> {
  const { data } = await apiClient.delete<Part | null>(`/parts/${id}`)
  return data
}

export async function exportParts(): Promise<Blob> {
  const { data } = await apiClient.get<Blob>('/parts/export', {
    responseType: 'blob',
  })

  return data
}

/* Prices */

export async function getPrice(url: string): Promise<PriceResult> {
  const { data } = await apiClient.get<PriceResult>('/api/price', {
    params: { url },
  })

  return data
}

export async function getPrices(
  urls: string[],
): Promise<PriceResult[]> {
  const { data } = await apiClient.post<PriceResult[]>(
    '/api/price/bulk',
    { urls },
  )

  return data
}

export async function scrapeParts(
  url?: string,
): Promise<{ count: number; parts: ScrapedPart[] }> {
  const { data } = await apiClient.get<{
    count: number
    parts: ScrapedPart[]
  }>('/api/price/scrape', {
    params: url ? { url } : undefined,
  })

  return data
}