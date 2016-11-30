var fs = require("fs");
var config = require("./config.js");
var request = require("request");
var radio = require("./radio.js");
var express = require("express");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

radio.getStatus(function(data){
  console.log(data.wireless.signal);
  radio.getStatus(function(data){
    console.log(data.wireless.signal);
  });
});
