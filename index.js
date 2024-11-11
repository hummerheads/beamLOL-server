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
    const transactionsCollection = client
      .db("BeamLOL")
      .collection("Transactions");

    // Root route
    app.get("/", (req, res) => {
      res.send("Welcome to the BeamLOL API!");
    });

    // Get all users
    app.get("/allusers", async (req, res) => {
      const result = await allUsersCollection.find().toArray();
      res.send(result);
    });

    app.post("/allusers", async (req, res) => {
      try {
        const { telegram_ID, ton_address } = req.body;
    
        if (!telegram_ID || !ton_address) {
          return res.status(400).send({ message: "Missing telegram_ID or ton_address" });
        }
    
        // Check if the user already exists
        const existingUser = await allUsersCollection.findOne({ telegram_ID });
        if (existingUser) {
          // Update the user's TON address if it's null or different
          if (!existingUser.ton_address || existingUser.ton_address !== ton_address) {
            await allUsersCollection.updateOne(
              { telegram_ID },
              { $set: { ton_address } }
            );
            return res.send({ message: "Wallet address updated successfully" });
          }
    
          return res.send({ message: "User already exists with the same address" });
        }
    
        // Insert the new user if it doesn't exist
        const newUser = {
          telegram_ID,
          ton_address,
          balance: 0,
          perk: 0,
          level: 1,
          bonus: 0,
          spin: 0,
          available_energy: 0,
          total_energy: 0,
          check_In: 0,
          premium: "no",
        };
    
        const result = await allUsersCollection.insertOne(newUser);
        res.status(201).send(result);
      } catch (error) {
        console.error("Error inserting user:", error);
        res.status(500).send({ message: "Failed to add user" });
      }
    });
    


    // Route to get a user by Telegram ID
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

    // Route to update user's level and perks
    app.post("/allusers/update/:telegram_ID", async (req, res) => {
      const { level, perk, total_energy } = req.body;
      const { telegram_ID } = req.params;

      try {
        const updatedDoc = {
          $set: {
            level,
            perk,
            total_energy,
          },
        };

        const result = await allUsersCollection.updateOne(
          { telegram_ID },
          updatedDoc
        );

        if (result.modifiedCount === 1) {
          res.send({ message: "User updated successfully" });
        } else {
          throw new Error("User not found or data unchanged");
        }
      } catch (error) {
        console.error("Error updating user data:", error);
        res
          .status(500)
          .send({ message: "Failed to update user", error: error.message });
      }
    });

    // Check-in route to update user's balance and spins after payment
    app.post("/checkin", async (req, res) => {
      const { telegram_ID } = req.body;
      try {
        const query = { telegram_ID };
        const update = {
          $inc: { balance: 100000, spin: 100 }, // Increment balance and spins
        };
        const result = await allUsersCollection.updateOne(query, update);
        if (result.modifiedCount > 0) {
          res.send({
            message: "Check-in successful! Balance and spins updated.",
          });
        } else {
          res.status(404).send({ message: "User not found" });
        }
      } catch (error) {
        console.error("Error during check-in:", error);
        res.status(500).send({ message: "Failed to complete check-in" });
      }
    });

    // Get a transaction
    app.get("/transactions/:telegram_ID", async (req, res) => {
      try {
        const { telegram_ID } = req.params;
        const transaction = await transactionsCollection.findOne({
          telegram_ID,
        });
        if (transaction) {
          res.status(200).json(transaction);
        } else {
          res.status(404).json({ message: "Transaction not found" });
        }
      } catch (error) {
        res.status(500).json({ message: error.message });
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
