import { ArrowLeftOutlined, PictureOutlined, StopOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import {
  Avatar,
  Breadcrumb,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  List,
  Result,
  Row,
  Space,
  Spin,
  Steps,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { orderApi, type OrderDetail, type OrderPointTx } from '../api/client'
import CancelOrderModal from '../components/CancelOrderModal'
import OrderStatusTag from '../components/OrderStatusTag'
import { useErrorText } from '../hooks/useErrorText'

function formatTime(value: string | null) {
  return value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '—'
}

function points(n: number) {
  return n.toLocaleString('vi-VN')
}

function OrderSteps({ order }: { order: OrderDetail }) {
  const { t } = useTranslation()
  const steps = [
    { title: t('orders.statuses.paid'), content: formatTime(order.created_at) },
    {
      title: t('orders.statuses.shipped'),
      content: formatTime(order.shipped_at),
    },
    {
      title: t('orders.statuses.completed'),
      content: formatTime(order.completed_at),
    },
  ]
  if (order.status === 'cancelled') {
    // Show the steps actually reached, then the cancellation.
    const reached = order.completed_at ? 3 : order.shipped_at ? 2 : 1
    return (
      <Steps
        size="small"
        current={reached}
        status="error"
        items={[
          ...steps.slice(0, reached),
          {
            title: t('orders.statuses.cancelled'),
            content: formatTime(order.cancelled_at),
          },
        ]}
      />
    )
  }
  const current = { paid: 0, shipped: 1, completed: 2 }[order.status]
  return (
    <Steps size="small" current={current} status={order.status === 'completed' ? 'finish' : 'process'} items={steps} />
  )
}

export default function OrderDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const id = useParams().id ?? ''
  const [cancelling, setCancelling] = useState(false)

  const order = useQuery({
    queryKey: ['order', id],
    queryFn: () => orderApi.get(id),
    enabled: id !== '',
  })

  if (order.isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin />
      </div>
    )
  }
  if (!order.data) {
    return (
      <Result
        status="404"
        title={order.isError ? errorText(order.error) : t('errors.not_found')}
        extra={<Button onClick={() => navigate('/orders')}>{t('orders.backToList')}</Button>}
      />
    )
  }

  const o = order.data

  const txColumns: ColumnsType<OrderPointTx> = [
    {
      title: t('orders.tx.time'),
      dataIndex: 'created_at',
      width: 150,
      render: formatTime,
    },
    { title: t('orders.tx.user'), dataIndex: 'username', width: 160 },
    {
      title: t('orders.tx.type'),
      dataIndex: 'type',
      width: 150,
      render: (type: OrderPointTx['type']) => <Tag>{t(`orders.tx.types.${type}`)}</Tag>,
    },
    {
      title: t('orders.tx.amount'),
      dataIndex: 'amount',
      width: 110,
      align: 'right',
      render: (n: number) => (
        <Typography.Text type={n > 0 ? 'success' : 'danger'}>
          {n > 0 ? '+' : '−'}
          {points(Math.abs(n))}
        </Typography.Text>
      ),
    },
    {
      title: t('orders.tx.balanceAfter'),
      dataIndex: 'balance_after',
      width: 120,
      align: 'right',
      render: points,
    },
    {
      title: t('orders.tx.note'),
      key: 'note',
      render: (_, tx) => (
        <Space orientation="vertical" size={0}>
          {tx.note && <Typography.Text>{tx.note}</Typography.Text>}
          {tx.creator_username && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('orders.tx.by', { name: tx.creator_username })}
            </Typography.Text>
          )}
          {!tx.note && !tx.creator_username && '—'}
        </Space>
      ),
    },
  ]

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Breadcrumb items={[{ title: <Link to="/orders">{t('orders.title')}</Link> }, { title: o.order_code }]} />

      <Card
        title={
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/orders')}
              aria-label={t('orders.backToList')}
              data-testid="order-back"
            />
            <span data-testid="order-detail-code">{o.order_code}</span>
            <OrderStatusTag status={o.status} />
          </Space>
        }
        extra={
          o.status !== 'cancelled' && (
            <Button danger icon={<StopOutlined />} onClick={() => setCancelling(true)} data-testid="order-cancel">
              {t('orders.cancel.button')}
            </Button>
          )
        }
      >
        <OrderSteps order={o} />
        {o.status === 'cancelled' && o.cancelled_by_username && (
          <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0 }}>
            {t('orders.cancelledBy', {
              name: o.cancelled_by_username,
              time: formatTime(o.cancelled_at),
            })}
          </Typography.Paragraph>
        )}
      </Card>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card title={t('orders.productInfo')} style={{ height: '100%' }}>
            <Space align="start" size="middle">
              <Avatar shape="square" size={80} src={o.product_image_url ?? undefined} icon={<PictureOutlined />} />
              <Descriptions column={1} size="small">
                <Descriptions.Item label={t('orders.product')}>
                  <Space wrap>
                    {o.product_name}
                    {o.product_deleted && <Tag>{t('orders.productDeleted')}</Tag>}
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label={t('orders.quantity')}>{o.quantity}</Descriptions.Item>
                <Descriptions.Item label={t('orders.unitPoints')}>{points(o.unit_points)}</Descriptions.Item>
                <Descriptions.Item label={t('orders.totalPoints')}>
                  <Typography.Text strong>{points(o.total_points)}</Typography.Text>
                </Descriptions.Item>
              </Descriptions>
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={t('orders.parties')} style={{ height: '100%' }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label={t('orders.buyer')}>
                {o.buyer_username} ({o.buyer_email})
              </Descriptions.Item>
              <Descriptions.Item label={t('orders.buyerPoints')}>{points(o.buyer_points)}</Descriptions.Item>
              <Descriptions.Item label={t('orders.seller')}>
                {o.seller_username} ({o.seller_email})
              </Descriptions.Item>
              <Descriptions.Item label={t('orders.sellerPoints')}>{points(o.seller_points)}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24}>
          <Card title={t('orders.shipping')}>
            <Descriptions column={{ xs: 1, md: 3 }} size="small">
              <Descriptions.Item label={t('orders.shippingName')}>{o.shipping_name}</Descriptions.Item>
              <Descriptions.Item label={t('orders.shippingPhone')}>{o.shipping_phone}</Descriptions.Item>
              <Descriptions.Item label={t('orders.shippingAddress')}>{o.shipping_address}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <Card title={t('orders.pointHistory')}>
        <Table<OrderPointTx>
          rowKey="id"
          columns={txColumns}
          dataSource={o.point_transactions}
          pagination={false}
          scroll={{ x: 800 }}
          locale={{ emptyText: t('orders.tx.empty') }}
          data-testid="order-point-table"
        />
      </Card>

      <Card
        title={t('orders.chat')}
        extra={<Typography.Text type="secondary">{t('orders.chatReadOnly')}</Typography.Text>}
      >
        {o.messages.length === 0 ? (
          <Empty description={t('orders.chatEmpty')} />
        ) : (
          <List
            size="small"
            dataSource={o.messages}
            data-testid="order-messages"
            renderItem={(m) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space>
                      <Typography.Text strong>{m.sender_username}</Typography.Text>
                      {m.sender_id === o.buyer_id && <Tag>{t('orders.buyer')}</Tag>}
                      {m.sender_id === o.seller_id && <Tag>{t('orders.seller')}</Tag>}
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {formatTime(m.created_at)}
                      </Typography.Text>
                    </Space>
                  }
                  description={
                    m.type === 'product' ? (
                      <Tag icon={<PictureOutlined />}>{m.product_name ?? `#${m.product_id}`}</Tag>
                    ) : (
                      <Typography.Text style={{ whiteSpace: 'pre-wrap' }}>{m.content}</Typography.Text>
                    )
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {cancelling && <CancelOrderModal order={o} onClose={() => setCancelling(false)} />}
    </Space>
  )
}
