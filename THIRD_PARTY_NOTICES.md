# Third-party notices

## Coucou

Notchy's island window follows the approach of Coucou's Windows app
(<https://github.com/Louis-CFM/coucou>), and these parts are adapted from its
source code:

- `src-tauri/src/island.rs` — placement, the cursor poll and click-through
- `src-tauri/src/webview_drop.rs` — file drops taken by WebView2
- `src-tauri/src/media.rs` — reading the Windows media session (from `spotify.rs`)
- `src/core/anim.ts` — the springs and close curve
- `src/core/fsm.ts` — the open/close state machine (rewritten, same model)

Only Coucou's **code** is used, under its MIT License below. Notchy uses none of
Coucou's name, character, icon, sounds or other artwork.

```
MIT License

Copyright (c) 2026 Louis Raillé

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## LRCLIB

Synced lyrics come from [LRCLIB](https://lrclib.net), a free, open lyrics
database. Notchy asks it for the song playing and shows what it returns.
