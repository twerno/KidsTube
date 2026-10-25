import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { colors, radius, spacing } from '../theme';

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export interface SeekBarProps {
  position: number;
  duration: number;
  onSeek: (seconds: number) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
}

export function SeekBar({ position, duration, onSeek, onScrubStart, onScrubEnd }: SeekBarProps) {
  const [width, setWidth] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  // Last known finger x in bar-local pixels. On a plain tap the release event
  // may not carry a meaningful x; without this, tap-to-seek used to jump to 0.
  const lastXRef = useRef(0);
  const barRef = useRef<React.ComponentRef<typeof View>>(null);
  // Absolute page x of the bar's left edge. `locationX` is relative to the
  // *current touch target*, which changes as the finger leaves the bar and made
  // the value jump; `pageX` is absolute, so measuring the bar once keeps
  // scrubbing stable no matter where the finger is.
  const barXRef = useRef(0);
  const barWidthRef = useRef(0);

  const measureBar = () => {
    barRef.current?.measureInWindow((x, _y, w) => {
      barXRef.current = x;
      if (w > 0) {
        barWidthRef.current = w;
      }
    });
  };

  const onLayout = (event: LayoutChangeEvent) => {
    const w = event.nativeEvent.layout.width;
    setWidth(w);
    barWidthRef.current = w;
    measureBar();
  };

  const localX = (event: GestureResponderEvent) => {
    const w = barWidthRef.current || width;
    if (w <= 0) {
      return 0;
    }
    return Math.min(w, Math.max(0, event.nativeEvent.pageX - barXRef.current));
  };
  const ratioFromX = (x: number) => {
    const w = barWidthRef.current || width;
    return w > 0 ? Math.min(1, Math.max(0, x / w)) : 0;
  };
  const seekFromX = (x: number) => {
    if (duration > 0) {
      onSeek(ratioFromX(x) * duration);
    }
  };
  const shown = scrub ?? position;
  const ratio = duration > 0 ? Math.min(1, Math.max(0, shown / duration)) : 0;

  const grant = (event: GestureResponderEvent) => {
    measureBar();
    lastXRef.current = localX(event);
    onScrubStart?.();
    setScrub(ratioFromX(lastXRef.current) * duration);
  };
  const move = (event: GestureResponderEvent) => {
    lastXRef.current = localX(event);
    setScrub(ratioFromX(lastXRef.current) * duration);
  };
  // Seek only on release (never while dragging); see the comment on lastXRef.
  const release = () => {
    seekFromX(lastXRef.current);
    setScrub(null);
    onScrubEnd?.();
  };
  const terminate = () => {
    setScrub(null);
    onScrubEnd?.();
  };

  const labelWidth = 56;
  const labelLeft =
    width > 0
      ? Math.min(Math.max(ratio * width - labelWidth / 2, 0), Math.max(width - labelWidth, 0))
      : 0;

  return (
    <View>
      <View
        ref={barRef}
        style={styles.seekHit}
        onLayout={onLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        // Never give the gesture up mid-drag: otherwise a sibling/parent can
        // steal it, which resets `scrub` and makes the bar + label flicker.
        onResponderTerminationRequest={() => false}
        onResponderGrant={grant}
        onResponderMove={move}
        onResponderRelease={release}
        onResponderTerminate={terminate}
      >
        <View style={styles.seekTrack}>
          <View style={[styles.seekFill, { width: `${ratio * 100}%` }]} />
          <View style={[styles.seekKnob, { left: `${ratio * 100}%` }]} />
        </View>
      </View>
      <View style={styles.times}>
        <Text style={styles.time}>{formatTime(position)}</Text>
        <Text style={styles.time}>{formatTime(duration)}</Text>
        {scrub !== null && width > 0 ? (
          <View
            pointerEvents="none"
            style={[styles.scrubTime, { left: labelLeft, width: labelWidth }]}
          >
            <Text style={styles.scrubTimeText}>{formatTime(shown)}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  seekHit: { paddingVertical: spacing.sm, justifyContent: 'center' },
  seekTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
  },
  seekFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  seekKnob: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
    backgroundColor: colors.text,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  time: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  // Target-time chip: sits on the same line as the start/end times and covers
  // them (opaque background, rendered last) whenever they would collide.
  scrubTime: {
    position: 'absolute',
    top: -1,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingVertical: 2,
  },
  scrubTimeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});