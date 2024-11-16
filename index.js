//index.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion } = require("mongodb");
const cron = require("node-cron");

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
    const piTransactionsCollection = client
      .db("BeamLOL")
      .collection("piTransactions");

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

    // Function to reset available energy for all users
    async function resetEnergyForAllUsers() {
      try {
        const updateResult = await allUsersCollection.updateMany(
          {},
          { $set: { available_energy: total_energy } }
        );
        console.log(`Reset energy for ${updateResult.modifiedCount} users.`);
      } catch (error) {
        console.error("Error resetting energy for users:", error);
      }
    }

    // Schedule the task to run every hour
    cron.schedule("*/5 * * * *", async () => {
      console.log("Running scheduled task to reset energy...");
      await resetEnergyForAllUsers();
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
        res
          .status(500)
          .send({ message: "Failed to fetch user", error: error.message });
      }
    });

    // Function to generate a unique referral code
    function generateReferralCode() {
      return Math.random().toString(36).substring(2, 10); // Generates a random string
    }

    // Add new user
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
              {
                $inc: {
                  balance: 100000,
                  spin: 100,
                },
              }
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
        res
          .status(500)
          .json({ message: "Failed to add user", error: error.message });
      }
    });

    // Update user with tap action
    // Updated route to handle multiple patch actions
    app.patch("/allusers/:telegram_ID", async (req, res) => {
      const { telegram_ID } = req.params;
      const {
        balanceIncrement = 0,
        available_energy_decrement = 0, // Add this to handle energy decrement
        perkIncrement = 0,
        spinIncrement = 0,
        energy = 0,
        price = 0,
        tap = 0,
        increment_balance = 0,
        increment_spin = 0,
        isCheckIn = false,
        resetEnergy = false,
        spinDecrement = 0,
      } = req.body;
    
      try {
        const user = await allUsersCollection.findOne({ telegram_ID });
        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }
    
        const updateFields = {};
    
        // Handle balance, perk, and spin increments
        if (balanceIncrement) updateFields.balance = balanceIncrement;
        if (perkIncrement) updateFields.perk = perkIncrement;
        if (spinIncrement) updateFields.spin = spinIncrement;
        if (spinDecrement) updateFields.spin = -spinDecrement;
    
        // Decrement available energy
        if (available_energy_decrement) {
          updateFields.available_energy = -available_energy_decrement;
        }
    
        // Handle energy and booster purchase
        if (energy) {
          if (user.balance < price) {
            return res
              .status(400)
              .send({ message: "Insufficient balance for booster" });
          }
          updateFields.available_energy = energy;
          updateFields.total_energy = energy;
          updateFields.tap_power = tap;
          updateFields.balance = -price; // Deduct balance for booster
        }
    
        // Handle premium update
        if (increment_balance && increment_spin) {
          updateFields.balance = increment_balance;
          updateFields.spin = increment_spin;
          updateFields.premium = true;
        }
    
        // Handle Check-In increment
        if (isCheckIn) {
          updateFields.check_In = user.check_In + 1;
        }
    
        // Handle energy reset
        if (resetEnergy) {
          updateFields.available_energy = user.total_energy;
        }
    
        const update = { $inc: updateFields };
    
        const result = await allUsersCollection.updateOne(
          { telegram_ID },
          update
        );
    
        if (result.modifiedCount > 0) {
          res.status(200).send({ message: "User data updated successfully" });
        } else {
          res
            .status(404)
            .send({ message: "No changes made or user not found" });
        }
      } catch (error) {
        console.error("Error updating user data:", error);
        res.status(500).send({
          message: "Failed to update user data",
          error: error.message,
        });
      }
    });
    

    // Add a new PI transaction
    app.post("/piTransactions", async (req, res) => {
      const { telegram_ID, transactionHash, price_PI, spins } = req.body;
      if (!telegram_ID || !transactionHash || !price_PI || !spins) {
        return res.status(400).send({
          message: "Invalid request. Please provide all required fields.",
        });
      }

      try {
        const newTransaction = {
          telegram_ID,
          transactionHash,
          price_PI,
          spins,
          state: "pending",
          createdAt: new Date(),
        };

        const result = await piTransactionsCollection.insertOne(newTransaction);
        res.status(201).json({ message: "Transaction recorded successfully!" });
      } catch (error) {
        console.error("Error recording transaction:", error);
        res.status(500).send({
          message: "Failed to record transaction",
          error: error.message,
        });
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
        res
          .status(500)
          .send({ message: "Failed to reset energy", error: error.message });
      }
    });

    // Purchase Booster
    app.patch("/purchase-booster/:telegram_ID", async (req, res) => {
      const { telegram_ID } = req.params;
      const { energy, price, tap } = req.body;

      if (!energy || !price || !tap) {
        return res.status(400).send({
          message:
            "Invalid request. Please provide 'energy', 'price', and 'tap' values.",
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
        res
          .status(500)
          .send({ message: "Error purchasing booster", error: error.message });
      }
    });

    // Process premium payment
    app.patch("/premium/:telegram_ID", async (req, res) => {
      const { telegram_ID } = req.params;
      const { increment_balance, increment_spin } = req.body;

      if (!increment_balance || !increment_spin) {
        return res.status(400).send({
          message:
            "Invalid request. Please provide 'increment_balance' and 'increment_spin' values.",
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
          res
            .status(200)
            .send({ message: "Premium features unlocked successfully!" });
        } else {
          res.status(500).send({ message: "Failed to update user data" });
        }
      } catch (error) {
        console.error("Error processing premium payment:", error);
        res.status(500).send({
          message: "Error processing premium payment",
          error: error.message,
        });
      }
    });

    app.post("/allusers/update/:telegram_ID", async (req, res) => {
      const { telegram_ID } = req.params;
      const { level, perk, total_energy } = req.body;

      try {
        const user = await allUsersCollection.findOne({ telegram_ID });
        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        const update = {
          $set: { level, perk, total_energy },
        };

        const result = await allUsersCollection.updateOne(
          { telegram_ID },
          update
        );

        if (result.modifiedCount > 0) {
          res.status(200).json({ message: "User updated successfully" });
        } else {
          res.status(400).send({ message: "Failed to update user" });
        }
      } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).send({ message: "Internal server error" });
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
