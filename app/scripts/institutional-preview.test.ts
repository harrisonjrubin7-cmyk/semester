import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import {
  announcement,
  forwardSignals,
  launcherConfig,
  parsePreviewArgs,
} from './institutional-preview.mjs';

describe('institutional preview launcher', () => {
  it('uses the exact preview flag, loopback host, and default port', () => {
    const config = launcherConfig([], { PATH: '/bin' }, '/runtime/node');

    expect(config.command).toBe('/runtime/node');
    expect(config.args.join(' ')).toContain('vite.js --host 127.0.0.1 --port 4179');
    expect(config.env).toEqual({ PATH: '/bin', VITE_INSTITUTIONAL_PREVIEW: 'true' });
    expect(announcement(config.options)).toBe('Institutional preview: http://127.0.0.1:4179/');
    expect(announcement(config.options)).not.toContain('VITE_');
  });

  it('accepts a validated numeric port and deliberate host exposure', () => {
    expect(parsePreviewArgs(['--port', '5180'])).toMatchObject({
      host: '127.0.0.1',
      port: 5180,
      hostExplicit: false,
    });
    expect(parsePreviewArgs(['--host', '0.0.0.0', '--port', '5180'])).toMatchObject({
      host: '0.0.0.0',
      port: 5180,
      hostExplicit: true,
    });
  });

  it('refuses malformed ports, implicit remote hosts, and unknown arguments', () => {
    for (const args of [
      ['--port', 'abc'],
      ['--port', '0'],
      ['--port', '65536'],
      ['--host', ''],
      ['--host-from-env', '0.0.0.0'],
    ]) {
      expect(() => parsePreviewArgs(args)).toThrow();
    }
  });

  it('forwards termination signals to the child process', () => {
    const parent = new EventEmitter();
    const child = { kill: vi.fn() };
    const stop = forwardSignals(child, parent);

    parent.emit('SIGINT');
    parent.emit('SIGTERM');
    expect(child.kill).toHaveBeenNthCalledWith(1, 'SIGINT');
    expect(child.kill).toHaveBeenNthCalledWith(2, 'SIGTERM');

    stop();
    parent.emit('SIGINT');
    expect(child.kill).toHaveBeenCalledTimes(2);
  });
});
