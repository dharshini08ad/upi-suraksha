/**
 * The national flag: saffron / white / green bands with the Ashoka chakra.
 * Used as an identity mark in the masthead, not as a decorative fill.
 */
export function Flag({ width = 30 }: { width?: number }) {
  const height = Math.round((width * 2) / 3)
  const chakra = width * 0.2

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 30 20"
      role="img"
      aria-label="Flag of India"
      className="flag"
    >
      <rect x="0" y="0" width="30" height="6.667" fill="var(--flag-saffron)" />
      <rect x="0" y="6.667" width="30" height="6.667" fill="var(--flag-white)" />
      <rect x="0" y="13.334" width="30" height="6.667" fill="var(--flag-green)" />
      <g transform={`translate(15 10) scale(${chakra / 24})`}>
        <circle cx="0" cy="0" r="10" fill="none" stroke="var(--flag-chakra)" strokeWidth="1.5" />
        <circle cx="0" cy="0" r="1.5" fill="var(--flag-chakra)" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <line
            key={angle}
            x1="0"
            y1="0"
            x2="0"
            y2="-10"
            stroke="var(--flag-chakra)"
            strokeWidth="1.1"
            transform={`rotate(${angle})`}
          />
        ))}
        {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((angle) => (
          <line
            key={angle}
            x1="0"
            y1="0"
            x2="0"
            y2="-4.2"
            stroke="var(--flag-chakra)"
            strokeWidth="1.1"
            transform={`rotate(${angle})`}
          />
        ))}
      </g>
      <rect
        x="0"
        y="0"
        width="30"
        height="20"
        fill="none"
        stroke="var(--line-strong)"
        strokeWidth="0.6"
      />
    </svg>
  )
}

/** Service mark: shield + rupee. */
export function Emblem({ size = 38 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="UPI Suraksha emblem"
      className="brand__emblem"
    >
      <rect width="48" height="48" rx="6" fill="var(--blue-600)" />
      <path
        d="M24 6.5 40 12.6v11.9c0 9-6.6 15.3-16 18.6-9.4-3.3-16-9.6-16-18.6V12.6Z"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.5"
      />
      <path
        d="M18.4 16.4h11.2M18.4 19.6h11.2M18.4 22.8h4.6c3.2 0 5 1.6 5 3.7s-1.8 3.7-5 3.7h-4.6m0 0 9.2 5.4"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.8"
        strokeLinecap="square"
      />
    </svg>
  )
}

/** The four flat accent bars used across the service. */
export function ChipBar({ className = '' }: { className?: string }) {
  return (
    <div className={`chipbar ${className}`} aria-hidden="true">
      <span className="chipbar__b" />
      <span className="chipbar__g" />
      <span className="chipbar__y" />
      <span className="chipbar__r" />
    </div>
  )
}
