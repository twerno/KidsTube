/**
 * Ad-free, whitelist-locked playback through YouTube's embedded player.
 *
 * The WebView is NOT interactive (`pointerEvents="none"`); all user input goes
 * to our own native controls (see `player/PlayerControls`). RN drives the
 * player through `injectJavaScript` and receives state back via `postMessage`.
 *
 * Safety layers:
 *  1. `controls=0` — YouTube renders no player controls.
 *  2. Injected JS hides the remaining chrome (mobile `ytm*` / desktop `ytp*`).
 *  3. `onShouldStartLoadWithRequest` — the WebView may only stay on the embed
 *     page of the whitelisted video.
 *  4. `ended` is reported so RN can cover the end-screen "More videos" wall.
 */

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { isAllowedPlayerUrl } from '../domain/playerGuard';
import { colors } from './theme';

export interface AudioTrackInfo {
  index: number;
  label: string;
  languageCode?: string;
  isOriginal?: boolean;
}

export interface PlayerState {
  playing: boolean;
  position: number;
  duration: number;
  /** YT.PlayerState value: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued. */
  playerState: number;
  buffering: boolean;
  captionsOn: boolean;
  audioTracks: AudioTrackInfo[];
  audioIndex: number;
}

export interface PlayerHandle {
  play(): void;
  pause(): void;
  togglePlay(): void;
  seekTo(seconds: number): void;
  toggleCaptions(): void;
  setAudioTrack(index: number): void;
}

export interface EmbedPlayerProps {
  videoId: string;
  autoPlay?: boolean;
  /** Start playback at this offset in seconds (ADR 0004: wznowienie). */
  startSeconds?: number;
  /** Fired once playback started and YouTube's startup UI has been dismissed. */
  onReady?: () => void;
  onEnded?: () => void;
  /** Fired on a WebView network/HTTP failure so the UI can offer an explicit retry. */
  onError?: (info?: string) => void;
  onState?: (state: PlayerState) => void;
}

const APP_ORIGIN = 'https://com.kidtube';
const CHROME_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

function buildEmbedUrl(videoId: string, autoPlay: boolean, startSeconds = 0): string {
  const params = ['playsinline=1', 'rel=0', 'iv_load_policy=3', 'disablekb=1', 'controls=0'];
  if (autoPlay) {
    params.push('autoplay=1');
  }
  // Native start offset — the embed seeks before playback, so a resumed video
  // does not visibly begin at 0 and then jump (ADR 0004).
  const start = Math.floor(startSeconds);
  if (start > 0) {
    params.push(`start=${start}`);
  }
  return `https://www.youtube.com/embed/${videoId}?${params.join('&')}`;
}

/**
 * Injected into the player page.
 *  - hides YouTube chrome (mobile `ytm*` and desktop `ytp*` classes);
 *  - exposes `window.__kt` command helpers backed by the internal
 *    `movie_player` API (play/pause/seek/captions/audio tracks);
 *  - posts `ready`, `ended` and periodic `state` messages to RN.
 */
