# chessboard

---

[![Testing](https://img.shields.io/badge/Testing-316%20passing-237c65)](#development-and-verification)
[![Coverage](https://img.shields.io/badge/Coverage-92.3%25-237c65)](#development-and-verification)
[![License: MIT](https://img.shields.io/badge/License-MIT-237c65)](LICENSE)

chessboard is a framework-independent web component for an elegant, highly-customizable chess board.

It features:

- Standard game rules, including castling, en passant, promotion, and game-end detection, using `chess.js`.
- Drag, click, touch, and keyboard controls, with premoves and configurable play restrictions.
- Legal move and capture hints, selection highlights, and last-move indicators.
- Position and game import/export through FEN and PGN, plus UCI move support.
- Undo, redo, move-by-move navigation, and PGN replay.
- Immediate or application-approved moves and customizable promotion choices.
- Analysis arrows and square marks with configurable colors, labels, groups, and clearing behavior.
- Captured pieces, remaining pieces, point totals, and material advantage.
- Four board themes, CBurnett vector pieces, custom artwork, and square labels or badges.
- Board flipping, optional coordinates, configurable move animations, and visual-quality profiles.
- Check and checkmate highlights, confetti, and customizable sound cues with mute and volume controls.
- Accessible navigation, optional move and annotation announcements, visible focus, reduced-motion support, and customizable language and labels.
- Framework-independent embedding for live play, analysis, training, and game viewing.

It is authored by Mayaz Rakib.

## Installation and Setup

Install the package from a registry where it is available:

```sh
npm install @mayazrakib/chessboard
```

For a checkout that has not been published, run `npm ci` and `npm pack` in this directory, then install the resulting archive in the consuming application. The package exports ECMAScript modules and TypeScript declarations.

Import the package once to register the element:

```ts
import "@mayazrakib/chessboard";
```

Give the element a width in the page layout:

```html
<chess-board
    id="board"
    orientation="white"
    style="width: min(100%, 36rem)"
></chess-board>
```

Use the typed element after registration:

```ts
const board = document.querySelector("chess-board",);

if (!board) {
    throw new Error("Failed to find the chessboard.",);
}

await board.when_ready();
board.set_options({
    theme: "sage",
    sound: { volume: 0.4, },
},);
board.addEventListener(
    "chessboard:move",
    (event,) => {
        console.log(
            event.detail.move.san,
            event.detail.fen,
        );
    },
);
```

The component loads its own shadow-root stylesheet and piece sprite using package-relative URLs. Bundlers or static hosting setups need to serve those files and the audio assets. See [registration and assets](#registration-and-assets) for explicit paths. Root and core imports are safe without a DOM, but server rendering does not instantiate or render the board.

## Interaction and Attributes

By default, users drag pieces, click or tap two squares, or navigate with Shift+Arrow keys and activate with Enter or Space. Escape cancels selection or promotion and removes one premove, newest first. When premoves are enabled, moves made with the inactive side append premoves; their preview positions support queuing successive moves with the same piece. Premoves execute in order on that side’s turns, and an illegal next move clears the remaining queue. Left or Down undoes a move; Right or Up redoes a move. A secondary click, including Control-click on a macOS trackpad, marks a square, and a secondary drag draws an arrow. Knight-move arrows follow the two-square leg first, then turn 90 degrees toward the destination; other arrows remain straight. Touch input moves pieces by default and can be configured to draw annotations instead. A primary-button press clears annotations by default.

The element observes these attributes:

| Attribute | Values | Behavior |
|---|---|---|
| `fen` | A valid FEN string | The board loads the position. |
| `orientation` | `white`, `black` | The selected side appears at the bottom. |
| `readonly` | Boolean attribute | Pointer moves, keyboard move entry, and annotation gestures are disabled. API operations and keyboard navigation/history remain available. |
| `coordinates` | `false` or another value | Coordinates are hidden only for `false`. |
| `theme` | `brown`, `sage`, `slate`, `linen` | The board selects a built-in palette. |

Runtime options control behavior directly; changing an option does not promise reflection into a corresponding HTML attribute. Set `interaction.can_use_keyboard` to `false` to disable keyboard navigation and history shortcuts as well as keyboard move entry.

## Configuration

`set_options(update)` validates and applies a partial `ChessboardOptions` object. `get_options()` returns a resolved snapshot. Objects and arrays in that snapshot can be changed without changing the board; callback identities are retained.

Grouped options merge recursively. An omitted property preserves its current value. An explicitly supplied `undefined` restores the default for that property or group. Arrays replace previous arrays. Piece and sound URL maps merge by key; an `undefined` entry restores the built-in fallback. A `null` callback disables that callback, and a `null` sound URL disables that effect. Unknown keys inside groups, invalid value types, and unsupported enum values throw `TypeError`. Numeric settings outside supported ranges throw `RangeError`. Invalid configuration does not apply other fields in the same update.

`reset_options()` restores presentation and input defaults, including the current application asset defaults. The method preserves the position, rules provider, and game history. Inline application CSS remains under application control. Top-level options such as `theme`, `orientation`, and `animation_duration` remain separate from the grouped customization options.

### General Options

| Option | Default | Behavior |
|---|---|---|
| `orientation` | `white` | The viewing side is `white` or `black`. |
| `theme` | `brown` | The palette is `brown`, `sage`, `slate`, or `linen`. |
| `quality_profile` | `full` | `full`, `balanced`, or `minimal` adjusts decorative motion, shadows, checkmate glow animation, and celebration density. |
| `interactive` | `true` | The option enables pointer and keyboard move entry and annotation gestures. Keyboard navigation and history shortcuts remain available. |
| `show_coordinates` | `true` | The board displays file and rank labels. |
| `show_captured_pieces` | `true` | The board displays material rows. |
| `captured_piece_display` | `stacked` | Captures use `stacked` icons or grouped `counts`. |
| `show_legal_moves` | `true` | Selection displays legal destination hints. |
| `show_last_move` | `true` | The previous move's origin and destination are highlighted. |
| `animation_duration` | `260` | The duration is in milliseconds. Zero disables animation; negative values become zero, and nonfinite values restore the default. |
| `playable_color` | `both` | Selection is restricted to `w`, `b`, or both colors, subject to turn and premove settings. |
| `premove_color` | Unset | A designated `w` or `b` side can select its own pieces and queue a move while inactive. |
| `move_mode` | `automatic` | Requests use `automatic` commitment or `controlled` approval. |
| `event_detail` | `full` | `full` position-bearing events include PGN; `compact` events omit PGN. |
| `is_muted` | `false` | Muting stops current audio and suppresses future playback for this board. |
| `piece_renderer` | Unset | A `(piece, square)` callback returns a DOM node or plain text. |
| `assets` | Package-relative URLs | Stylesheet and sprite overrides apply to this board. |

### Motion and Quality

The quality profile changes presentation cost without changing chess rules, board state, or the configured `animation_duration` returned by `get_options()`.

| Profile | Behavior |
|---|---|
| `full` | The board uses the configured motion duration, theme-defined shadows, 40 confetti particles, and two checkmate-glow cycles. |
| `balanced` | The board keeps the configured motion duration, uses a compact board shadow, emits 16 faster confetti particles, and runs one checkmate-glow cycle. |
| `minimal` | The board uses an effective motion duration of zero, removes board, focus, and promotion shadows, and suppresses confetti. |

Captured artwork is replaced immediately when a capture commits. The board does not retain or animate a fading copy of the captured piece, which prevents the victim from flashing above its replacement.

### Input and Annotations

`can_drag`, `can_click_move`, `can_use_keyboard`, and `can_draw_annotations` default to `true`. Premoves are disabled by default; set `interaction.can_premove` to `true` to enable them. Disabling premoves clears a queued premove. The `drag_threshold_px` default is `5`, with a supported range of `0` through `100` CSS pixels. `interaction.touch_mode` defaults to `move`; `annotate` reserves touch gestures for square marks and arrows instead of piece movement. Disabling `can_draw_annotations` disables secondary-button, Control-click, and touch annotation gestures.

`interaction.keyboard_shortcuts` contains arrays for `undo`, `redo`, `cancel`, `activate`, `left`, `right`, `up`, and `down`. Empty arrays disable a binding. Each binding uses the exact `KeyboardEvent.key`, optionally prefixed in this order: `Control+`, `Alt+`, `Meta+`, `Shift+`. Matching is case-sensitive and requires exactly those modifiers. The Space key is represented by `" "`.

The following update preserves dragging, disables click-to-move, and protects engine annotations:

```ts
board.set_options({
    interaction: {
        can_click_move: false,
        drag_threshold_px: 7,
        keyboard_shortcuts: {
            undo: ["u",],
            redo: ["r",],
        },
        touch_mode: "annotate",
    },
    annotations: {
        clear_on_left_click: "user",
        default_color: "blue",
        arrow_width_squares: 0.16,
    },
},);
```

The `annotations` group defines these settings:

| Setting | Default | Behavior |
|---|---|---|
| `clear_on_left_click` | `all` | `all` clears every annotation; `user` clears annotations whose source is user or omitted; `groups` clears groups named by `clear_groups`; `none` preserves all annotations. |
| `clear_groups` | `[]` | The array supplies exact group names for the `groups` policy. |
| `default_color` | `amber` | The color is `amber`, `blue`, `green`, or `red`. |
| `arrow_width_squares` | `0.18` | The full shaft width uses square units. Engine arrows use two-thirds of this width. |
| `arrow_head_width_squares` | `0.44` | The full arrowhead width uses square units. |
| `arrow_head_length_squares` | `0.34` | The arrowhead length uses square units. |

Each arrow dimension accepts `0.01` through `1`. One square unit equals one board square's width. Annotation policy does not change move selection or legal-move indicators.

### Accessibility Feedback

The `accessibility` group contains `announce_moves` and `announce_annotations`, both disabled by default. Enabling them sends concise updates through an internal polite live region without changing visible content. Move announcements include SAN notation and move results such as capture, promotion, check, or checkmate. Annotation announcements report the current annotation count.

```ts
board.set_options({
    accessibility: {
        announce_annotations: true,
        announce_moves: true,
    },
},);
```

The playground exposes visual quality, touch interaction, move announcements, and annotation announcements in the Customize tab.

### Pieces, Overlays, and Renderers

Artwork selection prefers `piece_renderer`, then `pieces.resolve_url(piece, square)`, then the `pieces.urls` map, and finally the bundled sprite. A null resolver result falls through to the map or sprite. Piece keys combine color and symbol: `wp`, `wn`, `wb`, `wr`, `wq`, `wk`, and their `b` equivalents. The resolver is called again when a rendered piece changes square.

The `pieces.scale` default is `1`, with a range of `0.1` through `2`. The `pieces.padding_px` default is `0`, with a range of `0` through `100`. These settings size board artwork without changing square destinations.

This example supplies custom knights and a square label:

```ts
board.set_options({
    pieces: {
        urls: {
            wn: "/pieces/white_knight.svg",
            bn: "/pieces/black_knight.svg",
        },
        scale: 0.9,
        padding_px: 2,
    },
    renderers: {
        square_overlay: (context,) => context.square === "e4" ? "Target" : null,
        material: (context,) => `${context.points} points`,
        promotion_choice: (piece,) => piece.type.toUpperCase(),
    },
},);
```

`SquareContext` contains `square`, a piece copy or `null`, a status snapshot, and `is_selected`. `MaterialContext` contains `color`, `piece_count`, `points`, signed `difference`, and recorded `captures`. Promotion renderers receive a piece copy. Rendering callbacks are synchronous and should avoid changing board state. Return a fresh DOM node for each location; a DOM node cannot belong to multiple locations simultaneously.

Strings render as text, never HTML. Callback failures emit `chessboard:error` and use fallback content. Overlay `null` results produce no content, and overlays do not intercept pointer events. Default captured-piece icons use the sprite; a material renderer can provide a complete alternative material presentation.

### Promotion

`promotion.mode` defaults to `choose`, `promotion.choices` defaults to `["q", "r", "b", "n",]`, and `promotion.default_piece` defaults to `q`. Choices must be unique and nonempty. `automatic` selects the default piece, which must be included in the configured choices.

External mode delegates the choice to application UI:

```ts
board.set_options({
    promotion: {
        mode: "external",
        request: (
            request,
            complete,
        ) => {
            const dialog = document.createElement("button",);
            dialog.textContent = `Promote the pawn on ${request.to} to a queen`;
            dialog.addEventListener(
                "click",
                () => {
                    complete("q",);
                    dialog.remove();
                },
                { once: true, },
            );
            document.body.append(dialog,);
        },
    },
},);
```

Call `complete(null,)` to cancel. Completions after a position change, cancellation, replacement, or earlier completion are ignored. The application owns external UI cleanup and accessibility. A selected promotion enters the ordinary move-request pipeline, including controlled approval. Direct API moves specify their promotion explicitly.

### Localization

`labels` supports `board`, `promotion`, `white`, `black`, `no_captures`, `captures_description`, and `material_description`. English defaults remain for labels that are not replaced.

Formatting callbacks cover dynamic descriptions:

| Callback | Arguments | Returned text |
|---|---|---|
| `format_square` | `square`, `piece`, `is_selected`, `is_legal`, `is_check`, `default_label` | The square's accessible description. The default label also contains capture, premove, and checkmate details. |
| `format_promotion` | `piece` | The promotion button's accessible description. |
| `format_material` | `context` | The visible remaining-material summary. |
| `format_material_label` | `context`, `default_label` | The material row's accessible description. |
| `format_capture` | `color`, `piece`, `count`, `default_label` | The captured-piece group's accessible description and title. |
| `format_advantage` | `difference`, `default_label` | The material advantage title. |
| `format_error` | `reason`, `message` | The error event's message. |

The application supplies complete translations through callbacks. The library does not bundle locale dictionaries. Label callbacks return strings; failures retain readable fallback descriptions.

### Sound

All sounds use Lichess Standard recordings without audio changes. Check, checkmate, win, loss, and draw share the original Lichess notification recording. Playback volume defaults to `0.6`. Lichess lists its Standard assets among its non-free exceptions; [asset licensing](asset/LICENSING.md) records their source and licensing status.

The `sound` group defines these settings:

| Setting | Default | Behavior |
|---|---|---|
| `volume` | `0.6` | The playback level accepts `0` through `1`. |
| `player_color` | `null` | `w` or `b` selects a player's perspective. Checkmate plays `win` or `lose`; `null` plays the neutral `checkmate` effect. |
| `urls` | `{}` | Keys are `move`, `capture`, `check`, `checkmate`, `draw`, `win`, and `lose`. A URL replaces the recording; `null` suppresses it. |
| `enabled` | Every effect is `true` | A partial map enables or suppresses individual effects. |
| `should_play_on_moves` | `true` | The preference covers committed moves and explicit playback using the default category. |
| `should_play_on_history` | `true` | The preference covers undo, redo, and ordinary single-step history seeks. |
| `should_play_on_replay` | `true` | The preference covers single-step `PgnReplay` seeks. |

A completed move selects one effect in this order: checkmate or player result, draw, check, capture, then move. Castling uses move feedback. En passant uses capture feedback unless a higher-priority result applies. Loading positions or games, jumping across multiple history positions, pending requests, and queued premoves remain silent.

Configure feedback for a white player:

```ts
board.set_options({
    sound: {
        player_color: "w",
        volume: 0.4,
        enabled: { check: false, },
        should_play_on_replay: false,
    },
},);

board.play_sound("win",);
```

Explicit playback is useful for application-owned results such as resignation or time expiration. The board does not infer those results. `play_sound()` honors muting, the effect switch, recording overrides, and the selected operation preference. `set_muted(true,)` immediately stops playback; `is_muted()` reads the state. Settings are independent across boards.

Browser autoplay restrictions can prevent playback before user interaction. Blocked sounds are discarded, and unexpected media failures emit `audio_failed`. The playground's Effects tab previews sounds and board effects. The Customize tab controls volume and result perspective. The package exports recordings under `@mayazrakib/chessboard/audio/*.mp3`.

## Public Methods

The following methods belong to `ChessboardElement`. Type definitions and JSDoc in [the component](src/chessboard.ts) describe event details and exceptional cases.

| Method | Result and behavior |
|---|---|
| `get_position()` | The method returns the current FEN string. |
| `set_position(fen)` | The method returns success as a boolean. Success replaces the position and clears earlier history. Invalid input emits an error and preserves the game. |
| `get_pgn()` | The method returns the recorded game as PGN. |
| `set_pgn(pgn)` | The method returns success as a boolean and replaces history with the parsed game. Invalid input preserves the game. |
| `move(input)` | The method returns a move or `null`. Input contains `from`, `to`, and optional `promotion`. Direct moves bypass controlled approval. |
| `move_uci(text)` | The method returns a legal coordinate move or `null`. Promotion notation includes the final piece, such as `a7a8n`. |
| `get_legal_moves(square?)` | The method returns legal move objects for the current side, optionally restricted to one origin. |
| `get_uci_moves()` | The method returns recorded coordinate moves. |
| `get_uci_position()` | The method returns an engine-ready position command. |
| `request_move(input, source?)` | The method returns a request or `null`; automatic mode commits an uncancelled request. |
| `get_pending_move()` | The method returns the pending request snapshot or `null`. |
| `commit_move(request_id)` | The method applies a current request and returns a move or `null`. |
| `reject_move(request_id)` | The method rejects a matching pending request and returns whether it was rejected. |
| `undo(source?)`, `redo(source?)` | The methods return the reversed or reapplied move, or `null` when unavailable. |
| `seek_history(index, sound_category?)` | The method returns whether the cursor changed. The index is an integer from zero through retained history length. The sound category is `history` by default or `replay`. |
| `get_history_state()` | The method returns the cursor index, history length, and undo/redo availability. |
| `get_turn()`, `get_status()` | The methods return the active color and a game-status snapshot. |
| `get_revision()` | The method returns the position revision used to detect stale work. Presentation changes do not advance it. |
| `get_options()`, `set_options(update)` | The methods read resolved configuration or apply a validated partial update. |
| `reset_options()` | The method restores presentation and interaction defaults while preserving game state and rules. |
| `flip()` | The method changes the viewing side. |
| `get_assets()`, `set_assets(update)` | The methods read or update stylesheet and sprite URLs. |
| `is_muted()`, `set_muted(is_muted)` | The methods read or change per-board muting. |
| `play_sound(sound, category?)` | The method requests a named effect. The category is `moves` by default, `history`, or `replay`. Unknown sound names throw `TypeError`. |
| `get_premove()`, `set_premove(input, source?)` | The getter reads the next premove. The setter appends a move; `null` clears the queue. It returns whether the update was accepted. Up to 32 moves can be queued. |
| `get_premoves()`, `cancel_premove(source?)` | Read the queue in execution order or remove its newest entry. Queue snapshots are independent copies. |
| `get_annotations(group?)` | The method returns annotation copies, optionally filtered by group. |
| `set_annotations(marks, group?, source?)` | The method replaces all annotations or one group's annotations. |
| `add_annotation(mark)` | The method normalizes and adds a mark, returning its annotation. |
| `update_annotation(id, update)` | The method updates a matching annotation and returns it, or `null` if absent. |
| `remove_annotation(id)` | The method removes an annotation and returns whether it existed. |
| `clear_annotations(group?)` | The method clears one group or every group. |
| `get_marks()`, `set_marks(marks)`, `clear_marks()` | These compatibility methods use the same annotation state. |
| `when_ready()` | The promise resolves after connection, stylesheet loading, and initial rendering, or rejects if stylesheet loading fails. |
| `when_animation_complete()` | The promise resolves when tracked animations settle. |
| `create_game(fen?)` | The method returns an independent game from the selected rules provider without changing the board. |
| `set_rules_provider(provider?, fen?)` | The method installs a provider and position, clearing history and pending input. Omission restores standard rules and uses the current FEN. |

Programmatic move methods remain available on read-only boards. Invalid moves and notation generally return `null` or `false` and emit `chessboard:error`; invalid configuration and out-of-range history indices throw. Consult each method's contract before treating an operation as successful.

### Controlled Moves

Controlled mode lets application code approve moves after validation or server coordination:

```ts
board.set_options({ move_mode: "controlled", },);
board.addEventListener(
    "chessboard:move_request",
    (event,) => {
        const request = event.detail;
        const move = board.commit_move(request.id,);

        if (!move) {
            console.log("The move request is no longer current.",);
        }
    },
);
```

The `chessboard:move_request` event is cancelable in automatic mode. Calling `preventDefault()` retains the request for explicit approval or rejection. Position revisions and request identifiers prevent old approvals from committing against a newer position. Applications can defer approval until their own asynchronous work finishes.

### Annotations and Material

An annotation contains `from` and optional `to`, `id`, `group`, `label`, `color`, and `source`. Omitting `to` produces a square mark. Sources are `user` or `engine`; groups are application-defined strings. Missing identifiers are assigned automatically.

Replace one analysis group without disturbing other groups:

```ts
board.set_annotations(
    [
        {
            from: "e2",
            to: "e4",
            color: "green",
            source: "engine",
            label: "Candidate move",
        },
    ],
    "analysis",
);
board.clear_annotations("analysis",);
```

Material counts pawns as one point, knights and bishops as three, rooks as five, queens as nine, and kings as zero. Rows follow orientation. Capture history comes from recorded moves, including PGN; a FEN contains no capture history. Set `show_captured_pieces` to `false` to remove both material rows from the layout.

## Styling

The component uses an open shadow root. Override CSS custom properties on the host or style a supported part:

```css
chess-board {
    --chessboard-light: #ede8dc;
    --chessboard-dark: #80937e;
    --chessboard-focus-color: #2459ad;
    --chessboard-overlay-color: #142d45;
}

chess-board::part(promotion-panel) {
    border-radius: 12px;
}
```

Public custom properties are listed below; [the stylesheet](src/style.css) defines their defaults.

| Area | Properties |
|---|---|
| Board | `--chessboard-light`, `--chessboard-dark`, `--chessboard-frame`, `--chessboard-frame-width`, `--chessboard-radius`, `--chessboard-shadow` |
| Coordinates | `--chessboard-coordinate-opacity`, `--chessboard-coordinate-weight`, `--chessboard-coordinate-size` |
| State | `--chessboard-selected`, `--chessboard-last-move`, `--chessboard-premove`, `--chessboard-check`, `--chessboard-check-outline`, `--chessboard-focus-color` |
| Move hints | `--chessboard-marker`, `--chessboard-capture-marker` |
| Annotations | `--chessboard-mark-amber`, `--chessboard-mark-blue`, `--chessboard-mark-green`, `--chessboard-mark-red` |
| Material | `--chessboard-material-color`, `--chessboard-material-muted` |
| Overlays | `--chessboard-overlay-color`, `--chessboard-overlay-font-size` |
| Motion | `--chessboard-animation-duration`, `--chessboard-hint-duration`, `--chessboard-state-duration`, `--chessboard-motion-easing` |

The `pieces` options manage `--chessboard-piece-scale` and `--chessboard-piece-padding` on the internal board. The animation option manages motion tokens. Use those options when changing the corresponding behavior at runtime.

Supported parts are `board`, `board-surface`, `square`, `piece`, `hint`, `square-focus`, `square-status`, `annotations`, `annotation`, `square-overlay`, `promotion-layer`, `promotion-panel`, `promotion-choice`, and `material`. Part names are styling hooks; changing geometry or pointer behavior through CSS can affect interactions. Internal class names are not a stable styling contract.

## Events

Events bubble and cross the shadow boundary. The root and core entry points augment `HTMLElementEventMap` with typed details.

| Event | Detail or purpose |
|---|---|
| `chessboard:ready` | The detail contains the revision sampled at readiness. |
| `chessboard:animation_complete` | The detail contains the revision after tracked motion settles. |
| `chessboard:move_request` | The cancelable event contains a request identifier, move input, source, and revision. |
| `chessboard:move_request_end` | The detail identifies committed, rejected, or stale request completion. |
| `chessboard:move` | The detail contains the applied move and resulting position metadata. |
| `chessboard:position` | The detail contains FEN and, in full-detail mode, PGN. |
| `chessboard:change` | The detail contains the revision, reason, source, and position metadata. |
| `chessboard:select` | The detail contains the selected square or `null`. |
| `chessboard:premove` | The detail is the next queued move or `null`; call `get_premoves()` for the complete queue. |
| `chessboard:annotations` | The detail contains normalized annotation copies and change metadata. |
| `chessboard:marks` | The detail contains compatibility mark copies. |
| `chessboard:gameover` | The detail contains terminal status and change metadata after a completed move. |
| `chessboard:error` | The detail contains a reason and message. Reasons are `illegal_move`, `invalid_position`, `invalid_pgn`, `render_failed`, and `audio_failed`. |

Invalid option updates throw directly. An asset-load failure rejects readiness. These paths do not use the error event as a replacement for their documented return value or exception.

## Replay and Rules Providers

`PgnReplay` parses PGN without initially changing the board. Load the replay before seeking:

```ts
import { PgnReplay, } from "@mayazrakib/chessboard/replay";

const replay = new PgnReplay(
    board,
    "1. e4 e5 2. Nf3 Nc6 3. Bb5",
);

replay.load();
replay.seek(3,);
```

The controller exposes `moves`, `pgn`, `title`, `starting_position`, `get_index()`, and `has_current_position()`. It rejects out-of-range indices and external position changes. The cursor counts applied moves, so zero is the starting position. It follows the PGN main line and does not provide a variation-tree editor.

`RulesProvider.create_game(fen?)` supplies independent `RulesGame` instances. The [rules contract](src/rules.ts) uses the chess.js signatures for board access, moves, history, status, FEN, PGN, and headers. Move objects must retain their chess.js-compatible metadata and move-classification methods. Every factory call must return an independent game.

Install an adapter through `set_rules_provider(provider, fen)`. Replacing the provider clears history, pending requests, selection, and premoves. Replay parsing and later FEN and PGN loads use the installed provider. The built-in `STANDARD_RULES_PROVIDER` remains the default.

The renderer retains an 8×8 board, algebraic squares, white and black colors, and standard piece symbols. A provider can adapt rule behavior within those representations; the interface does not imply support for arbitrary board sizes, drop zones, or new piece types. The application is responsible for a provider's rule correctness and notation compatibility.

## Registration and Assets

Use the core entry point when the application needs explicit registration or asset paths:

```ts
import {
    configure_chessboard_assets,
    define_chessboard,
} from "@mayazrakib/chessboard/core";

configure_chessboard_assets({
    piece_sprite_url: "/assets/chess/pieces.svg",
    stylesheet_url: "/assets/chess/style.css",
},);

define_chessboard();
```

Global asset defaults affect later resolutions; existing boards retain their resolved assets. `set_assets()` and the `assets` option override one board. A `null` stylesheet URL disables automatic stylesheet loading. Applications providing their own complete stylesheet can also populate the open shadow root.

Package exports include the root component, `/core`, `/replay`, `/style.css`, `/pieces.svg`, `/pieces/cburnett/*.svg`, and `/audio/*.mp3`. The [package manifest](package.json) defines exact paths. Individual CBurnett filenames use forms such as `white_knight.svg` and `black_queen.svg`.

## Development and Verification

Run these commands from the package directory after `npm ci`:

| Command | Purpose |
|---|---|
| `npm run dev` | The command starts the playground at `http://127.0.0.1:31415`. |
| `npm run check` | The command type-checks the library, demo, and tool configuration. |
| `npm run build` | The command builds JavaScript, declarations, CSS, and the piece sprite. |
| `npm test` | The command builds the library and runs unit and integration tests. |
| `npm run test:unit` | The command runs unit tests after building. |
| `npm run test:integration` | The command runs Happy DOM integration tests after building. |
| `npm run coverage` | The command builds, runs unit and integration tests with V8 coverage, and refreshes reports and snapshot badges. |
| `npx playwright install --with-deps` | The command installs browser engines and their platform dependencies. |
| `npm run test:browser` | The command runs Chromium, Firefox, and WebKit regression projects. |
| `npm run test:package` | The command packs the library, installs it into a clean temporary consumer, and verifies every public entry point, asset export, and package-size budget. |
| `npm run test:all` | The command runs Node and browser tests. |
| `npm run test:release` | The command runs type checks, Node tests, all browser projects, and the clean-consumer package smoke test. |
| `npm pack` | The command runs the packaging checks and creates an installable archive. |

Coverage reports are written to `coverage/`, including the measurement summary. The coverage script updates the Shields.io badges in this README. The testing badge counts unit and integration tests, and the coverage badge measures `dist/*.js`; neither includes browser tests or playground code. Line coverage does not establish browser behavior or rule completeness. Browser verification includes functional, accessibility, performance-budget, and Chromium visual-regression checks.

Benchmark scripts live in [benchmark/scripts/](benchmark/scripts/), and retained measurements live in [benchmark/results/](benchmark/results/). Benchmark outcomes depend on browser, hardware, board size, and test conditions; saved results are measurements rather than performance guarantees.

## Licensing

Library code uses the [MIT License](LICENSE). CBurnett piece artwork has separate attribution and Creative Commons terms in [asset licensing](asset/LICENSING.md). Sound licenses and attribution are documented in [asset licensing](asset/LICENSING.md).
