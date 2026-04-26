import type { CSSProperties } from "react"

interface WizStarProps {
  className?: string
  style?: CSSProperties
  size?: number
  title?: string
}

export function WizStar({ className, style, size = 14, title }: WizStarProps) {
  return (
    <svg
      className={className ? `wiz-star ${className}` : "wiz-star"}
      width={size}
      height={size}
      viewBox="0 0 180 180"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      style={style}
    >
      {title && <title>{title}</title>}
      <path
        d="M178.5 87.8c.6.1 1.1.4 1.4.8.3.5.6.9.6 1.5s-.2 1-.6 1.5c-.4.5-.8.7-1.4.8-19.4 4.4-48.9 13.1-60.9 25.1-12 12-20.6 41.4-25.2 60.8-.1.6-.4 1-.8 1.3-.5.4-.9.6-1.5.5-.6 0-1-.2-1.5-.5-.5-.4-.7-.8-.8-1.3-4.4-19.4-13.1-48.8-25.2-60.8-12-12-41.4-20.6-60.9-25.1-.6-.1-1-.4-1.3-.8-.3-.5-.5-.9-.5-1.5s.2-1 .6-1.5c.4-.5.8-.7 1.3-.8 19.4-4.4 48.9-13.1 60.9-25.1 12-12 20.6-41.4 25.2-60.8.1-.6.4-1 .8-1.3.5-.4.9-.6 1.5-.6s1 .2 1.5.6c.5.4.7.8.8 1.3 4.4 19.4 13.1 48.8 25.2 60.8 12 12 41.4 20.6 60.9 25.1Z"
        fill="currentColor"
      />
    </svg>
  )
}
