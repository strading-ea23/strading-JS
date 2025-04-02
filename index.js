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
  leverage: 20
};

async function runStrategyCycle() {
  logT(`🚀 Strategy cycle started at ${formatDate()}`);

  let candles = await bybit.getLatestHourlyKline(401);
  candles.shift(); // הסרת הנר הפעיל
  log("📊 Get 400 latest hourly kline");

  const resultStrategy = processCandles(candles, config);
  if (resultStrategy.action) logT('💥 new signal 💥', resultStrategy)

  saveCandlesToFile(candles, resultStrategy)

  // בדיקת טרייד פתוח
  let openTrade = await bybit.getActivePosition();

  // resultStrategy.sl_short=1830.12345
  // resultStrategy.tp_short=1808.54321
  // resultStrategy.action=1

  // 🔁 יש איתות + טרייד פתוח → עדכון נתונים
  if (resultStrategy.action && openTrade) {

    logT(`📈 Update trade with new signal
         Take Profit: ${resultStrategy.tp_short} | StopLoss:${resultStrategy.sl_short} `);

    let resUpdatePos = await bybit.updatePosition({ takeProfit: resultStrategy.tp_short.toFixed(2), stopLoss: resultStrategy.sl_short.toFixed(2) });
    logT("Updated trade: ", resUpdatePos)
  }



  // 🟢 יש איתות ואין טרייד פתוח → כניסה
  if (resultStrategy.action && !openTrade) {
    logT("🟢 Entering new trade");
    const qty = await bybit.calculateQuantity(config.leverage);
    const orderConfig = {
      side: Side.Sell,
      orderType: OrderType.Limit,
      price: String(resultStrategy.entry_price_short),
      qty, profit: resultStrategy.tp_short,
      stoploss: resultStrategy.sl_short,
      // reduceOnly:true
    }
    await bybit.setLeverage();
    const order = await bybit.placeOrder(orderConfig);
    logT("💹 Order", order)
  }



  // 🔻 אין איתות אבל טרייד פתוח → יציאה
  if (!resultStrategy.action && openTrade) {
    logT("😡 No Signal");
    logT("🛑 Closing open trade");

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
      logT('closeTrade: ', closeTrade)
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
  let a = await bybit.calculateQuantity(20, 100)
  log(a)
}
// go()
