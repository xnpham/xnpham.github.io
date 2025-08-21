"use client";
import { useEffect } from 'react';

// Ensures a single hidden global YouTube player container & loads iframe API once.
export default function GlobalYouTubeBootstrap() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    let container = document.getElementById('global-yt-player-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'global-yt-player-container';
      container.style.position = 'absolute';
      container.style.width = '0px';
      container.style.height = '0px';
      container.style.overflow = 'hidden';
      container.style.left = '-9999px';
      container.style.top = '0';
      document.body.appendChild(container);
    }
    if (!document.getElementById('yt-audio-player')) {
      const div = document.createElement('div');
      div.id = 'yt-audio-player';
      container.appendChild(div);
    }
    const scriptId = 'youtube-iframe-api';
    if (!document.getElementById(scriptId)) {
      const tag = document.createElement('script');
      tag.id = scriptId;
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }
  }, []);
  return null;
}
