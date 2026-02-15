// api/openai.js (agora usando chrono-node, sem OpenAI)
const chrono = require("chrono-node");

function toIsoWithTZ(date, tz = "-03:00") {
  const yyyy = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const HH = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${MM}-${dd}T${HH}:${mm}:00${tz}`;
}

function cleanTitle(original, matchedText) {
  let t = original;

  if (matchedText) {
    // remove o trecho que o chrono reconheceu como data/hora
    t = t.replace(matchedText, " ");
  }

  // limpa palavras comuns
  t = t
    .replace(/\b(hoje|amanhã|amanha)\b/gi, " ")
    .replace(/\b(as|às|a|às)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return t || "Lembrete";
}

/**
 * Entrada: "hoje as 18hrs academia"
 * Saída: { title, start, end, timezone, location, notes }
 */
async function parseEventFromText(userText, opts = {}) {
  const timezone = opts.timezone || "America/Sao_Paulo";
  const tzOffset = opts.tzOffset || "-03:00"; // simples e suficiente pro BR

  // tenta PT primeiro; se falhar, tenta parser padrão
  const results =
    chrono.pt.parse(userText, new Date(), { forwardDate: true }) ||
    chrono.parse(userText, new Date(), { forwardDate: true });

  if (!results || results.length === 0) {
    throw new Error(
      "Não entendi a data/hora. Ex: 'brme hoje 18h academia' ou 'brme amanhã 14:30 reunião'"
    );
  }

  const r = results[0];
  const startDate = r.start?.date();
  if (!startDate) throw new Error("Não consegui obter data/hora inicial.");

  // se o texto tiver range tipo "18h-19h", o chrono pode trazer end
  const endDate = r.end?.date() || new Date(startDate.getTime() + 60 * 60 * 1000);

  const title = cleanTitle(userText, r.text);

  return {
    title,
    start: toIsoWithTZ(startDate, tzOffset),
    end: toIsoWithTZ(endDate, tzOffset),
    timezone,
    location: "",
    notes: ""
  };
}

module.exports = { parseEventFromText };
