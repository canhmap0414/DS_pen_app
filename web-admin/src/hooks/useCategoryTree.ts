import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { categoryApi, type Category } from '../api/client'

export interface CategoryTreeNode {
  value: string
  title: string
  children?: CategoryTreeNode[]
}

// Tree data for antd TreeSelect; products can attach to both parent and child categories.
export function useCategoryTree() {
  const { t } = useTranslation()
  const categories = useQuery({ queryKey: ['categories'], queryFn: categoryApi.list })

  const toNode = (c: Category): CategoryTreeNode => ({
    value: c.id,
    title: c.is_active ? c.name : `${c.name} (${t('categories.inactive')})`,
    children: c.children?.map(toNode),
  })

  return { treeData: categories.data?.map(toNode) ?? [], loading: categories.isLoading }
}
