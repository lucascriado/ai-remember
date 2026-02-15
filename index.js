require("dotenv").config();

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const P = require("pino");
const qrcode = require("qrcode-terminal");

const { parseEventFromText } = require("./api/chrono");
const { createCalendarEvent } = require("./api/google_calendar");

function getTextFromMessage(msg) {
  return (
    msg?.conversation ||
    msg?.extendedTextMessage?.text ||
    msg?.ephemeralMessage?.message?.extendedTextMessage?.text ||
    msg?.viewOnceMessage?.message?.extendedTextMessage?.text ||
    msg?.imageMessage?.caption ||
    msg?.videoMessage?.caption ||
    msg?.documentMessage?.caption ||
    ""
  );
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth");

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" }),
    printQRInTerminal: false,
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) qrcode.generate(qr, { small: true });

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log("conexão fechou, reconectar?", shouldReconnect);
      if (shouldReconnect) start();
    }

    if (connection === "open") console.log("conectado no whatsapp!");
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const m of messages) {
      if (!m.message) continue;
      if (m.key?.remoteJid === "status@broadcast") continue;

      const jid = m.key?.remoteJid;
      const textRaw = getTextFromMessage(m.message).trim();
      if (!textRaw) continue;

      const textLower = textRaw.toLowerCase();

      // opcional: só responder quando VOCÊ mandar
      // if (!m.key?.fromMe) continue;

      // comando precisa COMEÇAR com brme
      if (!textLower.startsWith("brme")) continue;

      // remove "brme" do começo
      const payload = textRaw.slice(4).trim();
      if (!payload) {
        await sock.sendMessage(jid, {
          text: "Me diga o evento. Ex: brme amanhã 14h reunião com João"
        });
        continue;
      }

      // log útil
      console.log(JSON.stringify({
        jid,
        isGroup: (jid || "").endsWith("@g.us"),
        fromMe: !!m.key?.fromMe,
        participant: m.key?.participant || null,
        pushName: m.pushName || null,
        payload
      }, null, 2));

      try {
        // 1) interpretar texto -> evento JSON
        const ev = await parseEventFromText(payload, { timezone: "America/Sao_Paulo" });

        // 2) criar evento no Google Calendar
        const created = await createCalendarEvent(ev, "primary");

        // 3) responder no WhatsApp
        const reply =
          `✅ Evento criado!\n` +
          `📌 ${ev.title}\n` +
          `🕒 ${ev.start} → ${ev.end}\n` +
          (ev.location ? `📍 ${ev.location}\n` : "") +
          (created?.htmlLink ? `🔗 ${created.htmlLink}` : "");

        await sock.sendMessage(jid, { text: reply });

      } catch (err) {
        const msg = err?.message || String(err);
        console.error("❌ erro:", msg);
        await sock.sendMessage(jid, { text: `❌ Não consegui criar o evento: ${msg}` });
      }
    }
  });
}

start().catch(console.error);