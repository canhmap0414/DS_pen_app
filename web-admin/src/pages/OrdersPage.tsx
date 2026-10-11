import { PictureOutlined } from '@ant-design/icons'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Avatar, Card, DatePicker, Input, Space, Table, Tabs, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { SorterResult } from 'antd/es/table/interface'
import dayjs from 'dayjs'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ORDER_STATUSES, orderApi, type Order, type OrderListParams, type OrderStatus } from '../api/client'
import OrderStatusTag from '../components/OrderStatusTag'
import { useErrorText } from '../hooks/useErrorText'

const PAGE_SIZE = 20

function formatTime(value: string | null) {
  return value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '—'
}

function UserCell({ username, email }: { username: string; email: string }) {
  return (
    <Space orientation="vertical" size={0}>
      <Typography.Text>{username}</Typography.Text>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {email}
      </Typography.Text>
    </Space>
  )
}

export default function OrdersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const [params, setParams] = useState<OrderListParams>({
    page: 1,
    page_size: PAGE_SIZE,
  })

  const orders = useQuery({
    queryKey: ['orders', params],
    queryFn: () => orderApi.list(params),
    placeholderData: keepPreviousData,
  })

  // Any filter change goes back to the first page.
  const setFilter = (patch: Partial<OrderListParams>) => setParams((p) => ({ ...p, ...patch, page: 1 }))

  const counts = orders.data?.status_counts
  const allCount = counts ? ORDER_STATUSES.reduce((sum, s) => sum + counts[s], 0) : undefined
  const tabLabel = (label: string, n: number | undefined) => (n === undefined ? label : `${label} (${n})`)

  const sortOrder = (key: OrderListParams['sort']) =>
    (params.sort ?? 'created_at') === key ? (params.order === 'asc' ? 'ascend' : 'descend') : null

  const columns: ColumnsType<Order> = [
    { title: t('common.id'), dataIndex: 'id', width: 140 },
    {
      title: t('orders.code'),
      dataIndex: 'order_code',
      width: 170,
      render: (code: string) => <Typography.Text strong>{code}</Typography.Text>,
    },
    {
      title: t('orders.product'),
      key: 'product',
      render: (_, o) => (
        <Space>
          <Avatar shape="square" size={40} src={o.product_image_url ?? undefined} icon={<PictureOutlined />} />
          <Space orientation="vertical" size={0}>
            <Typography.Text>{o.product_name}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('orders.qtyTimesUnit', {
                qty: o.quantity,
                unit: o.unit_points.toLocaleString('vi-VN'),
              })}
            </Typography.Text>
          </Space>
        </Space>
      ),
    },
    {
      title: t('orders.buyer'),
      key: 'buyer',
      width: 200,
      render: (_, o) => <UserCell username={o.buyer_username} email={o.buyer_email} />,
    },
    {
      title: t('orders.seller'),
      key: 'seller',
      width: 200,
      render: (_, o) => <UserCell username={o.seller_username} email={o.seller_email} />,
    },
    {
      title: t('orders.totalPoints'),
      dataIndex: 'total_points',
      key: 'total_points',
      width: 120,
      align: 'right',
      sorter: true,
      sortOrder: sortOrder('total_points'),
      render: (n: number) => n.toLocaleString('vi-VN'),
    },
    {
      title: t('orders.status'),
      dataIndex: 'status',
      width: 130,
      render: (status: OrderStatus) => <OrderStatusTag status={status} />,
    },
    {
      title: t('orders.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      sorter: true,
      sortOrder: sortOrder('created_at'),
      render: formatTime,
    },
  ]

  return (
    <Card title={t('orders.title')}>
      <Tabs
        activeKey={params.status ?? 'all'}
        onChange={(key) =>
          setFilter({
            status: key === 'all' ? undefined : (key as OrderStatus),
          })
        }
        items={[
          { key: 'all', label: tabLabel(t('orders.all'), allCount) },
          ...ORDER_STATUSES.map((s) => ({
            key: s,
            label: tabLabel(t(`orders.statuses.${s}`), counts?.[s]),
          })),
        ]}
        data-testid="order-status-tabs"
      />
      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder={t('orders.searchPlaceholder')}
          style={{ width: 320 }}
          onSearch={(q) => setFilter({ q: q.trim() || undefined })}
          data-testid="order-search"
        />
        <DatePicker.RangePicker
          format="DD/MM/YYYY"
          placeholder={[t('orders.dateFrom'), t('orders.dateTo')]}
          onChange={(range) =>
            setFilter({
              date_from: range?.[0]?.format('YYYY-MM-DD'),
              date_to: range?.[1]?.format('YYYY-MM-DD'),
            })
          }
          data-testid="order-date-range"
        />
      </Space>
      <Table<Order>
        rowKey="id"
        columns={columns}
        dataSource={orders.data?.items ?? []}
        loading={orders.isFetching}
        scroll={{ x: 1240 }}
        onRow={(o) => ({
          onClick: () => navigate(`/orders/${o.id}`),
          style: { cursor: 'pointer' },
        })}
        onChange={(pagination, _filters, sorter) => {
          const s = sorter as SorterResult<Order>
          const sort = s.order ? (s.columnKey as OrderListParams['sort']) : undefined
          const order = s.order === 'ascend' ? 'asc' : s.order === 'descend' ? 'desc' : undefined
          setParams((p) => {
            const sortChanged = sort !== p.sort || order !== p.order
            const sizeChanged = pagination.pageSize !== p.page_size
            return {
              ...p,
              sort,
              order,
              page_size: pagination.pageSize ?? p.page_size,
              page: sortChanged || sizeChanged ? 1 : (pagination.current ?? 1),
            }
          })
        }}
        pagination={{
          current: params.page,
          pageSize: params.page_size,
          total: orders.data?.total ?? 0,
          showSizeChanger: true,
          showTotal: (total) => t('orders.total', { count: total }),
        }}
        locale={{
          emptyText: orders.isError ? errorText(orders.error) : t('orders.empty'),
        }}
        data-testid="order-table"
      />
    </Card>
  )
}
