const fs = require('fs');
const path = require('path');

// === Utility Functions ===
function sortByTime(candles) {
    return candles.sort((a, b) => new Date(a.time) - new Date(b.time));
}

function saveProperly(data, fileName) {
    const jsonStr = '[\n' + data.map((record, i) => {
        const comma = i < data.length - 1 ? ',' : '';
        return JSON.stringify(record, null, 4) + comma;
    }).join('\n') + '\n]';
    fs.writeFileSync(fileName, jsonStr);
}

function cleanFix(fileName) {
    const raw = fs.readFileSync(fileName);
    const j = JSON.parse(raw);
    const fixed = j.map(e => ({
        ...e,
        high: parseFloat(e.high) || 0,
        low: parseFloat(e.low) || 0,
        open: parseFloat(e.open) || 0,
        close: parseFloat(e.close) || 0,
        volume: parseFloat(e.volume) || 0
    }));
    saveProperly(fixed, fileName);
}

function calculateTR(high, low, prevClose) {
    return Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
    );
}

function rma(values, length) {
    const alpha = 1 / length;
    let avg = values[0];
    const result = [avg];
    for (let i = 1; i < values.length; i++) {
        avg = (1 - alpha) * avg + alpha * values[i];
        result.push(avg);
    }
    return result;
}

function fixNaN(val) {
    return val != null && !isNaN(val) ? val : 0;
}

// === Indicators ===

function dirmov13(fileName, diLength) {
    const data = sortByTime(JSON.parse(fs.readFileSync(fileName)));

    const trValues = [];
    const plusDM = [];
    const minusDM = [];

    for (let i = 1; i < data.length; i++) {
        const up = data[i].high - data[i - 1].high;
        const down = data[i - 1].low - data[i].low;
        plusDM.push(up > down && up > 0 ? up : 0);
        minusDM.push(down > up && down > 0 ? down : 0);
        trValues.push(calculateTR(data[i].high, data[i].low, data[i - 1].close));
    }

    const truerange = rma(trValues, diLength);
    const plus = rma(plusDM, diLength).map((val, i) => fixNaN(100 * val / truerange[i]));
    const minus = rma(minusDM, diLength).map((val, i) => fixNaN(100 * val / truerange[i]));

    for (let i = 1; i < data.length; i++) {
        data[i]["plus_dm"] = plusDM[i - 1];
        data[i]["minus_dm"] = minusDM[i - 1];
        data[i]["plus"] = plus[i - 1];
        data[i]["minus"] = minus[i - 1];
    }

    for (let i = 2; i < data.length; i++) {
        data[i]["prev_plus_dm"] = data[i - 1]["plus_dm"];
        data[i]["prev_minus_dm"] = data[i - 1]["minus_dm"];
        data[i]["prev_plus"] = data[i - 1]["plus"];
        data[i]["prev_minus"] = data[i - 1]["minus"];
    }

    // Fallback fill
    data[1]["prev_plus_dm"] = data[2]["prev_plus_dm"];
    data[1]["prev_minus_dm"] = data[2]["prev_minus_dm"];
    data[1]["prev_plus"] = data[2]["prev_plus"];
    data[1]["prev_minus"] = data[2]["prev_minus"];
    data[0]["prev_plus_dm"] = data[1]["prev_plus_dm"];
    data[0]["prev_minus_dm"] = data[1]["prev_minus_dm"];
    data[0]["prev_plus"] = data[1]["prev_plus"];
    data[0]["prev_minus"] = data[1]["prev_minus"];

    saveProperly(data, 'data60min_400h_with_dilength13.json');
}

function addRSI(data, period) {
    const gains = Array(data.length).fill(0);
    const losses = Array(data.length).fill(0);

    for (let i = 1; i < data.length; i++) {
        const change = data[i].close - data[i - 1].close;
        if (change > 0) {
            gains[i] = change;
        } else {
            losses[i] = -change;
        }
    }

    for (let i = 0; i < data.length; i++) {
        if (i < period) {
            data[i]["rsi"] = 1000;
        } else {
            const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
            const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
            const rs = avgGain / (avgLoss || 1);
            data[i]["rsi"] = 100 - (100 / (1 + rs));
        }
    }

    for (let i = 1; i < data.length; i++) {
        data[i]["prev_rsi"] = data[i - 1]["rsi"];
    }
    data[0]["prev_rsi"] = 1000;

    return data;
}

function adx(data, diLength, adxLength) {
    for (let i = 1; i < data.length; i++) {
        const sumDM = (data[i].plus || 0) + (data[i].minus || 0);
        const diffDM = Math.abs((data[i].plus || 0) - (data[i].minus || 0));
        const denominator = sumDM !== 0 ? sumDM : 1;
        const adxValue = 100 * rma([diffDM / denominator], adxLength)[0];
        data[i]["adx"] = adxValue;
        if (i > 1) {
            data[i]["prev_adx"] = data[i - 1]["adx"];
        }
    }
    data[0]["adx"] = data[1]["adx"];
    data[1]["prev_adx"] = data[0]["adx"];
    data[0]["prev_adx"] = data[1]["prev_adx"];
    return data;
}

// === Strategy ===

function combinedRSIADX(params) {
    const {
        dataFile,
        desired_a,
        destination_factor,
        r_a,
        length_a,
        thresh_a,
        desired_b,
        r_b,
        length_b,
        thresh_b
    } = params;

    let data = JSON.parse(fs.readFileSync(dataFile));
    data = addRSI(data, length_b);
    data = adx(data, 13, length_a);

    data.forEach(e => {
        e.trade_type = "None";
        e.entry_price_short = "None";
        e["1/2 desired_in_$"] = "None";
        e.destination_in_$ = "None";
        e.sl_short = "None";
        e.tp_short = "None";

        if (e.rsi < thresh_b || e.adx > thresh_a) {
            e.trade_type = "short";
            e.entry_price_short = e.close;
            let rrr = 0;

            if (e.adx > thresh_a) {
                e["1/2 desired_in_$"] = 0.5 * e.close * desired_a;
                rrr = r_a;
            }
            if (e.rsi < thresh_b) {
                e["1/2 desired_in_$"] = 0.5 * e.close * desired_b;
                rrr = r_b;
            }

            e.destination_in_$ = 2 * destination_factor * e["1/2 desired_in_$"];
            e.sl_short = e.entry_price_short + e.destination_in_$;
            e.tp_short = e.entry_price_short - rrr * e.destination_in_$;
        }
    });

    saveProperly(data, 'tmp.json');

    const last = data[data.length - 1];
    const result = {
        action: last.trade_type === "None" ? 0 : 1,
        trade_type: last.trade_type,
        entry_price_short: last.entry_price_short,
        sl_short: last.sl_short,
        tp_short: last.tp_short
    };

    console.log(JSON.stringify(result, null, 4));
}

// === Execution ===

const diLength = 13;

cleanFix('data60min_400h.json');
dirmov13('data60min_400h.json', diLength);

combinedRSIADX({
    dataFile: 'data60min_400h_with_dilength13.json',
    desired_a: 0.0016,
    destination_factor: 0.5,
    r_a: 10,
    length_a: 10,
    thresh_a: 65,
    desired_b: 0.0015,
    r_b: 16,
    length_b: 31,
    thresh_b: 38
});
