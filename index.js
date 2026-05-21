const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// ========== MIDDLEWARE ==========
// Verifies that the request comes from our trusted Next.js proxy
// using a shared secret key + user ID header.
const verifyToken = (req, res, next) => {
  const internalKey = req.headers["x-internal-key"];
  const userId = req.headers["x-user-id"];

  if (!internalKey || internalKey !== INTERNAL_API_KEY) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  if (!userId) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  // Attach user info so route handlers can use req.user.id
  req.user = {
    id: userId,
    email: req.headers["x-user-email"] || "",
  };

  next();
};

async function run() {
  try {
    // await client.connect();

    const db = client.db("driveFleet");
    const carCollection = db.collection("cars");
    const bookingCollection = db.collection("bookings");

    // ========== FEATURED CARS (public) ==========
    app.get("/featured", async (req, res) => {
      try {
        const result = await carCollection.find().limit(6).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Error fetching featured cars" });
      }
    });

    // ========== GET ALL CARS (public) ==========
    app.get("/cars", async (req, res) => {
      try {
        const cars = await carCollection.find().toArray();
        res.send(cars);
      } catch (error) {
        res.status(500).send({ message: "Error fetching cars" });
      }
    });

    // ========== SEARCH & FILTER CARS (public) ==========
    app.get("/cars/search", async (req, res) => {
      try {
        const { search, type } = req.query;
        let filter = {};

        if (search && search.trim() !== "") {
          filter.carName = { $regex: search, $options: "i" };
        }

        if (type && type.trim() !== "") {
          filter.carType = type;
        }

        const cars = await carCollection.find(filter).toArray();
        res.send(cars);
      } catch (error) {
        res.status(500).send({ message: "Error fetching cars", error: error.message });
      }
    });

    // ========== GET USER'S ADDED CARS (protected) ==========
    app.get("/cars/my", verifyToken, async (req, res) => {
      try {
        const userCars = await carCollection.find({ userId: req.user.id }).toArray();
        res.send(userCars);
      } catch (error) {
        res.status(500).send({ message: "Error fetching user cars", error: error.message });
      }
    });

    // ========== ADD CAR (protected) ==========
    app.post("/cars", verifyToken, async (req, res) => {
      try {
        const carData = req.body;
        carData.booking_count = carData.booking_count || 0;
        carData.userId = req.user.id;
        carData.addedAt = new Date();
        const result = await carCollection.insertOne(carData);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Error adding car", error: error.message });
      }
    });

    // ========== GET SINGLE CAR (protected) ==========
    app.get("/cars/:id", verifyToken, async (req, res) => {
      try {
        const carId = req.params.id;
        const car = await carCollection.findOne({ _id: new ObjectId(carId) });
        res.send(car);
      } catch (error) {
        res.status(500).send({ message: "Error fetching car", error: error.message });
      }
    });

    // ========== UPDATE CAR (protected) ==========
    app.patch("/cars/:id", verifyToken, async (req, res) => {
      try {
        const carId = req.params.id;
        const updateData = req.body;
        const result = await carCollection.updateOne(
          { _id: new ObjectId(carId) },
          { $set: updateData }
        );
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Error updating car", error: error.message });
      }
    });

    // ========== DELETE CAR (protected) ==========
    app.delete("/cars/:id", verifyToken, async (req, res) => {
      try {
        const carId = req.params.id;
        const result = await carCollection.deleteOne({ _id: new ObjectId(carId) });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Error deleting car", error: error.message });
      }
    });

    // ========== CREATE BOOKING (protected) ==========
    app.post("/bookings", verifyToken, async (req, res) => {
      const bookingData = req.body;
      try {
        const bookingResult = await bookingCollection.insertOne(bookingData);
        const carUpdateResult = await carCollection.updateOne(
          { _id: new ObjectId(bookingData.carId) },
          { $inc: { booking_count: 1 } }
        );
        res.send({ bookingResult, carUpdateResult });
      } catch (error) {
        res.status(500).send({ message: "Error creating booking", error: error.message });
      }
    });

    // ========== GET USER BOOKINGS (protected) ==========
    app.get("/bookings/:userId", verifyToken, async (req, res) => {
      try {
        const userId = req.params.userId;
        const bookings = await bookingCollection.find({ userId }).toArray();
        res.send(bookings);
      } catch (error) {
        res.status(500).send({ message: "Error fetching bookings", error: error.message });
      }
    });

    // ========== DELETE BOOKING (protected) ==========
    app.delete("/bookings/:id", verifyToken, async (req, res) => {
      try {
        const bookingId = req.params.id;
        const result = await bookingCollection.deleteOne({ _id: new ObjectId(bookingId) });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Error deleting booking", error: error.message });
      }
    });

    console.log("Connected to MongoDB and routes registered.");
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

// ========== ROOT ENDPOINT ==========
app.get("/", (req, res) => {
  res.send("server is running successfully");
});

// ========== START SERVER ==========
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});