export const BOARD_EVENTS = [
    "chessboard:move",
    "chessboard:position",
    "chessboard:select",
    "chessboard:marks",
    "chessboard:premove",
    "chessboard:error",
    "chessboard:gameover",
] as const;

export const STYLE_PROPERTIES = [
    "light",
    "dark",
    "frame",
    "frame-width",
    "radius",
    "shadow",
    "coordinate-opacity",
    "coordinate-weight",
    "coordinate-size",
    "selected",
    "last-move",
    "premove",
    "check",
    "marker",
    "capture-marker",
    "focus-color",
    "mark-amber",
    "mark-blue",
    "mark-green",
    "mark-red",
    "material-color",
    "material-muted",
    "animation-duration",
    "state-duration",
    "hint-duration",
] as const;

export const TEST_POSITIONS = [
    {
        key: "capture",
        label: "Ordinary capture",
        fen: "4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1",
    },
    {
        key: "check",
        label: "Check and pinned pieces",
        fen: "4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1",
    },
    {
        key: "black_castling",
        label: "Black castling",
        fen: "r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1",
    },
    {
        key: "promotion_capture",
        label: "Promotion with capture",
        fen: "1r5k/P7/8/8/8/8/8/7K w - - 0 1",
    },
    {
        key: "black_promotion",
        label: "Black promotion",
        fen: "7k/8/8/8/8/8/p7/7K b - - 0 1",
    },
    {
        key: "insufficient",
        label: "Insufficient material",
        fen: "7k/8/8/8/8/8/8/K7 w - - 0 1",
    },
    {
        key: "fifty",
        label: "Fifty-move rule",
        fen: "7k/8/8/8/8/8/R7/K7 w - - 100 51",
    },
    {
        key: "repetition",
        label: "Threefold repetition",
        pgn: "1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8",
    },
    {
        key: "mate_move",
        label: "Game-over event",
        pgn: "1. f3 e5 2. g4",
    },
    {
        key: "material",
        label: "Capture history",
        pgn: "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qe5+",
    },
    {
        key: "premove",
        label: "Premove execution",
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    },
] as const;
