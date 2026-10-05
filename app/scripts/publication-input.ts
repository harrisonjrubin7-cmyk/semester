/** Exported documents live outside the checkout; only an explicit request requires them. */
export function publicationMode(explicit: boolean, directoryExists: boolean, toolsAvailable: boolean): 'run' | 'skip' {
  if (explicit && !directoryExists) throw new Error('The requested publication directory does not exist.');
  if (explicit && !toolsAvailable) throw new Error('Publication verification requires pdfinfo, pdftotext and unzip.');
  return directoryExists && toolsAvailable ? 'run' : 'skip';
}
