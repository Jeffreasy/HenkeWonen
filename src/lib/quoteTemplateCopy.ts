const quoteTemplateTextReplacements: Array<[RegExp, string]> = [
  [/\btbv pvc\b/gi, "t.b.v. PVC"],
  [/\bpvc\b/gi, "PVC"],
  [/\bm2\b/g, "m²"],
  [/\bPlisses\b/g, "Plissés"],
  [/\bplisses\b/g, "plissés"],
  [/\bplisse\b/g, "plissé"],
  [/\bJaloezieen\b/g, "jaloezieën"],
  [/\bjaloezieen\b/g, "jaloezieën"],
  [/Houten\/Bamboe/g, "Houten/bamboe"],
  [/EUR 10\.000/g, "€10.000"],
  [/EUR 3000/g, "€3.000"],
  [/\bPIN betaling\b/g, "pinbetaling"],
  [/\bPIN\b/g, "pin"]
];

export function polishQuoteTemplateText(value: string): string {
  return quoteTemplateTextReplacements.reduce((text, [pattern, replacement]) => {
    return text.replace(pattern, replacement);
  }, value);
}

export function polishQuoteTemplateLines(lines: string[]): string[] {
  return lines.map(polishQuoteTemplateText);
}
