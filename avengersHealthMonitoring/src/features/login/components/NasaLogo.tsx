type NasaLogoProps = {
  className?: string
}

// Original NASA-inspired emblem drawn for this prototype. It is not the
// official NASA logo; swap in the official file only if NASA's logo
// guidelines allow your use.
function NasaLogo({ className }: NasaLogoProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      role="img"
      aria-label="NASA-style mission emblem"
      className={className}
    >
      <circle cx="60" cy="60" r="56" fill="#0b3d91" />
      <circle cx="60" cy="60" r="44" fill="none" stroke="#ffffff" strokeWidth="3" />
      <path
        d="M20 78 C 50 40, 70 90, 100 42"
        fill="none"
        stroke="#ffffff"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M20 78 C 50 40, 70 90, 100 42"
        fill="none"
        stroke="#5b8fd6"
        strokeWidth="2"
        strokeLinecap="round"
        transform="translate(0 -6)"
      />
      <circle cx="100" cy="42" r="4" fill="#ffffff" />
    </svg>
  )
}

export default NasaLogo
