var fs = require("fs"),
    request = require("request"),
    express = require("express");

var config = require("./config.js"),
    radio = require("./controllers/radio.js"),
    outlet = require("./controllers/outlet.js"),
    router = require("./controllers/router.js");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var app = express();

app.get("/traffic.json", function(req,res){
  router.getStatistics(function(data){
    res.status(200);
    res.json(data);
  });
});

app.get("/wireless.json", function(req,res){
  radio.getStatus(function(data){
    res.status(200);
    res.json(data);
  });
});

app.get("/reset", function(req,res){
  outlet.reset();
  res.status(200);
  res.send("Outlet reset.");
});

app.listen(3000,function(){
  console.log("Server started");
});
