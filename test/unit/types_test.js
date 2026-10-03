import assert from "node:assert/strict";
import { dirname, join, } from "node:path";
import { test, } from "node:test";
import { fileURLToPath, } from "node:url";

import ts from "typescript";

const CONTRACTS = [
    {
        name: "Public board options, renderers, events, and tag names compile together.",
        is_valid: true,
        source: `import type { ChessboardOptions, PieceRenderer, } from "../../dist/core.js";

const render_piece: PieceRenderer = (
    piece,
    square,
) => document.createTextNode(square + piece.type,);
const options: ChessboardOptions = {
    assets: { stylesheet_url: null, piece_sprite_url: "/pieces.svg", },
    move_mode: "controlled",
    is_muted: false,
    piece_renderer: render_piece,
    playable_color: "both",
};
const board = document.createElement("meson-chessboard",);
board.set_options(options,);
board.set_muted(true,);
const is_muted: boolean = board.is_muted();
export { is_muted, };
board.addEventListener(
    "chessboard:move_request",
    (event,) => board.commit_move(event.detail.id,),
);
board.addEventListener(
    "chessboard:position",
    (event,) => event.detail.pgn?.toUpperCase(),
);
`,
    },
    {
        name: "Required annotations and optional board marks remain distinct.",
        is_valid: true,
        source: `import type { Annotation, BoardMark, MoveInput, } from "../../dist/core.js";

const mark: BoardMark = { from: "a1", };
const annotation: Annotation = { ...mark, id: "analysis", group: "engine", };
const move: MoveInput = { from: "a7", to: "a8", promotion: "n", };
export { annotation, move, };
`,
    },
    {
        name: "Grouped customization, sound effects, and rules contracts are exported from the root entry point.",
        is_valid: true,
        source: `import {
    STANDARD_RULES_PROVIDER,
    type BoardSound,
    type ChessboardOptions,
    type PromotionRequest,
    type RulesProvider,
} from "../../dist/index.js";

const board = document.createElement("meson-chessboard",);
const provider: RulesProvider = STANDARD_RULES_PROVIDER;
const options: ChessboardOptions = {
    interaction: { keyboard_shortcuts: { undo: ["u",], }, },
    sound: { player_color: "w", enabled: { lose: false, }, },
    promotion: {
        mode: "external",
        request: (
            request: PromotionRequest,
            complete,
        ) => {
            void request;
            complete("n",);
        },
    },
    renderers: { square_overlay: (context,) => context.square, },
};
const sound: BoardSound = "win";
board.set_options(options,);
board.play_sound(sound,);
board.set_rules_provider(provider,);
`,
    },
    ...[
        ["Unsupported sound perspectives are rejected.", "ChessboardOptions", '{ sound: { player_color: "white", }, }',],
        ["Unsupported input switches are rejected.", "ChessboardOptions", '{ interaction: { can_drag: "yes", }, }',],
        ["An invalid square is rejected.", "MoveInput", '{ from: "a9", to: "a8", }',],
        ["An invalid promotion symbol is rejected.", "MoveInput", '{ from: "a7", to: "a8", promotion: "x", }',],
        ["Unsupported themes are rejected.", "ChessboardOptions", '{ theme: "unknown", }',],
        ["String boolean options are rejected.", "ChessboardOptions", '{ interactive: "true", }',],
        ["String mute options are rejected.", "ChessboardOptions", '{ is_muted: "true", }',],
        ["Unsupported move modes are rejected.", "ChessboardOptions", '{ move_mode: "manual", }',],
        ["Missing annotation identifiers are rejected.", "Annotation", '{ from: "a1", group: "engine", }',],
        ["Missing annotation groups are rejected.", "Annotation", '{ from: "a1", id: "arrow", }',],
        ["Unsupported annotation colors are rejected.", "BoardMark", '{ from: "a1", color: "purple", }',],
        ["Unsupported change sources are rejected.", "ChangeSource", '"network"',],
        ["Unsupported request end statuses are rejected.", "MoveRequestEndDetail", '{ request: { id: 1, revision: 0, input: { from: "e2", to: "e4", }, source: "api", }, status: "pending", }',],
        ["A null sprite URL is rejected.", "ChessboardAssets", '{ piece_sprite_url: null, }',],
    ].map(([name, type_name, expression,],) => ({
        name,
        is_valid: false,
        source: `import type { ${type_name}, } from "../../dist/core.js";\n\nexport const contract: ${type_name} = ${expression};\n`,
    }),),
    {
        name: "Event details do not permit fields from unrelated events.",
        is_valid: false,
        source: `import "../../dist/core.js";

document.createElement("meson-chessboard",).addEventListener(
    "chessboard:move_request",
    (event,) => event.detail.fen,
);
`,
    },
];
const DIRECTORY = dirname(fileURLToPath(import.meta.url,),);
const SOURCES = new Map(CONTRACTS.map((
    contract,
    index,
) => [join(
    DIRECTORY,
    `type_contract_${index}.ts`,
), contract.source,],),);
const COMPILER_OPTIONS = {
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    noEmit: true,
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ES2022,
    types: [],
};
const HOST = ts.createCompilerHost(COMPILER_OPTIONS,);
const read_file = HOST.readFile.bind(HOST,);
const has_file = HOST.fileExists.bind(HOST,);
HOST.readFile = (path,) => SOURCES.get(path,) ?? read_file(path,);
HOST.fileExists = (path,) => SOURCES.has(path,) || has_file(path,);
const PROGRAM = ts.createProgram(
    [...SOURCES.keys(),],
    COMPILER_OPTIONS,
    HOST,
);
const DIAGNOSTICS = ts.getPreEmitDiagnostics(PROGRAM,);

test(
    "Type contracts resolve against package declarations without compiler setup failures.",
    () => {
        assert.deepEqual(
            DIAGNOSTICS.filter((diagnostic,) => !diagnostic.file || !SOURCES.has(diagnostic.file.fileName,),),
            [],
        );
        assert.equal(
            DIAGNOSTICS.some((diagnostic,) => [2307, 2688,].includes(diagnostic.code,),),
            false,
        );
    },
);

for (const [index, contract,] of CONTRACTS.entries()) {
    test(
        contract.name,
        () => {
            const path = join(
                DIRECTORY,
                `type_contract_${index}.ts`,
            );
            const diagnostics = DIAGNOSTICS.filter((diagnostic,) => diagnostic.file?.fileName === path,);

            assert.equal(
                diagnostics.length === 0,
                contract.is_valid,
                diagnostics.map((diagnostic,) => ts.flattenDiagnosticMessageText(
                    diagnostic.messageText,
                    "\n",
                ),).join("\n",),
            );
        },
    );
}
