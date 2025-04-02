import { log } from 'console';
import TelegramBot from 'node-telegram-bot-api';
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN)//;, {polling: true});
const chatId = process.env.TELEGRAM_CHAT_ID

async function sendMessage(...args) {
    let message = "";

    for (const part of args) {
        message += await objectToText(part);
    }

    bot.sendMessage(chatId, message, { parse_mode: "HTML" });
}

async function objectToText(obj) {
    if (typeof obj === 'string') return obj;
    if (obj === null || obj === undefined) return '';

    // נסה להמיר לאובייקט אם זה לא מחרוזת ולא ניתן לעיבוד
    if (typeof obj !== 'object') return String(obj);

    let text = "";
    for (const key in obj) {
        if (Object.hasOwn(obj, key) && obj[key] != null) {
            text += key.startsWith('$') ? '' : `${key}: `;
            text += `${obj[key]}\n`;
        }
    }
    return text;
}

async function logT(data) {
    sendMessage(data)
    log(data)
}

export default { sendMessage, logT }