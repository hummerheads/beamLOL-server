const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion } = require("mongodb");

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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

    // Get user by telegram_ID
    app.get("/allusers/:telegram_ID", async (req, res) => {
      const { telegram_ID } = req.params;
      const user = await allUsersCollection.findOne({ telegram_ID });
      if (user) {
        res.send(user);
      } else {
        res.status(404).send({ message: "User not found." });
      }
    });

    // Add new user
    app.post("/allusers", async (req, res) => {
      const { telegram_ID, ton_address } = req.body;

      try {
        const existingUser = await allUsersCollection.findOne({ telegram_ID });
        if (existingUser) {
          return res.status(400).json({ message: "User already exists" });
        }

        const newUser = {
          telegram_ID,
          ton_address,
          createdAt: new Date(),
          balance: 0,
          perk: 0,
          level: 1,
          bonus: 0,
          spin: 0,
          available_energy: 100,
          spent_telegramStars: 0,
          spent_Ton: 0,
          spent_pi: 0,
          total_energy: 100,
          check_In: 0,
          premium: "no",
        };

        const result = await allUsersCollection.insertOne(newUser);
        res.status(201).json(result);
      } catch (error) {
        console.error("Error adding new user:", error);
        res
          .status(500)
          .json({ message: "Failed to add user", error: error.message });
      }
    });

    // Update user with tap action
    app.patch("/allusers/:telegram_ID", async (req, res) => {
      const { telegram_ID } = req.params;
      const {
        balanceIncrement = 0,
        available_energy_decrement = 0,
        spinIncrement = 0,
        checkInIncrement = 0,
        isCheckIn = false,
      } = req.body;

      try {
        const query = { telegram_ID };
        const updateFields = {};

        if (balanceIncrement)
          updateFields.balance = balanceIncrement;
        if (available_energy_decrement)
          updateFields.available_energy = -available_energy_decrement;
        if (spinIncrement)
          updateFields.spin = spinIncrement;
        if (checkInIncrement)
          updateFields.check_In = checkInIncrement;

        const update = { $inc: updateFields };

        const result = await allUsersCollection.updateOne(query, update);

        if (result.modifiedCount > 0) {
          res.send({ message: "User data updated successfully." });
        } else {
          res
            .status(404)
            .send({ message: "User not found or no changes made." });
        }
      } catch (error) {
        console.error("Error updating user data:", error);
        res
          .status(500)
          .send({ message: "Failed to update user", error: error.message });
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
