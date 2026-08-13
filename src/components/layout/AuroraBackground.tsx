// src/components/layout/AuroraBackground.tsx — VEXALGO 2.0
// Der Name bleibt aus Kompatibilitaetsgruenden erhalten; der Inhalt ist neu:
// statt Aurora-Nebel, Hex-Raster, Sternen und Partikeln nur noch die
// blaue Signature-Diagonale mit Abdunkelung nach unten.
'use client'

export function AuroraBackground() {
  return (
    <div aria-hidden className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {/* Diagonalflaeche */}
      <div
        className="absolute"
        style={{
          top: '-8%', left: '-8%', width: '130%', height: '126%',
          opacity: 0.60,
          background: 'linear-gradient(158deg,#2B5DD6 0%,#1C46A8 40%,#12307B 72%,#0C2154 100%)',
          clipPath: 'polygon(72% 0,100% 0,100% 100%,34% 100%)',
        }}
      />

      {/* Abdunkelung nach unten — haelt Inhalte und Navigation lesbar */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(8,13,24,0.30) 0%, rgba(8,13,24,0.10) 34%, ' +
            'rgba(8,13,24,0.52) 74%, rgba(8,13,24,0.94) 100%)',
        }}
      />
    </div>
  )
}
