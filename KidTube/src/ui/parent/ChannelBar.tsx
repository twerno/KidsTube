import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

export interface ChannelBarEntry {
  /** Stable key used for filtering (the channel title, or `__all__`). */
  key: string;
  title: string;
  thumbnailUrl?: string;
  /** Number of films in this channel (its “category” size). */
  count: number;
  /** The “Wszystkie” entry that clears the filter. */
  isAll?: boolean;
}

export interface ChannelBarProps {
  entries: ChannelBarEntry[];
  /** Selected channel key, or null for “no channel filter”. */
  selected: string | null;
  /** Tapping the selected icon again clears the filter (null). */
  onSelect: (key: string | null) => void;
}

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

function filmsLabel(count: number): string {
  if (count === 1) {
    return '1 film';
  }
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} filmy`;
  }
  return `${count} filmów`;
}

export function ChannelBar({ entries, selected, onSelect }: ChannelBarProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.bar}
    >
      {entries.map(entry => {
        const active = entry.isAll ? selected === null : selected === entry.key;
        return (
          <Pressable
            key={entry.key}
            onPress={() => onSelect(entry.isAll ? null : active ? null : entry.key)}
            style={styles.item}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${entry.title}, ${filmsLabel(entry.count)}`}
          >
            <View style={[styles.avatarRing, active && styles.avatarRingActive]}>
              {entry.isAll ? (
                <View style={[styles.avatar, styles.allAvatar]}>
                  <Text style={styles.allGlyph}>▦</Text>
                </View>
              ) : entry.thumbnailUrl ? (
                <Image source={{ uri: entry.thumbnailUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colorFor(entry.title) }]}>
                  <Text style={styles.initial}>{entry.title.slice(0, 1).toUpperCase()}</Text>
                </View>
              )}
            </View>
            <Text numberOfLines={1} style={[styles.label, active && styles.labelActive]}>
              {entry.title}
            </Text>
            <Text style={styles.count}>{filmsLabel(entry.count)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const AVATAR = 48;

const styles = StyleSheet.create({
  bar: { gap: spacing.md, paddingVertical: spacing.xs },
  item: { alignItems: 'center', width: 76, gap: 1 },
  avatarRing: {
    width: AVATAR + 6,
    height: AVATAR + 6,
    borderRadius: (AVATAR + 6) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarRingActive: { borderColor: colors.primary },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardAlt,
  },
  initial: { color: colors.black, fontSize: 20, fontWeight: '800' },
  allAvatar: { backgroundColor: colors.cardAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  allGlyph: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  label: { color: colors.textMuted, fontSize: 11, textAlign: 'center' },
  labelActive: { color: colors.text, fontWeight: '700' },
  count: { color: colors.textMuted, fontSize: 10, textAlign: 'center' },
});