import { spawnSync, } from "node:child_process";
import { mkdir, readFile, readdir, writeFile, } from "node:fs/promises";
import { fileURLToPath, } from "node:url";

const PACKAGE_DIRECTORY = fileURLToPath(new URL(
    "../../",
    import.meta.url,
),);

const COVERAGE_DIRECTORY = new URL(
    "../../coverage/",
    import.meta.url,
);

await mkdir(
    COVERAGE_DIRECTORY,
    { recursive: true, },
);

const tests = [];

for (const directory of ["tests/unit", "tests/integration",]) {
    for (const filename of await readdir(new URL(
        `../../${directory}/`,
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
    {
        cwd: PACKAGE_DIRECTORY,
        stdio: "inherit",
    },
);

if (execution.error) {
    throw execution.error;
}

if (execution.status !== 0) {
    throw new Error("Coverage tests failed. Inspect coverage/tests.tap for failures.",);
}

const report = await readFile(
    new URL(
        "lcov.info",
        COVERAGE_DIRECTORY,
    ),
    "utf8",
);

const counts = {
    LF: 0,
    LH: 0,
    FNF: 0,
    FNH: 0,
    BRF: 0,
    BRH: 0,
};

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

console.log(`Passed ${passed_count} tests. Library line coverage is ${summary.line_percent}% (branches ${summary.branch_percent}%, functions ${summary.function_percent}%).`,);
