import { useState, useRef, useEffect, ReactNode } from 'react'
import { Info, HelpCircle } from 'lucide-react'

interface TooltipProps {
  content: ReactNode
  children?: ReactNode
  icon?: 'info' | 'help'
  position?: 'top' | 'bottom' | 'right'
  className?: string
}

export function Tooltip({ content, children, icon = 'info', position = 'top', className = '' }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const IconComponent = icon === 'help' ? HelpCircle : Info

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-slate-700',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-slate-700',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-slate-700',
  }

  return (
    <div
      ref={ref}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children ?? <IconComponent size={14} className="text-slate-500 hover:text-slate-400 cursor-help" />}
      {visible && (
        <div
          className={`absolute z-50 ${positionClasses[position]} pointer-events-none`}
        >
          <div className="bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded-lg px-3 py-2 shadow-xl max-w-xs whitespace-pre-wrap leading-relaxed">
            {content}
          </div>
          <div
            className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`}
          />
        </div>
      )}
    </div>
  )
}

interface InlineHintProps {
  children: ReactNode
  className?: string
}

export function InlineHint({ children, className = '' }: InlineHintProps) {
  return (
    <p className={`text-xs text-slate-500 mt-1 ${className}`}>
      {children}
    </p>
  )
}