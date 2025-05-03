// ***** Enums ***** 
export const TradeType = {
    longEntry: "longEntry",
    longClose: "longClose",
    shortEntry: "shortEntry",
    shortClose: "shortClose"
}

export const Side = {
    Buy: "Buy",
    Sell: "Sell"
}

export const Coin = {
    BTCUSDT: "BTCUSDT",
    ETHUSDT: "ETHUSDT",
    ETH: "ETH",
    USDT: "USDT",
    BTC: "BTC"
}

export const OrderType = {
    Limit: 'Limit',
    Market: 'Market'
}

export const Category = {
    Futures: 'linear',
    Spot: 'spot'
}

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const saveCandlesToFile = (candles, strategyResult = null) => {
    if (!candles.length) return;

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    const timestamp = `${day}${month}_${hours}${minutes}`;
    const fileName = `candles_${timestamp}.json`;

    const dataToSave = {
        candles,
        strategy_result: strategyResult
    };

    const dirPath = path.join(__dirname, 'candles');

    // אם התיקייה לא קיימת - צור אותה
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(
        path.join(__dirname, 'candles', fileName),
        JSON.stringify(strategyResult != null ? dataToSave : candles, null, 2)
    );

    console.log(`📄 Candles + strategy result saved to ${fileName}`);
}


export const saveResultToFileTest = (strategyResult, currentTime ) => {
    if (!strategyResult.action) return;

    const timestamp = formatDateToFile(currentTime)
   
    const fileName = `${timestamp}_result.json`;

    const dirPath = path.join(__dirname, 'candles_test4');

    saveToFile(dirPath, fileName, strategyResult)

    console.log(`📄 saved : ${fileName}`);
}

export const saveCandlesToFileTest = (candles, currentTime, isBefore = true) => {
    if (!candles.length) return;

    const timestamp = formatDateToFile(currentTime)
   
    const fileName = `${timestamp}_${isBefore ? 'before' : 'after'}.json`;

    const dirPath = path.join(__dirname, 'candles_test3');

    saveToFile(dirPath, fileName, candles)

    console.log(`📄 saved : ${fileName}`);
}

const saveToFile = (dirPath, fileName, data)=>{

    // אם התיקייה לא קיימת - צור אותה
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(
        path.join(dirPath, fileName),
        JSON.stringify(data, null, 2)
    );
}

const formatDateToFile = (currentTime) => {

    const now = new Date(currentTime);
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    return `${day}${month}_${hours}${minutes}`;
}

export const formatDate = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;

}
// ***** Classes *****

// Bybit: class Bybit {
//     constructor(userId, bybitKey, bybitSecret, arrLongMargin = [], arrShortMargin = [], testnet = true) {
//         this.id = userId
//         this.apiKey = bybitKey
//         this.secret = bybitSecret
//         this.longMargin = arrLongMargin
//         this.shortMargin = arrShortMargin
//         this.testnet = testnet
//     }
// },

// Trade: class Trade {
//     constructor(strategy, orderType, trade, alertId, orderPrice) {
//         this.strategy = strategy
//         this.orderType = orderType
//         this.trade = trade
//         this.alertId = alertId
//         this.orderPrice = orderPrice
//     }
// },

// // ***** Functions ****
// fix: (letter, len) => {
//     if (!letter.includes(".")) return letter;
//     let s = letter.split(".");
//     return `${s[0]}.${s[1].slice(0, len)}`;
// },

//     logger: (text, data, format = 1) => {
//         switch (format) {
//             case 1:
//                 text = `⭑⭑⭑★✪ ${text} ✪★⭑⭑⭑`
//                 break
//             case 2:
//                 text = `▂▃▅▇█▓▒░ ${text} ░▒▓█▇▅▃▂`
//                 break
//             case 3:
//                 text = `▁ ▂ ▃ ▅ ▆ ▇ █ ${text} █ ▇ ▆ ▅ ▃ ▂ ▁`
//                 break
//         }
//         if (data) {
//             console.log(text);
//             if (Array.isArray(data)) {
//                 data.forEach(d => console.log(d))
//             }
//             else {
//                 console.log(data)
//             }
//             return;
//         }
//         console.log(text);
//     },
//         log: (content) => console.log(content),

//             msgStart: (strategy) => {
//                 return `
//         ###########################################################
//         ###                                                     ###
//         ### 【 ＴｒａｄｉｎｇＶｉｅｗ : Ｐｒｏｄｕｃｔｉｏｎ 】 ###
//         ###                    ${strategy}                      ###
//         ###########################################################`
//             }
// }
