import type { ReactNode } from 'react'

import { Modal } from './Modal'

export interface DetailField {
  label: string
  value: ReactNode
  colSpan?: 2
  hidden?: boolean
}

interface DetailsModalProps {
  title: string
  fields: DetailField[]
  open: boolean
  onClose: () => void
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function DetailsModal({ title, fields, open, onClose, size = 'lg' }: DetailsModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size={size}>
      <dl className="grid grid-cols-2 gap-4">
        {fields
          .filter((f) => !f.hidden)
          .map((field, i) => (
            <div key={i} className={field.colSpan === 2 ? 'col-span-2' : undefined}>
              <dt className="text-sm font-medium text-text-muted">{field.label}</dt>
              <dd className="mt-1 text-sm text-text-primary">{field.value}</dd>
            </div>
          ))}
      </dl>
    </Modal>
  )
}
