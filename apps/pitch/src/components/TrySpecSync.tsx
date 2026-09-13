import type { CSSProperties } from "react";
import { CanvasImage, staticFile } from "remotion";
import { fontFamily } from "../font";

export const SPEC_SYNC_TRY_URL = "https://specsync.tubadev.com/";
export const SPEC_SYNC_QR_TOTAL_MODULES = 37;

type QRPosition = Pick<CSSProperties, "left" | "right" | "top" | "bottom">;

export type TrySpecSyncProps = {
  variant?: "demo" | "closing";
  /** Replaces the default anchors; specify one horizontal and one vertical edge. */
  position?: QRPosition;
};

// Keep this overlay outside the demo's moving camera or panel containers.
// The 29-module code plus a four-module quiet zone uses exactly 4 or 7 pixels
// per module. Its scale and position remain fixed while viewers scan it.
export const TrySpecSync: React.FC<TrySpecSyncProps> = ({
  variant = "demo",
  position,
}) => {
  const closing = variant === "closing";
  const size = SPEC_SYNC_QR_TOTAL_MODULES * (closing ? 7 : 4);
  const anchors =
    position ?? (closing ? { right: 74, top: 650 } : { right: 48, bottom: 48 });

  return (
    <div
      aria-label={`Experimente o SpecSync em ${SPEC_SYNC_TRY_URL}`}
      style={{
        position: "absolute",
        ...anchors,
        width: size,
        color: "#FFFFFF",
        fontFamily,
        textAlign: "center",
        zIndex: 20,
        pointerEvents: "none",
      }}
    >
      <CanvasImage
        name="Scan to try SpecSync"
        src={staticFile("brand/specsync-qr.svg")}
        width={size}
        height={size}
        style={{
          display: "block",
          width: size,
          height: size,
          imageRendering: "pixelated",
        }}
      />
      <div
        style={{
          position: closing ? "absolute" : undefined,
          left: closing ? -283 : undefined,
          top: closing ? 188 : undefined,
          width: closing ? 259 : undefined,
          textAlign: closing ? "right" : "center",
          marginTop: closing ? 0 : 8,
          fontSize: closing ? 26 : 20,
          lineHeight: closing ? "32px" : "24px",
          fontWeight: 600,
          letterSpacing: -0.5,
          whiteSpace: "nowrap",
          textShadow: "0 2px 9px #050914",
        }}
      >
        {closing ? (
          <>
            Experimente o<br />
            SpecSync
          </>
        ) : (
          "Teste agora"
        )}
      </div>
      {closing ? (
        <div
          style={{
            marginTop: 12,
            fontSize: 24,
            lineHeight: "29px",
            fontWeight: 450,
            letterSpacing: -0.7,
            color: "#A7CDFF",
            whiteSpace: "nowrap",
            textShadow: "0 2px 9px #050914",
          }}
        >
          specsync.tubadev.com
        </div>
      ) : null}
    </div>
  );
};
