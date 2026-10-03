import type { PieceSymbol, Square, } from "chess.js";

import type { MoveInput, } from "./types.js";

const UCI_MOVE_PATTERN = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/;

export function parse_uci_move(text: string,): MoveInput {
    const match = UCI_MOVE_PATTERN.exec(text.trim(),);

    if (!match || match[1] === match[2]) {
        throw new Error("Invalid UCI move. Use a move such as e2e4 or a7a8q.",);
    }

    const move: MoveInput = {
        from: match[1] as Square,
        to: match[2] as Square,
    };

    if (match[3]) {
        move.promotion = match[3] as PieceSymbol;
    }

    return move;
}

export function format_uci_move(move: MoveInput,): string {
    return `${move.from}${move.to}${move.promotion ?? ""}`;
}
