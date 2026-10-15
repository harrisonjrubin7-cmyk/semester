import { readFileSync } from 'node:fs';
import { parseSync, type ESTree } from 'rolldown/utils';
import { describe, expect, it } from 'vitest';

const source = () => readFileSync(new URL('./DemandContribution.test.tsx', import.meta.url), 'utf8');

// University is a real component dependency, like the three components already
// loaded during collection. Its cold import must not consume the behavioral
// test's unchanged 15-second render/assertion budget.
function program(text: string): ESTree.Program | null {
  const parsed = parseSync('DemandContribution.test.tsx', text, { lang: 'tsx', sourceType: 'module' });
  return parsed.errors.length === 0 ? parsed.program : null;
}

function preparesUniversity(text: string): boolean {
  // Only a module-level awaited import binds the real component before cases
  // run. Comments, strings and declarations inside callbacks are not setup.
  return program(text)?.body.some(statement => statement.type === 'VariableDeclaration' &&
    statement.kind === 'const' && !statement.declare && statement.declarations.some(declaration => {
      if (declaration.id.type !== 'ObjectPattern' || declaration.id.properties.length !== 1) return false;
      const binding = declaration.id.properties[0];
      const awaited = declaration.init;
      return binding.type === 'Property' && !binding.computed &&
        binding.key.type === 'Identifier' && binding.key.name === 'University' &&
        binding.value.type === 'Identifier' && binding.value.name === 'University' &&
        awaited?.type === 'AwaitExpression' && awaited.argument.type === 'ImportExpression' &&
        awaited.argument.source.type === 'Literal' && awaited.argument.source.value === '../screens/University';
    })) ?? false;
}

function namedCall(node: ESTree.Node | undefined, name: string): node is ESTree.CallExpression {
  return node?.type === 'CallExpression' && !node.optional && node.callee.type === 'Identifier' && node.callee.name === name;
}

function registeredCases(statements: Array<ESTree.Statement | ESTree.Directive>): ESTree.CallExpression[] {
  const cases: ESTree.CallExpression[] = [];
  for (const statement of statements) {
    // Registration after a straight-line abrupt exit is unreachable.
    if (statement.type === 'ReturnStatement' || statement.type === 'ThrowStatement') break;
    if (statement.type !== 'ExpressionStatement') continue;
    const call = statement.expression;
    if (namedCall(call, 'it')) cases.push(call);
    if (!namedCall(call, 'describe')) continue;
    const callback = call.arguments[1];
    if (callback?.type === 'ArrowFunctionExpression' && callback.body.type === 'BlockStatement') {
      cases.push(...registeredCases(callback.body.body));
    }
  }
  return cases;
}

function preservesUniversityBehavior(text: string): boolean {
  const parsed = program(text);
  if (!parsed) return false;
  const tests = registeredCases(parsed.body).filter(call => call.arguments[0]?.type === 'Literal' &&
    call.arguments[0].value === 'University has no Demand tab');
  if (tests.length !== 1 || tests[0].arguments.length !== 3) return false;
  const [, callback, timeout] = tests[0].arguments;
  if (timeout.type !== 'Literal' || timeout.value !== 15_000 || callback.type !== 'ArrowFunctionExpression' ||
    !callback.async || callback.params.length !== 0 || callback.body.type !== 'BlockStatement' ||
    callback.body.body.length !== 2) return false;

  // Require the two actual, unconditional statements, not matching source text
  // hidden in comments, templates, unused callbacks, or skipped test calls.
  const [renderStatement, assertionStatement] = callback.body.body;
  if (renderStatement.type !== 'ExpressionStatement' || renderStatement.expression.type !== 'AwaitExpression' ||
    !namedCall(renderStatement.expression.argument, 'render') || renderStatement.expression.argument.arguments.length !== 1) return false;
  const view = renderStatement.expression.argument.arguments[0];
  if (view.type !== 'JSXElement' || view.openingElement.name.type !== 'JSXIdentifier' ||
    view.openingElement.name.name !== 'University' || !view.openingElement.selfClosing ||
    view.openingElement.attributes.length !== 0 || view.children.length !== 0) return false;

  if (assertionStatement.type !== 'ExpressionStatement' || assertionStatement.expression.type !== 'CallExpression') return false;
  const assertion = assertionStatement.expression;
  if (assertion.optional || assertion.arguments.length !== 0 || assertion.callee.type !== 'MemberExpression' ||
    assertion.callee.computed || assertion.callee.optional || assertion.callee.property.type !== 'Identifier' ||
    assertion.callee.property.name !== 'toThrow' || !namedCall(assertion.callee.object, 'expect') ||
    assertion.callee.object.arguments.length !== 1) return false;
  const check = assertion.callee.object.arguments[0];
  if (check.type !== 'ArrowFunctionExpression' || check.async || check.params.length !== 0 ||
    !namedCall(check.body, 'button') || check.body.arguments.length !== 1) return false;
  const demand = check.body.arguments[0];
  return demand.type === 'Literal' && 'regex' in demand && demand.regex.pattern === '^Demand$' && demand.regex.flags === '';
}

