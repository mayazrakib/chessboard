# Chessboard

`@mayazrakib/chessboard` is a framework-independent chessboard Web Component. It uses `chess.js` for standard chess rules and provides move entry, premoves, annotations, game replay, and accessible board controls. The package works in plain HTML or alongside an application framework.

## Install and display

Install the package from a registry that carries it. For a local checkout, run `npm ci` and `npm pack`, then install the archive in your application. Import the package once to register `<chess-board>`:
```sh
npm install @mayazrakib/chessboard
```
```ts
import "@mayazrakib/chessboard";
```

Give the element a width in your layout:
```html
<chess-board style="width: min(100%, 36rem)"></chess-board>
```

The root import registers the element and loads its stylesheet and piece sprite from package-relative URLs. Your bundler or static host must serve those assets. The `/core` entry point provides `define_chessboard()` and `configure_chessboard_assets()` for explicit registration and asset paths. Imports are safe without a DOM, but the board renders only in a browser.

After the element connects, `when_ready()` resolves when its stylesheet and first render are ready:
```ts
const board = document.querySelector("chess-board",);

if (!board) {
    throw new Error("Failed to find the chessboard.",);
}

await board.when_ready();
board.set_options({
    theme: "sage",
    interaction: { can_premove: true, },
},);
```

## Play and configure

Players can drag pieces, click or tap squares, or use Shift+Arrow and Enter or Space. Left and Down undo; Right and Up redo. A secondary click marks a square, and a secondary drag draws an arrow. Touch input moves pieces by default. Set `interaction.touch_mode` to `annotate` to use touch for marks and arrows.

Premoves are off by default. Set `interaction.can_premove` to `true` to queue moves for the inactive side. The queue holds up to 32 moves; an illegal next move clears the rest. `get_premoves()`, `set_premove()`, and `cancel_premove()` manage it from application code.

Use `set_options()` for partial updates and `get_options()` for a resolved snapshot. Grouped options merge, arrays replace, and an explicit `undefined` restores a default. Invalid configuration throws without applying a partial update. Common options include `theme`, `orientation`, `animation_duration`, `show_legal_moves`, `show_captured_pieces`, `quality_profile`, `sound`, `promotion`, `interaction`, and `accessibility`. `reset_options()` restores presentation and input defaults while keeping the game.

The `fen`, `orientation`, `readonly`, `coordinates`, and `theme` attributes are also observed. `readonly` disables pointer moves, keyboard move entry, and annotation gestures; programmatic moves and keyboard history navigation remain available.

`get_position()` returns Forsyth-Edwards notation (FEN). `set_position()` replaces the position and history. `get_pgn()` and `set_pgn()` read or load Portable Game Notation (PGN). `move()` and `move_uci()` apply legal moves directly, while `undo()`, `redo()`, and `seek_history()` navigate recorded moves. Invalid moves return `null` or `false` and emit `chessboard:error`; invalid options throw.

## Move approval and events

Moves commit immediately in the default `automatic` mode. In `controlled` mode, the board emits `chessboard:move_request` and waits for the application to call `commit_move()` or `reject_move()`:
```ts
board.set_options({ move_mode: "controlled", },);
board.addEventListener(
    "chessboard:move_request",
    (event,) => {
        board.commit_move(event.detail.id,);
    },
);
```

A request carries a position revision, so an old approval cannot move a newer position. In automatic mode, `preventDefault()` on the cancelable request event also leaves the move pending. Direct calls to `move()` bypass approval.

Events bubble across the shadow boundary. Listen for `chessboard:move` to receive the applied move and resulting FEN, `chessboard:position` for position loads, `chessboard:change` for revision changes, and `chessboard:gameover` for terminal states. `chessboard:premove`, `chessboard:annotations`, `chessboard:ready`, `chessboard:animation_complete`, and `chessboard:error` cover other board activity. Position-bearing events include PGN by default; `event_detail: "compact"` omits it.

## Replay, annotations, and appearance

`PgnReplay` loads a game's main line and seeks by move index. Index zero is the starting position. It rejects an external position change while the replay is active:
```ts
import { PgnReplay, } from "@mayazrakib/chessboard/replay";

const replay = new PgnReplay(
    board,
    "1. e4 e5 2. Nf3 Nc6",
);
replay.load();
replay.seek(3,);
```

Use `set_annotations(marks, group)` to replace one analysis group without clearing others. A mark with `from` and `to` is an arrow; one with only `from` marks a square. Marks can carry a color, label, source, and group. The built-in rules provider handles standard chess; `set_rules_provider()` accepts another provider within the board's 8×8, standard-piece representation.

Themes are `brown`, `sage`, `slate`, and `linen`. The `full`, `balanced`, and `minimal` quality profiles change decorative effects without changing game rules. The open shadow root exposes CSS variables such as `--chessboard-light` and `--chessboard-dark`, plus `::part()` styling hooks. Piece URLs, renderers, promotion choices, labels, sound effects, and move announcements can be configured per board. Reduced-motion preferences are respected. Piece art and sounds have separate terms in [asset licensing](asset/LICENSING.md).

## Develop and test

From a checkout, install dependencies and start the playground at `http://127.0.0.1:31415`:
```sh
npm ci
npm run dev
```

Before packaging, run the type checks, Node tests, browser tests, and clean-consumer package test:
```sh
npm run check
npm test
npm run test:browser
npm run test:package
```

Browser tests need Playwright browsers and platform dependencies. `npm pack` creates an installable archive; the package exports the root component, `/core`, `/replay`, CSS, piece artwork, and sounds. See [package.json](package.json) for exact paths. Benchmark scripts and retained measurements are in [benchmark/](benchmark/).

## License

Library code is [MIT licensed](LICENSE). CBurnett piece art and sound recordings have separate attribution and license terms in [asset licensing](asset/LICENSING.md).
