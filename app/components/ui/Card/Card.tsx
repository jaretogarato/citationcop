import { ReactNode } from 'react'

interface Props {
  title: string
  description?: string
  footer?: ReactNode
  children: ReactNode
  variant?: 'default' | 'borderless' // Add variant prop
}

export default function Card({
  title,
  description,
  footer,
  children,
  variant = 'default' // Default to the original style
}: Props) {
  return (
    <div
      className={`w-full max-w-3xl m-auto my-8 
      ${variant === 'default' ? 'border rounded-md p border-zinc-700' : ''}`}
    >
      <div
        className={`
        ${variant === 'default' ? 'px-5 py-4' : ''}`}
      >
        {title && <h3 className="mb-1 text-2xl font-medium">{title}</h3>}
        {description && <p className="text-zinc-300">{description}</p>}
        {children}
      </div>
      {footer && (
        <div
          className={`p-4 
          ${variant === 'default' ? 'border-t rounded-b-md border-zinc-700 bg-zinc-900' : ''} 
          text-zinc-500`}
        >
          {footer}
        </div>
      )}
    </div>
  )
}
