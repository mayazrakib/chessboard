# `chessboard`

![Version](https://img.shields.io/badge/Version-1.0.1-737373?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-737373?style=flat-square)
![Languages](https://img.shields.io/badge/Languages-TypeScript%2C%20JavaScript-737373?style=flat-square)
![Frameworks](https://img.shields.io/badge/Frameworks-Web%20Components%2C%20chess.js%2C%20React-737373?style=flat-square)
![Compatibility](https://img.shields.io/badge/Compatibility-Not%20verified-737373?style=flat-square)
![Build](https://img.shields.io/badge/Build-Not%20verified-737373?style=flat-square)
![Tests](https://img.shields.io/badge/Tests-316%20unit%20and%20integration%20passing-737373?style=flat-square)
![Vulnerabilities](https://img.shields.io/badge/Vulnerabilities-0%20known%20dependency%20findings-737373?style=flat-square)

## 1. Introduction

`@mayazrakib/chessboard` is a framework-independent Web Component for playing, annotating, and replaying chess games. [Open the playground](https://playground.mayazrakib.com/chessboard/).

## 2. Usage

Install the package:

```sh
npm install @mayazrakib/chessboard
```

Render the element:

```html
<chess-board style="width: min(100%, 36rem)"></chess-board>
```

Import the package once in your bundled code, and await `board.when_ready()` before calling the board's API:

```js
import "@mayazrakib/chessboard";

const board = document.querySelector("chess-board");
await board.when_ready();
```

To work from a checkout, install Node.js 24.22.0, npm 11.19.1, and Task 3.54.0. Then use `npm ci`, `npm run dev`, `npm test`, `npm run test:browser`, and `npm run test:package`. `npm pack` creates the distributable archive.

## 3. Features

- Dragging, clicking, touch, and keyboard moves.
- Premoves and controlled moves.
- Annotations, PGN replay, and undo and redo.
- Brown, sage, slate, and linen themes.

Shift+Arrow and Enter or Space move pieces. Left or Down undoes a move, and Right or Up redoes it. A secondary click marks a square, and a secondary drag draws an arrow.

The API includes `set_options()`, `get_options()`, `get_position()`, `set_position()`, `get_pgn()`, `set_pgn()`, `move()`, `move_uci()`, `undo()`, `redo()`, `seek_history()`, and `set_annotations()`. Controlled moves emit `chessboard:move_request` and resolve through `commit_move()` or `reject_move()`.

## 4. Architecture

`src/index.ts`, `src/core.ts`, and `src/replay.ts` are the public entry points. Rules, configuration, element lifecycle, rendering, interaction, assets, and audio live in separate internal modules. `showcase/` holds the React playground, and `tests/` holds unit, integration, browser, and profiling checks.

Public package export specifiers stay stable, and compiled npm exports keep `dist/` for compatibility. Piece artwork lives in `assets/images/pieces/`, audio in `assets/audio/`, and legal notices in `assets/LICENSING.md`.

## 5. Dependencies

| Dependency | Version | Use |
|---|---|---|
| `chess.js` | 1.4.0 | Runtime: chess rules |
| `@base-ui/react` | 1.9.0 | Development: playground interface primitives |
| `@fontsource-variable/geist` | 5.3.0 | Development: playground font |
| `@playwright/test` | 1.64.1 | Development: browser tests |
| `@tailwindcss/vite` | 4.3.3 | Development: Tailwind CSS integration for Vite |
| `@types/node` | 26.6.5 | Development: Node.js type declarations |
| `@types/react` | 19.3.0 | Development: React type declarations |
| `@types/react-dom` | 19.3.0 | Development: React DOM type declarations |
| `@vitejs/plugin-react` | 6.1.2 | Development: React support for Vite |
| `class-variance-authority` | 0.7.1 | Development: playground component variants |
| `cn` | 0.4.0 | Development: class name composition |
| `happy-dom` | 21.0.4 | Development: DOM test environment |
| `lucide-react` | 1.61.0 | Development: playground icons |
| `react` | 19.3.1 | Development: playground rendering |
| `react-dom` | 19.3.1 | Development: playground DOM rendering |
| `shadcn` | 4.22.1 | Development: component scaffolding |
| `tailwindcss` | 4.3.3 | Development: playground styling |
| `tw-animate-css` | 1.4.0 | Development: animation utilities |
| `typescript` | 5.9.3 | Development: compilation and type checks |
| `vite` | 8.3.5 | Development: playground server and bundling |

## 6. Roadmap

- [x] Web Component, controlled moves, replay, and playground.
- [ ] Verify browser and native consumers independently for each release.

## 7. Contributing

Read `AGENTS.md` and the applicable skills in `.ai/skills/` before contributing. Set up the development environment with `npm ci`. Follow the repository conventions, preserve supported behavior, and add relevant tests for behavior changes. Run `npm test` and `npm run build` before opening a pull request. Describe the change, its purpose, and the validation results in the pull request.

## 8. License

`chessboard` is licensed under the MIT license. See LICENSE for the complete license text.
