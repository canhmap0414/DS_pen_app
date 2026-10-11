import { PlusOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { App, Upload } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { uploadApi } from '../api/client'
import { useErrorText } from '../hooks/useErrorText'

export const MAX_PRODUCT_IMAGES = 2
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp']

// Controlled by antd Form: value is the ordered list of image URLs, the first one is the thumbnail.
export default function ProductImagesInput({
  value = [],
  onChange,
}: {
  value?: string[]
  onChange?: (urls: string[]) => void
}) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const errorText = useErrorText()
  const [uploading, setUploading] = useState(0)
  // Uploads finish asynchronously, so read the latest value instead of the one captured at selection time.
  const latest = useRef(value)
  useEffect(() => {
    latest.current = value
  }, [value])

  const upload = async (file: File) => {
    if (!ACCEPT.includes(file.type)) {
      message.error(t('errors.invalid_image'))
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      message.error(t('errors.image_too_large'))
      return
    }
    setUploading((n) => n + 1)
    try {
      const url = await uploadApi.image(file)
      if (latest.current.length < MAX_PRODUCT_IMAGES) onChange?.([...latest.current, url])
    } catch (err) {
      message.error(errorText(err))
    } finally {
      setUploading((n) => n - 1)
    }
  }

  const fileList: UploadFile[] = value.map((url, i) => ({
    uid: `${i}-${url}`,
    name: t('products.imageN', { n: i + 1 }),
    status: 'done',
    url,
  }))
  if (uploading > 0) fileList.push({ uid: 'uploading', name: '', status: 'uploading' })

  return (
    <Upload
      listType="picture-card"
      accept={ACCEPT.join(',')}
      fileList={fileList}
      beforeUpload={(file) => {
        void upload(file)
        return Upload.LIST_IGNORE
      }}
      onRemove={(f) => {
        onChange?.(value.filter((url, i) => `${i}-${url}` !== f.uid))
        return true
      }}
      onPreview={(f) => f.url && window.open(f.url, '_blank', 'noopener')}
      data-testid="product-images"
    >
      {fileList.length < MAX_PRODUCT_IMAGES && (
        <button type="button" style={{ border: 0, background: 'none', cursor: 'pointer' }}>
          <PlusOutlined />
          <div style={{ marginTop: 8 }}>{t('products.uploadImage')}</div>
        </button>
      )}
    </Upload>
  )
}
