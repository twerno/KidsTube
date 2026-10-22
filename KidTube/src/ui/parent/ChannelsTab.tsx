import React, { useState } from 'react';
import { FlatList, StyleSheet, Switch, Text, View } from 'react-native';
import { Button, Card, Field } from '../components';
import { colors, spacing } from '../theme';
import type { Channel } from '../../domain/types';

export function ChannelsTab({
  channels,
  refreshing,
  onAddChannelLink,
  onToggleChannelPolicy,
  onBlockChannel,
  onRemoveChannel,
  onSync,
}: {
  channels: Channel[];
  refreshing?: boolean;
  onAddChannelLink: (link: string, autoApprove: boolean) => Promise<string | undefined>;
  onToggleChannelPolicy: (channel: Channel) => void;
  onBlockChannel: (channel: Channel) => void;
  onRemoveChannel: (channel: Channel) => void;
  onSync: () => void;
}) {
  const [link, setLink] = useState('');
  const [autoApprove, setAutoApprove] = useState(false);
  const [addError, setAddError] = useState<string | undefined>();
  const [adding, setAdding] = useState(false);

  const addChannel = async () => {
    setAddError(undefined);
    if (!link.trim()) {
      return;
    }
    setAdding(true);
    const error = await onAddChannelLink(link.trim(), autoApprove);
    setAdding(false);
    if (error) {
      setAddError(error);
    } else {
      setLink('');
    }
  };

  return (
    <FlatList
      data={channels}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View style={styles.header}>
          <Card style={styles.addCard}>
            <Field
              label="Link do kanału (channel/UC…, @handle lub link do filmu)"
              value={link}
              onChangeText={setLink}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="https://www.youtube.com/@…"
            />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Automatyczna akceptacja nowych filmów</Text>
              <Switch value={autoApprove} onValueChange={setAutoApprove} />
            </View>
            {addError ? <Text style={styles.error}>{addError}</Text> : null}
            <Button title="Dodaj i zsynchronizuj" onPress={addChannel} loading={adding} />
          </Card>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Kanały ({channels.length})</Text>
            <Button title="Synchronizuj" variant="secondary" onPress={onSync} loading={refreshing} />
          </View>
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>Nie obserwujesz jeszcze żadnego kanału.</Text>}
      renderItem={({ item }) => (
        <Card style={styles.channelCard}>
          <View style={styles.channelHeader}>
            <Text numberOfLines={1} style={styles.channelTitle}>
              {item.title}
            </Text>
            {item.status === 'blocked' ? <Text style={styles.blockedBadge}>zablokowany</Text> : null}
          </View>
          <Text numberOfLines={1} style={styles.channelId}>
            {item.handle ? `@${item.handle}` : item.id}
          </Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Auto-akceptacja nowych filmów</Text>
            <Switch
              value={item.policy === 'auto_approve'}
              onValueChange={() => onToggleChannelPolicy(item)}
              disabled={item.status === 'blocked'}
            />
          </View>
          <View style={styles.actions}>
            <Button
              title={item.status === 'blocked' ? 'Odblokuj' : 'Zablokuj'}
              variant="secondary"
              onPress={() => onBlockChannel(item)}
            />
            <Button title="Usuń" variant="ghost" onPress={() => onRemoveChannel(item)} />
          </View>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  header: { gap: spacing.md },
  addCard: { gap: spacing.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  switchLabel: { color: colors.text, flex: 1, fontSize: 14 },
  error: { color: colors.danger, fontSize: 14 },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  listTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  empty: { color: colors.textMuted, marginTop: spacing.lg, fontSize: 14 },
  channelCard: { gap: spacing.sm, marginTop: spacing.sm },
  channelHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  channelTitle: { color: colors.text, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  channelId: { color: colors.textMuted, fontSize: 12 },
  blockedBadge: { color: colors.danger, fontSize: 11, fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, flexWrap: 'wrap' },
});
