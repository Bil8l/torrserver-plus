// ==UserScript==
// @name         TorrServer ++
// @namespace    torrserver-ui-plus
// @version      1.9.2
// @description  Copy link and MPV buttons on every torrent card (left click: playlist, right click: pick an episode), per-file MPV in the details dialog, an expandable file tree in the details dialog to browse nested folders and stream any file, season grouping with one-click play-a-whole-season and season watched marks, multi-select checkboxes that build a playlist link from any picked set of episodes, folder-grouped episode menus that open at the cursor, a fast MPV launcher with hover prewarm and live peers/buffer, a watch tracker with a continue-watching shelf, watched checkmarks in the tree and MPV resume from the last watched episode, one-click adding of hashes, magnets and .torrent links with trackers appended, auto-detected category (Movies / Series / Music / Other) from the torrent name and file list, clean-name and cover lookup (TMDB, AniList, IMDb, TVMaze, iTunes, Deezer, Wikipedia), and a local privacy mode that blocks public trackers, cover lookups, external posters and save_to_db. Cover lookups are sent without cookies. Clipboard is read locally only. MPV playback needs mpv-handler installed.
// @license      MIT
// @homepageURL  https://github.com/Bil8l/torrserver-plus
// @supportURL   https://github.com/Bil8l/torrserver-plus/issues
// @match        http://localhost:8090/*
// @match        https://localhost:8090/*
// @match        http://127.0.0.1:8090/*
// @match        https://127.0.0.1:8090/*
// @include      /^https?:\/\/[^/]+:8090\//
// @connect      graphql.anilist.co
// @connect      itunes.apple.com
// @connect      api.themoviedb.org
// @connect      v2.sg.media-imdb.com
// @connect      api.tvmaze.com
// @connect      api.deezer.com
// @connect      en.wikipedia.org
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @run-at       document-start
// @noframes
// ==/UserScript==

