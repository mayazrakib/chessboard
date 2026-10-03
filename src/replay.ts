import { type Move, } from "chess.js";

import type { ChessboardElement, } from "./chessboard.js";

export class PgnReplay {
    readonly moves: readonly Move[];
    readonly pgn: string;
    readonly title: string;
    readonly starting_position: string;
    private readonly board: ChessboardElement;
    private current_index = 0;
    private is_seeking = false;
    private expected_revision = -1;

    constructor(
        board: ChessboardElement,
        pgn: string,
    ) {
        const game = board.create_game();
        game.loadPgn(pgn,);
        this.moves = game.history({ verbose: true, },);
        this.pgn = game.pgn();
        this.starting_position = this.moves[0]?.before ?? game.fen();
        const headers = game.getHeaders();
        const white_name = headers.White && headers.White !== "?" ? headers.White : "White";
        const black_name = headers.Black && headers.Black !== "?" ? headers.Black : "Black";
        this.title = `${white_name} vs ${black_name}`;
        this.board = board;
    }

    get_index(): number {
        return this.current_index;
    }

    has_current_position(): boolean {
        const expected_position = this.current_index === 0 ? this.starting_position : this.moves[this.current_index - 1]?.after;

        return this.is_seeking || (this.board.get_revision() === this.expected_revision && this.board.get_position() === expected_position);
    }

    load(): void {
        this.is_seeking = true;

        try {
            this.board.set_premove(null,);

            if (!this.board.set_pgn(this.pgn,)) {
                throw new Error("Failed to load the replay game.",);
            }

            this.current_index = this.moves.length;
            this.seek(0,);
        } finally {
            this.expected_revision = this.board.get_revision();
            this.is_seeking = false;
        }
    }

    seek(index: number,): void {
        if (!Number.isInteger(index,) || index < 0 || index > this.moves.length) {
            throw new RangeError("Failed to seek the replay: move index is outside the game.",);
        }

        if (!this.has_current_position()) {
            throw new Error("Failed to seek the replay: the board position has changed outside the replay.",);
        }

        this.is_seeking = true;

        try {
            this.board.seek_history(
                index,
                "replay",
            );
            this.current_index = index;
        } finally {
            this.expected_revision = this.board.get_revision();
            this.is_seeking = false;
        }
    }
}
