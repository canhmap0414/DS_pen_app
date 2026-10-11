import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ButtonProps } from 'antd'
import { App, Form, Input, InputNumber, Modal, Space, Switch } from 'antd'
import { useTranslation } from 'react-i18next'
import { categoryApi, type Category, type CategoryInput } from '../api/client'
import { useErrorText } from '../hooks/useErrorText'

export type CategoryEditorState =
  | { mode: 'create'; parentId: string | null }
  | { mode: 'edit'; category: Category }

type FormValues = Omit<CategoryInput, 'parent_id'>

export default function CategoryEditor({
  state,
  onClose,
}: {
  state: CategoryEditorState
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const [form] = Form.useForm<FormValues>()

  const editing = state.mode === 'edit' ? state.category : null
  const parentId = editing ? editing.parent_id : state.mode === 'create' ? state.parentId : null
  const isChild = parentId !== null

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const input: CategoryInput = { ...values, parent_id: parentId }
      return editing ? categoryApi.update(editing.id, input) : categoryApi.create(input)
    },
    onSuccess: () => {
      message.success(t('common.saved'))
      void queryClient.invalidateQueries({ queryKey: ['categories'] })
      onClose()
    },
    onError: (err) => message.error(errorText(err)),
  })

  const title = editing
    ? isChild
      ? t('categories.editChildTitle')
      : t('categories.editTitle')
    : isChild
      ? t('categories.createChildTitle')
      : t('categories.createTitle')

  return (
    <Modal
      open
      title={title}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      confirmLoading={save.isPending}
      onOk={() => form.submit()}
      onCancel={onClose}
      destroyOnHidden
      okButtonProps={{ 'data-testid': 'category-save' } as ButtonProps}
    >
      <Form<FormValues>
        form={form}
        layout="vertical"
        initialValues={{
          name: editing?.name ?? '',
          description: editing?.description ?? '',
          is_active: editing?.is_active ?? true,
          sort_order: editing?.sort_order ?? 0,
        }}
        onFinish={(v) => save.mutate(v)}
      >
        <Form.Item
          name="name"
          label={t('categories.name')}
          rules={[{ required: true, whitespace: true, message: t('categories.nameRequired') }]}
        >
          <Input maxLength={255} data-testid="category-name" />
        </Form.Item>
        <Form.Item name="description" label={t('categories.description')}>
          <Input.TextArea rows={3} maxLength={2000} data-testid="category-description" />
        </Form.Item>
        <Space size="large">
          <Form.Item name="sort_order" label={t('categories.sortOrder')}>
            <InputNumber min={0} max={100000} data-testid="category-sort" />
          </Form.Item>
          <Form.Item name="is_active" label={t('categories.active')} valuePropName="checked">
            <Switch data-testid="category-active" />
          </Form.Item>
        </Space>
      </Form>
    </Modal>
  )
}
