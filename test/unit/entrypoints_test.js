import assert from "node:assert/strict";
import { execFileSync, } from "node:child_process";
import { test, } from "node:test";

import { create_dom_environment, } from "./dom.js";

create_dom_environment();

test(
    "Core import is registration-free, while the default entry point registers exactly once.",
    async () => {
        const core = await import("../../dist/core.js",);

        assert.equal(
            customElements.get("chess-board",),
            undefined,
        );

        const entrypoint = await import("../../dist/index.js",);

        assert.equal(
            customElements.get("chess-board",),
            core.ChessboardElement,
        );

        for (const name of ["ChessboardElement", "PgnReplay", "configure_chessboard_assets", "define_chessboard", "STANDARD_RULES_PROVIDER",]) {
            assert.equal(
                entrypoint[name],
                core[name],
            );
        }

        assert.doesNotThrow(() => core.define_chessboard(),);
        assert.ok(document.createElement("chess-board",) instanceof core.ChessboardElement,);
    },
);

for (const entrypoint of ["core", "index", "replay",]) {
    test(
        `The ${entrypoint} entry point imports safely without browser globals.`,
        () => {
            const module_url = new URL(
                `../../dist/${entrypoint}.js`,
                import.meta.url,
            ).href;
            const source = [
                'import assert from "node:assert/strict";',
                "",
                "assert.equal(",
                "    globalThis.document,",
                "    undefined,",
                ");",
                `const entrypoint = await import(${JSON.stringify(module_url,)},);`,
                "",
                "assert.equal(",
                "    typeof entrypoint.PgnReplay,",
                '    "function",',
                ");",
                "entrypoint.define_chessboard?.();",
                "",
            ].join("\n",);

            assert.doesNotThrow(() => execFileSync(
                process.execPath,
                ["--input-type=module", "--eval", source,],
                { encoding: "utf8", timeout: 10000, },
            ),);
        },
    );
}
