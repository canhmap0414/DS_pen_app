import { Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../store/auth'

export default function DashboardPage() {
  const { t } = useTranslation()
  const user = useAuth((s) => s.user)

  return (
    <Typography.Title level={3} data-testid="dashboard-welcome">
      {t('dashboard.welcome', { name: user?.username })}
    </Typography.Title>
  )
}
