var exports = module.exports;

var request = require("request"),
    crypto = require("crypto");

var config = require("../config.js");

var url = "http://192.168.0.1"
var cookies = request.jar();
var baseHeaders = {
  "Referer": "http://192.168.0.1/logon/logon.htm" //just need some "valid" referer
}

function logIn(callback, cbparams){
  console.log(new Date().toISOString() + " Logging into router");
  request.get({url:url, followAllRedirects:true, jar:cookies}, function(err, res, body){
    //Lol what the hell is this (how the client sends the password)
    var cs = cookies.getCookieString(url).split("=")[1];
    var tmp_pass = crypto.createHash("md5").update(config.router.password).digest("hex");
    var hash = crypto.createHash("md5").update(tmp_pass.toUpperCase()+":"+cs).digest("hex");
    var encoded = config.router.username + ":" + hash.toUpperCase();
    var formData = {
      encoded: encoded,
      nonce: cs,
      URL: "../logon/loginJump.htm"
    }
    request.post({url:url + "/logon/loginJump.htm", form:formData, followAllRedirects:true, jar:cookies, headers:baseHeaders}, function(err, res, body){
      //This request is necessary to kick out someone who is already logged-in to the router. Always sending it is harmless.
      request.get({url:url + "/logon/loginConfirm.htm", followAllRedirects:true, jar:cookies, headers:baseHeaders}, function(err, res, body){
        callback.apply(callback, cbparams);
      });
    });
  });
}

exports.getStatistics = function(callback){
  request.get({url:url + "/userRpm/System_Statics.htm?btn_refresh=btn_refresh&comindex=9&direct=1&interface=1", followAllRedirects:true, jar:cookies, headers:baseHeaders}, function(err, res, body){
    if(err){
      return callback(null, err);
    }
    //This seems to be the only variable (outside of parsing html) that identifies a logout
    if(res.headers["set-cookie"]){
      logIn(exports.getStatistics, [callback]);
      return;
    }
    //Now we get to parse html. Yaaaay
    var i = body.indexOf("var staEntryInf = new Array(");
    i += "var staEntryInf = new Array(".length;
    var j = body.indexOf(");\n</script>\n</HEAD>");
    nums = body.substring(i,j);
    nums = nums.split("\"").join("").split("\n").join(""); //replace all the extra formatting nonsense
    //Now we need to parse the data into something useful
    var values = nums.split(",");
    var statistics = new Array();
    var len = Math.floor(values.length / 10) * 10;
    for(var i = 0; i < len; i += 10){
      var index = i/10;
      statistics[index] = [];
      statistics[index][0] = values[i]; //IP
      //Don't care about i+1
      statistics[index][8] = values[i+2]; //total pkts up
      statistics[index][7] = values[i+3]; //total pkts down
      statistics[index][6] = values[i+4]; //total bytes up
      statistics[index][5] = values[i+5]; //total bytes down
      statistics[index][4] = values[i+6]; //current pkts up
      statistics[index][3] = values[i+7]; //current pkts down
      statistics[index][2] = values[i+8]; //current bits up
      statistics[index][1] = values[i+9]; //current bits down
    }
    callback(statistics);
  });
}
