const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const uri = process.env.MONGODB_URI;
const express = require('express');
const path = require("path")
const pwd = require("passwordjs")
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "../NoteApp-frontend")))
const port = process.env.PORT || 3000;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});



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
        res.set(`Access-Control-Allow-Methods`, `GET,POST,PATCH,DELETE`)
        res.set(`Access-Control-Allow-Headers`, `Content-Type`)
        return res.sendStatus(204)
    }

    next()
})

app.get("/", (req, res) => {
    res.send("The server is running 🔊.")
})

app.get("/posts", async (req, res) => {
    const posts = await db.collection("posts").find().toArray()
    res.json(posts)
})
app.post("/signup", async (req, res) => {
    try {
        if (!req.body) {
            return res.status(400).json({ message: "Request body is required. Make sure Content-Type is application/json" })
        }

        const username = req.body.username
        const password = req.body.password

        if (!username || !password) {
            return res.status(400).json({ message: "Username and password are required." })
        }

        const existingUser = await db.collection("users").findOne({ username })
        if (existingUser) {
            return res.status(409).json({ message: "Username already exists." })
        }

        const hashedPassword = await pwd.encrypt(password, "bcrypt")
        const insertResult = await db.collection("users").insertOne({
            username,
            hashed_password: hashedPassword
        })

        return res.status(201).json({
            _id: insertResult.insertedId,
            username
        })
    } catch (error) {
        console.error("Signup error:", error)
        res.status(500).json({ message: "Server error", error: error.message })
    }
})


app.post("/login/password", async (req, res) => {
    try {
        const username = req.body.username
        const password = req.body.password

        if (!username || !password) {
            return res.status(400).json({ message: "Username and password are required." })
        }

        const user = await db.collection("users").findOne({ username: username })

        if (!user) {
            return res.status(401).json({ "message": "Invalid username or password." })
        }

        const isValid = await pwd.compare(password, user.hashed_password, "bcrypt")
        if (!isValid) {
            return res.status(401).json({ message: "Incorrect username or password." })
        }

        return res.json({
            _id: user._id,
            username: user.username
        })
    } catch (error) {
        console.error("Login error:", error)
        res.status(500).json({ message: "Server error", error: error.message })
    }
})
app.post("/posts", async (req, res) => {
    try {
        const title = req.body.title
        const body = req.body.body

        if (!title || !body) {
            return res.status(400).json({ message: "Title and body are required." })
        }

        const newPost = {
            title,
            body,
            timecreated: Date.now()
        }

        const insertResult = await db.collection("posts").insertOne(newPost)

        res.status(201).json({
            _id: insertResult.insertedId,
            title: newPost.title,
            body: newPost.body,
            timecreated: newPost.timecreated
        })
    } catch (error) {
        console.error("Posts error:", error)
        res.status(500).json({ message: "Server error", error: error.message })
    }
})

app.delete("/posts/:id", async (req, res) => {
    try {
        const postId = req.params.id
        if (!postId) {
            return res.status(400).json({ message: "Post ID is required." })
        }

        const result = await db.collection("posts").deleteOne({
            _id: new ObjectId(postId)
        })

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "Post not found." })
        }

        res.status(204).end()
    } catch (error) {
        console.error("Delete post error:", error)
        res.status(500).json({ message: "Server error", error: error.message })
    }
})

startServer()

