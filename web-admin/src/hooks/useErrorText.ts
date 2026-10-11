import { useTranslation } from 'react-i18next'
import { apiErrorCode } from '../api/client'

export function useErrorText() {
  const { t } = useTranslation()
  return (err: unknown) => t(`errors.${apiErrorCode(err)}`, { defaultValue: t('errors.unknown') })
}
