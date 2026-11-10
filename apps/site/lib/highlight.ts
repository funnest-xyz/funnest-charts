/**
 * A tiny TS/TSX highlighter for the docs (runs at build time, ships no JS).
 * Good enough for short examples: comments, strings, keywords, JSX tags, numbers.
 */
const KEYWORDS = new Set([
  'import', 'from', 'export', 'default', 'function', 'return', 'const', 'let', 'new', 'async', 'await',
  'interface', 'type', 'extends', 'implements', 'class', 'if', 'else', 'for', 'of', 'in', 'true', 'false',
  'null', 'undefined', 'void', 'this', 'readonly', 'private', 'public',
]);

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const TOKEN =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|(<\/?)([A-Za-z][\w.]*)|\b(\d[\d_.]*)\b|\b([A-Za-z_$][\w$]*)\b/g;

export function highlight(code: string): string {
  let out = '';
  let last = 0;
  for (const m of code.matchAll(TOKEN)) {
    out += escape(code.slice(last, m.index));
    last = m.index + m[0].length;
    const [all, comment, str, tagOpen, tagName, num, word] = m;
    if (comment) out += `<span class="tk-c">${escape(comment)}</span>`;
    else if (str) out += `<span class="tk-s">${escape(str)}</span>`;
    else if (tagOpen && tagName) out += `${escape(tagOpen)}<span class="tk-t">${tagName}</span>`;
    else if (num) out += `<span class="tk-n">${num}</span>`;
    else if (word && KEYWORDS.has(word)) out += `<span class="tk-k">${word}</span>`;
    else if (word && /^[A-Z]/.test(word)) out += `<span class="tk-y">${word}</span>`;
    else out += escape(all);
  }
  return out + escape(code.slice(last));
}
