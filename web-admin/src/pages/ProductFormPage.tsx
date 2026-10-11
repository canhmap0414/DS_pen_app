import { ArrowLeftOutlined, DeleteOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App,
  Breadcrumb,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Radio,
  Result,
  Row,
  Select,
  Space,
  Spin,
  TreeSelect,
} from 'antd'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { productApi, type ProductDetail, type ProductInput } from '../api/client'
import ProductImagesInput from '../components/ProductImagesInput'
import StockTag from '../components/StockTag'
import { useCategoryTree } from '../hooks/useCategoryTree'
import { useErrorText } from '../hooks/useErrorText'

const MIN_YEAR = 1840

export default function ProductFormPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const param = useParams().id
  const id = param === 'new' ? null : (param ?? null)

  const product = useQuery({
    queryKey: ['product', id],
    queryFn: () => productApi.get(id!),
    enabled: id !== null,
  })

  const title = id === null ? t('products.createTitle') : t('products.editTitle')
  const breadcrumb = (
    <Breadcrumb
      items={[{ title: <Link to="/products">{t('products.title')}</Link> }, { title }]}
    />
  )

  if (id !== null && product.isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin />
      </div>
    )
  }
  if (id !== null && !product.data) {
    return (
      <Result
        status="404"
        title={product.isError ? errorText(product.error) : t('errors.not_found')}
        extra={<Button onClick={() => navigate('/products')}>{t('products.backToList')}</Button>}
      />
    )
  }

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      {breadcrumb}
      {/* key remounts the form so initialValues apply once the product has loaded */}
      <ProductForm key={id ?? 'new'} product={product.data ?? null} title={title} />
    </Space>
  )
}

type FormValues = ProductInput

function ProductForm({ product, title }: { product: ProductDetail | null; title: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const categoryTree = useCategoryTree()
  const [form] = Form.useForm<FormValues>()
  const now = dayjs()
  const year = Form.useWatch('production_year', form)

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['products'] })
    void queryClient.invalidateQueries({ queryKey: ['product'] })
    void queryClient.invalidateQueries({ queryKey: ['categories'] })
  }

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const input: ProductInput = {
        ...values,
        production_month: values.production_month ?? null,
        images: values.images ?? [],
      }
      return product ? productApi.update(product.id, input) : productApi.create(input)
    },
    onSuccess: () => {
      message.success(t('common.saved'))
      invalidate()
      navigate('/products')
    },
    onError: (err) => message.error(errorText(err)),
  })

  const remove = useMutation({
    mutationFn: () => productApi.remove(product!.id),
    onSuccess: () => {
      message.success(t('common.deleted'))
      invalidate()
      navigate('/products')
    },
    onError: (err) => message.error(errorText(err)),
  })

  const months = Array.from({ length: 12 }, (_, i) => i + 1)
    .filter((m) => year !== now.year() || m <= now.month() + 1)
    .map((m) => ({ value: m, label: t('products.monthN', { n: m }) }))

  return (
    <Card
      title={
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/products')}
            aria-label={t('products.backToList')}
            data-testid="product-back"
          />
          <span>{title}</span>
        </Space>
      }
      extra={
        product && (
          <Popconfirm
            title={t('products.deleteConfirm', { name: product.name })}
            okText={t('common.yes')}
            cancelText={t('common.no')}
            onConfirm={() => remove.mutate()}
          >
            <Button danger icon={<DeleteOutlined />} loading={remove.isPending} data-testid="product-delete">
              {t('common.delete')}
            </Button>
          </Popconfirm>
        )
      }
    >
      {product && (
        <Descriptions size="small" column={{ xs: 1, md: 3 }} style={{ marginBottom: 24 }}>
          <Descriptions.Item label={t('products.owner')}>{product.owner_username}</Descriptions.Item>
          <Descriptions.Item label={t('products.stockStatus')}>
            <StockTag status={product.stock_status} />
          </Descriptions.Item>
          <Descriptions.Item label={t('products.updatedAt')}>
            {dayjs(product.updated_at).format('DD/MM/YYYY HH:mm')}
          </Descriptions.Item>
        </Descriptions>
      )}

      <Form<FormValues>
        form={form}
        layout="vertical"
        initialValues={{
          name: product?.name ?? '',
          category_id: product?.category_id,
          description: product?.description ?? '',
          production_year: product?.production_year,
          production_month: product?.production_month ?? undefined,
          quantity: product?.quantity ?? 1,
          price_points: product?.price_points,
          status: product?.status ?? 'unpublished',
          images: product?.images ?? [],
        }}
        onFinish={(v) => save.mutate(v)}
        style={{ maxWidth: 820 }}
      >
        <Form.Item
          name="name"
          label={t('products.name')}
          rules={[{ required: true, whitespace: true, message: t('products.nameRequired') }]}
        >
          <Input maxLength={255} data-testid="product-name" />
        </Form.Item>

        <Form.Item
          name="category_id"
          label={t('products.category')}
          rules={[{ required: true, message: t('products.categoryRequired') }]}
        >
          <TreeSelect
            treeDefaultExpandAll
            showSearch
            treeNodeFilterProp="title"
            treeData={categoryTree.treeData}
            loading={categoryTree.loading}
            data-testid="product-category"
          />
        </Form.Item>

        <Form.Item name="description" label={t('products.description')}>
          <Input.TextArea rows={4} maxLength={5000} showCount data-testid="product-description" />
        </Form.Item>

        <Row gutter={16}>
          <Col xs={12} md={6}>
            <Form.Item
              name="production_year"
              label={t('products.productionYear')}
              rules={[{ required: true, message: t('products.yearRequired') }]}
            >
              <InputNumber
                min={MIN_YEAR}
                max={now.year()}
                precision={0}
                style={{ width: '100%' }}
                data-testid="product-year"
              />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item name="production_month" label={t('products.productionMonth')}>
              <Select allowClear options={months} data-testid="product-month" />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item
              name="quantity"
              label={t('products.quantity')}
              rules={[{ required: true, message: t('products.quantityRequired') }]}
            >
              <InputNumber min={0} max={1000000} precision={0} style={{ width: '100%' }} data-testid="product-quantity" />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item
              name="price_points"
              label={t('products.pricePoints')}
              rules={[{ required: true, message: t('products.priceRequired') }]}
            >
              <InputNumber min={1} max={1000000000} precision={0} style={{ width: '100%' }} data-testid="product-price" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="images" label={t('products.images')} extra={t('products.imagesHint')}>
          <ProductImagesInput />
        </Form.Item>

        <Form.Item name="status" label={t('products.statusLabel')}>
          <Radio.Group
            optionType="button"
            options={[
              { value: 'published', label: t('products.status.published') },
              { value: 'unpublished', label: t('products.status.unpublished') },
            ]}
            data-testid="product-status"
          />
        </Form.Item>

        <Space>
          <Button type="primary" htmlType="submit" loading={save.isPending} data-testid="product-save">
            {t('common.save')}
          </Button>
          <Button onClick={() => navigate('/products')}>{t('common.cancel')}</Button>
        </Space>
      </Form>
    </Card>
  )
}
