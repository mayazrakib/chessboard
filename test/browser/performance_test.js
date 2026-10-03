import { expect, test, } from "@playwright/test";

test.describe("Performance budgets", () => {
    test.skip(({ browserName, },) => browserName !== "chromium", "Performance budgets run in the reference Chromium environment.",);

    test(
        "Renders one board and ten concurrent boards within their budgets.",
        async ({ page, },) => {
            await page.goto("/test/browser/drag.html",);
            const timings = await page.evaluate(async () => {
                const original = document.querySelector("chess-board",);
                await original.when_ready();
                original.remove();
                const single_start = performance.now();
                const single = document.createElement("chess-board",);
                single.set_options({ animation_duration: 0, is_muted: true, quality_profile: "minimal", },);
                document.body.append(single,);
                await single.when_ready();
                const single_milliseconds = performance.now() - single_start;
                const move_start = performance.now();
                single.move_uci("e2e4",);
                const move_milliseconds = performance.now() - move_start;
                single.set_position("8/8/8/3p4/4P3/8/8/4K2k w - - 0 1",);
                const capture_start = performance.now();
                single.move_uci("e4d5",);
                const capture_milliseconds = performance.now() - capture_start;
                single.remove();
                const concurrent_start = performance.now();
                const boards = Array.from(
                    { length: 10, },
                    () => {
                        const board = document.createElement("chess-board",);
                        board.set_options({ animation_duration: 0, is_muted: true, quality_profile: "minimal", },);
                        document.body.append(board,);

                        return board;
                    },
                );
                await Promise.all(boards.map((board,) => board.when_ready(),),);
                await new Promise((resolve,) => requestAnimationFrame(() => resolve(),),);

                return {
                    capture_milliseconds,
                    concurrent_milliseconds: performance.now() - concurrent_start,
                    move_milliseconds,
                    single_milliseconds,
                };
            },);
            expect(timings.single_milliseconds,).toBeLessThan(500,);
            expect(timings.move_milliseconds,).toBeLessThan(100,);
            expect(timings.capture_milliseconds,).toBeLessThan(100,);
            expect(timings.concurrent_milliseconds,).toBeLessThan(1500,);
        },
    );

    test(
        "Keeps a throttled drag responsive and releases detached boards.",
        async ({ page, context, },) => {
            await page.goto("/test/browser/drag.html",);
            const session = await context.newCDPSession(page,);
            await session.send(
                "Emulation.setCPUThrottlingRate",
                { rate: 4, },
            );
            const board = page.locator("chess-board",);
            const e2 = board.getByRole(
                "gridcell",
                { name: /^e2,/, },
            );
            const e4 = board.getByRole(
                "gridcell",
                { name: /^e4,/, },
            );
            const origin = await e2.boundingBox();
            const target = await e4.boundingBox();
            const start = Date.now();
            await page.mouse.move(
                origin.x + origin.width / 2,
                origin.y + origin.height / 2,
            );
            await page.mouse.down();
            await page.mouse.move(
                target.x + target.width / 2,
                target.y + target.height / 2,
                { steps: 40, },
            );
            await page.mouse.up();
            expect(Date.now() - start,).toBeLessThan(2000,);
            await session.send(
                "Emulation.setCPUThrottlingRate",
                { rate: 1, },
            );
            const cleanup = await page.evaluate(async () => {
                const container = document.createElement("div",);
                document.body.append(container,);

                for (let index = 0; index < 25; index += 1) {
                    container.append(document.createElement("chess-board",),);
                }

                await Promise.all([...container.children,].map((candidate,) => candidate.when_ready(),),);
                const boards = [...container.children,];
                container.remove();
                await Promise.resolve();

                return {
                    connected: boards.filter((candidate,) => candidate.isConnected,).length,
                    running_animations: boards.reduce((count, candidate,) => count + candidate.shadowRoot.getAnimations().filter((animation,) => animation.playState === "running",).length, 0,),
                };
            },);
            expect(cleanup,).toEqual({ connected: 0, running_animations: 0, },);
        },
    );
},);
