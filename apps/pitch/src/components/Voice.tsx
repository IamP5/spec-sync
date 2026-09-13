import type { Caption } from "@remotion/captions";
import { Audio } from "@remotion/media";
import { Sequence, staticFile, useCurrentFrame } from "remotion";
import voiceData from "../data/voice.json";
import { fontFamily } from "../font";

export const Voice: React.FC<{ index: number }> = ({ index }) => {
  const voice = voiceData[index];
  const frame = useCurrentFrame();
  const ms = (frame / 30 - voice.offset) * 1000;
  const caption: Caption | undefined = voice.captions.find(
    (c) => ms >= c.startMs && ms < c.endMs,
  );
  return (
    <>
      <Sequence
        from={Math.round(voice.offset * 30)}
        layout="none"
        name="Locução em português"
      >
        <Audio src={staticFile(voice.file)} volume={1} />
      </Sequence>
      {caption && (
        <div
          style={{
            position: "absolute",
            bottom: 30,
            left: 90,
            right: 90,
            display: "flex",
            justifyContent: "center",
            fontFamily,
          }}
        >
          <div
            style={{
              fontSize: 34,
              lineHeight: 1.3,
              textAlign: "center",
              color: "#fff",
              fontWeight: 480,
              padding: "12px 25px",
              background: "#050914df",
              textShadow: "0 2px 8px #000",

              borderRadius: 6,
              maxWidth: 1740,
            }}
          >
            {caption.text}
          </div>
        </div>
      )}
    </>
  );
};
