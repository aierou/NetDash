var fs = require("fs"),
    request = require("request"),
    express = require("express");

var config = require("./config.js"),
    radio = require("./controllers/radio.js"),
    outlet = require("./controllers/outlet.js"),
    router = require("./controllers/router.js"),
    health = require("./controllers/health.js");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var app = express();

var api = express.Router();
api.get("/traffic.json", function(req, res){
  router.getStatistics(function(data, err){
    if(err){
      res.status(503);
      res.send("Error retrieving resource");
      return;
    }
    res.status(200);
    res.json(data);
  });
});

api.get("/wireless.json", function(req, res){
  radio.getStatus(function(data, err){
    if(err){
      res.status(503);
      res.send("Error retrieving resource");
      return;
    }
    res.status(200);
    res.json(data);
  });
});

api.get("/health.json", function(req, res){
  res.status(200);
  res.json(health.getResults());
});

api.get("/reset", function(req, res){
  outlet.reset();
  res.status(200);
  res.send("Outlet reset.");
});

app.use("/api", api);
app.get("/", function(req, res){
  res.sendFile("index.html", {root:__dirname + "/public/"});
});

app.use(express.static("public"));

app.listen(3000, function(){
  console.log("Server started");
});
