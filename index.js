const express = require("express");
const cors = require("cors");
require("dotenv").config();
const PORT = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const app = express();
app.use(express.json());

const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
};
app.use(cors(corsOptions));

const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASS}@cluster0.m73tovo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const dbConnect = async () => {
  try {
    client.connect();
    console.log("Database Connected Successfully");
  } catch (error) {
    console.log(error.name, error.message);
  }
};
dbConnect();

const Database = client.db("AppertmentDB");
const appertmentsCollection = Database.collection("appertments");
const usersCollection = Database.collection("users");
const agrementsCollection = Database.collection("agrementlists");
const membersCollection = Database.collection("membersInfo");
const announceCollection = Database.collection("announcements");
const CupponsCollection = Database.collection("cuppons");
const paymentCollection = Database.collection("Payments");

app.get("/appertments", async (req, res) => {
  const page = parseInt(req.query.page) - 1;
  const size = parseInt(req.query.size);
  const appertments = await appertmentsCollection
    .find()
    .skip(page * size)
    .limit(size)
    .toArray();
  res.json(appertments);
});

app.put("/users", async (req, res) => {
  const user = req.body;
  const query = { email: user?.email };

  const isExist = await usersCollection.findOne(query);

  if (isExist) {
    return res.send({ isExist });
  }

  const options = { upsert: true };
  const updateDoc = {
    $set: {
      ...user,
      timestamp: Date.now(),
    },
  };
  const result = await usersCollection.updateOne(query, updateDoc, options);
  res.send(result);
});

app.get("/users/:email", async (req, res) => {
  const email = req.params.email;
  const query = { email };
  const result = await usersCollection.findOne(query);
  res.send(result);
});

app.post("/membersinfo", async (req, res) => {
  const membersinfo = req.body;
  const result = await membersCollection.insertOne(membersinfo);
  res.send(result);
});

app.get("/members", async (req, res) => {
  const result = await membersCollection.find().toArray();
  res.send(result);
});
app.get("/member/:email", async (req, res) => {
  const email = req.params.email;
  const query = { email };
  const result = await membersCollection.findOne(query);
  res.send(result);
});

app.delete("/member/:email", async (req, res) => {
  const email = req.params.email;
  const query = { email };
  const updateDoc = {
    $set: {
      role: "user",
      timestamp: Date.now(),
    },
  };

  const userresult = await usersCollection.updateOne(query, updateDoc);
  const result = await membersCollection.deleteOne(query);
  res.send(result);
});

app.post("/announcements", async (req, res) => {
  const announcement = req.body;
  const result = await announceCollection.insertOne(announcement);
  res.send(result);
});

app.get("/announcements", async (req, res) => {
  const result = await announceCollection.find().toArray();
  res.send(result);
});

app.post("/cupon-codes", async (req, res) => {
  const cuppons = req.body;
  const result = await CupponsCollection.insertOne(cuppons);
  res.send(result);
});

app.get("/cupon-codes", async (req, res) => {
  const result = await CupponsCollection.find().toArray();
  res.send(result);
});

app.get("/cupon-codes/:code", async (req, res) => {
  const code = req.params.code;
  const query = { code };
  const result = await CupponsCollection.findOne(query);
  res.send(result);
});

// update user status by admin
app.patch("/agements-user/:email", async (req, res) => {
  const email = req.params.email;
  const user = req.body;
  const query = { email };
  const updateDoc = {
    $set: {
      ...user,
      timestamp: Date.now(),
    },
  };
  const deletedoc = await agrementsCollection.deleteOne(query);
  const result = await usersCollection.updateOne(query, updateDoc);
  res.send(result);
});

app.get("/appertments-count", async (req, res) => {
  const count = await appertmentsCollection.estimatedDocumentCount();
  res.json(count);
});

app.post("/agreementlists", async (req, res) => {
  const agreementlists = req.body;
  const result = await agrementsCollection.insertOne(agreementlists);
  res.json(result);
});

app.get("/agreementlists", async (req, res) => {
  const result = await agrementsCollection.find().toArray();
  res.json(result);
});

app.get("/agreementlists/:email", async (req, res) => {
  const email = req.params.email;
  const query = { email: email };
  const result = await agrementsCollection.findOne(query);
  res.send(result);
});

// payment intent
app.post("/create-payment-intent", async (req, res) => {
  const { price } = req.body;
  const amount = parseInt(price * 100);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount,
    currency: "usd",
    payment_method_types: ["card"],
  });

  res.send({
    clientSecret: paymentIntent.client_secret,
  });
});

app.post("/payments", async (req, res) => {
  const payment = req.body;
  const paymentResult = await paymentCollection.insertOne(payment);
  res.send(paymentResult);
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
