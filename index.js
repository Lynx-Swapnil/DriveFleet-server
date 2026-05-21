const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { jwtVerify } = require("jose-cjs");

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true, // Allow cookies
}));
app.use(express.json());
app.use(cookieParser());

const PORT = process.env.PORT;

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// JWT Verification Middleware
const verifyToken = async (req, res, next) => {
  try {
    // Get token from cookies
    const token = req.cookies?.token || req.cookies?.better_auth_session;
    
    if (!token) {
      return res.status(401).send({ message: "Unauthorized access - No token" });
    }

    // Verify using shared secret
    const secret = new TextEncoder().encode(process.env.BETTER_AUTH_SECRET);
    const { payload } = await jwtVerify(token, secret);
    
    // Attach user info to request
    req.user = {
      id: payload.sub || payload.userId,
      email: payload.email,
    };
    next();
  } catch (error) {
    console.error("Token verification error:", error.message);
    return res.status(403).send({ message: "Forbidden access - Invalid token" });
  }
};

async function run() {
  try {
    const db = client.db("driveFleet");
    const carCollection = db.collection("cars");
    const bookingCollection = db.collection("bookings");

    // ========== FEATURED CARS ==========
    app.get('/featured', async (req, res) => {
      const result = await carCollection.find().limit(6).toArray();
      res.send(result);
    });

    // ========== ADD CAR ==========
    app.post("/cars", verifyToken, async (req, res) => {
      const carData = req.body;
      carData.booking_count = carData.booking_count || 0;
      carData.userId = req.user.id;
      carData.addedAt = new Date();
      
      const result = await carCollection.insertOne(carData);
      res.send(result);
    });

    // ========== GET ALL CARS ==========
    app.get("/cars", async (req, res) => {
      const cars = await carCollection.find().toArray();
      res.send(cars);
    });

    // ========== GET USER'S ADDED CARS ==========
    app.get("/cars/my", verifyToken, async (req, res) => {
      try {
        const userCars = await carCollection.find({ userId: req.user.id }).toArray();
        res.send(userCars);
      } catch (error) {
        res.status(500).send({ message: "Error fetching user cars", error: error.message });
      }
    });

    // ========== SEARCH & FILTER CARS ==========
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

    // ========== GET SINGLE CAR ==========
    app.get("/cars/:id", verifyToken, async (req, res) => {
      const carId = req.params.id;
      const query = {
        _id: new ObjectId(carId),
      };
      const car = await carCollection.findOne(query);
      res.send(car);
    });

    // ========== UPDATE CAR ==========
    app.patch("/cars/:id", verifyToken, async (req, res) => {
      const carId = req.params.id;
      const updateData = req.body;
      const filter = { _id: new ObjectId(carId) };
      const updateDoc = {
        $set: updateData,
      };
      const result = await carCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // ========== DELETE CAR ==========
    app.delete("/cars/:id", verifyToken, async (req, res) => {
      const carId = req.params.id;
      const query = { _id: new ObjectId(carId) };
      const result = await carCollection.deleteOne(query);
      res.send(result);
    });

    // ========== CREATE BOOKING ==========
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

    // ========== GET USER BOOKINGS ==========
    app.get("/bookings/:userId", verifyToken, async (req, res) => {
      const userId = req.params.userId;
      const filter = { userId: userId };
      const bookings = await bookingCollection.find(filter).toArray();
      res.send(bookings);
    });

    // ========== DELETE BOOKING ==========
    app.delete("/bookings/:id", verifyToken, async (req, res) => {
      const bookingId = req.params.id;
      const query = { _id: new ObjectId(bookingId) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    console.log("Connected to MongoDB successfully!");
  } catch (error) {
    console.error("Database connection error:", error);
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