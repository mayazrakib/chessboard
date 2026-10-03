import type { ChessboardAssets, } from "./types.js";

const DEFAULT_ASSETS: Required<ChessboardAssets> = {
    stylesheet_url: new URL(
        "./style.css",
        import.meta.url,
    ).href,
    piece_sprite_url: new URL(
        "../asset/pieces/pieces.svg",
        import.meta.url,
    ).href,
};
let configured_assets = { ...DEFAULT_ASSETS, };

export function resolve_assets(assets: ChessboardAssets,): Required<ChessboardAssets> {
    const resolved = { ...configured_assets, };

    for (const key of ["stylesheet_url", "piece_sprite_url",] as const) {
        const url = assets[key];

        if (url === undefined) {
            continue;
        }

        if (key === "stylesheet_url" && url === null) {
            resolved.stylesheet_url = null;
            continue;
        }

        if (typeof url !== "string" || !url.trim()) {
            throw new TypeError(`Failed to configure assets: ${key} must be a nonempty URL.`,);
        }

        resolved[key] = url;
    }

    return resolved;
}

export function configure_chessboard_assets(assets: ChessboardAssets,): void {
    configured_assets = resolve_assets(assets,);
}
