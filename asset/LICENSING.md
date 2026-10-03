# Chessboard Licensing
The `@mesonsystems/chessboard` package includes library code, chess-piece artwork, and audio under different licenses. The MIT license for the library code does not replace the licenses for bundled artwork or audio. This document describes the bundled files; the linked license texts provide their terms.

## Library Code
Mayaz Rakib licenses the library code under the [MIT License](../LICENSE). The license file includes the copyright notice for Mayaz Rakib.

## Cburnett Chess Pieces
Colin M. L. Burnett, known as Cburnett, created the chess-piece artwork. The Wikimedia Commons source pages below identify the author, file history, and available licenses. This package uses the artwork under the [Creative Commons Attribution-ShareAlike 3.0 Unported license](https://creativecommons.org/licenses/by-sa/3.0/), one of the licenses offered on those pages.

The [standalone SVG files](pieces/cburnett/) use descriptive filenames for the white and black pieces. The [generated sprite](pieces/pieces.svg) wraps their SVG contents in named symbols and changes indentation. The artwork in both forms remains covered by CC BY-SA 3.0.

The source pages for the twelve pieces are:

| Piece | Light source | Dark source |
|---|---|---|
| Pawn | [Light pawn](https://commons.wikimedia.org/wiki/File:Chess_plt45.svg) | [Dark pawn](https://commons.wikimedia.org/wiki/File:Chess_pdt45.svg) |
| Knight | [Light knight](https://commons.wikimedia.org/wiki/File:Chess_nlt45.svg) | [Dark knight](https://commons.wikimedia.org/wiki/File:Chess_ndt45.svg) |
| Bishop | [Light bishop](https://commons.wikimedia.org/wiki/File:Chess_blt45.svg) | [Dark bishop](https://commons.wikimedia.org/wiki/File:Chess_bdt45.svg) |
| Rook | [Light rook](https://commons.wikimedia.org/wiki/File:Chess_rlt45.svg) | [Dark rook](https://commons.wikimedia.org/wiki/File:Chess_rdt45.svg) |
| Queen | [Light queen](https://commons.wikimedia.org/wiki/File:Chess_qlt45.svg) | [Dark queen](https://commons.wikimedia.org/wiki/File:Chess_qdt45.svg) |
| King | [Light king](https://commons.wikimedia.org/wiki/File:Chess_klt45.svg) | [Dark king](https://commons.wikimedia.org/wiki/File:Chess_kdt45.svg) |

## Lichess Standard Sounds
All bundled sounds use recordings from the Lichess Standard sound set at [Lichess revision `4f00b4643caf30918303b30adcfbe0cbb2eff8a8`](https://github.com/lichess-org/lila/tree/4f00b4643caf30918303b30adcfbe0cbb2eff8a8). The five bundled MP3 files are unchanged from upstream apart from their filenames.

The [upstream licensing notice](https://github.com/lichess-org/lila/blob/4f00b4643caf30918303b30adcfbe0cbb2eff8a8/COPYING.md) lists sounds outside its named free sets under “Exceptions (non-free).” The Standard set falls within that exception. The notice does not provide a specific reuse license or identify the individual creators of these recordings. These files are not represented here as MIT, AGPL-3.0-or-later, or CC0 assets. Their presence in the Lichess repository does not establish an open-source license for them.

The following table records the bundled files and the upstream sound mapping:

| Bundled file | Upstream file | Board effects |
|---|---|---|
| [move.mp3](audio/move.mp3) | [standard/Move.mp3](https://github.com/lichess-org/lila/blob/4f00b4643caf30918303b30adcfbe0cbb2eff8a8/public/sound/standard/Move.mp3) | Move |
| [capture.mp3](audio/capture.mp3) | [standard/Capture.mp3](https://github.com/lichess-org/lila/blob/4f00b4643caf30918303b30adcfbe0cbb2eff8a8/public/sound/standard/Capture.mp3) | Capture |
| [check.mp3](audio/check.mp3) | [standard/GenericNotify.mp3](https://github.com/lichess-org/lila/blob/4f00b4643caf30918303b30adcfbe0cbb2eff8a8/public/sound/standard/GenericNotify.mp3) | Check |
| [checkmate.mp3](audio/checkmate.mp3) | [standard/GenericNotify.mp3](https://github.com/lichess-org/lila/blob/4f00b4643caf30918303b30adcfbe0cbb2eff8a8/public/sound/standard/GenericNotify.mp3) | Checkmate |
| [notification.mp3](audio/notification.mp3) | [standard/GenericNotify.mp3](https://github.com/lichess-org/lila/blob/4f00b4643caf30918303b30adcfbe0cbb2eff8a8/public/sound/standard/GenericNotify.mp3) | Win, loss, and draw |

The upstream Standard files `Victory.mp3`, `Defeat.mp3`, and `Draw.mp3` all link to `GenericNotify.mp3`. The bundled notification preserves that shared recording without trimming, pitch changes, fades, or re-encoding.

The check and checkmate files are exact copies of the bundled notification. This package uses that recording for both events instead of the upstream Standard check and checkmate mappings.
