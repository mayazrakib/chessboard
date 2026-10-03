import { expect, test, } from "@playwright/test";

const SCENARIOS = [
    {
        name: "pawn move",
        moves: ["e2e4",],
        squares: ["e2",],
    },
    {
        name: "capture",
        moves: ["e2e4", "d7d5", "e4d5",],
        squares: ["e4",],
    },
    {
        name: "en passant",
        moves: ["e2e4", "a7a6", "e4e5", "d7d5", "e5d6",],
        squares: ["e5",],
    },
    {
        name: "kingside castle",
        fen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
        moves: ["e1g1",],
        squares: ["e1", "h1",],
    },
    {
        name: "queenside castle",
        fen: "r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1",
        moves: ["e8c8",],
        squares: ["e8", "a8",],
    },
    {
        name: "promotion",
        fen: "7k/P7/8/8/8/8/8/7K w - - 0 1",
        moves: ["a7a8q",],
        squares: ["a7",],
    },
];

for (const orientation of ["white", "black",]) {
    for (const scenario of SCENARIOS) {
        test(
            `Animates undo of ${scenario.name} in ${orientation} orientation.`,
            async ({ page, },) => {
                await page.goto("/test/browser/drag.html",);
                await page.locator(".board.ready",).waitFor();
                const observations = await page.evaluate(
                    ({ scenario, orientation, },) => {
                        const board = document.querySelector("meson-chessboard",);
                        board.set_options({
                            orientation,
                            animation_duration: 0,
                        },);

                        if (scenario.fen) {
                            board.set_position(scenario.fen,);
                        }

                        let previous_position;

                        for (const move of scenario.moves) {
                            previous_position = board.get_position();

                            if (!board.move_uci(move,)) {
                                throw new Error(`Failed to play ${move}.`,);
                            }
                        }

                        board.set_options({ animation_duration: 180, },);
                        board.undo();
                        const motions = scenario.squares.map((square,) => {
                            const piece = board.shadowRoot.querySelector(`[data-square="${square}"] .piece`,);
                            const animation = piece.getAnimations()[0];
                            animation?.pause();

                            return {
                                duration: animation?.effect.getTiming().duration,
                                frames: animation?.effect.getKeyframes().map((frame,) => frame.transform,),
                            };
                        },);

                        return {
                            motions,
                            position: board.get_position(),
                            previous_position,
                        };
                    },
                    {
                        scenario,
                        orientation,
                    },
                );
                expect(observations.position,).toBe(observations.previous_position,);

                for (const motion of observations.motions) {
                    expect(motion.duration,).toBe(180,);
                    expect(motion.frames.length,).toBeGreaterThan(1,);
                    expect(motion.frames[0],).not.toBe(motion.frames.at(-1,),);
                }
            },
        );
    }
}

test(
    "Suppresses undo animations for reduced motion and disabled animation.",
    async ({ page, },) => {
        await page.goto("/test/browser/drag.html",);
        await page.locator(".board.ready",).waitFor();

        for (const has_reduced_motion of [false, true,]) {
            await page.emulateMedia({ reducedMotion: has_reduced_motion ? "reduce" : "no-preference", },);
            const animation_count = await page.evaluate(
                (has_reduced_motion,) => {
                    const board = document.querySelector("meson-chessboard",);
                    board.set_options({ animation_duration: has_reduced_motion ? 180 : 0, },);
                    board.move_uci("e2e4",);
                    board.undo();

                    return board.shadowRoot.getAnimations().length;
                },
                has_reduced_motion,
            );
            expect(animation_count,).toBe(0,);
        }
    },
);

test(
    "Finishes rapid undo and redo without stale movement or pieces.",
    async ({ page, },) => {
        await page.goto("/test/browser/drag.html",);
        await page.locator(".board.ready",).waitFor();
        const state = await page.evaluate(async () => {
            const board = document.querySelector("meson-chessboard",);
            board.set_options({ animation_duration: 80, },);
            const initial_position = board.get_position();
            board.move_uci("e2e4",);
            board.undo();
            board.redo();
            board.undo();
            await Promise.all(board.shadowRoot.getAnimations().map((animation,) => animation.finished,),);

            return {
                position: board.get_position(),
                initial_position,
                moving_count: board.shadowRoot.querySelectorAll(".piece.moving",).length,
                piece_count: board.shadowRoot.querySelectorAll(".piece",).length,
            };
        },);
        expect(state.position,).toBe(state.initial_position,);
        expect(state.moving_count,).toBe(0,);
        expect(state.piece_count,).toBe(32,);
    },
);
