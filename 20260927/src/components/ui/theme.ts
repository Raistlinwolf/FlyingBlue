'use client';
import type { Theme } from '@/domain/types';

const KEY = 'fbxp.theme';

/** Inline script for <head>: applies the stored theme before first paint. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('${KEY}')||'system';var d=document.documentElement;d.dataset.theme=t;if(t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)){d.classList.add('dark')}}catch(e){}})()`;

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', dark);
}

/** Remembers the theme in this browser (so the next load paints correctly) and applies it. */
export function storeTheme(theme: Theme) {
  try {
    window.localStorage.setItem(KEY, theme);
  } catch {
    // ignore: storage unavailable
  }
  applyTheme(theme);
}