const PLAYER_JSA = `
(function () {
  var HIDE_SEL = '.ytp-chrome-top,.ytp-chrome-bottom,.ytp-gradient-top,' +
    '.ytp-gradient-bottom,.ytp-endscreen-content,' +
    '.ytp-pause-overlay,.ytp-ce-element,.ytp-share-button,.ytp-watch-later-button,' +
    '.ytp-suggested-action,[class*="ytmVideoInfo"],[class*="ytmSlimVideoMetadata"],' +
    '[class*="ytmRelatedVideo"],[class*="ytmCompactVideo"],[class*="ytmVideoDescription"],' +
    '[class*="ytmFullscreenRelatedVideos"],[class*="RelatedVideos"]';
  // NOTE: we intentionally do NOT hide the YouTube wordmark/logo — it keeps
  // the embed compliant with YouTube's attribution requirements.

  function post(obj) {
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(obj));
  }

  function hideChrome() {
    var els = document.querySelectorAll(HIDE_SEL);
    for (var i = 0; i < els.length; i++) { els[i].style.display = 'none'; }
  }

  function player() { return document.getElementById('movie_player'); }
  function video() { return document.querySelector('video'); }

  function textOf(obj) {
    if (!obj) { return ''; }
    if (typeof obj === 'string') { return obj; }
    if (obj.simpleText) { return obj.simpleText; }
    if (obj.runs && obj.runs.length) {
      return obj.runs.map(function (r) { return r.text || ''; }).join('');
    }
    return '';
  }

  function trackLabel(t, i) {
    var cand = t && (t.displayName || t.name || t.languageName || t.languageCode || t.language || t.caption || t.label);
    var s = textOf(cand);
    return s || ('Ścieżka ' + (i + 1));
  }

  // YouTube encodes the audio-track metadata inside the track id as a base64
  // protobuf: "251;<b64>" where <b64> decodes to sub-messages such as
  // ...\x05acont\x12\x0bdubbed-auto and ...\x04lang\x12\x02ar. Decode both
  // the track type (original / dubbed-auto) and the language code.
  function trackMeta(t) {
    var out = { type: '', lang: '' };
    if (!t) { return out; }
    var direct = t.languageCode || t.language || '';
    if (direct && typeof direct === 'string') { out.lang = direct; }
    var id = typeof t.id === 'string' ? t.id : '';
    if (id) {
      try {
        var b64 = id.indexOf(';') >= 0 ? id.slice(id.indexOf(';') + 1) : id;
        var bin = atob(b64);
        var li = bin.indexOf('lang');
        if (li >= 0 && bin.charCodeAt(li + 4) === 0x12) {
          out.lang = bin.substr(li + 6, bin.charCodeAt(li + 5));
        }
        var ai = bin.indexOf('acont');
        if (ai >= 0 && bin.charCodeAt(ai + 5) === 0x12) {
          out.type = bin.substr(ai + 7, bin.charCodeAt(ai + 6));
        }
      } catch (e) {}
      if (!out.lang) {
        var m = id.match(/^([a-z]{2})([-_]|$)/i);
        if (m) { out.lang = m[1]; }
      }
    }
    return out;
  }

  function trackLanguage(t) { return trackMeta(t).lang; }
  // A seek issued while the player is still loading after a previous seek is
  // silently dropped by YouTube. Keep only the *latest* requested target and
  // re-apply it until the video lands there (or we give up after a few
  // seconds), so rapid scrubbing is coalesced instead of lost.
  var seekTarget = null;
  var seekStartedAt = 0;
  var seekAppliedAt = 0;
  function applySeek(s) {
    try {
      var p = player();
      if (p && p.seekTo) { p.seekTo(s, true); }
      else { var v = video(); if (v) { v.currentTime = s; } }
    } catch (e) {}
  }
  function hookSeeked() {
    try {
      var v = video();
      if (v && !v.__ktSeekHooked) {
        v.__ktSeekHooked = true;
        v.addEventListener('seeked', function () {
          if (seekTarget != null && Math.abs(v.currentTime - seekTarget) > 1) {
            applySeek(seekTarget);
            seekAppliedAt = Date.now();
          }
        });
      }
    } catch (e) {}
  }

  window.__kt = {
    play: function () { try { var p = player(); if (p && p.playVideo) { p.playVideo(); } else { var v = video(); if (v) { v.play(); } } } catch (e) {} },
    pause: function () { try { var p = player(); if (p && p.pauseVideo) { p.pauseVideo(); } else { var v = video(); if (v) { v.pause(); } } } catch (e) {} },
    seek: function (s) {
      try {
        s = Math.max(0, Number(s) || 0);
        seekTarget = s;
        seekStartedAt = Date.now();
        seekAppliedAt = 0;
        var v = video();
        if (!v || !v.seeking) { applySeek(s); seekAppliedAt = Date.now(); }
      } catch (e) {}
    },
    captionsOff: function () { try { var p = player(); if (p && p.setOption) { p.setOption('captions', 'track', {}); } } catch (e) {} },
    captionsList: function () {
      try {
        var p = player();
        if (!p) { return []; }
        var list = (p.getOption && p.getOption('captions', 'tracklist')) || [];
        if (!list.length) {
          try {
            var pr = p.getPlayerResponse && p.getPlayerResponse();
            if (pr && pr.captions && pr.captions.playerCaptionsTracklistRenderer) {
              list = pr.captions.playerCaptionsTracklistRenderer.captionTracks || [];
            }
          } catch (e) {}
        }
        return list;
      } catch (e) { return []; }
    },
    captionsToggle: function () {
      try {
        var p = player();
        if (!p || !p.getOption || !p.setOption) { return; }
        var cur = p.getOption('captions', 'track');
        if (cur && cur.languageCode) {
          p.setOption('captions', 'track', {});
          return;
        }
        var list = window.__kt.captionsList();
        if (list[0]) { p.setOption('captions', 'track', list[0]); }
      } catch (e) {}
    },
    audioTrack: function (index) {
      try {
        var p = player();
        if (p && p.setAudioTrack && window.__ktAudio && window.__ktAudio[index]) {
          p.setAudioTrack(window.__ktAudio[index]);
        }
      } catch (e) {}
    }
  };

  // Same event model as the official IFrame API (YT.PlayerState): the internal
  // movie_player exposes addEventListener('onStateChange') and getPlayerState().
  var playerState = -1;
  function attachStateListener() {
    try {
      var p = player();
      if (p && p.addEventListener && !p.__ktHooked) {
        p.__ktHooked = true;
        p.addEventListener('onStateChange', function (e) {
          playerState = (e && typeof e === 'object' && e.data !== undefined) ? e.data : e;
        });
      }
    } catch (e) {}
  }

  document.addEventListener('click', function (event) {
    var anchor = event.target && event.target.closest && event.target.closest('a');
    if (anchor) { event.preventDefault(); event.stopPropagation(); }
  }, true);

  hideChrome();

  var readySent = false;
  var announced = false;
  setInterval(function () {
    try {
      hideChrome();
      attachStateListener();
      var v = video();
      if (!v) { return; }

      hookSeeked();
      if (seekTarget != null) {
        var seekDiff = Math.abs(v.currentTime - seekTarget);
        var seekExpired = Date.now() - seekStartedAt > 6000;
        if (seekDiff <= 1 || seekExpired) {
          seekTarget = null;
        } else if (!v.seeking && Date.now() - seekAppliedAt > 250) {
          applySeek(seekTarget);
          seekAppliedAt = Date.now();
        }
      }
      if (!readySent && !v.paused && v.currentTime > 1.5) {
        readySent = true;
        window.__kt.captionsOff();
        post({ type: 'ready' });
      }

      var p = player();
      var ps = playerState;
      try { if (ps === -1 && p && p.getPlayerState) { ps = p.getPlayerState(); } } catch (e) {}
      var captionsOn = false;
      var audioTracks = [];
      var audioIndex = 0;
      try {
        if (p && p.getOption) {
          var ct = p.getOption('captions', 'track');
          captionsOn = !!(ct && ct.languageCode);
        }
      } catch (e) {}
      try {
        if (p && p.getAvailableAudioTracks) {
          var all = p.getAvailableAudioTracks() || [];
          var cur = p.getAudioTrack ? p.getAudioTrack() : null;
          // KidTube policy: only the original audio track and the Polish dub.
          var keep = [];
          var origInKeep = -1;
          var decoded = 0;
          for (var i = 0; i < all.length; i++) {
            var meta = trackMeta(all[i]);
            if (meta.type || meta.lang) { decoded++; }
            if (meta.type === 'original' || meta.lang === 'pl') {
              if (meta.type === 'original' && origInKeep < 0) { origInKeep = keep.length; }
              keep.push({ track: all[i], meta: meta });
            }
          }
          // If we could not read any metadata, fall back to showing everything.
          if (keep.length === 0 && decoded === 0) {
            for (var f = 0; f < all.length; f++) {
              keep.push({ track: all[f], meta: trackMeta(all[f]) });
            }
          }
          window.__ktAudio = keep.map(function (e) { return e.track; });
          for (var j = 0; j < keep.length; j++) {
            audioTracks.push({
              index: j,
              label: trackLabel(keep[j].track, j),
              languageCode: keep[j].meta.lang,
              isOriginal: keep[j].meta.type === 'original'
            });
            if (cur && keep[j].track && cur.id != null && keep[j].track.id === cur.id) {
              audioIndex = j;
            }
          }
          // Start on the original track (retry briefly, then give up).
          if (!window.__ktAudioOriginalSet) {
            if (origInKeep < 0) {
              window.__ktAudioOriginalSet = true;
            } else if ((window.__ktAudioSetTries || 0) < 10) {
              window.__ktAudioSetTries = (window.__ktAudioSetTries || 0) + 1;
              if (cur && cur.id != null && cur.id === keep[origInKeep].track.id) {
                window.__ktAudioOriginalSet = true;
              } else {
                window.__kt.audioTrack(origInKeep);
              }
            } else {
              window.__ktAudioOriginalSet = true;
            }
          }
        }
      } catch (e) {}

      post({
        type: 'state',
        playing: !v.paused,
        position: isFinite(v.currentTime) ? v.currentTime : 0,
        duration: isFinite(v.duration) ? v.duration : 0,
        playerState: ps,
        buffering: !!(v.seeking || ps === 3),
        captionsOn: captionsOn,
        audioTracks: audioTracks,
        audioIndex: audioIndex
      });

      if (!announced) {
        var atEnd = v.ended || (isFinite(v.duration) && v.currentTime >= v.duration - 0.25);
        if (atEnd && v.currentTime > 0) {
          announced = true;
          post({ type: 'ended' });
        }
      }
    } catch (e) {}
  }, 500);
  true;
})();
`;

