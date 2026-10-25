import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from './theme';

// Placeholder avatar colours; picked deterministically from the title so a
// channel keeps the same circle until real avatars are available.
const PLACEHOLDER_COLORS = ['#3ea6ff', '#35c759', '#ff9f0a', '#bf5af2', '#ff375f', '#5e5ce6'];

function colorFor(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) {
    hash = (hash * 31 + title.charCodeAt(i)) % 1_000_000_007;
  }
  return PLACEHOLDER_COLORS[hash % PLACEHOLDER_COLORS.length];
}

export function ChannelAvatar({
  title,
  thumbnailUrl,
  size = 48,
  style,
}: {
  title: string;
  thumbnailUrl?: string;
  size?: number;
  style?: any;
}) {
  const shape = { width: size, height: size, borderRadius: size / 2 };
  if (thumbnailUrl) {
    return <Image source={{ uri: thumbnailUrl }} style={[shape, style]} />;
  }
  return (
    <View style={[shape, styles.placeholder, { backgroundColor: colorFor(title) }, style]}>
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>
        {title.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.black, fontWeight: '800' },
});
