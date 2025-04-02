import 'dotenv/config';

import bybit from './bybit.js'
import telegram from './telegram.js'
const { logT } = telegram
import { log } from 'console';
import processCandles from './strategy_js.js'
import { Side, OrderType, saveCandlesToFile, formatDate } from './utility.js';


function runOnNextHour(callback) {
  const now = new Date();
  const msUntilNextHour = (60 - now.getMinutes()) * 60 * 1000 - now.getSeconds() * 1000 - now.getMilliseconds();

  log(`⌛ First run in ${(msUntilNextHour / 1000 / 60).toFixed(2)} minutes`);

  setTimeout(() => {
    callback(); // run first time
    setInterval(callback, 60 * 60 * 1000); // repeat every hour
  }, msUntilNextHour);
}

const config = {
  diLength: 13,
  rsiLength: 31,
  adxLength: 10,
  threshA: 65,
  threshB: 38,
  desiredA: 0.0016,
  desiredB: 0.0015,
  rA: 10,
  rB: 16,
  destinationFactor: 0.5,
  leverage: 19
};

async function runStrategyCycle() {
  logT(`🚀 Strategy cycle started at ${formatDate()}`);

  let candles = await bybit.getLatestHourlyKline(401);
  candles.shift(); // הסרת הנר הפעיל
  log("📊 Get 400 latest hourly kline");
  
  const resultStrategy = processCandles(candles, config);

  // const resultStrategy = {
  //   "action": true,
  //   "trade_type": "short",
  //   "entry_price_short": 1825.65,
  //   "sl_short": 1855.0282375000002,
  //   "tp_short": 1815.5982000000001
  // }

  saveCandlesToFile(candles, resultStrategy)
  
  if (resultStrategy.action) logT('💥 <b><u>New Signal</u></b> 💥', resultStrategy)


  // בדיקת טרייד פתוח
  let openTrade = await bybit.getActivePosition();

  // resultStrategy.sl_short=1830.12345
  // resultStrategy.tp_short=1808.54321
  // resultStrategy.action=1

  // 🔁 יש איתות + טרייד פתוח → עדכון נתונים
  if (resultStrategy.action && openTrade) {

    logT(`📈 <b>Update trade with new signal</b>
         Take Profit: ${resultStrategy.tp_short} | StopLoss:${resultStrategy.sl_short} `);

    let resUpdatePos = await bybit.updatePosition({ takeProfit: resultStrategy.tp_short.toFixed(2), stopLoss: resultStrategy.sl_short.toFixed(2) });
    logT(`Updated Order : ${titleRes(resUpdatePos)}`)
  }



  // 🟢 יש איתות ואין טרייד פתוח → כניסה
  if (resultStrategy.action && !openTrade) {
    logT("💹 <b>Entering new trade</b>");
    const qty = await bybit.calculateQuantity(config.leverage);

    const orderConfig = {
      side: Side.Sell,
      orderType: OrderType.Limit,
      price: String(resultStrategy.entry_price_short),
      qty,
      takeProfit: resultStrategy.tp_short,
      stopLoss: resultStrategy.sl_short,
      // reduceOnly:true
    }
    await bybit.setLeverage();
    const order = await bybit.placeOrder(orderConfig);
    logT(`Place Order : ${titleRes(order)}`)
  }



  // 🔻 אין איתות אבל טרייד פתוח → יציאה
  if (!resultStrategy.action && openTrade) {
    logT("😡 No Signal");
    logT("🛑 <b>Closing open trade</b>");

    // בדיקת טרייד פתוח
    let openTrade = await bybit.getActivePosition();
    while (openTrade) {
      const orderConfig = {
        side: Side.Buy,
        orderType: OrderType.Market,
        qty: openTrade.size,
        reduceOnly: true
      }
      const closeTrade = await bybit.placeOrder(orderConfig);
      logT(`Close Order : ${titleRes(closeTrade)}`)
      openTrade = await bybit.getActivePosition();
    }
  }



  // 😴 אין איתות ואין טרייד פתוח → דילוג
  if (!resultStrategy.action && !openTrade) {
    logT("😴 No signal and no trade. Waiting...");
  }
}
runOnNextHour(runStrategyCycle);
runStrategyCycle()



const go = async () => {
}
// go()

const titleRes = (res)=>`${res.retCode == 0 ? '🟢' : '🔴\nError: ' + res.retMsg}`