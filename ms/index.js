const express = require('express');
const mongoClient = require('mongodb').MongoClient;
const request = require('request-promise-native');
const app = express();
app.use(express.json());

const mongoUrl = 'mongodb://localhost:27017';
const dbName = 'mei-demo-ms';
const collectionName = 'coin';
const connectionPromise = mongoClient.connect(mongoUrl);
const coinCollection = connectionPromise
    .then(client => client.db(dbName))
    .then(db => db.collection(collectionName))
;

app.get('/coin-ms/coins', (req, res) => {
    coinCollection
        .then(col => col.find({}).toArray())
        .then(list => res.send(list))
        .catch(error => {
            res.status(500);
            res.send(error);
        });
});

app.get('/coin-ms/sync', (req, res) => {
    request({
        url: 'https://api.coinmarketcap.com/v1/ticker/',
        json: true,
    })
        .then(response => response.map(c => ({
            externalId: c.id,
            name: c.name,
            symbol: c.symbol,
            price: c.price_eur || c.price_gbp || c.price_usd,
            percentageChange: c.percent_change_24h,
            last_updated: c.last_updated,
        })))
        .then(coins => Promise.all([
            coins,
            coinCollection,
        ]))
        .then(([ coins, coinCol ]) => (
            Promise.all(coins.map(coin => coinCol.update(
                { externalId: coin.externalId },
                coin,
                { upsert: true }
            )))
        ))
        .then(response => res.send(response))
        .catch(error => {
            res.status(500);
            res.send(error);
        });
});

app.listen(5000, () => console.log('Example app listening on port 5000!'))

process.on('exit', () => connectionPromise.then(client => client.close()));