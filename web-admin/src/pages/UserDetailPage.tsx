import { SwapOutlined, UserOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Avatar, Breadcrumb, Button, Card, Descriptions, Flex, Result, Space, Spin, Typography } from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { userApi } from '../api/client'
import AdjustPointsModal from '../components/AdjustPointsModal'
import { UserRoleTag, UserStatusTag } from '../components/UserTags'
import { useErrorText } from '../hooks/useErrorText'

const EMPTY = '—'

function formatTime(value: string | null) {
  return value ? dayjs(value).format('DD/MM/YYYY HH:mm') : EMPTY
}

export default function UserDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const id = useParams().id ?? ''
  const [adjusting, setAdjusting] = useState(false)

  const user = useQuery({
    queryKey: ['user', id],
    queryFn: () => userApi.get(id),
    enabled: id !== '',
  })

  if (user.isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin />
      </div>
    )
  }
  if (!user.data) {
    return (
      <Result
        status="404"
        title={user.isError ? errorText(user.error) : t('errors.not_found')}
        extra={<Button onClick={() => navigate('/users')}>{t('users.backToList')}</Button>}
      />
    )
  }

  const u = user.data

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Breadcrumb items={[{ title: <Link to="/users">{t('users.title')}</Link> }, { title: u.username }]} />
      <Card>
        <Space size="large" align="center" style={{ marginBottom: 24 }}>
          <Avatar size={72} src={u.avatar_url ?? undefined} icon={<UserOutlined />} />
          <Space orientation="vertical" size={4}>
            <Typography.Title level={4} style={{ margin: 0 }} data-testid="user-detail-username">
              {u.username}
            </Typography.Title>
            <Typography.Text type="secondary">{u.email}</Typography.Text>
            <Space size={4}>
              <UserRoleTag role={u.role} />
              <UserStatusTag status={u.status} />
            </Space>
          </Space>
        </Space>
        <Descriptions bordered column={{ xs: 1, md: 2 }} size="middle" data-testid="user-detail">
          <Descriptions.Item label="ID">{u.id}</Descriptions.Item>
          <Descriptions.Item label={t('users.email')}>{u.email}</Descriptions.Item>
          <Descriptions.Item label={t('users.username')}>{u.username}</Descriptions.Item>
          <Descriptions.Item label={t('users.birthDate')}>
            {u.birth_date ? dayjs(u.birth_date).format('DD/MM/YYYY') : EMPTY}
          </Descriptions.Item>
          <Descriptions.Item label={t('users.location')}>{u.location ?? EMPTY}</Descriptions.Item>
          <Descriptions.Item label={t('users.points')}>
            <Flex justify="space-between" align="center" gap={8}>
              <Typography.Text strong data-testid="user-detail-points">
                {u.points.toLocaleString('vi-VN')}
              </Typography.Text>
              <Button
                size="small"
                icon={<SwapOutlined />}
                onClick={() => setAdjusting(true)}
                data-testid="points-change"
              >
                {t('users.changePoints')}
              </Button>
            </Flex>
          </Descriptions.Item>
          <Descriptions.Item label={t('users.role')}>
            <UserRoleTag role={u.role} />
          </Descriptions.Item>
          <Descriptions.Item label={t('users.status')}>
            <UserStatusTag status={u.status} />
          </Descriptions.Item>
          <Descriptions.Item label={t('users.language')}>{u.language_code}</Descriptions.Item>
          <Descriptions.Item label={t('users.lastLogin')}>{formatTime(u.last_login_at)}</Descriptions.Item>
          <Descriptions.Item label={t('users.createdAt')}>{formatTime(u.created_at)}</Descriptions.Item>
          <Descriptions.Item label={t('users.updatedAt')}>{formatTime(u.updated_at)}</Descriptions.Item>
          <Descriptions.Item label={t('users.bio')} span="filled">
            <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{u.bio ?? EMPTY}</Typography.Paragraph>
          </Descriptions.Item>
        </Descriptions>
      </Card>
      {adjusting && <AdjustPointsModal user={u} onClose={() => setAdjusting(false)} />}
    </Space>
  )
}
