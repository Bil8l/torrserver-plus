# TorrServer ++

Browser userscript for the TorrServer web UI (tested with MatriX). It adds a few things the stock interface is missing:

- **Copy link** button on every torrent card. Left click copies the playlist (`.m3u`) link, right click picks a single episode and copies its direct stream link.
- **MPV** button on every card and next to every file in the details dialog. Left click plays the whole playlist in mpv, right click picks one episode.
- **Quick add**: paste one or more 40 character info hashes or magnet links, the script builds full magnets with trackers and adds them straight to your server. Auto mode rewrites the title into the app's usual format (`Title SxxEyy (Year) [resolution]`) and fetches a cover from TMDB, AniList or iTunes.
- A floating **+** button that lights up when your clipboard holds a hash or magnet, and opens Quick add prefilled.
- Recolors the **Copy link** buttons inside the details dialog.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Edge) or [Violentmonkey](https://violentmonkey.github.io/) (Firefox).
2. Install the script from Greasy Fork: `PASTE GREASYFORK LINK HERE`, or from the `.user.js` file in this repository.
3. Open your TorrServer page. The script activates once the UI loads.

The script matches `localhost:8090` and any other host on port `8090`. If your server runs on a different port, edit the `@match` lines at the top of the script.

## MPV playback (optional)

The MPV buttons need [mpv-handler](https://github.com/akiirui/mpv-handler) installed on the machine that runs your browser. Without it, clicking MPV does nothing because no app is registered for the `mpv-handler://` protocol.

The default config works with mpv-handler v0.4 and newer. For older versions set `MPV_SCHEME = 'legacy'` in the config block at the top of the script.

## Quick add

Paste any text containing info hashes or `magnet:` links. Duplicates are removed, trackers are appended, and the torrents go straight to your server. With "Auto: clean name & fetch cover" checked, the script waits for metadata, renames the torrent in the app's card format, and picks the best cover it can find.

Cover sources, in order: TMDB (only if your server has a TMDB API key configured), AniList, iTunes Search.

## Privacy

- The script reads your clipboard locally every couple of seconds so the floating button can light up. Clipboard content never leaves your machine.
- Torrents are posted only to your own TorrServer.
- Poster lookups send the cleaned release title to AniList, iTunes or TMDB. That is the only outbound traffic.
- No analytics, no ads, no tracking, no accounts.

## Troubleshooting

- **No buttons appear**: make sure you are on the TorrServer web page itself and that its port is `8090`, or edit the `@match` lines.
- **MPV click does nothing**: mpv-handler is not installed or not registered. Reinstall it and restart the browser.
- **The floating button never lights up**: browsers block clipboard reading on plain HTTP. Allow the "see text copied to the clipboard" permission when the browser asks, or just open Quick add and press `Ctrl+V`.
- **Dialog Copy link buttons are not recolored**: your UI language is not in the label list (English, Bulgarian, French, Romanian, Russian, Ukrainian, Chinese). Everything else works regardless.

## License

MIT. See [LICENSE](LICENSE).
