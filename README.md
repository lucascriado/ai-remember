# 📅 reminder.me

Bot de lembretes integrado ao WhatsApp que interpreta mensagens em
linguagem natural e cria automaticamente eventos no Google Calendar.

## 🧠 Visão geral

O sistema conecta-se ao WhatsApp via **Baileys**, interpreta comandos
iniciados por `rmd` usando um **modelo de IA local (Ollama)** e cria
eventos diretamente no **Google Calendar**.

Fluxo simplificado:

1.  Usuário envia mensagem no WhatsApp começando com `rmd`
2.  Texto é processado por IA para extrair:
    -   título
    -   data e hora
    -   duração
    -   localização (opcional)
3.  Evento é criado no Google Calendar
4.  Bot responde com confirmação e link do evento

------------------------------------------------------------------------

## ⚙️ Tecnologias utilizadas

### 📱 Integração com WhatsApp

-   **Baileys**\
    Responsável pela conexão com o WhatsApp Web, leitura de mensagens e
    envio de respostas.

### 🤖 Processamento de linguagem natural

-   **Ollama (modelo local de IA)**\
    Interpreta texto livre do usuário e converte em estrutura de evento
    de calendário.\
    Permite funcionamento **sem custo de API externa**.

### 📆 Calendário

-   **Google Calendar API**\
    Criação automática de eventos no calendário principal do usuário,
    retornando link direto do evento.

### 🔐 Autenticação e sessão

-   **Multi-file auth state (Baileys)**\
    Mantém sessão persistente do WhatsApp localmente.

### 🧾 Utilidades

-   **dotenv** → gerenciamento de variáveis de ambiente\
-   **pino** → logging leve\
-   **qrcode-terminal** → exibição do QR code de conexão

------------------------------------------------------------------------

## 💬 Formato de comando

O bot responde apenas a mensagens iniciadas com:

    rmd <descrição do evento>

Exemplo:

    rmd amanhã 14h reunião com João

A IA transforma isso em um evento estruturado no calendário.

------------------------------------------------------------------------

## 📦 Estrutura lógica

-   **index.js**\
    Conexão com WhatsApp, leitura de mensagens e orquestração do fluxo.

-   **api/ollama_ai.js**\
    Responsável por interpretar texto natural e retornar dados do
    evento.

-   **api/google_calendar.js**\
    Criação efetiva do evento no Google Calendar.

------------------------------------------------------------------------

## 🚀 Principais recursos

-   Criação de eventos por **mensagem de WhatsApp**
-   Interpretação de **linguagem natural em português**
-   Uso de **IA local (sem custo por requisição)**
-   Resposta automática com:
    -   título
    -   horário
    -   local
    -   link do Google Calendar
-   Reconexão automática ao WhatsApp
-   Suporte a mensagens de:
    -   texto
    -   mídia com legenda
    -   mensagens efêmeras
