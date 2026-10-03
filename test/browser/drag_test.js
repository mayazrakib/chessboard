import { expect, test, } from "@playwright/test";

const START_POSITION = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const EDGE_FRACTIONS = [.0001, .5, .9999,];

async function prepare_board(
    page,
    options,
    page_path = "/test/browser/drag.html",
) {
    await page.goto(page_path,);
    await page.locator(".board.ready",).waitFor();
    await page.evaluate(
        (configuration,) => {
            const board = document.querySelector("chess-board",);
            board.style.transform = `scale(${configuration.scale ?? 1})`;
            board.set_options({ orientation: configuration.orientation, },);
            board.set_position(configuration.fen,);
        },
        {
            fen: START_POSITION,
            ...options,
        },
    );
    await page.waitForFunction(() => {
        const artwork = document.querySelector("chess-board",).shadowRoot.querySelector(".piece svg",);

        return artwork.getBBox().width > 0;
    },);
}

async function get_square_point(
    page,
    square,
    fraction_x = .5,
    fraction_y = .5,
) {
    const bounds = await page.locator(`[data-square="${square}"]`,).boundingBox();
    expect(bounds,).not.toBeNull();

    const point = {
        x: bounds.x + bounds.width * fraction_x,
        y: bounds.y + bounds.height * fraction_y,
    };

    if (page.context().browser()?.browserType().name() === "firefox") {
        point.x = Math.max(
            Math.ceil(bounds.x,),
            Math.min(
                Math.ceil(bounds.x + bounds.width,) - 1,
                Math.round(point.x,),
            ),
        );
        point.y = Math.max(
            Math.ceil(bounds.y,),
            Math.min(
                Math.ceil(bounds.y + bounds.height,) - 1,
                Math.round(point.y,),
            ),
        );
    }

    return point;
}

async function move_pointer(
    page,
    point,
) {
    await page.mouse.move(
        point.x,
        point.y,
    );
}

async function start_drag(
    page,
    square,
) {
    await move_pointer(
        page,
        await get_square_point(
            page,
            square,
        ),
    );
    await page.mouse.down();
}

async function pause_motion_frames(page,) {
    await page.waitForFunction(() => {
        const artwork = document.querySelector("chess-board",).shadowRoot.querySelector(".drag_ghost",)?.firstElementChild;

        return artwork?.style.transform === "";
    },);
    await page.evaluate(() => {
        const pending_frames = new Map();
        let next_frame_id = 0;
        window.requestAnimationFrame = (callback,) => {
            pending_frames.set(
                ++next_frame_id,
                callback,
            );

            return next_frame_id;
        };
        window.cancelAnimationFrame = (frame_id,) => pending_frames.delete(frame_id,);
    },);
}

async function get_highlight(page,) {
    return page.evaluate(() => {
        const square = document.querySelector("chess-board",).shadowRoot.querySelector(".drag_target",);

        return square ? {
            square: square.dataset.square,
            opacity: getComputedStyle(square.querySelector(".square_focus",),).opacity,
        } : null;
    },);
}

async function get_moves(page,) {
    return page.evaluate(() => document.querySelector("chess-board",).get_uci_moves(),);
}

test(
    "Rendered drag motion trails the pointer while the legal target stays exact.",
    async ({ page, },) => {
        await prepare_board(
            page,
            { orientation: "white", },
        );
        await start_drag(
            page,
            "e2",
        );
        const destination = await get_square_point(
            page,
            "e4",
        );
        await move_pointer(
            page,
            destination,
        );
        await page.evaluate(() => new Promise(requestAnimationFrame,),);

        const moving_observation = await page.evaluate(() => {
            const board = document.querySelector("chess-board",);
            const ghost_bounds = board.shadowRoot.querySelector(".drag_ghost",).getBoundingClientRect();
            const target = board.shadowRoot.querySelector(".drag_target",);

            return {
                ghost_center_y: ghost_bounds.y + ghost_bounds.height / 2,
                target: target?.dataset.square ?? null,
            };
        },);
        expect(moving_observation.target,).toBe("e4",);
        expect(moving_observation.ghost_center_y,).toBeGreaterThan(destination.y + 1,);

        await page.waitForTimeout(500,);
        const resting_center_y = await page.locator(".drag_ghost",).evaluate((ghost,) => {
            const bounds = ghost.getBoundingClientRect();

            return bounds.y + bounds.height / 2;
        },);
        expect(resting_center_y,).toBeCloseTo(
            destination.y,
            0,
        );
        await page.mouse.up();
    },
);

