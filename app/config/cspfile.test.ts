import { afterEach, describe, expect, it } from 'vitest'
import {
  closeSync,
  mkdtempSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { replaceInFile, replaceInOpenFile } from './cspfile.ts'

const PLACEHOLDER = '%VITE_CSP_EXTRA_CONNECT%'
let fixture = ''

afterEach(() => {
  if (fixture) rmSync(fixture, { recursive: true, force: true })
  fixture = ''
})

describe('CSP build artifact replacement', () => {
  it('updates the opened artifact without following a replaced pathname', () => {
    fixture = mkdtempSync(join(tmpdir(), 'semester-csp-file-'))
    const published = join(fixture, '_headers')
    const opened = join(fixture, '_headers.opened')
    writeFileSync(published, `connect-src ${PLACEHOLDER}\n`)

    const descriptor = openSync(published, 'r+')
    try {
      renameSync(published, opened)
      writeFileSync(published, 'replacement path\n')

      expect(replaceInOpenFile(descriptor, PLACEHOLDER, 'https://api.example')).toBe(true)
    } finally {
      closeSync(descriptor)
    }

    expect(readFileSync(opened, 'utf8')).toBe('connect-src https://api.example\n')
    expect(readFileSync(published, 'utf8')).toBe('replacement path\n')
  })

  it('rewrites a regular artifact in place with its mode intact', () => {
    fixture = mkdtempSync(join(tmpdir(), 'semester-csp-file-'))
    const file = join(fixture, '_headers')
    writeFileSync(file, `connect-src ${PLACEHOLDER}\n`, { mode: 0o640 })
    const before = statSync(file)

    expect(replaceInFile(file, PLACEHOLDER, 'https://api.example')).toBe(true)

    const after = statSync(file)
    expect(readFileSync(file, 'utf8')).toBe('connect-src https://api.example\n')
    expect({ device: after.dev, inode: after.ino }).toEqual({ device: before.dev, inode: before.ino })
    expect(after.mode & 0o777).toBe(before.mode & 0o777)
  })

  it('leaves missing and already-substituted artifacts alone', () => {
    fixture = mkdtempSync(join(tmpdir(), 'semester-csp-file-'))
    const missing = join(fixture, 'missing')
    const complete = join(fixture, '_headers')
    writeFileSync(complete, 'connect-src https://api.example\n')

    expect(replaceInFile(missing, PLACEHOLDER, '')).toBe(false)
    expect(replaceInFile(complete, PLACEHOLDER, '')).toBe(false)
    expect(readFileSync(complete, 'utf8')).toBe('connect-src https://api.example\n')
  })

  it('rejects a nonregular artifact before trying to read it', () => {
    fixture = mkdtempSync(join(tmpdir(), 'semester-csp-file-'))

    expect(() => replaceInFile(fixture, PLACEHOLDER, '')).toThrow(
      'CSP build artifact is not a regular file',
    )
  })
})
