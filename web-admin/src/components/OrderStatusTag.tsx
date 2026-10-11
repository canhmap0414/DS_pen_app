import { Tag } from 'antd'
import { useTranslation } from 'react-i18next'
import type { OrderStatus } from '../api/client'

const COLORS: Record<OrderStatus, string> = {
  paid: 'gold',
  shipped: 'blue',
  completed: 'green',
  cancelled: 'red',
}

export default function OrderStatusTag({ status }: { status: OrderStatus }) {
  const { t } = useTranslation()
  return <Tag color={COLORS[status]}>{t(`orders.statuses.${status}`)}</Tag>
}
