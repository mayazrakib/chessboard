import { expect, test, } from "@playwright/test";

for (const [winner, pgn,] of [
    ["White", "1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#",],
    ["Black", "1. f3 e5 2. g4 Qh4#",],
]) {
    test(
        `${winner} wins in the playground, confetti runs once, and restart clears the result.`,
        async ({ page, },) => {
            await page.goto("/",);
            await page.evaluate(
                async (pgn,) => {
                    await customElements.whenDefined("meson-chessboard",);
                    const board = document.querySelector("meson-chessboard",);
                    await board.when_ready();
                    board.set_options({ is_muted: true, },);
                    board.set_pgn(pgn,);
                },
                pgn,
            );
            await expect(page.locator("#turn_indicator",),).toHaveText(`${winner} wins!`,);
            const restart = page.getByRole(
                "button",
                { name: "Restart", exact: true, },
            );
            await expect(restart,).toBeVisible();
            await expect(page.locator(".confetti",),).toHaveCount(40,);
            await page.evaluate(() => document.querySelector("meson-chessboard",).flip(),);
            await expect(page.locator(".confetti",),).toHaveCount(0,);
            await page.evaluate(() => document.querySelector("meson-chessboard",).flip(),);
            await expect(page.locator(".confetti",),).toHaveCount(0,);
            await page.evaluate(() => document.querySelector("meson-chessboard",).undo(),);
            await expect(restart,).toBeHidden();
            await page.evaluate(() => document.querySelector("meson-chessboard",).redo(),);
            await expect(page.locator(".confetti",),).toHaveCount(40,);
            await restart.click();
            await expect(page.locator("#turn_indicator",),).toHaveText("White to move",);
            await expect(restart,).toBeHidden();
            await expect(page.locator(".confetti",),).toHaveCount(0,);
            expect(await page.evaluate(() => document.querySelector("meson-chessboard",).get_uci_moves(),),).toEqual([],);
        },
    );
}

test(
    "Reduced motion and disabled animations suppress confetti while preserving the winner and restart control.",
    async ({ page, },) => {
        await page.emulateMedia({ reducedMotion: "reduce", },);
        await page.goto("/",);
        await page.evaluate(async () => {
            await customElements.whenDefined("meson-chessboard",);
            const board = document.querySelector("meson-chessboard",);
            await board.when_ready();
            board.set_pgn("1. f3 e5 2. g4 Qh4#",);
        },);
        await expect(page.locator("#turn_indicator",),).toHaveText("Black wins!",);
        await expect(page.locator(".confetti",),).toHaveCount(0,);
        await page.emulateMedia({ reducedMotion: "no-preference", },);
        await page.evaluate(() => {
            const board = document.querySelector("meson-chessboard",);
            board.undo();
            board.set_options({ animation_duration: 0, },);
            board.redo();
        },);
        await expect(page.locator(".confetti",),).toHaveCount(0,);
        await expect(page.getByRole(
            "button",
            { name: "Restart", exact: true, },
        ),).toBeVisible();
    },
);

test(
    "The Effects tab previews every sound and replays visual effects without leaving stale results.",
    async ({ page, },) => {
        await page.addInitScript(() => {
            window.played_sounds = [];
            HTMLMediaElement.prototype.play = function() {
                window.played_sounds.push(this.src,);

                return Promise.resolve();
            };
        },);
        await page.goto("/",);
        await page.getByRole(
            "tab",
            { name: "Effects", exact: true, },
        ).click();

        for (const sound of ["move", "capture", "check", "checkmate", "draw", "win", "lose",]) {
            await page.getByRole(
                "button",
                { name: `Play ${sound}`, exact: true, },
            ).click();
            expect(await page.evaluate(() => window.played_sounds.at(-1,),),).toContain(`${["move", "capture", "check", "checkmate",].includes(sound,) ? sound : "notification"}.mp3`,);
        }

        await page.getByRole(
            "button",
            { name: "Preview check", exact: true, },
        ).click();
        await expect(page.locator(".checked > .square_status",),).toHaveCSS(
            "opacity",
            "1",
        );
        await expect(page.locator(".confetti",),).toHaveCount(0,);
        await page.getByRole(
            "button",
            { name: "Preview White wins", exact: true, },
        ).click();
        await expect(page.locator("#turn_indicator",),).toHaveText("White wins!",);
        await expect(page.locator(".confetti",),).toHaveCount(40,);
        await expect(page.locator(".confetti",),).toHaveCount(0,);
        await page.getByRole(
            "button",
            { name: "Preview White wins", exact: true, },
        ).click();
        await expect(page.locator(".confetti",),).toHaveCount(40,);
        await page.getByRole(
            "button",
            { name: "Preview Black wins", exact: true, },
        ).click();
        await expect(page.locator("#turn_indicator",),).toHaveText("Black wins!",);
        await page.getByRole(
            "button",
            { name: "Restart", exact: true, },
        ).click();
        await expect(page.locator("#turn_indicator",),).toHaveText("White to move",);
        await expect(page.locator(".confetti",),).toHaveCount(0,);
    },
);
