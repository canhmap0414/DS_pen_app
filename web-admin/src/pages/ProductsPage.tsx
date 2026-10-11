import { DeleteOutlined, EditOutlined, PictureOutlined, PlusOutlined } from '@ant-design/icons'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, Image, Input, Popconfirm, Select, Space, Switch, Table, TreeSelect, Typography } from 'antd'
import type { ColumnsType, TableProps } from 'antd/es/table'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  productApi,
  type Product,
  type ProductQuery,
  type ProductStatus,
  type StockStatus,
} from '../api/client'
import StockTag from '../components/StockTag'
import { useCategoryTree } from '../hooks/useCategoryTree'
import { useErrorText } from '../hooks/useErrorText'

const SORTS = ['created_at', 'price_points', 'quantity', 'production_year'] as const

// Filters live in the URL so they survive a round trip to the edit page and can be shared.
function readQuery(sp: URLSearchParams): ProductQuery {
  const num = (k: string) => (sp.get(k) ? Number(sp.get(k)) : undefined)
  const sort = sp.get('sort') as ProductQuery['sort']
  return {
    page: num('page') ?? 1,
    page_size: num('page_size') ?? 20,
    q: sp.get('q') ?? undefined,
    category_id: sp.get('category_id') ?? undefined,
    status: (sp.get('status') as ProductStatus) ?? undefined,
    stock: (sp.get('stock') as StockStatus) ?? undefined,
    sort: sort && SORTS.includes(sort) ? sort : undefined,
    order: sp.get('order') === 'asc' ? 'asc' : sp.get('order') === 'desc' ? 'desc' : undefined,
  }
}

function formatProduction(year: number, month: number | null) {
  return month ? `${String(month).padStart(2, '0')}/${year}` : String(year)
}

