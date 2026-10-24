import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import { ChannelAvatar } from '../ChannelAvatar';
import { filmsLabel } from '../../domain/plural';

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

// Placeholder avatars are shared with the child's channel list; see ChannelAvatar.

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
              ) : (
                <ChannelAvatar
                  title={entry.title}
                  thumbnailUrl={entry.thumbnailUrl}
                  size={AVATAR}
                />
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
  allAvatar: { backgroundColor: colors.cardAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  allGlyph: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  label: { color: colors.textMuted, fontSize: 11, textAlign: 'center' },
  labelActive: { color: colors.text, fontWeight: '700' },
  count: { color: colors.textMuted, fontSize: 10, textAlign: 'center' },
});