for (const orientation of ["white", "black",]) {
    for (const scale of [1, .83,]) {
        test.describe(
            `${orientation} orientation at scale ${scale}`,
            () => {
                test.beforeEach(async ({ page, },) => {
                    await prepare_board(
                        page,
                        {
                            orientation,
                            scale,
                        },
                    );
                },);

                for (const fraction_x of EDGE_FRACTIONS) {
                    for (const fraction_y of EDGE_FRACTIONS) {
                        test(
                            `Accepts a highlighted full-square drop at ${fraction_x}, ${fraction_y}.`,
                            async ({ page, },) => {
                                await start_drag(
                                    page,
                                    "e2",
                                );
                                await move_pointer(
                                    page,
                                    await get_square_point(
                                        page,
                                        "e4",
                                        fraction_x,
                                        fraction_y,
                                    ),
                                );
                                await page.evaluate(() => new Promise(requestAnimationFrame,),);
                                expect(await get_highlight(page,),).toEqual({
                                    square: "e4",
                                    opacity: "1",
                                },);

                                await page.mouse.up();
                                expect(await get_moves(page,),).toEqual(["e2e4",],);
                                await expect(page.locator('[data-square="e4"] .piece',),).toHaveCount(1,);
                                await expect(page.locator(".piece",),).toHaveCount(32,);
                                await expect(page.locator(".drag_ghost",),).toHaveCount(0,);
                            },
                        );
                    }
                }

                for (const previous_square of ["d4", "e3",]) {
                    test(
                        `Uses release coordinates after a rapid movement through ${previous_square}.`,
                        async ({ page, },) => {
                            test.skip(
                                page.context().browser()?.browserType().name() !== "chromium",
                                "This release-ordering test requires the Chromium DevTools Protocol.",
                            );
                            const session = await page.context().newCDPSession(page,);
                            await page.evaluate(() => {
                                const board = document.querySelector("chess-board",);
                                window.release_events = [];

                                for (const name of ["pointermove", "pointerup",]) {
                                    board.addEventListener(
                                        name,
                                        (event,) => window.release_events.push({
                                            name,
                                            is_trusted: event.isTrusted,
                                            x: event.clientX,
                                            y: event.clientY,
                                        },),
                                    );
                                }
                            },);

                            for (const fraction_x of EDGE_FRACTIONS) {
                                for (const fraction_y of EDGE_FRACTIONS) {
                                    await start_drag(
                                        page,
                                        "e2",
                                    );
                                    const destination = await get_square_point(
                                        page,
                                        "e4",
                                        fraction_x,
                                        fraction_y,
                                    );
                                    await move_pointer(
                                        page,
                                        destination,
                                    );
                                    await page.evaluate(() => new Promise(requestAnimationFrame,),);
                                    expect(await get_highlight(page,),).toEqual({
                                        square: "e4",
                                        opacity: "1",
                                    },);
                                    await move_pointer(
                                        page,
                                        await get_square_point(
                                            page,
                                            previous_square,
                                        ),
                                    );
                                    await session.send(
                                        "Input.dispatchMouseEvent",
                                        {
                                            type: "mouseReleased",
                                            ...destination,
                                            button: "left",
                                            buttons: 0,
                                            clickCount: 1,
                                        },
                                    );

                                    const events = await page.evaluate(() => window.release_events.slice(-2,),);
                                    expect(events.map((event,) => event.name,),).toEqual(["pointermove", "pointerup",],);
                                    expect(events.every((event,) => event.is_trusted,),).toBe(true,);
                                    expect({
                                        x: events[0].x,
                                        y: events[0].y,
                                    },).not.toEqual({
                                        x: events[1].x,
                                        y: events[1].y,
                                    },);
                                    expect(await get_moves(page,),).toEqual(["e2e4",],);
                                    await expect(page.locator('[data-square="e4"] .piece',),).toHaveCount(1,);
                                    await expect(page.locator(".piece",),).toHaveCount(32,);
                                    await expect(page.locator(".drag_ghost",),).toHaveCount(0,);
                                    await page.evaluate(async () => {
                                        const board = document.querySelector("chess-board",);
                                        board.undo();
                                        await Promise.all(board.shadowRoot.getAnimations().map((animation,) => animation.finished,),);
                                    },);
                                }
                            }
                        },
                    );
                }

                test(
                    "Rejects a release outside the board when no final movement event arrives.",
                    async ({ page, },) => {
                        test.skip(
                            page.context().browser()?.browserType().name() !== "chromium",
                            "This release-ordering test requires the Chromium DevTools Protocol.",
                        );
                        const session = await page.context().newCDPSession(page,);
                        await start_drag(
                            page,
                            "e2",
                        );
                        await move_pointer(
                            page,
                            await get_square_point(
                                page,
                                "e4",
                            ),
                        );
                        await page.evaluate(() => new Promise(requestAnimationFrame,),);
                        expect(await get_highlight(page,),).toEqual({
                            square: "e4",
                            opacity: "1",
                        },);
                        const bounds = await page.locator(".board",).boundingBox();
                        await session.send(
                            "Input.dispatchMouseEvent",
                            {
                                type: "mouseReleased",
                                x: bounds.x - 10,
                                y: bounds.y + bounds.height / 2,
                                button: "left",
                                buttons: 0,
                                clickCount: 1,
                            },
                        );

                        expect(await get_moves(page,),).toEqual([],);
                        expect(await get_highlight(page,),).toBeNull();
                        await expect(page.locator(".drag_ghost",),).toHaveCount(0,);
                        await expect(page.locator('[data-square="e2"] .piece',),).toHaveCount(1,);
                    },
                );

                test(
                    "Clears a legal highlight on a rapid edge exit before release rejects the drop.",
                    async ({ page, },) => {
                        await start_drag(
                            page,
                            "e2",
                        );
                        const target = await get_square_point(
                            page,
                            "e4",
                            .0001,
                            .5,
                        );
                        await move_pointer(
                            page,
                            target,
                        );
                        await page.evaluate(() => new Promise(requestAnimationFrame,),);
                        expect(await get_highlight(page,),).toEqual({
                            square: "e4",
                            opacity: "1",
                        },);
                        await pause_motion_frames(page,);

                        await move_pointer(
                            page,
                            {
                                x: target.x - .2,
                                y: target.y,
                            },
                        );
                        const release_highlight = await get_highlight(page,);
                        await page.mouse.up();
                        expect(await get_moves(page,),).toEqual([],);
                        expect(release_highlight,).toBeNull();
                        await expect(page.locator('[data-square="e2"] .piece',),).toHaveCount(1,);
                    },
                );

                test(
                    "Uses the latest target across rapid legal and illegal movements without a motion frame.",
                    async ({ page, },) => {
                        await start_drag(
                            page,
                            "e2",
                        );
                        await move_pointer(
                            page,
                            await get_square_point(
                                page,
                                "e3",
                            ),
                        );
                        await page.evaluate(() => new Promise(requestAnimationFrame,),);
                        await pause_motion_frames(page,);

                        for (const square of ["d4", "e4", "e3", "d4", "e4",]) {
                            await move_pointer(
                                page,
                                await get_square_point(
                                    page,
                                    square,
                                    .9999,
                                    .0001,
                                ),
                            );
                            expect(await get_highlight(page,),).toEqual(square === "d4" ? null : {
                                square,
                                opacity: "1",
                            },);
                        }

                        await page.mouse.up();
                        expect(await get_moves(page,),).toEqual(["e2e4",],);
                        expect(await get_highlight(page,),).toBeNull();
                    },
                );

                test(
                    "Keeps artwork pickup padding separate from the full destination square.",
                    async ({ page, },) => {
                        const artwork = await page.locator('[data-square="e2"] svg',).evaluate((vector,) => {
                            const bounds = vector.getBBox();
                            const matrix = vector.getScreenCTM();

                            return {
                                left: matrix.a * bounds.x + matrix.e,
                                top: matrix.d * bounds.y + matrix.f,
                                height: matrix.d * bounds.height,
                            };
                        },);
                        expect(artwork.height,).toBeGreaterThan(0,);
                        const destination = await get_square_point(
                            page,
                            "e4",
                            .0001,
                            .9999,
                        );

                        for (const padding_px of [5, 3,]) {
                            await move_pointer(
                                page,
                                {
                                    x: artwork.left - padding_px,
                                    y: artwork.top + artwork.height / 2,
                                },
                            );
                            await page.mouse.down();
                            await move_pointer(
                                page,
                                destination,
                            );
                            await page.evaluate(() => new Promise(requestAnimationFrame,),);
                            expect(await get_highlight(page,),).toEqual(padding_px === 3 ? {
                                square: "e4",
                                opacity: "1",
                            } : null,);
                            await page.mouse.up();
                            expect(await get_moves(page,),).toEqual(padding_px === 3 ? ["e2e4",] : [],);
                        }
                    },
                );
            },
        );
    }

    test(
        `Accepts rapid release at every edge and corner in the ${orientation} playground.`,
        async ({ page, },) => {
            await prepare_board(
                page,
                { orientation, },
                "/",
            );
            test.skip(
                page.context().browser()?.browserType().name() !== "chromium",
                "This release-ordering test requires the Chromium DevTools Protocol.",
            );
            const session = await page.context().newCDPSession(page,);

            for (const fraction_x of EDGE_FRACTIONS) {
                for (const fraction_y of EDGE_FRACTIONS) {
                    await start_drag(
                        page,
                        "e2",
                    );
                    await move_pointer(
                        page,
                        await get_square_point(
                            page,
                            "d4",
                        ),
                    );
                    const destination = await get_square_point(
                        page,
                        "e4",
                        fraction_x,
                        fraction_y,
                    );
                    await session.send(
                        "Input.dispatchMouseEvent",
                        {
                            type: "mouseReleased",
                            ...destination,
                            button: "left",
                            buttons: 0,
                            clickCount: 1,
                        },
                    );

                    expect(await get_moves(page,),).toEqual(["e2e4",],);
                    await expect(page.locator("#feedback",),).toHaveText("e4 played.",);
                    await expect(page.locator('[data-square="e4"] .piece',),).toHaveCount(1,);
                    await page.evaluate(async () => {
                        const board = document.querySelector("chess-board",);
                        board.undo();
                        await Promise.all(board.shadowRoot.getAnimations().map((animation,) => animation.finished,),);
                    },);
                }
            }
        },
    );

    for (const is_legal of [true, false,]) {
        test(
            `Preserves ${is_legal ? "landing" : "snapback"} animation in ${orientation} orientation.`,
            async ({ page, },) => {
                await prepare_board(
                    page,
                    { orientation, },
                );
                await page.evaluate(() => {
                    const board = document.querySelector("chess-board",);
                    const piece = board.shadowRoot.querySelector('[data-square="e2"] .piece',);
                    board.addEventListener(
                        "pointerup",
                        () => {
                            window.release_motion = piece.getAnimations().map((animation,) => ({
                                duration_ms: animation.effect.getTiming().duration,
                                frames: animation.effect.getKeyframes().map((frame,) => frame.transform,),
                            }),);
                        },
                    );
                },);
                await start_drag(
                    page,
                    "e2",
                );
                await move_pointer(
                    page,
                    await get_square_point(
                        page,
                        is_legal ? "e4" : "d4",
                        .2,
                        .8,
                    ),
                );
                await page.evaluate(() => new Promise(requestAnimationFrame,),);
                const scale = await page.locator(".drag_ghost",).evaluate((piece,) => {
                    const transform = new DOMMatrix(getComputedStyle(piece,).transform,);

                    return Math.hypot(
                        transform.a,
                        transform.b,
                    );
                },);
                expect(scale,).toBeGreaterThan(1,);

                await page.mouse.up();
                const motion = await page.evaluate(() => window.release_motion,);
                expect(motion,).toHaveLength(1,);
                expect(motion[0].duration_ms,).toBe(220,);
                expect(motion[0].frames[0],).not.toBe(motion[0].frames.at(-1,),);
                await page.evaluate(async () => {
                    const shadow = document.querySelector("chess-board",).shadowRoot;
                    const animations = [...shadow.querySelectorAll(".piece",),].flatMap((piece,) => piece.getAnimations(),);
                    await Promise.all(animations.map((animation,) => animation.finished,),);
                },);
                await expect(page.locator(".drag_ghost, .moving",),).toHaveCount(0,);
                await expect(page.locator(`[data-square="${is_legal ? "e4" : "e2"}"] .piece`,),).toHaveCount(1,);
                await expect(page.locator(".piece",),).toHaveCount(32,);
                expect(await get_moves(page,),).toEqual(is_legal ? ["e2e4",] : [],);
            },
        );
    }
}

