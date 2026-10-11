import { DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { App, Button, Popconfirm, Space, Tag } from 'antd'
import { useTranslation } from 'react-i18next'
import { categoryApi, type Category } from '../api/client'
import { useErrorText } from '../hooks/useErrorText'

export function CategoryStatusTag({ active }: { active: boolean }) {
  const { t } = useTranslation()
  return active ? <Tag color="green">{t('categories.active')}</Tag> : <Tag>{t('categories.inactive')}</Tag>
}

export default function CategoryActions({
  category,
  onEdit,
  onDeleted,
}: {
  category: Category
  onEdit: () => void
  onDeleted?: () => void
}) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const errorText = useErrorText()

  const remove = useMutation({
    mutationFn: () => categoryApi.remove(category.id),
    onSuccess: () => {
      message.success(t('common.deleted'))
      void queryClient.invalidateQueries({ queryKey: ['categories'] })
      onDeleted?.()
    },
    onError: (err) => message.error(errorText(err)),
  })

  return (
    <Space wrap onClick={(e) => e.stopPropagation()}>
      <Button size="small" icon={<EditOutlined />} onClick={onEdit} data-testid={`category-edit-${category.id}`}>
        {t('common.edit')}
      </Button>
      <Popconfirm
        title={t('categories.deleteConfirm', { name: category.name })}
        okText={t('common.yes')}
        cancelText={t('common.no')}
        onConfirm={() => remove.mutate()}
      >
        <Button
          size="small"
          danger
          icon={<DeleteOutlined />}
          loading={remove.isPending}
          data-testid={`category-delete-${category.id}`}
        >
          {t('common.delete')}
        </Button>
      </Popconfirm>
    </Space>
  )
}
