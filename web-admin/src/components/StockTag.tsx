import { Tag } from 'antd'
import { useTranslation } from 'react-i18next'
import type { StockStatus } from '../api/client'

const colors: Record<StockStatus, string> = {
  in_stock: 'green',
  low_stock: 'orange',
  out_of_stock: 'red',
}

export default function StockTag({ status }: { status: StockStatus }) {
  const { t } = useTranslation()
  return <Tag color={colors[status]}>{t(`products.stock.${status}`)}</Tag>
}
