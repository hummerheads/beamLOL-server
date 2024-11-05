const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion } = require("mongodb");
const bodyParser = require("body-parser");

require("dotenv").config();
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
// app.use(cors({ origin: "https://astounding-licorice-1ef290.netlify.app" })); // Allow only specific origin
// app.use(bodyParser.json());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// Content Security Policy
// app.use((req, res, next) => {
//   res.setHeader(
//     "Content-Security-Policy",
//     "default-src 'self'; script-src 'self' 'unsafe-inline' https://vercel.live; object-src 'none';"
//   );
//   next();
// });

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
          level: 1,
          bonus: 0,
          spin: 0,
          available_energy: 0,
          total_energy:0

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

    // Get user balance by Telegram ID
    app.get("/allusers/:telegram_ID", async (req, res) => {
      const { telegram_ID } = req.params;
      try {
        const user = await allUsersCollection.findOne({ telegram_ID });
        if (user) {
          res.send({ 
            telegram_ID: telegram_ID, balance: user.balance, perk: user.perk, level: user.level, bonus: user.bonus, spin: user.spin, available_energy: user.available_energy, total_energy: user.total_energy });
        } else {
          res.status(404).send({ message: "User not found" });
        }
      } catch (error) {
        console.error("Error fetching balance:", error);
        res.status(500).send({ message: "Failed to retrieve balance" });
      }
    });

    // Update user's level and perks
// Update user's level and perks
app.post("/allusers/update/:telegram_ID", async (req, res) => {
  const { level, perk, total_energy } = req.body;
  const { telegram_ID } = req.params; // Ensure the ID is being correctly extracted

  console.log("Updating user with ID:", telegram_ID); // Log for debugging
  console.log("Requested updates:", { level, perk, total_energy });

  try {
    const updatedDoc = {
      $set: {
        level,
        perk,
        total_energy
      }
    };

    const result = await allUsersCollection.updateOne({ telegram_ID }, updatedDoc);
    console.log("Update result:", result); // Log the result of the update

    if (result.modifiedCount === 1) {
      res.send({ message: "User updated successfully" });
    } else {
      throw new Error("User not found or data unchanged");
    }
  } catch (error) {
    console.error("Error updating user data:", error);
    res.status(500).send({ message: "Failed to update user", error: error.message });
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
