import React, { useEffect, useState } from "react"
import type { ThreatActor } from "~/schema"
import { CardFront } from "./CardFront"
import { CardBack } from "./CardBack"

interface ThreatActorCardProps {
  actor: ThreatActor
  /** Controlled flip state. When provided the component behaves as controlled. */
  flipped?: boolean
  /** Called when the user clicks the card to flip it. */
  onFlip?: () => void
  className?: string
}

/**
 * ThreatActorCard — wraps CardFront and CardBack with a CSS 3D flip animation.
 *
 * Usage (uncontrolled):
 *   <ThreatActorCard actor={apt28} />
 *
 * Usage (controlled):
 *   <ThreatActorCard actor={apt28} flipped={isFlipped} onFlip={() => setIsFlipped(f => !f)} />
 */
export function ThreatActorCard({
  actor,
  flipped,
  onFlip,
  className,
}: ThreatActorCardProps) {
  const [internalFlipped, setInternalFlipped] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // If `flipped` prop is provided, use controlled mode; otherwise use internal state.
  const isFlipped = flipped !== undefined ? flipped : internalFlipped
  const usesControlledFlip = flipped !== undefined || onFlip !== undefined

  useEffect(() => {
    if (!expanded) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setExpanded(false)
    }

    document.addEventListener("keydown", handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [expanded])

  function handleClick() {
    if (onFlip) {
      onFlip()
    } else if (usesControlledFlip) {
      setInternalFlipped((prev) => !prev)
    } else {
      setExpanded(true)
    }
  }

  return (
    <>
      <div
        className={className}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label={`Threat actor card for ${actor.canonicalName}. Click to ${usesControlledFlip && isFlipped ? "show front" : "expand intelligence"}.`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            handleClick()
          }
        }}
        style={{
          // The outer container defines the perspective for the 3D effect.
          width: "280px",
          height: "392px",
          perspective: "1200px",
          cursor: "pointer",
          userSelect: "none",
          WebkitTapHighlightColor: "transparent",
          outline: "none",
        }}
      >
        {/*
         * Inner container is the element that actually rotates.
         * Both faces are absolutely positioned inside it.
         */}
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
          {/* Front face */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
          >
            <CardFront actor={actor} />
          </div>

          {/* Back face — pre-rotated 180 deg so it shows when the container flips */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <CardBack actor={actor} />
          </div>
        </div>
      </div>

      {expanded && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${actor.canonicalName} threat intelligence`}
          onClick={() => setExpanded(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "5vh 5vw",
            background: "rgba(1,18,63,0.82)",
            backdropFilter: "blur(8px)",
            perspective: "1600px",
          }}
        >
          <div
            onClick={(event) => {
              if (event.target instanceof HTMLElement && event.target.closest("a")) return
              setExpanded(false)
            }}
            style={{
              position: "relative",
              transformStyle: "preserve-3d",
              animation: "threatdex-expanded-flip 0.55s cubic-bezier(0.4, 0.2, 0.2, 1) both",
              cursor: "pointer",
            }}
          >
            <CardBack actor={actor} expanded />
          </div>
        </div>
      )}
    </>
  )
}
