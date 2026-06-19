require("dotenv").config()
const { MongoClient } = require("mongodb")
const seedData = require(`./seed-data`)

async function addSeedData () {
    const uri = process.env.MONGODB_URI
    const client = new MongoClient(uri)
    await client.connect()
    const db = client.db(process.env.MONGO_DB_NAME)
    const result = await db.collection("posts").insertMany(seedData)
    console.log(`Inserted ${result.insertedCount} posts.`)
    await client.close()
}

addSeedData()


