const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

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

// Middleware

const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  try {
    const { payload } = await jwtVerify(token, JWKS);
    console.log(payload);
    next();
  } catch (error) {
    return res.status(403).send({ message: "Forbidden access" });
  }
};

async function run() {
  try {
    await client.connect();

    const db = client.db("driveFleet");
    const carCollection = db.collection("cars");
    const bookingCollection = db.collection("bookings");

    app.get('/featured', (req, res) => {
      const result = carCollection.find().limit(6).toArray();
      res.send(result);
    });

    app.post("/cars", verifyToken, async (req, res) => {
      const carData = req.body;
      const result = await carCollection.insertOne(carData);
      res.send(result);
    });

    app.get("/cars", async (req, res) => {
      const cars = await carCollection.find().toArray();
      res.send(cars);
    });

    app.get("/cars/:id", verifyToken, async (req, res) => {
      const carId = req.params.id;
      const query = {
        _id: new ObjectId(carId),
      };
      const car = await carCollection.findOne(query);
      res.send(car);
    });

    app.patch("/cars/:id",verifyToken, async (req, res) => {
      const carId = req.params.id;
      const updateData = req.body;
      const filter = { _id: new ObjectId(carId) };
      const updateDoc = {
        $set: updateData,
      };
      const result = await carCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/cars/:id",verifyToken, async (req, res) => {
      const carId = req.params.id;
      const query = { _id: new ObjectId(carId) };
      const result = await carCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/bookings", verifyToken, async (req, res) => {
      const bookingData = req.body;
      const result = await bookingCollection.insertOne(bookingData);
      res.send(result);
    });

    app.get("/bookings/:userId", async (req, res) => {
      const userId = req.params.userId;
      filter = { userId: userId };
      const bookings = await bookingCollection.find(filter).toArray();
      res.send(bookings);
    });

    app.delete("/bookings/:id",verifyToken, async (req, res) => {
      const bookingId = req.params.id;
      const query = { _id: new ObjectId(bookingId) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server is running successfully");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
