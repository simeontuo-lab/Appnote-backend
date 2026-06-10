
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const uri = process.env.MONGODB_URI;
const express = require('express');
const crypt = require('crypto');
const app = express();
app.use(express.json());
const port = process.env.PORT || 3000;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// async function run() {
//   try {
//     // Connect the client to the server	(optional starting in v4.7)
//     await client.connect();
//     // Send a ping to confirm a successful connection
//     await client.db("admin").command({ ping: 1 });
//     console.log("Pinged your deployment. You successfully connected to MongoDB!");
//   } finally {
//     // Ensures that the client will close when you finish/error
//     await client.close();
//   }
// }
// run().catch(console.dir);


//

let db
// Connect to the database and store the reference in a variable for use in route handlers
async function connectDB() {
    await client.connect()
    db = client.db(process.env.MONGO_DB_NAME)
    console.log("Connected to MongoDB")
}

// Start the server after connecting to the database
async function startServer() {
    try {
        await connectDB().catch(console.dir)
        app.listen(3000, () => {
            console.log("Server running on port 3000")
        })
    } catch (error) {
        console.log("Failed to connect.", error)
    }
}
// CORS middleware to allow requests from the frontend
app.use((req, res, next) => {
    res.set(`Access-Control-Allow-Origin`, `*`)

    if (req.method === `OPTIONS`) {
        res.set(`Access-Control-Allow-Methods`, `POST,PATCH,DELETE`)
        res.set(`Access-Control-Allow-Headers`, `Content-Type`)
        return res.sendStatus(204)
    }

    next()
})

startServer()

app.get("/", (req, res) => {
    res.send("The server is running 🔊.")
})

app.get("/posts", async (req, res) => {
    const posts = await db.collection("posts").find().toArray()
    res.json(posts)
})

app.get("/newuser", (req, res) => {
    res.sendFile("newuser.html", {root: "../NoteApp-frontend/"})
})

app.post("/users", async (req, res) => {
    const username = req.body.username
    const password = req.body.password

    const salt = crypto.randomBytes(16)

    crypto.pbkdf2(password, salt, 310000, 32, "sha256", async (err, hashedPassword) => {
        if (err) {
            return res.status(500).json({"message": "Failed to hash password."})
        }

        const insertResult = await db.collection("users").insertOne({
            username: username,
            hashed_password: hashedPassword.toString("base64"),
            salt: salt.toString("base64")
        })

        return res.status(201).json({
            _id: insertResult.insertId,
            username: username
        })
    })
})

app.post("/posts", async (req, res) => {
    const newPost = {
        title: req.body.title,
        body: req.body.body,
        timecreated: Date.now()
    }

    const insertResult = await db.collection("posts").insertOne(newPost)

    res.status(201).json({
        _id: insertResult.insertedId,
        title: newPost.title,
        body: newPost.body,
        timecreated: newPost.timecreated
    })
})

app.delete("/posts/:id", async (req, res) => {
    await db.collection("posts").deleteOne({
        _id: new ObjectId(req.params.id)
    })
    res.end()
})

