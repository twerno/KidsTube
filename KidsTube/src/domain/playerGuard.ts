/**
 * Navigation guard for the embedded player WebView.
 *
 * The YouTube embed renders "More videos", the channel/title links and the
 * YouTube wordmark. Clicking any of them would navigate the WebView to an
 * arbitrary video — bypassing the parent's whitelist entirely. We therefore
 * only ever allow the WebView to stay on the embed page of the *currently
 * whitelisted* video; every other navigation is blocked.
 *
 * Kept pure (no I/O) so it is unit-testable and can be reused on both the
 * `onShouldStartLoadWithRequest` path and future native-fullscreen paths.
 */

const ALLOWED_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'm.youtube.com',
  'www.youtube-nocookie.com',
  'youtube-nocookie.com',
]);

/**
 * Returns `true` when the WebView may navigate to `rawUrl` while playing
 * `videoId`. Anything that is not the exact `/embed/<videoId>` page on a
 * YouTube host is rejected.
 */
export function isAllowedPlayerUrl(rawUrl: string, videoId: string): boolean {
  if (!rawUrl) {
    return false;
  }
  // The player creates empty internal frames; those are harmless.
  if (rawUrl.startsWith('about:blank')) {
    return true;
  }

  const match = rawUrl.match(/^https:\/\/([^/?#]+)(\/[^?#]*)?/i);
  if (!match) {
    return false;
  }
  const host = match[1].toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) {
    return false;
  }

  const path = match[2] ?? '/';
  return path === `/embed/${videoId}`;
}
