const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const fs = require('fs');
const uri = process.env.MONGODB_URI;
const express = require('express');
const path = require("path")
const pwd = require("passwordjs")
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "../NoteApp-frontend")))
const port = process.env.PORT || 3000;

// Logging utility
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.error(logMessage); // Also log to console
    fs.appendFileSync(path.join(__dirname, 'debug.log'), logMessage);
}

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
    try {
        const username = req.query.username
        log(`🔍 GET /posts called - Query: ${JSON.stringify(req.query)}, username="${username}"`)
        
        if (!username) {
            log("❌ No username provided!")
            return res.status(400).json({ message: "Username query parameter is required." })
        }
        
        // Debug: Get all posts to see what's in database
        const allPosts = await db.collection("posts").find({}).toArray()
        log(`📊 Total posts in database: ${allPosts.length}`)
        allPosts.forEach((post) => {
            log(`   Post: title="${post.title}", username="${post.username || 'UNDEFINED'}"`)
        })
        
        const posts = await db.collection("posts").find({ username }).toArray()
        log(`✅ Returning ${posts.length} posts for user "${username}"`)
        res.json(posts)
    } catch (error) {
        log(`❌ Get posts error: ${error.message}`)
        res.status(500).json({ message: "Server error", error: error.message })
    }
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
        log(`📝 POST /posts called with body: ${JSON.stringify(req.body)}`)
        
        const title = req.body.title
        const body = req.body.body
        const username = req.body.username
        
        log(`  title="${title}", body="${body}", username="${username}"`)

        if (!title || !body) {
            log(`  ❌ Missing title or body`)
            return res.status(400).json({ message: "Title and body are required." })
        }

        if (!username) {
            log(`  ❌ Missing username!`)
            return res.status(400).json({ message: "Username is required." })
        }

        const newPost = {
            title,
            body,
            username,
            timecreated: Date.now()
        }

        const insertResult = await db.collection("posts").insertOne(newPost)
        log(`  ✅ Post created successfully with id: ${insertResult.insertedId}`)

        res.status(201).json({
            _id: insertResult.insertedId,
            title: newPost.title,
            body: newPost.body,
            username: newPost.username,
            timecreated: newPost.timecreated
        })
    } catch (error) {
        log(`  ❌ Posts error: ${error.message}`)
        console.error("Posts error:", error)
        res.status(500).json({ message: "Server error", error: error.message })
    }
})

app.delete("/posts/:id", async (req, res) => {
    try {
        const postId = req.params.id
        const username = req.query.username
        
        if (!postId) {
            return res.status(400).json({ message: "Post ID is required." })
        }

        if (!username) {
            return res.status(400).json({ message: "Username query parameter is required." })
        }

        const result = await db.collection("posts").deleteOne({
            _id: new ObjectId(postId),
            username: username
        })

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "Post not found or not authorized." })
        }

        res.status(204).end()
    } catch (error) {
        console.error("Delete post error:", error)
        res.status(500).json({ message: "Server error", error: error.message })
    }
})

startServer()

