'use client'

import { useParams } from 'next/navigation'
import WorkflowEditor from '@/components/WorkflowEditor'

export default function WorkflowEditorPage() {
  const params = useParams()
  const workflowId = params?.id === 'new' ? undefined : params?.id as string | undefined

  return (
    <div className="min-h-screen bg-autozap-gray-dark">
      <WorkflowEditor workflowId={workflowId} />
    </div>
  )
}

