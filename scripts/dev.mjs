// Starts the Sarthi API server and the Vite dev server together.
import { spawn } from "node:child_process";

const isWin = process.platform === "win32";
const procs = [
  spawn(process.execPath, ["server/sarthi-server.mjs"], { stdio: "inherit" }),
  spawn(isWin ? "npx.cmd" : "npx", ["vite"], { stdio: "inherit", shell: isWin }),
];
const stop = () => procs.forEach((p) => p.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
procs.forEach((p) => p.on("exit", stop));
