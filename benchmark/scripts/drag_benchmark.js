const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const TRIAL_COUNT = 1;
const FRAME_COUNT = 120;
const SAMPLES_PER_FRAME = 8;
const POINTER_ID = 1;
const MILLISECONDS_PER_SECOND = 1000;
const POINTER_SAMPLES_PER_SECOND = 480;
const FRAMES_PER_SECOND = 60;
const START_TIMESTAMP_MS = 1000;
const HORIZONTAL_PERIOD_SAMPLES = 30;
const VERTICAL_PERIOD_SAMPLES = 50;
const VERTICAL_OFFSET_SQUARES = 1.3;
const VERTICAL_AMPLITUDE_SQUARES = 0.6;
const BATCH_PERCENTILE = 0.95;
const POINTER_CAPTURE_METHODS = ["setPointerCapture", "releasePointerCapture", "hasPointerCapture",];

export async function run_drag_benchmark() {
    const board = document.querySelector("chess-board",);
    const grid = board?.shadowRoot?.querySelector(".board",);

    if (!grid) {
        throw new Error("Failed to run the drag benchmark: a mounted chessboard is required.",);
    }

    const request_original_frame = window.requestAnimationFrame;
    const cancel_original_frame = window.cancelAnimationFrame;
    const get_original_bounds = Element.prototype.getBoundingClientRect;
    const start_original_animation = Element.prototype.animate;
    const pointer_capture_descriptors = POINTER_CAPTURE_METHODS.map((method_name,) => Object.getOwnPropertyDescriptor(
        grid,
        method_name,
    ),);
    const frames = new Map();
    let frame_id = 0;
    let bounds_read_count = 0;
    let animation_count = 0;
    const trials = [];

    try {
        window.requestAnimationFrame = (execute_frame,) => {
            frames.set(
                ++frame_id,
                execute_frame,
            );

            return frame_id;
        };
        window.cancelAnimationFrame = (pending_frame_id,) => frames.delete(pending_frame_id,);
        Element.prototype.getBoundingClientRect = function () {
            bounds_read_count++;

            return get_original_bounds.call(this,);
        };
        Element.prototype.animate = function (...animation_arguments) {
            animation_count++;

            return start_original_animation.apply(
                this,
                animation_arguments,
            );
        };
        grid.setPointerCapture = () => undefined;
        grid.releasePointerCapture = () => undefined;
        grid.hasPointerCapture = () => false;

        for (let trial_index = 0; trial_index < TRIAL_COUNT; trial_index++) {
            board.set_position(STARTING_FEN,);
            const square = board.shadowRoot.querySelector('[data-square="e2"]',);
            const square_bounds = get_original_bounds.call(square,);
            const x = square_bounds.x + (square_bounds.width / 2);
            const y = square_bounds.y + (square_bounds.height / 2);

            square.dispatchEvent(new PointerEvent(
                "pointerdown",
                {
                    bubbles: true,
                    composed: true,
                    pointerId: POINTER_ID,
                    button: 0,
                    clientX: x,
                    clientY: y,
                },
            ),);
            bounds_read_count = 0;
            animation_count = 0;
            let total_ms = 0;
            const frame_costs_ms = [];

            for (let frame_index = 0; frame_index < FRAME_COUNT; frame_index++) {
                const start_ms = performance.now();

                for (let sample_index = 0; sample_index < SAMPLES_PER_FRAME; sample_index++) {
                    const sample_index_overall = (frame_index * SAMPLES_PER_FRAME) + sample_index;
                    const horizontal_offset_px = Math.sin(sample_index_overall / HORIZONTAL_PERIOD_SAMPLES,) * square_bounds.width;
                    const vertical_offset_squares = VERTICAL_OFFSET_SQUARES
                        + (Math.cos(sample_index_overall / VERTICAL_PERIOD_SAMPLES,) * VERTICAL_AMPLITUDE_SQUARES);
                    const event = new PointerEvent(
                        "pointermove",
                        {
                            bubbles: true,
                            composed: true,
                            pointerId: POINTER_ID,
                            buttons: 1,
                            clientX: x + horizontal_offset_px,
                            clientY: y - (square_bounds.height * vertical_offset_squares),
                        },
                    );
                    Object.defineProperty(
                        event,
                        "timeStamp",
                        { value: (sample_index_overall * (MILLISECONDS_PER_SECOND / POINTER_SAMPLES_PER_SECOND)) + START_TIMESTAMP_MS, },
                    );
                    grid.dispatchEvent(event,);
                }

                const pending_callbacks = [...frames.values(),];
                frames.clear();

                for (const execute_frame of pending_callbacks) {
                    execute_frame((frame_index * (MILLISECONDS_PER_SECOND / FRAMES_PER_SECOND)) + START_TIMESTAMP_MS,);
                }

                get_original_bounds.call(grid,);
                const elapsed_ms = performance.now() - start_ms;
                total_ms += elapsed_ms;
                frame_costs_ms.push(elapsed_ms,);
                await Promise.resolve();
            }

            const operation_counts = {
                rect_reads: bounds_read_count,
                animations: animation_count,
            };
            grid.dispatchEvent(new PointerEvent(
                "pointercancel",
                {
                    bubbles: true,
                    composed: true,
                    pointerId: POINTER_ID,
                },
            ),);
            frames.clear();

            frame_costs_ms.sort((
                first_duration_ms,
                second_duration_ms,
            ) => first_duration_ms - second_duration_ms,);
            trials.push({
                total_ms,
                p95_batch_ms: frame_costs_ms[Math.ceil(FRAME_COUNT * BATCH_PERCENTILE,) - 1],
                ...operation_counts,
            },);
        }
    } finally {
        window.requestAnimationFrame = request_original_frame;
        window.cancelAnimationFrame = cancel_original_frame;
        Element.prototype.getBoundingClientRect = get_original_bounds;
        Element.prototype.animate = start_original_animation;
        frames.clear();

        for (const [method_index, method_name,] of POINTER_CAPTURE_METHODS.entries()) {
            const descriptor = pointer_capture_descriptors[method_index];

            if (descriptor) {
                Object.defineProperty(
                    grid,
                    method_name,
                    descriptor,
                );
            } else {
                delete grid[method_name];
            }
        }
    }

    return {
        visibility: document.visibilityState,
        user_agent: navigator.userAgent,
        board_width: get_original_bounds.call(grid,).width,
        events_per_trial: FRAME_COUNT * SAMPLES_PER_FRAME,
        batches_per_trial: FRAME_COUNT,
        trials,
    };
}
