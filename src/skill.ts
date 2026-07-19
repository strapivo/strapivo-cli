import { cp, lstat, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { CliError, ExitCode } from "./errors.js";

export type SkillHost = "agents" | "codex" | "claude" | "all";

export interface InstalledSkill {
  host: Exclude<SkillHost, "all">;
  path: string;
}

interface PreparedTarget extends InstalledSkill {
  staging: string;
  previous: string;
  hadPrevious: boolean;
  movedPrevious: boolean;
  committed: boolean;
}

const MARKER_FILE = ".strapivo-managed.json";
const MARKER_CONTENT = `${JSON.stringify({ managed_by: "@strapivo/cli", skill: "strapivo" }, null, 2)}\n`;

export function bundledSkillPath(): string {
  return fileURLToPath(new URL("../../skills/strapivo", import.meta.url));
}

export async function installSkill(options: {
  host: SkillHost;
  homeDirectory?: string;
  sourceDirectory?: string;
}): Promise<InstalledSkill[]> {
  const homeDirectory = options.homeDirectory ?? homedir();
  const sourceDirectory = options.sourceDirectory ?? bundledSkillPath();
  await verifySource(sourceDirectory);

  const targets = skillTargets(options.host, homeDirectory);
  const prepared = await prepareTargets(sourceDirectory, targets);

  try {
    for (const target of prepared) {
      if (target.hadPrevious) {
        await rename(target.path, target.previous);
        target.movedPrevious = true;
      }
      await rename(target.staging, target.path);
      target.committed = true;
    }
  } catch (error) {
    await rollbackTargets(prepared);
    throw installError("Could not commit Strapivo skill installation", error);
  }

  await Promise.all(prepared.map((target) => rm(target.previous, { recursive: true, force: true }).catch(() => undefined)));
  return targets;
}

export function validateSkillHost(value: unknown): SkillHost {
  if (value === "agents" || value === "codex" || value === "claude" || value === "all") return value;
  throw new CliError("invalid_arguments", "--host must be agents, codex, claude, or all", ExitCode.usage, {
    details: { supported_hosts: ["agents", "codex", "claude", "all"] },
  });
}

function skillTargets(host: SkillHost, homeDirectory: string): InstalledSkill[] {
  const targets: InstalledSkill[] = [];
  if (host === "agents") {
    targets.push({ host: "agents", path: join(homeDirectory, ".agents", "skills", "strapivo") });
  } else if (host === "codex" || host === "all") {
    targets.push({ host: "codex", path: join(homeDirectory, ".agents", "skills", "strapivo") });
  }
  if (host === "claude" || host === "all") {
    targets.push({ host: "claude", path: join(homeDirectory, ".claude", "skills", "strapivo") });
  }
  return targets;
}

async function prepareTargets(sourceDirectory: string, targets: InstalledSkill[]): Promise<PreparedTarget[]> {
  const prepared: PreparedTarget[] = [];

  try {
    for (const target of targets) {
      const parent = dirname(target.path);
      const suffix = `${process.pid}.${randomUUID()}`;
      const staging = join(parent, `.strapivo.${suffix}.new`);
      const previous = join(parent, `.strapivo.${suffix}.old`);
      const hadPrevious = await managedTargetExists(target.path);
      prepared.push({ ...target, staging, previous, hadPrevious, movedPrevious: false, committed: false });

      await mkdir(parent, { recursive: true });
      await cp(sourceDirectory, staging, { recursive: true, errorOnExist: true, force: false });
      await writeFile(join(staging, MARKER_FILE), MARKER_CONTENT, { encoding: "utf8", mode: 0o644, flag: "wx" });
    }
  } catch (error) {
    await cleanupStaging(prepared);
    if (error instanceof CliError) throw error;
    throw installError("Could not stage Strapivo skill installation", error);
  }

  return prepared;
}

async function managedTargetExists(targetDirectory: string): Promise<boolean> {
  try {
    const target = await lstat(targetDirectory);
    if (!target.isDirectory()) throw skillConflict(targetDirectory);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return false;
    if (error instanceof CliError) throw error;
    throw installError(`Could not inspect existing skill at ${targetDirectory}`, error);
  }

  try {
    const marker = await readFile(join(targetDirectory, MARKER_FILE), "utf8");
    if (marker !== MARKER_CONTENT) throw skillConflict(targetDirectory);
  } catch (error) {
    if (error instanceof CliError) throw error;
    if (isNodeError(error) && error.code === "ENOENT") throw skillConflict(targetDirectory);
    throw installError(`Could not inspect existing skill at ${targetDirectory}`, error);
  }

  return true;
}

async function rollbackTargets(targets: PreparedTarget[]): Promise<void> {
  for (const target of [...targets].reverse()) {
    if (target.committed) await rm(target.path, { recursive: true, force: true }).catch(() => undefined);
    if (target.movedPrevious) await rename(target.previous, target.path).catch(() => undefined);
    await rm(target.staging, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function cleanupStaging(targets: PreparedTarget[]): Promise<void> {
  await Promise.all(targets.map((target) => rm(target.staging, { recursive: true, force: true }).catch(() => undefined)));
}

async function verifySource(sourceDirectory: string): Promise<void> {
  try {
    const skill = await stat(join(sourceDirectory, "SKILL.md"));
    if (!skill.isFile()) throw new Error("SKILL.md is not a file");
  } catch (error) {
    throw new CliError(
      "skill_unavailable",
      "Bundled Strapivo skill is missing from this CLI installation",
      ExitCode.config,
      { cause: error },
    );
  }
}

function skillConflict(targetDirectory: string): CliError {
  return new CliError(
    "skill_conflict",
    `Existing skill at ${targetDirectory} is not managed by Strapivo CLI and was not changed`,
    ExitCode.config,
    { details: { path: targetDirectory } },
  );
}

function installError(message: string, cause: unknown): CliError {
  return new CliError("skill_install_failed", message, ExitCode.config, { cause });
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
