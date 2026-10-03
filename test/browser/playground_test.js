import { readFile, } from "node:fs/promises";

import { expect, test, } from "@playwright/test";

const PAGE_ERRORS = new WeakMap();

async function open_tab(
    page,
    name,
) {
    await page.getByRole(
        "tab",
        { name, exact: true, },
    ).click();
}

async function open_section(
    page,
    name,
) {
    await page.locator("summary",).filter({ hasText: name, },).click();
}

async function read_snapshot(
    page,
    name,
) {
    return JSON.parse(await page.locator(`#inspect_${name}`,).textContent(),);
}

test.beforeEach(async ({ page, },) => {
    const errors = [];
    PAGE_ERRORS.set(
        page,
        errors,
    );
    page.on(
        "pageerror",
        (error,) => errors.push(error.message,),
    );
    await page.goto("/",);
    await expect(page.locator("#inspect_status",),).toContainText('"is_checkmate"',);
},);

test.afterEach(async ({ page, },) => {
    expect(PAGE_ERRORS.get(page,),).toEqual([],);
},);

test(
    "Aligns the desktop controls card with the top of the board surface.",
    async ({ page, },) => {
        await page.setViewportSize({ width: 1600, height: 900, },);
        const controls = page.locator('[data-slot="card"]',);
        const board_bounds = await page.locator("#chessboard .board_surface",).boundingBox();
        const controls_bounds = await controls.boundingBox();

        expect(controls_bounds.y,).toBeCloseTo(
            board_bounds.y,
            1,
        );
        await expect(controls.getByText("Playground", { exact: true, },),).toBeVisible();
        await expect(controls.getByRole("heading", { name: "Chessboard", exact: true, },),).toBeVisible();
        await expect(page.locator(".playground > .playground_header",),).toHaveCount(0,);
    },
);

test(
    "Inspects legal moves, history, focus, and downloaded state through the controls.",
    async ({ page, },) => {
        await page.locator("#uci_input",).fill("e2e4",);
        await page.getByRole(
            "button",
            { name: "Play UCI move", exact: true, },
        ).click();
        await open_tab(
            page,
            "Inspect",
        );
        await page.locator("#inspect_square",).fill("e7",);
        const moves = await read_snapshot(
            page,
            "moves",
        );
        expect(moves.uci_history,).toEqual(["e2e4",],);
        expect(moves.legal_moves.map((move,) => move.to,).sort(),).toEqual(["e5", "e6",],);
        await page.locator("#inspect_focus",).click();
        await expect(page.locator('#chessboard [data-square="e7"]',),).toBeFocused();
        await page.keyboard.press("Shift+ArrowLeft",);
        await expect(page.locator('#chessboard [data-square="d7"]',),).toBeFocused();
        await page.locator("#inspect_square",).fill("z9",);
        expect((await read_snapshot(
            page,
            "moves",
        )).error,).toContain("Enter a square",);
        await page.locator("#inspect_focus",).click();
        await expect(page.locator("#inspect_feedback",),).toHaveCSS(
            "color",
            "rgb(255, 0, 51)",
        );

        const download_promise = page.waitForEvent("download",);
        await page.locator("#inspect_download",).click();
        const download = await download_promise;
        const snapshot = JSON.parse(await readFile(
            await download.path(),
            "utf8",
        ),);
        expect(snapshot.position.uci_position,).toBe("position startpos moves e2e4",);
        expect(snapshot.rendered.square_count,).toBe(64,);
    },
);

for (const [position, is_draw, turn,] of [
    ["capture", false, "w",],
    ["check", false, "w",],
    ["black_castling", false, "b",],
    ["promotion_capture", false, "w",],
    ["black_promotion", false, "b",],
    ["insufficient", true, "w",],
    ["fifty", true, "w",],
    ["repetition", true, "w",],
    ["mate_move", false, "b",],
    ["material", false, "w",],
    ["premove", false, "w",],
]) {
    test(
        `Loads the ${position} manual scenario and reports its actual status.`,
        async ({ page, },) => {
            await open_tab(
                page,
                "Position & Replay",
            );
            await page.locator("#test_position",).selectOption(position,);
            await page.locator("#test_load",).click();
            await expect(page.locator("#feedback",),).toContainText("loaded.",);
            const snapshot = await read_snapshot(
                page,
                "status",
            );
            expect(snapshot.status.is_draw,).toBe(is_draw,);
            expect(snapshot.turn,).toBe(turn,);
        },
    );
}

