import { RestClientV5 } from 'bybit-api';

const client = new RestClientV5({
    key: process.env.BYBIT_KEY, //'HXZV3KJsIauTgoQiDl',
    secret:  process.env.BYBIT_SECRET, // '6aExyakO8AEjI3Qmc6YF9eXxo6VtYUs8bf00',
    testnet: false,
    demoTrading: true,
});

import { Side, Coin, OrderType, Category } from './utility.js';

// ****** Bybit Functions Services **********

async function setLeverage() {
    try {

        const leverageResult = await client.setLeverage({
            category: 'linear',
            symbol: 'ETHUSDT',
            buyLeverage: "20",
            sellLeverage: "20",
        });
        console.log('Leverage set:', leverageResult);
    } catch (error) {
        console.error('Error setting leverage:', error);
    }
}


async function getLatestPrice() {
    try {
        const response = await client.getTickers({
            category: Category.Futures,
            symbol: Coin.ETHUSDT,
        });

        const ticker = response.result.list[0];
        const lastPrice = parseFloat(ticker.lastPrice);
        console.log('Latest Price:', lastPrice);
        return lastPrice;
    } catch (error) {
        console.error('getLatestPrice-ERROR:', error);
    }
}

async function getAssets() {
    try {
        const wallet = await client.getWalletBalance({
            accountType:"UNIFIED",
            coin:Coin.USDT
        });

        let usdtBalance = wallet.result.list[0]?.coin[0]?.equity;
        usdtBalance = parseFloat(usdtBalance);
        console.log('Assets USDT:', usdtBalance);
        return usdtBalance;
    } catch (error) {
        console.error('usdtBalance-ERROR:', error);
    }
}

async function calculateQuantity(leverage,percent=100 ) {
    let usdt = await getAssets()

    const price = await getLatestPrice();
    const positionValue = (usdt * (percent/100)) * leverage;
    let qty = positionValue / price;
    qty *= 0.995
    console.log('calculateQuantity:', qty.toFixed(2));
    return qty.toFixed(2);
}

async function placeOrder({ side, orderType, price, qty, takeProfit, stopLoss, reduceOnly } = {}) {
    // const orderLinkId = 'unique_order_id_124';
    try {
        const configOrder = {
            category: Category.Futures,
            symbol: Coin.ETHUSDT,
            side,
            orderType,
            qty,
            price,
            timeInForce: 'GTC',
            tpslMode: 'Full',
            reduceOnly
            // orderLinkId
        }
        if(takeProfit) configOrder.takeProfit = String(takeProfit)
        if(stopLoss) configOrder.stopLoss = String(stopLoss)
        
        console.log('config:', configOrder);
        const orderResult = await client.submitOrder(configOrder);
        return orderResult
    } catch (error) {
        console.error('placeOrder:', error);
    }
}

async function updateOrder(orderLinkId, { price, qty, takeProfit, stopLoss }) {
    try {
        const orderResult = await client.amendOrder({
            category: Category.Futures,
            symbol: Coin.ETHUSDT,
            orderLinkId,
            qty,
            price,
            takeProfit,
            stopLoss,
        });
        console.log('updateOrder:', orderResult);
    } catch (error) {
        console.error('updateOrder:', error);
    }
}

async function updatePosition({ takeProfit, stopLoss } = {}) {
    try {
        const orderResult = await client.setTradingStop({
            category: Category.Futures,
            symbol: Coin.ETHUSDT,
            takeProfit,
            stopLoss,
        });
        return orderResult
    } catch (error) {
        console.error('updatePosition:', error);
    }
}

async function getActiveOrders() {

    const orderResult = await client.getActiveOrders({
        category: Category.Futures,
        symbol: Coin.ETHUSDT,
    })
    console.log(orderResult.result.list);
    return orderResult.result.list
}
async function getActivePosition() {

    const orderResult = await client.getPositionInfo({
        category: Category.Futures,
        symbol: Coin.ETHUSDT,
    })
    
    return orderResult.result.list?.find(p=>p.side==Side.Sell)
}




async function getLatestHourlyKline(limit = 1) {
    try {
        const response = await client.getKline({
            category: 'linear',
            symbol: 'ETHUSDT',
            interval: '60',
            limit,
        });

        let result = []
        response.result.list.forEach(kline => {
            result.push({
                time: new Date(Number(kline[0])),
                open: parseFloat(kline[1]),
                high: parseFloat(kline[2]),
                low: parseFloat(kline[3]),
                close: parseFloat(kline[4]),
                volume: parseFloat(kline[5]),
            })
        })
        return result;
    } catch (error) {
        console.error('Error:', error);
    }
}


async function simulationLimit(s = 1) {
    if (s == 1) {

        const assets = 1000, leverage = 20;
        const qty = await calculateQuantity(assets, leverage);
        const price = String(await getLatestPrice());
        const order = await placeOrder({ side: Side.Sell, orderType: OrderType.Limit, price, qty });
        console.log(order);
    }
    else {
        let pos = await getActivePosition();
        let position = pos.find(p => p.side == Side.Sell)
        const price = String(await getLatestPrice()-0.5);
        const order = await placeOrder({ side: Side.Buy, orderType: OrderType.Limit, price, qty: position.size });
        console.log(order);
        // const order = await placeOrder({ side: Side.Sell, orderType: OrderType.Limit, price, qty });
    }


}

// simulationLimit(2)




async function simulation() {
    const assets = 1000, leverage = 20;
    const price = '2750', profit = '2700', stoploss = '2780';
    const qty = await calculateQuantity(assets, leverage);
    const order = await placeOrder({ side: Side.Sell, orderType: OrderType.Limit, price, qty, profit, stoploss });
    console.log(order);


}

import fs from 'fs';

async function executeTrade() {
    console.time("getLatestHourlyKline")
    let candles = await getLatestHourlyKline(401);
    candles.shift()
    console.timeEnd("getLatestHourlyKline")

    fs.writeFile('data60min_400h.json', JSON.stringify(candles), (err) => {
        if (err) {
            console.error('Create json - ERROR :', err);
            return;
        }
        console.log('### Created file: data60min_400h.json ###');
    });

    // let candles = JSON.parse(await fs.promises.readFile('data60min_400h.json', 'utf8'))

    callPython(candles)


    // await setLeverage();
    // await placeOrder();
    // await simulation();
    // await updateOrder('unique_order_id_124',{price:'2725', stopLoss:'2800',takeProfit:'2610'});
    // await updatePosition({takeProfit:'2702',stopLoss:'2799'});
    // await getActiveOrders();
    // let pos = await getActivePosition();
    // let position = pos.find(p=>p.side==Side.Sell)
    // const order = await placeOrder({side:Side.Buy,orderType:OrderType.Market, qty: position.size,reduceOnly:true});
    // console.log(order);
}

// executeTrade();


export default { executeTrade, getLatestHourlyKline,setLeverage, getAssets,
    getActivePosition, updatePosition,calculateQuantity,placeOrder,getLatestPrice}
