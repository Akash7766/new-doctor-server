const express = require("express");
const app = express();
const cors = require("cors");

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

async function run() {
  try {
    await client.connect();
    // collection name
    const scheduleCollection = client
      .db("doctor-portal")
      .collection("schedule");
    const bookingCollection = client.db("doctor-portal").collection("booking");
    // doctors schedule list api
    app.get("/schdule", async (req, res) => {
      const query = {};
      const cursor = scheduleCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    // get user booking
    app.get("/booking", async (req, res) => {
      const email = req.query.email;
      const query = { email };
      const booking = await bookingCollection.find(query).toArray();
      res.send(booking);
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
