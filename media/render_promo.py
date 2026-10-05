"""Render the TorrServer ++ promo loop.

Usage:
  python render_promo.py stills          # one PNG per beat + seam pair
  python render_promo.py full [a b]      # 4 subframes per frame at 240 Hz (frame range optional)
  python render_promo.py encode          # ffmpeg tmix -> mp4, then palette GIF
"""
import sys, pathlib, shutil, subprocess

MEDIA = pathlib.Path(__file__).resolve().parent
HTML = MEDIA / 'promo-loop.html'
TMP = MEDIA / 'render_tmp'
PREV = MEDIA / 'render_preview'
FPS, SUB, DUR = 60, 4, 16


def open_page(p):
    try:
        browser = p.chromium.launch()
    except Exception:
        browser = p.chromium.launch(channel='msedge')
    page = browser.new_page(viewport={'width': 1920, 'height': 1080}, device_scale_factor=1)
    page.goto(HTML.as_uri())
    page.evaluate('() => document.fonts.ready')
    page.evaluate('t => window.seek(t)', 0)
    return browser, page


def stills():
    PREV.mkdir(exist_ok=True)
    times = [1.2, 4.3, 6.9, 9.4, 11.9, 14.5, 15.6, 0.0, 15.996]
    with sync_playwright() if False else _pw() as p:
        browser, page = open_page(p)
        for t in times:
            page.evaluate('t => window.seek(t)', t)
            page.screenshot(path=str(PREV / ('beat_%s.png' % str(t).replace('.', '_'))), type='png')
        browser.close()
    print('stills done')


def full(a=0, b=DUR * FPS):
    TMP.mkdir(exist_ok=True)
    with _pw() as p:
        browser, page = open_page(p)
        for f in range(a, b):
            t0 = f / FPS
            for k in range(SUB):
                page.evaluate('t => window.seek(t)', t0 + k / (FPS * SUB))
                page.screenshot(path=str(TMP / ('sub_%06d.jpg' % (f * SUB + k))), type='jpeg', quality=90)
            if f % 60 == 0:
                print('frame', f, flush=True)
        browser.close()
    print('subframes done')


def encode():
    mp4 = MEDIA / 'promo-loop.mp4'
    subprocess.run([
        'ffmpeg', '-y', '-framerate', str(FPS * SUB), '-i', str(TMP / 'sub_%06d.jpg'),
        '-vf', "tmix=frames=4:weights='1 1 1 1',fps=%d,format=yuv420p" % FPS,
        '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', str(mp4)
    ], check=True)
    gif = MEDIA / 'promo-loop.gif'
    subprocess.run([
        'ffmpeg', '-y', '-i', str(mp4),
        '-vf', ('fps=24,scale=960:540:flags=lanczos,split[a][b];'
                '[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle'),
        '-loop', '0', str(gif)
    ], check=True)
    print('encoded', mp4.name, gif.name)


from contextlib import contextmanager
from playwright.sync_api import sync_playwright


@contextmanager
def _pw():
    with sync_playwright() as p:
        yield p


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'stills'
    if mode == 'stills':
        stills()
    elif mode == 'full':
        a = int(sys.argv[2]) if len(sys.argv) > 2 else 0
        b = int(sys.argv[3]) if len(sys.argv) > 3 else DUR * FPS
        full(a, b)
    elif mode == 'encode':
        encode()
