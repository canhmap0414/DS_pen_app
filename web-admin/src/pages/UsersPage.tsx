import { PlusOutlined, UserOutlined } from '@ant-design/icons'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Avatar, Button, Card, Input, Select, Space, Table, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { userApi, type AdminUser, type UserListParams } from '../api/client'
import { UserRoleTag, UserStatusTag } from '../components/UserTags'
import { useErrorText } from '../hooks/useErrorText'

const PAGE_SIZE = 20

function formatTime(value: string | null) {
  return value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '—'
}

export default function UsersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const [params, setParams] = useState<UserListParams>({
    page: 1,
    page_size: PAGE_SIZE,
  })

  const users = useQuery({
    queryKey: ['users', params],
    queryFn: () => userApi.list(params),
    placeholderData: keepPreviousData,
  })

  // Any filter change goes back to the first page.
  const setFilter = (patch: Partial<UserListParams>) => setParams((p) => ({ ...p, ...patch, page: 1 }))

  const columns: ColumnsType<AdminUser> = [
    { title: t('common.id'), dataIndex: 'id', width: 140 },
    {
      title: t('users.user'),
      key: 'user',
      render: (_, u) => (
        <Space>
          <Avatar src={u.avatar_url ?? undefined} icon={<UserOutlined />} />
          <Space orientation="vertical" size={0}>
            <Typography.Text strong>{u.username}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {u.email}
            </Typography.Text>
          </Space>
        </Space>
      ),
    },
    {
      title: t('users.role'),
      dataIndex: 'role',
      width: 120,
      render: (role: AdminUser['role']) => <UserRoleTag role={role} />,
    },
    {
      title: t('users.status'),
      dataIndex: 'status',
      width: 120,
      render: (status: AdminUser['status']) => <UserStatusTag status={status} />,
    },
    {
      title: t('users.points'),
      dataIndex: 'points',
      width: 110,
      align: 'right',
      render: (points: number) => points.toLocaleString('vi-VN'),
    },
    {
      title: t('users.lastLogin'),
      dataIndex: 'last_login_at',
      width: 160,
      render: formatTime,
    },
    {
      title: t('users.createdAt'),
      dataIndex: 'created_at',
      width: 160,
      render: formatTime,
    },
  ]

  return (
    <Card
      title={t('users.title')}
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/users/new')} data-testid="user-add">
          {t('users.add')}
        </Button>
      }
    >
      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder={t('users.searchPlaceholder')}
          style={{ width: 280 }}
          onSearch={(q) => setFilter({ q: q.trim() || undefined })}
          data-testid="user-search"
        />
        <Select
          allowClear
          placeholder={t('users.role')}
          style={{ width: 150 }}
          value={params.role}
          onChange={(role) => setFilter({ role })}
          options={[
            { value: 'admin', label: t('users.roles.admin') },
            { value: 'user', label: t('users.roles.user') },
          ]}
          data-testid="user-filter-role"
        />
        <Select
          allowClear
          placeholder={t('users.status')}
          style={{ width: 150 }}
          value={params.status}
          onChange={(status) => setFilter({ status })}
          options={[
            { value: 'active', label: t('users.statuses.active') },
            { value: 'locked', label: t('users.statuses.locked') },
          ]}
          data-testid="user-filter-status"
        />
      </Space>
      <Table<AdminUser>
        rowKey="id"
        columns={columns}
        dataSource={users.data?.items ?? []}
        loading={users.isFetching}
        scroll={{ x: 1040 }}
        pagination={{
          current: params.page,
          pageSize: params.page_size,
          total: users.data?.total ?? 0,
          showSizeChanger: true,
          showTotal: (total) => t('users.total', { count: total }),
          onChange: (page, page_size) =>
            setParams((p) => ({
              ...p,
              page: page_size === p.page_size ? page : 1,
              page_size,
            })),
        }}
        onRow={(u) => ({ onClick: () => navigate(`/users/${u.id}`), style: { cursor: 'pointer' } })}
        locale={{
          emptyText: users.isError ? errorText(users.error) : t('users.empty'),
        }}
        data-testid="user-table"
      />
    </Card>
  )
}
