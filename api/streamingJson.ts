/**
 * Incremental reader for a JSON object that arrives in fragments.
 *
 * The hosted Study Guide monolith emits its fields in schema order, so the
 * title, Quick Start and bridge are all written long before the page prose the
 * learner is waiting on. Reading the response as it streams lets the creation
 * panel show those early instead of holding everything back until the last
 * token lands.
 *
 * The reader only ever hands back a value parsed at a "safe point": a position
 * where every open container holds complete entries. A half-written string
 * therefore never escapes, so the UI cannot render torn prose.
 */

type ContainerChar = "{" | "[";

export interface PartialJsonSnapshot {
  /** Parsed value holding every field completed so far. */
  value: unknown;
  /** True once the root container closed, so this is the whole document. */
  complete: boolean;
}

export interface PartialJsonReader {
  /** Feeds the next fragment. True when a new safe point became available. */
  push(chunk: string): boolean;
  /** Latest parseable value, or undefined before the first safe point. */
  snapshot(): PartialJsonSnapshot | undefined;
  /** Everything pushed so far, unmodified. */
  text(): string;
}

const closerFor = (container: ContainerChar): string =>
  container === "{" ? "}" : "]";

export const createPartialJsonReader = (): PartialJsonReader => {
  let text = "";
  let scanned = 0;
  let inString = false;
  let escaped = false;
  let rootClosed = false;
  const stack: ContainerChar[] = [];
  // Offset to slice at, plus the containers still open there. Both only ever
  // move forward, so a late malformed tail cannot retract earlier fields.
  let safeIndex = -1;
  let safeStack: ContainerChar[] = [];

  const markSafe = (index: number) => {
    safeIndex = index;
    safeStack = [...stack];
  };

  const scan = (): boolean => {
    let foundSafePoint = false;

    for (let index = scanned; index < text.length; index += 1) {
      const char = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }

        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === "{" || char === "[") {
        stack.push(char);
        continue;
      }

      if (char === "}" || char === "]") {
        stack.pop();
        // The closer belongs to the completed value, so keep it.
        markSafe(index + 1);
        foundSafePoint = true;
        if (!stack.length) {
          rootClosed = true;
        }

        continue;
      }

      // A separator means whatever preceded it inside this container is a
      // finished value. Slicing before the comma drops nothing complete.
      if (char === "," && stack.length) {
        markSafe(index);
        foundSafePoint = true;
      }
    }

    scanned = text.length;
    return foundSafePoint;
  };

  return {
    push(chunk: string): boolean {
      if (!chunk) {
        return false;
      }

      text += chunk;
      return scan();
    },

    snapshot(): PartialJsonSnapshot | undefined {
      if (safeIndex < 0) {
        return undefined;
      }

      const closers = safeStack
        .map(closerFor)
        .reverse()
        .join("");

      try {
        return {
          value: JSON.parse(text.slice(0, safeIndex) + closers),
          complete: rootClosed,
        };
      } catch {
        return undefined;
      }
    },

    text(): string {
      return text;
    },
  };
};
