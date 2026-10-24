/** Parent-panel labels (ADR 0016). UI strings stay in the UI layer. */

import type { VideoSource, VideoStatus } from '../../domain/types';

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