test(
    "Applies attributes, synchronizes existing controls, and restores options.",
    async ({ page, },) => {
        await open_tab(
            page,
            "Inspect",
        );
        await open_section(
            page,
            "Attributes",
        );

        for (const [attribute, attribute_value, option, expected,] of [
            ["orientation", "black", "orientation", "black",],
            ["theme", "sage", "theme", "sage",],
            ["readonly", "", "interactive", false,],
            ["coordinates", "false", "show_coordinates", false,],
        ]) {
            await page.locator("#test_attribute",).selectOption(attribute,);
            await page.locator("#test_attribute_value",).fill(attribute_value,);
            await page.locator("#test_attribute_apply",).click();
            expect((await read_snapshot(
                page,
                "status",
            )).options[option],).toBe(expected,);
        }

        await expect(page.locator("#orientation_select",),).toHaveValue("black",);
        await expect(page.locator("#interactive_toggle",),).not.toBeChecked();
        await page.locator("#test_attribute",).selectOption("readonly",);
        await page.locator("#test_attribute_remove",).click();
        expect((await read_snapshot(
            page,
            "status",
        )).options.interactive,).toBe(true,);
        await open_tab(
            page,
            "Customize",
        );
        await page.locator("#test_reset_options",).click();
        await expect(page.locator("#orientation_select",),).toHaveValue("white",);
        await expect(page.locator("#theme_select",),).toHaveValue("brown",);
    },
);

test(
    "Exercises CSS overrides, fractional layout, hiding, and reconnection.",
    async ({ page, },) => {
        await open_tab(
            page,
            "Customize",
        );
        await open_section(
            page,
            "CSS Customization",
        );
        await page.locator("#test_style_value",).fill("#123456",);
        await page.locator("#test_style_apply",).click();
        await expect(page.locator("#chessboard .square.light",).first(),).toHaveCSS(
            "background-color",
            "rgb(18, 52, 86)",
        );
        await page.locator("#test_style_value",).fill("invalid-color",);
        await page.locator("#test_style_apply",).click();
        await expect(page.locator("#feedback",),).toContainText("Enter a valid color",);
        await page.locator("#test_style_reset",).click();
        await open_section(
            page,
            "Board Layout",
        );
        await page.locator("#test_width",).fill("420.25",);
        await page.locator("#test_zoom",).fill("0.83",);
        await page.locator("#test_layout",).click();
        const bounds = await page.locator("#chessboard",).boundingBox();
        expect(bounds.width,).toBeCloseTo(
            420.25 * .83,
            1,
        );
        const before = await read_snapshot(
            page,
            "position",
        );
        await open_tab(
            page,
            "Inspect",
        );
        await open_section(
            page,
            "Board Lifecycle",
        );
        await page.locator("#test_reconnect",).click();
        expect(await read_snapshot(
            page,
            "position",
        ),).toEqual(before,);
        await expect(page.locator("#chessboard .piece",),).toHaveCount(32,);
        await page.locator("#test_hidden",).click();
        await expect(page.locator("#chessboard",),).toBeHidden();
        await page.locator("#test_hidden",).click();
        await expect(page.locator("#chessboard",),).toBeVisible();
        await open_tab(
            page,
            "Customize",
        );
        await page.locator("#test_layout_reset",).click();
        await expect(page.locator("#test_width",),).toHaveValue("",);
    },
);

test(
    "Loads a final PGN position with the default piece artwork.",
    async ({ page, },) => {
        await open_tab(
            page,
            "Position & Replay",
        );
        await open_section(
            page,
            "Direct PGN Loading",
        );
        await page.locator("#test_pgn_load",).click();
        expect((await read_snapshot(
            page,
            "moves",
        )).uci_history,).toEqual(["e2e4", "e7e5", "g1f3", "b8c6",],);
        await expect(page.locator("#chessboard .piece svg",),).toHaveCount(32,);
    },
);

test(
    "Records complete errors, filters and pauses events, and retains the position.",
    async ({ page, },) => {
        const before = await read_snapshot(
            page,
            "position",
        );
        await open_tab(
            page,
            "Events",
        );
        await open_section(
            page,
            "Error Handling",
        );

        for (const identifier of ["test_invalid_fen", "test_invalid_pgn", "test_invalid_uci", "test_illegal_move", "test_invalid_premove",]) {
            await page.locator(`#${identifier}`,).click();
            await expect(page.locator("#feedback",),).toHaveCSS(
                "color",
                "rgb(255, 0, 51)",
            );
            expect(await read_snapshot(
                page,
                "position",
            ),).toEqual(before,);
        }

        await open_tab(
            page,
            "Events",
        );
        await open_section(
            page,
            "Full Event Payloads",
        );
        let events = await read_snapshot(
            page,
            "events",
        );
        expect(events,).toHaveLength(4,);
        expect(events.every((event,) => event.name === "chessboard:error" && event.detail.message && event.bubbles && event.composed,),).toBe(true,);
        await page.locator("#inspect_event_filter",).selectOption("chessboard:move",);
        expect(await read_snapshot(
            page,
            "events",
        ),).toEqual([],);
        await page.locator("#inspect_event_filter",).selectOption("all",);
        await page.locator("#inspect_events_paused",).check();
        await page.locator("#inspect_events_clear",).click();
        await page.locator("#reset_button",).click();
        expect(await read_snapshot(
            page,
            "events",
        ),).toEqual([],);
        await page.locator("#inspect_events_paused",).uncheck();
        await page.locator("#reset_button",).click();
        events = await read_snapshot(
            page,
            "events",
        );
        expect(events.some((event,) => event.name === "chessboard:position" && event.detail.fen,),).toBe(true,);
    },
);

