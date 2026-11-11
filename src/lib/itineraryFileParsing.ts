import ExcelJS from "exceljs";

// Un valore di cella Excel può essere un numero/testo semplice, una data, o
// un oggetto più complesso (formula con risultato, testo con stili misti,
// link): qui lo riduciamo sempre a una stringa semplice, l'unica cosa che
// serve per farlo leggere all'AI.
function cellToText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if (Array.isArray(v.richText)) return v.richText.map((part) => part.text).join("");
    if (v.result != null) return String(v.result);
    if (v.text != null) return String(v.text);
    return "";
  }
  return String(value);
}

// Converte un file Excel (.xlsx) in testo semplice, foglio per foglio, riga
// per riga. Nessun tentativo di capire quali colonne significano cosa:
// lasciamo che sia l'AI a interpretare la tabella, dato il testo del file
// così com'è, invece di scrivere un parser rigido per ogni possibile modo
// di organizzare i dati (ogni agenzia tiene l'Excel a modo suo).
export async function parseExcelToText(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const parts: string[] = [];
  workbook.eachSheet((worksheet) => {
    parts.push(`Foglio: ${worksheet.name}`);
    worksheet.eachRow((row) => {
      const cells = (row.values as ExcelJS.CellValue[]).slice(1);
      const line = cells.map(cellToText).join(" | ");
      if (line.trim()) parts.push(line);
    });
    parts.push("");
  });

  return parts.join("\n").trim();
}
