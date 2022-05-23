const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");

require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

// connect to mongo
const uri = `mongodb+srv://${process.env.dbuser}:${process.env.dbpass}@cluster0.fty2u.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authoraization;
  if (!authHeader) {
    return res.status(401).send({ message: "UnAuthoraze access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.secret, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Auth forbiden" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    await client.connect();
    // collection name
    const scheduleCollection = client
      .db("doctor-portal")
      .collection("schedule");
    const bookingCollection = client.db("doctor-portal").collection("booking");
    const usersCollection = client.db("doctor-portal").collection("users");
    const doctorsCollection = client.db("doctor-portal").collection("doctors");

    // verify admin
    const verifyAdmin = async (req, res, next) => {
      const requesterEmail = req.decoded.email;
      const requester = await usersCollection.findOne({
        email: requesterEmail,
      });
      if (requester.role === "admin") {
        next();
      } else {
        return res.status(403).send({ message: "Access forbiden" });
      }
    };

    // doctors schedule list api
    app.get("/schdule", async (req, res) => {
      const query = {};
      const cursor = scheduleCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    // get all users api
    app.get("/users", verifyJWT, async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });

    // get user booking
    app.get("/booking", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (decodedEmail === email) {
        const query = { email };
        const booking = await bookingCollection.find(query).toArray();
        return res.send(booking);
      } else {
        return res.status(403).send({ message: "Access forbiden" });
      }
    });

    // upsert user information
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      const token = jwt.sign({ email: email }, process.env.secret, {
        expiresIn: "1d",
      });
      res.send({ result, token });
    });

    // make admin api
    app.put("/user/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      return res.send(result);
    });

    // check admin status
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    // book appoinment api
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const query = {
        service: booking.service,
        date: booking.date,
        email: booking.email,
      };
      const exist = await bookingCollection.findOne(query);
      if (exist) {
        return res.send({ success: false, result: exist });
      } else {
        const result = await bookingCollection.insertOne(booking);
        res.send({ success: true, result: result });
      }
    });

    // get  doctor
    app.get("/doctors", async (req, res) => {
      const result = await doctorsCollection.find().toArray();
      res.send(result);
    });
    // delete  doctor
    app.delete("/doctors/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const result = await doctorsCollection.deleteOne({ email: email });
      res.send(result);
    });
    // post doctor
    app.post("/doctors", verifyJWT, verifyAdmin, async (req, res) => {
      const doctor = req.body;
      const result = await doctorsCollection.insertOne(doctor);
      res.send(result);
    });

    // filtering available schedul list
    app.get("/available", async (req, res) => {
      const date = req.query.date;
      const query = { date: date };
      const allSchedule = await scheduleCollection.find().toArray();
      const todaysBooked = await bookingCollection.find(query).toArray();

      allSchedule.forEach((schedule) => {
        const booked = todaysBooked.filter(
          (tb) => tb.service === schedule.name
        );
        const booking = booked.map((b) => b.slot);
        schedule.slots = schedule.slots.filter((s) => !booking.includes(s));
      });
      res.send(allSchedule);
    });
  } finally {
    // code
  }
}
run().catch(console.dir);

// the root get api
app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Server is running ${port}`);
});
