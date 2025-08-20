"use client";
import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/Button';

// --- Minimal YouTube IFrame API typings (subset we use) ---
interface YTVideoData { video_id?: string; title?: string }
interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  destroy(): void;
  loadVideoById(videoId: string): void;
  getDuration(): number;
  getCurrentTime(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  getVolume(): number;
  getVideoData(): YTVideoData | undefined;
  getIframe(): HTMLIFrameElement;
  getPlayerState(): number; // 0 ended, 1 playing, 2 paused, ...
}
interface YTPlayerVars {
  autoplay?: 0 | 1;
  controls?: 0 | 1;
  rel?: 0 | 1;
  enablejsapi?: 0 | 1;
  modestbranding?: 0 | 1;
  playsinline?: 0 | 1;
}
interface YTOnReadyEvent { target: YTPlayer }
interface YTOnStateChangeEvent { target: YTPlayer; data: number }
interface YTPlayerOptions {
  height?: string;
  width?: string;
  videoId: string;
  playerVars?: YTPlayerVars;
  events?: {
    onReady?: (e: YTOnReadyEvent) => void;
    onStateChange?: (e: YTOnStateChangeEvent) => void;
  };
}
declare global {
  interface Window { YT?: { Player: new (elementId: string, options: YTPlayerOptions) => YTPlayer } }
}

// Basic Pomodoro defaults
const WORK_MIN = 25;
const BREAK_MIN = 5;

// Utility to format mm:ss
function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

