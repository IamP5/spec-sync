import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Mask,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { useCSSVariable } from 'uniwind';

import { THEME } from '../../../../design-system/theme';

/** Ford action blue; brand blues do not change with the theme. */
const PRIMARY = THEME.dark.primary;
const SWAY_MS = 18_000;

/**
 * The home screen's backdrop (web `HomeBackdrop`): a dot grid fading out from
 * the top, a slow light beam, a blue wash and a hairline under the header.
 * Decorative only.
 */
export function HomeBackdrop() {
  const foreground = useCSSVariable('--color-foreground');
  const color = typeof foreground === 'string' ? foreground : '#f0f0f0';
  const reduceMotion = useReducedMotion();
  const sway = useSharedValue(-1);

  useEffect(() => {
    if (reduceMotion) return;
    sway.set(
      withRepeat(
        withTiming(1, { duration: SWAY_MS, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
  }, [reduceMotion, sway]);

  const beam = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sway.get() * 10}deg` }],
  }));

  return (
    <View
      pointerEvents="none"
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
      className="overflow-hidden"
    >
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern
            id="dots"
            width={24}
            height={24}
            patternUnits="userSpaceOnUse"
          >
            <Circle cx={1} cy={1} r={1} fill={color} fillOpacity={0.22} />
          </Pattern>
          <RadialGradient id="fade" cx="50%" cy="30%" rx="85%" ry="75%">
            <Stop offset="0" stopColor="#fff" stopOpacity={1} />
            <Stop offset="0.85" stopColor="#fff" stopOpacity={0} />
          </RadialGradient>
          <Mask id="grid-mask">
            <Rect width="100%" height="100%" fill="url(#fade)" />
          </Mask>
          <RadialGradient id="wash" cx="50%" cy="0%" rx="65%" ry="45%">
            <Stop offset="0" stopColor={PRIMARY} stopOpacity={0.09} />
            <Stop offset="0.8" stopColor={PRIMARY} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="hairline" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={PRIMARY} stopOpacity={0} />
            <Stop offset="0.5" stopColor={PRIMARY} stopOpacity={0.6} />
            <Stop offset="1" stopColor={PRIMARY} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect
          width="100%"
          height="100%"
          fill="url(#dots)"
          mask="url(#grid-mask)"
          opacity={0.65}
        />
        <Rect width="100%" height="100%" fill="url(#wash)" />
        <Rect width="100%" height={1} fill="url(#hairline)" />
      </Svg>
      {/* The beam swings from its top edge, like the web's conic light. */}
      <Animated.View
        style={[{ transformOrigin: 'top' }, beam]}
        className="absolute -top-1/2 left-0 h-full w-full"
      >
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="beam" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor={PRIMARY} stopOpacity={0.16} />
              <Stop offset="0.5" stopColor={color} stopOpacity={0.03} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx="50%" cy="50%" rx="30%" ry="50%" fill="url(#beam)" />
        </Svg>
      </Animated.View>
    </View>
  );
}
