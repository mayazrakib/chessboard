import { spawnSync, } from "node:child_process";
import { mkdir, readFile, readdir, writeFile, } from "node:fs/promises";
import { fileURLToPath, } from "node:url";

const PACKAGE_DIRECTORY = fileURLToPath(new URL(
    "../",
    import.meta.url,
),);
const COVERAGE_DIRECTORY = new URL(
    "../coverage/",
    import.meta.url,
);
await mkdir(
    COVERAGE_DIRECTORY,
    { recursive: true, },
);
const tests = [];

for (const directory of ["test/unit", "test/integration",]) {
    for (const filename of await readdir(new URL(
        `../${directory}/`,
        import.meta.url,
    ),)) {
        if (filename.endsWith("_test.js",)) {
            tests.push(`${directory}/${filename}`,);
        }
    }
}

const execution = spawnSync(
    process.execPath,
    [
        "--test",
        "--experimental-test-coverage",
        "--test-coverage-include=dist/*.js",
        "--test-reporter=tap",
        "--test-reporter-destination=coverage/tests.tap",
        "--test-reporter=lcov",
        "--test-reporter-destination=coverage/lcov.info",
        ...tests.sort(),
    ],
    { cwd: PACKAGE_DIRECTORY, stdio: "inherit", },
);

if (execution.error) {
    throw execution.error;
}

if (execution.status !== 0) {
    throw new Error("Coverage tests failed. Inspect coverage/tests.tap for failures; badges were not updated.",);
}

const report = await readFile(
    new URL(
        "lcov.info",
        COVERAGE_DIRECTORY,
    ),
    "utf8",
);
const counts = { LF: 0, LH: 0, FNF: 0, FNH: 0, BRF: 0, BRH: 0, };

for (const line of report.split("\n",)) {
    const [key, count,] = line.split(":",);

    if (Object.hasOwn(
        counts,
        key,
    )) {
        counts[key] += Number(count,);
    }
}

if (counts.LF === 0) {
    throw new Error("Coverage did not include any compiled library files.",);
}

const transcript = await readFile(
    new URL(
        "tests.tap",
        COVERAGE_DIRECTORY,
    ),
    "utf8",
);
const passed_count = Number(transcript.match(/^# pass (\d+)$/m,)?.[1],);

if (!Number.isFinite(passed_count,)) {
    throw new Error("The coverage run did not report its passing test count.",);
}

const summary = {
    measured_at: new Date().toISOString(),
    node_version: process.version,
    scope: "Unit and integration tests against dist/*.js. Browser tests are excluded.",
    passed_count,
    line_percent: Number((counts.LH / counts.LF * 100).toFixed(2,),),
    branch_percent: Number((counts.BRH / counts.BRF * 100).toFixed(2,),),
    function_percent: Number((counts.FNH / counts.FNF * 100).toFixed(2,),),
    counts,
};
await writeFile(
    new URL(
        "summary.json",
        COVERAGE_DIRECTORY,
    ),
    `${JSON.stringify(
        summary,
        null,
        4,
    )}\n`,
);
const readme_url = new URL(
    "../README.md",
    import.meta.url,
);
let readme = await readFile(
    readme_url,
    "utf8",
);

for (const [label, metric,] of [
    ["Coverage", `${summary.line_percent.toFixed(1,)}%`,],
    ["Testing", `${passed_count} passing`,],
]) {
    const badge_url = `https://img.shields.io/badge/${label}-${encodeURIComponent(metric,)}-237c65`;
    const badge_pattern = new RegExp(`\\[!\\[${label}\\]\\([^)]*\\)\\]`,);

    if (!badge_pattern.test(readme,)) {
        throw new Error(`Failed to find the ${label} badge in the README.`,);
    }

    readme = readme.replace(
        badge_pattern,
        `[![${label}](${badge_url})]`,
    );
}

await writeFile(
    readme_url,
    readme,
);
console.log(`Passed ${passed_count} tests. Library line coverage is ${summary.line_percent}% (branches ${summary.branch_percent}%, functions ${summary.function_percent}%).`,);
