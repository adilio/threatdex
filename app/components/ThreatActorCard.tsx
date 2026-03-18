import { useEffect, useState } from "react"
import { Maximize2, X } from "lucide-react"
import type { ThreatActor } from "~/schema"
import { CardFront } from "./CardFront"
import { CardBack } from "./CardBack"
import { RarityBadge } from "./RarityBadge"

interface ThreatActorCardProps {
  actor: ThreatActor
  className?: string
}

export function ThreatActorCard({ actor, className }: ThreatActorCardProps) {
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    if (!modalOpen) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setModalOpen(false)
      }
    }

    window.addEventListener("keydown", onKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [modalOpen])

  return (
    <>
      <div className={`flex w-[340px] max-w-full flex-col gap-3 ${className ?? ""}`.trim()}>
        <div
          className="card-shell"
          onClick={() => setModalOpen(true)}
          role="button"
          tabIndex={0}
          aria-label={`Open dossier for ${actor.canonicalName}`}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              setModalOpen(true)
            }
          }}
          style={{
            userSelect: "none",
            WebkitTapHighlightColor: "transparent",
            outline: "none",
          }}
        >
          <CardFront actor={actor} />
        </div>

        <div className="flex items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold uppercase tracking-[0.05em] text-app-text">
              {actor.canonicalName}
            </p>
            <p className="truncate text-sm text-app-muted">
              {actor.tagline ?? actor.description}
            </p>
          </div>
          <button
            type="button"
            className="dex-icon-button shrink-0"
            onClick={() => setModalOpen(true)}
            aria-label={`Open dossier for ${actor.canonicalName}`}
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {modalOpen && (
        <div
          className="dex-modal-overlay"
          onClick={() => setModalOpen(false)}
          role="presentation"
        >
          <div
            className="dex-modal-panel"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`${actor.canonicalName} dossier`}
          >
            <div className="dex-modal-toolbar">
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0">
                  <p className="dex-kicker">Threat Actor Dossier</p>
                  <h3 className="font-display text-2xl font-black uppercase tracking-[0.08em] text-app-text truncate">
                    {actor.canonicalName}
                  </h3>
                </div>
                <RarityBadge rarity={actor.rarity} size="md" />
              </div>
              <button
                type="button"
                className="dex-icon-button shrink-0"
                onClick={() => setModalOpen(false)}
                aria-label="Close dossier"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="dex-modal-body">
              <div className="dex-modal-card-col">
                <div className="card-shell" style={{ cursor: "default", pointerEvents: "none" }}>
                  <CardFront actor={actor} />
                </div>
              </div>
              <div className="dex-modal-intel-col">
                <CardBack actor={actor} variant="panel" />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
