import { Chess, } from "chess.js";

export type RulesGame = Pick<
    Chess,
    "board" | "fen" | "get" | "getHeaders" | "history" | "isCheck" | "isCheckmate" | "isDraw" | "isGameOver" | "isStalemate" | "loadPgn" | "move" | "moves" | "pgn" | "turn" | "undo"
>;

export type RulesProvider = {
    create_game: (fen?: string,) => RulesGame;
};

export const STANDARD_RULES_PROVIDER: RulesProvider = Object.freeze({
    create_game: (fen?: string,) => new Chess(fen,),
},);