export default function ProductsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const [searchParams, setSearchParams] = useSearchParams()
  const query = readQuery(searchParams)
  const categoryTree = useCategoryTree()

  const products = useQuery({
    queryKey: ['products', query],
    queryFn: () => productApi.list(query),
    placeholderData: keepPreviousData,
  })

  const setQuery = (patch: Partial<ProductQuery>, resetPage = true) => {
    const next = { ...query, ...(resetPage ? { page: 1 } : {}), ...patch }
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined || v === null || v === '') continue
      if ((k === 'page' && v === 1) || (k === 'page_size' && v === 20)) continue
      sp.set(k, String(v))
    }
    setSearchParams(sp)
  }

  const onDone = (msg: string) => {
    message.success(msg)
    void queryClient.invalidateQueries({ queryKey: ['products'] })
    void queryClient.invalidateQueries({ queryKey: ['categories'] })
  }

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProductStatus }) => productApi.setStatus(id, status),
    onSuccess: () => onDone(t('common.saved')),
    onError: (err) => message.error(errorText(err)),
  })

  const remove = useMutation({
    mutationFn: (id: string) => productApi.remove(id),
    onSuccess: () => onDone(t('common.deleted')),
    onError: (err) => message.error(errorText(err)),
  })

  const sortOrderOf = (key: string) =>
    query.sort === key || (!query.sort && key === 'created_at')
      ? query.order === 'asc'
        ? ('ascend' as const)
        : ('descend' as const)
      : null

  const columns: ColumnsType<Product> = [
    { title: t('common.id'), dataIndex: 'id', width: 140 },
    {
      title: t('products.image'),
      dataIndex: 'thumbnail_url',
      width: 80,
      render: (url: string | null) =>
        url ? (
          <Image src={url} width={48} height={48} style={{ objectFit: 'cover', borderRadius: 4 }} />
        ) : (
          <div className="product-thumb-empty">
            <PictureOutlined />
          </div>
        ),
    },
    {
      title: t('products.name'),
      dataIndex: 'name',
      render: (name: string, p) => (
        <Space orientation="vertical" size={0}>
          <Link to={`/products/${p.id}`} data-testid={`product-link-${p.id}`}>
            <Typography.Text strong>{name}</Typography.Text>
          </Link>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            #{p.id} · {t('products.owner')}: {p.owner_username}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: t('products.category'),
      key: 'category',
      width: 200,
      render: (_, p) =>
        p.parent_category_name ? `${p.parent_category_name} › ${p.category_name}` : p.category_name,
    },
    {
      title: t('products.production'),
      dataIndex: 'production_year',
      key: 'production_year',
      width: 120,
      sorter: true,
      sortOrder: sortOrderOf('production_year'),
      render: (_, p) => formatProduction(p.production_year, p.production_month),
    },
    {
      title: t('products.quantity'),
      dataIndex: 'quantity',
      key: 'quantity',
      width: 150,
      sorter: true,
      sortOrder: sortOrderOf('quantity'),
      render: (q: number, p) => (
        <Space size={4}>
          <span>{q}</span>
          <StockTag status={p.stock_status} />
        </Space>
      ),
    },
    {
      title: t('products.pricePoints'),
      dataIndex: 'price_points',
      key: 'price_points',
      width: 110,
      align: 'right',
      sorter: true,
      sortOrder: sortOrderOf('price_points'),
      render: (v: number) => v.toLocaleString('vi-VN'),
    },
    {
      title: t('products.published'),
      dataIndex: 'status',
      width: 110,
      render: (status: ProductStatus, p) => (
        <Switch
          checked={status === 'published'}
          loading={setStatus.isPending && setStatus.variables?.id === p.id}
          onChange={(on) => setStatus.mutate({ id: p.id, status: on ? 'published' : 'unpublished' })}
          data-testid={`product-publish-${p.id}`}
        />
      ),
    },
    {
      title: t('products.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 140,
      sorter: true,
      sortOrder: sortOrderOf('created_at'),
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 110,
      fixed: 'right',
      render: (_, p) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(`/products/${p.id}`)}
            aria-label={t('common.edit')}
            data-testid={`product-edit-${p.id}`}
          />
          <Popconfirm
            title={t('products.deleteConfirm', { name: p.name })}
            okText={t('common.yes')}
            cancelText={t('common.no')}
            onConfirm={() => remove.mutate(p.id)}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={remove.isPending && remove.variables === p.id}
              aria-label={t('common.delete')}
              data-testid={`product-delete-${p.id}`}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const onTableChange: TableProps<Product>['onChange'] = (pagination, _filters, sorter, extra) => {
    if (extra.action === 'sort' && !Array.isArray(sorter)) {
      const key = sorter.columnKey as ProductQuery['sort']
      setQuery({
        sort: sorter.order ? key : undefined,
        order: sorter.order === 'ascend' ? 'asc' : sorter.order ? 'desc' : undefined,
      })
      return
    }
    setQuery({ page: pagination.current, page_size: pagination.pageSize }, false)
  }

  return (
    <Card
      title={t('products.title')}
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/products/new')}
          data-testid="product-add"
        >
          {t('products.add')}
        </Button>
      }
    >
      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder={t('products.searchPlaceholder')}
          defaultValue={query.q}
          onSearch={(q) => setQuery({ q: q.trim() || undefined })}
          style={{ width: 260 }}
          data-testid="product-search"
        />
        <TreeSelect
          allowClear
          treeDefaultExpandAll
          placeholder={t('products.allCategories')}
          treeData={categoryTree.treeData}
          loading={categoryTree.loading}
          value={query.category_id}
          onChange={(v?: string) => setQuery({ category_id: v })}
          style={{ width: 220 }}
          data-testid="product-filter-category"
        />
        <Select
          allowClear
          placeholder={t('products.allStatuses')}
          value={query.status}
          onChange={(v?: ProductStatus) => setQuery({ status: v })}
          style={{ width: 160 }}
          options={[
            { value: 'published', label: t('products.status.published') },
            { value: 'unpublished', label: t('products.status.unpublished') },
          ]}
          data-testid="product-filter-status"
        />
        <Select
          allowClear
          placeholder={t('products.allStock')}
          value={query.stock}
          onChange={(v?: StockStatus) => setQuery({ stock: v })}
          style={{ width: 160 }}
          options={(['in_stock', 'low_stock', 'out_of_stock'] as const).map((s) => ({
            value: s,
            label: t(`products.stock.${s}`),
          }))}
          data-testid="product-filter-stock"
        />
      </Space>

      <Table<Product>
        rowKey="id"
        columns={columns}
        dataSource={products.data?.items ?? []}
        loading={products.isFetching}
        onChange={onTableChange}
        pagination={{
          current: query.page,
          pageSize: query.page_size,
          total: products.data?.total ?? 0,
          showSizeChanger: true,
          showTotal: (total) => t('products.total', { count: total }),
        }}
        scroll={{ x: 1340 }}
        locale={{ emptyText: products.isError ? errorText(products.error) : t('products.empty') }}
        data-testid="product-table"
      />
    </Card>
  )
}