export default function PomodoroTimer() {
  const [workMinutes, setWorkMinutes] = useState(WORK_MIN);
  const [breakMinutes, setBreakMinutes] = useState(BREAK_MIN);
  const [secondsLeft, setSecondsLeft] = useState(workMinutes * 60);
  const [mode, setMode] = useState<'work' | 'break'>('work');
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [autoPlayMusic, setAutoPlayMusic] = useState(false);
  const [volume, setVolume] = useState(60); // 0-100
  const [playlist, setPlaylist] = useState<{
    id: string;
    videoId: string;
    title?: string;
    durationSec?: number;
  }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const playerRef = useRef<YTPlayer | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [repeat, setRepeat] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  // Key comprised only of video IDs to avoid effect retriggers on title/duration updates
  const videoIdKey = playlist.map(p => p.videoId).join(',');

  // Update secondsLeft if user changes duration while stopped
  useEffect(() => {
    if (!isRunning) {
      setSecondsLeft((mode === 'work' ? workMinutes : breakMinutes) * 60);
    }
  }, [workMinutes, breakMinutes, mode, isRunning]);

  // Main ticking effect
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return () => {};
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev > 1) return prev - 1;
        // Cycle end
        const nextMode = mode === 'work' ? 'break' : 'work';
        const nextSeconds = (nextMode === 'work' ? workMinutes : breakMinutes) * 60;
        setMode(nextMode);
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }
        if (nextMode === 'work' && autoPlayMusic && playlist.length > 0) {
          // resume / ensure playing
          playCurrent(true);
        }
        return nextSeconds;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, mode, workMinutes, breakMinutes, autoPlayMusic, playlist, currentIndex]);

  const progress = () => {
    const total = (mode === 'work' ? workMinutes : breakMinutes) * 60;
    return 100 - (secondsLeft / total) * 100;
  };

  function toggleRun() {
    setIsRunning((r) => !r);
  }
  function reset() {
    setIsRunning(false);
    setMode('work');
    setSecondsLeft(workMinutes * 60);
  }
  // ---------- YouTube utilities ----------
  function parseYouTubeId(url: string) {
    try {
      const ytRegex = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([A-Za-z0-9_-]{6,})/;
      const match = url.match(ytRegex);
      return match ? match[1] : '';
    } catch {
      return '';
    }
  }

  // Load / init iframe API once
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.YT && window.YT.Player) return; // already loaded
    const scriptId = 'youtube-iframe-api';
    if (document.getElementById(scriptId)) return;
    const tag = document.createElement('script');
    tag.id = scriptId;
    tag.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(tag);
  }, []);

  // Fetch metadata (title + duration) after player loads / video changes
  const fetchMeta = useCallback(() => {
    let attempts = 0;
    const poll = setInterval(() => {
      attempts += 1;
      try {
        const p = playerRef.current;
        if (p) {
          const d = p.getDuration?.();
            if (d && d > 0) {
              setDurationSec(d);
              const data = p.getVideoData?.();
              if (data?.title) {
                setPlaylist(pl => pl.map((item, idx) => idx === currentIndex ? { ...item, title: data.title, durationSec: d } : item));
              }
              clearInterval(poll);
            }
        }
      } catch {}
      if (attempts > 50) clearInterval(poll);
    }, 300);
  }, [currentIndex]);

  // Create / update player only when video ID changes (avoid reload on metadata updates)
  useEffect(() => {
    if (playlist.length === 0) return;
    const videoId = playlist[currentIndex]?.videoId;
    if (!videoId) return;
    function createOrLoad() {
      if (!window.YT || !window.YT.Player) return;
      if (!playerRef.current) {
        playerRef.current = new window.YT.Player('yt-audio-player', {
          height: '0',
          width: '0',
          videoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            rel: 0,
            enablejsapi: 1,
            modestbranding: 1,
            playsinline: 1,
          },
          events: {
            onReady: (e) => {
              setPlayerReady(true);
              try { e.target.setVolume(volume); } catch {}
              fetchMeta();
            },
            onStateChange: (e) => {
              if (e.data === 0) { // ended
                if (playlist.length > 1) {
                  nextTrack();
                } else if (repeat) {
                  try { playerRef.current?.seekTo(0, true); playerRef.current?.playVideo(); } catch {}
                } else {
                  setCurrentTimeSec(durationSec || 0);
                }
                setIsPlayingAudio(false);
              } else if (e.data === 1) { // playing
                try { playerRef.current?.setVolume(volume); } catch {}
                setIsPlayingAudio(true);
              } else if (e.data === 2) { // paused
                setIsPlayingAudio(false);
              }
            }
          }
        });
      } else {
        try {
          const currentVideoId = playerRef.current?.getVideoData?.()?.video_id;
          if (currentVideoId !== videoId) {
            playerRef.current.loadVideoById(videoId);
            fetchMeta();
          }
        } catch {}
        try { playerRef.current?.setVolume(volume); } catch {}
        setPlayerReady(true);
        try { const state = playerRef.current?.getPlayerState?.(); setIsPlayingAudio(state === 1); } catch {}
      }
    }
    const interval = setInterval(() => {
      if (window.YT && window.YT.Player) {
        clearInterval(interval);
        createOrLoad();
      }
    }, 200);
    return () => clearInterval(interval);
  }, [videoIdKey, currentIndex, repeat, playlist.length, volume, fetchMeta, durationSec]);

  // Show/hide video by adjusting iframe/container styles
  useEffect(() => {
    if (!playerRef.current) return;
    try {
      const iframe: HTMLIFrameElement | undefined = playerRef.current.getIframe?.();
      if (iframe) {
        if (showVideo) {
          iframe.style.position = 'static';
          iframe.style.width = '100%';
          iframe.style.height = '100%';
        } else {
          iframe.style.position = 'absolute';
          iframe.style.width = '0px';
          iframe.style.height = '0px';
          iframe.style.left = '-9999px';
        }
      }
    } catch {}
  }, [showVideo]);

  // Update volume when slider changes
  useEffect(() => {
    if (playerRef.current && playerReady) {
      try { playerRef.current.setVolume(volume); } catch {}
    }
  }, [volume, playerReady]);

  // (Replaced by fetchMeta useCallback above)

  // Playback position tracking via rAF
  useEffect(() => {
    if (!playerRef.current) return;
    let raf: number;
    const tick = () => {
      try {
        const t = playerRef.current?.getCurrentTime?.();
        if (typeof t === 'number' && !Number.isNaN(t)) setCurrentTimeSec(t);
      } catch {}
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playerReady, currentIndex]);

  function handleSeek(v: number) {
    setCurrentTimeSec(v);
    try { playerRef.current?.seekTo(v, true); } catch {}
  }
  function rewind(sec = 10) { handleSeek(Math.max(0, currentTimeSec - sec)); }
  function forward(sec = 10) { handleSeek(durationSec ? Math.min(durationSec, currentTimeSec + sec) : currentTimeSec + sec); }

  function toggleAudioPlayback() {
    if (!playerRef.current) return;
    try {
      const state = playerRef.current.getPlayerState?.();
      if (state === 1) { // playing
        playerRef.current.pauseVideo();
        setIsPlayingAudio(false);
      } else {
        playerRef.current.playVideo();
        setIsPlayingAudio(true);
      }
    } catch {}
  }

  function handleAddToPlaylist(e: React.FormEvent) {
    e.preventDefault();
    const id = parseYouTubeId(youtubeUrl.trim());
    if (!id) return;
    setPlaylist((pl) => {
      if (pl.some(p => p.videoId === id)) return pl; // no duplicates
      return [...pl, { id: crypto.randomUUID(), videoId: id }];
    });
    setYoutubeUrl('');
  }

  function playCurrent(force: boolean = false) {
    if (!playerRef.current) return;
    try {
      if (force) playerRef.current.playVideo();
      else playerRef.current.playVideo();
    } catch {}
  }

  function nextTrack() {
    setCurrentIndex((idx) => {
      if (playlist.length === 0) return 0;
      return (idx + 1) % playlist.length;
    });
  }
  function prevTrack() {
    setCurrentIndex((idx) => {
      if (playlist.length === 0) return 0;
      return (idx - 1 + playlist.length) % playlist.length;
    });
  }
  function removeTrack(id: string) {
    setPlaylist((prev) => {
      const index = prev.findIndex(p => p.id === id);
      if (index === -1) return prev;
      const nextList = prev.filter(p => p.id !== id);
      if (index === currentIndex) {
        if (nextList.length === 0) {
          // Stop and destroy player when no tracks remain
            try {
              playerRef.current?.stopVideo?.();
              playerRef.current?.destroy?.();
            } catch {}
            playerRef.current = null;
            setPlayerReady(false);
            setIsPlayingAudio(false);
            setDurationSec(null);
            setCurrentTimeSec(0);
            setCurrentIndex(0);
        } else {
          const newIndex = Math.min(index, nextList.length - 1);
          setCurrentIndex(newIndex);
        }
      } else if (index < currentIndex) {
        setCurrentIndex(i => Math.max(0, i - 1));
      }
      return nextList;
    });
  }

  function clearAllTracks() {
    setPlaylist([]);
    try {
      playerRef.current?.stopVideo?.();
      playerRef.current?.destroy?.();
    } catch {}
    playerRef.current = null;
    setPlayerReady(false);
    setIsPlayingAudio(false);
    setDurationSec(null);
    setCurrentTimeSec(0);
    setCurrentIndex(0);
  }

  function randomTrack() {
    if (playlist.length < 2) return; // nothing to randomize
    let r = currentIndex;
    let safety = 20;
    while (r === currentIndex && safety--) r = Math.floor(Math.random() * playlist.length);
    setCurrentIndex(r);
  }

  // Drag & drop reorder
  const dragIndexRef = useRef<number | null>(null);
  function handleDragStart(e: React.DragEvent, idx: number) {
    dragIndexRef.current = idx;
    e.dataTransfer.effectAllowed = 'move';
  }
  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }
  function handleDrop(e: React.DragEvent, idx: number) {
    e.preventDefault();
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    if (from == null || from === idx) return;
    setPlaylist(pl => {
      const copy = [...pl];
      const [moved] = copy.splice(from, 1);
      copy.splice(idx, 0, moved);
      // Adjust current index
      if (from === currentIndex) {
        setCurrentIndex(idx);
      } else if (from < currentIndex && idx >= currentIndex) {
        setCurrentIndex(i => i - 1);
      } else if (from > currentIndex && idx <= currentIndex) {
        setCurrentIndex(i => i + 1);
      }
      return copy;
    });
  }
  function handleDragEnd() { dragIndexRef.current = null; }

  // LocalStorage persistence
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('pomodoroSettings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.workMinutes) setWorkMinutes(parsed.workMinutes);
        if (parsed.breakMinutes) setBreakMinutes(parsed.breakMinutes);
        if (parsed.autoPlayMusic !== undefined) setAutoPlayMusic(parsed.autoPlayMusic);
        if (parsed.volume !== undefined) setVolume(parsed.volume);
        if (parsed.playlist && Array.isArray(parsed.playlist)) setPlaylist(parsed.playlist);
        if (parsed.currentIndex !== undefined) setCurrentIndex(parsed.currentIndex);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const data = {
      workMinutes,
      breakMinutes,
      autoPlayMusic,
      volume,
      playlist,
      currentIndex
    };
    try { localStorage.setItem('pomodoroSettings', JSON.stringify(data)); } catch {}
  }, [workMinutes, breakMinutes, autoPlayMusic, volume, playlist, currentIndex]);

  function formatVideoDuration(sec?: number) {
    if (!sec && sec !== 0) return '—';
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6">
        <div className="space-y-3">
          <label className="flex justify-between text-xs uppercase tracking-wide opacity-70">
            <span>Work Duration</span>
            <span className="font-semibold opacity-100 text-[color:var(--text)]">{workMinutes} min</span>
          </label>
          <input
            type="range"
            min={5}
            max={90}
            step={5}
            disabled={isRunning}
            value={workMinutes}
            onChange={(e) => setWorkMinutes(Number(e.target.value))}
            className="w-full accent-blue-600 cursor-pointer"
          />
        </div>
        <div className="space-y-3">
          <label className="flex justify-between text-xs uppercase tracking-wide opacity-70">
            <span>Break Duration</span>
            <span className="font-semibold opacity-100 text-[color:var(--text)]">{breakMinutes} min</span>
          </label>
          <input
            type="range"
            min={1}
            max={30}
            step={1}
            disabled={isRunning}
            value={breakMinutes}
            onChange={(e) => setBreakMinutes(Number(e.target.value))}
            className="w-full accent-blue-600 cursor-pointer"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={toggleRun} className="flex-1" variant="primary">
            {isRunning ? 'Pause' : 'Start'}
          </Button>
          <Button onClick={reset} className="flex-1 border border-[color:var(--border)] bg-transparent text-[color:var(--text)] hover:bg-white/5" variant="ghost">Reset</Button>
        </div>
      </div>

      <div className="relative p-6 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] flex flex-col items-center gap-4">
        <div className="text-xs uppercase tracking-wide font-medium text-[color:var(--muted)]">{mode === 'work' ? 'Focus' : 'Break'}</div>
        <div className="text-6xl font-bold tabular-nums">{formatTime(secondsLeft)}</div>
        <div className="w-full h-2 rounded bg-black/30 overflow-hidden">
          <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress()}%` }} />
        </div>
      </div>

      <div className="space-y-4">
        <form onSubmit={handleAddToPlaylist} className="space-y-2">
          <label className="block text-xs uppercase tracking-wide opacity-70">YouTube (audio only)</label>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              className="flex-1 rounded border border-[color:var(--border)] bg-transparent px-2 py-1"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
            />
            <Button type="submit" className="border border-[color:var(--border)] bg-transparent text-[color:var(--text)] hover:bg-white/5" variant="ghost">Add</Button>
          </div>
          <div className="flex flex-wrap gap-4 items-center text-xs">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="accent-blue-600"
                checked={autoPlayMusic}
                onChange={(e) => setAutoPlayMusic(e.target.checked)}
              />
              Auto-play work sessions
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="accent-blue-600"
                checked={repeat}
                onChange={(e) => setRepeat(e.target.checked)}
              />
              Repeat
            </label>
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="accent-blue-600"
                  checked={showVideo}
                  onChange={(e) => setShowVideo(e.target.checked)}
                />
                Show video
              </label>
            <div className="flex items-center gap-2">
              <span className="opacity-70">Vol</span>
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="accent-blue-600 cursor-pointer"
              />
              <span className="tabular-nums w-10 text-right text-[color:var(--muted)] text-xs">{volume}%</span>
            </div>
          </div>
        </form>

        {playlist.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide opacity-70">
              <span>Playlist</span>
              <span className="opacity-70">{currentIndex + 1}/{playlist.length}</span>
            </div>
            <ul className="space-y-1 max-h-40 overflow-auto pr-1 text-sm">
              {playlist.map((item, idx) => {
                const active = idx === currentIndex;
                return (
                  <li
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={[
                      'flex items-center gap-2 rounded border px-2 py-1 cursor-move select-none',
                      active ? 'border-blue-600 bg-blue-600/10' : 'border-[color:var(--border)]'
                    ].join(' ')}
                  >
                    <button
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      className="flex-1 text-left truncate"
                      title={item.title || item.videoId}
                    >
                      {item.title || item.videoId}
                      <span className="ml-2 text-[0.65rem] opacity-60">{item.durationSec ? formatVideoDuration(item.durationSec) : (active && durationSec ? formatVideoDuration(durationSec) : '…')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTrack(item.id)}
                      className="text-[color:var(--muted)] hover:text-red-400 transition"
                      aria-label="Remove"
                    >×</button>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button onClick={prevTrack} className="flex-1 min-w-20 border border-[color:var(--border)] bg-transparent hover:bg-white/5" variant="ghost" type="button">Prev</Button>
              <Button onClick={toggleAudioPlayback} className="flex-1 min-w-20 border border-[color:var(--border)] bg-transparent hover:bg-white/5" variant="ghost" type="button">{isPlayingAudio ? 'Pause' : 'Play'}</Button>
              <Button onClick={nextTrack} className="flex-1 min-w-20 border border-[color:var(--border)] bg-transparent hover:bg-white/5" variant="ghost" type="button">Next</Button>
              <Button onClick={randomTrack} className="flex-1 min-w-20 border border-[color:var(--border)] bg-transparent hover:bg-white/5" variant="ghost" type="button">Random</Button>
              <Button onClick={clearAllTracks} className="flex-1 min-w-20 border border-[color:var(--border)] text-red-400 bg-transparent hover:bg-red-500/10" variant="ghost" type="button">Clear</Button>
            </div>
            <div className="space-y-2">
              {durationSec ? (
                <div className="flex items-center gap-2">
                  <Button type="button" onClick={() => rewind()} className="border border-[color:var(--border)] px-2 py-1 text-xs h-auto min-h-0 leading-none bg-transparent hover:bg-white/5" size="sm" variant="ghost">-10s</Button>
                  <input
                    type="range"
                    min={0}
                    max={durationSec}
                    step={1}
                    value={Math.min(currentTimeSec, durationSec)}
                    onChange={(e) => handleSeek(Number(e.target.value))}
                    className="flex-1 accent-blue-600 cursor-pointer"
                  />
                  <Button type="button" onClick={() => forward()} className="border border-[color:var(--border)] px-2 py-1 text-xs h-auto min-h-0 leading-none bg-transparent hover:bg-white/5" size="sm" variant="ghost">+10s</Button>
                </div>
              ) : (
                <div className="text-[0.65rem] opacity-60">Loading track info...</div>
              )}
              <div className="text-[0.65rem] opacity-60 flex gap-4 flex-wrap">
                <span>Track: {formatVideoDuration(currentTimeSec)} / {durationSec ? formatVideoDuration(durationSec) : '—'}</span>
                <span>Status: {playerReady ? 'Ready' : 'Loading'}</span>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className={showVideo ? 'mt-4 rounded overflow-hidden border border-[color:var(--border)] aspect-video w-full relative' : ''}>
        <div id="yt-audio-player" style={showVideo ? { position: 'absolute', inset: 0 } : { position: 'absolute', width: 0, height: 0, overflow: 'hidden', left: '-9999px' }} aria-hidden={showVideo ? 'false' : 'true'} />
      </div>

  <audio ref={audioRef} preload="auto">
        <source src="data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA/////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" type="audio/mp3" />
      </audio>
    </div>
  );
}
