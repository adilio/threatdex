import { useEffect, useState } from "react"
import { ArrowRight, Maximize2, RotateCcw, X } from "lucide-react"
import type { ThreatActor } from "~/schema"
import { CardFront } from "./CardFront"
import { CardBack } from "./CardBack"

interface ThreatActorCardProps {
  actor: ThreatActor
  flipped?: boolean
  onFlip?: () => void
  className?: string
}

export function ThreatActorCard({
  actor,
  flipped,
  onFlip,
  className,
}: ThreatActorCardProps) {
  const [internalFlipped, setInternalFlipped] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const isFlipped = flipped !== undefined ? flipped : internalFlipped

  useEffect(() => {
    if (!modalOpen) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setModalOpen(false)
      }
      if (event.key.toLowerCase() === "f") {
        handleFlip()
      }
    }

    window.addEventListener("keydown", onKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [modalOpen, isFlipped])

  function handleFlip() {
    if (onFlip) {
      onFlip()
    } else {
      setInternalFlipped((prev) => !prev)
    }
  }

  return (
    <>
      <div className={`flex flex-col gap-3 ${className ?? ""}`.trim()}>
        <div
          className="card-shell"
          onClick={() => setModalOpen(true)}
          role="button"
          tabIndex={0}
          aria-label={`Open expanded threat actor card for ${actor.canonicalName}.`}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              setModalOpen(true)
            }
          }}
          style={{
            cursor: "pointer",
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
            aria-label={`Expand ${actor.canonicalName}`}
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
            aria-label={`${actor.canonicalName} expanded dossier`}
          >
            <div className="dex-modal-toolbar">
              <div>
                <p className="dex-kicker">Expanded Dossier</p>
                <h3 className="font-display text-2xl font-black uppercase tracking-[0.08em] text-app-text">
                  {actor.canonicalName}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="dex-icon-button"
                  onClick={handleFlip}
                  aria-label={isFlipped ? "Show front of card" : "Show back of card"}
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>{isFlipped ? "Front" : "Back"}</span>
                </button>
                <button
                  type="button"
                  className="dex-icon-button"
                  onClick={() => setModalOpen(false)}
                  aria-label="Close expanded card"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="dex-modal-content">
              <div className="dex-modal-card-wrap">
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    position: "relative",
                    transformStyle: "preserve-3d",
                    transition: "transform 0.55s cubic-bezier(0.4, 0.2, 0.2, 1)",
                    transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                    }}
                  >
                    <CardFront actor={actor} variant="expanded" />
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                    }}
                  >
                    <CardBack actor={actor} variant="expanded" />
                  </div>
                </div>
              </div>

              <div className="dex-subpanel flex flex-col justify-between gap-5">
                <div className="space-y-4">
                  <div className="rounded-3xl border border-app-border bg-app-panel p-5">
                    <p className="dex-kicker mb-3">How To Use</p>
                    <div className="space-y-2 text-sm leading-6 text-app-muted">
                      <p>Flip the dossier to move between the visual front and the intel-heavy back.</p>
                      <p>The expanded view is scrollable, so no techniques, campaigns, tools, or profile text get cut off.</p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-app-border bg-app-panel p-5">
                    <p className="dex-kicker mb-3">Quick Actions</p>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        className="dex-button"
                        onClick={handleFlip}
                      >
                        Flip Dossier
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      <a
                        href={`/actors/${actor.id}`}
                        className="inline-flex items-center gap-2 rounded-full border border-app-border bg-app-panel px-4 py-3 text-sm font-semibold text-app-text"
                      >
                        Open Detail Page
                      </a>
                    </div>
                  </div>
                </div>

                <p className="text-sm leading-6 text-app-muted">
                  Generated portraits appear automatically when an `image_url`
                  exists in Supabase. If one is missing, ThreatDex falls back to
                  the dossier-style portrait instead of leaving an empty frame.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
