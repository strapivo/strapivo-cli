import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { CliError } from "../src/errors.js";
import { installSkill, validateSkillHost } from "../src/skill.js";

test("skill installer installs and updates Codex and Claude Code personal skills", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "strapivo-skill-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const home = join(root, "home");
  const source = join(root, "source");
  await mkdir(source, { recursive: true });
  await writeFile(join(source, "SKILL.md"), "version one\n", "utf8");

  const installed = await installSkill({ host: "all", homeDirectory: home, sourceDirectory: source });

  assert.deepEqual(installed, [
    { host: "codex", path: join(home, ".agents", "skills", "strapivo") },
    { host: "claude", path: join(home, ".claude", "skills", "strapivo") },
  ]);
  assert.equal(await readFile(join(installed[0]!.path, "SKILL.md"), "utf8"), "version one\n");
  assert.equal(await readFile(join(installed[1]!.path, "SKILL.md"), "utf8"), "version one\n");

  await writeFile(join(source, "SKILL.md"), "version two\n", "utf8");
  await installSkill({ host: "all", homeDirectory: home, sourceDirectory: source });

  assert.equal(await readFile(join(installed[0]!.path, "SKILL.md"), "utf8"), "version two\n");
  assert.equal(await readFile(join(installed[1]!.path, "SKILL.md"), "utf8"), "version two\n");
});

test("skill installer refuses to overwrite an unmanaged skill", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "strapivo-skill-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const home = join(root, "home");
  const source = join(root, "source");
  const target = join(home, ".agents", "skills", "strapivo");
  await mkdir(source, { recursive: true });
  await writeFile(join(source, "SKILL.md"), "managed\n", "utf8");
  await mkdir(target, { recursive: true });
  await writeFile(join(target, "SKILL.md"), "custom\n", "utf8");

  await assert.rejects(
    installSkill({ host: "codex", homeDirectory: home, sourceDirectory: source }),
    (error: unknown) => error instanceof CliError && error.code === "skill_conflict",
  );
  assert.equal(await readFile(join(target, "SKILL.md"), "utf8"), "custom\n");
});

test("all-host installation stages every host before changing either target", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "strapivo-skill-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const home = join(root, "home");
  const source = join(root, "source");
  await mkdir(source, { recursive: true });
  await writeFile(join(source, "SKILL.md"), "managed\n", "utf8");
  await mkdir(join(home, ".claude"), { recursive: true });
  await writeFile(join(home, ".claude", "skills"), "blocks skill directory", "utf8");

  await assert.rejects(
    installSkill({ host: "all", homeDirectory: home, sourceDirectory: source }),
    (error: unknown) => error instanceof CliError && error.code === "skill_install_failed",
  );
  await assert.rejects(access(join(home, ".agents", "skills", "strapivo")));
});

test("skill host validation rejects unknown agents", () => {
  assert.throws(
    () => validateSkillHost("other"),
    (error: unknown) => error instanceof CliError && error.code === "invalid_arguments",
  );
});
