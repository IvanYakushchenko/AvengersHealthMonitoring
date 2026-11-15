// Code was assisted with Claude.
// Props of the mission emblem: its size, set with CSS classes.
type NasaLogoProps = {
  className?: string
}

// Hero emblem shown on the login screen.
function NasaLogo({ className }: NasaLogoProps) {
  return <img src="/mission-logo.png" alt="Mission emblem" className={className} />
}

export default NasaLogo
