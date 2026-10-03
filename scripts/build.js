import { execFileSync, } from "node:child_process";
import { copyFile, readFile, readdir, rm, writeFile, } from "node:fs/promises";
import { fileURLToPath, } from "node:url";

import { build_sprite, } from "./build_pieces.js";

const PACKAGE_DIRECTORY = new URL(
    "../",
    import.meta.url,
);
const OUTPUT_DIRECTORY = new URL(
    "../dist/",
    import.meta.url,
);

await build_sprite();
await rm(
    OUTPUT_DIRECTORY,
    {
        recursive: true,
        force: true,
    },
);
execFileSync(
    process.execPath,
    [fileURLToPath(new URL(
        "../node_modules/typescript/bin/tsc",
        import.meta.url,
    ),),],
    {
        cwd: fileURLToPath(PACKAGE_DIRECTORY,),
        stdio: "inherit",
    },
);

for (const filename of await readdir(OUTPUT_DIRECTORY,)) {
    if (!filename.endsWith(".js",) && !filename.endsWith(".d.ts",)) {
        continue;
    }

    const output_url = new URL(
        filename,
        OUTPUT_DIRECTORY,
    );
    const source = await readFile(
        output_url,
        "utf8",
    );
    const formatted_source = source.replace(
        /(\S)[ \t]*\r?\n(?:[ \t]*\r?\n)*(?=[ \t]*\/\*\*)/g,
        "$1\n\n",
    );

    if (formatted_source !== source) {
        await writeFile(
            output_url,
            formatted_source,
        );
    }
}

await copyFile(
    new URL(
        "../src/style.css",
        import.meta.url,
    ),
    new URL(
        "../dist/style.css",
        import.meta.url,
    ),
);
