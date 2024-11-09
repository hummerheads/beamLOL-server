// Required dependencies
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion } = require("mongodb");

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware setup
app.use(cors());
app.use(express.json());

// MongoDB connection URI and client
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Database connection function
async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB!");

    // MongoDB collection for users
    const allUsersCollection = client.db("BeamLOL").collection("Users");

    // Root route
    app.get("/", (req, res) => {
      res.send("Welcome to the BeamLOL API!");
    });

    // Route to get all users
    app.get("/allusers", async (req, res) => {
      try {
        const result = await allUsersCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching all users:", error);
        res.status(500).send({ message: "Failed to retrieve users" });
      }
    });

    // Route to add or update a user based on wallet address
    app.post("/allusers", async (req, res) => {
      try {
        const { telegram_ID, ton_address } = req.body;
        const query = { telegram_ID, ton_address };

        // Check if the address already exists
        const existingUser = await allUsersCollection.findOne(query);
        if (existingUser) {
          return res.send({ message: "User already exists", insertedId: null });
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
        res.status(500).send({ message: "Failed to update user", error: error.message });
      }
    });

    // Route for user check-in to increment balance
    app.post("/checkin", async (req, res) => {
      const { telegram_ID } = req.body;
      try {
        const query = { telegram_ID };
        const update = { $inc: { balance: 0.2 } };
        const result = await allUsersCollection.updateOne(query, update);
        if (result.modifiedCount > 0) {
          res.send({ message: "Check-in successful!" });
        } else {
          res.status(404).send({ message: "User not found" });
        }
      } catch (error) {
        console.error("Error during check-in:", error);
        res.status(500).send({ message: "Failed to complete check-in" });
      }
    });
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

// Start the Express server and connect to the database
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Call the run function to initiate MongoDB connection
run().catch(console.dir);
