const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const MOVES = ["g1f3", "g8f6", "f3g1", "f6g8",];
const MOVE_COUNT = 120;
const QUERY_COUNT = 100;
const ORIENTATION_FLIP_COUNT = 30;
const POSITION_LOAD_COUNT = 20;
const TRIAL_COUNT = 4;
const WARMUP_TRIAL_COUNT = 1;
const BOARD_WIDTH_PX = 534;
const UCI_SQUARE_LENGTH = 2;
const FULL_MOVES_PER_CYCLE = 2;

function measure_workload(
    name,
    prepare_workload,
    execute_workload,
) {
    const samples_ms = [];

    for (let trial_index = 0; trial_index < TRIAL_COUNT; trial_index++) {
        prepare_workload?.();

        const start_ms = performance.now();
        execute_workload();
        const elapsed_ms = performance.now() - start_ms;

        if (trial_index >= WARMUP_TRIAL_COUNT) {
            samples_ms.push(elapsed_ms,);
        }
    }

    return {
        name,
        samples_ms,
    };
}

export function run_system_benchmark() {
    const pgn = Array.from(
        { length: MOVE_COUNT / MOVES.length, },
        (
            unused_entry,
            index,
        ) => `${(index * FULL_MOVES_PER_CYCLE) + 1}. Nf3 Nf6 ${(index + 1) * FULL_MOVES_PER_CYCLE}. Ng1 Ng8`,
    ).join(" ",) + " *";

    const board = document.createElement("meson-chessboard",);

    try {
        document.body.append(board,);
        board.style.width = `${BOARD_WIDTH_PX}px`;
        board.set_options({ animation_duration: 0, },);

        return [
            measure_workload(
                "120 library moves",
                () => board.set_position(STARTING_FEN,),
                () => {
                    for (let index = 0; index < MOVE_COUNT; index++) {
                        const move = MOVES[index % MOVES.length];
                        board.move({
                            from: move.slice(
                                0,
                                UCI_SQUARE_LENGTH,
                            ),
                            to: move.slice(UCI_SQUARE_LENGTH,),
                        },);
                    }
                },
            ),
            measure_workload(
                "120 undo and 120 redo",
                () => board.set_pgn(pgn,),
                () => {
                    for (let index = 0; index < MOVE_COUNT; index++) {
                        board.undo();
                    }

                    for (let index = 0; index < MOVE_COUNT; index++) {
                        board.redo();
                    }
                },
            ),
            measure_workload(
                "100 UCI history queries at 120 plies",
                () => board.set_pgn(pgn,),
                () => {
                    for (let index = 0; index < QUERY_COUNT; index++) {
                        board.get_uci_position();
                    }
                },
            ),
            measure_workload(
                "100 status queries",
                () => board.set_position(STARTING_FEN,),
                () => {
                    for (let index = 0; index < QUERY_COUNT; index++) {
                        board.get_status();
                    }
                },
            ),
            measure_workload(
                "30 orientation flips at 120 plies",
                () => board.set_pgn(pgn,),
                () => {
                    for (let index = 0; index < ORIENTATION_FLIP_COUNT; index++) {
                        board.flip();
                    }
                },
            ),
            measure_workload(
                "20 FEN loads",
                null,
                () => {
                    for (let index = 0; index < POSITION_LOAD_COUNT; index++) {
                        board.set_position(STARTING_FEN,);
                    }
                },
            ),
        ];
    } finally {
        board.remove();
    }
}