describe('DemandContribution University dependency setup', () => {
  it('recognizes an awaited real import outside the timed case (positive control)', () => {
    expect(preparesUniversity("const { University } = await import('../screens/University');\nit('University has no Demand tab', async () => { await render(<University />); }, 15_000);")).toBe(true);
    expect(preparesUniversity('const {University}=await import("../screens/University");')).toBe(true);
  });

  it('rejects a cold import inside the case and an unawaited setup import (negative controls)', () => {
    expect(preparesUniversity("it('University has no Demand tab', async () => { const { University } = await import('../screens/University'); await render(<University />); }, 15_000);")).toBe(false);
    expect(preparesUniversity("const University = import('../screens/University');")).toBe(false);
    expect(preparesUniversity("const { University } = import('../screens/University');")).toBe(false);
    expect(preparesUniversity("{\nconst { University } = await import('../screens/University');\n}")).toBe(false);
    expect(preparesUniversity("const { Other: University } = await import('../screens/University');")).toBe(false);
    expect(preparesUniversity("const { University } = await import('./fixture');")).toBe(false);
    expect(preparesUniversity("// const { University } = await import('../screens/University');")).toBe(false);
  });

  it.each([
    ['block comment', "/*\nconst { University } = await import('../screens/University');\n*/"],
    ['template string', "const example = `\nconst { University } = await import('../screens/University');\n`;"],
    ['syntax error', "const { University } = await import('../screens/University');\nconst = ;"],
  ])('rejects import text in a %s', (_name, text) => {
    expect(preparesUniversity(text)).toBe(false);
  });

  it('recognizes executable rendering, assertion and timeout (positive control)', () => {
    expect(preservesUniversityBehavior("it('University has no Demand tab', async () => {\n    await render(<University />);\n    expect(() => button(/^Demand$/)).toThrow();\n  }, 15_000);")).toBe(true);
  });

  it.each([
    ['line comments', "it('University has no Demand tab', async () => {\n    // await render(<University />);\n    // expect(() => button(/^Demand$/)).toThrow();\n  }, 15_000);"],
    ['block comment', "it('University has no Demand tab', async () => {\n    /* await render(<University />);\n    expect(() => button(/^Demand$/)).toThrow(); */\n  }, 15_000);"],
    ['template string', "it('University has no Demand tab', async () => {\n    const example = `await render(<University />);\n    expect(() => button(/^Demand$/)).toThrow();`;\n  }, 15_000);"],
    ['commented test', "/* it('University has no Demand tab', async () => {\n    await render(<University />);\n    expect(() => button(/^Demand$/)).toThrow();\n  }, 15_000); */"],
  ])('rejects behavioral text in %s', (_name, text) => {
    expect(preservesUniversityBehavior(text)).toBe(false);
  });

  it.each([
    ['changed timeout', "it('University has no Demand tab', async () => { await render(<University />); expect(() => button(/^Demand$/)).toThrow(); }, 30_000);"],
    ['string timeout', "it('University has no Demand tab', async () => { await render(<University />); expect(() => button(/^Demand$/)).toThrow(); }, '15_000');"],
    ['skipped case', "it.skip('University has no Demand tab', async () => { await render(<University />); expect(() => button(/^Demand$/)).toThrow(); }, 15_000);"],
    ['uninvoked callback', "it('University has no Demand tab', async () => { const unused = async () => { await render(<University />); expect(() => button(/^Demand$/)).toThrow(); }; }, 15_000);"],
    ['conditional render', "it('University has no Demand tab', async () => { if (false) { await render(<University />); } expect(() => button(/^Demand$/)).toThrow(); }, 15_000);"],
    ['syntax error', "it('University has no Demand tab', async () => { await render(<University />); expect(() => button(/^Demand$/)).toThrow(); }, 15_000); const = ;"],
  ])('rejects a %s instead of the preserved executable behavior', (_name, text) => {
    expect(preservesUniversityBehavior(text)).toBe(false);
  });

  it.each([
    ['return', "describe('scope', () => { return; it('University has no Demand tab', async () => { await render(<University />); expect(() => button(/^Demand$/)).toThrow(); }, 15_000); });"],
    ['throw', "describe('scope', () => { throw new Error('stop'); it('University has no Demand tab', async () => { await render(<University />); expect(() => button(/^Demand$/)).toThrow(); }, 15_000); });"],
  ])('rejects registration after an unconditional %s', (_name, text) => {
    expect(preservesUniversityBehavior(text)).toBe(false);
  });

  it('prepares the real University dependency before its timed behavioral assertion', () => {
    expect(preparesUniversity(source())).toBe(true);
  });

  it('retains the real render, no-Demand assertion and explicit 15-second budget', () => {
    expect(preservesUniversityBehavior(source())).toBe(true);
  });
});
