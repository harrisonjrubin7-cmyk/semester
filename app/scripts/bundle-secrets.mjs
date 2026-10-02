#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.map', '.mjs', '.svg', '.txt', '.xml']);

const CREDENTIAL_PATTERNS = [
  ['private-key', /-----BEGIN (?:EC |OPENSSH |RSA )?PRIVATE KEY-----/g],
  ['anthropic-key', /sk-ant-(?:api\d+-)?[A-Za-z0-9_-]{20,}/g],
  ['openai-key', /sk-(?!ant-)(?:proj-)?[A-Za-z0-9_-]{24,}/g],
  ['stripe-secret', /(?:sk|rk)_live_[A-Za-z0-9]{16,}/g],
  ['stripe-webhook-secret', /whsec_[A-Za-z0-9]{16,}/g],
  ['supabase-secret', /sb_secret_[A-Za-z0-9_-]{16,}/g],
  ['github-token', /(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,})/g],
  ['aws-access-key', /AKIA[0-9A-Z]{16}/g],
  ['google-api-key', /AIza[0-9A-Za-z_-]{35}/g],
  ['resend-key', /re_[A-Za-z0-9]{32,}/g],
  ['twilio-api-key', /SK[0-9a-fA-F]{32}/g],
];

const JWT = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

function decodeJwtPayload(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function credentialFindings(text) {
  const findings = [];
  for (const [id, pattern] of CREDENTIAL_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) findings.push(id);
  }
  JWT.lastIndex = 0;
  for (const match of text.matchAll(JWT)) {
    if (decodeJwtPayload(match[0])?.role === 'service_role') {
      findings.push('supabase-service-role-jwt');
      break;
    }
  }
  return [...new Set(findings)];
}

function textFiles(directory) {
  const files = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...textFiles(path));
    else if (stat.isFile() && TEXT_EXTENSIONS.has(extname(name).toLowerCase())) files.push(path);
  }
  return files;
}

export function scanBundle(directory) {
  const root = resolve(directory);
  const files = textFiles(root);
  if (!files.length) throw new Error(`no text artifacts found in ${root}`);
  const findings = [];
  for (const file of files) {
    for (const rule of credentialFindings(readFileSync(file, 'utf8'))) {
      findings.push({ file: file.slice(root.length + 1), rule });
    }
  }
  return { files: files.length, findings };
}

const calledDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (calledDirectly) {
  const directory = process.argv[2] || 'dist';
  try {
    const result = scanBundle(directory);
    if (result.findings.length) {
      console.error(`Bundle secret scan failed (${result.findings.length}):`);
      for (const finding of result.findings) console.error(`- ${finding.file}: ${finding.rule}`);
      process.exit(1);
    }
    console.log(`bundle secret scan passed: ${result.files} text artifacts, no credential-shaped values`);
  } catch (error) {
    console.error(`Bundle secret scan could not run: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
}
