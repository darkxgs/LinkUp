// Converts a CSS declaration string into a React style object.
export function css(str: string): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (!str) return out;
  for (const decl of str.split(';')) {
    const idx = decl.indexOf(':');
    if (idx < 0) continue;
    const key = decl.slice(0, idx).trim();
    const val = decl.slice(idx + 1).trim();
    if (!key || !val) continue;
    if (key.startsWith('--')) {
      out[key] = val;
      continue;
    }
    const camel = key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    out[camel] = val;
  }
  return out;
}

export const hover = (props: Record<string, [string, string]>) => {
  const handlers: {
    onMouseOver?: (e: React.MouseEvent<HTMLElement>) => void;
    onMouseOut?: (e: React.MouseEvent<HTMLElement>) => void;
  } = {};
  for (const [prop, [from, to]] of Object.entries(props)) {
    handlers.onMouseOver = mergeHandler(handlers.onMouseOver, (e) => {
      (e.currentTarget as HTMLElement).style[prop as any] = to;
    });
    handlers.onMouseOut = mergeHandler(handlers.onMouseOut, (e) => {
      (e.currentTarget as HTMLElement).style[prop as any] = from;
    });
  }
  return handlers;
};

function mergeHandler<T extends (e: React.MouseEvent<HTMLElement>) => void>(
  existing: T | undefined,
  fn: T,
): T {
  if (!existing) return fn;
  return ((e) => {
    existing(e);
    fn(e);
  }) as T;
}
