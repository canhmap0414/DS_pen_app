import { Tag } from 'antd'
import { useTranslation } from 'react-i18next'
import type { User } from '../store/auth'

export function UserRoleTag({ role }: { role: User['role'] }) {
  const { t } = useTranslation()
  return role === 'admin' ? <Tag color="blue">{t('users.roles.admin')}</Tag> : <Tag>{t('users.roles.user')}</Tag>
}

export function UserStatusTag({ status }: { status: User['status'] }) {
  const { t } = useTranslation()
  return status === 'active' ? (
    <Tag color="green">{t('users.statuses.active')}</Tag>
  ) : (
    <Tag color="red">{t('users.statuses.locked')}</Tag>
  )
}
