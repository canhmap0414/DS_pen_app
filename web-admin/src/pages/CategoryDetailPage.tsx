import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Breadcrumb, Button, Card, Descriptions, Result, Space, Spin, Table, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { categoryApi, type Category } from '../api/client'
import CategoryActions, { CategoryStatusTag } from '../components/CategoryActions'
import CategoryEditor, { type CategoryEditorState } from '../components/CategoryEditor'
import { useErrorText } from '../hooks/useErrorText'

export default function CategoryDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const id = useParams().id ?? ''
  const [editor, setEditor] = useState<CategoryEditorState | null>(null)

  const categories = useQuery({ queryKey: ['categories'], queryFn: categoryApi.list })
  const parent = categories.data?.find((c) => c.id === id)

  if (categories.isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin />
      </div>
    )
  }
  if (categories.isError || !parent) {
    return (
      <Result
        status="404"
        title={categories.isError ? errorText(categories.error) : t('errors.not_found')}
        extra={
          <Button onClick={() => navigate('/categories')}>{t('categories.backToList')}</Button>
        }
      />
    )
  }

  const children = parent.children ?? []

  const columns: ColumnsType<Category> = [
    { title: t('common.id'), dataIndex: 'id', width: 140 },
    {
      title: t('categories.childName'),
      dataIndex: 'name',
      render: (name: string, c) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text>{name}</Typography.Text>
          {c.description && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {c.description}
            </Typography.Text>
          )}
        </Space>
      ),
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
      width: 170,
      render: (_, c) => (
        <CategoryActions category={c} onEdit={() => setEditor({ mode: 'edit', category: c })} />
      ),
    },
  ]

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Breadcrumb
        items={[
          { title: <Link to="/categories">{t('categories.title')}</Link> },
          { title: parent.name },
        ]}
      />

      <Card
        title={
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/categories')}
              aria-label={t('categories.backToList')}
              data-testid="category-back"
            />
            <span data-testid="category-detail-name">{parent.name}</span>
          </Space>
        }
        extra={
          <CategoryActions
            category={parent}
            onEdit={() => setEditor({ mode: 'edit', category: parent })}
            onDeleted={() => navigate('/categories')}
          />
        }
      >
        <Descriptions column={{ xs: 1, md: 2 }} size="small">
          <Descriptions.Item label={t('categories.description')} span="filled">
            {parent.description || '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('categories.status')}>
            <CategoryStatusTag active={parent.is_active} />
          </Descriptions.Item>
          <Descriptions.Item label={t('categories.sortOrder')}>{parent.sort_order}</Descriptions.Item>
          <Descriptions.Item label={t('categories.productCountDirect')}>
            {parent.product_count}
          </Descriptions.Item>
          <Descriptions.Item label={t('categories.childrenCount')}>{children.length}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title={t('categories.childrenTitle')}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setEditor({ mode: 'create', parentId: parent.id })}
            data-testid="category-add-child"
          >
            {t('categories.addChild')}
          </Button>
        }
      >
        <Table<Category>
          rowKey="id"
          columns={columns}
          dataSource={children}
          pagination={false}
          scroll={{ x: 840 }}
          locale={{ emptyText: t('categories.emptyChildren') }}
          data-testid="category-children-table"
        />
      </Card>

      {editor && <CategoryEditor state={editor} onClose={() => setEditor(null)} />}
    </Space>
  )
}
