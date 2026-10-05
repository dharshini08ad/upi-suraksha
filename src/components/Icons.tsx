import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Base({ size = 18, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const IconQr = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <path d="M14 14h3v3h-3zM19 19h2v2h-2zM14 20h2M20 14h1" />
  </Base>
)

export const IconLink = (p: IconProps) => (
  <Base {...p}>
    <path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 0 0-5.7-5.7L11.6 6.7" />
    <path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.3 2.3a4 4 0 0 0 5.7 5.7l1.2-1.2" />
  </Base>
)

export const IconAt = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3.5" />
    <path d="M15.5 8.5v5a2.5 2.5 0 0 0 5 0v-1.5a8.5 8.5 0 1 0-3.5 6.8" />
  </Base>
)

export const IconHome = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.5 10.5 12 3.8l8.5 6.7V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1Z" />
  </Base>
)

export const IconClock = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 7v5.3l3.3 2" />
  </Base>
)

export const IconShield = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3 20 6.5v5.7c0 4.6-3.4 7.8-8 9.3-4.6-1.5-8-4.7-8-9.3V6.5Z" />
    <path d="m9 12 2.2 2.2L15.4 10" />
  </Base>
)

export const IconShieldAlert = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3 20 6.5v5.7c0 4.6-3.4 7.8-8 9.3-4.6-1.5-8-4.7-8-9.3V6.5Z" />
    <path d="M12 8.5v4M12 15.6v.2" />
  </Base>
)

export const IconCheck = (p: IconProps) => (
  <Base strokeWidth={2.2} {...p}>
    <path d="m4.5 12.5 5 5 10-11" />
  </Base>
)

export const IconCheckCircle = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.2 2.7 2.7L16 9.6" />
  </Base>
)

export const IconWarning = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3.6 22 20H2Z" />
    <path d="M12 9.5v4.2M12 16.4v.2" />
  </Base>
)

export const IconCross = (p: IconProps) => (
  <Base strokeWidth={2} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
)

export const IconMinus = (p: IconProps) => (
  <Base strokeWidth={2} {...p}>
    <path d="M6 12h12" />
  </Base>
)

export const IconCamera = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 8.5h3.2l1.4-2.2h8.8l1.4 2.2H21v10.2H3z" />
    <circle cx="12" cy="13.5" r="3.4" />
  </Base>
)

export const IconUpload = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 16V4.5M8 8l4-3.5L16 8" />
    <path d="M4 15v4.5h16V15" />
  </Base>
)

export const IconClipboard = (p: IconProps) => (
  <Base {...p}>
    <rect x="5" y="4.5" width="14" height="16" rx="1.5" />
    <path d="M9 4.5V3h6v1.5M9 10h6M9 14h4" />
  </Base>
)

export const IconSearch = (p: IconProps) => (
  <Base {...p}>
    <circle cx="10.8" cy="10.8" r="6.3" />
    <path d="m15.5 15.5 4 4" />
  </Base>
)

export const IconBlock = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="m6.2 6.2 11.6 11.6" />
  </Base>
)

export const IconRefresh = (p: IconProps) => (
  <Base {...p}>
    <path d="M20 12a8 8 0 1 1-2.6-5.9" />
    <path d="M20.5 4v4.5H16" />
  </Base>
)

export const IconArrowRight = (p: IconProps) => (
  <Base {...p}>
    <path d="M4.5 12h15M13.5 6l6 6-6 6" />
  </Base>
)

export const IconArrowLeft = (p: IconProps) => (
  <Base {...p}>
    <path d="M19.5 12h-15M10.5 6l-6 6 6 6" />
  </Base>
)

export const IconInfo = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 11v5.2M12 7.8v.2" />
  </Base>
)

export const IconMenu = (p: IconProps) => (
  <Base strokeWidth={2} {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Base>
)

export const IconClose = (p: IconProps) => (
  <Base strokeWidth={2} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
)

export const IconPhone = (p: IconProps) => (
  <Base {...p}>
    <path d="M6.2 3.8 9 3.3l1.6 4-2 1.3a11 11 0 0 0 4.8 4.8l1.3-2 4 1.6-.5 2.8a1.9 1.9 0 0 1-2.1 1.5C9.9 17 6.3 13.4 4.7 6a1.9 1.9 0 0 1 1.5-2.2Z" />
  </Base>
)
