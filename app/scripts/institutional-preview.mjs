#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 4179;

export function parsePreviewArgs(argv) {
  let host = DEFAULT_HOST;
  let port = DEFAULT_PORT;
  let hostExplicit = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--port') {
      const value = argv[++index];
      if (!/^\d+$/.test(value ?? '')) throw new Error('--port requires an integer');
      port = Number(value);
      if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
        throw new Error('--port must be between 1 and 65535');
      }
      continue;
    }
    if (argument === '--host') {
      const value = argv[++index];
      if (!value || !/^[a-zA-Z0-9.:[\]-]+$/.test(value)) {
        throw new Error('--host requires an explicit hostname or address');
      }
      host = value;
      hostExplicit = true;
      continue;
    }
    throw new Error(`unknown argument: ${argument}`);
  }

  return { host, port, hostExplicit };
}

export function launcherConfig(argv, baseEnv = process.env, execPath = process.execPath) {
  const options = parsePreviewArgs(argv);
  const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
  return {
    command: execPath,
    args: [vite, '--host', options.host, '--port', String(options.port), '--strictPort'],
    env: { ...baseEnv, VITE_INSTITUTIONAL_PREVIEW: 'true' },
    options,
  };
}

export function announcement({ host, port }) {
  return `Institutional preview: http://${host}:${port}/`;
}

export function forwardSignals(child, parent = process) {
  const onInterrupt = () => child.kill('SIGINT');
  const onTerminate = () => child.kill('SIGTERM');
  parent.on('SIGINT', onInterrupt);
  parent.on('SIGTERM', onTerminate);
  return () => {
    parent.off('SIGINT', onInterrupt);
    parent.off('SIGTERM', onTerminate);
  };
}

async function main() {
  const config = launcherConfig(process.argv.slice(2));
  if (config.options.host !== DEFAULT_HOST && !config.options.hostExplicit) {
    throw new Error('a non-loopback host must be supplied explicitly with --host');
  }

  console.log(announcement(config.options));
  const child = spawn(config.command, config.args, {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: config.env,
    stdio: 'inherit',
  });
  const stopForwarding = forwardSignals(child);
  child.once('error', (error) => {
    stopForwarding();
    console.error(`Institutional preview failed to start: ${error.message}`);
    process.exitCode = 1;
  });
  child.once('exit', (code, signal) => {
    stopForwarding();
    if (signal) process.exitCode = 128;
    else process.exitCode = code ?? 1;
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Institutional preview: ${error.message}`);
    process.exitCode = 1;
  });
}
