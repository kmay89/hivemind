// A permissive fake DOM/browser environment, just enough for index.html's inline
// script to boot and run its simulation loop without a real browser. Every
// unrecognized property/method access on a stub element returns another stub
// (chainable, callable) rather than throwing, since the goal is "don't crash",
// not "faithfully implement the DOM". Dev-only. See CLAUDE.md.
'use strict';

function makeStub(name) {
  const store = new Map();
  const fn = function stub() { return makeStub(name + '()'); };
  const handler = {
    get(_target, prop) {
      // numeric/string coercion (e.g. `el.offsetHeight+8`, template strings) must
      // bottom out in a real primitive, not another stub, or `+`/`${}` throws
      // "Cannot convert object to primitive value".
      if (prop === Symbol.toPrimitive) return (hint) => (hint === 'number' ? 0 : '');
      if (prop === 'valueOf') return () => 0;
      if (prop === 'toString') return () => '';
      if (prop === 'then' || prop === Symbol.iterator || prop === Symbol.asyncIterator) return undefined;
      if (store.has(prop)) return store.get(prop);
      if (prop === 'offsetWidth' || prop === 'offsetHeight' || prop === 'clientWidth' || prop === 'clientHeight'
        || prop === 'scrollWidth' || prop === 'scrollHeight' || prop === 'length') return 0;
      if (prop === 'textContent' || prop === 'innerText' || prop === 'innerHTML' || prop === 'value') return '';
      if (prop === 'disabled' || prop === 'checked') return false;
      if (prop === 'classList') { const cl = makeClassList(); store.set(prop, cl); return cl; }
      if (prop === 'style') { const s = makeStub('style'); store.set(prop, s); return s; }
      if (prop === 'dataset') { const d = {}; store.set(prop, d); return d; }
      if (prop === 'children' || prop === 'childNodes') return [];
      if (prop === 'getBoundingClientRect') return () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 });
      if (prop === 'getContext') return () => makeCtxStub();
      if (prop === 'querySelector' || prop === 'closest') return () => makeStub('el');
      if (prop === 'querySelectorAll') return () => [];
      if (prop === 'cloneNode') return () => makeStub('el');
      if (prop === 'contains') return () => false;
      if (prop === 'matches') return () => false;
      if (prop === 'animate') return () => ({ cancel() {}, finished: Promise.resolve() });
      if (prop === 'addEventListener' || prop === 'removeEventListener') return () => {};
      if (prop === 'setAttribute' || prop === 'removeAttribute' || prop === 'remove' || prop === 'focus' || prop === 'insertAdjacentHTML' || prop === 'appendChild' || prop === 'removeChild' || prop === 'scrollIntoView') return () => {};
      // any other property (parentNode, offsetWidth, textContent, a chained
      // .foo.bar.baz…) becomes its own cached, chainable, callable stub instead
      // of returning this element's own callable — that made a().b() throw
      // ("b is not a function") the moment anything chained off a stub.
      if (typeof prop === 'string') { const child = makeStub(name + '.' + prop); store.set(prop, child); return child; }
      return undefined;
    },
    set(_target, prop, value) { store.set(prop, value); return true; },
    has() { return true; },
    apply() { return makeStub(name + '()'); },
  };
  return new Proxy(fn, handler);
}

function makeClassList() {
  const set = new Set();
  return { add: (...c) => c.forEach(x => set.add(x)), remove: (...c) => c.forEach(x => set.delete(x)),
    toggle: (c, force) => { const on = force === undefined ? !set.has(c) : force; if (on) set.add(c); else set.delete(c); return on; },
    contains: (c) => set.has(c) };
}

function makeCtxStub() {
  // canvas 2D context: gradients need addColorStop; everything else is a no-op
  return new Proxy({}, {
    get(_t, prop) {
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (prop === 'measureText') return () => ({ width: 0 });
      if (prop === 'setTransform' || prop === 'getTransform') return () => {};
      return () => {};
    },
    set() { return true; },
  });
}

function makeDocumentStub() {
  const byId = new Map();
  return {
    getElementById(id) { if (!byId.has(id)) byId.set(id, makeStub('#' + id)); return byId.get(id); },
    querySelector: () => makeStub('el'),
    querySelectorAll: () => [],
    createElement: () => makeStub('el'),
    addEventListener: () => {},
    removeEventListener: () => {},
    body: makeStub('body'),
    documentElement: makeStub('html'),
    fonts: { ready: Promise.resolve() },
    activeElement: makeStub('activeElement'),
    visibilityState: 'visible',
    hidden: false,
  };
}

function makeLocalStorageStub() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
  };
}

function createEnvironment() {
  const documentStub = makeDocumentStub();
  const localStorageStub = makeLocalStorageStub();
  const listeners = {};
  const windowStub = {
    innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener: () => {},
    setTimeout, clearTimeout, setInterval, clearInterval,
    location: { protocol: 'file:', hostname: '', href: 'file:///index.html', reload() {} },
    navigator: { vibrate: () => false, canShare: () => false, userAgent: 'node-harness', serviceWorker: undefined },
    performance: { now: () => Date.now() },
    localStorage: localStorageStub,
    document: documentStub,
    console,
  };
  return { windowStub, documentStub, localStorageStub, listeners };
}

module.exports = { createEnvironment, makeStub };
