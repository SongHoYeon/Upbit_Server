const responseType = require('./ResponseType.js');

const app = require('express')();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const sign = require('jsonwebtoken').sign
const uuidv4 = require("uuid/v4");
const crypto = require('crypto');
const queryEncode = require("querystring").encode
const request = require('request')
const mongoose = require('mongoose');
const fetch = require('node-fetch');

const server_url = "https://api.upbit.com";

const person = mongoose.Schema({
    nickname: 'string',
    name: 'string',
    phone: 'string',
    id: 'string',
    pw: 'string',
    accessKey: 'string',
    secretKey: 'string',
    point: 'number',
    scalpingList: [{
        marketId: 'string',
        items: [{ buyPrice: 'number', sellPrice: 'number', volume: 'number' }]
    }],
});
const Person = mongoose.model('Person', person);
let scalpingCheckList = [];

io.on('connection', (socket) => {
    console.log("Connection");

    socket.on('regist', function (data) {
        // Parameter format : { id = "string", pw = "string", nickname = "string", phone = "string", name = "string" }
        Person.findOne({ id: data.id }, function (error, person) {
            if (person != null) {
                console.warn("Regist - ID Duplicate!");
                socket.emit(responseType.error_type.id_duplicate);
            } else {
                var newPerson = new Person({ nickname: data.nickname, id: data.id, pw: data.pw, phone: data.phone, name: data.name });
                newPerson.point = 0;
                newPerson.save(function (error, data) {
                    if (error) {
                        console.log(error);
                    } else {
                        console.warn("Regist - Complete!");
                        socket.emit(responseType.complete_type.regist_complete)
                    }
                });
            }
        });
    })

    socket.on('login', function (data) {
        // Parameter format : { id = "string", pw = "string" }
        Person.findOne({ id: data.id }, function (error, person) {
            console.log(person);
            if (person != null) {
                if (person.pw === data.pw) {
                    console.warn("Login - Login Complete!");
                    socket.emit(responseType.complete_type.login_complete);
                } else {
                    console.warn("Login - PW Incorrect!");
                    socket.emit(responseType.error_type.pw_incorrect);
                }
            } else {
                console.warn("Login - ID Incorrect!");
                socket.emit(responseType.error_type.id_incorrect);
            }
        });
    })

    socket.on('updateUpbitKey', function (data) {
        // Parameter format : { id = "string", accessKey = "string", secretKey = "string" }
        Person.findOne({ id: data.id }, function (error, person) {
            if (person != null) {
                person.accessKey = data.accessKey;
                person.secretKey = data.secretKey;

                person.save(function (error, modified_person) {
                    if (error) {
                        console.log(error);
                    } else {
                        console.warn("UpdateUpbitKey - Complete!");
                        socket.emit(responseType.complete_type.updateUpbitKey_complete)
                    }
                });
            }
        });
    })

    socket.on('getPoint', function (data) {
        // Parameter format : { id = "string"}
        Person.findOne({ id: data.id }, function (error, person) {
            if (person != null) {
                socket.emit(responseType.complete_type.getPoint_complete, { point: person.id + " Point : " + person.point });
            } else {
                socket.emit(responseType.error_type.user_notfound)
            }
        });
    })

    socket.on('setPoint', function (data) {
        // Parameter format : { id = "string", point = "number"}
        Person.findOne({ id: data.id }, function (error, person) {
            if (person != null) {
                person.point = data.point;
                person.save(function (error, modified_person) {
                    if (error) {
                        console.log(error);
                    } else {
                        console.warn("SetPoint - Complete!");
                        socket.emit(responseType.complete_type.setPoint_complete)
                    }
                });
            }
        });
    })

    socket.on('getAllPoint', function (data) {
        Person.find({}, function (error, persons) {
            let data = []
            persons.map(person => {
                data.push({ id: person.id, point: person.point })
            })
            socket.emit(responseType.complete_type.getAllPoint_complete, data)
        });
    })

    setInterval(() => {
        // console.log("------------");
        scalpingCheckList.map(userInfo => {
            userInfo.scalpingList.map(slist => {
                const url = server_url + '/v1/ticker?markets=KRW-' + slist.marketId;
                const options = { method: 'GET', headers: { Accept: 'application/json' } };

                fetch(url, options)
                    .then(res => res.json())
                    .then(json => {
                        // 현재 값 받아오기
                        // console.log(slist.marketId + " " + json[0].trade_price)
                        // 현재 값보다 같거나 작은 한 쌍을 매수
                        let filtedList = slist.items.filter(sitem => sitem.buyPrice <= json[0].trade_price);
                        if (filtedList.length > 0) {
                            if ((!filtedList[filtedList.length - 1].hasOwnProperty('buyWait') || filtedList[filtedList.length - 1].buyWait === false)) {
                                exchangeCoin(userInfo, slist.marketId, filtedList[filtedList.length - 1], true);
                            }
                        }
                        // slist.items.reverse().some(sitem => {
                        //     if (sitem.buyPrice <= json[0].trade_price) {
                        //         // buyWait 속성이 없거나 buyWait가 false 라면 매수
                        //         if (!sitem.hasOwnProperty('buyWait') || !sitem.buyWait)
                        //             exchangeCoin(userInfo, slist.marketId, sitem.volumn, sitem.buyPrice, sitem, true);
                        //         return true;
                        //     }
                        // })
                        // slist.items.reverse();

                        // 매수 리스트 체크 (전체 쌍 중 buyWait 가 true 인 쌍)
                        let checkBuyUUIDList = [];
                        let checkBuyItemList = [];
                        slist.items.map(sitem => {
                            if (sitem.buyWait && sitem.buyUUID != '') {
                                checkBuyUUIDList.push(sitem.buyUUID);
                                checkBuyItemList.push(sitem);
                            }
                        })
                        if (checkBuyUUIDList.length > 0)
                            checkExchange(userInfo, slist.marketId, checkBuyUUIDList, checkBuyItemList, true);

                        // 매도 리스트 체크 (전체 쌍 중 sellWait 가 true 인 쌍)
                        let checkSellUUIDList = [];
                        let checkSellItemList = [];
                        slist.items.map(sitem => {
                            if (sitem.sellWait && sitem.sellUUID != '') {
                                checkSellUUIDList.push(sitem.sellUUID);
                                checkSellItemList.push(sitem);
                            }
                        })
                        if (checkSellUUIDList.length > 0)
                            checkExchange(userInfo, slist.marketId, checkSellUUIDList, checkSellItemList, false);

                    })
                    .catch(err => {
                        // console.error('error:' + err);
                    })
            })
        })
    }, 3000);

    socket.on('setScalping', function (data) {
        // Parameter format : { id = "string", scalpingList = [ { marketId = "string", items = [ { buyPrice = "number" , sellPrice = "number", volume = "number }, { ... } ] }, {..} ] }
        Person.findOne({ id: data.id }, function (error, person) {
            if (person != null) {
                const existCheck = scalpingCheckList.find(item => item.id === data.id);
                if (existCheck) {
                    existCheck.scalpingList = data.scalpingList;
                } else {
                    scalpingCheckList.push({
                        id: person.id,
                        accessKey: person.accessKey,
                        secretKey: person.secretKey,
                        scalpingList: data.scalpingList
                    });
                }
                person.scalpingList = data.scalpingList;
                person.save(function (error, modified_person) {
                });
            } else {
                console.log("Not found User Info");
            }
        });
    })

    const exchangeCoin = (user, marketId, sitem, isBuy) => {
        let body = {
            market: 'KRW-' + marketId,
            volume: sitem.volume,
            ord_type: 'limit',
        }
        if (isBuy) {
            body.side = 'bid';
            body.price = sitem.buyPrice;
            sitem.buyWait = true;
        } else {
            body.side = 'ask';
            body.price = sitem.sellPrice;
            sitem.sellWait = true;
        }
        const query = queryEncode(body)

        const hash = crypto.createHash('sha512')
        const queryHash = hash.update(query, 'utf-8').digest('hex')

        const payload = {
            access_key: user.accessKey,
            nonce: uuidv4(),
            query_hash: queryHash,
            query_hash_alg: 'SHA512',
        }

        const token = sign(payload, user.secretKey)

        const options = {
            method: "POST",
            url: server_url + "/v1/orders",
            headers: { Authorization: `Bearer ${token}` },
            json: body
        }
        // if (!sitem.hasOwnProperty('buyUUID') || sitem.buyUUID === '')
        request(options, (error, response, body) => {
            if (error) {
                console.log("sItem : " + sitem);
                console.log("ErrorMessage : " + error.message);
                console.log("options : " + JSON.stringify(options))
                exchangeCoin(user, marketId, sitem, isBuy);
                // throw new Error(error)
            } else {
                if (isBuy) {
                    if (!body.error) {
                        Person.findOne({ id: user.id }, function (error, person) {
                            if (person != null) {
                                const needPoint = (sitem.sellPrice * sitem.volume - sitem.buyPrice * sitem.volume);
                                if (person.point >= needPoint) {
                                    person.point -= needPoint;
                                    person.save(function (error, modified_person) { });
                                    sitem.sellWait = false;
                                    sitem.buyUUID = body.uuid;
                                    sitem.sellUUID = '';
                                    console.log(marketId + " " + sitem.buyPrice + " buyWait");
                                }
                            }
                        })
                    }
                } else {
                    sitem.buyUUID = '';
                    sitem.sellUUID = body.uuid;
                    console.log(marketId + " " + sitem.sellPrice + " sellWait");
                }
            }
        })
    }

    const checkExchange = (user, marketId, uuidList, itemList, isBuy) => {
        const state = 'done'
        const uuids = uuidList;
        const non_array_body = {
            state: state,
        }
        const array_body = {
            uuids: uuids,
        }
        const body = {
            ...non_array_body,
            ...array_body
        }
        const uuid_query = uuids.map(uuid => `uuids[]=${uuid}`).join('&')
        const query = queryEncode(non_array_body) + '&' + uuid_query

        const hash = crypto.createHash('sha512')
        const queryHash = hash.update(query, 'utf-8').digest('hex')

        const payload = {
            access_key: user.accessKey,
            nonce: uuidv4(),
            query_hash: queryHash,
            query_hash_alg: 'SHA512',
        }

        const token = sign(payload, user.secretKey)

        const options = {
            method: "GET",
            url: server_url + "/v1/orders?" + query,
            headers: { Authorization: `Bearer ${token}` },
            json: body
        }

        request(options, (error, response, body) => {
            if (error) {
                // throw new Error(error)
                console.log(error + " " + body);
            } else {
                if (body.length > 0) {
                    if (isBuy) {
                        body.map(bitem => {
                            const buiedItem = itemList.find(sitem => sitem.buyUUID === bitem.uuid);
                            if (buiedItem != null) {
                                buiedItem.buyUUID = '';
                                console.log(marketId + " " + buiedItem.buyPrice + " Buyed!");
    
                                exchangeCoin(user, marketId, buiedItem, false);
                            }
                        })
                    } else {
                        body.map(bitem => {
                            const selledItem = itemList.find(sitem => sitem.sellUUID === bitem.uuid);
                            if (selledItem != null) {
                                selledItem.buyWait = false;
                                selledItem.sellWait = false;
                                selledItem.buyUUID = '';
                                selledItem.sellUUID = '';
                                console.log(marketId + " " + selledItem.sellPrice + " Selled!");
                            }
                        })
                    }
                }
            }
        })
    }

    socket.on('test_sell', function (data) {
        let body = {
            market: 'KRW-XRP',
            volume: 30,
            price: 1000,
            ord_type: 'limit',
            side: 'bid'
        }

        const query = queryEncode(body)

        const hash = crypto.createHash('sha512')
        const queryHash = hash.update(query, 'utf-8').digest('hex')

        const payload = {
            access_key: data.accessKey,
            nonce: uuidv4(),
            query_hash: queryHash,
            query_hash_alg: 'SHA512',
        }

        const token = sign(payload, data.secretKey)

        const options = {
            method: "POST",
            url: server_url + "/v1/orders",
            headers: { Authorization: `Bearer ${token}` },
            json: body
        }
        request(options, (error, response, body) => {
            if (error) throw new Error(error)
            if (body.error) {
                console.log(body)
            } else {
                console.log("success");
            }
            // if (isBuy) {
            //     sitem.buyWait = true;
            //     sitem.sellWait = false;
            //     sitem.buyUUID = body.uuid;
            //     sitem.sellUUID = '';
            //     console.log(marketId + " " + price + " buyWait");
            // } else {
            //     sitem.sellWait = true;
            //     sitem.buyUUID = '';
            //     sitem.sellUUID = body.uuid;
            //     console.log(marketId + " " + price + " sellWait");
            // }
        })
    })
})

server.listen(8080, function () {
    console.log('Socket IO server listening on port 8080');
});
mongoose.connect('mongodb://localhost:27017/test', { useNewUrlParser: true });

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error'));
db.once('open', function callback() {
    console.log("mongo db is connected");

    // DB에서 이미 등록되어있는 스켈핑 리스트 가져오기
    Person.find({}, function (error, persons) {
        persons.map(person => {
            if (person.scalpingList.length > 0) {
                scalpingCheckList.push({
                    id: person.id,
                    accessKey: person.accessKey,
                    secretKey: person.secretKey,
                    scalpingList: person.scalpingList
                });
            }
        })
    });
});


