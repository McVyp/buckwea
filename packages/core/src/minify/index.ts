import { tokenizer, tokTypes as tt, type Token } from "acorn";

export interface OffsetEntry {
  oldStart: number;
  newStart: number;
}

export interface MinifyResult {
  code: string;
  offsets: OffsetEntry[];
}

const WORD_CHAR = /[a-zA-Z0-9_$\\\u0080-\uffff]/;
const LINE_TERMINATOR = /\r\n|[\n\r\u2028\u2029]/;

//  true when two tokens would merge into something different without a space between them, eg: "const x" -> ""constx", "a - -b" -> "a--b".

function needsSpace(prev: Token, prevText: string, nextText: string): boolean {
  const last = prevText[prevText.length - 1];
  const first = nextText[0];
  if (!last || !first) return false;
  if (WORD_CHAR.test(last) && WORD_CHAR.test(first)) return true;
  if ((last === "+" || last === "-") && first === last) return true;
  if (last === "/" && (first === "/" || first === "*")) return true;
  if (prev.type === tt.num && first === ".") return true;
  return false;
}

// removes comments and unnecessary whitespace from the code.
export function minify(source: string): MinifyResult {
  const tokens = [
    ...tokenizer(source, { ecmaVersion: "latest", sourceType: "module" }),
  ];

  let code = "";
  const offsets: OffsetEntry[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const text = source.slice(token.start, token.end);

    if (i > 0) {
      const prev = tokens[i - 1];
      const gap = source.slice(prev.end, token.start);
      if (LINE_TERMINATOR.test(gap)) {
        code += "\n";
      } else if (
        gap !== "" &&
        needsSpace(prev, source.slice(prev.start, prev.end), text)
      ) {
        code += " ";
      }
    }
    offsets.push({ oldStart: token.start, newStart: code.length });
    code += text;
  }
  return { code, offsets };
}

// maps an offset in the original code to the minified code: the new position of the first token starting at or after it.
export function translateOffset(
  offsets: OffsetEntry[],
  oldOffset: number,
  minifiedLength: number,
): number {
  let lo = 0;
  let hi = offsets.length;

  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid].oldStart < oldOffset) lo = mid + 1;
    else hi = mid;
  }
  return lo < offsets.length ? offsets[lo].newStart : minifiedLength;
}
