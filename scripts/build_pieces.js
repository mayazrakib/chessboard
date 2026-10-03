import { mkdir, readFile, writeFile, } from "node:fs/promises";

const COLORS = ["white", "black",];
const PIECES = ["pawn", "knight", "bishop", "rook", "queen", "king",];
const ASSET_DIRECTORY = new URL(
    "../asset/pieces/",
    import.meta.url,
);
const SOURCE_DIRECTORY = new URL(
    "../asset/pieces/cburnett/",
    import.meta.url,
);

export async function build_sprite() {
    const symbols = [];

    for (const color of COLORS) {
        for (const piece of PIECES) {
            const name = `${color}-${piece}`;
            const artwork = await readFile(
                new URL(
                    `${color}_${piece}.svg`,
                    SOURCE_DIRECTORY,
                ),
                "utf8",
            );
            const svg_body = artwork.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/,)?.[1];

            if (!svg_body || /<image\b/i.test(svg_body,)) {
                throw new Error(`Failed to build the vector sprite: invalid piece asset ${name}.`,);
            }

            const vector_paths = svg_body.trim().split("\n",).map((line,) => {
                const indentation = line.match(/^ */,)?.[0].length ?? 0;

                return `${" ".repeat(8 + Math.max(
                    0,
                    indentation - 2,
                ) * 2,)}${line.trim()}`;
            },).join("\n",);
            symbols.push(`    <symbol id="${name}" viewBox="0 0 45 45">\n${vector_paths}\n    </symbol>`,);
        }
    }

    await mkdir(
        ASSET_DIRECTORY,
        { recursive: true, },
    );
    await writeFile(
        new URL(
            "pieces.svg",
            ASSET_DIRECTORY,
        ),
        `<svg xmlns="http://www.w3.org/2000/svg">\n${symbols.join("\n",)}\n</svg>\n`,
    );
}
