export type PaginatedResponse<T> = {
  data: T[]
  total: number
  page: number
  pageSize: number
}
