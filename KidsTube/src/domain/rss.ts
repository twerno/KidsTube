/**
 * Minimal parser for YouTube's per-channel Atom feed:
 *   https://www.youtube.com/feeds/videos.xml?channel_id=UC...
 *
 * The feed exposes roughly the 15 most recent uploads, which is exactly what
 * we sync for watched channels. We parse it by hand to avoid an XML dependency
 * and because the structure is stable.
 */

export interface RssVideo {
  videoId: string;
  channelId?: string;
  channelTitle?: string;
  title: string;
  publishedAt?: number;
  thumbnailUrl?: string;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity in ENTITIES) {
      return ENTITIES[entity];
    }
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith('#')) {
      const code = parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return match;
  });
}

function stripCdata(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return match ? match[1] : trimmed;
}

/** Return the text content of the first matching tag inside `block`. */
function firstTag(block: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = block.match(re);
  return match ? decodeEntities(stripCdata(match[1])) : undefined;
}

/** Return an attribute of the first matching (self-closing) tag. */
function firstAttr(block: string, tag: string, attr: string): string | undefined {
  const re = new RegExp(`<${tag}\\b[^>]*\\b${attr}="([^"]*)"`, 'i');
  const match = block.match(re);
  return match ? decodeEntities(match[1]) : undefined;
}

function parseDate(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
}

/** The channel id the feed belongs to. */
export function parseFeedChannelId(xml: string): string | undefined {
  const match = xml.match(/<yt:channelId>([^<]+)<\/yt:channelId>/i);
  return match ? decodeEntities(match[1].trim()) : undefined;
}

/**
 * Parse all `<entry>` items. Entries without a usable video id are skipped.
 * Duplicate ids are collapsed, keeping the first occurrence.
 */
export function parseYouTubeFeed(xml: string): RssVideo[] {
  if (!xml) {
    return [];
  }
  const entries = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  const seen = new Set<string>();
  const result: RssVideo[] = [];

  for (const entry of entries) {
    const videoId = firstTag(entry, 'yt:videoId');
    if (!videoId || seen.has(videoId)) {
      continue;
    }
    seen.add(videoId);

    const mediaGroup = entry.match(/<media:group\b[\s\S]*?<\/media:group>/i)?.[0] ?? entry;
    const title =
      firstTag(mediaGroup, 'media:title') ??
      firstTag(entry, 'title') ??
      '(bez tytułu)';

    result.push({
      videoId,
      channelId: firstTag(entry, 'yt:channelId'),
      channelTitle: firstTag(entry, 'name'),
      title,
      publishedAt: parseDate(firstTag(entry, 'published') ?? firstTag(entry, 'updated')),
      thumbnailUrl: firstAttr(mediaGroup, 'media:thumbnail', 'url'),
    });
  }

  return result;
}
