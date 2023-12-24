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
