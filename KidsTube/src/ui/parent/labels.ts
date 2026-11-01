/** Parent-panel labels (ADR 0016). UI strings stay in the UI layer. */

import type { ChannelPolicy, VideoSource, VideoStatus } from '../../domain/types';

export const SOURCE_LABEL: Record<VideoSource, string> = {
  rss: 'z kanału',
  propose: 'od dziecka',
  share: 'z linku',
  manual: 'z linku',
};

export const STATUS_LABEL: Record<VideoStatus, string> = {
  allowed: 'Dozwolony',
  pending: 'Oczekuje',
  blocked: 'Zablokowany',
};

/** “New films” policy labels (ADR 0019). */
export const CHANNEL_POLICY_LABEL: Record<ChannelPolicy, string> = {
  auto_approve: 'Automatyczna akceptacja',
  manual: 'Ręczna akceptacja',
  auto_block: 'Automatyczna blokada',
  quiet: 'Wyciszenie (tylko cache)',
};

export const CHANNEL_POLICY_OPTIONS: ChannelPolicy[] = [
  'auto_approve',
  'manual',
  'auto_block',
  'quiet',
];
