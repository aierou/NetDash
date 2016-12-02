var exports = module.exports;

var request = require("request");
var config = require("../config.js");

var url = "http://192.168.0.2"
var baseHeaders = {
  "Authorization": "Basic " + new Buffer(config.reset.username + ":" + config.reset.password).toString("base64")
};

exports.reset = function(){
  request.get({url:url + "/reset.cgi", headers:baseHeaders}, function(err, res, body){
    if(err) console.log(err);
    console.log("Modem reset");
  });
}
