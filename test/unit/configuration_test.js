import assert from "node:assert/strict";
import { test, } from "node:test";

import { matches_shortcut, resolve_customization, } from "../../dist/configuration.js";

for (const changes of [
    { interaction: { drag_threshold_px: -1, }, },
    { interaction: { touch_mode: "invalid", }, },
    { accessibility: { announce_moves: 1, }, },
    { interaction: { can_drag: 1, }, },
    { interaction: { keyboard_shortcuts: { undo: [1,], }, }, },
    { interaction: { unknown: true, }, },
    { pieces: { scale: Infinity, }, },
    { pieces: { urls: { xx: "/piece.svg", }, }, },
    { pieces: { urls: { wp: " ", }, }, },
    { pieces: { resolve_url: "image", }, },
    { sound: { volume: 1.1, }, },
    { sound: { urls: { move: false, }, }, },
    { sound: { enabled: { move: 0, }, }, },
    { annotations: { clear_on_left_click: "invalid", }, },
    { annotations: { clear_groups: [null,], }, },
    { annotations: { arrow_width_squares: 0, }, },
    { promotion: { choices: [], }, },
    { promotion: { choices: ["q", "q",], }, },
    { promotion: { mode: "external", }, },
    { promotion: { mode: "automatic", choices: ["n",], }, },
    { labels: { board: null, }, },
    { renderers: { square_overlay: {}, }, },
]) {
    test(
        `Invalid customization is rejected: ${JSON.stringify(changes,)}.`,
        () => {
            const previous = resolve_customization({},);
            const snapshot = resolve_customization(
                {},
                previous,
            );

            assert.throws(() => resolve_customization(
                changes,
                previous,
            ),);
            assert.deepEqual(
                previous,
                snapshot,
            );
        },
    );
}

test(
    "Nested updates merge, explicit undefined restores defaults, and arrays replace earlier bindings.",
    () => {
        const first = resolve_customization({
            interaction: { can_drag: false, keyboard_shortcuts: { undo: ["u",], }, },
            pieces: { urls: { wn: "/knight.svg", }, },
            sound: { volume: 0.4, enabled: { check: false, }, },
        },);
        const second = resolve_customization(
            {
                interaction: { can_drag: undefined, keyboard_shortcuts: { redo: ["r",], }, },
                pieces: { urls: { bn: "/black_knight.svg", }, },
                sound: { volume: undefined, },
            },
            first,
        );

        assert.equal(
            second.interaction.can_drag,
            true,
        );
        assert.deepEqual(
            second.interaction.keyboard_shortcuts.undo,
            ["u",],
        );
        assert.deepEqual(
            second.interaction.keyboard_shortcuts.redo,
            ["r",],
        );
        assert.equal(
            second.pieces.urls.wn,
            "/knight.svg",
        );
        assert.equal(
            second.sound.volume,
            0.6,
        );
        assert.equal(
            second.sound.enabled.check,
            false,
        );
        second.interaction.keyboard_shortcuts.undo.push("z",);
        second.pieces.urls.wn = "/changed.svg";

        assert.deepEqual(
            first.interaction.keyboard_shortcuts.undo,
            ["u",],
        );
        assert.equal(
            first.pieces.urls.wn,
            "/knight.svg",
        );
        assert.equal(
            resolve_customization(
                { sound: undefined, },
                first,
            ).sound.enabled.check,
            true,
        );
    },
);

test(
    "Keyboard shortcuts require exact modifiers and support empty bindings.",
    () => {
        const event = { key: "z", ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, };

        assert.equal(
            matches_shortcut(
                event,
                ["Control+Shift+z",],
            ),
            true,
        );
        assert.equal(
            matches_shortcut(
                event,
                ["Control+z",],
            ),
            false,
        );
        assert.equal(
            matches_shortcut(
                event,
                [],
            ),
            false,
        );
    },
);
