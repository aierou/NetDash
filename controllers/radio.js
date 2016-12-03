var exports = module.exports;

var request = require("request");
var config = require("../config.js");

var url = "https://192.168.0.5"
var cookies = request.jar();
var status;

function logIn(callback, cbparams){
  console.log(new Date().toISOString() + " Logging into radio");
  var formData = {
    username: config.radio.username,
    password: config.radio.password
  }
  request.get({url:url, followAllRedirects:true, jar:cookies}, function(err, res, body){
    if(err) return console.error(err);
    request.post({url:url + "/login.cgi", formData:formData, followAllRedirects:true, jar:cookies}, function(err, res, body){
      if(err) return console.error(err);
      callback.apply(callback, cbparams);
    });
  });
}

function getWirelessStatus(){
  request.get({url:url + "/status.cgi", jar:cookies}, function(err, res, body){
    if(err){
      return console.error(err);
    }
    if(res.request.uri.pathname != "/status.cgi"){
      //Need to log-in again.
      logIn(exports.getStatus);
      return;
    }
    status = JSON.parse(body);
  });
}
setInterval(getWirelessStatus, 1000);

exports.getStatus = function(){
  return status;
}
