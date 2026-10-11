import {
  ApartmentOutlined,
  DashboardOutlined,
  LogoutOutlined,
  ShoppingCartOutlined,
  TagsOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Layout, Menu, Space, Spin, Typography } from 'antd'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { authApi } from '../api/client'
import { useAuth } from '../store/auth'

export default function AdminLayout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { token, user, setUser, logout } = useAuth()

  const me = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
    enabled: !!token,
  })

  useEffect(() => {
    if (!me.data) return
    if (me.data.role !== 'admin') logout()
    else setUser(me.data)
  }, [me.data, setUser, logout])

  if (!token || (me.data && me.data.role !== 'admin')) return <Navigate to="/login" replace />
  if (!user || me.isPending) {
    return (
      <div className="center-screen">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Sider breakpoint="lg" collapsedWidth={0}>
        <div className="sider-brand">{t('app.name')}</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={['/' + (location.pathname.split('/')[1] ?? '')]}
          onClick={({ key }) => navigate(key)}
          items={[
            { key: '/', icon: <DashboardOutlined />, label: t('layout.menu.dashboard') },
            { key: '/categories', icon: <ApartmentOutlined />, label: t('layout.menu.categories') },
            { key: '/products', icon: <TagsOutlined />, label: t('layout.menu.products') },
            { key: '/orders', icon: <ShoppingCartOutlined />, label: t('layout.menu.orders') },
            { key: '/users', icon: <TeamOutlined />, label: t('layout.menu.users') },
          ]}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header className="admin-header">
          <Space>
            <Typography.Text data-testid="header-username">{user.username}</Typography.Text>
            <Button icon={<LogoutOutlined />} onClick={logout} data-testid="logout">
              {t('layout.logout')}
            </Button>
          </Space>
        </Layout.Header>
        <Layout.Content style={{ margin: 24 }}>
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  )
}
