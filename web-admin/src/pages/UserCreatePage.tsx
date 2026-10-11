import { useMutation, useQueryClient } from '@tanstack/react-query'
import { App, Breadcrumb, Button, Card, DatePicker, Form, Input, Space } from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { userApi, type CreateUserInput } from '../api/client'
import { useErrorText } from '../hooks/useErrorText'

interface FormValues extends Omit<CreateUserInput, 'birth_date'> {
  password_confirm: string
  birth_date?: Dayjs | null
}

export default function UserCreatePage() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const [form] = Form.useForm<FormValues>()

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      userApi.create({
        email: v.email,
        password: v.password,
        username: v.username,
        birth_date: v.birth_date?.format('YYYY-MM-DD') ?? null,
        location: v.location,
        bio: v.bio,
      }),
    onSuccess: () => {
      message.success(t('users.created'))
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      navigate('/users')
    },
    onError: (err) => message.error(errorText(err)),
  })

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Breadcrumb items={[{ title: <Link to="/users">{t('users.title')}</Link> }, { title: t('users.createTitle') }]} />
      <Card title={t('users.createTitle')} style={{ maxWidth: 640 }}>
        <Form<FormValues> form={form} layout="vertical" onFinish={(v) => create.mutate(v)}>
          <Form.Item
            name="email"
            label={t('users.email')}
            rules={[
              { required: true, message: t('login.emailRequired') },
              { type: 'email', message: t('login.emailInvalid') },
            ]}
          >
            <Input maxLength={255} autoComplete="off" data-testid="user-email" />
          </Form.Item>
          <Form.Item
            name="username"
            label={t('users.username')}
            rules={[
              {
                required: true,
                whitespace: true,
                message: t('users.usernameRequired'),
              },
            ]}
          >
            <Input maxLength={100} data-testid="user-username" />
          </Form.Item>
          <Form.Item
            name="password"
            label={t('login.password')}
            rules={[
              { required: true, message: t('login.passwordRequired') },
              { min: 8, max: 72, message: t('users.passwordLength') },
            ]}
          >
            <Input.Password autoComplete="new-password" data-testid="user-password" />
          </Form.Item>
          <Form.Item
            name="password_confirm"
            label={t('users.passwordConfirm')}
            dependencies={['password']}
            rules={[
              { required: true, message: t('users.passwordConfirmRequired') },
              ({ getFieldValue }) => ({
                validator: (_, value) =>
                  !value || getFieldValue('password') === value
                    ? Promise.resolve()
                    : Promise.reject(new Error(t('users.passwordMismatch'))),
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" data-testid="user-password-confirm" />
          </Form.Item>
          <Form.Item name="birth_date" label={t('users.birthDate')}>
            <DatePicker
              format="DD/MM/YYYY"
              disabledDate={(d) => d.isAfter(dayjs(), 'day')}
              style={{ width: '100%' }}
              data-testid="user-birth-date"
            />
          </Form.Item>
          <Form.Item name="location" label={t('users.location')}>
            <Input maxLength={255} data-testid="user-location" />
          </Form.Item>
          <Form.Item name="bio" label={t('users.bio')}>
            <Input.TextArea rows={3} maxLength={2000} showCount data-testid="user-bio" />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={create.isPending} data-testid="user-save">
              {t('common.save')}
            </Button>
            <Button onClick={() => navigate('/users')}>{t('common.cancel')}</Button>
          </Space>
        </Form>
      </Card>
    </Space>
  )
}