(function () {
  'use strict'

  const ACCENT = '#7be3c3'
  const ACCENT_HOVER_BG = 'rgba(123, 227, 195, 0.25)'
  const MPV_SCHEME = 'handler'
  const MPV_ACCENT = '#571358'
  const MPV_ACCENT_LIGHT = '#c983cd'

  const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window
  if (W.__TS_UI_PLUS) return
  W.__TS_UI_PLUS = true

  const PRIVACY_KEY = 'ts-privacy.v1'
  let privacyEnabled = localStorage.getItem(PRIVACY_KEY) === '1'
  const privacyOn = () => privacyEnabled

  const COPY_LINK_LABELS = [
    'copy link',
    'копиране линк',
    'copier le lien',
    'copiați link-ul',
    'копировать',
    'копіювати',
    '复制链接',
  ]

  const VIDEO_EXT = /\.(mp4|mkv|avi|mov|wmv|flv|ts|m2ts|mts|webm|m4v|mpg|mpeg|ogv|3gp|vob|divx)$/i

  // One line-icon set for everything the script adds. Native TorrServer
  // buttons keep their own icons; these replace the cloned Material glyphs.
  const ICONS = {
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    clipboard:
      '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    squareCheck: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    folder:
      '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    shieldCheck: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff:
      '<path d="m2 2 20 20"/><path d="M6.71 6.71C3.7 8.64 2 12 2 12s3 7 10 7c2.1 0 3.87-.72 5.29-1.71"/><path d="M10.58 10.58a2 2 0 0 0 2.84 2.84"/><path d="M9.88 4.24A10.94 10.94 0 0 1 12 4c7 0 10 7 10 7a18.5 18.5 0 0 1-3.05 4.19"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    refresh: '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    users:
      '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    download:
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/>',
    alert:
      '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    loader: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
    list: '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>',
  }

  const tsIcon = (name, cls) =>
    `<svg class="ts-icon${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.list}</svg>`

  const LINK_ICON = tsIcon('link')
  const FLASH_ICON = tsIcon('zap')
  const PLAY_ICON = tsIcon('play')

  const css = document.createElement('style')
  css.textContent = `
    .ts-icon { width: 16px; height: 16px; flex: none; }
    .ts-card-copy .ts-icon, .ts-card-mpv .ts-icon { width: 18px; height: 18px; }
    #ts-fab .ts-icon { width: 26px; height: 26px; }
    #ts-paste-fab .ts-icon { width: 24px; height: 24px; }
    .ts-dialog-copy { color: ${ACCENT} !important; border-color: ${ACCENT} !important; }
    .ts-dialog-copy:hover { border-color: ${ACCENT} !important; background: ${ACCENT_HOVER_BG} !important; }
    .ts-card-copy { background: ${ACCENT} !important; color: #1a1a1a !important; }
    .ts-card-copy:hover { filter: brightness(1.15); }
    .ts-card-mpv { background: ${MPV_ACCENT} !important; color: #f1eff3 !important; }
    .ts-card-mpv:hover { filter: brightness(1.08); }
    .ts-mpv-link button { color: ${MPV_ACCENT_LIGHT} !important; border-color: ${MPV_ACCENT_LIGHT} !important; }
    .ts-mpv-link button:hover { background: rgba(201, 131, 205, 0.15) !important; }
    #ts-mpv-menu {
      position: fixed; z-index: 3000;
      width: min(420px, calc(100vw - 24px));
      background: #323637; color: #f1eff3; border-radius: 8px; padding: 8px;
      box-shadow: 0 11px 15px -7px rgba(0,0,0,.2), 0 24px 38px 3px rgba(0,0,0,.14);
      max-height: 65vh; overflow-y: auto; min-width: 340px; max-width: 60vw;
    }
    #ts-mpv-menu .ts-mpv-item { display: flex; justify-content: space-between; align-items: center; gap: 14px; padding: 8px 10px; border-radius: 5px; cursor: pointer; font-size: 13px; }
    #ts-mpv-menu .ts-mpv-item:hover { background: #545a5e; }
    #ts-mpv-menu .ts-mpv-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #ts-mpv-menu .ts-mpv-size { color: #dee3e5; font-size: 11px; white-space: nowrap; }
    @media (max-width: 1260px), (max-height: 500px) {
      .ts-has-copy { grid-template-columns: repeat(auto-fit, minmax(0, 1fr)) !important; }
    }
    @media (min-width: 1261px) and (min-height: 501px) {
      div:has(> .ts-has-copy) { grid-template-rows: auto !important; }
    }
    #tsqa-overlay { position: fixed; inset: 0; z-index: 3000; background: rgba(0, 0, 0, 0.55); display: flex; align-items: center; justify-content: center; }
    .tsqa-panel {
      background: #323637; color: #f1eff3; border-radius: 8px; padding: 20px;
      width: min(540px, calc(100vw - 40px));
      box-shadow: 0 11px 15px -7px rgba(0,0,0,.2), 0 24px 38px 3px rgba(0,0,0,.14), 0 9px 46px 8px rgba(0,0,0,.12);
      font-family: Roboto, sans-serif;
    }
    .tsqa-title { font-size: 15px; font-weight: 600; letter-spacing: .3px; margin-bottom: 12px; text-transform: uppercase; display: flex; align-items: center; gap: 8px; }
    .tsqa-title .ts-icon { width: 18px; height: 18px; color: ${ACCENT}; }
    .tsqa-row button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
    .tsqa-row button .ts-icon { width: 14px; height: 14px; }
    .tsqa-textarea { width: 100%; box-sizing: border-box; min-height: 110px; background: #545a5e; color: #f1eff3; border: 1px solid #656f76; border-radius: 5px; padding: 10px; font-size: 13px; line-height: 1.4; resize: vertical; outline: none; }
    .tsqa-textarea:focus { border-color: ${ACCENT}; }
    .tsqa-info { font-size: 12px; color: #dee3e5; margin: 8px 2px 10px; min-height: 15px; }
    .tsqa-info.tsqa-error { color: #ff8a93; }
    .tsqa-auto { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #dee3e5; margin: 0 2px 12px; cursor: pointer; user-select: none; }
    .tsqa-auto input { accent-color: ${ACCENT}; cursor: pointer; }
    .tsqa-row { display: flex; gap: 10px; justify-content: flex-end; }
    .tsqa-row button { border: none; border-radius: 5px; padding: 9px 20px; cursor: pointer; text-transform: uppercase; font-size: 12px; font-weight: 600; letter-spacing: .4px; }
    .tsqa-row button:disabled { opacity: .6; cursor: wait; }
    .tsqa-paste, .tsqa-clear { background: #545a5e; color: #f1eff3; }
    .tsqa-paste { margin-right: auto; }
    .tsqa-paste:hover, .tsqa-clear:hover { filter: brightness(1.15); }
    .tsqa-add { background: ${ACCENT}; color: #1a1a1a; }
    .tsqa-cancel { background: transparent; color: #dee3e5; border: 1px solid #656f76 !important; }
    .tsqa-toast { position: fixed; right: 24px; bottom: 168px; z-index: 3001; background: ${ACCENT}; color: #1a1a1a; padding: 12px 18px; border-radius: 5px; font-size: 13px; box-shadow: 0 4px 10px rgba(0,0,0,.3); }
    .tsqa-toast-error { background: #c82e3f; color: #fff; }
    .ts-quick-add [class*="MuiListItemIcon"],
    .ts-quick-add [class*="MuiListItemText"] { color: ${ACCENT} !important; }
    #ts-fab {
      position: fixed; right: 28px; bottom: 28px; z-index: 2500;
      width: 56px; height: 56px; border-radius: 50%;
      background: ${ACCENT}; color: #1a1a1a; border: none; cursor: pointer;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.15s ease, filter 0.15s ease;
    }
    #ts-fab:hover { transform: scale(1.07); filter: brightness(1.1); }
    #ts-fab svg { width: 28px; height: 28px; }
    #ts-fab .ts-fab-badge { position: absolute; top: 4px; right: 4px; width: 13px; height: 13px; border-radius: 50%; background: #fff; border: 2px solid #323637; display: none; }
    #ts-paste-fab {
      position: fixed; right: 28px; bottom: 96px; z-index: 2500;
      width: 56px; height: 56px; border-radius: 50%;
      background: #323637; color: ${ACCENT};
      border: 2px solid ${ACCENT}; cursor: pointer;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
      display: flex; align-items: center; justify-content: center;
      opacity: 0.8;
      transition: transform 0.15s ease, filter 0.15s ease, background 0.2s ease, color 0.2s ease;
    }
    #ts-paste-fab:hover { transform: scale(1.07); filter: brightness(1.1); opacity: 1; }
    #ts-paste-fab.ts-armed { background: ${ACCENT}; color: #1a1a1a; opacity: 1; }
    #ts-paste-fab.ts-busy { pointer-events: none; opacity: 0.6; }
    #ts-paste-fab svg { width: 26px; height: 26px; }
    body:has(.MuiDialog-root) #ts-fab,
    body:has(.MuiDialog-root) #ts-paste-fab {
      opacity: 0; visibility: hidden; pointer-events: none; transform: scale(0.9);
    }
    #ts-mpv-menu .ts-mpv-dir { padding: 7px 10px 2px; font-size: 10px; letter-spacing: .5px; text-transform: uppercase; color: #9aa5a8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .MuiDialog-paper.ts-has-tree { flex-direction: row !important; overflow: hidden !important; position: relative; padding-top: var(--tsft-head-h, 0px); }
    .MuiDialog-paper.ts-has-tree > .MuiAppBar-root { position: absolute !important; top: 0; left: 0; right: 0; z-index: 1100; }
    .MuiDialog-paper.ts-has-tree > :not(.ts-file-tree) { min-width: 0; flex: 1 1 auto; }
    .ts-file-tree {
      order: -1; position: relative; flex: 0 0 auto;
      display: flex; flex-direction: column;
      width: clamp(280px, 32vw, 440px); min-width: 240px; min-height: 0;
      background: rgba(0,0,0,0.2);
      border-right: 1px solid rgba(255,255,255,0.14);
      padding: 10px 0 8px;
    }
    .tsft-head { display: flex; align-items: center; gap: 8px; padding: 0 12px 6px 14px; flex: none; }
    .tsft-title { font-size: 12px; font-weight: 600; letter-spacing: .4px; text-transform: uppercase; color: #dee3e5; }
    .tsft-info { font-size: 11px; color: #9aa5a8; min-width: 0; }
    .tsft-sub { display: flex; align-items: center; gap: 6px; padding: 0 12px 7px 14px; min-width: 0; }
    .tsft-sub[hidden] { display: none; }
    .tsft-sub .tsft-info { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tsft-tools { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; padding: 0 12px 8px 14px; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .tsft-tools .tsft-toggle, .tsft-tools .tsft-mini { margin-left: 0; }
    .tsft-toggle { margin-left: auto; background: transparent; border: 1px solid #656f76; color: #dee3e5; border-radius: 12px; padding: 2px 10px; font-size: 11px; cursor: pointer; }
    .tsft-toggle.tsft-on { border-color: ${ACCENT}; color: ${ACCENT}; background: ${ACCENT_HOVER_BG}; }
    .tsft-mini { background: transparent; border: none; color: #9aa5a8; font-size: 11px; cursor: pointer; padding: 2px 5px; border-radius: 4px; }
    .tsft-mini:hover { color: ${ACCENT}; background: rgba(255,255,255,0.08); }
    .tsft-rows { flex: 1 1 auto; min-height: 0; overflow-y: auto; margin: 0; padding: 0 10px 0 8px; }
    .tsft-row { display: flex; align-items: center; gap: 6px; min-width: 0; padding: 5px 8px; border-radius: 5px; font-size: 13px; line-height: 1.5; }
    .tsft-row:hover { background: rgba(255,255,255,0.06); }
    .tsft-row.tsft-dir { cursor: pointer; font-weight: 600; }
    .tsft-caret { width: 14px; height: 14px; flex: none; color: #9aa5a8; transition: transform 0.12s ease; }
    .tsft-row.tsft-collapsed .tsft-caret { transform: rotate(-90deg); }
    .tsft-caret-spacer { width: 14px; flex: none; }
    .tsft-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #f1eff3; text-decoration: none; }
    a.tsft-name:hover { color: ${ACCENT}; text-decoration: none; }
    .tsft-other .tsft-name { color: #9aa5a8; }
    .tsft-count, .tsft-size { color: #9aa5a8; font-size: 11px; white-space: nowrap; }
    .tsft-actions { display: flex; gap: 2px; }
    .tsft-act { width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: none; border-radius: 4px; background: transparent; color: #9aa5a8; cursor: pointer; }
    .tsft-act svg { width: 15px; height: 15px; }
    .tsft-act:hover { color: ${ACCENT}; background: rgba(255,255,255,0.08); text-decoration: none; }
    .tsft-act.tsft-done { color: ${ACCENT}; }
    .tsft-empty { padding: 4px 8px; font-size: 12px; color: #9aa5a8; }
    .tsft-resizer { position: absolute; top: 0; right: -3px; width: 7px; height: 100%; cursor: col-resize; z-index: 2; }
    .tsft-resizer:hover { background: rgba(255,255,255,0.08); }
    @media (max-width: 1280px) {
      .MuiDialog-paper.ts-has-tree { flex-direction: column !important; overflow: auto !important; }
      .ts-file-tree { order: 0; width: auto !important; max-height: 48vh; border-right: none; border-top: 1px solid rgba(255,255,255,0.14); }
      .tsft-rows { flex: 0 1 auto; max-height: 38vh; }
      .tsft-resizer { display: none; }
    }
    .tsft-resume { background: ${ACCENT} !important; border-color: ${ACCENT} !important; color: #1a1a1a !important; font-weight: 600; }
    .tsft-resume:hover { filter: brightness(1.1); background: ${ACCENT} !important; }
    .tsft-viewed > .tsft-name { color: #7f8c8f; }
    a.tsft-viewed > .tsft-name, .tsft-viewed a.tsft-name { color: #8b9a9d; }
    .tsft-viewed .tsft-name::before { content: '✓ '; color: ${ACCENT}; font-weight: 700; }
    .tsft-check.tsft-on { color: ${ACCENT}; }
    .tsft-row.tsft-season { background: rgba(123, 227, 195, 0.09); font-weight: 600; margin-top: 3px; border-left: 2px solid ${ACCENT}; }
    .tsft-row.tsft-season:hover { background: rgba(123, 227, 195, 0.16); }
    .tsft-row.tsft-season .tsft-name { color: ${ACCENT}; }
    .tsft-row.tsft-season.tsft-allviewed .tsft-name::before { content: '✓ '; font-weight: 700; }
    .tsft-row.tsft-season.tsft-partviewed .tsft-name::after { content: ' ◐'; color: ${ACCENT}; font-weight: 700; }
    .tsft-prog { color: #9aa5a8; font-size: 11px; white-space: nowrap; }
    .tsft-row.tsft-picked { background: rgba(123, 227, 195, 0.16); }
    .tsft-pick { width: 22px; height: 22px; flex: none; padding: 0; border: 1px solid #656f76; border-radius: 4px; background: transparent; cursor: pointer; color: transparent; display: inline-flex; align-items: center; justify-content: center; }
    .tsft-pick svg { width: 15px; height: 15px; }
    .tsft-pick:hover { border-color: ${ACCENT}; }
    .tsft-pick.tsft-on { background: ${ACCENT}; border-color: ${ACCENT}; color: #1a1a1a; }
    .tsft-pick-spacer { width: 22px; flex: none; }
    .tsft-selbar { display: none; align-items: center; gap: 8px; flex-wrap: wrap; padding: 6px 12px 8px 14px; border-bottom: 1px solid rgba(255,255,255,0.1); flex: none; }
    .tsft-selbar.tsft-show { display: flex; }
    .tsft-selinfo { font-size: 11px; color: ${ACCENT}; font-weight: 600; letter-spacing: .3px; }
    .tsft-selbtn { background: #545a5e; color: #f1eff3; border: none; border-radius: 12px; padding: 3px 11px; font-size: 11px; cursor: pointer; }
    .tsft-selbtn:hover { filter: brightness(1.15); }
    .tsft-selbtn.tsft-primary { background: ${ACCENT}; color: #1a1a1a; font-weight: 600; }
    .tsft-selbtn.tsft-mpv { background: ${MPV_ACCENT}; color: #f1eff3; }
    .tsft-selbtn:disabled { opacity: .5; cursor: default; }
    .tsft-selbtn.tsft-done { background: ${ACCENT}; color: #1a1a1a; }
    #ts-watch-shelf { margin: 4px 0 18px; grid-column: 1 / -1; width: 100%; min-width: 0; flex-basis: 100%; }
    .tsws-head { display: flex; align-items: center; gap: 10px; padding: 0 2px 10px; color: #1e2b29; font-size: 16px; font-weight: 600; }
    .tsws-head .tsws-min { margin-left: auto; background: transparent; border: none; color: #5f6f6d; cursor: pointer; font-size: 15px; line-height: 1; padding: 3px 9px; border-radius: 4px; }
    .tsws-head .tsws-min:hover { color: #1e2b29; background: rgba(0,0,0,0.08); }
    .tsws-head .ts-icon { width: 17px; height: 17px; color: #0f8f74; }
    .tsws-head .tsws-min .ts-icon { width: 14px; height: 14px; color: inherit; }
    #ts-watch-shelf.tsws-collapsed .tsws-row { display: none; }
    .tsws-row { display: flex; gap: 12px; overflow-x: auto; padding: 2px 2px 8px; }
    .tsws-card { flex: 0 0 330px; display: flex; gap: 12px; background: #323637; border-radius: 8px; padding: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.25); }
    .tsws-poster { width: 62px; height: 93px; flex: none; object-fit: cover; border-radius: 4px; background: #242728; }
    .tsws-noposter { width: 62px; height: 93px; flex: none; border-radius: 4px; background: linear-gradient(135deg, #3c4346, #242728); }
    .tsws-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .tsws-title { font-size: 13px; font-weight: 600; color: #f1eff3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tsws-sub { font-size: 12px; color: #9aa5a8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 3px; }
    .tsws-actions { margin-top: auto; display: flex; gap: 6px; padding-top: 8px; }
    .tsws-btn { font-size: 11px; font-weight: 600; letter-spacing: .3px; padding: 5px 12px; border-radius: 4px; text-decoration: none !important; text-transform: uppercase; }
    .tsws-resume { background: ${ACCENT}; color: #1a1a1a; }
    .tsws-resume:hover { filter: brightness(1.1); }
    .tsws-playbtn { background: #545a5e; color: #f1eff3; }
    .tsws-playbtn:hover { filter: brightness(1.15); }
    .tsws-btn .ts-icon { width: 13px; height: 13px; }

    /* card buttons: line icons that sit happily beside the native MUI buttons */
    .ts-card-copy, .ts-card-mpv { display: inline-flex !important; align-items: center; gap: 6px; }
    .ts-card-copy .ts-icon, .ts-card-mpv .ts-icon { width: 17px; height: 17px; }
    .ts-card-copy:active, .ts-card-mpv:active { transform: translateY(1px); }
    .ts-card-copy:focus-visible, .ts-card-mpv:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }

    /* cursor episode menu */
    #ts-mpv-menu {
      background: #242728; color: #f1eff3; border: 1px solid rgba(255,255,255,0.14);
      border-radius: 10px; padding: 6px; box-shadow: 0 14px 40px rgba(0,0,0,0.45);
      max-height: min(65vh, 520px); overflow-y: auto;
    }
    #ts-mpv-menu .ts-mpv-dir { display: flex; align-items: center; gap: 6px; }
    #ts-mpv-menu .ts-mpv-dir > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #ts-mpv-menu .ts-mpv-dir .ts-icon { width: 12px; height: 12px; color: #7be3c3; }
    #ts-mpv-menu .ts-mpv-item { border-radius: 6px; }
    #ts-mpv-menu .ts-mpv-item:hover { background: rgba(123,227,195,0.14); }
    #ts-mpv-menu .ts-mpv-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* details tree controls */
    .tsft-tools .tsft-toggle, .tsft-tools .tsft-mini {
      display: inline-flex; align-items: center; gap: 4px; min-height: 24px;
    }
    .tsft-tools .tsft-toggle.tsft-icon { padding: 3px 7px; }
    .tsft-tools .tsft-toggle .ts-icon { width: 12px; height: 12px; }
    .tsft-act, .tsft-mini, .tsft-toggle, .tsft-selbtn, .tsft-pick { transition: background .16s ease, color .16s ease, border-color .16s ease, transform .12s ease; }
    .tsft-act:active, .tsft-mini:active, .tsft-toggle:active, .tsft-selbtn:active { transform: translateY(1px); }
    .tsft-act:focus-visible, .tsft-mini:focus-visible, .tsft-toggle:focus-visible, .tsft-selbtn:focus-visible, .tsft-pick:focus-visible { outline: 2px solid #7be3c3; outline-offset: 1px; }

    /* launcher */
    #ts-launcher {
      position: fixed; right: 20px; bottom: 224px; z-index: 3000; width: 360px;
      display: flex; gap: 10px; box-sizing: border-box;
      background: #242728; color: #f1eff3; border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px; padding: 12px; box-shadow: 0 18px 48px rgba(0,0,0,0.45);
      animation: ts-launcher-in .2s ease-out;
    }
    @keyframes ts-launcher-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
    #ts-launcher .tsl-poster { width: 46px; height: 69px; flex: none; object-fit: cover; border-radius: 6px; background: #323637; }
    #ts-launcher .tsl-body { flex: 1; min-width: 0; }
    #ts-launcher .tsl-head { display: flex; align-items: flex-start; gap: 8px; }
    #ts-launcher .tsl-title { flex: 1; min-width: 0; font-size: 13px; font-weight: 600; line-height: 1.35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #ts-launcher .tsl-close { width: 24px; height: 24px; flex: none; border: 0; border-radius: 6px; background: transparent; color: #9aa5a8; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
    #ts-launcher .tsl-close:hover { background: rgba(255,255,255,0.08); color: #f1eff3; }
    #ts-launcher .tsl-close .ts-icon { width: 14px; height: 14px; }
    #ts-launcher .tsl-status { display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 12px; color: #9aa5a8; }
    #ts-launcher .tsl-status .ts-icon { width: 13px; height: 13px; flex: none; }
    #ts-launcher .tsl-status.is-ok { color: #7be3c3; }
    #ts-launcher .tsl-status.is-warn { color: #f1c40f; }
    #ts-launcher .tsl-spin { animation: ts-spin 1s linear infinite; }
    @keyframes ts-spin { to { transform: rotate(360deg); } }
    #ts-launcher .tsl-bar { height: 4px; border-radius: 2px; background: #3a4042; overflow: hidden; margin-top: 7px; }
    #ts-launcher .tsl-bar span { display: block; height: 100%; width: 34%; border-radius: 2px; background: #7be3c3; animation: ts-bar 1.4s ease-in-out infinite; }
    #ts-launcher .tsl-bar.is-done span { width: 100%; animation: none; }
    @keyframes ts-bar { 0% { transform: translateX(-120%); } 50% { transform: translateX(120%); } 100% { transform: translateX(320%); } }
    #ts-launcher .tsl-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 6px; font-size: 11px; color: #9aa5a8; }
    #ts-launcher .tsl-meta span { display: inline-flex; align-items: center; gap: 4px; }
    #ts-launcher .tsl-meta .ts-icon { width: 12px; height: 12px; }
    #ts-launcher .tsl-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 9px; }
    #ts-launcher .tsl-btn { height: 28px; padding: 0 9px; display: inline-flex; align-items: center; gap: 5px; border: 1px solid #545a5e; border-radius: 6px; background: transparent; color: #f1eff3; font-size: 11px; font-weight: 600; cursor: pointer; }
    #ts-launcher .tsl-btn:hover { background: rgba(255,255,255,0.08); border-color: #7be3c3; }
    #ts-launcher .tsl-btn .ts-icon { width: 13px; height: 13px; }
    #ts-launcher .tsl-hint { margin-top: 7px; font-size: 11px; line-height: 1.45; color: #f1c40f; }
    @media (max-width: 760px) {
      #ts-launcher { left: 12px; right: 12px; bottom: 216px; width: auto; }
      #ts-launcher .tsl-poster { display: none; }
    }

    /* privacy panel */
    #ts-privacy-scrim { position: fixed; inset: 0; z-index: 4000; background: rgba(0,0,0,0.58); display: flex; align-items: center; justify-content: center; padding: 20px; }
    #ts-privacy-panel { width: min(440px, 100%); background: #242728; color: #f1eff3; border: 1px solid rgba(255,255,255,0.14); border-radius: 12px; box-shadow: 0 24px 70px rgba(0,0,0,0.55); padding: 18px; animation: ts-launcher-in .2s ease-out; }
    #ts-privacy-panel h2 { margin: 0; font-size: 16px; font-weight: 650; display: flex; align-items: center; gap: 8px; }
    #ts-privacy-panel h2 .ts-icon { width: 19px; height: 19px; color: #7be3c3; }
    #ts-privacy-panel .tspv-sub { margin: 6px 0 14px; color: #9aa5a8; font-size: 12px; line-height: 1.5; }
    #ts-privacy-panel .tspv-toggle { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 12px; background: #323637; border-radius: 8px; margin-bottom: 12px; }
    #ts-privacy-panel .tspv-toggle b { display: block; font-size: 13px; }
    #ts-privacy-panel .tspv-toggle small { color: #9aa5a8; font-size: 11px; }
    #ts-privacy-panel .tspv-switch { position: relative; width: 42px; height: 24px; flex: none; border: 0; border-radius: 999px; background: #545a5e; cursor: pointer; }
    #ts-privacy-panel .tspv-switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #f1eff3; transition: transform .18s ease; }
    #ts-privacy-panel .tspv-switch[aria-checked="true"] { background: #7be3c3; }
    #ts-privacy-panel .tspv-switch[aria-checked="true"]::after { transform: translateX(18px); background: #1a1a1a; }
    #ts-privacy-panel .tspv-state { color: #7be3c3; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; margin-left: 4px; }
    #ts-privacy-panel code { background: #1b1e1f; color: #dee3e5; padding: 1px 4px; border-radius: 3px; font-size: 11px; }
    #ts-privacy-panel .tspv-switch:focus-visible, #ts-privacy-panel .tspv-btn:focus-visible, #ts-shield-fab:focus-visible { outline: 2px solid #7be3c3; outline-offset: 2px; }
    #ts-privacy-panel ul { margin: 0 0 14px; padding: 0; list-style: none; display: grid; gap: 8px; }
    #ts-privacy-panel li { display: flex; gap: 8px; font-size: 12px; line-height: 1.45; color: #dee3e5; }
    #ts-privacy-panel li .ts-icon { width: 14px; height: 14px; color: #7be3c3; margin-top: 2px; flex: none; }
    #ts-privacy-panel .tspv-note { padding: 9px 10px; border-radius: 7px; background: rgba(241,196,15,0.1); color: #f1c40f; font-size: 11px; line-height: 1.45; margin-bottom: 14px; }
    #ts-privacy-panel .tspv-actions { display: flex; justify-content: flex-end; gap: 8px; }
    #ts-privacy-panel .tspv-btn { height: 32px; padding: 0 13px; border: 1px solid #545a5e; border-radius: 6px; background: transparent; color: #f1eff3; font-size: 12px; font-weight: 600; cursor: pointer; }
    #ts-privacy-panel .tspv-btn:hover { background: rgba(255,255,255,0.08); }
    #ts-privacy-panel .tspv-btn.is-primary { background: #7be3c3; border-color: #7be3c3; color: #1a1a1a; }
    #ts-privacy-panel .tspv-btn.is-primary:hover { filter: brightness(1.08); background: #7be3c3; }
    #ts-shield-fab { position: fixed; right: 24px; bottom: 160px; z-index: 3001; width: 48px; height: 48px; border: 1px solid rgba(255,255,255,0.16); border-radius: 50%; background: #323637; color: #dee3e5; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 3px 10px rgba(0,0,0,0.3); opacity: 0.92; transition: transform .15s ease, background .2s ease, color .2s ease, opacity .2s ease; }
    #ts-shield-fab:hover { transform: scale(1.07); opacity: 1; }
    #ts-shield-fab .ts-icon { width: 23px; height: 23px; }
    #ts-shield-fab.ts-on { background: #7be3c3; border-color: #7be3c3; color: #1a1a1a; }
    body:has(.MuiDialog-root) #ts-shield-fab { opacity: 0; visibility: hidden; pointer-events: none; }
    @media (max-width: 760px) { #ts-shield-fab { bottom: 152px; right: 16px; width: 44px; height: 44px; } }
    @media (prefers-reduced-motion: reduce) {
      #ts-launcher, #ts-privacy-panel { animation: none; }
      #ts-launcher .tsl-spin, #ts-launcher .tsl-bar span { animation: none; }
    }
  `

  const FIBER_KEY_RE = /^__react(Fiber|InternalInstance)\$/
  const findTorrent = el => {
    const key = Object.keys(el).find(k => FIBER_KEY_RE.test(k))
    if (!key) return null
    for (let f = el[key]; f; f = f.return) {
      const t = f.memoizedProps && f.memoizedProps.torrent
      if (t && t.hash) return t
    }
    return null
  }

  const splitPath = p => String(p).split(/[\\/]+/).filter(Boolean)
  const basename = p => p.split('\\').pop().split('/').pop()
  const dirOfPath = p => splitPath(p).slice(0, -1).join('/')
  const NATURAL_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
  const filesFromData = data => {
    const text = String(data || '')
    if (!text) return []
    let parsed = null
    try {
      parsed = JSON.parse(text)
    } catch (_) {
      // some server builds ship the payload base64-encoded
      try {
        const bin = atob(text)
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        parsed = JSON.parse(new TextDecoder('utf-8').decode(bytes))
      } catch (_) {
        return []
      }
    }
    if (!parsed) return []
    const files = Array.isArray(parsed) ? parsed : (parsed.TorrServer && parsed.TorrServer.Files) || parsed.Files
    return Array.isArray(files) ? files : []
  }
  const filesOfStats = st => (st.file_stats && st.file_stats.length ? st.file_stats : filesFromData(st.data)) || []
  const getPlayableFiles = torrent => filesOfStats(torrent).filter(f => VIDEO_EXT.test(f.path || ''))
  const streamUrl = (hash, f) =>
    `${window.location.origin}/stream/${encodeURIComponent(basename(f.path))}?link=${hash}&index=${f.id}&play`
  const directLink = (torrent, f) => streamUrl(torrent.hash, f)
  const playlistLink = torrent => {
    const label = torrent.title || torrent.name || 'file'
    return `${window.location.origin}/stream/${encodeURIComponent(label)}.m3u?link=${torrent.hash}&m3u`
  }

  const toB64Url = s =>
    btoa(unescape(encodeURIComponent(s)))
      .replace(/\//g, '_')
      .replace(/\+/g, '-')
      .replace(/=+$/, '')
  const mpvLink = (url, startAt) => {
    if (MPV_SCHEME === 'raw') return `mpv://${url}`
    const data = toB64Url(url)
    const seconds = Number(startAt)
    const seek = Number.isFinite(seconds) && seconds > 1 ? `/?startat=${Math.floor(seconds)}` : ''
    return MPV_SCHEME === 'legacy' ? `mpv://play/${data}` : `mpv-handler://play/${data}${seek}`
  }

  // ---- client-built playlists ----
  // The server's own m3u endpoint can only start at an offset (index=N sets `from`, then it emits every
  // file after that), so it cannot express "just this season" or an arbitrary picked set. We therefore
  // build the m3u here and hand it to mpv as a data:// URI, which mpv plays exactly like a local .m3u.
  // The stream filename is ignored by the server -- only `index` selects the file -- so a short
  // placeholder name keeps the encoded URL small enough for the OS command-line limit.
  const streamUrlAt = (hash, id) => `${window.location.origin}/stream/x?link=${hash}&index=${id}&play`

  const buildM3u = (hash, files, withNames) => {
    const lines = ['#EXTM3U']
    for (const f of files) {
      if (withNames) lines.push('#EXTINF:-1,' + basename(f.path).replace(/[\r\n]+/g, ' '))
      lines.push(streamUrlAt(hash, f.id))
    }
    return lines.join('\n') + '\n'
  }

  const m3uDataUrl = text => 'data://application/x-mpegurl;base64,' + btoa(unescape(encodeURIComponent(text)))

  // Windows caps a command line at 32767 chars; the handler's own protocol URL is what gets passed,
  // so measure that. Names are dropped first because they are the bulk and are purely cosmetic.
  const MPV_URL_MAX = 30000
  const playlistFor = (hash, files) => {
    if (!files.length) return null
    let url = m3uDataUrl(buildM3u(hash, files, true))
    if (mpvLink(url).length <= MPV_URL_MAX) return { dataUrl: url, withNames: true, dropped: 0 }
    url = m3uDataUrl(buildM3u(hash, files, false))
    if (mpvLink(url).length <= MPV_URL_MAX) return { dataUrl: url, withNames: false, dropped: 0 }
    // still too long: take as many leading entries as fit and tell the caller what was left out
    let fit = 0
    for (let n = files.length; n >= 1; n--) {
      const candidate = m3uDataUrl(buildM3u(hash, files.slice(0, n), false))
      if (mpvLink(candidate).length <= MPV_URL_MAX) {
        fit = n
        url = candidate
        break
      }
    }
    if (!fit) return null
    return { dataUrl: url, withNames: false, dropped: files.length - fit, playable: files.slice(0, fit) }
  }

  const legacyCopy = text => {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch (_) {}
    ta.remove()
    return ok
  }
  const copyText = text => {
    if (typeof GM_setClipboard === 'function') {
      GM_setClipboard(text)
      return true
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(() => legacyCopy(text))
      return true
    }
    return legacyCopy(text)
  }

  const isCardButtonsRow = el => {
    const btns = Array.from(el.children).filter(c => c.tagName === 'BUTTON')
    if (btns.length < 3) return false
    const first = btns[0]
    if (!first.querySelector(':scope > svg') || !first.querySelector(':scope > span')) return false
    return !!findTorrent(el)
  }

  const addCardButton = row => {
    const detailsBtn = row.querySelector('button')
    if (!detailsBtn) return
    const torrent = findTorrent(row)
    if (!torrent) return

    const btn = detailsBtn.cloneNode(true)
    btn.classList.add('ts-card-copy')
    btn.removeAttribute('title')
    btn.innerHTML = `${LINK_ICON}<span>Copy link</span>`
    btn.title = 'Left click: copy the playlist link · Right click: copy a specific episode'
    const flashCopy = spanEl => {
      if (!spanEl) return
      const orig = 'Copy link'
      return ok => {
        spanEl.textContent = ok ? 'Copied!' : 'Copy failed'
        setTimeout(() => {
          spanEl.textContent = orig
        }, 1200)
      }
    }
    btn.addEventListener('click', () => {
      const torrentNow = findTorrent(row)
      if (!torrentNow) return
      const ok = copyText(playlistLink(torrentNow))
      flashCopy(btn.querySelector('span'))(ok)
    })
    btn.addEventListener('contextmenu', e => {
      e.preventDefault()
      const torrentNow = findTorrent(row)
      if (!torrentNow) return
      const files = getPlayableFiles(torrentNow)
      if (!files.length) return
      openFileMenu(
        btn,
        () => findTorrent(row),
        files,
        (f, t) => {
          const link = directLink(t || torrentNow, f)
          flashCopy(btn.querySelector('span'))(copyText(link))
        },
        { x: e.clientX, y: e.clientY },
      )
    })
    row.insertBefore(btn, row.children[1])
    row.classList.add('ts-has-copy')

    addMpvButton(row)
  }

  const addMpvButton = row => {
    if (row.querySelector(':scope > .ts-card-mpv')) return
    const torrent = findTorrent(row)
    if (!torrent || !getPlayableFiles(torrent).length) return
    const detailsBtn = row.querySelector('button')
    if (!detailsBtn) return
    const mpvBtn = detailsBtn.cloneNode(true)
    mpvBtn.classList.add('ts-card-mpv')
    mpvBtn.removeAttribute('title')
    mpvBtn.innerHTML = `${PLAY_ICON}<span>MPV</span>`
    mpvBtn.title = 'Left click: play the playlist in MPV · Right click: pick an episode'
    mpvBtn.addEventListener('click', e => {
      e.stopPropagation()
      const torrentNow = findTorrent(row)
      if (!torrentNow) return
      const first = getPlayableFiles(torrentNow)[0]
      const playlist = playlistLink(torrentNow)
      startLaunch({
        url: playlist,
        copyUrl: playlist,
        prewarmUrl: first ? directLink(torrentNow, first) : '',
        hash: torrentNow.hash,
        fileId: first ? first.id : null,
        fileName: first ? basename(first.path) : '',
        title: torrentNow.title || torrentNow.name || 'Torrent',
        poster: torrentNow.poster || '',
      })
    })
    mpvBtn.addEventListener('mouseenter', () => {
      const torrentNow = findTorrent(row)
      const first = torrentNow && getPlayableFiles(torrentNow)[0]
      if (first) scheduleHoverPrewarm(directLink(torrentNow, first))
    })
    mpvBtn.addEventListener('mouseleave', cancelHoverPrewarm)
    mpvBtn.addEventListener('contextmenu', e => {
      e.preventDefault()
      e.stopPropagation()
      const torrentNow = findTorrent(row)
      if (!torrentNow) return
      const files = getPlayableFiles(torrentNow)
      if (!files.length) return
      openFileMenu(
        e.currentTarget,
        () => findTorrent(row),
        files,
        (f, t) => {
          const tt = t || torrentNow
          const link = directLink(tt, f)
          startLaunch({
            url: link,
            copyUrl: link,
            prewarmUrl: link,
            hash: tt.hash,
            fileId: f.id,
            fileName: basename(f.path),
            title: tt.title || tt.name || 'Torrent',
            poster: tt.poster || '',
          })
        },
        { x: e.clientX, y: e.clientY },
      )
    })
    row.insertBefore(mpvBtn, row.children[2])
  }

  const humanizeSize = n => {
    if (!n || n <= 0) return ''
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let v = n
    let i = 0
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024
      i++
    }
    return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`
  }

  // ---------------------------------------------------------------------------
  // fast MPV start: prewarm on hover, immediate launch feedback, live status
  // ---------------------------------------------------------------------------

  const warmCache = new Map()
  const warmFail = new Map()
  const warmInFlight = new Map()

  const formatSpeed = bps => {
    if (!bps || bps <= 0) return '0 B/s'
    return humanizeSize(bps) + '/s'
  }

  const prewarmRequest = (url, key, timeout, force) => {
    if (!url) return Promise.resolve({ ok: false })
    const cacheKey = key || `url:${url}`
    const now = Date.now()
    if (!force && warmFail.has(cacheKey) && now - warmFail.get(cacheKey) < 20000)
      return Promise.resolve({ ok: false, failed: true })
    if (!force && warmCache.has(cacheKey) && now - warmCache.get(cacheKey) < 120000)
      return Promise.resolve({ ok: true, cached: true, bytes: 0 })
    if (warmInFlight.has(cacheKey)) return warmInFlight.get(cacheKey)

    const promise = (async () => {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), timeout || 8000)
      const started = Date.now()
      try {
        const res = await fetch(url, {
          headers: { Range: 'bytes=0-262143' },
          signal: ctrl.signal,
          cache: 'no-store',
        })
        if (!res.ok && res.status !== 206) throw new Error('HTTP ' + res.status)
        let bytes = 0
        if (res.body && typeof res.body.getReader === 'function') {
          const reader = res.body.getReader()
          const chunk = await reader.read()
          bytes = chunk && chunk.value ? chunk.value.length : 0
          try {
            await reader.cancel()
          } catch (_) {}
        } else {
          bytes = (await res.arrayBuffer()).byteLength
        }
        warmCache.set(cacheKey, Date.now())
        warmFail.delete(cacheKey)
        return { ok: true, bytes, ms: Date.now() - started }
      } catch (e) {
        warmFail.set(cacheKey, Date.now())
        return { ok: false, error: e, ms: Date.now() - started }
      } finally {
        clearTimeout(timer)
        warmInFlight.delete(cacheKey)
      }
    })()
    warmInFlight.set(cacheKey, promise)
    return promise
  }

  let launchToken = 0
  let launcherEl = null

  const closeLauncher = () => {
    if (!launcherEl) return
    const el = launcherEl
    launcherEl = null
    if (el.__close) el.__close()
    else el.remove()
  }

  const openLauncher = opts => {
    closeLauncher()
    const token = ++launchToken
    const el = document.createElement('div')
    el.id = 'ts-launcher'
    el.setAttribute('role', 'status')
    el.setAttribute('aria-live', 'polite')
    el.innerHTML = `
      ${opts.poster && !privacyOn() ? '<img class="tsl-poster" alt="">' : ''}
      <div class="tsl-body">
        <div class="tsl-head">
          <div class="tsl-title"></div>
          <button class="tsl-close" type="button" aria-label="Close">${tsIcon('x')}</button>
        </div>
        <div class="tsl-status"><span data-icon>${tsIcon('loader', 'tsl-spin')}</span><span data-text>Opening MPV…</span></div>
        <div class="tsl-bar"><span></span></div>
        <div class="tsl-meta"></div>
        <div class="tsl-actions">
          <button class="tsl-btn" type="button" data-copy>${tsIcon('copy')} Copy link</button>
          <button class="tsl-btn" type="button" data-retry>${tsIcon('refresh')} Try again</button>
          <button class="tsl-btn" type="button" data-close>Close</button>
        </div>
        <div class="tsl-hint" hidden></div>
      </div>
    `
    const poster = el.querySelector('.tsl-poster')
    if (poster && opts.poster) poster.src = opts.poster
    el.querySelector('.tsl-title').textContent = opts.title || 'Torrent'
    document.body.appendChild(el)
    launcherEl = el

    const statusEl = el.querySelector('.tsl-status')
    const statusIcon = el.querySelector('[data-icon]')
    const statusText = el.querySelector('[data-text]')
    const bar = el.querySelector('.tsl-bar')
    const metaEl = el.querySelector('.tsl-meta')
    const hintEl = el.querySelector('.tsl-hint')
    const started = Date.now()
    let closed = false
    let succeeded = false
    let warmDone = false
    let peers = 0
    let speed = 0
    let pollTimer = null
    let elapsedTimer = null
    let hintTimer = null
    let autoCloseTimer = null

    const setStatus = (text, kind) => {
      statusText.textContent = text
      statusEl.classList.toggle('is-ok', kind === 'ok')
      statusEl.classList.toggle('is-warn', kind === 'warn')
      statusIcon.innerHTML =
        kind === 'ok' ? tsIcon('check') : kind === 'warn' ? tsIcon('alert') : tsIcon('loader', 'tsl-spin')
    }

    const renderMeta = () => {
      const seconds = Math.max(0, Math.round((Date.now() - started) / 1000))
      const parts = []
      if (peers) parts.push(`<span>${tsIcon('users')} ${peers} peers</span>`)
      if (speed) parts.push(`<span>${tsIcon('zap')} ${formatSpeed(speed)}</span>`)
      if (warmDone) parts.push(`<span>${tsIcon('download')} buffered</span>`)
      parts.push(`<span>${tsIcon('clock')} ${seconds}s</span>`)
      metaEl.innerHTML = parts.join('')
    }

    const close = () => {
      if (closed) return
      closed = true
      clearTimeout(pollTimer)
      clearInterval(elapsedTimer)
      clearTimeout(hintTimer)
      clearTimeout(autoCloseTimer)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('keydown', onKey)
      el.remove()
      if (launcherEl === el) launcherEl = null
    }

    const markSuccess = () => {
      if (closed || succeeded) return
      succeeded = true
      clearTimeout(hintTimer)
      setStatus('Sent to MPV', 'ok')
      bar.classList.add('is-done')
      hintEl.hidden = true
      clearTimeout(autoCloseTimer)
      autoCloseTimer = setTimeout(close, 4500)
    }

    const onBlur = () => markSuccess()
    const onVisibility = () => {
      if (document.hidden) markSuccess()
    }
    const onKey = e => {
      if (e.key === 'Escape') close()
    }

    el.querySelector('.tsl-close').addEventListener('click', close)
    el.querySelector('[data-close]').addEventListener('click', close)
    el.querySelector('[data-copy]').addEventListener('click', () => {
      const label = opts.copyUrl || opts.url
      const ok = copyText(label)
      toast(ok ? 'Stream link copied' : 'Copy failed', !ok)
    })
    el.querySelector('[data-retry]').addEventListener('click', () => {
      close()
      if (typeof opts.retry === 'function') opts.retry()
    })

    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('keydown', onKey)

    elapsedTimer = setInterval(() => {
      if (closed) return
      renderMeta()
      if (!succeeded && Date.now() - started > 5000 && document.visibilityState === 'visible' && document.hasFocus()) {
        setStatus('MPV is taking a while', 'warn')
        hintEl.hidden = false
        hintEl.textContent =
          'If no player opened, check that mpv-handler is installed and registered, then copy the stream link into your player.'
      }
    }, 750)

    hintTimer = setTimeout(() => {
      if (closed || succeeded) return
      if (document.visibilityState === 'visible' && document.hasFocus()) {
        setStatus('MPV is taking a while', 'warn')
        hintEl.hidden = false
        hintEl.textContent =
          'If no player opened, check that mpv-handler is installed and registered, then copy the stream link into your player.'
      }
    }, 6500)

    autoCloseTimer = setTimeout(close, 30000)
    renderMeta()

    const handle = {
      token,
      el,
      close,
      markSuccess,
      setPeers: (p, s) => {
        peers = p || 0
        speed = s || 0
        renderMeta()
      },
      setWarm: result => {
        warmDone = !!(result && result.ok)
        if (warmDone) bar.classList.add('is-done')
        renderMeta()
      },
    }
    el.__close = close
    return handle
  }

  const launchExternal = href => {
    const a = document.createElement('a')
    a.href = href
    a.rel = 'noopener'
    a.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0'
    document.body.appendChild(a)
    try {
      a.click()
      return true
    } catch (_) {
      try {
        window.location.href = href
        return true
      } catch (_) {
        return false
      }
    } finally {
      setTimeout(() => a.remove(), 1500)
    }
  }

  const startLaunch = opts => {
    const options = opts || {}
    if (!options.url) return null
    if (options.hash && options.fileId) {
      try {
        recordPlay(options.hash, options.fileId, options.fileName || '', options.title || '')
      } catch (_) {}
    }
    const launcher = openLauncher({
      title: options.title,
      poster: options.poster,
      url: options.url,
      copyUrl: options.copyUrl || options.url,
      retry: () => startLaunch(options),
    })
    launchExternal(mpvLink(options.url, options.startAt))
    if (options.prewarmUrl && !privacyOn()) {
      prewarmRequest(options.prewarmUrl, `url:${options.prewarmUrl}`, 9000, true).then(result => {
        if (launcherEl && launcherEl === launcher.el) launcher.setWarm(result)
      })
    }
    if (options.hash) {
      let tries = 0
      let pollTimer = null
      const poll = async () => {
        if (!launcherEl || launcherEl !== launcher.el) return
        tries++
        try {
          const r = await apiPost({ action: 'get', hash: options.hash }, 5000)
          if (r.ok) {
            const st = await r.json()
            if (launcherEl === launcher.el) {
              launcher.setPeers(st.total_peers || st.active_peers || 0, st.download_speed || 0)
            }
          }
        } catch (_) {}
        if (tries < 12 && launcherEl === launcher.el) pollTimer = setTimeout(poll, 1500)
      }
      pollTimer = setTimeout(poll, 300)
    }
    return launcher
  }

  // hover prewarm: warm the first file of the playlist before the click
  let hoverPrewarmTimer = null
  const scheduleHoverPrewarm = (url, delay) => {
    clearTimeout(hoverPrewarmTimer)
    if (!url || privacyOn()) return
    hoverPrewarmTimer = setTimeout(() => {
      prewarmRequest(url, `url:${url}`, 6500, false)
    }, delay == null ? 400 : delay)
  }
  const cancelHoverPrewarm = () => clearTimeout(hoverPrewarmTimer)


  let fileMenuEl = null
  const closeFileMenu = () => {
    if (fileMenuEl) {
      fileMenuEl.remove()
      fileMenuEl = null
    }
  }
  const openFileMenu = (anchor, getTorrent, files, onPick, at) => {
    closeFileMenu()
    const menu = document.createElement('div')
    menu.id = 'ts-mpv-menu'
    const groups = new Map()
    for (const f of files) {
      const dir = dirOfPath(f.path)
      if (!groups.has(dir)) groups.set(dir, [])
      groups.get(dir).push(f)
    }
    const singleRoot = groups.size === 1 && groups.has('')
    const dirs = Array.from(groups.keys()).sort((a, b) =>
      a === '' ? -1 : b === '' ? 1 : NATURAL_COLLATOR.compare(a, b),
    )
    for (const dir of dirs) {
      if (!singleRoot) {
        const head = document.createElement('div')
        head.className = 'ts-mpv-dir'
        head.innerHTML = `${tsIcon('folder')}<span></span>`
        head.querySelector('span').textContent = dir || 'root'
        head.title = dir || 'root'
        menu.appendChild(head)
      }
      const group = groups
        .get(dir)
        .slice()
        .sort((a, b) => NATURAL_COLLATOR.compare(basename(a.path), basename(b.path)))
      for (const f of group) {
        const item = document.createElement('div')
        item.className = 'ts-mpv-item'
        const name = document.createElement('span')
        name.className = 'ts-mpv-name'
        name.textContent = basename(f.path).replace(/\.[^.]+$/, '')
        name.title = f.path
        const size = document.createElement('span')
        size.className = 'ts-mpv-size'
        size.textContent = humanizeSize(f.length)
        item.appendChild(name)
        item.appendChild(size)
        item.addEventListener('click', () => {
          closeFileMenu()
          onPick(f, getTorrent())
        })
        menu.appendChild(item)
      }
    }
    document.body.appendChild(menu)
    fileMenuEl = menu
    const r = anchor.getBoundingClientRect()
    const mw = menu.offsetWidth || 420
    const mh = menu.offsetHeight || 240
    const pointerX = at && Number.isFinite(at.x) ? at.x : r.left
    const pointerY = at && Number.isFinite(at.y) ? at.y : r.bottom + 6
    const left = Math.max(8, Math.min(pointerX + 2, window.innerWidth - mw - 12))
    let top = pointerY + 2
    if (top + mh > window.innerHeight - 8) top = Math.max(8, pointerY - mh - 2)
    menu.style.left = left + 'px'
    menu.style.top = top + 'px'
    const onDocDown = e => {
      if (!menu.contains(e.target)) closeAll()
    }
    const onKey = e => {
      if (e.key === 'Escape') closeAll()
    }
    const closeAll = () => {
      closeFileMenu()
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
  }

  const isCopyLinkText = text => COPY_LINK_LABELS.includes((text || '').trim().toLowerCase())
  const markDialogCopyButtons = btn => {
    if (
      btn.classList.contains('ts-dialog-copy') ||
      btn.classList.contains('ts-card-copy') ||
      btn.classList.contains('ts-card-mpv')
    )
      return
    if (!/MuiButton/.test(btn.className)) return
    const label = (btn.querySelector('.MuiButton-label') || btn).textContent
    if (isCopyLinkText(label)) btn.classList.add('ts-dialog-copy')
  }

  const TRACKERS = [
    'udp://tracker.opentrackr.org:1337/announce',
    'http://tracker.opentrackr.org:1337/announce',
    'udp://open.demonii.com:1337/announce',
    'udp://open.stealth.si:80/announce',
    'udp://tracker.torrent.eu.org:451/announce',
    'udp://exodus.desync.com:6969/announce',
    'udp://tracker.ducks.party:1984/announce',
    'udp://tracker.qu.ax:6969/announce',
    'udp://tracker-udp.gbitt.info:80/announce',
    'https://tracker.bt4g.com:443/announce',
    'http://tracker.bt4g.com:2095/announce',
  ]
  const HASH_RE = /(?<![a-zA-Z0-9])[a-fA-F0-9]{40}(?![a-zA-Z0-9])/g
  const MAGNET_RE = /magnet:\?xt=urn:btih:[A-Za-z0-9]+[^\s]*/g
  const TORRENT_URL_RE = /https?:\/\/[^\s<>"']+\.torrent(?:\?[^\s<>"']*)?(?![a-z0-9])/gi

  const buildMagnet = hash => {
    if (privacyOn()) return `magnet:?xt=urn:btih:${hash.toLowerCase()}`
    return (
      `magnet:?xt=urn:btih:${hash.toLowerCase()}` +
      TRACKERS.map(t => `&tr=${encodeURIComponent(t)}`).join('')
    )
  }

  const completeMagnet = magnet => {
    if (privacyOn()) return String(magnet || '').replace(/&tr=[^&]*/gi, '')
    const missing = TRACKERS.filter(t => !magnet.toLowerCase().includes(t.toLowerCase()))
    return magnet + missing.map(t => `&tr=${encodeURIComponent(t)}`).join('')
  }

  const extractTorrentLinks = text => {
    const links = []
    let rest = String(text || '')
    for (const m of rest.match(MAGNET_RE) || []) links.push(completeMagnet(m.trim()))
    rest = rest.replace(MAGNET_RE, ' ')
    for (const m of rest.match(TORRENT_URL_RE) || []) links.push(m.trim())
    rest = rest.replace(TORRENT_URL_RE, ' ')
    const seen = new Set()
    const hashRe = new RegExp(HASH_RE.source, 'g')
    let match
    while ((match = hashRe.exec(rest)) !== null) {
      const hash = match[0].toLowerCase()
      if (!seen.has(hash)) {
        seen.add(hash)
        links.push(buildMagnet(hash))
      }
    }
    return links
  }

  const apiAdd = async link => {
    let r
    try {
      r = await apiPost({ action: 'add', link, save_to_db: !privacyOn() }, 30000)
    } catch (e) {
      throw new Error(
        isAbort(e) ? 'timeout: server did not respond; the add may still complete, re-paste the hash later' : e.message,
      )
    }
    if (!r.ok) {
      let msg = 'HTTP ' + r.status
      try {
        const j = await r.json()
        if (j && j.error) msg = j.error
      } catch (_) {}
      throw new Error(msg)
    }
    try {
      return await r.json()
    } catch (_) {
      return {}
    }
  }

  const toast = (text, isError) => {
    const el = document.createElement('div')
    el.className = 'tsqa-toast' + (isError ? ' tsqa-toast-error' : '')
    el.textContent = text
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 4000)
  }

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

  const RES_RE = /\b(2160p|1080p|720p|576p|480p)\b/i
  const YEAR_RE = /\b(19\d{2}|20\d{2})\b/
  const SE_RE = /\bS(\d{1,2})E(\d{1,3})\b/i
  const JUNK_TOKEN_RE =
    /^(?:season|complete|web|web-?dl|web-?rip|bluray|blu-?ray|bdrip|bdmv|bdremux|brrip|remux|dvd|dvdrip|hd-?dvd|hdtv|hdrip|hdr10?|dv|dolby|vision|atmos|x264|x265|h\.?264|h\.?265|hevc|avc|av1|aac|ac3|eac3|e-?ac-?3|dts(?:-?hd|-?ma|-?x)?|truehd|flac|mp3|opus|ddp|dd\+|10bit|8bit|hi10|multi|dual(?:audio)?|dubbed|subbed|subs?|proper|repack|extended|unrated|remastered|imax|yts(?:\.gg|\.bz|am)?|yify|eztv|rarbg|rartvx?|tgx|galaxyrg|mkvcage|psa|ettv|amzn|nf|atvp|dsnp|hmax|pmtp|stp|funi|crunchyroll|hidive|uhd|sdr|internal|limited|hybrid|ger|dub|german|eng|rus|jpn|ita|fre|spa|kor|chi)$/i
  const JUNK_TOKEN_PATTERNS = [/^s\d{1,2}(?:[-e]\d{1,3})+$/i, /^s\d{1,2}$/i, /^e\d{1,3}$/i, /^[\d.\-]+$/]
  const AUDIO_EXT = /\.(mp3|flac|m4a|m4b|aac|ogg|oga|opus|wav|wma|aiff?|alac|ape|wv|dsf|dff)$/i
  const MUSIC_NAME_RE =
    /\b(?:ost|original[ ._-]?soundtrack|soundtrack|discography|album|various[ ._-]?artists|flac|mp3|320[ ._-]?kbps|24-?bit|16-?bit|vinyl|mixtape|unplugged|concert)\b/i
  const SERIES_NAME_RE =
    /\b(?:S\d{1,2}[ ._-]?(?:E\d{1,3}|Complete)|\d{1,2}x\d{2}\b|(?:Complete|Full|Entire)[ ._-]+Seasons?|Seasons?[ ._-]*\d{1,2}\b|S\d{1,2}\b)/i

  const cleanTorrentName = raw => {
    if (!raw) return null
    let s = String(raw).replace(/\+/g, ' ').replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim()
    while (/^[[(][^\])]*[\])]\s*/.test(s)) s = s.replace(/^[[(][^\])]*[\])]\s*/, '')
    const yearM = s.match(YEAR_RE)
    const year = yearM ? yearM[1] : ''
    const resM = s.match(RES_RE)
    const res = resM ? resM[1].toLowerCase() : ''
    const seM = s.match(SE_RE)
    const se = seM ? `S${seM[1].padStart(2, '0')}E${seM[2].padStart(2, '0')}` : ''
    const out = []
    for (const tk of s.split(' ').filter(Boolean)) {
      const t = tk.replace(/[^A-Za-z0-9'&.\-]/g, '')
      if (!t) continue
      const isJunk = JUNK_TOKEN_RE.test(t) || JUNK_TOKEN_PATTERNS.some(re => re.test(t))
      if (isJunk || RES_RE.test(t) || SE_RE.test(t) || (out.length && YEAR_RE.test(t))) break
      out.push(t)
      if (out.length >= 10) break
    }
    let title = out.join(' ').replace(/\s*-\s*$/, '').trim()
    if (!title) {
      const idx = s.search(YEAR_RE)
      title = (idx > 0 ? s.slice(0, idx) : s)
        .split(' ')
        .slice(0, 6)
        .join(' ')
        .trim()
    }
    if (!title) return null
    title = title
      .split(' ')
      .map(w => (/\d/.test(w) || !w[0] ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()))
      .join(' ')
    const full = title + (se ? ' ' + se : '') + (year ? ` (${year})` : '') + (res ? ` [${res}]` : '')
    return { title, full, se: !!se, year }
  }

  const detectKindFromFiles = files => {
    if (!files || !files.length) return null
    let audio = 0
    let video = 0
    let episodes = 0
    for (const f of files) {
      const p = String((f && f.path) || '')
      if (!p) continue
      if (VIDEO_EXT.test(p)) {
        video++
        if (SE_RE.test(p) || /\b\d{1,2}x\d{2}\b/.test(p)) episodes++
      } else if (AUDIO_EXT.test(p)) {
        audio++
      }
    }
    if (!video && audio > 0) return { kind: 'music', strong: true }
    if (episodes > 0) return { kind: 'series', strong: true }
    if (video === 1 && !audio) return { kind: 'movie', strong: false }
    return null
  }

  const detectKindFromName = raw => {
    const s = String(raw || '')
    if (SERIES_NAME_RE.test(s)) return { kind: 'series', strong: true }
    if (MUSIC_NAME_RE.test(s) && !RES_RE.test(s)) return { kind: 'music', strong: true }
    if (RES_RE.test(s) && YEAR_RE.test(s)) return { kind: 'movie', strong: false }
    return null
  }

  // Strong signals beat weak ones; on equal strength, the file list beats the name.
  const detectKind = (raw, files) => {
    const fromFiles = detectKindFromFiles(files)
    const fromName = detectKindFromName(raw)
    if (fromFiles && fromFiles.strong) return fromFiles
    if (fromName && fromName.strong) return fromName
    return fromFiles || fromName
  }

  const gmJson = url =>
    new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest === 'function') {
        GM_xmlhttpRequest({
          method: 'GET',
          url,
          anonymous: true,
          timeout: 15000,
          onload: r => {
            try {
              resolve(JSON.parse(r.responseText))
            } catch (e) {
              reject(e)
            }
          },
          onerror: () => reject(new Error('network error')),
          ontimeout: () => reject(new Error('timeout')),
        })
      } else {
        fetchWithTimeout(url, {}, 15000)
          .then(r => r.json())
          .then(resolve, reject)
      }
    })

  const fetchWithTimeout = (url, options, ms) => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), ms || 20000)
    return fetch(url, Object.assign({}, options, { signal: ctrl.signal })).finally(() => clearTimeout(timer))
  }

  const isAbort = e => /abort/i.test(String((e && e.name) || '') + String((e && e.message) || ''))

  const apiPost = (body, ms) =>
    fetchWithTimeout(
      '/torrents',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      ms,
    )

  const isPlaceholderTitle = (title, hash) => {
    const t = String(title || '').trim().toLowerCase()
    if (!t) return true
    if (hash && t === String(hash).toLowerCase()) return true
    return /^infohash/.test(t)
  }

  const fetchTorrentMeta = async hash => {
    for (let i = 0; i < 90; i++) {
      try {
        const r = await apiPost({ action: 'get', hash })
        if (r.ok) {
          const st = await r.json()
          if (st.name && !isPlaceholderTitle(st.name, hash)) {
            return {
              raw: st.name,
              category: st.category || '',
              poster: st.poster || '',
              files: filesOfStats(st),
            }
          }
          if (st.title && !isPlaceholderTitle(st.title, hash)) {
            return {
              raw: st.title,
              category: st.category || '',
              poster: st.poster || '',
              files: filesOfStats(st),
            }
          }
        }
      } catch (_) {}
      await sleep(1000)
    }
    throw new Error('no metadata within 90 s, paste the hash again later')
  }

  const DEFAULT_CATEGORIES = ['Movies', 'Series', 'Music', 'Other']
  const KIND_DEFAULT_CATEGORY = { movie: 'Movies', series: 'Series', music: 'Music', other: 'Other' }
  const KIND_CATEGORY_RE = {
    movie: /^(movies?|films?|cinema)$/i,
    series: /^(series|serials?|tv|tv[ ._-]?shows?|shows?|anime)$/i,
    music: /^(music|audio|soundtracks?|music[ ._-]?videos?)$/i,
    other: /^(other|misc|miscellaneous|xxx|adult|games?|software|apps?|books?|documents?)$/i,
  }

  const fetchAvailableCategories = async () => {
    const cats = new Set(DEFAULT_CATEGORIES)
    try {
      const list = await apiPost({ action: 'list' }, 15000).then(r => r.json())
      for (const t of list || []) {
        const c = String((t && t.category) || '').trim()
        if (c) cats.add(c)
      }
    } catch (_) {}
    return Array.from(cats)
  }

  // Map a detected kind onto the categories the server actually offers; fall back to an
  // Other-like category, then to the canonical default name.
  const resolveCategory = async kind => {
    const available = await fetchAvailableCategories()
    const wanted = KIND_DEFAULT_CATEGORY[kind] || 'Other'
    const hit =
      available.find(c => c.toLowerCase() === wanted.toLowerCase()) ||
      (KIND_CATEGORY_RE[kind] && available.find(c => KIND_CATEGORY_RE[kind].test(c.trim()))) ||
      available.find(c => KIND_CATEGORY_RE.other.test(c.trim()))
    return hit || wanted
  }

  const anilistPoster = query =>
    new Promise((resolve, reject) => {
      const body = JSON.stringify({
        query:
          'query ($s: String) { Page(page: 1, perPage: 3) { media(search: $s, type: ANIME) { coverImage { large } format } } }',
        variables: { s: query },
      })
      if (typeof GM_xmlhttpRequest === 'function') {
        GM_xmlhttpRequest({
          method: 'POST',
          url: 'https://graphql.anilist.co',
          data: body,
          headers: { 'Content-Type': 'application/json' },
          anonymous: true,
          timeout: 15000,
          onload: r => {
            try {
              resolve(JSON.parse(r.responseText))
            } catch (e) {
              reject(e)
            }
          },
          onerror: () => reject(new Error('network error')),
          ontimeout: () => reject(new Error('timeout')),
        })
      } else {
        fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
          .then(r => r.json())
          .then(resolve, reject)
      }
    })

  const deezerCover = async query => {
    const data = await gmJson(`https://api.deezer.com/search/album?limit=3&q=${encodeURIComponent(query)}`)
    const hit = ((data && data.data) || []).find(el => el.cover_big || el.cover_medium)
    return hit ? hit.cover_big || hit.cover_medium : ''
  }

  const wikiCover = async search => {
    const data = await gmJson(
      'https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages' +
        '&piprop=thumbnail&pithumbsize=600&pilicense=any&redirects=1&origin=*' +
        '&generator=search&gsrsearch=' +
        encodeURIComponent(search) +
        '&gsrlimit=3&gsrnamespace=0',
    )
    const pages = (data && data.query && data.query.pages) || {}
    const typeWords = new Set(['film', 'series', 'album', 'tv', 'movie'])
    const words = search
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(w => w.length >= 3 && !typeWords.has(w))
    const hits = Object.values(pages)
      .filter(p => {
        if (!p.thumbnail || !p.thumbnail.source) return false
        const titleWords = new Set(String(p.title || '').toLowerCase().split(/[^a-z0-9]+/))
        return words.some(w => titleWords.has(w))
      })
      .sort((a, b) => (a.index || 99) - (b.index || 99))
    return hits.length ? hits[0].thumbnail.source.replace(/\?utm_source.*$/, '') : ''
  }

  const itunesCover = async (entity, query) => {
    const data = await gmJson(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=${entity}&limit=5`,
    )
    const hit = (data.results || []).find(el => el.artworkUrl100)
    return hit ? hit.artworkUrl100.replace(/\/\d+x\d+bb/, '/600x600bb') : ''
  }

  // Returns { poster, kind } where kind is 'movie' | 'series' | 'music' | null. The lookup
  // providers (TMDB media_type, IMDb q/qid, AniList format, TVMaze) are the only reliable
  // way to tell movies from series when the release name carries no episode mark.
  const findCover = async (query, isSeries, year, category) => {
    if (privacyOn()) return { poster: '', kind: null }
    const yr = Number(year) || 0
    if (/music|audio/i.test(String(category || ''))) {
      let poster = ''
      try {
        poster = await deezerCover(query)
      } catch (_) {}
      if (!poster) {
        try {
          poster = await itunesCover('album', query)
        } catch (_) {}
      }
      if (!poster) {
        try {
          poster = (await wikiCover(`${query} album`)) || (await wikiCover(query))
        } catch (_) {}
      }
      return { poster, kind: 'music' }
    }
    try {
      const s = await fetch('/tmdb/settings').then(r => r.json())
      if (s && s.APIKey) {
        const base = (s.APIURL || 'https://api.themoviedb.org').replace(/\/+$/, '').replace(/\/3.*$/, '')
        const img = (s.ImageURL || 'https://image.tmdb.org').replace(/\/+$/, '')
        const data = await gmJson(
          `${base}/3/search/multi?api_key=${encodeURIComponent(s.APIKey)}&query=${encodeURIComponent(query)}` +
            (yr ? `&year=${yr}` : ''),
        )
        const hit = (data.results || []).find(el => el.poster_path)
        if (hit) {
          return {
            poster: img + '/t/p/w300' + hit.poster_path,
            kind: hit.media_type === 'tv' ? 'series' : hit.media_type === 'movie' ? 'movie' : null,
          }
        }
      }
    } catch (_) {}
    try {
      const first = (query[0] || 'a').toLowerCase()
      const data = await gmJson(`https://v2.sg.media-imdb.com/suggestion/${first}/${encodeURIComponent(query)}.json`)
      const withImg = ((data && data.d) || []).filter(
        el => el.i && el.i.imageUrl && /^tt/.test(el.id || ''),
      )
      let hit = yr ? withImg.find(el => Math.abs((Number(el.y) || 0) - yr) <= 1) : null
      if (!hit) hit = withImg[0]
      if (hit) {
        const q = String(hit.qid || hit.q || '').toLowerCase()
        const kind = /tv|series|episode/.test(q)
          ? 'series'
          : /movie|feature/.test(q)
            ? 'movie'
            : /music/.test(q)
              ? 'music'
              : null
        return { poster: hit.i.imageUrl.replace(/(\._V1_)\.jpg$/i, '$1UX400_.jpg'), kind }
      }
    } catch (_) {}
    try {
      const data = await anilistPoster(query)
      const media = (data && data.data && data.data.Page && data.data.Page.media) || []
      const hit = media.find(m => m.coverImage && m.coverImage.large)
      if (hit) {
        const fmt = String(hit.format || '').toUpperCase()
        const kind = fmt === 'MOVIE' ? 'movie' : fmt === 'MUSIC' ? 'music' : fmt ? 'series' : null
        return { poster: hit.coverImage.large, kind }
      }
    } catch (_) {}
    if (isSeries) {
      try {
        const data = await gmJson(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`)
        const shows = (data || []).map(el => el.show).filter(s => s && s.image && (s.image.original || s.image.medium))
        let hit = yr ? shows.find(s => Math.abs((Number(String(s.premiered || '').slice(0, 4)) || 0) - yr) <= 1) : null
        if (!hit) hit = shows[0]
        if (hit) return { poster: hit.image.original || hit.image.medium, kind: 'series' }
      } catch (_) {}
    }
    for (const entity of isSeries ? ['tvSeason', 'movie'] : ['movie', 'tvSeason']) {
      try {
        const c = await itunesCover(entity, query)
        if (c) return { poster: c, kind: entity === 'tvSeason' ? 'series' : 'movie' }
      } catch (_) {}
    }
    try {
      const c = await deezerCover(query)
      if (c) return { poster: c, kind: 'music' }
    } catch (_) {}
    try {
      const hint = isSeries ? `${query} TV series` : `${query}${yr ? ' ' + yr : ''} film`
      const c = (await wikiCover(hint)) || (await wikiCover(`${query}${yr ? ' ' + yr : ''}`))
      if (c) return { poster: c, kind: null }
    } catch (_) {}
    return { poster: '', kind: null }
  }

  const autoFixTorrent = async hash => {
    const meta = await fetchTorrentMeta(hash)
    const clean = cleanTorrentName(meta.raw)
    if (!clean) throw new Error(`could not parse name "${meta.raw}"`)
    const local = detectKind(meta.raw, meta.files)
    const isSeries = !!(clean.se || (local && local.kind === 'series'))
    const cover = await findCover(
      clean.title,
      isSeries,
      clean.year,
      meta.category || (local && local.kind === 'music' ? 'Music' : ''),
    )
    let kind = local
    if (cover.kind && (!kind || !kind.strong)) kind = { kind: cover.kind, strong: true }
    const existingCategory = String(meta.category || '').trim()
    // keep a category the user already picked; fill one in only when missing
    const category = existingCategory || (await resolveCategory(kind ? kind.kind : 'other'))
    const r = await apiPost({
      action: 'set',
      hash,
      title: clean.full,
      poster: cover.poster || meta.poster,
      category,
    })
    if (!r.ok) throw new Error('set failed (HTTP ' + r.status + ')')
    return {
      title: clean.full,
      poster: cover.poster || meta.poster,
      category,
      categorySet: !existingCategory,
    }
  }

  const runAutoFix = hashes => {
    ;(async () => {
      let okCount = 0
      let coverCount = 0
      let catCount = 0
      const fails = []
      for (const h of hashes) {
        try {
          const r = await autoFixTorrent(h)
          okCount++
          if (r.poster) coverCount++
          if (r.categorySet) catCount++
        } catch (e) {
          fails.push(`${h.slice(0, 8)}… ${e.message}`)
        }
      }
      if (okCount) {
        const parts = [`Clean name applied to ${okCount} torrent${okCount > 1 ? 's' : ''}`]
        parts.push(coverCount ? `cover: ${coverCount}/${okCount}` : 'no cover found')
        if (catCount) parts.push(`category: ${catCount}/${okCount}`)
        toast(parts.join(' · '))
      }
      if (fails.length) toast(fails.join(' · '), true)
    })()
  }

  const addLinksDirect = async links => {
    let known = new Set()
    try {
      const list = await apiPost({ action: 'list' }, 15000).then(r => r.json())
      known = new Set((list || []).map(t => String(t.hash || '').toLowerCase()))
    } catch (_) {}
    let added = 0
    let already = 0
    const errors = []
    const toFix = []
    for (const link of links) {
      const linkHash = ((link.match(/btih:([a-fA-F0-9]{40})/i) || [])[1] || '').toLowerCase()
      if (linkHash && known.has(linkHash)) {
        already++
        toFix.push(linkHash)
        continue
      }
      try {
        const st = await apiAdd(link)
        added++
        const h = String((st && st.hash) || linkHash || '').toLowerCase()
        if (h) toFix.push(h)
      } catch (e) {
        errors.push(e.message)
      }
    }
    const parts = []
    if (added) parts.push(`Added ${added} torrent${added > 1 ? 's' : ''}`)
    if (already) parts.push(`${already} already on server`)
    if (parts.length) toast(parts.join(' · '))
    if (errors.length) toast(`${errors.length} failed: ${errors[0]}${errors.length > 1 ? ' …' : ''}`, true)
    if ((added || already) && toFix.length && localStorage.getItem('tsqaAutoClean') !== '0') runAutoFix(toFix)
    return { added, already, errors, fixed: toFix }
  }

  const openQuickAdd = prefill => {
    if (document.getElementById('tsqa-overlay')) return
    const overlay = document.createElement('div')
    overlay.id = 'tsqa-overlay'
    overlay.innerHTML = `
      <div class="tsqa-panel" role="dialog" aria-label="Quick add torrent">
        <div class="tsqa-title">${FLASH_ICON} Quick add: hash to magnet</div>
        <textarea class="tsqa-textarea" placeholder="Paste a hash, a magnet, a .torrent link, or any text containing them, one or more. Trackers are added automatically."></textarea>
        <div class="tsqa-info">&nbsp;</div>
        <label class="tsqa-auto"><input type="checkbox"> Auto: clean name, category &amp; cover</label>
        <div class="tsqa-row">
          <button class="tsqa-paste" type="button">${PASTE_ICON} Paste</button>
          <button class="tsqa-clear" type="button">Clear</button>
          <button class="tsqa-cancel" type="button">${tsIcon('x')} Cancel</button>
          <button class="tsqa-add" type="button">Add</button>
        </div>
      </div>`
    document.body.appendChild(overlay)
    const ta = overlay.querySelector('.tsqa-textarea')
    const info = overlay.querySelector('.tsqa-info')
    const addBtn = overlay.querySelector('.tsqa-add')
    const cancelBtn = overlay.querySelector('.tsqa-cancel')
    const pasteBtn = overlay.querySelector('.tsqa-paste')
    const clearBtn = overlay.querySelector('.tsqa-clear')
    const autoCb = overlay.querySelector('.tsqa-auto input')
    autoCb.checked = localStorage.getItem('tsqaAutoClean') !== '0'
    autoCb.addEventListener('change', () => localStorage.setItem('tsqaAutoClean', autoCb.checked ? '1' : '0'))

    const escHandler = e => {
      if (e.key === 'Escape') close()
    }
    const close = () => {
      document.removeEventListener('keydown', escHandler)
      overlay.remove()
    }
    overlay.addEventListener('mousedown', e => {
      if (e.target === overlay) close()
    })
    cancelBtn.addEventListener('click', close)
    document.addEventListener('keydown', escHandler)

    const updatePreview = () => {
      info.classList.remove('tsqa-error')
      if (!ta.value.trim()) {
        info.innerHTML = '&nbsp;'
        return
      }
      const links = extractTorrentLinks(ta.value)
      if (!links.length) {
        info.textContent = 'No torrent hash, magnet or .torrent link found'
        info.classList.add('tsqa-error')
        return
      }
      const shortHashes = links.map(l => (l.match(/btih:([a-zA-Z0-9]+)/) || ['', ''])[1].slice(0, 10) + '…')
      info.textContent = `${links.length} torrent${links.length > 1 ? 's' : ''} detected: ${shortHashes.join(',  ')}`
    }
    ta.addEventListener('input', updatePreview)
    if (typeof prefill === 'string' && prefill) ta.value = prefill
    ta.focus()
    updatePreview()

    pasteBtn.addEventListener('click', async () => {
      try {
        if (!navigator.clipboard || !navigator.clipboard.readText) throw new Error('unavailable')
        const text = await navigator.clipboard.readText()
        if (!text.trim()) {
          info.textContent = 'Clipboard is empty'
          info.classList.add('tsqa-error')
          return
        }
        ta.value = text
        updatePreview()
        ta.focus()
        ta.setSelectionRange(ta.value.length, ta.value.length)
      } catch (_) {
        info.textContent = 'Clipboard read blocked by the browser, click the field and press Ctrl+V'
        info.classList.add('tsqa-error')
        ta.focus()
      }
    })

    clearBtn.addEventListener('click', () => {
      ta.value = ''
      updatePreview()
      ta.focus()
    })

    const doAdd = async () => {
      if (addBtn.disabled) return
      const links = extractTorrentLinks(ta.value)
      if (!links.length) {
        info.textContent = 'No torrent hash, magnet or .torrent link found'
        info.classList.add('tsqa-error')
        return
      }
      addBtn.disabled = true
      cancelBtn.disabled = true
      pasteBtn.disabled = true
      clearBtn.disabled = true
      addBtn.textContent = 'Adding…'
      try {
        const autoOn = autoCb.checked
        let known = new Set()
        if (autoOn) {
          try {
            const list = await apiPost({ action: 'list' }, 15000).then(r => r.json())
            known = new Set((list || []).map(t => String(t.hash || '').toLowerCase()))
          } catch (_) {}
        }
        let added = 0
        let already = 0
        const errors = []
        const hashesToFix = []
        for (const link of links) {
          const h = (link.match(/btih:([a-fA-F0-9]{40})/i) || [])[1]
          if (autoOn && h && known.has(h.toLowerCase())) {
            already++
            hashesToFix.push(h.toLowerCase())
            continue
          }
          try {
            await apiAdd(link)
            added++
            if (autoOn && h) hashesToFix.push(h.toLowerCase())
          } catch (e) {
            errors.push(e.message)
          }
        }
        if (added || already) {
          close()
          const parts = []
          if (added) parts.push(`Added ${added} torrent${added > 1 ? 's' : ''}`)
          if (already) parts.push(`${already} already on server, updating name & cover`)
          toast(parts.join(' · '))
          if (autoOn && hashesToFix.length) runAutoFix(hashesToFix)
          if (errors.length) toast(`${errors.length} failed: ${errors[0]}${errors.length > 1 ? ' …' : ''}`, true)
        } else if (errors.length) {
          addBtn.disabled = false
          cancelBtn.disabled = false
          pasteBtn.disabled = false
          clearBtn.disabled = false
          addBtn.textContent = 'Add'
          info.textContent = errors.join(' · ')
          info.classList.add('tsqa-error')
        }
      } catch (e) {
        addBtn.disabled = false
        cancelBtn.disabled = false
        pasteBtn.disabled = false
        clearBtn.disabled = false
        addBtn.textContent = 'Add'
        info.textContent = 'Unexpected error: ' + ((e && e.message) || e)
        info.classList.add('tsqa-error')
      }
    }
    addBtn.addEventListener('click', doAdd)
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault()
        doAdd()
      }
    })
  }

  const ADD_LABELS = [
    'add torrent',
    'добавете торент',
    'ajouter un torrent',
    'adăugați torrent',
    'добавить',
    'додати торент',
    '添加种子',
  ]
  const findSidebarAnchor = () => {
    for (const li of document.querySelectorAll('[class*="MuiListItem-root"]')) {
      if (ADD_LABELS.includes((li.textContent || '').trim().toLowerCase())) return li
    }
    const ul = document.querySelector('ul[class*="MuiList-root"]')
    const firstItem = ul && ul.querySelector(':scope > *')
    return firstItem && firstItem.querySelector('svg') ? firstItem : null
  }
  const ensureQuickAdd = () => {
    if (document.querySelector('.ts-quick-add')) return
    const anchor = findSidebarAnchor()
    if (!anchor) return
    const li = anchor.cloneNode(true)
    li.classList.add('ts-quick-add')
    li.setAttribute('aria-label', 'Quick add')
    li.title = 'Quick add: paste a hash, get a magnet with trackers, added straight to the server'
    const svg = li.querySelector('svg')
    if (svg) svg.outerHTML = FLASH_ICON
    const label = li.querySelector('[class*="MuiListItemText"] span')
    if (label) label.textContent = 'Quick add'
    li.addEventListener('click', async () => {
      let text = ''
      try {
        if (navigator.clipboard && navigator.clipboard.readText) text = await navigator.clipboard.readText()
      } catch (_) {}
      openQuickAdd(text && extractTorrentLinks(text).length ? text : '')
    })
    anchor.after(li)
  }

  const PLUS_ICON = tsIcon('plus')
  const fab = document.createElement('button')
  fab.id = 'ts-fab'
  fab.type = 'button'
  fab.innerHTML = PLUS_ICON + '<span class="ts-fab-badge"></span>'
  fab.title = 'Quick add torrent'

  const setFabBadge = on => {
    const badge = fab.querySelector('.ts-fab-badge')
    if (badge) badge.style.display = on ? 'block' : 'none'
  }

  fab.addEventListener('click', async () => {
    let text = ''
    try {
      if (navigator.clipboard && navigator.clipboard.readText) text = await navigator.clipboard.readText()
    } catch (_) {}
    openQuickAdd(text && extractTorrentLinks(text).length ? text : '')
  })

  const PASTE_ICON = tsIcon('clipboard')
  const pasteFab = document.createElement('button')
  pasteFab.id = 'ts-paste-fab'
  pasteFab.type = 'button'
  pasteFab.innerHTML = PASTE_ICON
  pasteFab.title = 'Paste-add: read the clipboard and add the torrent right away'

  const setPasteArmed = on => {
    pasteFab.classList.toggle('ts-armed', !!on)
    pasteFab.title = on
      ? 'Paste-add: torrent link found on the clipboard, one click adds it'
      : 'Paste-add: read the clipboard and add the torrent right away'
  }

  pasteFab.addEventListener('click', async () => {
    if (pasteFab.classList.contains('ts-busy')) return
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      openQuickAdd('')
      return
    }
    let text = ''
    try {
      text = await navigator.clipboard.readText()
    } catch (_) {
      toast('Clipboard read blocked, paste the link in the dialog', true)
      openQuickAdd('')
      return
    }
    const links = extractTorrentLinks(text)
    if (!links.length) {
      toast('No torrent hash or magnet on the clipboard', true)
      return
    }
    pasteFab.classList.add('ts-busy')
    try {
      await addLinksDirect(links)
    } finally {
      pasteFab.classList.remove('ts-busy')
    }
  })

  const SHIELD_ICON = tsIcon('shield')
  const shieldFab = document.createElement('button')
  shieldFab.id = 'ts-shield-fab'
  shieldFab.type = 'button'
  shieldFab.innerHTML = SHIELD_ICON
  shieldFab.title = 'Privacy mode: block external lookups and poster requests'

  const EXTERNAL_IMG_PLACEHOLDER =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
  const hiddenExternalImages = new Map()
  let privacyImageObserver = null

  const isExternalImage = src => {
    if (!src || !/^https?:/i.test(src)) return false
    try {
      return new URL(src, location.href).origin !== location.origin
    } catch (_) {
      return false
    }
  }

  const blockExternalImages = () => {
    for (const img of document.images) {
      const src = img.getAttribute('src') || ''
      if (!isExternalImage(src)) continue
      if (!hiddenExternalImages.has(img)) hiddenExternalImages.set(img, src)
      img.setAttribute('src', EXTERNAL_IMG_PLACEHOLDER)
    }
  }

  const restoreExternalImages = () => {
    for (const [img, src] of hiddenExternalImages) {
      if (img.isConnected && img.getAttribute('src') === EXTERNAL_IMG_PLACEHOLDER) img.setAttribute('src', src)
    }
    hiddenExternalImages.clear()
  }

  const stripTrackerTags = () => {
    for (const el of document.querySelectorAll('script[src], iframe[src]')) {
      const src = el.src || ''
      if (/firebase|gstatic|googletagmanager|google-analytics|googleadservices/i.test(src)) el.remove()
    }
  }

  const privacyPanel = () => document.getElementById('ts-privacy-panel')

  const refreshPrivacyChrome = () => {
    shieldFab.classList.toggle('ts-on', privacyEnabled)
    shieldFab.setAttribute('aria-pressed', privacyEnabled ? 'true' : 'false')
    shieldFab.title = privacyEnabled
      ? 'Privacy mode is on: external lookups and poster requests are blocked'
      : 'Privacy mode: block external lookups and poster requests'
    const panel = privacyPanel()
    if (panel) {
      const sw = panel.querySelector('.tspv-switch')
      if (sw) sw.setAttribute('aria-checked', privacyEnabled ? 'true' : 'false')
      panel.querySelector('.tspv-state').textContent = privacyEnabled ? 'On' : 'Off'
    }
  }

  const applyPrivacy = () => {
    if (privacyEnabled) {
      blockExternalImages()
      stripTrackerTags()
    } else {
      restoreExternalImages()
    }
    refreshPrivacyChrome()
  }

  const setPrivacy = on => {
    privacyEnabled = !!on
    localStorage.setItem(PRIVACY_KEY, privacyEnabled ? '1' : '0')
    applyPrivacy()
    toast(
      privacyEnabled
        ? 'Privacy mode on: covers, public trackers and external images are blocked'
        : 'Privacy mode off',
      false,
    )
  }

  const openPrivacyPanel = () => {
    if (privacyPanel()) return
    const scrim = document.createElement('div')
    scrim.id = 'ts-privacy-scrim'
    scrim.innerHTML = `
      <div id="ts-privacy-panel" role="dialog" aria-modal="true" aria-labelledby="ts-privacy-title">
        <h2 id="ts-privacy-title">${SHIELD_ICON} Privacy mode</h2>
        <p class="tspv-sub">A local switch for this browser and this TorrServer. It changes only what the userscript sends.</p>
        <div class="tspv-toggle">
          <div>
            <b>Privacy mode <span class="tspv-state"></span></b>
            <small>Blocks external requests from the script</small>
          </div>
          <button class="tspv-switch" type="button" role="switch" aria-label="Privacy mode" aria-checked="false"></button>
        </div>
        <ul>
          <li>${CHECK_ICON} No public trackers added to magnets or pasted links.</li>
          <li>${CHECK_ICON} No TMDB, IMDb, AniList, TVMaze, iTunes, Deezer or Wikipedia cover lookups.</li>
          <li>${CHECK_ICON} New torrents are added with <code>save_to_db: false</code>.</li>
          <li>${CHECK_ICON} External poster images are replaced locally; no request leaves the tab.</li>
          <li>${CHECK_ICON} Firebase, gtag and other third-party tracker tags are removed when found.</li>
        </ul>
        <div class="tspv-note">This does not change the TorrServer process. Binding it to 127.0.0.1, adding <code>--httpauth</code> and using a TLS tunnel are server-side jobs.</div>
        <div class="tspv-actions">
          <button class="tspv-btn is-primary" type="button" data-close>Close</button>
        </div>
      </div>
    `
    document.body.appendChild(scrim)
    const sw = scrim.querySelector('.tspv-switch')
    sw.setAttribute('aria-checked', privacyEnabled ? 'true' : 'false')
    sw.addEventListener('click', () => setPrivacy(!privacyEnabled))
    const close = () => {
      document.removeEventListener('keydown', onKey)
      scrim.remove()
    }
    const onKey = e => {
      if (e.key === 'Escape') close()
    }
    scrim.querySelector('[data-close]').addEventListener('click', close)
    scrim.addEventListener('mousedown', e => {
      if (e.target === scrim) close()
    })
    document.addEventListener('keydown', onKey)
    refreshPrivacyChrome()
    setTimeout(() => sw.focus(), 40)
  }

  shieldFab.addEventListener('click', openPrivacyPanel)

  const startClipboardWatch = () => {
    if (!navigator.clipboard || !navigator.clipboard.readText) return
    let lastSeen = ''
    let lastGestureAttempt = 0
    let permState = 'unknown'
    try {
      navigator.permissions
        .query({ name: 'clipboard-read' })
        .then(st => {
          permState = st.state
          st.onchange = () => (permState = st.state)
        })
        .catch(() => (permState = 'unsupported'))
    } catch (_) {
      permState = 'unsupported'
    }

    const readClipboard = async () => {
      let text = ''
      try {
        text = await navigator.clipboard.readText()
      } catch (_) {
        return false
      }
      if (!text || text === lastSeen) return true
      lastSeen = text
      const hasTorrent = extractTorrentLinks(text).length > 0
      setFabBadge(hasTorrent)
      setPasteArmed(hasTorrent)
      fab.title = hasTorrent ? 'Quick add: hash/magnet found on the clipboard' : 'Quick add torrent'
      return true
    }

    setInterval(() => {
      if (!document.hidden) readClipboard()
    }, 2000)

    document.addEventListener(
      'click',
      () => {
        const now = Date.now()
        if (now - lastGestureAttempt < 8000) return
        if (permState === 'denied') return
        lastGestureAttempt = now
        readClipboard().then(ok => {
          if (ok && permState === 'prompt') permState = 'granted'
        })
      },
      true,
    )
  }

  const addDialogMpvButtons = root => {
    const scope = root || document
    scope.querySelectorAll('a[href*="/stream/"]:not([href*=".m3u"])').forEach(a => {
      if (a.closest('.ts-file-tree') || a.closest('#ts-watch-shelf')) return
      const container = a.parentElement
      if (!container || container.querySelector(':scope > .ts-mpv-link')) return
      if (!/index=/.test(a.href)) return
      const mpv = a.cloneNode(true)
      mpv.classList.add('ts-mpv-link')
      mpv.href = mpvLink(a.href)
      mpv.removeAttribute('target')
      mpv.removeAttribute('rel')
      mpv.title = 'Open in MPV player'
      const dialogTitle =
        (document.querySelector('.MuiDialogTitle-root') || document.querySelector('[class*="MuiDialogTitle"]') || {})
          .textContent || 'Torrent'
      const streamHref = a.href
      let streamHash = ''
      let streamIndex = 0
      let streamName = ''
      try {
        const u = new URL(streamHref, location.href)
        streamHash = String(u.searchParams.get('link') || '').toLowerCase()
        streamIndex = Number(u.searchParams.get('index') || 0)
        streamName = decodeURIComponent(u.pathname.split('/').pop() || '')
      } catch (_) {}
      mpv.addEventListener('click', e => {
        e.preventDefault()
        startLaunch({
          url: streamHref,
          copyUrl: streamHref,
          prewarmUrl: streamHref,
          hash: streamHash,
          fileId: streamIndex,
          fileName: streamName,
          title: dialogTitle,
        })
      })
      mpv.addEventListener('mouseenter', () => scheduleHoverPrewarm(streamHref))
      mpv.addEventListener('mouseleave', cancelHoverPrewarm)
      const label = mpv.querySelector('[class*="MuiButton-label"]')
      if (label) label.textContent = 'MPV'
      const copyBtn = container.querySelector('.ts-dialog-copy')
      const copyWrap = copyBtn && copyBtn.closest('span')
      if (copyWrap && copyWrap.parentElement === container) copyWrap.after(mpv)
      else container.appendChild(mpv)
    })
  }

  // ---- details dialog: expandable file tree ----

  const TREE_CACHE_TTL = 30000
  const treeFilesCache = new Map() // hash -> { files, at }
  const treeInflight = new Map()
  const treeCollapsed = new Map() // hash -> Set of collapsed folder paths
  let treeMediaOnly = localStorage.getItem('tsftMediaOnly') === '1'
  const CARET_ICON = tsIcon('chevronDown', 'tsft-caret')
  const COPY_SMALL_ICON = tsIcon('copy')
  const PICK_ICON = tsIcon('squareCheck')

  const isMediaFile = f => VIDEO_EXT.test(f.path) || AUDIO_EXT.test(f.path)

  // ---- season / episode grouping ----
  // Release names label episodes in several ways ("S01E001", "S01 E001", "1x02", "Season 1 Episode 2"),
  // and some packs only give the span in a folder name ("01. The SAIYAN Saga (Eps. 001-035)"). Both are
  // used here: the label wins, the folder fills in the season when the label omits it.

  const EP_LABEL_RES = [
    /\bS(\d{1,2})\s*[.\-_ ]?\s*E(?:P)?(\d{1,4})\b/i, // S01E001 / S01 E001 / S01.E001 / S01-EP01
    /\b(\d{1,2})x(\d{2,4})\b/, // 1x02
    /\bSeason\s*(\d{1,2})\s*[.\-_ ]?\s*Episode\s*(\d{1,4})\b/i, // Season 1 Episode 2
  ]
  const EP_ONLY_RE = /\bE(?:P)?(\d{1,4})\b/i // E01 / EP01 with no season in the name
  const SEASON_FOLDER_RE = /\bSeason\s*(\d{1,2})\b/i
  const SAGA_RANGE_RE = /\(\s*Eps?\.?\s*(\d{1,4})\s*[-–]\s*(\d{1,4})\s*\)/i

  const parseEpisodeLabel = name => {
    for (const re of EP_LABEL_RES) {
      const m = name.match(re)
      if (m) return { season: parseInt(m[1], 10), episode: parseInt(m[2], 10) }
    }
    const m = name.match(EP_ONLY_RE)
    if (m) return { season: null, episode: parseInt(m[1], 10) }
    return null
  }

  const seasonFromPath = dirs => {
    for (let i = dirs.length - 1; i >= 0; i--) {
      const m = dirs[i].match(SEASON_FOLDER_RE)
      if (m) return { season: parseInt(m[1], 10), range: null }
    }
    for (let i = dirs.length - 1; i >= 0; i--) {
      const m = dirs[i].match(SAGA_RANGE_RE)
      if (m) return { season: null, range: [parseInt(m[1], 10), parseInt(m[2], 10)] }
    }
    return null
  }

  const seasonLabel = key =>
    typeof key === 'number' ? `Season ${String(key).padStart(2, '0')}` : 'Episodes'

  const seasonKeyOf = (ep, dirs) => {
    if (ep.season != null) return ep.season
    const hint = seasonFromPath(dirs)
    if (hint && hint.season != null) return hint.season
    if (hint && hint.range && ep.episode >= hint.range[0] && ep.episode <= hint.range[1]) return hint.range[0]
    return 'other'
  }

  // Returns seasons sorted by number (numbered ones first, unlabelled last), each with its
  // episodes ordered by episode number. Files with no episode label at all are left out and
  // reported in `rest` so the caller can keep rendering them as plain rows.
  const groupSeasons = files => {
    const media = files.filter(isMediaFile)
    const buckets = new Map()
    const rest = []
    for (const f of media) {
      const name = basename(f.path)
      const ep = parseEpisodeLabel(name)
      if (!ep) {
        rest.push(f)
        continue
      }
      const dirs = splitPath(f.path).slice(0, -1)
      const key = seasonKeyOf(ep, dirs)
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key).push({ f, episode: ep.episode, dir: dirs.join('/') })
    }
    const rank = k => (typeof k === 'number' ? k : 9999)
    return {
      seasons: Array.from(buckets.entries())
        .sort((a, b) => rank(a[0]) - rank(b[0]))
        .map(([key, list]) => ({
          key,
          label: seasonLabel(key),
          files: list
            .slice()
            .sort(
              (a, b) =>
                a.episode - b.episode ||
                NATURAL_COLLATOR.compare(a.dir, b.dir) ||
                NATURAL_COLLATOR.compare(a.f.path, b.f.path),
            )
            .map(e => e.f),
        })),
      rest,
    }
  }


  const loadTreeFiles = hash => {
    const cached = treeFilesCache.get(hash)
    // an empty result is kept only briefly so a torrent that is still loading gets retried, not hammered
    if (cached && (cached.files.length || Date.now() - cached.at < TREE_CACHE_TTL)) {
      return Promise.resolve(cached.files)
    }
    if (treeInflight.has(hash)) return treeInflight.get(hash)
    const p = (async () => {
      let files = []
      try {
        const r = await apiPost({ action: 'get', hash }, 20000)
        if (r.ok) {
          const st = await r.json()
          files = filesOfStats(st)
        }
      } catch (_) {}
      if (!files.length) {
        try {
          const list = await apiPost({ action: 'list' }, 15000).then(r => r.json())
          const t = (list || []).find(x => String((x && x.hash) || '').toLowerCase() === hash.toLowerCase())
          if (t) files = filesOfStats(t)
        } catch (_) {}
      }
      files = files.filter(f => f && f.path)
      treeFilesCache.set(hash, { files, at: Date.now() })
      treeInflight.delete(hash)
      return files
    })()
    treeInflight.set(hash, p)
    return p
  }

  const countTree = node => {
    node.count = node.files.length
    for (const d of node.dirs.values()) node.count += countTree(d).count
    return node
  }

  const buildFileTree = files => {
    const root = { name: '', path: '', dirs: new Map(), files: [] }
    for (const f of files) {
      const parts = splitPath(f.path)
      let node = root
      for (let i = 0; i < parts.length - 1; i++) {
        const seg = parts[i]
        const path = node.path ? `${node.path}/${seg}` : seg
        if (!node.dirs.has(seg)) node.dirs.set(seg, { name: seg, path, dirs: new Map(), files: [] })
        node = node.dirs.get(seg)
      }
      node.files.push({ name: parts[parts.length - 1] || f.path, f })
    }
    return countTree(root)
  }

  const pruneFileTree = node => {
    const kept = {
      name: node.name,
      path: node.path,
      dirs: new Map(),
      files: node.files.filter(e => isMediaFile(e.f)),
    }
    for (const [seg, d] of node.dirs) {
      const pd = pruneFileTree(d)
      if (pd.files.length || pd.dirs.size) kept.dirs.set(seg, pd)
    }
    return kept
  }

  // sibling files in one folder usually share a long prefix ("Show Name - "); hiding it keeps the
  // distinguishing part (episode number, title) visible in narrow tree rows. the cut snaps back to
  // the last separator so we never split inside a word, and short prefixes are left alone.
  const commonFileNamePrefix = names => {
    if (names.length < 2) return ''
    let prefix = names[0]
    for (const n of names.slice(1)) {
      let i = 0
      while (i < prefix.length && i < n.length && prefix[i] === n[i]) i++
      prefix = prefix.slice(0, i)
      if (!prefix) return ''
    }
    if (prefix.length <= 6) return ''
    const cut = Math.max(prefix.lastIndexOf(' - '), prefix.lastIndexOf('_'), prefix.lastIndexOf(' '))
    return cut >= 3 ? prefix.slice(0, cut) : ''
  }

  const getDialogPaper = () => {
    for (const paper of document.querySelectorAll('.MuiDialog-paper')) {
      const a = paper.querySelector('a[href*="/stream/"][href*="index="]')
      if (!a) continue
      const hash = new URL(a.getAttribute('href'), window.location.origin).searchParams.get('link')
      if (hash) return { paper, hash, torrent: findTorrent(paper) }
    }
    return null
  }

  const renderFileTreePanel = (paper, hash, files, viewedSet, torrentTitle) => {
    const tree = buildFileTree(files)
    let collapsed = treeCollapsed.get(hash)
    if (!collapsed) {
      collapsed = new Set()
      treeCollapsed.set(hash, collapsed)
    }

    const grouped = groupSeasons(files)
    const seasons = grouped.seasons
    const restFiles = grouped.rest
    const seasonCollapsed = new Set()
    // seasons are what most people want for an episode pack, but the folder tree is still there
    let viewMode =
      seasons.length && localStorage.getItem('tsftView') !== 'folders' ? 'seasons' : 'folders'
    let selectMode = false
    let autoMark = localStorage.getItem('tsftAutoMark') !== '0'
    const picked = new Set() // file ids chosen for a playlist
    const mediaFiles = files.filter(isMediaFile)
    const seasonRowEls = new Map() // season key -> { row, prog, check, season }, for header refreshes
    const seasonOfFile = new Map() // file id -> season key, so an episode can refresh its own header

    const panel = document.createElement('div')
    panel.className = 'ts-file-tree'
    panel.dataset.hash = hash

    const videoCount = files.filter(f => VIDEO_EXT.test(f.path)).length
    const mediaCount = files.filter(isMediaFile).length
    const head = document.createElement('div')
    head.className = 'tsft-head'
    const title = document.createElement('span')
    title.className = 'tsft-title'
    title.textContent = 'Files'
    const info = document.createElement('span')
    info.className = 'tsft-info'
    const audioCount = mediaCount - videoCount
    info.textContent = [videoCount ? `${videoCount} video` : '', audioCount ? `${audioCount} audio` : '', `${files.length} total`]
      .filter(Boolean)
      .join(' · ')
    const mkMini = (label, onClick) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'tsft-mini'
      b.textContent = label
      b.addEventListener('click', onClick)
      return b
    }
    const collapseAll = () => {
      const addDirs = node => {
        for (const d of node.dirs.values()) {
          collapsed.add(d.path)
          addDirs(d)
        }
      }
      addDirs(tree)
      renderRows()
    }
    const expandBtn = mkMini('Expand', () => {
      collapsed.clear()
      renderRows()
    })
    expandBtn.innerHTML = `${tsIcon('chevronDown')} Expand`
    const collapseBtn = mkMini('Collapse', collapseAll)
    collapseBtn.innerHTML = `${tsIcon('chevronRight')} Collapse`
    const viewToggle = document.createElement('button')
    viewToggle.type = 'button'
    viewToggle.className = 'tsft-toggle'
    viewToggle.addEventListener('click', () => {
      viewMode = viewMode === 'seasons' ? 'folders' : 'seasons'
      localStorage.setItem('tsftView', viewMode)
      renderRows()
    })
    const selectBtn = document.createElement('button')
    selectBtn.type = 'button'
    selectBtn.className = 'tsft-toggle'
    selectBtn.innerHTML = `${tsIcon('squareCheck')} Select`
    selectBtn.title = 'Pick several episodes and build a playlist link from them'
    selectBtn.addEventListener('click', () => {
      selectMode = !selectMode
      if (!selectMode) picked.clear()
      renderRows()
    })
    const toggle = document.createElement('button')
    toggle.type = 'button'
    toggle.className = 'tsft-toggle tsft-icon'
    toggle.innerHTML = tsIcon('eyeOff')
    toggle.title = 'Show non-playable files'
    toggle.setAttribute('aria-label', 'Show non-playable files')
    toggle.addEventListener('click', () => {
      treeMediaOnly = !treeMediaOnly
      localStorage.setItem('tsftMediaOnly', treeMediaOnly ? '1' : '0')
      renderRows()
    })
    const autoMarkBtn = document.createElement('button')
    autoMarkBtn.type = 'button'
    autoMarkBtn.className = 'tsft-toggle tsft-icon'
    autoMarkBtn.innerHTML = tsIcon('checkCircle')
    autoMarkBtn.setAttribute('aria-label', 'Automatically mark played episodes watched')
    autoMarkBtn.title = 'Playing an episode also marks it watched'
    autoMarkBtn.addEventListener('click', () => {
      autoMark = !autoMark
      localStorage.setItem('tsftAutoMark', autoMark ? '1' : '0')
      renderRows()
    })
    head.appendChild(title)
    head.appendChild(info)
    const sub = document.createElement('div')
    sub.className = 'tsft-sub'
    const tools = document.createElement('div')
    tools.className = 'tsft-tools'
    const watchedIds = Array.from(viewedSet).filter(id => files.some(f => f.id === id))
    if (watchedIds.length) {
      const ordered = files.slice().sort((a, b) => a.id - b.id)
      const lastId = Math.max(...watchedIds)
      const lastFile = ordered.find(f => f.id === lastId)
      const nextFile = ordered.find(f => f.id > lastId && isMediaFile(f))
      const epTag = file => {
        if (!file) return ''
        const ep = parseEpisodeLabel(basename(file.path))
        if (ep && ep.episode != null) {
          return `${ep.season != null ? `S${String(ep.season).padStart(2, '0')}` : ''}E${String(ep.episode).padStart(2, '0')}`
        }
        return stripExt(file.path).slice(0, 28)
      }
      const lastTag = epTag(lastFile)
      const nextTag = epTag(nextFile)
      const cap = document.createElement('span')
      cap.className = 'tsft-info'
      cap.textContent = lastFile
        ? `Last ${lastTag}${nextFile ? ` · Next ${nextTag}` : ' · finished'}`
        : ''
      cap.title = [
        lastFile ? `Last watched: ${stripExt(lastFile.path)}` : '',
        nextFile ? `Next: ${stripExt(nextFile.path)}` : 'No unwatched episodes left',
      ]
        .filter(Boolean)
        .join('\n')
      const resume = document.createElement('a')
      resume.className = 'tsft-toggle tsft-resume'
      const resumeUrl = playlistLink({ hash, title: torrentTitle }) + '&fromlast'
      resume.href = mpvLink(resumeUrl)
      resume.textContent = nextFile ? `Resume ${nextTag}` : 'Resume'
      resume.title = 'Play in MPV starting after the last watched episode'
      resume.addEventListener('click', e => {
        e.preventDefault()
        startLaunch({
          url: resumeUrl,
          copyUrl: resumeUrl,
          prewarmUrl: nextFile ? streamUrl(hash, nextFile) : '',
          hash,
          fileId: nextFile ? nextFile.id : null,
          fileName: nextFile ? basename(nextFile.path) : '',
          title: torrentTitle,
        })
      })
      sub.appendChild(cap)
      sub.appendChild(resume)
    } else {
      sub.hidden = true
    }
    tools.appendChild(expandBtn)
    tools.appendChild(collapseBtn)
    if (seasons.length) tools.appendChild(viewToggle)
    tools.appendChild(selectBtn)
    tools.appendChild(autoMarkBtn)
    tools.appendChild(toggle)
    panel.appendChild(head)
    panel.appendChild(sub)
    panel.appendChild(tools)

    // ---- selection bar: appears while picking, turns the picked set into one playlist ----
    const selBar = document.createElement('div')
    selBar.className = 'tsft-selbar'
    const selInfo = document.createElement('span')
    selInfo.className = 'tsft-selinfo'
    const mkSelBtn = (label, cls, onClick) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'tsft-selbtn' + (cls ? ' ' + cls : '')
      b.textContent = label
      b.addEventListener('click', onClick)
      return b
    }
    const pickedFiles = () =>
      mediaFiles.slice().sort((a, b) => a.id - b.id).filter(f => picked.has(f.id))
    const copyPlaylistBtn = mkSelBtn('Copy playlist', 'tsft-primary', () => {
      const list = pickedFiles()
      const built = playlistFor(hash, list)
      if (!built) {
        toast('Selection is too large to fit in a link', true)
        return
      }
      copyText(built.dataUrl)
      copyPlaylistBtn.textContent = 'Copied!'
      copyPlaylistBtn.classList.add('tsft-done')
      setTimeout(() => {
        copyPlaylistBtn.textContent = 'Copy playlist'
        copyPlaylistBtn.classList.remove('tsft-done')
      }, 1200)
      if (built.dropped) toast(`${built.dropped} episode(s) did not fit and were left out`)
      else if (!built.withNames) toast(`Playlist of ${list.length} episodes copied`)
    })
    const playSelBtn = mkSelBtn('Play in MPV', 'tsft-mpv', () => {
      const list = pickedFiles()
      const built = playlistFor(hash, list)
      if (!built) {
        toast('Selection is too large to fit in a link', true)
        return
      }
      const playable = built.playable || list
      const first = playable[0]
      if (built.dropped) toast(`${built.dropped} episode(s) did not fit and were left out`)
      startLaunch({
        url: built.dataUrl,
        copyUrl: built.dataUrl,
        prewarmUrl: first ? streamUrl(hash, first) : '',
        hash,
        fileId: first ? first.id : null,
        fileName: first ? basename(first.path) : '',
        title: torrentTitle,
      })
    })
    const clearSelBtn = mkSelBtn('Clear', '', () => {
      picked.clear()
      renderRows()
    })
    selBar.appendChild(selInfo)
    selBar.appendChild(copyPlaylistBtn)
    selBar.appendChild(playSelBtn)
    selBar.appendChild(clearSelBtn)
    panel.appendChild(selBar)

    const markAllBtn = mkSelBtn('Mark watched', '', () => {
      const list = pickedFiles().filter(f => !viewedSet.has(f.id))
      if (!list.length) {
        toast('Already marked watched')
        return
      }
      for (const f of list) viewedSet.add(f.id)
      renderRows()
      Promise.all(list.map(f => setViewedMark(hash, f.id, true))).catch(() => {})
      toast(`${list.length} episode(s) marked watched`)
    })
    const markNoneBtn = mkSelBtn('Unwatch', '', () => {
      const list = pickedFiles().filter(f => viewedSet.has(f.id))
      if (!list.length) {
        toast('Nothing to unmark')
        return
      }
      for (const f of list) viewedSet.delete(f.id)
      renderRows()
      Promise.all(list.map(f => setViewedMark(hash, f.id, false))).catch(() => {})
      toast(`${list.length} episode(s) marked unwatched`)
    })
    selBar.insertBefore(markAllBtn, clearSelBtn)
    selBar.insertBefore(markNoneBtn, clearSelBtn)

    const rows = document.createElement('div')
    rows.className = 'tsft-rows'
    panel.appendChild(rows)

    const resizer = document.createElement('div')
    resizer.className = 'tsft-resizer'
    resizer.title = 'Drag to resize the file tree'
    panel.appendChild(resizer)
    resizer.addEventListener('mousedown', e => {
      e.preventDefault()
      const startX = e.clientX
      const startW = panel.getBoundingClientRect().width
      const onMove = ev =>
        (panel.style.width = Math.min(640, Math.max(240, startW + ev.clientX - startX)) + 'px')
      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        localStorage.setItem('tsftWidth', panel.style.width)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    })
    const savedWidth = parseInt(localStorage.getItem('tsftWidth') || '', 10)
    if (savedWidth >= 240 && savedWidth <= 640) panel.style.width = savedWidth + 'px'

    const renderRows = () => {
      toggle.classList.toggle('tsft-on', treeMediaOnly)
      toggle.innerHTML = tsIcon(treeMediaOnly ? 'eyeOff' : 'eye')
      toggle.title = treeMediaOnly ? 'Show non-playable files' : 'Hide non-playable files'
      toggle.setAttribute('aria-label', toggle.title)
      viewToggle.innerHTML = `${tsIcon(viewMode === 'seasons' ? 'folder' : 'list')} ${viewMode === 'seasons' ? 'Folders' : 'Seasons'}`
      viewToggle.title =
        viewMode === 'seasons' ? 'Show the raw folder tree' : 'Group files into seasons'
      selectBtn.classList.toggle('tsft-on', selectMode)
      selectBtn.innerHTML = `${tsIcon('squareCheck')} Select`
      selectBtn.title = selectMode
        ? 'Leave selection mode'
        : 'Pick several episodes and build a playlist link from them'
      autoMarkBtn.classList.toggle('tsft-on', autoMark)
      autoMarkBtn.innerHTML = tsIcon('checkCircle')
      autoMarkBtn.setAttribute(
        'aria-label',
        autoMark ? 'Auto mark watched is on' : 'Auto mark watched is off',
      )
      autoMarkBtn.title = autoMark
        ? 'Playing an episode also marks it watched — click to stop doing that'
        : 'Playing an episode does not mark it watched — click to mark automatically'
      selBar.classList.toggle('tsft-show', selectMode)
      const list = pickedFiles()
      selInfo.textContent = list.length
        ? `${list.length} picked · ${humanizeSize(list.reduce((n, f) => n + (f.length || 0), 0))}`
        : 'Pick episodes below'
      for (const b of [copyPlaylistBtn, playSelBtn, markAllBtn, markNoneBtn]) b.disabled = !list.length
      rows.innerHTML = ''
      if (viewMode === 'seasons' && seasons.length) {
        renderSeasons()
        return
      }
      const view = treeMediaOnly ? countTree(pruneFileTree(tree)) : tree
      if (!view.files.length && !view.dirs.size) {
        const empty = document.createElement('div')
        empty.className = 'tsft-empty'
        empty.textContent = 'No media files'
        rows.appendChild(empty)
        return
      }
      renderDir(view, 0)
    }

    // seasons view: one header row per season with its own play/watch/select actions, then the
    // episodes in episode order. Only shown when the pack actually looks episodic.
    // Marking one episode must not leave its season header showing a stale count or a stale ✓/◐.
    // Re-rendering the whole list would work but throws away the scroll position in a 400-row pack,
    // so the header is patched in place instead.
    const refreshSeasonHeader = key => {
      const entry = seasonRowEls.get(key)
      if (!entry) return
      const { row, prog, check, season } = entry
      const watchedN = season.files.filter(f => viewedSet.has(f.id)).length
      const all = watchedN === season.files.length
      const part = watchedN > 0 && !all
      row.classList.toggle('tsft-allviewed', all)
      row.classList.toggle('tsft-partviewed', part)
      prog.textContent = watchedN ? `${watchedN}/${season.files.length}` : `${season.files.length} ep`
      prog.title = `${watchedN} of ${season.files.length} marked watched`
      check.classList.toggle('tsft-on', all)
      check.title = all ? `Mark all of ${season.label} as unwatched` : `Mark all of ${season.label} as watched`
    }

    const renderSeasons = () => {
      seasonRowEls.clear()
      seasonOfFile.clear()
      const epLabel = f => {
        const m = basename(f.path).match(EP_LABEL_RES[0]) || basename(f.path).match(EP_LABEL_RES[1])
        return m ? `E${String(parseInt(m[2], 10)).padStart(2, '0')}` : ''
      }
      for (const s of seasons) {
        const isCollapsed = seasonCollapsed.has(s.key)
        const watchedN = s.files.filter(f => viewedSet.has(f.id)).length
        const allWatched = watchedN === s.files.length
        const partWatched = watchedN > 0 && !allWatched
        const row = document.createElement('div')
        row.className =
          'tsft-row tsft-season' +
          (isCollapsed ? ' tsft-collapsed' : '') +
          (allWatched ? ' tsft-allviewed' : partWatched ? ' tsft-partviewed' : '')
        row.innerHTML = CARET_ICON
        const label = document.createElement('span')
        label.className = 'tsft-name'
        label.textContent = s.label
        label.title = `${s.label} — ${s.files.length} episodes`
        const prog = document.createElement('span')
        prog.className = 'tsft-prog'
        prog.textContent = watchedN ? `${watchedN}/${s.files.length}` : `${s.files.length} ep`
        prog.title = `${watchedN} of ${s.files.length} marked watched`
        row.appendChild(label)
        row.appendChild(prog)
        row.addEventListener('click', () => {
          if (seasonCollapsed.has(s.key)) seasonCollapsed.delete(s.key)
          else seasonCollapsed.add(s.key)
          renderRows()
        })
        const actions = document.createElement('span')
        actions.className = 'tsft-actions'
        const mkAct = (cls, icon, title, onClick, href) => {
          const el = document.createElement(href ? 'a' : 'button')
          if (!href) el.type = 'button'
          el.className = 'tsft-act' + (cls ? ' ' + cls : '')
          el.title = title
          el.innerHTML = icon
          if (href) el.href = href
          el.addEventListener('click', e => {
            e.preventDefault()
            e.stopPropagation()
            onClick(e, el)
          })
          return el
        }
        const built = playlistFor(hash, s.files)
        const seasonMpv = mkAct(
          '',
          PLAY_ICON,
          built
            ? `Play all ${s.files.length} episodes of ${s.label} in MPV`
            : `${s.label} is too long to fit in one MPV link`,
          () => {
            if (!built) {
              toast(`${s.label} is too long to fit in one link`, true)
              return
            }
            const playable = built.playable || s.files
            const first = playable[0]
            if (built.dropped) toast(`${built.dropped} episode(s) did not fit and were left out`)
            startLaunch({
              url: built.dataUrl,
              copyUrl: built.dataUrl,
              prewarmUrl: first ? streamUrl(hash, first) : '',
              hash,
              fileId: first ? first.id : null,
              fileName: first ? basename(first.path) : '',
              title: `${torrentTitle} ${s.label}`,
            })
          },
          built ? mpvLink(built.dataUrl) : null,
        )
        const seasonCopy = mkAct('', COPY_SMALL_ICON, `Copy a playlist link for ${s.label}`, () => {
          if (!built) {
            toast(`${s.label} is too long to fit in one link`, true)
            return
          }
          copyText(built.dataUrl)
          seasonCopy.classList.add('tsft-done')
          setTimeout(() => seasonCopy.classList.remove('tsft-done'), 900)
        })
        const seasonCheck = mkAct(
          'tsft-check' + (allWatched ? ' tsft-on' : ''),
          CHECK_ICON,
          allWatched ? `Mark all of ${s.label} as unwatched` : `Mark all of ${s.label} as watched`,
          () => {
            const now = !allWatched
            for (const f of s.files) {
              if (now) viewedSet.add(f.id)
              else viewedSet.delete(f.id)
            }
            renderRows()
            Promise.all(s.files.map(f => setViewedMark(hash, f.id, now))).catch(() => {})
            toast(`${s.label} marked ${now ? 'watched' : 'unwatched'}`)
          },
        )
        const seasonPick = mkAct(
          'tsft-check' + (s.files.every(f => picked.has(f.id)) ? ' tsft-on' : ''),
          PICK_ICON,
          `Select all of ${s.label}`,
          () => {
            const all = s.files.every(f => picked.has(f.id))
            for (const f of s.files) {
              if (all) picked.delete(f.id)
              else picked.add(f.id)
            }
            if (!selectMode) {
              selectMode = true
            }
            renderRows()
          },
        )
        actions.appendChild(seasonPick)
        actions.appendChild(seasonCheck)
        actions.appendChild(seasonCopy)
        actions.appendChild(seasonMpv)
        row.appendChild(actions)
        rows.appendChild(row)
        seasonRowEls.set(s.key, { row, prog, check: seasonCheck, season: s })
        for (const f of s.files) seasonOfFile.set(f.id, s.key)
        if (isCollapsed) continue
        const strip = commonFileNamePrefix(s.files.map(f => basename(f.path)))
        for (const f of s.files) {
          rows.appendChild(renderFileRow({ f, name: basename(f.path) }, 1, strip, epLabel(f)))
        }
      }
      // non-episodic extras (movies, specials) keep their place below the seasons
      if (restFiles.length && !treeMediaOnly) {
        const sep = document.createElement('div')
        sep.className = 'tsft-row tsft-season'
        sep.innerHTML = CARET_ICON
        const sl = document.createElement('span')
        sl.className = 'tsft-name'
        sl.textContent = 'Other files'
        const sc = document.createElement('span')
        sc.className = 'tsft-prog'
        sc.textContent = `${restFiles.length}`
        sep.appendChild(sl)
        sep.appendChild(sc)
        sep.addEventListener('click', () => {
          if (seasonCollapsed.has('__rest')) seasonCollapsed.delete('__rest')
          else seasonCollapsed.add('__rest')
          renderRows()
        })
        rows.appendChild(sep)
        if (!seasonCollapsed.has('__rest')) {
          const sorted = restFiles.slice().sort((a, b) => NATURAL_COLLATOR.compare(a.path, b.path))
          const strip = commonFileNamePrefix(sorted.map(f => basename(f.path)))
          for (const f of sorted) rows.appendChild(renderFileRow({ f, name: basename(f.path) }, 1, strip, ''))
        }
      }
    }

    const renderDir = (node, depth) => {
      const dirs = Array.from(node.dirs.values()).sort((a, b) => NATURAL_COLLATOR.compare(a.name, b.name))
      for (const d of dirs) {
        const isCollapsed = collapsed.has(d.path)
        const row = document.createElement('div')
        row.className = 'tsft-row tsft-dir' + (isCollapsed ? ' tsft-collapsed' : '')
        row.style.paddingLeft = 8 + depth * 18 + 'px'
        row.innerHTML = CARET_ICON
        const label = document.createElement('span')
        label.className = 'tsft-name'
        label.textContent = d.name
        label.title = d.path
        const count = document.createElement('span')
        count.className = 'tsft-count'
        count.textContent = `${d.count} file${d.count === 1 ? '' : 's'}`
        row.appendChild(label)
        row.appendChild(count)
        row.addEventListener('click', () => {
          if (collapsed.has(d.path)) collapsed.delete(d.path)
          else collapsed.add(d.path)
          renderRows()
        })
        rows.appendChild(row)
        if (!isCollapsed) renderDir(d, depth + 1)
      }
      const fileRows = node.files.slice().sort((a, b) => NATURAL_COLLATOR.compare(a.name, b.name))
      const strip = commonFileNamePrefix(fileRows.map(e => e.name))
      for (const entry of fileRows) rows.appendChild(renderFileRow(entry, depth, strip))
    }

    // auto-mark on play: patch the one row and its season header in place so the list does not
    // re-render (and jump back to the top) every time an episode is opened
    const autoMarkPlayed = fileId => {
      if (!autoMark || viewedSet.has(fileId)) return
      viewedSet.add(fileId)
      setViewedMark(hash, fileId, true).catch(() => {})
      refreshSeasonHeader(seasonOfFile.get(fileId))
      const row = rows.querySelector(`.tsft-act.tsft-check[data-fid="${fileId}"]`)
      if (row) {
        row.classList.add('tsft-on')
        row.title = 'Mark as unwatched'
        if (row.parentElement && row.parentElement.parentElement) {
          row.parentElement.parentElement.classList.add('tsft-viewed')
        }
      }
    }

    const renderFileRow = (entry, depth, strip, epTag) => {
      const f = entry.f
      const isMedia = isMediaFile(f)
      const watched = viewedSet.has(f.id)
      const isPicked = picked.has(f.id)
      const row = document.createElement('div')
      row.className =
        'tsft-row ' +
        (isMedia ? 'tsft-media' : 'tsft-other') +
        (watched ? ' tsft-viewed' : '') +
        (isPicked ? ' tsft-picked' : '')
      row.style.paddingLeft = 8 + depth * 18 + 'px'
      if (selectMode && isMedia) {
        const pick = document.createElement('button')
        pick.type = 'button'
        pick.className = 'tsft-pick' + (isPicked ? ' tsft-on' : '')
        pick.innerHTML = CHECK_ICON
        pick.title = isPicked ? 'Remove from playlist selection' : 'Add to playlist selection'
        pick.addEventListener('click', e => {
          e.preventDefault()
          e.stopPropagation()
          if (picked.has(f.id)) picked.delete(f.id)
          else picked.add(f.id)
          renderRows()
        })
        row.appendChild(pick)
      } else {
        const spacer = document.createElement('span')
        spacer.className = 'tsft-caret-spacer'
        row.appendChild(spacer)
      }
      const displayName = strip
        ? entry.name.slice(strip.length).replace(/^[\s\-_.]+/, '') || entry.name
        : entry.name
      if (isMedia) {
        const name = document.createElement('a')
        name.className = 'tsft-name'
        name.href = streamUrl(hash, f)
        name.target = '_blank'
        name.rel = 'noopener'
        name.textContent = epTag ? `${epTag} · ${displayName}` : displayName
        name.title = f.path
        name.addEventListener('click', () => {
          recordPlay(hash, f.id, entry.name, torrentTitle)
          autoMarkPlayed(f.id)
        })
        row.appendChild(name)
        const actions = document.createElement('span')
        actions.className = 'tsft-actions'
        const checkBtn = document.createElement('button')
        checkBtn.type = 'button'
        checkBtn.dataset.fid = String(f.id)
        checkBtn.className = 'tsft-act tsft-check' + (watched ? ' tsft-on' : '')
        checkBtn.innerHTML = CHECK_ICON
        checkBtn.title = watched ? 'Mark as unwatched' : 'Mark as watched'
        checkBtn.addEventListener('click', async e => {
          e.preventDefault()
          e.stopPropagation()
          const now = !viewedSet.has(f.id)
          if (now) viewedSet.add(f.id)
          else viewedSet.delete(f.id)
          checkBtn.classList.toggle('tsft-on', now)
          checkBtn.title = now ? 'Mark as unwatched' : 'Mark as watched'
          row.classList.toggle('tsft-viewed', now)
          refreshSeasonHeader(seasonOfFile.get(f.id))
          await setViewedMark(hash, f.id, now)
        })
        const copyBtn = document.createElement('button')
        copyBtn.type = 'button'
        copyBtn.className = 'tsft-act'
        copyBtn.innerHTML = COPY_SMALL_ICON
        copyBtn.title = 'Copy direct stream link'
        copyBtn.addEventListener('click', e => {
          e.preventDefault()
          e.stopPropagation()
          copyText(streamUrl(hash, f))
          copyBtn.classList.add('tsft-done')
          setTimeout(() => copyBtn.classList.remove('tsft-done'), 900)
        })
        const mpvA = document.createElement('a')
        mpvA.className = 'tsft-act'
        const streamHref = streamUrl(hash, f)
        mpvA.href = mpvLink(streamHref)
        mpvA.title = 'Open in MPV'
        mpvA.innerHTML = PLAY_ICON
        mpvA.addEventListener('click', e => {
          e.preventDefault()
          autoMarkPlayed(f.id)
          startLaunch({
            url: streamHref,
            copyUrl: streamHref,
            prewarmUrl: streamHref,
            hash,
            fileId: f.id,
            fileName: basename(f.path),
            title: torrentTitle,
          })
        })
        mpvA.addEventListener('mouseenter', () => scheduleHoverPrewarm(streamHref))
        mpvA.addEventListener('mouseleave', cancelHoverPrewarm)
        actions.appendChild(checkBtn)
        actions.appendChild(copyBtn)
        actions.appendChild(mpvA)
        row.appendChild(actions)
      } else {
        const name = document.createElement('span')
        name.className = 'tsft-name'
        name.textContent = displayName
        name.title = f.path
        row.appendChild(name)
      }
      const size = document.createElement('span')
      size.className = 'tsft-size'
      size.textContent = humanizeSize(f.length)
      row.appendChild(size)
      return row
    }

    renderRows()
    paper.classList.add('ts-has-tree')
    // lift the dialog's own header bar out of the row flow and pad the paper down by its height
    const bar = paper.querySelector(':scope > .MuiAppBar-root')
    if (bar) paper.style.setProperty('--tsft-head-h', bar.offsetHeight + 'px')
    const actionsEl = paper.querySelector('.MuiDialogActions-root')
    if (actionsEl) paper.insertBefore(panel, actionsEl)
    else paper.appendChild(panel)
  }

  const ensureDialogTree = async () => {
    const info = getDialogPaper()
    if (!info) return
    const { paper, hash } = info
    const existing = paper.querySelector(':scope > .ts-file-tree')
    if (existing && existing.dataset.hash === hash) return
    if (existing) {
      existing.remove()
      paper.classList.remove('ts-has-tree')
    }
    const [files, viewedSet] = await Promise.all([loadTreeFiles(hash), loadViewedSet(hash)])
    if (!files.length) return
    const fresh = getDialogPaper()
    if (!fresh || fresh.paper !== paper || fresh.hash !== hash) return
    if (paper.querySelector(':scope > .ts-file-tree')) return
    renderFileTreePanel(
      paper,
      hash,
      files,
      viewedSet,
      (fresh.torrent && fresh.torrent.title) || torrentTitleFor(hash),
    )
  }

  // ---- watch tracker (server /viewed state + local recents) ----

  const VIEWED_TTL = 30000
  const viewedCache = new Map() // hash -> { set: Set<fileIndex>, at }
  const VIEWED_KEY = 'tsWatchRecents'
  const SHELF_OFF_KEY = 'tsWatchShelfOff'
  const SHELF_MIN_KEY = 'tsWatchShelfMin'
  const CHECK_ICON = tsIcon('check')
  let watchTorrents = []

  const apiViewed = body =>
    fetchWithTimeout(
      '/viewed',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      15000,
    )

  const loadViewedSet = async hash => {
    const cached = viewedCache.get(hash)
    if (cached && Date.now() - cached.at < VIEWED_TTL) return cached.set
    let set = new Set()
    try {
      const r = await apiViewed({ action: 'list', hash })
      if (r.ok) {
        const list = await r.json()
        if (Array.isArray(list)) {
          for (const v of list) {
            if (String((v && v.hash) || '').toLowerCase() === hash.toLowerCase() && v.file_index > 0) {
              set.add(v.file_index)
            }
          }
        }
      }
    } catch (_) {}
    viewedCache.set(hash, { set, at: Date.now() })
    return set
  }

  const setViewedMark = async (hash, fileId, watched) => {
    viewedCache.delete(hash)
    try {
      await apiViewed({ action: watched ? 'set' : 'rem', hash, file_index: fileId })
    } catch (_) {}
    viewedCache.delete(hash)
  }

  const readRecents = () => {
    try {
      const arr = JSON.parse(localStorage.getItem(VIEWED_KEY) || '[]')
      return Array.isArray(arr) ? arr.filter(e => e && e.hash && e.id > 0) : []
    } catch (_) {
      return []
    }
  }

  const recordPlay = (hash, fileId, fileName, title) => {
    if (!hash || !(fileId > 0)) return
    const list = readRecents().filter(e => !(e.hash === hash && e.id === fileId))
    list.unshift({ hash, id: fileId, name: fileName || '', title: title || '', at: Date.now() })
    try {
      localStorage.setItem(VIEWED_KEY, JSON.stringify(list.slice(0, 50)))
    } catch (_) {}
  }

  const torrentTitleFor = hash => {
    const t = watchTorrents.find(x => String(x.hash || '').toLowerCase() === String(hash).toLowerCase())
    return (t && (t.title || t.name)) || ''
  }

  const timeAgo = ts => {
    const s = Math.round((Date.now() - ts) / 1000)
    if (s < 90) return 'just now'
    const m = Math.round(s / 60)
    if (m < 90) return m + ' min ago'
    const h = Math.round(m / 60)
    if (h < 36) return h + ' h ago'
    return Math.round(h / 24) + ' d ago'
  }

  // the server keeps viewed marks but no chronology, so "last watched" ordering comes from
  // plays initiated through this UI; plays we cannot see degrade to torrent-list ordering
  const b64UrlDecode = s => {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/')
    while (s.length % 4) s += '='
    try {
      return decodeURIComponent(escape(atob(s)))
    } catch (_) {
      return ''
    }
  }

  const parseStreamHref = href => {
    try {
      const u = new URL(href, window.location.origin)
      if (u.pathname.startsWith('/stream/')) {
        return { hash: u.searchParams.get('link'), index: Number(u.searchParams.get('index')) }
      }
    } catch (_) {}
    return null
  }

  const startPlayCapture = () => {
    document.addEventListener(
      'click',
      e => {
        const a = e.target && e.target.closest ? e.target.closest('a') : null
        if (!a || !a.href || a.closest('.ts-file-tree')) return // tree rows record directly
        if (a.href.startsWith('mpv-handler://play/')) {
          const inner = parseStreamHref(b64UrlDecode(a.href.slice('mpv-handler://play/'.length)))
          if (inner) recordPlay(inner.hash, inner.index, '', torrentTitleFor(inner.hash))
        } else if (a.href.includes('/stream/') && a.href.includes('index=')) {
          const q = parseStreamHref(a.href)
          if (q) recordPlay(q.hash, q.index, '', torrentTitleFor(q.hash))
        }
      },
      true,
    )
  }

  // continue-watching shelf ------------------------------------------------

  let watchShelfAt = 0
  let shelfBusy = false

  const findGridAnchor = () => {
    const btn = document.querySelector('.ts-card-copy')
    if (!btn) return null
    // the cards container is the nearest ancestor whose children are all torrent cards;
    // the shelf becomes its first child and spans the full width via grid-column: 1 / -1
    let el = btn
    for (let i = 0; i < 8 && el.parentElement && el.parentElement !== document.body; i++) {
      el = el.parentElement
      const kids = Array.from(el.children)
      if (kids.length > 0 && kids.every(c => c.querySelector && c.querySelector('.ts-card-copy'))) {
        return el
      }
    }
    return null
  }

  const stripExt = p => basename(p || '').replace(/\.[^.]+$/, '')

  const renderShelfCard = e => {
    const card = document.createElement('div')
    card.className = 'tsws-card'
    if (e.t.poster) {
      const img = document.createElement('img')
      img.className = 'tsws-poster'
      img.src = e.t.poster
      img.alt = ''
      img.addEventListener('error', () => {
        img.replaceWith(Object.assign(document.createElement('div'), { className: 'tsws-noposter' }))
      })
      card.appendChild(img)
    } else {
      card.appendChild(Object.assign(document.createElement('div'), { className: 'tsws-noposter' }))
    }
    const body = document.createElement('div')
    body.className = 'tsws-body'
    const title = document.createElement('div')
    title.className = 'tsws-title'
    title.textContent = e.t.title || e.t.name || e.hash.slice(0, 10)
    title.title = title.textContent
    const sub = document.createElement('div')
    sub.className = 'tsws-sub'
    let subText
    if (e.nextFile) subText = 'Next: ' + stripExt(e.nextFile.path)
    else if (e.allWatched) subText = 'Watched — rewatch?'
    else if (e.lastFile) subText = 'Last: ' + stripExt(e.lastFile.path)
    else subText = 'In progress'
    if (e.at && e.useRecent) subText += ' · ' + timeAgo(e.at)
    sub.textContent = subText
    sub.title = subText
    const actions = document.createElement('div')
    actions.className = 'tsws-actions'
    const mkBtn = (cls, text, href, onClick) => {
      const a = document.createElement('a')
      a.className = cls
      a.textContent = text
      a.href = href
      if (onClick) a.addEventListener('click', onClick)
      return a
    }
    if (e.nextFile && !e.allWatched) {
      const resumeUrl = playlistLink({ hash: e.hash, title: e.t.title || e.t.name }) + '&fromlast'
      const resumeBtn = mkBtn('tsws-btn tsws-resume', 'Resume', mpvLink(resumeUrl), ev => {
        ev.preventDefault()
        startLaunch({
          url: resumeUrl,
          copyUrl: resumeUrl,
          prewarmUrl: streamUrl(e.hash, e.nextFile),
          hash: e.hash,
          fileId: e.nextFile.id,
          fileName: basename(e.nextFile.path),
          title: e.t.title || e.t.name || 'Torrent',
          poster: e.t.poster || '',
        })
      })
      resumeBtn.innerHTML = `${tsIcon('play')} Resume`
      actions.appendChild(resumeBtn)
      actions.appendChild(mkBtn('tsws-btn tsws-playbtn', 'Play', streamUrl(e.hash, e.nextFile)))
      const playBtn = actions.lastElementChild
      if (playBtn) {
        playBtn.innerHTML = `${tsIcon('play')} Play`
        playBtn.target = '_blank'
        playBtn.rel = 'noopener'
      }
    } else {
      const f = e.nextFile || e.lastFile
      if (f) {
        const rewatchUrl = streamUrl(e.hash, f)
        const rewatch = mkBtn('tsws-btn tsws-resume', 'Rewatch', mpvLink(rewatchUrl), ev => {
          ev.preventDefault()
          startLaunch({
            url: rewatchUrl,
            copyUrl: rewatchUrl,
            prewarmUrl: rewatchUrl,
            hash: e.hash,
            fileId: f.id,
            fileName: basename(f.path),
            title: e.t.title || e.t.name || 'Torrent',
            poster: e.t.poster || '',
          })
        })
        rewatch.innerHTML = `${tsIcon('play')} Rewatch`
        actions.appendChild(rewatch)
      }
    }
    body.appendChild(title)
    body.appendChild(sub)
    body.appendChild(actions)
    card.appendChild(body)
    return card
  }

  const renderWatchShelf = entries => {
    const min = localStorage.getItem(SHELF_MIN_KEY) === '1'
    const sig =
      (min ? 'm' : 'x') +
      '|' +
      entries
        .map(e => e.hash + ':' + e.viewed.size + ':' + (e.nextFile ? e.nextFile.id : 'end') + ':' + (e.at ? Math.round(e.at / 60000) : 0))
        .join('|')
    let shelf = document.getElementById('ts-watch-shelf')
    if (shelf && shelf.dataset.sig === sig) return
    if (!shelf) {
      shelf = document.createElement('div')
      shelf.id = 'ts-watch-shelf'
    }
    shelf.innerHTML = ''
    shelf.dataset.sig = sig
    if (min) shelf.classList.add('tsws-collapsed')
    else shelf.classList.remove('tsws-collapsed')
    const head = document.createElement('div')
    head.className = 'tsws-head'
    const title = document.createElement('span')
    title.innerHTML = `${tsIcon('clock')} Continue watching`
    const minBtn = document.createElement('button')
    minBtn.type = 'button'
    minBtn.className = 'tsws-min'
    minBtn.innerHTML = tsIcon(min ? 'chevronRight' : 'chevronDown')
    minBtn.title = min ? 'Show the continue-watching shelf' : 'Collapse the shelf'
    minBtn.addEventListener('click', () => {
      localStorage.setItem(SHELF_MIN_KEY, min ? '0' : '1')
      renderWatchShelf(entries)
    })
    head.appendChild(title)
    head.appendChild(minBtn)
    shelf.appendChild(head)
    if (!min) {
      const row = document.createElement('div')
      row.className = 'tsws-row'
      for (const e of entries) row.appendChild(renderShelfCard(e))
      shelf.appendChild(row)
    }
    const list = findGridAnchor()
    if (!list) {
      shelf.remove()
      return
    }
    list.insertBefore(shelf, list.firstChild)
  }

  const ensureWatchShelf = async () => {
    if (shelfBusy) return
    const existing = document.getElementById('ts-watch-shelf')
    if (localStorage.getItem(SHELF_OFF_KEY) === '1') {
      if (existing) existing.remove()
      return
    }
    if (!document.querySelector('.ts-card-copy')) {
      if (existing) existing.remove()
      return
    }
    if (existing && Date.now() - watchShelfAt < VIEWED_TTL) return
    shelfBusy = true
    try {
      try {
        const list = await apiPost({ action: 'list' }, 15000).then(r => r.json())
        if (Array.isArray(list)) watchTorrents = list
      } catch (_) {}
      let marks = []
      try {
        const r = await apiViewed({ action: 'list' })
        if (r.ok) marks = await r.json()
      } catch (_) {}
      const byHash = new Map()
      for (const m of Array.isArray(marks) ? marks : []) {
        const h = String((m && m.hash) || '').toLowerCase()
        if (!h || !(m.file_index > 0)) continue
        if (!byHash.has(h)) byHash.set(h, new Set())
        byHash.get(h).add(m.file_index)
      }
      const recentAt = new Map()
      for (const e of readRecents()) if (!recentAt.has(e.hash)) recentAt.set(e.hash, e.at)
      const entries = []
      for (const t of watchTorrents) {
        const hash = String(t.hash || '').toLowerCase()
        const viewed = byHash.get(hash)
        if (!viewed || !viewed.size) continue
        const files = await loadTreeFiles(hash) // cached per hash after first fetch
        const pool = files.filter(f => isMediaFile(f)).sort((a, b) => a.id - b.id)
        const media = pool.length ? pool : files.slice().sort((a, b) => a.id - b.id)
        const lastId = Math.max(...viewed)
        const lastFile = media.find(f => f.id === lastId) || null
        const nextFile = media.find(f => f.id > lastId) || null
        const allWatched = media.length > 0 && media.every(f => viewed.has(f.id))
        entries.push({
          t,
          hash,
          viewed,
          lastFile,
          nextFile,
          allWatched,
          at: recentAt.has(hash) ? recentAt.get(hash) : (t.timestamp || 0) * 1000,
          useRecent: recentAt.has(hash),
        })
      }
      entries.sort((a, b) => (b.useRecent - a.useRecent) || ((b.at || 0) - (a.at || 0)))
      watchShelfAt = Date.now()
      renderWatchShelf(entries.slice(0, 12))
    } finally {
      shelfBusy = false
    }
  }

  const scanRoot = root => {
    const rows = new Set()
    root.querySelectorAll('button').forEach(b => {
      markDialogCopyButtons(b)
      if (b.parentElement) rows.add(b.parentElement)
    })
    rows.forEach(row => {
      if (row.querySelector(':scope > .ts-card-copy')) {
        if (!row.querySelector(':scope > .ts-card-mpv')) addMpvButton(row)
      } else if (isCardButtonsRow(row)) {
        addCardButton(row)
      }
    })
    addDialogMpvButtons(root)
    ensureQuickAdd()
  }

  let scheduled = false
  let pendingRoots = null
  const scheduleScan = mutations => {
    if (mutations) {
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          if (n.nodeType === 1) (pendingRoots || (pendingRoots = new Set())).add(n)
        }
      }
    }
    if (scheduled) return
    scheduled = true
    setTimeout(() => {
      scheduled = false
      if (pendingRoots) {
        const roots = pendingRoots
        pendingRoots = null
        roots.forEach(n => scanRoot(n))
      }
      ensureDialogTree()
      ensureWatchShelf()
    }, 200)
  }

  const start = () => {
    document.head.appendChild(css)
    document.body.appendChild(fab)
    document.body.appendChild(pasteFab)
    document.body.appendChild(shieldFab)
    applyPrivacy()
    if (!privacyImageObserver) {
      privacyImageObserver = new MutationObserver(() => {
        if (privacyEnabled) blockExternalImages()
      })
      privacyImageObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src'],
      })
    }
    startClipboardWatch()
    startPlayCapture()
    new MutationObserver(scheduleScan).observe(document.body, { childList: true, subtree: true })
    setInterval(() => {
      scanRoot(document)
      ensureDialogTree()
      ensureWatchShelf()
    }, 1000)
    scanRoot(document)
    ensureDialogTree()
    ensureWatchShelf()
  }

  if (privacyEnabled && typeof MutationObserver !== 'undefined') {
    privacyImageObserver = new MutationObserver(() => {
      if (privacyEnabled) blockExternalImages()
    })
    privacyImageObserver.observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src'],
    })
    setTimeout(() => {
      if (!privacyEnabled) return
      blockExternalImages()
      stripTrackerTags()
    }, 0)
  }

  const boot = () => {
    if (findSidebarAnchor()) start()
    else setTimeout(boot, 500)
  }
  boot()
})()
