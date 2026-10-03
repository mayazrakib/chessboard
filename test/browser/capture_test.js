import { expect, test, } from "@playwright/test";

const SCENARIOS = [
    { name: "ordinary capture", fen: "4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1", move: "e4d5", captured_square: "d5", color: "w", type: "p", },
    { name: "black capture of a white piece", fen: "4k3/8/8/4p3/3P4/8/8/4K3 b - - 0 1", move: "e5d4", captured_square: "d4", color: "b", type: "p", },
    { name: "en passant", fen: "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", move: "e5d6", captured_square: "d5", color: "w", type: "p", },
    { name: "promotion capture", fen: "1r5k/P7/8/8/8/8/8/7K w - - 0 1", move: "a7b8q", captured_square: "b8", color: "w", type: "q", },
];

for (const orientation of ["white", "black",]) {
    for (const scenario of SCENARIOS) {
        test(
            `Immediately replaces the victim after ${scenario.name} in ${orientation} orientation.`,
            async ({ page, },) => {
                await page.goto("/test/browser/drag.html",);
                await page.locator(".board.ready",).waitFor();
                const observation = await page.evaluate(
                    ({ scenario, orientation, },) => {
                        const board = document.querySelector("meson-chessboard",);
                        board.set_options({ orientation, is_muted: true, },);
                        board.set_position(scenario.fen,);
                        const move = board.move_uci(scenario.move,);
                        const target = scenario.move.slice(2, 4,);
                        const attacker = board.shadowRoot.querySelector(`[data-square="${target}"] .piece`,);
                        const victim = board.shadowRoot.querySelector(`[data-square="${scenario.captured_square}"] .piece:not([data-color="${scenario.color}"])`,);

                        return {
                            attacker_color: attacker?.dataset.color,
                            attacker_type: attacker?.dataset.type,
                            ghost_count: board.shadowRoot.querySelectorAll(".capture_ghost",).length,
                            is_capture: Boolean(move?.captured,),
                            victim_count: victim ? 1 : 0,
                        };
                    },
                    { scenario, orientation, },
                );
                expect(observation,).toEqual({
                    attacker_color: scenario.color,
                    attacker_type: scenario.type,
                    ghost_count: 0,
                    is_capture: true,
                    victim_count: 0,
                },);
            },
        );
    }
}

for (const mode of ["reduced motion", "disabled animations",]) {
    test(
        `Immediate capture replacement respects ${mode}.`,
        async ({ page, },) => {
            await page.emulateMedia({ reducedMotion: mode === "reduced motion" ? "reduce" : "no-preference", },);
            await page.goto("/test/browser/drag.html",);
            await page.locator(".board.ready",).waitFor();
            await page.evaluate(
                (mode,) => {
                    const board = document.querySelector("meson-chessboard",);
                    board.set_options({ animation_duration: mode === "disabled animations" ? 0 : 180, is_muted: true, },);
                    board.set_position("4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1",);
                    board.move_uci("e4d5",);
                },
                mode,
            );
            await expect(page.locator(".capture_ghost",),).toHaveCount(0,);
            await expect(page.locator('[data-square="d5"] .piece[data-color="w"]',),).toHaveCount(1,);
        },
    );
}

for (const scenario of [
    { name: "white on black", fen: "4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1", from: "e4", to: "d5", color: "w", },
    { name: "black on white", fen: "4k3/8/8/4p3/3P4/8/8/4K3 b - - 0 1", from: "e5", to: "d4", color: "b", },
]) {
    test(
        `A real ${scenario.name} drag capture replaces the victim immediately.`,
        async ({ page, },) => {
            await page.goto("/",);
            await page.locator(".board.ready",).waitFor();
            await page.evaluate(
                (fen,) => {
                    const board = document.querySelector("meson-chessboard",);
                    board.set_options({ is_muted: true, },);
                    board.set_position(fen,);
                },
                scenario.fen,
            );
            const origin = await page.locator(`[data-square="${scenario.from}"]`,).boundingBox();
            const destination = await page.locator(`[data-square="${scenario.to}"]`,).boundingBox();
            await page.mouse.move(
                origin.x + origin.width / 2,
                origin.y + origin.height / 2,
            );
            await page.mouse.down();
            await page.mouse.move(
                destination.x + destination.width / 2,
                destination.y + destination.height / 2,
                { steps: 5, },
            );
            await page.mouse.up();
            await expect(page.locator(".capture_ghost",),).toHaveCount(0,);
            await expect(page.locator(`[data-square="${scenario.to}"] .piece[data-color="${scenario.color}"]`,),).toHaveCount(1,);
        },
    );
}
