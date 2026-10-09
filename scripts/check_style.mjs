import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const ROOT = process.argv[2]
    ? resolve(process.argv[2])
    : fileURLToPath(new URL(
        "../",
        import.meta.url,
    ));
const failures = [];

function list_sources(directory) {
    return readdirSync(
        directory,
        {
            withFileTypes: true,
        },
    ).flatMap((entry) => {
        const path = `${directory}/${entry.name}`;

        if (entry.isDirectory()) {
            return list_sources(path);
        }

        return /\.(?:tsx|ts|js|jsx|mjs|cjs)$/.test(path) ? [path] : [];
    });
}

for (const directory of ["src", "demo", "electron", "scripts", "test", "benchmark"]) {
    const source_directory = `${ROOT}/${directory}`;

    if (!existsSync(source_directory)) {
        continue;
    }

    for (const path of list_sources(source_directory)) {
        const content = readFileSync(
            path,
            "utf8",
        );
        const source = ts.createSourceFile(
            path,
            content,
            ts.ScriptTarget.Latest,
            true,
            /\.(?:tsx|jsx)$/.test(path) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        );

        if (/\t| +\n|\n\s*\n\s*\n/.test(content) || !content.endsWith("\n") || content.endsWith("\n\n")) {
            failures.push(`${path}: The whitespace does not follow the package rules.`);
        }

        function visit_node(node) {
            if (ts.isImportDeclaration(node)) {
                const bindings = node.importClause?.namedBindings;

                if (
                    bindings
                    && (
                        ts.isNamespaceImport(bindings)
                        || bindings.elements.some((binding) => binding.propertyName)
                    )
                ) {
                    failures.push(`${path}: Imports must be explicit and unaliased.`);
                }
            }

            for (const entries of [node.arguments, node.parameters, node.typeArguments, node.typeParameters]) {
                if (!entries || entries.length < 2) {
                    continue;
                }

                const lines = entries.map(
                    (entry) => source.getLineAndCharacterOfPosition(entry.getStart(source)).line,
                );

                if (new Set(lines).size !== lines.length) {
                    const location = source.getLineAndCharacterOfPosition(node.getStart(source));
                    failures.push(
                        `${path}:${location.line + 1}: Multiple arguments or parameters must use vertical formatting.`,
                    );
                }
            }

            ts.forEachChild(
                node,
                visit_node,
            );
        }

        visit_node(source);
    }
}

if (failures.length > 0) {
    throw new Error(`Failed the package style checks.\n${failures.join("\n")}`);
}

console.log("Passed the package whitespace, import, and vertical formatting checks.");
