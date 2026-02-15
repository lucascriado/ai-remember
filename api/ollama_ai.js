// api/ai_parser.js

/* =========================
   Helpers ISO / validações
========================= */

function toIsoWithTZ(date, tz = "-03:00") {
  const yyyy = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const HH = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${MM}-${dd}T${HH}:${mm}:00${tz}`;
}

function parseIsoOrThrow(s) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`data inválida: ${s}`);
  return d;
}

function safeFixEnd(startIso, endIso, tzOffset) {
  const start = parseIsoOrThrow(startIso);
  let end = parseIsoOrThrow(endIso);

  if (end.getTime() <= start.getTime()) {
    end = new Date(start.getTime() + 60 * 60 * 1000);
    return toIsoWithTZ(end, tzOffset);
  }
  return endIso;
}

/* =========================
   Normalização PT-BR
========================= */

function normalizePtDateTime(text) {
  let t = String(text || "");

  // "17hrs", "17 hr" => "17h"
  t = t.replace(/\b(\d{1,2})\s*hrs?\b/gi, "$1h");
  t = t.replace(/\b(\d{1,2})\s*hr\b/gi, "$1h");

  // "17h30" / "17h 30" => "17:30"
  t = t.replace(/\b(\d{1,2})\s*h\s*(\d{2})\b/gi, "$1:$2");

  // "às 17" / "as 17" => "às 17h"
  t = t.replace(/\b(às|as)\s*(\d{1,2})\b(?!\s*[:h])/gi, "$1 $2h");

  // "17" sozinho no fim e tem pista de data ("hoje", "amanhã", "sexta") => "17h"
  if (/\b(hoje|amanh[aã]|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo|dia)\b/i.test(t)) {
    t = t.replace(/\b(\d{1,2})\b(?!\s*[:h]|\s*\/|\s*-)/g, (m, hh) => {
      const n = Number(hh);
      if (n >= 0 && n <= 23) return `${hh}h`;
      return m;
    });
  }

  return t;
}

/* =========================
   Extração determinística de data
========================= */

// weekday: 0 dom ... 6 sáb
function getWeekdayFromTextPt(text) {
  const t = (text || "").toLowerCase();
  const map = [
    { re: /\b(seg(unda)?)(-?feira)?\b/, day: 1 },
    { re: /\b(ter[cç]a)(-?feira)?\b/, day: 2 },
    { re: /\b(quar(ta)?)(-?feira)?\b/, day: 3 },
    { re: /\b(quin(ta)?)(-?feira)?\b/, day: 4 },
    { re: /\b(sex(ta)?)(-?feira)?\b/, day: 5 },
    { re: /\b(s[aá]b(ad(o|ado))?)(-?feira)?\b/, day: 6 },
    { re: /\b(dom(ingo)?)(-?feira)?\b/, day: 0 },
  ];
  for (const m of map) {
    if (m.re.test(t)) return m.day;
  }
  return null;
}

function hasHoje(text) {
  return /\bhoje\b/i.test(text || "");
}
function hasAmanha(text) {
  return /\bamanh[aã]\b/i.test(text || "");
}

// data explícita: 20/02, 20-02, 20/02/2026, 20-02-26
function getExplicitDMY(text) {
  const t = text || "";
  const m = t.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (!m) return null;
  const dd = Number(m[1]);
  const MM = Number(m[2]);
  let yyyy = m[3] ? Number(m[3]) : null;

  if (yyyy !== null && yyyy < 100) yyyy += 2000; // 26 -> 2026
  if (dd < 1 || dd > 31 || MM < 1 || MM > 12) return null;

  return { dd, MM, yyyy };
}

// hora explícita: "17h", "17:30"
function getExplicitTime(text) {
  const t = (text || "").toLowerCase();
  let m = t.match(/\b(\d{1,2})\s*h\b/);          // 17h
  if (m) return { hh: Number(m[1]), mm: 0 };

  m = t.match(/\b(\d{1,2})\s*:\s*(\d{2})\b/);   // 17:30
  if (m) return { hh: Number(m[1]), mm: Number(m[2]) };

  return null;
}

function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

// escolhe a próxima ocorrência do weekday a partir de baseDate (inclui esta semana)
function nextWeekdayFrom(baseDate, targetDow) {
  const base = new Date(baseDate);
  const baseDow = base.getDay();
  let delta = (targetDow - baseDow + 7) % 7;
  return addDays(base, delta);
}

// aplica override de data mantendo a hora do start original (ou hora explícita do texto)
function applyDeterministicDateOverrides(userText, baseDate, ev, tzOffset) {
  const text = userText || "";
  const normalized = normalizePtDateTime(text);

  const start0 = parseIsoOrThrow(ev.start);
  const end0 = parseIsoOrThrow(ev.end);
  const durationMs = Math.max(60 * 60 * 1000, end0.getTime() - start0.getTime());

  // hora: prioriza a hora explícita do texto; se não tiver, usa a do start vindo da IA
  const explicitTime = getExplicitTime(normalized);
  const hh = explicitTime ? explicitTime.hh : start0.getHours();
  const mm = explicitTime ? explicitTime.mm : start0.getMinutes();

  // 1) data explícita dd/mm(/aaaa) vence tudo
  const explicit = getExplicitDMY(normalized);
  if (explicit) {
    const yyyy = explicit.yyyy ?? baseDate.getFullYear();
    const fixedStart = new Date(yyyy, explicit.MM - 1, explicit.dd, hh, mm, 0, 0);
    const fixedEnd = new Date(fixedStart.getTime() + durationMs);
    ev.start = toIsoWithTZ(fixedStart, tzOffset);
    ev.end = toIsoWithTZ(fixedEnd, tzOffset);
    return ev;
  }

  // 2) hoje / amanhã
  if (hasHoje(normalized) || hasAmanha(normalized)) {
    const target = hasAmanha(normalized) ? addDays(baseDate, 1) : new Date(baseDate);
    const fixedStart = new Date(target.getFullYear(), target.getMonth(), target.getDate(), hh, mm, 0, 0);

    // se for "hoje" mas hora já passou, joga pra amanhã automaticamente (mais útil)
    if (hasHoje(normalized)) {
      const now = new Date(baseDate);
      if (fixedStart.getTime() <= now.getTime()) {
        const tmr = addDays(target, 1);
        fixedStart.setFullYear(tmr.getFullYear(), tmr.getMonth(), tmr.getDate());
      }
    }

    const fixedEnd = new Date(fixedStart.getTime() + durationMs);
    ev.start = toIsoWithTZ(fixedStart, tzOffset);
    ev.end = toIsoWithTZ(fixedEnd, tzOffset);
    return ev;
  }

  // 3) dia da semana ("sexta", "quarta"...)
  const dow = getWeekdayFromTextPt(normalized);
  if (dow !== null) {
    const target = nextWeekdayFrom(baseDate, dow);
    const fixedStart = new Date(target.getFullYear(), target.getMonth(), target.getDate(), hh, mm, 0, 0);

    // se cair no mesmo dia e a hora já passou, joga +7 dias
    const baseDow = new Date(baseDate).getDay();
    if (dow === baseDow && fixedStart.getTime() <= new Date(baseDate).getTime()) {
      const nextWeek = addDays(target, 7);
      fixedStart.setFullYear(nextWeek.getFullYear(), nextWeek.getMonth(), nextWeek.getDate());
    }

    const fixedEnd = new Date(fixedStart.getTime() + durationMs);
    ev.start = toIsoWithTZ(fixedStart, tzOffset);
    ev.end = toIsoWithTZ(fixedEnd, tzOffset);
    return ev;
  }

  // 4) sem pistas -> mantém o que a IA deu
  return ev;
}

/* =========================
   Ollama
========================= */

async function ollamaChat({ model, messages, host }) {
  const url = `${host}/api/chat`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: { temperature: 0.1 }
    })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Ollama erro HTTP ${res.status}: ${txt}`);
  }

  const data = await res.json();
  return data?.message?.content || "";
}

