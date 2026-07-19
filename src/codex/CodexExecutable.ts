import { execFile } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface CodexExecutableInfo {
  path: string;
  version: string;
}

export async function resolveCodexExecutable(configuredPath: string): Promise<CodexExecutableInfo> {
  if (configuredPath !== 'codex') return detectCodexExecutable(configuredPath);
  let pathFailure: Error | undefined;
  try {
    return await detectCodexExecutable(configuredPath);
  } catch (error) {
    pathFailure = error instanceof Error ? error : new Error('Codex was not found on PATH');
  }
  for (const candidate of await findBundledCodexCandidates()) {
    try {
      return await detectCodexExecutable(candidate);
    } catch {
      // Installed extension folders can be stale or partially removed. Try the next candidate.
    }
  }
  throw new Error(`${pathFailure.message}. No usable Codex executable was found in installed OpenAI VS Code extensions. Configure codexAgentMap.codexPath explicitly.`, { cause: pathFailure });
}

export async function findBundledCodexCandidates(
  home = homedir(), platform: NodeJS.Platform = process.platform, architecture = process.arch
): Promise<string[]> {
  const roots = ['.vscode', '.vscode-insiders', '.vscode-oss'].map(folder => join(home, folder, 'extensions'));
  const candidates: string[] = [];
  for (const root of roots) {
    let names: string[];
    try {
      names = (await readdir(root, { withFileTypes: true }))
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
    } catch {
      continue;
    }
    candidates.push(...bundledCodexCandidatesFromNames(root, names, platform, architecture));
  }
  return candidates;
}

export function bundledCodexCandidatesFromNames(
  extensionRoot: string, directoryNames: string[], platform: NodeJS.Platform, architecture: string
): string[] {
  const platformDirectory = codexPlatformDirectory(platform, architecture);
  if (platformDirectory === undefined) return [];
  const executable = platform === 'win32' ? 'codex.exe' : 'codex';
  return directoryNames
    .filter(name => name.toLowerCase().startsWith('openai.chatgpt-'))
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
    .map(name => join(extensionRoot, name, 'bin', platformDirectory, executable));
}

function codexPlatformDirectory(platform: NodeJS.Platform, architecture: string): string | undefined {
  const architectureName = architecture === 'arm64' ? 'aarch64' : architecture === 'x64' ? 'x86_64' : undefined;
  if (architectureName === undefined) return undefined;
  if (platform === 'win32') return `windows-${architectureName}`;
  if (platform === 'darwin') return `macos-${architectureName}`;
  if (platform === 'linux') return `linux-${architectureName}`;
  return undefined;
}

export async function detectCodexExecutable(path: string): Promise<CodexExecutableInfo> {
  try {
    const { stdout, stderr } = await execFileAsync(path, ['--version'], {
      shell: false,
      timeout: 10_000,
      windowsHide: true
    });
    const version = `${stdout}${stderr}`.trim();
    if (version === '') throw new Error('Codex returned no version information');
    return { path, version };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown executable error';
    throw new Error(`Unable to run Codex executable at "${path}": ${detail}`, { cause: error });
  }
}