test(
    "Displays customization errors in the playground error color.",
    async ({ page, },) => {
        await open_tab(
            page,
            "Customize",
        );
        await page.getByLabel("Partial options as JSON",).fill("not json",);
        await page.getByRole(
            "button",
            { name: "Apply configuration", exact: true, },
        ).click();
        await expect(page.locator("#customization_feedback",),).toHaveCSS(
            "color",
            "rgb(255, 0, 51)",
        );
    },
);

test(
    "Validates replacement annotations and clears each source independently.",
    async ({ page, },) => {
        await open_tab(
            page,
            "Annotations",
        );
        await open_section(
            page,
            "Replace or Remove Annotations",
        );
        const marks = [{ from: "e2", to: "e4", source: "engine", color: "blue", }, { from: "d4", color: "green", },];
        await page.locator("#inspect_marks_input",).fill(JSON.stringify(marks,),);
        await page.locator("#inspect_marks_apply",).click();
        expect((await read_snapshot(
            page,
            "marks",
        )).marks,).toEqual(marks,);
        await page.locator("#inspect_marks_input",).fill('[{"from":"z9"}]',);
        await page.locator("#inspect_marks_apply",).click();
        await expect(page.locator("#feedback",),).toContainText("Use valid squares",);
        expect((await read_snapshot(
            page,
            "marks",
        )).marks,).toEqual(marks,);
        await page.locator("#inspect_marks_user",).click();
        expect((await read_snapshot(
            page,
            "marks",
        )).marks,).toEqual([marks[0],],);
        await page.locator("#inspect_marks_current",).click();
        expect(JSON.parse(await page.locator("#inspect_marks_input",).inputValue(),),).toEqual([marks[0],],);
        await page.locator("#inspect_marks_engine",).click();
        expect((await read_snapshot(
            page,
            "marks",
        )).marks,).toEqual([],);
    },
);

test(
    "Records native drag destinations without interfering with drop acceptance.",
    async ({ page, },) => {
        await open_tab(
            page,
            "Inspect",
        );
        await page.locator("#inspect_pointer_enabled",).check();
        const origin = await page.locator('#chessboard [data-square="e2"]',).boundingBox();
        const destination = await page.locator('#chessboard [data-square="e4"]',).boundingBox();
        await page.mouse.move(
            origin.x + origin.width / 2,
            origin.y + origin.height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(
            destination.x + .1,
            destination.y + .1,
        );
        await expect(page.locator("#inspect_pointer",),).toContainText('"highlighted_destination": "e4"',);
        await page.mouse.up();
        await expect(page.locator("#inspect_pointer",),).toContainText('"latest_move": "e2e4"',);
        await expect(page.locator("#inspect_pointer",),).toContainText('"highlighted_before_release": "e4"',);
        await page.locator("#inspect_pointer_enabled",).uncheck();
        await expect(page.locator("#inspect_pointer",),).toHaveText("Pointer recording is off.",);
    },
);

test(
    "Keeps a second board independent and the controls usable at mobile width.",
    async ({ page, },) => {
        await page.setViewportSize({ width: 390, height: 844, },);
        await open_tab(
            page,
            "Inspect",
        );
        await open_section(
            page,
            "Independent Board Instance",
        );
        await page.locator("#test_second_create",).click();
        await page.locator('#test_second_board [data-square="e2"]',).click();
        await page.locator('#test_second_board [data-square="e4"]',).click();
        await expect(page.locator('#test_second_board [data-square="e4"] .piece',),).toHaveCount(1,);
        await expect(page.locator('#chessboard [data-square="e2"] .piece',),).toHaveCount(1,);
        await page.keyboard.press("ArrowLeft",);
        await expect(page.locator('#test_second_board [data-square="e2"] .piece',),).toHaveCount(1,);
        await page.locator("#test_second_remove",).click();
        await expect(page.locator("#test_second_board chess-board",),).toHaveCount(0,);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth,),).toBe(true,);
    },
);

