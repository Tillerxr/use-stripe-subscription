import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";
import dts from "rollup-plugin-dts";
import PeerDepsExternalPlugin from 'rollup-plugin-peer-deps-external';

import packageJson from "./package.json" assert { type: "json" };

const plugins = [
    PeerDepsExternalPlugin(),
    resolve(),
    commonjs(),
    typescript({tsconfig: "./tsconfig.json"}),
    json()
];

export default [
    {
        input: "src/index.ts",
        output: [
            {
                file: packageJson.main,
                format: "cjs",
            },
            {
                file: packageJson.module,
                format: "esm",
            },
        ],
        plugins,
    },
    {
        input: "src/client.tsx",
        output: [
            {
                file: "dist/cjs/client/index.js",
                format: "cjs",
            },
            {
                file: "dist/esm/client/index.js",
                format: "esm",
            },
        ],
        plugins
    },
    {
        input: "src/server.ts",
        output: [
            {
                file: "dist/cjs/server/index.js",
                format: "cjs",
            },
            {
                file: "dist/esm/server/index.js",
                format: "esm",
            },
        ],
        plugins
    },
    {
        input: "dist/esm/types/index.d.ts",
        output: [{ file: "dist/index.d.ts", format: "esm" }],
        plugins: [dts()],
    },
    {
        input: "dist/esm/types/client.d.ts",
        output: [{ file: "dist/client.d.ts", format: "esm" }],
        plugins: [dts()],
    },
    {
        input: "dist/esm/types/server.d.ts",
        output: [{ file: "dist/server.d.ts", format: "esm" }],
        plugins: [dts()],
    },
];