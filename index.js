const express = require("express");
const cors = require("cors");
require("dotenv").config();
const PORT = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://quater-morshidul.netlify.app",
  ],
  credentials: true,
};
app.use(cors(corsOptions));

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

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
const paymentInfoCollection = Database.collection("Paymentinfo");

app.post("/jwt", async (req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "365d",
  });
  res.send({ token: token });
});

const verifyAdmin = async (req, res, next) => {
  const user = req.user;
  const query = { email: user?.email };
  const result = await usersCollection.findOne(query);
  if (!result || result?.role !== "admin")
    return res.status(401).send({ message: "unauthorized access!!" });
  next();
};

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
app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
  const query = { role: "user" };
  const member = { role: "member" };
  const Totaluser = await usersCollection.countDocuments(query);
  const Totalmember = await usersCollection.countDocuments(member);
  const result = await appertmentsCollection
    .aggregate([
      {
        $group: {
          _id: null,
          TotalRooms: { $sum: "$apartmentNo" },
        },
      },
    ])
    .toArray();
  const TotalRooms = result.length > 0 ? result[0].TotalRooms : 0;

  const agrement = await membersCollection
    .aggregate([
      {
        $group: {
          _id: null,
          Totalagrements: { $sum: "$apartmentNo" },
        },
      },
    ])
    .toArray();
  const Totalagrements = agrement.length > 0 ? agrement[0].Totalagrements : 0;
  const aviablerooms = TotalRooms - Totalagrements;
  res.send({
    users: Totaluser,
    members: Totalmember,
    rooms: TotalRooms,
    agrement: Totalagrements,
    aviablerooms: aviablerooms,
  });
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

app.get("/members", verifyToken, async (req, res) => {
  const result = await membersCollection.find().toArray();
  res.send(result);
});
app.get("/member/:email", async (req, res) => {
  const email = req.params.email;
  const query = { email };
  const result = await membersCollection.findOne(query);
  res.send(result);
});

app.delete("/member/:email", verifyToken, verifyAdmin, async (req, res) => {
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

app.post("/announcements", verifyToken, verifyAdmin, async (req, res) => {
  const announcement = req.body;
  const result = await announceCollection.insertOne(announcement);
  res.send(result);
});

app.post("/cupon-codes", verifyToken, verifyAdmin, async (req, res) => {
  const cuppons = req.body;
  const result = await CupponsCollection.insertOne(cuppons);
  res.send(result);
});

app.get("/cupon-codes", async (req, res) => {
  const result = await CupponsCollection.find().toArray();
  res.send(result);
});
app.get("/cupon/:id", verifyToken, verifyAdmin, async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await CupponsCollection.findOne(query);
  res.send(result);
});
app.put("/cupon/:id", verifyToken, verifyAdmin, async (req, res) => {
  const cupon = req.body;
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const updateDoc = {
    $set: {
      ...cupon,
    },
  };
  const result = await CupponsCollection.updateOne(query, updateDoc);
  res.send(result);
});

app.get("/cupon-codes/:code", async (req, res) => {
  const code = req.params.code;
  const query = { code };
  const result = await CupponsCollection.findOne(query);
  res.send(result);
});

// update user status by admin
app.patch(
  "/agements-user/:email",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
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
  }
);

app.get("/announcements", async (req, res) => {
  const result = await announceCollection.find().toArray();
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

app.get("/agreementlists", verifyToken, verifyAdmin, async (req, res) => {
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
  const Result = await paymentInfoCollection.deleteMany();
  res.send(paymentResult);
});
app.get("/payments/:email", async (req, res) => {
  const email = req.params.email;
  const month = req.query.month;
  const query = { email };
  if (month) {
    query.date = month;
  }
  const paymentResult = await paymentCollection.find(query).toArray();
  res.send(paymentResult);
});

app.post("/payments-info", async (req, res) => {
  const payment = req.body;
  const paymentResult = await paymentInfoCollection.insertOne(payment);
  res.send(paymentResult);
});

app.get("/payments-info/:email", async (req, res) => {
  const email = req.params.email;
  const query = { email };
  const result = await paymentInfoCollection.findOne(query);
  res.send(result);
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
