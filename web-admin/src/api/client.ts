import axios, { AxiosError } from 'axios'
import { useAuth, type User } from '../store/auth'

export const api = axios.create({ baseURL: '/api/v1' })

api.interceptors.request.use((config) => {
  const token = useAuth.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401 && useAuth.getState().token) {
      useAuth.getState().logout()
    }
    return Promise.reject(err)
  },
)

export function apiErrorCode(err: unknown): string {
  if (err instanceof AxiosError) {
    if (!err.response) return 'network'
    const code = (err.response.data as { error?: string } | undefined)?.error
    if (code) return code
  }
  return 'unknown'
}

export interface LoginResponse {
  token: string
  expires_at: string
  user: User
}

export interface Category {
  id: string
  parent_id: string | null
  slug: string
  name: string
  description: string | null
  is_active: boolean
  sort_order: number
  product_count: number
  children?: Category[]
}

export interface CategoryInput {
  parent_id: string | null
  name: string
  description?: string | null
  is_active: boolean
  sort_order: number
}

export const categoryApi = {
  list: () => api.get<Category[]>('/admin/categories').then((r) => r.data),
  create: (input: CategoryInput) => api.post<{ id: string }>('/admin/categories', input),
  update: (id: string, input: CategoryInput) => api.put(`/admin/categories/${id}`, input),
  remove: (id: string) => api.delete(`/admin/categories/${id}`),
}

export interface AdminUser extends User {
  avatar_url: string | null
  birth_date: string | null
  location: string | null
  bio: string | null
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface UserListParams {
  q?: string
  role?: User['role']
  status?: User['status']
  page: number
  page_size: number
}

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export const userApi = {
  list: (params: UserListParams) => api.get<Paged<AdminUser>>('/admin/users', { params }).then((r) => r.data),
  get: (id: string) => api.get<AdminUser>(`/admin/users/${id}`).then((r) => r.data),
  adjustPoints: (id: string, input: AdjustPointsInput) =>
    api.post<AdminUser>(`/admin/users/${id}/points`, input).then((r) => r.data),
  create: (input: CreateUserInput) => api.post<AdminUser>('/admin/users', input).then((r) => r.data),
}

export interface AdjustPointsInput {
  mode: 'add' | 'subtract'
  amount: number
  note?: string
}

export interface CreateUserInput {
  email: string
  password: string
  username: string
  birth_date?: string | null
  location?: string | null
  bio?: string | null
}

export type ProductStatus = 'published' | 'unpublished'
export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock'

export interface Product {
  id: string
  name: string
  category_id: string
  category_name: string
  parent_category_name: string | null
  owner_id: string
  owner_username: string
  production_year: number
  production_month: number | null
  quantity: number
  stock_status: StockStatus
  price_points: number
  status: ProductStatus
  thumbnail_url: string | null
  created_at: string
  updated_at: string
}

export interface ProductDetail extends Product {
  description: string | null
  images: string[]
}

export interface ProductInput {
  category_id: string
  name: string
  description?: string | null
  production_year: number
  production_month: number | null
  quantity: number
  price_points: number
  status: ProductStatus
  images: string[]
}

export interface ProductQuery {
  page?: number
  page_size?: number
  q?: string
  category_id?: string
  status?: ProductStatus
  stock?: StockStatus
  sort?: 'created_at' | 'price_points' | 'quantity' | 'production_year'
  order?: 'asc' | 'desc'
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export const productApi = {
  list: (params: ProductQuery) => api.get<Page<Product>>('/admin/products', { params }).then((r) => r.data),
  get: (id: string) => api.get<ProductDetail>(`/admin/products/${id}`).then((r) => r.data),
  create: (input: ProductInput) => api.post<{ id: string }>('/admin/products', input),
  update: (id: string, input: ProductInput) => api.put(`/admin/products/${id}`, input),
  setStatus: (id: string, status: ProductStatus) => api.patch(`/admin/products/${id}/status`, { status }),
  remove: (id: string) => api.delete(`/admin/products/${id}`),
}

export const uploadApi = {
  image: (file: File) => {
    const body = new FormData()
    body.append('file', file)
    return api.post<{ url: string }>('/admin/uploads/images', body).then((r) => r.data.url)
  },
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }).then((r) => r.data),
  me: () => api.get<User>('/me').then((r) => r.data),
}

export type OrderStatus = 'paid' | 'shipped' | 'completed' | 'cancelled'

export const ORDER_STATUSES: OrderStatus[] = ['paid', 'shipped', 'completed', 'cancelled']

export interface Order {
  id: string
  order_code: string
  buyer_id: string
  buyer_username: string
  buyer_email: string
  seller_id: string
  seller_username: string
  seller_email: string
  product_id: string
  product_name: string
  product_image_url: string | null
  quantity: number
  unit_points: number
  total_points: number
  status: OrderStatus
  created_at: string
  shipped_at: string | null
  completed_at: string | null
  cancelled_at: string | null
}

export type PointTxType = 'admin_grant' | 'admin_deduct' | 'purchase' | 'sale' | 'refund' | 'sale_reversal'

export interface OrderPointTx {
  id: number
  user_id: string
  username: string
  amount: number
  balance_after: number
  type: PointTxType
  created_by: string | null
  creator_username: string | null
  note: string | null
  created_at: string
}

export interface OrderMessage {
  id: number
  sender_id: string
  sender_username: string
  type: 'text' | 'product'
  content: string | null
  product_id: string | null
  product_name: string | null
  created_at: string
}

export interface OrderDetail extends Order {
  shipping_name: string
  shipping_phone: string
  shipping_address: string
  buyer_points: number
  seller_points: number
  product_deleted: boolean
  cancelled_by: string | null
  cancelled_by_username: string | null
  point_transactions: OrderPointTx[]
  messages: OrderMessage[]
}

export interface OrderListParams {
  q?: string
  status?: OrderStatus
  date_from?: string
  date_to?: string
  sort?: 'created_at' | 'total_points' | 'quantity'
  order?: 'asc' | 'desc'
  page: number
  page_size: number
}

export interface OrderPage extends Paged<Order> {
  status_counts: Record<OrderStatus, number>
}

export const orderApi = {
  list: (params: OrderListParams) => api.get<OrderPage>('/admin/orders', { params }).then((r) => r.data),
  get: (id: string) => api.get<OrderDetail>(`/admin/orders/${id}`).then((r) => r.data),
  cancel: (id: string, reason: string) => api.post(`/admin/orders/${id}/cancel`, { reason }),
}
