// Backend: Express.js Server (server.js)
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion } = require("mongodb");

require("dotenv").config();
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

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
    const transactionsCollection = client.db("BeamLOL").collection("Transactions");

    // Root route
    app.get("/", (req, res) => {
      res.send("Welcome to the BeamLOL API!");
    });

    // Get all users
    app.get("/allusers", async (req, res) => {
      const result = await allUsersCollection.find().toArray();
      res.send(result);
    });

    // Get a user by Telegram ID
    app.get("/allusers/:telegram_ID", async (req, res) => {
      const { telegram_ID } = req.params;
      try {
        const user = await allUsersCollection.findOne({ telegram_ID });
        if (user) {
          res.send(user);
        } else {
          res.status(404).send({ message: "User not found" });
        }
      } catch (error) {
        console.error("Error fetching user by telegram_ID:", error);
        res.status(500).send({ message: "Failed to retrieve user" });
      }
    });

    // Unified PATCH route for user updates
    app.patch("/allusers/:telegram_ID", async (req, res) => {
      const { telegram_ID } = req.params;
      const {
        ton_address,
        balanceIncrement,
        spinIncrement,
        checkInIncrement,
        level,
        perk,
        total_energy,
        isCheckIn,
      } = req.body;

      try {
        const query = { telegram_ID };
        const updateFields = {};

        // Update TON address if provided
        if (ton_address) {
          updateFields.ton_address = ton_address;
        }

        // Increment balance, spins, and check-in if provided
        if (balanceIncrement || spinIncrement || checkInIncrement) {
          updateFields.$inc = {};
          if (balanceIncrement) updateFields.$inc.balance = balanceIncrement;
          if (spinIncrement) updateFields.$inc.spin = spinIncrement;
          if (checkInIncrement) updateFields.$inc.check_In = checkInIncrement;
        }

        // Update level, perk, and total energy if provided
        if (level || perk || total_energy) {
          updateFields.$set = {};
          if (level) updateFields.$set.level = level;
          if (perk) updateFields.$set.perk = perk;
          if (total_energy) updateFields.$set.total_energy = total_energy;
        }

        // Update last check-in timestamp if check-in is performed
        if (isCheckIn) {
          updateFields.$set = { ...updateFields.$set, lastCheckIn: new Date().getTime() };
        }

        const result = await allUsersCollection.updateOne(query, updateFields);

        if (result.modifiedCount > 0) {
          res.send({ message: "User data updated successfully." });
        } else {
          res.status(404).send({ message: "User not found or no changes made." });
        }
      } catch (error) {
        console.error("Error updating user data:", error);
        res.status(500).send({ message: "Failed to update user", error: error.message });
      }
    });

    // Post a new transaction
    app.post("/transactions", async (req, res) => {
      try {
        const { telegram_ID, transaction_ID, amount } = req.body;
        const newTransaction = {
          telegram_ID,
          transaction_ID,
          amount,
          createdAt: new Date(),
        };
        const result = await transactionsCollection.insertOne(newTransaction);
        res.status(201).json(result);
      } catch (error) {
        res.status(500).json({ message: error.message });
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
