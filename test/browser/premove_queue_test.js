import { expect, test, } from "@playwright/test";

for (const orientation of ["white", "black",]) {
    for (const input_method of ["click", "drag",]) {
        test(
            `Queues chained ${input_method} premoves and reverses cancellation in ${orientation} orientation.`,
            async ({ page, },) => {
                await page.goto("/test/browser/drag.html",);
                await page.locator(".board.ready",).waitFor();
                await page.evaluate(
                    (orientation,) => {
                        document.querySelector("meson-chessboard",).set_options({ orientation, is_muted: true, interaction: { can_premove: true, }, },);
                    },
                    orientation,
                );

                for (const [from, to,] of [["e7", "e3",], ["e7", "e5",], ["e5", "e4",], ["g8", "f6",],]) {
                    const origin = page.locator(`[data-square="${from}"]`,);
                    const target = page.locator(`[data-square="${to}"]`,);

                    if (input_method === "click") {
                        await origin.click();
                        await target.click();
                    } else {
                        const start = await origin.boundingBox();
                        const end = await target.boundingBox();
                        await page.mouse.move(
                            start.x + start.width / 2,
                            start.y + start.height / 2,
                        );
                        await page.mouse.down();
                        await page.mouse.move(
                            end.x + end.width / 2,
                            end.y + end.height / 2,
                            { steps: 5, },
                        );
                        await page.mouse.up();
                    }

                    if (to === "e3") {
                        expect(await page.evaluate(() => document.querySelector("meson-chessboard",).get_premoves(),),).toEqual([],);
                        await expect(page.locator('[data-square="e7"] .piece',),).toHaveCount(1,);
                        await page.keyboard.press("Escape",);
                    }
                }

                expect(await page.evaluate(() => document.querySelector("meson-chessboard",).get_premoves(),),).toEqual([
                    { from: "e7", to: "e5", },
                    { from: "e5", to: "e4", },
                    { from: "g8", to: "f6", },
                ],);
                await page.keyboard.press("Escape",);
                expect(await page.evaluate(() => document.querySelector("meson-chessboard",).get_premoves().length,),).toBe(2,);
                await expect(page.locator('[data-square="g8"] .piece',),).toHaveCount(1,);
                await page.keyboard.press("Escape",);
                expect(await page.evaluate(() => document.querySelector("meson-chessboard",).get_premoves(),),).toEqual([{ from: "e7", to: "e5", },],);
                await expect(page.locator('[data-square="e5"] .piece',),).toHaveCount(1,);
                await page.evaluate(() => document.querySelector("meson-chessboard",).move_uci("a2a3",),);
                expect(await page.evaluate(() => document.querySelector("meson-chessboard",).get_uci_moves(),),).toEqual(["a2a3", "e7e5",],);
                expect(await page.evaluate(() => document.querySelector("meson-chessboard",).get_premoves(),),).toEqual([],);
            },
        );
    }
}
