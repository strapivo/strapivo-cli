import type { Writable } from "node:stream";

export type OutputStream = Pick<Writable, "write">;

export function writeJson(stream: OutputStream, value: unknown): void {
  stream.write(`${JSON.stringify(value, null, 2)}\n`);
}
