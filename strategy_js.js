function calculateADX(candles, adxLength) {
    const dxList = [];

    for (let i = 0; i < candles.length; i++) {
        const plus = candles[i].plus ?? 0;
        const minus = candles[i].minus ?? 0;

        const sum = plus + minus || 1; // הימנעות מחלוקה באפס
        const diff = Math.abs(plus - minus);

        const dx = 100 * (diff / sum);
        dxList.push(dx);
    }

    const adxValues = rma(dxList, adxLength);

    for (let i = 0; i < candles.length; i++) {
        candles[i].adx = adxValues[i];
        candles[i].prev_adx = i > 0 ? adxValues[i - 1] : adxValues[i];
    }

    return candles;
}


function calculateRSI(candles, rsiLength) {
    const gains = Array(candles.length).fill(0);
    const losses = Array(candles.length).fill(0);

    for (let i = 1; i < candles.length; i++) {
        const change = candles[i].close - candles[i - 1].close;
        if (change > 0) {
            gains[i] = change;
        } else {
            losses[i] = -change;
        }
    }

    const avgGains = rma(gains, rsiLength);
    const avgLosses = rma(losses, rsiLength);

    for (let i = 0; i < candles.length; i++) {
        if (i < rsiLength) {
            candles[i].rsi = 1000; // כמו בקוד פייתון - מסמן שאין מספיק מידע
        } else {
            const rs = avgLosses[i] === 0 ? Infinity : avgGains[i] / avgLosses[i];
            candles[i].rsi = 100 - (100 / (1 + rs));
        }
    }

    // prev_rsi
    for (let i = 1; i < candles.length; i++) {
        candles[i].prev_rsi = candles[i - 1].rsi;
    }
    candles[0].prev_rsi = 1000;

    return candles;
}


function rma(values, length) {
    const alpha = 1 / length;
    const rmaArr = [];
    let avg = values[0];
    rmaArr.push(avg);
    for (let i = 1; i < values.length; i++) {
        avg = (1 - alpha) * avg + alpha * values[i];
        rmaArr.push(avg);
    }
    return rmaArr;
}


function calculateDirectionalMovement(candles, diLength) {
    const trList = [];
    const plusDM = [];
    const minusDM = [];

    for (let i = 1; i < candles.length; i++) {
        const current = candles[i];
        const prev = candles[i - 1];

        const upMove = current.high - prev.high;
        const downMove = prev.low - current.low;

        const plus = (upMove > downMove && upMove > 0) ? upMove : 0;
        const minus = (downMove > upMove && downMove > 0) ? downMove : 0;

        const tr = Math.max(
            current.high - current.low,
            Math.abs(current.high - prev.close),
            Math.abs(current.low - prev.close)
        );

        plusDM.push(plus);
        minusDM.push(minus);
        trList.push(tr);
    }

    const trRMA = rma(trList, diLength);
    const plusRMA = rma(plusDM, diLength);
    const minusRMA = rma(minusDM, diLength);

    for (let i = 1; i < candles.length; i++) {
        candles[i].plus_dm = plusDM[i - 1];
        candles[i].minus_dm = minusDM[i - 1];
        candles[i].tr = trList[i - 1];

        const tr = trRMA[i - 1] || 1; // הימנעות מחלוקה באפס

        candles[i].plus = 100 * (plusRMA[i - 1] / tr);
        candles[i].minus = 100 * (minusRMA[i - 1] / tr);

        // ערכים קודמים
        candles[i].prev_plus_dm = candles[i - 1].plus_dm;
        candles[i].prev_minus_dm = candles[i - 1].minus_dm;
        candles[i].prev_plus = candles[i - 1].plus;
        candles[i].prev_minus = candles[i - 1].minus;
    }

    return candles;
}

function decideTrade(candles, config) {
    const {
        threshA, threshB,
        desiredA, desiredB,
        rA, rB,
        destinationFactor
    } = config;

    for (let i = 0; i < candles.length; i++) {
        const c = candles[i];

        c.trade_type = null;
        c.entry_price_short = null;
        c["1/2 desired_in_$"] = null;
        c.destination_in_$ = null;
        c.sl_short = null;
        c.tp_short = null;

        let conditionMet = false;
        let rrr = 0;

        if (c.rsi < threshB || c.adx > threshA) {
            c.trade_type = "short";
            c.entry_price_short = c.close;

            if (c.adx > threshA) {
                c["1/2 desired_in_$"] = 0.5 * c.close * desiredA;
                rrr = rA;
                conditionMet = true;
            }
            if (c.rsi < threshB) {
                c["1/2 desired_in_$"] = 0.5 * c.close * desiredB;
                rrr = rB;
                conditionMet = true;
            }

            if (conditionMet) {
                c.destination_in_$ = 2 * destinationFactor * c["1/2 desired_in_$"];
                c.sl_short = c.entry_price_short + c.destination_in_$;
                c.tp_short = c.entry_price_short - rrr * c.destination_in_$;
            }
        }
    }

    return candles;
}


function processCandles(candles, config) {
    const sorted = candles.slice().sort((a, b) => new Date(a.time) - new Date(b.time));
    const withDM = calculateDirectionalMovement(sorted, config.diLength || 13);
    const withRSI = calculateRSI(withDM, config.rsiLength || 31);
    const withADX = calculateADX(withRSI, config.adxLength || 10);
    const withTrades = decideTrade(withADX, config);

    const last = withTrades[withTrades.length - 1];

    let result = {
        action: last.trade_type != null,
    }
    if (result.action) {
        result.trade_type = last.trade_type
        result.entry_price_short = last.entry_price_short
        result.sl_short = last.sl_short
        result.tp_short = last.tp_shor

    }

    return result;
}


export default processCandles



// const config = {
//     diLength: 13,
//     adxLength: 10,
//     rsiLength: 31,
//     threshA: 65,
//     threshB: 38,
//     desiredA: 0.0016,
//     desiredB: 0.0015,
//     rA: 10,
//     rB: 16,
//     destinationFactor: 0.5
// }

// const result = processCandles(candlesFromAPI, config);
