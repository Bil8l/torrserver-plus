// ==UserScript==
// @name         TorrServer ++
// @namespace    torrserver-ui-plus
// @version      1.0.2
// @description  Adds Copy link and MPV buttons to every torrent card (left click: playlist, right click: pick an episode), plus per-file MPV in the details dialog, and Quick add: paste info hashes or magnets, trackers are appended and they go straight to your server, with optional clean-name and cover lookup (TMDB, AniList, iTunes). A floating + button lights up when the clipboard holds a hash or magnet. Clipboard is read locally only. MPV playback needs mpv-handler installed.
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
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict'

  // ======================= tweak these lines =======================
  const ACCENT = '#7be3c3' // highlight colour for Copy link buttons
  const ACCENT_HOVER_BG = 'rgba(123, 227, 195, 0.25)'
  // MPV open-in-player scheme:
  //   'handler' = akiirui/mpv-handler v0.4+  (mpv-handler://play/<url-safe base64>)
  //   'legacy'  = older mpv-handler          (mpv://play/<url-safe base64>)
  //   'raw'     = simple custom registry     (mpv://<url>, VLC-style)
  const MPV_SCHEME = 'handler'
  const MPV_ACCENT = '#571358' // dark purple for solid MPV buttons
  const MPV_ACCENT_LIGHT = '#c983cd' // lightened tint of MPV_ACCENT for text/borders on the dark theme
  // =====================================================================

  const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window
  if (W.__TS_UI_PLUS) return
  W.__TS_UI_PLUS = true

  const COPY_LINK_LABELS = [
    'copy link', // en
    'копиране линк', // bg
    'copier le lien', // fr
    'copiați link-ul', // ro
    'копировать', // ru
    'копіювати', // ua
    '复制链接', // zh
  ]

  const VIDEO_EXT = /\.(mp4|mkv|avi|mov|wmv|flv|ts|m2ts|mts|webm|m4v|mpg|mpeg|ogv|3gp|vob|divx)$/i
  const LINK_ICON =
    '<svg class="MuiSvgIcon-root" viewBox="0 0 24 24" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>'
  const FLASH_ICON =
    '<svg class="MuiSvgIcon-root" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>'
  const PLAY_ICON =
    '<svg class="MuiSvgIcon-root" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'

  const css = document.createElement('style')
  css.textContent = `
    /* recolour "Copy link" buttons inside the details dialog */
    .ts-dialog-copy {
      color: ${ACCENT} !important;
      border-color: ${ACCENT} !important;
    }
    .ts-dialog-copy:hover {
      border-color: ${ACCENT} !important;
      background: ${ACCENT_HOVER_BG} !important;
    }
    /* the new card button */
    .ts-card-copy {
      background: ${ACCENT} !important;
      color: #1a1a1a !important;
    }
    .ts-card-copy:hover {
      filter: brightness(1.15);
    }
    .ts-card-mpv { background: ${MPV_ACCENT} !important; color: #f1eff3 !important; }
    .ts-card-mpv:hover { filter: brightness(1.08); }
    .ts-mpv-link button {
      color: ${MPV_ACCENT_LIGHT} !important;
      border-color: ${MPV_ACCENT_LIGHT} !important;
    }
    .ts-mpv-link button:hover { background: rgba(201, 131, 205, 0.15) !important; }
    /* episode/file picker for multi-file torrents */
    #ts-mpv-menu {
      position: fixed; z-index: 3000;
      background: #323637; color: #f1eff3; border-radius: 8px; padding: 8px;
      box-shadow: 0 11px 15px -7px rgba(0,0,0,.2), 0 24px 38px 3px rgba(0,0,0,.14);
      max-height: 65vh; overflow-y: auto; min-width: 340px; max-width: 60vw;
    }
    #ts-mpv-menu .ts-mpv-item {
      display: flex; justify-content: space-between; align-items: center; gap: 14px;
      padding: 8px 10px; border-radius: 5px; cursor: pointer; font-size: 13px;
    }
    #ts-mpv-menu .ts-mpv-item:hover { background: #545a5e; }
    #ts-mpv-menu .ts-mpv-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #ts-mpv-menu .ts-mpv-size { color: #dee3e5; font-size: 11px; white-space: nowrap; }
    /* the card buttons row switches to a 4-column grid on narrow screens; fit however many buttons exist */
    @media (max-width: 1260px), (max-height: 500px) {
      .ts-has-copy {
        grid-template-columns: repeat(auto-fit, minmax(0, 1fr)) !important;
      }
    }
    /* cards grow to fit the extra buttons instead of clipping the last one
       (wide layout only; the narrow layout manages its own row heights) */
    @media (min-width: 1261px) and (min-height: 501px) {
      div:has(> .ts-has-copy) {
        grid-template-rows: auto !important;
      }
    }
    /* quick add dialog + toast */
    #tsqa-overlay {
      position: fixed; inset: 0; z-index: 3000;
      background: rgba(0, 0, 0, 0.55);
      display: flex; align-items: center; justify-content: center;
    }
    .tsqa-panel {
      background: #323637; color: #f1eff3; border-radius: 8px; padding: 20px;
      width: min(540px, calc(100vw - 40px));
      box-shadow: 0 11px 15px -7px rgba(0,0,0,.2), 0 24px 38px 3px rgba(0,0,0,.14), 0 9px 46px 8px rgba(0,0,0,.12);
      font-family: Roboto, sans-serif;
    }
    .tsqa-title {
      font-size: 15px; font-weight: 600; letter-spacing: .3px;
      margin-bottom: 12px; text-transform: uppercase;
    }
    .tsqa-textarea {
      width: 100%; box-sizing: border-box; min-height: 110px;
      background: #545a5e; color: #f1eff3;
      border: 1px solid #656f76; border-radius: 5px; padding: 10px;
      font-size: 13px; line-height: 1.4; resize: vertical; outline: none;
    }
    .tsqa-textarea:focus { border-color: ${ACCENT}; }
    .tsqa-info { font-size: 12px; color: #dee3e5; margin: 8px 2px 10px; min-height: 15px; }
    .tsqa-info.tsqa-error { color: #ff8a93; }
    .tsqa-auto {
      display: flex; align-items: center; gap: 8px;
      font-size: 12px; color: #dee3e5; margin: 0 2px 12px; cursor: pointer; user-select: none;
    }
    .tsqa-auto input { accent-color: ${ACCENT}; cursor: pointer; }
    .tsqa-row { display: flex; gap: 10px; justify-content: flex-end; }
    .tsqa-row button {
      border: none; border-radius: 5px; padding: 9px 20px; cursor: pointer;
      text-transform: uppercase; font-size: 12px; font-weight: 600; letter-spacing: .4px;
    }
    .tsqa-row button:disabled { opacity: .6; cursor: wait; }
    .tsqa-paste, .tsqa-clear { background: #545a5e; color: #f1eff3; }
    .tsqa-paste { margin-right: auto; }
    .tsqa-paste:hover, .tsqa-clear:hover { filter: brightness(1.15); }
    .tsqa-add { background: ${ACCENT}; color: #1a1a1a; }
    .tsqa-cancel { background: transparent; color: #dee3e5; border: 1px solid #656f76 !important; }
    .tsqa-toast {
      position: fixed; right: 24px; bottom: 96px; z-index: 3001;
      background: ${ACCENT}; color: #1a1a1a; padding: 12px 18px; border-radius: 5px;
      font-size: 13px; box-shadow: 0 4px 10px rgba(0,0,0,.3);
    }
    .tsqa-toast-error { background: #c82e3f; color: #fff; }
    /* green accent on the sidebar Quick add entry */
    .ts-quick-add [class*="MuiListItemIcon"],
    .ts-quick-add [class*="MuiListItemText"] {
      color: ${ACCENT} !important;
    }
    /* persistent floating Quick add button */
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
    #ts-fab .ts-fab-badge {
      position: absolute; top: 4px; right: 4px;
      width: 13px; height: 13px; border-radius: 50%;
      background: #fff; border: 2px solid #323637;
      display: none;
    }
  `

  // ---- React internals: read the torrent object a card was rendered from ----
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

  // ---- link building, mirrors the app's own "Copy link"/"Playlist" behaviour ----
  const basename = p => p.split('\\').pop().split('/').pop()
  const filesFromData = data => {
    try {
      return JSON.parse(data).TorrServer.Files || []
    } catch (_) {
      return []
    }
  }
  const getPlayableFiles = torrent =>
    ((torrent.file_stats && torrent.file_stats.length ? torrent.file_stats : filesFromData(torrent.data)) || []).filter(
      f => VIDEO_EXT.test(f.path || ''),
    )
  const directLink = (torrent, f) =>
    `${window.location.origin}/stream/${encodeURIComponent(basename(f.path))}?link=${torrent.hash}&index=${f.id}&play`
  const playlistLink = torrent => {
    const label = torrent.title || torrent.name || 'file'
    return `${window.location.origin}/stream/${encodeURIComponent(label)}.m3u?link=${torrent.hash}&m3u`
  }

  // ---- MPV: build the protocol URL for a stream link ----
  const toB64Url = s =>
    btoa(unescape(encodeURIComponent(s)))
      .replace(/\//g, '_')
      .replace(/\+/g, '-')
      .replace(/=+$/, '')
  const mpvLink = url => {
    if (MPV_SCHEME === 'raw') return `mpv://${url}`
    const data = toB64Url(url)
    return MPV_SCHEME === 'legacy' ? `mpv://play/${data}` : `mpv-handler://play/${data}`
  }

  // ---- clipboard with fallbacks (TorrServer on a LAN IP is not a secure context) ----
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

  // ---- cards: the buttons column of each card is a div of <button><svg/><span>… ----
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
      )
    })
    row.insertBefore(btn, row.children[1])

    // MPV button: left click plays the playlist, right click picks an episode
    const playable = getPlayableFiles(torrent)
    if (playable.length >= 1) {
      const mpvBtn = detailsBtn.cloneNode(true)
      mpvBtn.classList.add('ts-card-mpv')
      mpvBtn.removeAttribute('title')
      mpvBtn.innerHTML = `${PLAY_ICON}<span>MPV</span>`
      mpvBtn.title = 'Left click: play the playlist in MPV · Right click: pick an episode'
      mpvBtn.addEventListener('click', e => {
        e.stopPropagation()
        const torrentNow = findTorrent(row)
        if (!torrentNow) return
        window.location.href = mpvLink(playlistLink(torrentNow))
      })
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
            window.location.href = mpvLink(directLink(t || torrentNow, f))
          },
        )
      })
      row.insertBefore(mpvBtn, row.children[2])
    }

    row.classList.add('ts-has-copy')
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

  let fileMenuEl = null
  const closeFileMenu = () => {
    if (fileMenuEl) {
      fileMenuEl.remove()
      fileMenuEl = null
    }
  }
  // file picker used by the card buttons: right-click menu → pick a file → onPick(file, torrent)
  const openFileMenu = (anchor, getTorrent, files, onPick) => {
    closeFileMenu()
    const menu = document.createElement('div')
    menu.id = 'ts-mpv-menu'
    files.forEach(f => {
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
    })
    document.body.appendChild(menu)
    fileMenuEl = menu
    const r = anchor.getBoundingClientRect()
    const mw = menu.offsetWidth || 420
    const mh = menu.offsetHeight || 240
    menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - mw - 12)) + 'px'
    menu.style.top = Math.min(r.bottom + 6, window.innerHeight - mh - 8) + 'px'
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

  // ---- details dialog: recolour every "Copy link" button ----
  const isCopyLinkText = text => COPY_LINK_LABELS.includes((text || '').trim().toLowerCase())
  const markDialogCopyButtons = btn => {
    if (btn.classList.contains('ts-dialog-copy')) return
    if (!/MuiButton/.test(btn.className)) return
    const label = (btn.querySelector('.MuiButton-label') || btn).textContent
    if (isCopyLinkText(label)) btn.classList.add('ts-dialog-copy')
  }

  // ==================== quick add: hash -> magnet -> server ====================
  // default tracker list for hash-only pastes
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

  const buildMagnet = hash =>
    `magnet:?xt=urn:btih:${hash.toLowerCase()}` +
    TRACKERS.map(t => `&tr=${encodeURIComponent(t)}`).join('')

  const completeMagnet = magnet => {
    const missing = TRACKERS.filter(t => !magnet.toLowerCase().includes(t.toLowerCase()))
    return magnet + missing.map(t => `&tr=${encodeURIComponent(t)}`).join('')
  }

  const extractTorrentLinks = text => {
    const links = []
    let rest = String(text || '')
    for (const m of rest.match(MAGNET_RE) || []) links.push(completeMagnet(m.trim()))
    rest = rest.replace(MAGNET_RE, ' ')
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
      r = await apiPost({ action: 'add', link, save_to_db: true }, 30000)
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

  // ==================== auto: clean name + fetch cover ====================
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

  const RES_RE = /\b(2160p|1080p|720p|576p|480p)\b/i
  const YEAR_RE = /\b(19\d{2}|20\d{2})\b/
  const SE_RE = /\bS(\d{1,2})E(\d{1,3})\b/i
  const JUNK_TOKEN_RE =
    /^(?:season|complete|web|web-?dl|web-?rip|bluray|blu-?ray|bdrip|bdmv|bdremux|brrip|remux|dvd|dvdrip|hd-?dvd|hdtv|hdrip|hdr10?|dv|dolby|vision|atmos|x264|x265|h\.?264|h\.?265|hevc|avc|av1|aac|ac3|eac3|e-?ac-?3|dts(?:-?hd|-?ma|-?x)?|truehd|flac|mp3|opus|ddp|dd\+|10bit|8bit|hi10|multi|dual(?:audio)?|dubbed|subbed|subs?|proper|repack|extended|unrated|remastered|imax|yts(?:\.gg|\.bz|am)?|yify|eztv|rarbg|rartvx?|tgx|galaxyrg|mkvcage|psa|ettv|amzn|nf|atvp|dsnp|hmax|pmtp|stp|funi|crunchyroll|hidive|uhd|sdr|internal|limited|hybrid|ger|dub|german|eng|rus|jpn|ita|fre|spa|kor|chi)$/i
  const JUNK_TOKEN_PATTERNS = [/^s\d{1,2}(?:[-e]\d{1,3})+$/i, /^s\d{1,2}$/i, /^e\d{1,3}$/i, /^[\d.\-]+$/]

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
    return { title, full, se: !!se }
  }

  const gmJson = url =>
    new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest === 'function') {
        GM_xmlhttpRequest({
          method: 'GET',
          url,
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

  // fresh magnet adds carry the placeholder title "infohash<hash>" until metadata arrives,
  // never treat that as a usable name
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
          // both name and title carry the "infohash<hash>" placeholder until metadata arrives
          if (st.name && !isPlaceholderTitle(st.name, hash)) {
            return { raw: st.name, category: st.category || '', poster: st.poster || '' }
          }
          if (st.title && !isPlaceholderTitle(st.title, hash)) {
            return { raw: st.title, category: st.category || '', poster: st.poster || '' }
          }
        }
      } catch (_) {}
      await sleep(1000)
    }
    throw new Error('no metadata within 90 s, paste the hash again later')
  }

  const anilistPoster = query =>
    new Promise((resolve, reject) => {
      const body = JSON.stringify({
        query:
          'query ($s: String) { Page(page: 1, perPage: 3) { media(search: $s, type: ANIME) { coverImage { large } } } }',
        variables: { s: query },
      })
      if (typeof GM_xmlhttpRequest === 'function') {
        GM_xmlhttpRequest({
          method: 'POST',
          url: 'https://graphql.anilist.co',
          data: body,
          headers: { 'Content-Type': 'application/json' },
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

  const findCover = async (query, isSeries) => {
    // 1) TMDB, same source the app's own Add dialog uses; only works when an API key is configured
    try {
      const s = await fetch('/tmdb/settings').then(r => r.json())
      if (s && s.APIKey) {
        const base = (s.APIURL || 'https://api.themoviedb.org').replace(/\/+$/, '').replace(/\/3.*$/, '')
        const img = (s.ImageURL || 'https://image.tmdb.org').replace(/\/+$/, '')
        const data = await gmJson(
          `${base}/3/search/multi?api_key=${encodeURIComponent(s.APIKey)}&query=${encodeURIComponent(query)}`,
        )
        const hit = (data.results || []).find(el => el.poster_path)
        if (hit) return img + '/t/p/w300' + hit.poster_path
      }
    } catch (_) {}
    // 2) AniList, keyless and strong for anime
    try {
      const data = await anilistPoster(query)
      const media = (data && data.data && data.data.Page && data.data.Page.media) || []
      const hit = media.find(m => m.coverImage && m.coverImage.large)
      if (hit) return hit.coverImage.large
    } catch (_) {}
    // 3) iTunes public search, keyless but only covers Apple's store catalog
    for (const entity of isSeries ? ['tvSeason', 'movie'] : ['movie', 'tvSeason']) {
      try {
        const data = await gmJson(
          `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=${entity}&limit=5`,
        )
        const hit = (data.results || []).find(el => el.artworkUrl100)
        if (hit) return hit.artworkUrl100.replace(/\/\d+x\d+bb/, '/600x600bb')
      } catch (_) {}
    }
    return ''
  }

  const autoFixTorrent = async hash => {
    const meta = await fetchTorrentMeta(hash)
    const clean = cleanTorrentName(meta.raw)
    if (!clean) throw new Error(`could not parse name "${meta.raw}"`)
    const poster = await findCover(clean.title, clean.se)
    const r = await apiPost({
      action: 'set',
      hash,
      title: clean.full,
      poster: poster || meta.poster,
      category: meta.category,
    })
    if (!r.ok) throw new Error('set failed (HTTP ' + r.status + ')')
    return { title: clean.full, poster: poster || meta.poster }
  }

  const runAutoFix = hashes => {
    ;(async () => {
      let okCount = 0
      let coverCount = 0
      const fails = []
      for (const h of hashes) {
        try {
          const r = await autoFixTorrent(h)
          okCount++
          if (r.poster) coverCount++
        } catch (e) {
          fails.push(`${h.slice(0, 8)}… ${e.message}`)
        }
      }
      if (okCount) {
        toast(
          coverCount
            ? `Clean name applied to ${okCount} torrent${okCount > 1 ? 's' : ''} (cover: ${coverCount}/${okCount})`
            : `Clean name applied to ${okCount} torrent${okCount > 1 ? 's' : ''}, no cover found`,
        )
      }
      if (fails.length) toast(fails.join(' · '), true)
    })()
  }

  const openQuickAdd = prefill => {
    if (document.getElementById('tsqa-overlay')) return
    const overlay = document.createElement('div')
    overlay.id = 'tsqa-overlay'
    overlay.innerHTML = `
      <div class="tsqa-panel" role="dialog" aria-label="Quick add torrent">
        <div class="tsqa-title">Quick add: hash to magnet</div>
        <textarea class="tsqa-textarea" placeholder="Paste a hash, a magnet link, or any text containing hashes, one or more. Trackers are added automatically."></textarea>
        <div class="tsqa-info">&nbsp;</div>
        <label class="tsqa-auto"><input type="checkbox"> Auto: clean name &amp; fetch cover</label>
        <div class="tsqa-row">
          <button class="tsqa-paste" type="button">Paste</button>
          <button class="tsqa-clear" type="button">Clear</button>
          <button class="tsqa-cancel" type="button">Cancel</button>
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
    // always closable: a hung request must never trap the user
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
        info.textContent = 'No 40-character hash or magnet link found'
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
        info.textContent = 'No 40-character hash or magnet link found'
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
        // hard failsafe: never leave the dialog stuck in "Adding…"
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

  // sidebar button: clone the app's own "Add Torrent" list item for identical styling
  const ADD_LABELS = [
    'add torrent', // en
    'добавете торент', // bg
    'ajouter un torrent', // fr
    'adăugați torrent', // ro
    'добавить', // ru
    'додати торент', // ua
    '添加种子', // zh
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
    // auto-paste: if the clipboard already holds a hash/magnet, open the dialog with it filled in
    li.addEventListener('click', async () => {
      let text = ''
      try {
        if (navigator.clipboard && navigator.clipboard.readText) text = await navigator.clipboard.readText()
      } catch (_) {}
      openQuickAdd(text && extractTorrentLinks(text).length ? text : '')
    })
    anchor.after(li)
  }

  // persistent floating Quick add button; the badge lights up when the clipboard
  // holds a hash or magnet, and clicking pre-fills from the clipboard
  const PLUS_ICON =
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>'
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

  const startClipboardWatch = () => {
    if (!navigator.clipboard || !navigator.clipboard.readText) return // insecure HTTP, browser blocks reading
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
      fab.title = hasTorrent ? 'Quick add: hash/magnet found on the clipboard' : 'Quick add torrent'
      return true
    }

    // keep the badge current
    setInterval(() => {
      if (!document.hidden) readClipboard()
    }, 2000)

    // browsers only allow the first read inside a user gesture (this is what shows the
    // "see copied text" permission prompt), so piggyback on clicks until granted
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

  // ---- details dialog: per-file "MPV" button, cloned from the row's Open link anchor,
  // placed right after the row's Copy link button ----
  const addDialogMpvButtons = () => {
    document.querySelectorAll('a[href*="/stream/"]:not([href*=".m3u"])').forEach(a => {
      const container = a.parentElement
      if (!container || container.querySelector(':scope > .ts-mpv-link')) return
      if (!/index=/.test(a.href)) return // only per-file stream links
      const mpv = a.cloneNode(true)
      mpv.classList.add('ts-mpv-link')
      mpv.href = mpvLink(a.href)
      mpv.removeAttribute('target')
      mpv.removeAttribute('rel')
      mpv.title = 'Open in MPV player'
      const label = mpv.querySelector('[class*="MuiButton-label"]')
      if (label) label.textContent = 'MPV'
      const copyBtn = container.querySelector('.ts-dialog-copy')
      const copyWrap = copyBtn && copyBtn.closest('span')
      if (copyWrap && copyWrap.parentElement === container) copyWrap.after(mpv)
      else container.appendChild(mpv)
    })
  }

  // ---- scan + observer ----
  const scan = () => {
    document.querySelectorAll('button').forEach(b => {
      const row = b.parentElement
      if (row && !row.querySelector(':scope > .ts-card-copy') && isCardButtonsRow(row)) addCardButton(row)
      markDialogCopyButtons(b)
    })
    addDialogMpvButtons()
    ensureQuickAdd()
  }

  let scheduled = false
  const scheduleScan = () => {
    if (scheduled) return
    scheduled = true
    setTimeout(() => {
      scheduled = false
      scan()
    }, 200)
  }

  // ---- boot: everything runs only once the app's sidebar is detected, so the
  // script stays inert on any other page that happens to be served on the same port ----
  const start = () => {
    document.head.appendChild(css)
    document.body.appendChild(fab)
    startClipboardWatch()
    new MutationObserver(scheduleScan).observe(document.body, { childList: true, subtree: true })
    scan()
  }

  const boot = () => {
    if (findSidebarAnchor()) start()
    else setTimeout(boot, 500)
  }
  boot()
})()