const cmd = (body: string) => `(function(){try{${body}}catch(e){}})();true;`;

export const EmbedPlayer = forwardRef<PlayerHandle, EmbedPlayerProps>(function EmbedPlayerImpl(
  { videoId, autoPlay = true, startSeconds = 0, onReady, onEnded, onError, onState },
  ref,
) {
  const uri = useMemo(() => buildEmbedUrl(videoId, autoPlay, startSeconds), [videoId, autoPlay, startSeconds]);
  const webRef = useRef<React.ComponentRef<typeof WebView>>(null);
  const onReadyRef = useRef(onReady);
  const onEndedRef = useRef(onEnded);
  const onErrorRef = useRef(onError);
  const onStateRef = useRef(onState);
  // While a seek is settling the player keeps reporting the old position for a
  // few polls; hold the requested target until it reports back near it.
  const seekRef = useRef<{ target: number; at: number } | null>(null);
  onReadyRef.current = onReady;
  onEndedRef.current = onEnded;
  onErrorRef.current = onError;
  onStateRef.current = onState;

  useEffect(() => {
    onReadyRef.current = onReady;
    onEndedRef.current = onEnded;
    onErrorRef.current = onError;
    onStateRef.current = onState;
  }, [onReady, onEnded, onError, onState]);

  const run = (body: string) => webRef.current?.injectJavaScript(cmd(body));

  useImperativeHandle(ref, () => ({
    play: () => run('window.__kt && window.__kt.play();'),
    pause: () => run('window.__kt && window.__kt.pause();'),
    togglePlay: () => run('var v=document.querySelector("video"); if(v){ if(v.paused){window.__kt.play();}else{window.__kt.pause();} }'),
    seekTo: (seconds: number) => {
      const target = Math.max(0, seconds);
      seekRef.current = { target, at: Date.now() };
      run(`window.__kt && window.__kt.seek(${target});`);
    },
    toggleCaptions: () => run('window.__kt && window.__kt.captionsToggle();'),
    setAudioTrack: (index: number) => run(`window.__kt && window.__kt.audioTrack(${index});`),
  }));

  return (
    <View pointerEvents="none" style={styles.container}>
      <WebView
        ref={webRef}
        style={styles.webview}
        originWhitelist={['https://*.youtube.com', 'https://*.youtube-nocookie.com', 'about:blank']}
        source={{ uri, headers: { Referer: APP_ORIGIN, origin: APP_ORIGIN } }}
        userAgent={CHROME_UA}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={event => isAllowedPlayerUrl(event.url, videoId)}
        injectedJavaScript={PLAYER_JSA}
        onMessage={event => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data && data.type === 'ready') {
              onReadyRef.current?.();
            } else if (data && data.type === 'ended') {
              onEndedRef.current?.();
            } else if (data && data.type === 'state') {
              let position = Number(data.position) || 0;
              const seek = seekRef.current;
              if (seek) {
                if (Math.abs(position - seek.target) <= 1 || Date.now() - seek.at > 6000) {
                  seekRef.current = null;
                } else {
                  position = seek.target;
                }
              }
              onStateRef.current?.({
                playing: !!data.playing,
                position,
                duration: Number(data.duration) || 0,
                playerState: Number.isFinite(Number(data.playerState)) ? Number(data.playerState) : -1,
                buffering: !!data.buffering,
                captionsOn: !!data.captionsOn,
                audioTracks: Array.isArray(data.audioTracks) ? data.audioTracks : [],
                audioIndex: Number(data.audioIndex) || 0,
              });
            }
          } catch {
            // ignore non-JSON messages
          }
        }}
        onError={event => {
          console.log('[KidTube:player] error', event.nativeEvent.description);
          onErrorRef.current?.(event.nativeEvent.description);
        }}
        onHttpError={event => {
          console.log('[KidTube:player] http', event.nativeEvent.statusCode);
          onErrorRef.current?.(`HTTP ${event.nativeEvent.statusCode}`);
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black },
  webview: { flex: 1, backgroundColor: colors.black },
});
