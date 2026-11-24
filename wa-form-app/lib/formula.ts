/**
 * A tiny, safe arithmetic evaluator for Calculation / Live Quote Calculator
 * fields. Deliberately NOT using eval() or new Function() — this is a
 * hand-rolled recursive-descent parser over a small grammar so a formula
 * can never execute arbitrary JS, only +, -, *, /, parentheses, numbers,
 * and {fieldId} references substituted from the form's current answers.
 *
 * Grammar:
 *   expr   := term (("+" | "-") term)*
 *   term   := factor (("*" | "/") factor)*
 *   factor := number | "{" fieldId "}" | "(" expr ")" | "-" factor
 */

export type FieldValues = Record<string, string | string[] | undefined>;

function toNumber(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = parseFloat(value ?? "");
  return Number.isFinite(n) ? n : 0;
}

/** Replaces every {fieldId} reference with its current numeric value
 * (0 if missing or non-numeric), then evaluates the resulting expression. */
export function evaluateFormula(formula: string, values: FieldValues): number | null {
  if (!formula || !formula.trim()) return null;

  const substituted = formula.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, fieldId: string) =>
    String(toNumber(values[fieldId]))
  );

  try {
    return parseExpression(substituted);
  } catch {
    return null;
  }
}

function parseExpression(source: string): number {
  let pos = 0;

  function peek(): string {
    skipSpace();
    return source[pos] ?? "";
  }

  function skipSpace() {
    while (pos < source.length && /\s/.test(source[pos])) pos++;
  }

  function parseExpr(): number {
    let value = parseTerm();
    for (;;) {
      const op = peek();
      if (op === "+" || op === "-") {
        pos++;
        const rhs = parseTerm();
        value = op === "+" ? value + rhs : value - rhs;
      } else {
        break;
      }
    }
    return value;
  }

  function parseTerm(): number {
    let value = parseFactor();
    for (;;) {
      const op = peek();
      if (op === "*" || op === "/") {
        pos++;
        const rhs = parseFactor();
        value = op === "*" ? value * rhs : rhs !== 0 ? value / rhs : 0;
      } else {
        break;
      }
    }
    return value;
  }

  function parseFactor(): number {
    const ch = peek();

    if (ch === "-") {
      pos++;
      return -parseFactor();
    }

    if (ch === "(") {
      pos++;
      const value = parseExpr();
      skipSpace();
      if (source[pos] !== ")") throw new Error("Expected ')'");
      pos++;
      return value;
    }

    skipSpace();
    const match = /^-?\d+(\.\d+)?/.exec(source.slice(pos));
    if (!match) throw new Error(`Unexpected token at position ${pos}`);
    pos += match[0].length;
    return parseFloat(match[0]);
  }

  const result = parseExpr();
  skipSpace();
  if (pos !== source.length) throw new Error("Unexpected trailing input");
  return result;
}

/** Formats a computed number for display / for the WhatsApp message text. */
export function formatFormulaResult(value: number | null, currencyPrefix?: string): string {
  if (value === null || Number.isNaN(value)) return "";
  const rounded = Math.round(value * 100) / 100;
  return `${currencyPrefix ?? ""}${rounded.toLocaleString()}`;
}
