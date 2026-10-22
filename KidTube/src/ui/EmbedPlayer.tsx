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
  /** Fired once playback started and YouTube's startup UI has been dismissed. */
  onReady?: () => void;
  onEnded?: () => void;
  onState?: (state: PlayerState) => void;
}

const APP_ORIGIN = 'https://com.kidtube';
const CHROME_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

function buildEmbedUrl(videoId: string, autoPlay: boolean): string {
  const params = ['playsinline=1', 'rel=0', 'iv_load_policy=3', 'disablekb=1', 'controls=0'];
  if (autoPlay) {
    params.push('autoplay=1');
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

  function trackLabel(t, i) {
    return (t && (t.displayName || t.name || t.languageName || t.languageCode || t.caption)) || ('Ścieżka ' + (i + 1));
  }

  window.__kt = {
    play: function () { try { var p = player(); if (p && p.playVideo) { p.playVideo(); } else { var v = video(); if (v) { v.play(); } } } catch (e) {} },
    pause: function () { try { var p = player(); if (p && p.pauseVideo) { p.pauseVideo(); } else { var v = video(); if (v) { v.pause(); } } } catch (e) {} },
    seek: function (s) { try { var p = player(); if (p && p.seekTo) { p.seekTo(s, true); } else { var v = video(); if (v) { v.currentTime = s; } } } catch (e) {} },
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
          var at = p.getAvailableAudioTracks() || [];
          window.__ktAudio = at;
          var cur = p.getAudioTrack ? p.getAudioTrack() : null;
          for (var i = 0; i < at.length; i++) {
            audioTracks.push({ index: i, label: trackLabel(at[i], i) });
            if (cur && at[i] && cur.id != null && at[i].id === cur.id) { audioIndex = i; }
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
  { videoId, autoPlay = true, onReady, onEnded, onState },
  ref,
) {
  const uri = useMemo(() => buildEmbedUrl(videoId, autoPlay), [videoId, autoPlay]);
  const webRef = useRef<React.ComponentRef<typeof WebView>>(null);
  const onReadyRef = useRef(onReady);
  const onEndedRef = useRef(onEnded);
  const onStateRef = useRef(onState);
  onReadyRef.current = onReady;
  onEndedRef.current = onEnded;
  onStateRef.current = onState;

  useEffect(() => {
    onReadyRef.current = onReady;
    onEndedRef.current = onEnded;
    onStateRef.current = onState;
  }, [onReady, onEnded, onState]);

  const run = (body: string) => webRef.current?.injectJavaScript(cmd(body));

  useImperativeHandle(ref, () => ({
    play: () => run('window.__kt && window.__kt.play();'),
    pause: () => run('window.__kt && window.__kt.pause();'),
    togglePlay: () => run('var v=document.querySelector("video"); if(v){ if(v.paused){window.__kt.play();}else{window.__kt.pause();} }'),
    seekTo: (seconds: number) => run(`window.__kt && window.__kt.seek(${Math.max(0, seconds)});`),
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
              onStateRef.current?.({
                playing: !!data.playing,
                position: Number(data.position) || 0,
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
        onError={event => console.log('[KidTube:player] error', event.nativeEvent.description)}
        onHttpError={event => console.log('[KidTube:player] http', event.nativeEvent.statusCode)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black },
  webview: { flex: 1, backgroundColor: colors.black },
});