test.describe(
    "Trackpad release ordering",
    () => {
        test.use({
            deviceScaleFactor: 2,
            viewport: {
                width: 570,
                height: 788,
            },
        },);

        for (const orientation of ["white", "black",]) {
            test(
                `Keeps highlighted edge and corner drops through early capture loss in ${orientation} orientation.`,
                async ({ page, },) => {
                    await prepare_board(
                        page,
                        { orientation, },
                        "/",
                    );
                    test.skip(
                        page.context().browser()?.browserType().name() !== "chromium",
                        "This release-ordering test requires the Chromium DevTools Protocol.",
                    );
                    const session = await page.context().newCDPSession(page,);
                    await page.evaluate(() => {
                        const board = document.querySelector("chess-board",);
                        window.capture_events = [];

                        for (const name of ["lostpointercapture", "pointermove", "pointerup", "chessboard:move",]) {
                            board.addEventListener(
                                name,
                                (event,) => window.capture_events.push({
                                    name,
                                    buttons: event.buttons,
                                    is_trusted: event.isTrusted,
                                },),
                            );
                        }
                    },);

                    for (const fraction_x of EDGE_FRACTIONS) {
                        for (const fraction_y of EDGE_FRACTIONS) {
                            await start_drag(
                                page,
                                "e2",
                            );
                            const destination = await get_square_point(
                                page,
                                "e4",
                                fraction_x,
                                fraction_y,
                            );
                            await move_pointer(
                                page,
                                destination,
                            );
                            await page.evaluate(() => new Promise(requestAnimationFrame,),);
                            expect(await get_highlight(page,),).toEqual({
                                square: "e4",
                                opacity: "1",
                            },);
                            await page.evaluate(() => {
                                window.capture_events = [];
                            },);
                            await session.send(
                                "Input.dispatchMouseEvent",
                                {
                                    type: "mouseMoved",
                                    ...destination,
                                    button: "none",
                                    buttons: 0,
                                },
                            );
                            const events = await page.evaluate(() => window.capture_events,);
                            expect(events.map((event,) => event.name,),).toEqual(["lostpointercapture", "pointermove",],);
                            expect(events.every((event,) => event.is_trusted && event.buttons === 0,),).toBe(true,);
                            expect(await get_highlight(page,),).toEqual({
                                square: "e4",
                                opacity: "1",
                            },);
                            expect(await get_moves(page,),).toEqual([],);
                            await page.evaluate(() => new Promise(requestAnimationFrame,),);
                            await session.send(
                                "Input.dispatchMouseEvent",
                                {
                                    type: "mouseMoved",
                                    ...destination,
                                    button: "none",
                                    buttons: 0,
                                },
                            );
                            await session.send(
                                "Input.dispatchMouseEvent",
                                {
                                    type: "mouseReleased",
                                    ...destination,
                                    button: "left",
                                    buttons: 0,
                                    clickCount: 1,
                                },
                            );

                            expect(await get_moves(page,),).toEqual(["e2e4",],);
                            expect(await page.evaluate(() => window.capture_events.filter((event,) => event.name === "chessboard:move",),),).toHaveLength(1,);
                            await expect(page.locator('[data-square="e4"] .piece',),).toHaveCount(1,);
                            await expect(page.locator(".drag_ghost",),).toHaveCount(0,);
                            await page.evaluate(async () => {
                                const board = document.querySelector("chess-board",);
                                board.undo();
                                await Promise.all(board.shadowRoot.getAnimations().map((animation,) => animation.finished,),);
                            },);
                        }
                    }
                },
            );

            test(
                `Handles an outside release after capture loss in ${orientation} orientation.`,
                async ({ page, },) => {
                    await prepare_board(
                        page,
                        { orientation, },
                        "/",
                    );
                    test.skip(
                        page.context().browser()?.browserType().name() !== "chromium",
                        "This release-ordering test requires the Chromium DevTools Protocol.",
                    );
                    const session = await page.context().newCDPSession(page,);
                    await start_drag(
                        page,
                        "e2",
                    );
                    const destination = await get_square_point(
                        page,
                        "e4",
                    );
                    await move_pointer(
                        page,
                        destination,
                    );
                    await session.send(
                        "Input.dispatchMouseEvent",
                        {
                            type: "mouseMoved",
                            ...destination,
                            button: "none",
                            buttons: 0,
                        },
                    );
                    expect(await get_highlight(page,),).toEqual({
                        square: "e4",
                        opacity: "1",
                    },);
                    const outside = {
                        x: 2,
                        y: destination.y,
                    };
                    await session.send(
                        "Input.dispatchMouseEvent",
                        {
                            type: "mouseMoved",
                            ...outside,
                            button: "none",
                            buttons: 0,
                        },
                    );
                    expect(await get_highlight(page,),).toBeNull();
                    await session.send(
                        "Input.dispatchMouseEvent",
                        {
                            type: "mouseReleased",
                            ...outside,
                            button: "left",
                            buttons: 0,
                            clickCount: 1,
                        },
                    );
                    expect(await get_moves(page,),).toEqual([],);
                    await expect(page.locator(".drag_ghost",),).toHaveCount(0,);
                    await expect(page.locator('[data-square="e2"] .piece',),).toHaveCount(1,);

                    await start_drag(
                        page,
                        "e2",
                    );
                    await move_pointer(
                        page,
                        destination,
                    );
                    await page.mouse.up();
                    expect(await get_moves(page,),).toEqual(["e2e4",],);
                },
            );

            for (const interruption of ["pointercancel", "blur", "restart", "disconnect",]) {
                test(
                    `Cleans up capture loss on ${interruption} in ${orientation} orientation.`,
                    async ({ page, },) => {
                        await prepare_board(
                            page,
                            { orientation, },
                            "/",
                        );
                        test.skip(
                            page.context().browser()?.browserType().name() !== "chromium",
                            "This release-ordering test requires the Chromium DevTools Protocol.",
                        );
                        const session = await page.context().newCDPSession(page,);
                        await start_drag(
                            page,
                            "e2",
                        );
                        const destination = await get_square_point(
                            page,
                            "e4",
                        );
                        await move_pointer(
                            page,
                            destination,
                        );
                        await session.send(
                            "Input.dispatchMouseEvent",
                            {
                                type: "mouseMoved",
                                ...destination,
                                button: "none",
                                buttons: 0,
                            },
                        );
                        expect(await get_highlight(page,),).toEqual({
                            square: "e4",
                            opacity: "1",
                        },);
                        await page.evaluate(
                            (reason,) => {
                                const board = document.querySelector("chess-board",);

                                if (reason === "pointercancel") {
                                    document.dispatchEvent(new PointerEvent(
                                        "pointercancel",
                                        { pointerId: 1, },
                                    ),);
                                } else if (reason === "blur") {
                                    window.dispatchEvent(new Event("blur",),);
                                } else if (reason === "restart") {
                                    document.dispatchEvent(new PointerEvent(
                                        "pointerdown",
                                        {
                                            pointerId: 1,
                                            buttons: 1,
                                        },
                                    ),);
                                } else {
                                    const parent = board.parentElement;
                                    board.remove();
                                    parent.append(board,);
                                }
                            },
                            interruption,
                        );
                        expect(await get_moves(page,),).toEqual([],);
                        await expect(page.locator(".drag_ghost",),).toHaveCount(0,);
                        await expect(page.locator('[data-square="e2"] .piece',),).toHaveCount(1,);
                        await session.send(
                            "Input.dispatchMouseEvent",
                            {
                                type: "mouseReleased",
                                ...destination,
                                button: "left",
                                buttons: 0,
                                clickCount: 1,
                            },
                        );
                        expect(await get_moves(page,),).toEqual([],);
                    },
                );
            }
        }
    },
);
