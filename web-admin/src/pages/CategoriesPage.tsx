import { PlusOutlined, RightOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Space, Table, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { categoryApi, type Category } from '../api/client'
import CategoryActions, { CategoryStatusTag } from '../components/CategoryActions'
import CategoryEditor, { type CategoryEditorState } from '../components/CategoryEditor'
import { useErrorText } from '../hooks/useErrorText'

export default function CategoriesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const [editor, setEditor] = useState<CategoryEditorState | null>(null)

  const categories = useQuery({ queryKey: ['categories'], queryFn: categoryApi.list })

  const columns: ColumnsType<Category> = [
    { title: t('common.id'), dataIndex: 'id', width: 140 },
    {
      title: t('categories.name'),
      dataIndex: 'name',
      render: (name: string, c) => (
        <Space orientation="vertical" size={0}>
          <Link to={`/categories/${c.id}`} data-testid={`category-link-${c.id}`}>
            <Typography.Text strong>{name}</Typography.Text>
          </Link>
          {c.description && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {c.description}
            </Typography.Text>
          )}
        </Space>
      ),
    },
    {
      title: t('categories.childrenCount'),
      key: 'children_count',
      width: 150,
      align: 'right',
      render: (_, c) => c.children?.length ?? 0,
    },
    { title: t('categories.productCount'), dataIndex: 'product_count', width: 100, align: 'right' },
    { title: t('categories.sortOrder'), dataIndex: 'sort_order', width: 130, align: 'right' },
    {
      title: t('categories.status'),
      dataIndex: 'is_active',
      width: 110,
      render: (active: boolean) => <CategoryStatusTag active={active} />,
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 200,
      render: (_, c) => (
        <Space>
          <CategoryActions category={c} onEdit={() => setEditor({ mode: 'edit', category: c })} />
          <RightOutlined style={{ color: '#bbb' }} />
        </Space>
      ),
    },
  ]

  return (
    <Card
      title={t('categories.title')}
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setEditor({ mode: 'create', parentId: null })}
          data-testid="category-add"
        >
          {t('categories.add')}
        </Button>
      }
    >
      <Table<Category>
        rowKey="id"
        columns={columns}
        dataSource={categories.data ?? []}
        loading={categories.isLoading}
        pagination={false}
        scroll={{ x: 1040 }}
        expandable={{ childrenColumnName: '_none' }}
        onRow={(c) => ({ onClick: () => navigate(`/categories/${c.id}`), style: { cursor: 'pointer' } })}
        locale={{ emptyText: categories.isError ? errorText(categories.error) : t('categories.empty') }}
        data-testid="category-table"
      />
      {editor && <CategoryEditor state={editor} onClose={() => setEditor(null)} />}
    </Card>
  )
}
