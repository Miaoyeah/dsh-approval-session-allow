// Headless contract check for dsh-approval-session-allow.
//
// The plugin is a browser bundle, so this harness fakes just enough of the page
// (`window.__ModuleLoader__`, `localStorage`, a React-shaped renderer, and the
// Cordis client `ctx`) to run `apply()` and drive `approval/request`. It proves:
//   1. an approval with no grant still waits for the user;
//   2. the panel offers three answers, and "本对话均允许" records a grant;
//   3. a granted (Session, Tool) pair is answered "allowed-once" with no panel;
//   4. other tools, other conversations, and revoked grants still prompt;
//   5. corrupt storage degrades to asking instead of breaking the waterfall.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.join(here, '..', 'lib', 'client.js');

// --- fake page ---------------------------------------------------------------
const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => void store.set(k, String(v)),
  removeItem: (k) => void store.delete(k),
};

let registered;
const window = { __ModuleLoader__: { load(entry) { registered = entry; } } };

const h = (type, props, ...children) => ({ type, props: { ...(props ?? {}), children } });
const react = {
  createElement: h,
  useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
  useRef: (init) => ({ current: init }),
  useEffect: () => {},
};
const primitives = { Button: 'Button', StateDot: 'StateDot' };
const modules = { react, 'react/jsx-runtime': react, '@deepseek-ai/dsh-client-ui-primitives': primitives };

const source = await readFile(bundlePath, 'utf8');
new Function('window', 'localStorage', 'document', source)(window, localStorage, undefined);
assert.ok(registered, 'bundle called window.__ModuleLoader__.load');
assert.equal(registered.id, 'dsh-approval-session-allow');

const exports = registered.factory((id) => {
  if (!(id in modules)) throw new Error(`unexpected require(${id})`);
  return modules[id];
});
assert.equal(typeof exports.apply, 'function');
assert.deepEqual(exports.inject, ['sessions', 'remote', 'uiSession', 'slots', 'locale']);
const internals = exports.__internals;

// --- fake cordis client context ---------------------------------------------
const t = (key, params) => (params === undefined ? key : `${key}:${JSON.stringify(params)}`);
const waterfalls = [];
const pendings = [];
let Panel;
const ctx = {
  effect: (fn) => fn(),
  inject: (_deps, fn) => fn({ effect: (f) => f(), shortcuts: { registerFixed: () => {} } }),
  locale: {
    register: () => {},
    bind: () => t,
    resolveText: (value) => (typeof value === 'string' ? value : value?.zh ?? ''),
  },
  uiSession: {
    // Called once with the priority getter, returning the per-request register function.
    registerPendingInteraction: (_priority) => (pending) => {
      pendings.push(pending);
      return () => {};
    },
  },
  slots: {
    inject: (_name, fn) => fn(),
    register: (_options, component) => { Panel = component; },
  },
  remote: { $on: (event, listener) => { assert.equal(event, 'approval/request'); waterfalls.push(listener); } },
  sessions: { scopeOf: (owner) => owner.sessionId },
};
exports.apply(ctx);
assert.equal(waterfalls.length, 1, 'one approval/request listener');
assert.equal(typeof Panel, 'function', 'composer panel registered');
const listen = waterfalls[0];

const agent = { sessionId: 'session-1' };
const next = () => Promise.resolve('unavailable');

