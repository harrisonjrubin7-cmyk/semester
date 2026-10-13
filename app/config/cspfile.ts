import {
  closeSync,
  constants,
  fstatSync,
  ftruncateSync,
  openSync,
  readFileSync,
  writeSync,
} from 'node:fs'

function assertRegularFile(descriptor: number): void {
  if (!fstatSync(descriptor).isFile()) {
    throw new Error('CSP build artifact is not a regular file')
  }
}

/** Rewrite only the regular file already bound to this descriptor. */
export function replaceInOpenFile(
  descriptor: number,
  search: string,
  replacement: string,
): boolean {
  assertRegularFile(descriptor)

  const text = readFileSync(descriptor, 'utf8')
  if (!text.includes(search)) return false

  const next = Buffer.from(text.split(search).join(replacement), 'utf8')
  ftruncateSync(descriptor, 0)
  let written = 0
  while (written < next.length) {
    const count = writeSync(descriptor, next, written, next.length - written, written)
    if (count === 0) throw new Error('CSP build artifact write made no progress')
    written += count
  }
  return true
}

/**
 * Preserve the read-only no-op for an artifact without the placeholder. A file
 * that needs mutation is reopened without following a link, then re-read and
 * rewritten only through that descriptor.
 */
export function replaceInFile(
  file: string,
  search: string,
  replacement: string,
): boolean {
  let preflightDescriptor: number
  try {
    preflightDescriptor = openSync(
      file,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    )
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }

  try {
    assertRegularFile(preflightDescriptor)
    const text = readFileSync(preflightDescriptor, 'utf8')
    if (!text.includes(search)) return false
  } finally {
    closeSync(preflightDescriptor)
  }

  let descriptor: number
  try {
    descriptor = openSync(
      file,
      constants.O_RDWR | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    )
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }

  try {
    return replaceInOpenFile(descriptor, search, replacement)
  } finally {
    closeSync(descriptor)
  }
}
