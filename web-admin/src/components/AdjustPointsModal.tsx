import { MinusOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ButtonProps } from 'antd'
import { App, Form, Input, Modal, Radio, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import { userApi, type AdjustPointsInput, type AdminUser } from '../api/client'
import { useErrorText } from '../hooks/useErrorText'

const MAX_AMOUNT = 1_000_000_000

interface FormValues {
  mode: AdjustPointsInput['mode']
  amount: string
  note?: string
}

export default function AdjustPointsModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const [form] = Form.useForm<FormValues>()

  const mode = Form.useWatch('mode', form) ?? 'add'
  const amount = Number(Form.useWatch('amount', form) || 0)
  const after = user.points + (mode === 'add' ? amount : -amount)

  const save = useMutation({
    mutationFn: (v: FormValues) =>
      userApi.adjustPoints(user.id, { mode: v.mode, amount: Number(v.amount), note: v.note }),
    onSuccess: (updated) => {
      message.success(t('users.pointsAdjusted'))
      queryClient.setQueryData(['user', user.id], updated)
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
    onError: (err) => message.error(errorText(err)),
  })

  return (
    <Modal
      open
      title={t('users.adjustPointsTitle', { name: user.username })}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      confirmLoading={save.isPending}
      onOk={() => form.submit()}
      onCancel={onClose}
      destroyOnHidden
      okButtonProps={{ 'data-testid': 'points-save' } as ButtonProps}
    >
      <Form<FormValues>
        form={form}
        layout="vertical"
        initialValues={{ mode: 'add', amount: '' }}
        onFinish={(v) => save.mutate(v)}
      >
        <Form.Item name="mode" label={t('users.adjustMode')}>
          <Radio.Group buttonStyle="solid" data-testid="points-mode">
            <Radio.Button value="add" data-testid="points-mode-add">
              <PlusOutlined /> {t('users.addPoints')}
            </Radio.Button>
            <Radio.Button value="subtract" data-testid="points-mode-subtract">
              <MinusOutlined /> {t('users.subtractPoints')}
            </Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item
          name="amount"
          label={t('users.pointAmount')}
          dependencies={['mode']}
          // Digits only: anything else typed or pasted is dropped.
          normalize={(v: string) => v.replace(/\D/g, '').replace(/^0+/, '')}
          rules={[
            { required: true, message: t('users.pointAmountRequired') },
            ({ getFieldValue }) => ({
              validator: (_, v: string) => {
                const n = Number(v || 0)
                if (n > MAX_AMOUNT) return Promise.reject(new Error(t('users.pointAmountTooLarge')))
                if (getFieldValue('mode') === 'subtract' && n > user.points) {
                  return Promise.reject(new Error(t('errors.insufficient_points')))
                }
                return Promise.resolve()
              },
            }),
          ]}
        >
          <Input inputMode="numeric" autoComplete="off" maxLength={10} autoFocus data-testid="points-amount" />
        </Form.Item>
        <Form.Item name="note" label={t('users.pointNote')}>
          <Input.TextArea rows={2} maxLength={500} data-testid="points-note" />
        </Form.Item>
        <Typography.Text type="secondary" data-testid="points-preview">
          {t('users.pointsPreview', {
            current: user.points.toLocaleString('vi-VN'),
            after: Math.max(after, 0).toLocaleString('vi-VN'),
          })}
        </Typography.Text>
      </Form>
    </Modal>
  )
}
