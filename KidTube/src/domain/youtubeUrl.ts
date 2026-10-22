/**
 * Parsing of the many YouTube link shapes a parent or child may hand us.
 *
 * No scraping, no API: we only extract ids from URLs the user already has.
 *
 * NOTE: we deliberately do NOT use the global `URL`/`URLSearchParams`. React
 * Native ships an incomplete polyfill whose `pathname`/`hostname` differ from
 * Node, which broke channel links on device. Plain regex parsing is predictable.
 */

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;
const BARE_HANDLE_RE = /^@?([A-Za-z0-9_.-]{3,30})$/;

export type ParsedYouTubeLink =
  | { kind: 'video'; videoId: string; raw: string }
  | {
      kind: 'channel';
      channelId?: string;
      handle?: string;
      slug?: string;
      raw: string;
    }
  | { kind: 'unknown'; raw: string };

function stripWww(host: string): string {
  return host.replace(/^www\./i, '').toLowerCase();
}

function isYouTubeHost(host: string): boolean {
  const h = stripWww(host);
  return (
    h === 'youtube.com' ||
    h === 'm.youtube.com' ||
    h === 'music.youtube.com' ||
    h === 'youtu.be' ||
    h === 'youtube-nocookie.com'
  );
}

function isVideoId(value: string | undefined): value is string {
  return !!value && VIDEO_ID_RE.test(value);
}

/** Read a query parameter without URLSearchParams. */
function queryParam(query: string, key: string): string | undefined {
  const match = query.match(new RegExp(`(?:^|&)${key}=([^&]*)`, 'i'));
  if (!match) {
    return undefined;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * Parse any supported link. Bare 11-char strings are treated as video ids;
 * bare words are treated as channel handles.
 */
export function parseYouTubeLink(input: string): ParsedYouTubeLink {
  const raw = input.trim();
  if (!raw) {
    return { kind: 'unknown', raw };
  }

  // A naked video id.
  if (VIDEO_ID_RE.test(raw)) {
    return { kind: 'video', videoId: raw, raw };
  }

  // A naked channel id.
  if (CHANNEL_ID_RE.test(raw)) {
    return { kind: 'channel', channelId: raw, raw };
  }

  // Custom Android scheme: vnd.youtube:VIDEOID
  const custom = raw.match(/^vnd\.youtube:(?:\/\/)?(.+)$/i);
  if (custom) {
    const value = custom[1].replace(/^\/+/, '');
    if (isVideoId(value)) {
      return { kind: 'video', videoId: value, raw };
    }
    if (CHANNEL_ID_RE.test(value)) {
      return { kind: 'channel', channelId: value, raw };
    }
  }

  // Bare "@handle" or "handle" (no dots => not a hostname).
  if (!raw.includes('.')) {
    const bare = raw.match(BARE_HANDLE_RE);
    if (bare) {
      return { kind: 'channel', handle: bare[1], raw };
    }
  }

  // Split scheme://host/path?query without URL.
  const parts = raw.match(/^(?:[a-z][a-z0-9+.-]*:\/\/)?([^/?#:]+)(?::\d+)?([^?#]*)(?:\?([^#]*))?/i);
  if (!parts) {
    return { kind: 'unknown', raw };
  }
  const host = parts[1];
  const path = parts[2] ?? '';
  const query = parts[3] ?? '';

  if (!isYouTubeHost(host)) {
    return { kind: 'unknown', raw };
  }

  const segments = path.split('/').filter(Boolean);
  const [first, second] = segments;
  const normalizedHost = stripWww(host);

  // youtu.be/<id>
  if (normalizedHost === 'youtu.be') {
    return isVideoId(first) ? { kind: 'video', videoId: first, raw } : { kind: 'unknown', raw };
  }

  // /watch?v=<id>
  if (first === 'watch') {
    const id = queryParam(query, 'v');
    if (isVideoId(id)) {
      return { kind: 'video', videoId: id, raw };
    }
  }

  // /embed/<id>, /shorts/<id>, /live/<id>, /v/<id>
  if (first && ['embed', 'shorts', 'live', 'v'].includes(first) && isVideoId(second)) {
    return { kind: 'video', videoId: second, raw };
  }

  // /channel/UC...
  if (first === 'channel' && second && CHANNEL_ID_RE.test(second)) {
    return { kind: 'channel', channelId: second, raw };
  }

  // /@handle
  if (first && first.startsWith('@')) {
    const handle = first.slice(1);
    if (handle) {
      return { kind: 'channel', handle, raw };
    }
  }

  // /c/<slug>, /user/<slug>
  if (first && ['c', 'user'].includes(first) && second) {
    return { kind: 'channel', slug: second, raw };
  }

  // A channel id anywhere in the query (rare).
  const qChannel = queryParam(query, 'channel_id');
  if (qChannel && CHANNEL_ID_RE.test(qChannel)) {
    return { kind: 'channel', channelId: qChannel, raw };
  }

  return { kind: 'unknown', raw };
}

/** Build a canonical watch URL for a video id. */
export function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** Build the RSS feed URL for a channel id. */
export function channelFeedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
}

/**
 * Pull the first YouTube link out of arbitrary shared text such as
 * `"Look at this https://youtu.be/xyz?si=abc bye"`.
 */
export function extractYouTubeUrl(text: string): string | undefined {
  const candidates = text.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
  for (const candidate of candidates) {
    const cleaned = candidate.replace(/[)\]}.,;!?]+$/, '');
    if (parseYouTubeLink(cleaned).kind !== 'unknown') {
      return cleaned;
    }
  }
  return undefined;
}