function buildPrompt(userText, baseDateISO, timezone, tzOffset) {
  return [
    {
      role: "system",
      content:
        "Você extrai eventos de calendário em pt-BR. Responda APENAS com JSON válido."
    },
    {
      role: "user",
      content:
        `Extraia um evento de calendário.\n` +
        `Responda SOMENTE com JSON puro.\n` +
        `Campos: title, start, end, timezone, location, notes.\n` +
        `Formato start/end: YYYY-MM-DDTHH:mm:00${tzOffset}\n` +
        `Se não houver duração, use 1 hora.\n` +
        `Use data_base_agora para termos relativos.\n\n` +
        `timezone: ${timezone}\n` +
        `tzOffset: ${tzOffset}\n` +
        `data_base_agora: ${baseDateISO}\n` +
        `Texto: "${userText}"`
    }
  ];
}

/* =========================
   Main
========================= */

async function parseEventFromText(userText, opts = {}) {
  const timezone = opts.timezone || "America/Sao_Paulo";
  const tzOffset = opts.tzOffset || "-03:00";
  const baseDate = opts.baseDate || new Date();

  const host = opts.ollamaHost || "http://localhost:11434";
  const model = opts.model || "llama3.1";

  // normaliza texto (ajuda a IA e ajuda nossos regex)
  const normalizedText = normalizePtDateTime(userText);

  const baseDateISO = toIsoWithTZ(baseDate, tzOffset);
  const messages = buildPrompt(normalizedText, baseDateISO, timezone, tzOffset);
  const raw = await ollamaChat({ model, messages, host });

  let ev;
  try {
    ev = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("ia não retornou json válido.");
    ev = JSON.parse(m[0]);
  }

  const required = ["title", "start", "end", "timezone", "location", "notes"];
  for (const k of required) {
    if (!(k in ev)) throw new Error(`json incompleto (faltou "${k}").`);
  }

  // força timezone controlado por você
  ev.timezone = timezone;

  // valida datas antes de corrigir
  parseIsoOrThrow(ev.start);
  parseIsoOrThrow(ev.end);

  // ✅ correções determinísticas (sexta/hoje/amanhã/data explícita)
  ev = applyDeterministicDateOverrides(normalizedText, baseDate, ev, tzOffset);

  // ✅ garante end > start
  ev.end = safeFixEnd(ev.start, ev.end, tzOffset);

  // sanitiza strings
  ev.title = String(ev.title || "").trim() || "Lembrete";
  ev.location = String(ev.location || "").trim();
  ev.notes = String(ev.notes || "").trim();

  return ev;
}

module.exports = { parseEventFromText };