/** Depth-first walk over the stub element tree. */
function walk(node, visit) {
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const child of node) walk(child, visit); return; }
  visit(node);
  const children = node.props?.children;
  if (children !== undefined) walk(children, visit);
}
function findButton(tree, label) {
  let found;
  walk(tree, (node) => {
    if (node.type === 'Button' && [node.props.children].flat().includes(label)) found = node;
  });
  assert.ok(found, `panel renders a "${label}" button`);
  return found;
}
/** Expand function components the way a renderer would, leaving DOM-ish nodes. */
function expand(node) {
  if (node === null || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(expand);
  if (typeof node.type === 'function') return expand(node.type(node.props));
  return node;
}
function renderPanel(pending) {
  return expand(Panel({ matched: pending, renderSlot: () => null, resolveReason: (value) => value, t }));
}

// 1. No grant: the request waits for the user, and the panel offers all three answers.
{
  const result = listen.call(agent, { toolName: 'pwsh', reason: 'escalate sandbox to danger-full-access: demo' }, next);
  assert.equal(pendings.length, 1, 'pending interaction registered');
  const pending = pendings[0];
  assert.equal(pending.kind, 'approval');
  assert.equal(pending.sessionId, 'session-1');
  assert.equal(pending.toolName, 'pwsh');
  assert.equal(pending.answerable, true);

  const tree = renderPanel(pending);
  findButton(tree, 'reject');
  findButton(tree, 'allowOnce');
  findButton(tree, 'allowSession');

  // The user clicks "允许一次" this time, so nothing is remembered.
  findButton(tree, 'allowOnce').props.onClick();
  assert.equal(await result, 'allowed-once', 'user decision reaches the Host');
  assert.equal(internals.isGrantedForSession('session-1', 'pwsh'), false, 'allow-once is not remembered');
}

// 2. "本对话均允许" records the grant for this Session + Tool.
{
  const result = listen.call(agent, { toolName: 'pwsh' }, next);
  const pending = pendings[1];
  findButton(renderPanel(pending), 'allowSession').props.onClick();
  assert.equal(await result, 'allowed-once');
  assert.equal(internals.isGrantedForSession('session-1', 'pwsh'), true, 'session grant remembered');
  assert.deepEqual(internals.grantedToolsOf('session-1'), ['pwsh']);
}

// 3. Granted: the next request is auto-allowed, with no panel.
{
  const before = pendings.length;
  const outcome = await listen.call(agent, { toolName: 'pwsh', reason: 'escalate sandbox to danger-full-access: second call' }, next);
  assert.equal(outcome, 'allowed-once', 'granted tool is auto-allowed');
  assert.equal(pendings.length, before, 'no panel is registered for an auto-allowed request');
}

// 4. Another tool in the same session is still asked.
{
  const result = listen.call(agent, { toolName: 'write' }, next);
  assert.equal(pendings.length, 3, 'unrelated tool still prompts');
  pendings[2].answer('rejected');
  assert.equal(await result, 'rejected');
}

// 5. Another conversation is still asked, even for the same tool.
{
  const result = listen.call({ sessionId: 'session-2' }, { toolName: 'pwsh' }, next);
  assert.equal(pendings.length, 4, 'grant does not leak to another conversation');
  pendings[3].answer('rejected');
  assert.equal(await result, 'rejected');
}

// 6. The panel shows the live grant and its chip revokes it.
{
  const result = listen.call(agent, { toolName: 'read' }, next);
  const pending = pendings[4];
  const tree = renderPanel(pending);
  findButton(tree, 'allowSession');
  let chip;
  walk(tree, (node) => {
    if (node.type === 'button' && [...[node.props.children].flat()].join('').startsWith('pwsh')) chip = node;
  });
  assert.ok(chip, 'granted tool is listed for revocation');
  chip.props.onClick();
  assert.equal(internals.isGrantedForSession('session-1', 'pwsh'), false, 'chip revokes the grant');
  pendings[4].answer('allowed-once');
  assert.equal(await result, 'allowed-once');

  const after = listen.call(agent, { toolName: 'pwsh' }, next);
  assert.equal(pendings.length, 6, 'revoked tool prompts again');
  pendings[5].answer('allowed-once');
  assert.equal(await after, 'allowed-once');
}

// 7. Corrupt storage degrades to asking instead of failing the waterfall.
{
  localStorage.setItem(internals.STORAGE_KEY, '{not json');
  const result = listen.call(agent, { toolName: 'pwsh' }, next);
  assert.equal(pendings.length, 7, 'corrupt storage degrades to asking');
  pendings[6].answer('allowed-once');
  assert.equal(await result, 'allowed-once');
  store.clear();
}

// 8. A request with no Session scope delegates instead of prompting.
{
  const before = pendings.length;
  const outcome = await listen.call({}, { toolName: 'pwsh' }, next);
  assert.equal(outcome, 'unavailable', 'unscoped request delegates');
  assert.equal(pendings.length, before);
}

console.log('ok: approval-session-allow contract holds');
