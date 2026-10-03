import { execFileSync, } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile, } from "node:fs/promises";
import { tmpdir, } from "node:os";
import { join, } from "node:path";
import { fileURLToPath, } from "node:url";

const MAXIMUM_ASSET_BYTES = 80_000;
const MAXIMUM_CSS_BYTES = 25_000;
const MAXIMUM_JAVASCRIPT_BYTES = 190_000;
const MAXIMUM_UNPACKED_BYTES = 450_000;
const PACKAGE_DIRECTORY = fileURLToPath(new URL(
    "../",
    import.meta.url,
),);
const temporary_directory = await mkdtemp(join(
    tmpdir(),
    "chessboard-package-",
),);

try {
    const pack_output = execFileSync(
        "npm",
        [
            "pack",
            "--ignore-scripts",
            "--json",
            "--pack-destination",
            temporary_directory,
        ],
        {
            cwd: PACKAGE_DIRECTORY,
            encoding: "utf8",
        },
    );
    const pack_metadata = JSON.parse(pack_output,);
    const archive = Array.isArray(pack_metadata,)
        ? pack_metadata[0]
        : pack_metadata["@mayazrakib/chessboard"];

    if (!archive) {
        throw new Error("The package archive metadata could not be read.",);
    }

    const packaged_paths = new Set(archive.files.map((file,) => file.path,));

    for (const required_path of [
        "dist/index.js",
        "dist/index.d.ts",
        "dist/core.js",
        "dist/core.d.ts",
        "dist/replay.js",
        "dist/replay.d.ts",
        "dist/style.css",
        "asset/pieces/pieces.svg",
        "asset/audio/move.mp3",
        "README.md",
        "LICENSE",
    ]) {
        if (!packaged_paths.has(required_path,)) {
            throw new Error(`Packaged chessboard is missing ${required_path}.`,);
        }
    }

    const calculate_size = (prefix, suffix = "",) => archive.files
        .filter((file,) => file.path.startsWith(prefix,) && file.path.endsWith(suffix,))
        .reduce((size_bytes, file,) => size_bytes + file.size, 0,);
    const budgets = [
        ["JavaScript", calculate_size("dist/", ".js",), MAXIMUM_JAVASCRIPT_BYTES,],
        ["CSS", calculate_size("dist/", ".css",), MAXIMUM_CSS_BYTES,],
        ["assets", calculate_size("asset/",), MAXIMUM_ASSET_BYTES,],
        ["unpacked package", archive.unpackedSize, MAXIMUM_UNPACKED_BYTES,],
    ];

    for (const [name, size_bytes, maximum_bytes,] of budgets) {
        if (size_bytes > maximum_bytes) {
            throw new Error(`The ${name} size of ${size_bytes} bytes exceeds its ${maximum_bytes}-byte budget.`,);
        }
    }

    const consumer_directory = join(
        temporary_directory,
        "consumer",
    );
    await mkdir(consumer_directory,);
    await writeFile(
        join(
            consumer_directory,
            "package.json",
        ),
        `${JSON.stringify({ name: "chessboard-package-smoke", private: true, type: "module", }, null, 4,)}\n`,
    );
    const archive_path = join(
        temporary_directory,
        archive.filename,
    );
    execFileSync(
        "npm",
        [
            "install",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
            "--prefer-offline",
            archive_path,
        ],
        {
            cwd: consumer_directory,
            stdio: "inherit",
        },
    );
    const verification_path = join(
        consumer_directory,
        "verify.mjs",
    );
    await writeFile(
        verification_path,
        `import { readFile, } from "node:fs/promises";

import * as root from "@mayazrakib/chessboard";
import * as core from "@mayazrakib/chessboard/core";
import * as replay from "@mayazrakib/chessboard/replay";

for (const [name, module, symbol,] of [
    ["root", root, "ChessboardElement",],
    ["core", core, "define_chessboard",],
    ["replay", replay, "PgnReplay",],
]) {
    if (!(symbol in module)) {
        throw new Error(\`The \${name} entry point does not export \${symbol}.\`,);
    }
}

for (const specifier of [
    "@mayazrakib/chessboard/style.css",
    "@mayazrakib/chessboard/pieces.svg",
    "@mayazrakib/chessboard/pieces/cburnett/white_king.svg",
    "@mayazrakib/chessboard/audio/move.mp3",
]) {
    const contents = await readFile(new URL(import.meta.resolve(specifier,),),);
    if (contents.length === 0) {
        throw new Error(\`The exported asset \${specifier} is empty.\`,);
    }
}
`,
    );
    execFileSync(
        process.execPath,
        [verification_path,],
        {
            cwd: consumer_directory,
            stdio: "inherit",
        },
    );
    console.log(`Verified ${archive.files.length} packaged files and size budgets in a clean consumer.`,);
} finally {
    await rm(
        temporary_directory,
        {
            force: true,
            recursive: true,
        },
    );
}
