const express = require("express");
const bodyparser = require("body-parser");
const { Shared } = require("../shared");
const http = require("http");
var path = require("path");

const app = express();

app.get("/shared.js", function (req, res) {
  res.sendFile(path.join(__dirname, "/../shared.js"));
});

app.use("/", express.static("examples"));

const server = http.createServer(app);

const shared = new Shared({ server });
shared.subscribe(null, (data) => console.log(data.path.join("."), data.value));

shared.server.test = 1;
setInterval(() => {
  shared.server.test += 1;

  Object.keys(shared.clients._).map(
    (k) =>
      (shared.clients[k].test2 =
        shared.clients[k].test2 != null ? shared.clients[k].test2 + 1 : 0)
  );
}, 5000);
