import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Descriptions, Input, Modal, Typography } from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { orderApi, type OrderDetail } from '../api/client'
import { useErrorText } from '../hooks/useErrorText'

function points(n: number) {
  return n.toLocaleString('vi-VN')
}

export default function CancelOrderModal({ order, onClose }: { order: OrderDetail; onClose: () => void }) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const [reason, setReason] = useState('')

  const completed = order.status === 'completed'
  // Mirrors the API rule: a completed order can't be cancelled once the seller has spent the points.
  const sellerShort = completed && order.seller_points < order.total_points

  const cancel = useMutation({
    mutationFn: () => orderApi.cancel(order.id, reason.trim()),
    onSuccess: () => {
      message.success(t('orders.cancel.done'))
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
      void queryClient.invalidateQueries({ queryKey: ['order', order.id] })
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
    onError: (err) => message.error(errorText(err)),
  })

  return (
    <Modal
      open
      title={t('orders.cancel.title', { code: order.order_code })}
      okText={t('orders.cancel.confirm')}
      cancelText={t('common.cancel')}
      okButtonProps={{
        danger: true,
        disabled: sellerShort,
        id: 'order-cancel-confirm',
      }}
      confirmLoading={cancel.isPending}
      onOk={() => cancel.mutate()}
      onCancel={onClose}
    >
      <Typography.Paragraph>{t('orders.cancel.effects')}</Typography.Paragraph>
      <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
        <Descriptions.Item label={t('orders.cancel.refundBuyer', { name: order.buyer_username })}>
          <Typography.Text type="success">+{points(order.total_points)}</Typography.Text>
        </Descriptions.Item>
        {completed && (
          <Descriptions.Item
            label={t('orders.cancel.reverseSeller', {
              name: order.seller_username,
            })}
          >
            <Typography.Text type="danger">−{points(order.total_points)}</Typography.Text>{' '}
            <Typography.Text type="secondary">
              (
              {t('orders.cancel.sellerBalance', {
                points: points(order.seller_points),
              })}
              )
            </Typography.Text>
          </Descriptions.Item>
        )}
        <Descriptions.Item label={t('orders.cancel.restock')}>+{order.quantity}</Descriptions.Item>
      </Descriptions>
      {sellerShort && (
        <Alert type="error" showIcon title={t('errors.seller_insufficient_points')} style={{ marginBottom: 16 }} />
      )}
      <Input.TextArea
        rows={3}
        maxLength={1000}
        showCount
        placeholder={t('orders.cancel.reasonPlaceholder')}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={sellerShort}
        data-testid="order-cancel-reason"
      />
    </Modal>
  )
}
