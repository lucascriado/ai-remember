// garante que o .env seja carregado mesmo se este arquivo for usado direto
require("dotenv").config();

const { google } = require("googleapis");

function getOAuthClient() {
  const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    GOOGLE_REFRESH_TOKEN
  } = process.env;

  const missing = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REDIRECT_URI",
    "GOOGLE_REFRESH_TOKEN"
  ].filter((key) => !process.env[key]);

  if (missing.length) {
    throw new Error(
      "Faltam envs do Google OAuth: " + missing.join(", ")
    );
  }

  const oAuth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  oAuth2Client.setCredentials({
    refresh_token: GOOGLE_REFRESH_TOKEN
  });

  return oAuth2Client;
}

async function createCalendarEvent(ev, calendarId = "primary") {
  const auth = getOAuthClient();
  const calendar = google.calendar({ version: "v3", auth });

  const requestBody = {
    summary: ev.title,
    description: ev.notes || "",
    location: ev.location || "",
    start: { dateTime: ev.start, timeZone: ev.timezone },
    end: { dateTime: ev.end, timeZone: ev.timezone }
  };

  const res = await calendar.events.insert({
    calendarId,
    requestBody
  });

  return res.data;
}

module.exports = { createCalendarEvent };
