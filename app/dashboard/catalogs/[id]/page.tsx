'use client'

import { useParams } from 'next/navigation'
import CatalogEditor from '@/components/CatalogEditor'

export default function CatalogEditorPage() {
  const params = useParams()
  const catalogId = params?.id === 'new' ? undefined : params?.id as string | undefined

  return (
    <div className="min-h-screen bg-gray-50">
      <CatalogEditor catalogId={catalogId} />
    </div>
  )
}

