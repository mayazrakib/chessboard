---
name: repo-maintenance
description: "Maintain the chessboard repository and verify its supported development workflows."
---

## 1. Scope

Use when maintaining this repository or its independently configured projects.

## 2. Procedure

- Initialize with `npm ci`; run `npm run check`, `npm test`, `npm run test:browser`, and `npm run test:package` for affected package changes.
- Preserve published `dist/` exports, custom-element interfaces, events, asset subpaths, and the `@mayazrakib/chessboard` package contract. Repository compatibility rules permit the published output paths instead of a cosmetic `build/` move; verify with the build and package smoke test.
- Preserve `assets/LICENSING.md` and the separately attributed chess-piece assets when changing package contents.