test(
    "Exports all seven board event types with their complete details.",
    async ({ page, },) => {
        await page.locator('#chessboard [data-square="e2"]',).click();
        await page.locator("#move_from",).fill("e7",);
        await page.locator("#move_to",).fill("e5",);
        await page.locator("#premove_type",).selectOption("b",);
        await page.getByRole(
            "button",
            { name: "Queue from fields", exact: true, },
        ).click();
        await page.locator("#uci_input",).fill("e2e4",);
        await page.getByRole(
            "button",
            { name: "Play UCI move", exact: true, },
        ).click();
        await open_tab(
            page,
            "Annotations",
        );
        await page.locator("#mark_from",).fill("d4",);
        await page.getByRole(
            "button",
            { name: "Add mark", exact: true, },
        ).click();
        await open_tab(
            page,
            "Events",
        );
        await open_section(
            page,
            "Error Handling",
        );
        await page.locator("#test_invalid_uci",).click();
        await open_tab(
            page,
            "Position & Replay",
        );
        await page.locator("#test_position",).selectOption("mate_move",);
        await page.locator("#test_load",).click();
        await open_tab(
            page,
            "Play",
        );
        await page.locator("#uci_input",).fill("d8h4",);
        await page.getByRole(
            "button",
            { name: "Play UCI move", exact: true, },
        ).click();
        await open_tab(
            page,
            "Events",
        );
        await open_section(
            page,
            "Full Event Payloads",
        );
        const download_promise = page.waitForEvent("download",);
        await page.locator("#inspect_events_download",).click();
        const download = await download_promise;
        const events = JSON.parse(await readFile(
            await download.path(),
            "utf8",
        ),);
        expect([...new Set(events.map((event,) => event.name,),),].sort(),).toEqual([
            "chessboard:error",
            "chessboard:gameover",
            "chessboard:marks",
            "chessboard:move",
            "chessboard:position",
            "chessboard:premove",
            "chessboard:select",
        ],);
        expect(events.find((event,) => event.name === "chessboard:gameover",).detail.is_checkmate,).toBe(true,);
    },
);

test(
    "Queues ordinary premoves and keeps remounted sliders connected to their actions.",
    async ({ page, },) => {
        await page.locator("#premove_type",).selectOption("b",);
        await page.locator("#move_from",).fill("e7",);
        await page.locator("#move_to",).fill("e5",);
        await page.locator("#queue_premove_button",).click();
        await expect(page.locator("#premove_output",),).toHaveText("e7 → e5",);

        await open_tab(
            page,
            "Customize",
        );
        const animation_control = page.locator("#animation_range [data-base-ui-slider-control]",);
        await animation_control.click({
            position: {
                x: 1,
                y: 2,
            },
        },);
        await expect(page.locator("#animation_output",),).toHaveText("0 ms",);
        expect((await read_snapshot(
            page,
            "status",
        )).options.animation_duration,).toBe(0,);

        await open_tab(
            page,
            "Position & Replay",
        );
        await page.locator("#pgn_input",).fill("1. e4 e5 2. Nf3 Nc6",);
        await page.locator("#load_pgn_button",).click();
        const replay_control = page.locator("#replay_range [data-base-ui-slider-control]",);
        const replay_bounds = await replay_control.boundingBox();
        expect(replay_bounds,).not.toBeNull();
        await replay_control.click({
            position: {
                x: replay_bounds.width - 1,
                y: replay_bounds.height / 2,
            },
        },);
        await expect(page.locator("#replay_progress",),).toHaveText("4 / 4",);
    },
);

test(
    "Toggles every disclosure control in the playground.",
    async ({ page, },) => {
        const disclosures_by_tab = {
            "Position & Replay": ["Direct PGN Loading",],
            Customize: ["Board Layout", "CSS Customization",],
            Annotations: ["Replace or Remove Annotations",],
            Inspect: [
                "Status and Options",
                "Legal Moves and History",
                "FEN, PGN, and UCI",
                "Marks and Premove",
                "Geometry, Material, and Accessibility",
                "Computed CSS Properties",
                "Attributes",
                "Board Lifecycle",
                "Independent Board Instance",
            ],
            Events: ["Full Event Payloads", "Error Handling",],
        };

        for (const [tab_name, labels,] of Object.entries(disclosures_by_tab,)) {
            await open_tab(
                page,
                tab_name,
            );

            for (const label of labels) {
                const summary = page.locator('[role="tabpanel"]:not([hidden]) summary',).filter({ hasText: label, },);
                const details = summary.locator("..",);
                const was_open = await details.evaluate((element,) => element.open,);
                await summary.click();
                await expect(details,).toHaveJSProperty(
                    "open",
                    !was_open,
                );
            }
        }
    },
);
