const keys = require("./keys")

const express = require("express")
const app = express()

const cors = require("cors")

app.use(cors())
app.use(express.json())

const {Pool} = require("pg")

const pgClient = new Pool({
    user: keys.pgUser,
    host: keys.pgHost,
    database: keys.pgDatabase,
    password: keys.pgPassword,
    port: keys.pgPort
})

pgClient.on("error", (err) => {
    console.log(err)
})

pgClient.query(`
    create table if not exists values(number INTEGER);
`)
.catch(err => {
    console.log(err)
})

const redis = require("redis")

const redisClient = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_stratergy: () => 1000
})

redisClient.on('connect',() => {
    console.log('connected to redis successfully!');
})

const redisPublisher = redisClient.duplicate()

app.use(async(req, res, next) => {
    console.info("\nInterceptorParam-StartRecord------------------------------------------------")
    console.info("InterceptorParam-Access Time   : ", new Date().toLocaleString())
    console.info("InterceptorParam-Access API    : ", getAPIPath(req.originalUrl))
    console.info("InterceptorParam-Req    Body   : ", req.body)
    console.info("InterceptorParam-Req    Params : ", req.params)
    console.info("InterceptorParam-Req    Query  : ", req.query)
    return next()
})

const getAPIPath = (originalUrl) => {
    // has ?
    if (originalUrl.indexOf('?') > 0) {
        return originalUrl.substring(0, originalUrl.indexOf('?'))
    }

    return originalUrl
}

app.get("/", async(req, res) => {
    res.send("Delete Successful")
})

app.get("/values/all", async(req, res) => {
    const values = await pgClient.query('SELECT * FROM values')
    res.send(values.rows)
})

app.get("/values/current", async(req, res) => {
    redisClient.hgetall('values', (err, values) => {
        res.send(values)
    })
})

app.post("/values", async(req, res) => {
    const index = req.body.index

    if(parseInt(index) > 40){
        return res.status(422).send("Index to high")
    }

    redisClient.hset('values', index, "Nothing at all !")
    redisPublisher.publish('insert', index)
    pgClient.query('insert into values(number) values($1)', [index])

    res.send({working: true})
})

app.listen(5000, () => {
    console.log("Server is listening on 5000")
})