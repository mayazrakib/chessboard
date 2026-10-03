import assert from "node:assert/strict";
import { afterEach, test, } from "node:test";

import { configure_chessboard_assets, resolve_assets, } from "../../dist/asset.js";

const DEFAULT_ASSETS = resolve_assets({},);

afterEach(() => configure_chessboard_assets(DEFAULT_ASSETS,),);

test(
    "Default assets resolve relative to the installed package.",
    () => {
        assert.equal(
            DEFAULT_ASSETS.stylesheet_url,
            new URL(
                "../../dist/style.css",
                import.meta.url,
            ).href,
        );
        assert.equal(
            DEFAULT_ASSETS.piece_sprite_url,
            new URL(
                "../../asset/pieces/pieces.svg",
                import.meta.url,
            ).href,
        );
    },
);

test(
    "Asset resolution returns independent snapshots and does not configure defaults.",
    () => {
        const resolved = resolve_assets({ stylesheet_url: "/custom.css", },);
        resolved.piece_sprite_url = "/mutated.svg";

        assert.deepEqual(
            resolve_assets({},),
            DEFAULT_ASSETS,
        );
    },
);

test(
    "Partial configuration inherits earlier values and permits disabling the stylesheet.",
    () => {
        configure_chessboard_assets({ piece_sprite_url: "https://example.org/pieces.svg", },);
        configure_chessboard_assets({ stylesheet_url: null, piece_sprite_url: undefined, },);

        assert.deepEqual(
            resolve_assets({},),
            { stylesheet_url: null, piece_sprite_url: "https://example.org/pieces.svg", },
        );
        assert.equal(
            resolve_assets({ stylesheet_url: "./local.css", },).stylesheet_url,
            "./local.css",
        );
    },
);

for (const key of ["stylesheet_url", "piece_sprite_url",]) {
    for (const invalid_url of ["", " \n\t", false, 42, {}, [],]) {
        test(
            `Asset configuration rejects ${key} with ${JSON.stringify(invalid_url,)}.`,
            () => {
                assert.throws(
                    () => configure_chessboard_assets({ [key]: invalid_url, },),
                    { name: "TypeError", message: `Failed to configure assets: ${key} must be a nonempty URL.`, },
                );
                assert.deepEqual(
                    resolve_assets({},),
                    DEFAULT_ASSETS,
                );
            },
        );
    }
}

test(
    "A rejected sprite URL cannot partially commit a stylesheet change.",
    () => {
        assert.throws(
            () => configure_chessboard_assets({ stylesheet_url: "/changed.css", piece_sprite_url: null, },),
            TypeError,
        );
        assert.deepEqual(
            resolve_assets({},),
            DEFAULT_ASSETS,
        );
    },
);
