import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';

/** Height of the fade above the solid part. */
const FADE = 80;

/**
 * Messages scroll behind the floating composer and fade out just above it
 * (web `.chat-transcript` mask): a gradient into the page background, then
 * the background itself down to the bottom edge.
 */
export function TranscriptFade({ solidHeight }: { solidHeight: number }) {
  const background = useCSSVariable('--color-background');
  const color = typeof background === 'string' ? background : '#0f0f0f';
  const solid = Math.max(0, solidHeight);
  return (
    <View
      pointerEvents="none"
      aria-hidden
      className="absolute inset-x-0 bottom-0"
      style={{ height: solid + FADE }}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="transcript-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0} />
            <Stop
              offset={FADE / (solid + FADE)}
              stopColor={color}
              stopOpacity={1}
            />
            <Stop offset="1" stopColor={color} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#transcript-fade)" />
      </Svg>
    </View>
  );
}
