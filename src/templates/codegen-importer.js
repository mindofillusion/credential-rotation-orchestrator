// Deliberately accepts action fragments only. Source is never evaluated or persisted.
const literal = String.raw`(?:"(?:[^"\\\r\n]|\\["\\nrt])*"|'(?:[^'\\\r\n]|\\['\\nrt])*')`;
const navigation = new RegExp(`^await\\s+page\\.goto\\((${literal})\\);$`);
const action = new RegExp(`^await\\s+page\\.locator\\((${literal})\\)\\.(click|fill)\\((${literal})?\\);$`);
const roles = new Set(['fill-current-password', 'fill-new-password', 'fill-confirm-password']);

function decode(value) {
  return value.slice(1, -1).replace(/\\([\\"'nrt])/g, (_, char) => ({ n: '\n', r: '\r', t: '\t' })[char] ?? char);
}

export function convertCodegen({ source, allowedOrigin, bindings = {} } = {}) {
  if (typeof source !== 'string' || source.length > 65536) throw new Error('Source must be text of at most 64 KiB');
  let origin;
  try { origin = new URL(allowedOrigin); } catch { throw new Error('An exact HTTPS origin is required'); }
  if (origin.protocol !== 'https:' || origin.origin !== allowedOrigin) throw new Error('An exact HTTPS origin is required');
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) throw new Error('Bindings must be an object');
  const steps = [];
  let removedValues = 0;
  for (const [index, raw] of source.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || line.startsWith('//')) continue;
    const fail = () => { throw new Error(`Unsupported or unsafe instruction at line ${index + 1}`); };
    const go = navigation.exec(line);
    if (go) {
      let url;
      try { url = new URL(decode(go[1])); } catch { fail(); }
      if (url.origin !== allowedOrigin || url.username || url.password || url.search || url.hash) fail();
      steps.push({ action: 'navigate', url: url.href });
    } else {
      const match = action.exec(line);
      if (!match) fail();
      const selector = decode(match[1]);
      if (!selector || selector.length > 500) fail();
      if (match[2] === 'click') {
        if (match[3]) fail();
        steps.push({ action: 'click', selector });
      } else {
        if (!match[3] || !Object.hasOwn(bindings, selector) || !roles.has(bindings[selector])) fail();
        // The recorded fill value is intentionally never decoded or returned.
        steps.push({ action: bindings[selector], selector });
        removedValues++;
      }
    }
    if (steps.length > 99) throw new Error('Recording contains too many actions');
  }
  if (!steps.length || steps[0].action !== 'navigate') throw new Error('Recording must begin with navigation');
  steps.push({ action: 'manual-checkpoint', message: 'Review this draft and add independent success verification before execution.' });
  return { schemaVersion: 1, steps, removedValues, reviewRequired: true };
}
