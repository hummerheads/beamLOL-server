const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion } = require("mongodb");
const bodyParser = require("body-parser");

dotenv.config();
const app = express();

// Middleware
app.use(cors({ origin: "https://astounding-licorice-1ef290.netlify.app" })); // Allow only specific origin
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Content Security Policy
app.use((req, res, next) => {
    res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline' https://vercel.live"
    );
    next();
});

// MongoDB connection URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ebsbi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

async function run() {
    try {
        await client.connect();
        console.log("Connected to MongoDB!");

        const allUsersCollection = client.db("BeamLOL").collection("Users");

        // Root route
        app.get("/", (req, res) => {
            res.send("Welcome to the BeamLOL API!");
        });

        // Get all users
        app.get("/allusers", async (req, res) => {
            const result = await allUsersCollection.find().toArray();
            res.send(result);
        });

        // Add a new user
        app.post("/allusers", async (req, res) => {
            try {
                const { telegram_ID } = req.body;
                const newUser = {
                    telegram_ID,
                    balance: 0,
                    perk: 0,
                    level: 0,
                    bonus: 0,
                    spin: 0,
                };
                const query = { telegram_ID };
                const existingUser = await allUsersCollection.findOne(query);
                if (existingUser) {
                    return res.send({ message: "User already exists", insertedId: null });
                }

                const result = await allUsersCollection.insertOne(newUser);
                res.status(201).send(result);
            } catch (error) {
                console.error("Error inserting user:", error);
                res.status(500).send({ message: "Failed to add user" });
            }
        });

    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
    }
}

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Call the run function to connect to MongoDB
run().catch(console.dir);