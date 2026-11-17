/**
 * Parser de JSON tolerante a entrada incompleta, usado durante o streaming:
 * devolve tudo o que já pode ser lido (strings parciais inclusive) e ignora o
 * que ainda não chegou. Também ignora texto/cercas antes do primeiro "{".
 *
 * Sem imports: pode ser testado diretamente com `node --test`.
 */

type Parsed = { value: unknown; complete: boolean } | undefined;

export function parsePartialJson(input: string): unknown {
  const start = input.indexOf("{");
  if (start < 0) return undefined;
  const s = input;
  let i = start;

  const ws = () => {
    while (i < s.length && /\s/.test(s[i])) i++;
  };

  const parseString = (): { value: string; complete: boolean } => {
    i++; // abre aspas
    let out = "";
    while (i < s.length) {
      const ch = s[i];
      if (ch === '"') {
        i++;
        return { value: out, complete: true };
      }
      if (ch === "\\") {
        if (i + 1 >= s.length) break; // escape incompleto
        const esc = s[i + 1];
        const map: Record<string, string> = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", '"': '"', "\\": "\\", "/": "/" };
        if (esc === "u") {
          const hex = s.slice(i + 2, i + 6);
          if (hex.length < 4) break;
          out += String.fromCharCode(parseInt(hex, 16));
          i += 6;
          continue;
        }
        out += map[esc] ?? esc;
        i += 2;
        continue;
      }
      out += ch;
      i++;
    }
    i = s.length;
    return { value: out, complete: false };
  };

  const parseValue = (): Parsed => {
    ws();
    if (i >= s.length) return undefined;
    const ch = s[i];

    if (ch === "{") {
      i++;
      const obj: Record<string, unknown> = {};
      for (;;) {
        ws();
        if (i >= s.length) return { value: obj, complete: false };
        if (s[i] === "}") {
          i++;
          return { value: obj, complete: true };
        }
        if (s[i] === ",") {
          i++;
          continue;
        }
        if (s[i] !== '"') throw new Error("chave inválida");
        const key = parseString();
        if (!key.complete) return { value: obj, complete: false };
        ws();
        if (i >= s.length) return { value: obj, complete: false };
        if (s[i] !== ":") throw new Error("':' esperado");
        i++;
        const val = parseValue();
        if (val === undefined) return { value: obj, complete: false };
        obj[key.value] = val.value;
        if (!val.complete) return { value: obj, complete: false };
      }
    }

    if (ch === "[") {
      i++;
      const arr: unknown[] = [];
      for (;;) {
        ws();
        if (i >= s.length) return { value: arr, complete: false };
        if (s[i] === "]") {
          i++;
          return { value: arr, complete: true };
        }
        if (s[i] === ",") {
          i++;
          continue;
        }
        const val = parseValue();
        if (val === undefined) return { value: arr, complete: false };
        arr.push(val.value);
        if (!val.complete) return { value: arr, complete: false };
      }
    }

    if (ch === '"') return parseString();

    const num = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(s.slice(i, i + 40));
    if (num) {
      i += num[0].length;
      return { value: Number(num[0]), complete: i < s.length };
    }

    for (const [literal, value] of [["true", true], ["false", false], ["null", null]] as const) {
      if (s.startsWith(literal, i)) {
        i += literal.length;
        return { value, complete: true };
      }
      if (literal.startsWith(s.slice(i))) return undefined; // literal ainda chegando
    }

    throw new Error(`caractere inesperado: ${ch}`);
  };

  try {
    return parseValue()?.value;
  } catch {
    return undefined;
  }
}

