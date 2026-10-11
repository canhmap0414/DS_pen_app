import { LockOutlined, MailOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { Alert, Button, Card, Form, Input, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate } from 'react-router-dom'
import { apiErrorCode, authApi } from '../api/client'
import { useAuth } from '../store/auth'

interface LoginForm {
  email: string
  password: string
}

class NotAdminError extends Error {}

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { token, user, setSession } = useAuth()

  const login = useMutation({
    mutationFn: async ({ email, password }: LoginForm) => {
      const res = await authApi.login(email, password)
      if (res.user.role !== 'admin') throw new NotAdminError()
      return res
    },
    onSuccess: (res) => {
      setSession(res.token, res.user)
      navigate('/', { replace: true })
    },
  })

  if (token && user?.role === 'admin') return <Navigate to="/" replace />

  const errorKey = login.error
    ? login.error instanceof NotAdminError
      ? 'not_admin'
      : apiErrorCode(login.error)
    : null

  return (
    <div className="login-page">
      <Card className="login-card">
        <Typography.Title level={3} style={{ textAlign: 'center' }}>
          {t('login.title')}
        </Typography.Title>

        {errorKey && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            data-testid="login-error"
            title={t(`errors.${errorKey}`, { defaultValue: t('errors.unknown') })}
          />
        )}

        <Form<LoginForm> layout="vertical" onFinish={(v) => login.mutate(v)} requiredMark={false}>
          <Form.Item
            name="email"
            label={t('login.email')}
            rules={[
              { required: true, message: t('login.emailRequired') },
              { type: 'email', message: t('login.emailInvalid') },
            ]}
          >
            <Input prefix={<MailOutlined />} autoComplete="username" data-testid="login-email" />
          </Form.Item>
          <Form.Item
            name="password"
            label={t('login.password')}
            rules={[{ required: true, message: t('login.passwordRequired') }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              autoComplete="current-password"
              data-testid="login-password"
            />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={login.isPending}
            data-testid="login-submit"
          >
            {t('login.submit')}
          </Button>
        </Form>
      </Card>
    </div>
  )
}
