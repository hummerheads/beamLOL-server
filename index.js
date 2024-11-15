//index.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion } = require("mongodb");

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ebsbi.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1 },
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
      try {
        const users = await allUsersCollection.find().toArray();
        res.status(200).send(users);
      } catch (error) {
        console.error("Error fetching all users:", error);
        res.status(500).send({ message: "Failed to fetch users" });
      }
    });

    // Get user by telegram_ID
    app.get("/allusers/:telegram_ID", async (req, res) => {
      const { telegram_ID } = req.params;
      try {
        const user = await allUsersCollection.findOne({ telegram_ID });
        if (user) {
          res.status(200).send(user);
        } else {
          res.status(404).send({ message: "User not found" });
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).send({ message: "Failed to fetch user", error: error.message });
      }
    });

// Function to generate a unique referral code
function generateReferralCode() {
  return Math.random().toString(36).substring(2, 10); // Generates a random string
}

app.post("/allusers", async (req, res) => {
  const { telegram_ID, ton_address, referralCode } = req.body;
  try {
    const existingUser = await allUsersCollection.findOne({ telegram_ID });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    let referredBy = null;
    if (referralCode) {
      const referrer = await allUsersCollection.findOne({ referralCode });
      if (referrer) {
        referredBy = referrer.telegram_ID;
        await allUsersCollection.updateOne(
          { telegram_ID: referrer.telegram_ID },
          { $inc: { perk: 1 } }
        );
      } else {
        console.warn("Invalid referral code provided:", referralCode);
        return res.status(400).json({ message: "Invalid referral code" });
      }
    }

    const userReferralCode = generateReferralCode();
    const referralLink = `https://t.me/Dhinchakbot_bot?start=referral_${userReferralCode}`;

    const newUser = {
      telegram_ID,
      ton_address,
      referralCode: userReferralCode,
      referredBy,
      referralLink,
      createdAt: new Date(),
      balance: 0,
      perk: 0,
      level: 0,
      tap_power: 1,
      bonus: 0,
      spin: 0,
      available_energy: 100,
      spent_telegramStars: 0,
      spent_Ton: 0,
      spent_pi: 0,
      total_energy: 100,
      check_In: 0,
      premium: false,
    };

    const result = await allUsersCollection.insertOne(newUser);
    res.status(201).json(result);
  } catch (error) {
    console.error("Error adding new user:", error);
    res.status(500).json({ message: "Failed to add user", error: error.message });
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

        if (balanceIncrement) updateFields.balance = balanceIncrement;
        if (available_energy_decrement)
          updateFields.available_energy = -available_energy_decrement;
        if (spinIncrement) updateFields.spin = spinIncrement;
        if (checkInIncrement) updateFields.check_In = checkInIncrement;

        const update = { $inc: updateFields };
        const result = await allUsersCollection.updateOne(query, update);

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

    // Reset available energy to total_energy
    app.patch("/reset-energy/:telegram_ID", async (req, res) => {
      const { telegram_ID } = req.params;
      try {
        const user = await allUsersCollection.findOne({ telegram_ID });
        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        await allUsersCollection.updateOne(
          { telegram_ID },
          { $set: { available_energy: user.total_energy } }
        );
        res.send({ message: "Energy reset successfully." });
      } catch (error) {
        console.error("Error resetting energy:", error);
        res.status(500).send({ message: "Failed to reset energy", error: error.message });
      }
    });

    // Purchase Booster
    app.patch("/purchase-booster/:telegram_ID", async (req, res) => {
      const { telegram_ID } = req.params;
      const { energy, price, tap } = req.body;

      if (!energy || !price || !tap) {
        return res.status(400).send({
          message: "Invalid request. Please provide 'energy', 'price', and 'tap' values.",
        });
      }

      try {
        const user = await allUsersCollection.findOne({ telegram_ID });
        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        if (user.balance < price) {
          return res.status(400).send({ message: "Insufficient balance" });
        }

        const update = {
          $inc: {
            balance: -price,
            available_energy: energy,
            total_energy: energy,
            tap_power: tap,
          },
        };

        const result = await allUsersCollection.updateOne(
          { telegram_ID },
          update
        );

        if (result.modifiedCount > 0) {
          res.status(200).send({ message: "Booster purchased successfully" });
        } else {
          res.status(500).send({ message: "Failed to update user data" });
        }
      } catch (error) {
        console.error("Error purchasing booster:", error);
        res.status(500).send({ message: "Error purchasing booster", error: error.message });
      }
    });

    // Process premium payment
    app.patch("/premium/:telegram_ID", async (req, res) => {
      const { telegram_ID } = req.params;
      const { increment_balance, increment_spin } = req.body;

      if (!increment_balance || !increment_spin) {
        return res.status(400).send({
          message: "Invalid request. Please provide 'increment_balance' and 'increment_spin' values.",
        });
      }

      try {
        const user = await allUsersCollection.findOne({ telegram_ID });
        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        const update = {
          $inc: {
            balance: increment_balance,
            spin: increment_spin,
          },
          $set: {
            premium: true,
          },
        };

        const result = await allUsersCollection.updateOne(
          { telegram_ID },
          update
        );

        if (result.modifiedCount > 0) {
          res.status(200).send({ message: "Premium features unlocked successfully!" });
        } else {
          res.status(500).send({ message: "Failed to update user data" });
        }
      } catch (error) {
        console.error("Error processing premium payment:", error);
        res.status(500).send({ message: "Error processing premium payment", error: error.message });
      }
    });

  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
run().catch(console.dir);
