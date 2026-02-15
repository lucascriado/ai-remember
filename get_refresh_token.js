require("dotenv").config();
const { google } = require("googleapis");
const readline = require("readline");

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
} = process.env;

const missing = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"].filter(
  (k) => !process.env[k]
);

if (missing.length) {
  console.error("Faltam envs no .env:", missing.join(", "));
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

const scopes = ["https://www.googleapis.com/auth/calendar"];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: scopes,
});

console.log("\n1) Abra esta URL no navegador:\n");
console.log(authUrl);
console.log("\n2) Faça login, autorize, copie o 'code' e cole aqui.\n");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question("code: ", async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());

    if (!tokens.refresh_token) {
      console.log(
        "\n⚠️ Não veio refresh_token.\n" +
          "Solução:\n" +
          "1) Vá em https://myaccount.google.com/permissions\n" +
          "2) Remova o acesso do app\n" +
          "3) Rode este script de novo\n"
      );
      console.log("Tokens recebidos:", tokens);
      return;
    }

    console.log("\n✅ Cole no seu .env:\n");
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
  } catch (err) {
    console.error("Erro ao trocar code por tokens:", err?.message || err);
  } finally {
    rl.close();
  }
});
