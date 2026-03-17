import { useState, useRef, useCallback } from "react";
import { Link } from "react-router";
import { Download, RotateCcw } from "lucide-react";
import type { ThreatActor } from "~/schema";
import { getRarityColor } from "~/schema";
import { CardFront } from "./CardFront";
import { CardBack } from "./CardBack";
import clsx from "clsx";

interface ActorCardProps {
  actor: ThreatActor;
  /** "default" renders a compact grid card; "large" renders the detail-page card */
  size?: "default" | "large";
  showDownload?: boolean;
}

export function ActorCard({
  actor,
  size = "default",
  showDownload = false,
}: ActorCardProps) {
  const [flipped, setFlipped] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const rarityColor = getRarityColor(actor.rarity);

  const handleFlip = useCallback(() => {
    setFlipped((prev) => !prev);
  }, []);

  const handleDownload = useCallback(async () => {
    if (!cardRef.current || downloading) return;

    setDownloading(true);
    try {
      // Dynamic import to avoid SSR issues
      const html2canvas = (await import("html2canvas")).default;

      // Temporarily un-flip if flipped so we capture the front
      const wasFlipped = flipped;
      if (wasFlipped) setFlipped(false);

      // Allow a frame for the DOM to update
      await new Promise((r) => requestAnimationFrame(r));

      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        logging: false,
        useCORS: true,
      });

      if (wasFlipped) setFlipped(true);

      const link = document.createElement("a");
      link.download = `threatdex-${actor.id}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      // Download failed silently
    } finally {
      setDownloading(false);
    }
  }, [actor.id, downloading, flipped]);

  const isLarge = size === "large";

  return (
    <div
      className={clsx(
        "flex flex-col items-center gap-3",
        isLarge ? "w-[280px]" : "w-fit",
      )}
    >
      {/* Card flip container */}
      <div
        className={clsx(
          "card-container cursor-pointer group select-none",
          isLarge ? "w-[280px] h-[392px]" : "w-[280px] h-[392px]",
        )}
        onClick={handleFlip}
        role="button"
        tabIndex={0}
        aria-label={`${actor.canonicalName} card — click to ${flipped ? "see front" : "see back"}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleFlip();
          }
        }}
      >
        <div
          ref={cardRef}
          className={clsx(
            "card-inner w-full h-full",
            flipped && "flipped",
          )}
          style={{
            filter: `drop-shadow(0 0 8px ${rarityColor}40)`,
          }}
        >
          {/* Front */}
          <div className="card-front">
            <CardFront actor={actor} />
          </div>

          {/* Back */}
          <div className="card-back">
            <CardBack actor={actor} />
          </div>
        </div>
      </div>

      {/* Card controls */}
      <div className="flex items-center gap-2">
        {/* View detail link */}
        <Link
          to={`/actors/${actor.id}`}
          className="px-3 py-1.5 bg-wiz-blue/20 hover:bg-wiz-blue/40 border border-wiz-blue/40 hover:border-wiz-blue text-wiz-blue text-xs font-semibold rounded-md transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          View Details
        </Link>

        {/* Flip button */}
        <button
          onClick={handleFlip}
          className="p-1.5 bg-blue-shadow/20 hover:bg-blue-shadow/40 border border-blue-shadow/40 hover:border-sky-blue text-sky-blue rounded-md transition-colors"
          aria-label={flipped ? "Show card front" : "Show card back"}
          title={flipped ? "Show front" : "Show back"}
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Download button */}
        {showDownload && (
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="p-1.5 bg-blue-shadow/20 hover:bg-blue-shadow/40 border border-blue-shadow/40 hover:border-sky-blue text-sky-blue rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Download card as PNG"
            title="Download as PNG"
          >
            <Download
              className={clsx("w-3.5 h-3.5", downloading && "animate-pulse")}
            />
          </button>
        )}
      </div>

      {/* Actor name label below card */}
      <div className="text-center">
        <p className="text-sm font-semibold text-cloudy-white truncate max-w-[280px]">
          {actor.canonicalName}
        </p>
        {actor.country && (
          <p className="text-xs font-mono text-sky-blue/60 mt-0.5" data-stat>
            {actor.country}
            {actor.countryCode && ` [${actor.countryCode}]`}
          </p>
        )}
      </div>
    </div>
  );
}
