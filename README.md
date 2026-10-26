# `chessboard`

![Version](https://img.shields.io/badge/Version-1.0.1-737373?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-737373?style=flat-square)
![Languages](https://img.shields.io/badge/Languages-TypeScript%2C%20JavaScript-737373?style=flat-square)
![Frameworks](https://img.shields.io/badge/Frameworks-Web%20Components%2C%20chess.js%2C%20React-737373?style=flat-square)
![Compatibility](https://img.shields.io/badge/Compatibility-Not%20verified-737373?style=flat-square)
![Build](https://img.shields.io/badge/Build-Not%20run%20remotely-737373?style=flat-square)
![Tests](https://img.shields.io/badge/Tests-316%20unit%20and%20integration%20passing-737373?style=flat-square)
![Vulnerabilities](https://img.shields.io/badge/Vulnerabilities-0%20known%20dependency%20findings-737373?style=flat-square)

## 1. Introduction

`@mayazrakib/chessboard` is a framework-independent Web Component for playing, annotating, and replaying chess games. [Open the playground](https://playground.mayazrakib.com/chessboard/).

## 2. Usage

Install with `npm install @mayazrakib/chessboard`. Import `@mayazrakib/chessboard` once and render `<chess-board style="width: min(100%, 36rem)"></chess-board>`. Await `board.when_ready()` before calling its API.

From a checkout, use `npm ci`, `npm run dev`, `npm test`, `npm run test:browser`, and `npm run test:package`. `npm pack` creates the distributable archive.

## 3. Features

Dragging, clicking, touch, keyboard moves, premoves, controlled moves, annotations, PGN replay, undo/redo, and brown/sage/slate/linen themes are implemented. Shift+Arrow and Enter/Space move pieces; Left/Down undo and Right/Up redo. Secondary click marks squares; secondary drag draws arrows.

Use `set_options()`, `get_options()`, `get_position()`, `set_position()`, `get_pgn()`, `set_pgn()`, `move()`, `move_uci()`, `undo()`, `redo()`, `seek_history()`, and `set_annotations()`. Controlled moves emit `chessboard:move_request` and resolve through `commit_move()` or `reject_move()`.

## 4. Architecture

`src/index.ts`, `src/core.ts`, and `src/replay.ts` preserve the public entry points. Internal rules, configuration, element lifecycle, rendering, interaction, assets, and audio have separate modules. `showcase/` contains the React playground, and `tests/` contains unit, integration, browser, and profiling checks.

Public package export specifiers remain stable. Compiled npm exports retain `dist/` for compatibility. Piece artwork lives in `assets/images/pieces/`, audio in `assets/audio/`, and legal notices in `assets/LICENSING.md`.

## 5. Dependencies

| Dependency | Version | Use |
|---|---|---|
| `chess.js` | `1.4.0` | runtime |
| `@base-ui/react` | `1.9.0` | development and build |
| `@fontsource-variable/geist` | `5.3.0` | development and build |
| `@playwright/test` | `1.64.1` | development and build |
| `@tailwindcss/vite` | `4.3.3` | development and build |
| `@types/node` | `26.6.5` | development and build |
| `@types/react` | `19.3.0` | development and build |
| `@types/react-dom` | `19.3.0` | development and build |
| `@vitejs/plugin-react` | `6.1.2` | development and build |
| `class-variance-authority` | `0.7.1` | development and build |
| `cn` | `0.4.0` | development and build |
| `happy-dom` | `21.0.4` | development and build |
| `lucide-react` | `1.61.0` | development and build |
| `react` | `19.3.1` | development and build |
| `react-dom` | `19.3.1` | development and build |
| `shadcn` | `4.22.1` | development and build |
| `tailwindcss` | `4.3.3` | development and build |
| `tw-animate-css` | `1.4.0` | development and build |
| `typescript` | `5.9.3` | development and build |
| `vite` | `8.3.5` | development and build |

## 6. Roadmap

- [x] Web Component, controlled moves, replay, and playground.
- [ ] Verify browser and native consumers independently for each release.

## 7. Contributing

Read `AGENTS.md` and the applicable skills in `.ai/skills/` before contributing. Set up the development environment with `npm ci`. Follow the repository conventions, preserve supported behavior, and add relevant tests for behavior changes. Run `npm test` and `npm run build` before opening a pull request. Describe the change, its purpose, and the validation results in the pull request.

## 8. License

`chessboard` is licensed under the MIT license. See LICENSE for the complete license text.

See `ACKNOWLEDGEMENTS.md` for third-party notices and attributions.
