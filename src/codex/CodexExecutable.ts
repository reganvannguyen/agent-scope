import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface CodexExecutableInfo {
  path: string;
  version: string;
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
