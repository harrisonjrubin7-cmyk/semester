import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const repositoryRoot = resolve(packageRoot, '..');
export const defaultStateRoot = process.env.SEMESTER_OPERATOR_STATE ? resolve(process.env.SEMESTER_OPERATOR_STATE) : resolve(packageRoot, '.state');
