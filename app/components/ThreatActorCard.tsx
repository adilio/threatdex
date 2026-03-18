import { useState } from "react"
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

  const isFlipped = flipped !== undefined ? flipped : internalFlipped

  function handleClick() {
    if (onFlip) {
      onFlip()
    } else {
      setInternalFlipped((prev) => !prev)
    }
  }

  return (
    <div
      className={`card-shell ${className ?? ""}`.trim()}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Threat actor card for ${actor.canonicalName}. Click to ${isFlipped ? "show front" : "show back"}.`}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          handleClick()
        }
      }}
      style={{
        perspective: "1600px",
        cursor: "pointer",
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
        outline: "none",
      }}
    >
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
          <CardFront actor={actor} />
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
          <CardBack actor={actor} />
        </div>
      </div>
    </div>
  )
}
