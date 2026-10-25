import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { ChannelAvatar } from '../ChannelAvatar';
import { filmsLabel } from '../../domain/plural';
import type { ChannelBarEntry } from '../../domain/panel';

export type { ChannelBarEntry };

export interface ChannelBarProps {
  entries: ChannelBarEntry[];
  /** Selected channel key, or null for “no channel filter”. */
  selected: string | null;
  /** Tapping the selected icon again clears the filter (null). */
  onSelect: (key: string | null) => void;
}

/**
 * Shared horizontal channel bar (ADR 0005 / ADR 0016). The first entry is
 * “Wszystkie”; the last one may be “Kanał nieznany”; channels without a stored
 * record carry the “nieobserwowany” marker.
 */
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
              ) : entry.isUnknown ? (
                <View style={[styles.avatar, styles.unknownAvatar]}>
                  <Text style={styles.unknownGlyph}>?</Text>
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
            <Text style={styles.count}>
              {filmsLabel(entry.count)}
            </Text>
            {!entry.isAll && !entry.isUnknown && !entry.observed ? (
              <Text style={styles.unobserved}>nieobserwowany</Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const AVATAR = 48;

const styles = StyleSheet.create({
  bar: { gap: spacing.md, paddingVertical: spacing.xs },
  item: { alignItems: 'center', width: 88, gap: 1 },
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
  allAvatar: {
    backgroundColor: colors.cardAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  allGlyph: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  unknownAvatar: {
    backgroundColor: colors.cardAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.warning,
    borderRadius: radius.md,
  },
  unknownGlyph: { color: colors.warning, fontSize: 20, fontWeight: '800' },
  label: { color: colors.textMuted, fontSize: 11, textAlign: 'center' },
  labelActive: { color: colors.text, fontWeight: '700' },
  count: { color: colors.textMuted, fontSize: 10, textAlign: 'center' },
  unobserved: { color: colors.warning, fontSize: 9, textAlign: 'center' },
});
