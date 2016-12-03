var exports = module.exports;

var request = require("request"),
    crypto = require("crypto");

var config = require("../config.js");

var url = "http://192.168.0.1";
var cookies = request.jar();
var baseHeaders = {
  "Referer": "http://192.168.0.1/logon/logon.htm" //just need some "valid" referer
};
var hostnames = [];
var trafficStats = [];
var throttled = [];
var THROTTLE_THRESHOLD_UP = 200 * 1000; //Bytes
var THROTTLE_THRESHOLD_DOWN = 2000 * 1000;
var THROTTLE_ID_OFFSET = 3;
var THROTTLE_LIST_UP = -1;
var THROTTLE_LIST_DOWN = -2;
var THROTTLE_LIST_BOTH = -3;
var THROTTLE_TIMEOUT_CYCLES = 5;
var THROTTLE_MAX_TIMEOUT = 600;
var MAX_BANDWIDTH = 7*1000*1000;

function init(){
  setInterval(update, 2000);
  setInterval(lazyUpdate, 60000);

  logIn(function(){
    //Reset throttling groups
    setGroup(THROTTLE_LIST_UP, "");
    setGroup(THROTTLE_LIST_DOWN, "");
    setGroup(THROTTLE_LIST_BOTH, "");

    getDHCPClients();
  });
}

function update(){
  getTraffic();
  manageTraffic();
}

function lazyUpdate(){
  getDHCPClients();
}

var lastThrottleDown = "";
var lastThrottleUp = "";
var lastThrottleBoth = "";
function manageTraffic(){
  if(trafficStats.length <= 1) return;
  //Check that we match conditions for throttling (May need to modify math a bit)
  //None of this is going to be scientific; I'm just trying to find comfortable values.
  var totalBandwidth = 0;
  var using = 0;
  for(var i = 0; i < trafficStats.length; i++){
    var bandwidth = Number(trafficStats[i][1]) / 5;
    bandwidth += Number(trafficStats[i][2]) / 5;
    totalBandwidth += bandwidth;
    if(bandwidth > 0) using++;
  }
  var heavyusing = 0;
  for(var i = 0; i < trafficStats.length; i++){
    var used = Number(trafficStats[i][1]) / 5;
    used += Number(trafficStats[i][2]) / 5;
    used /= totalBandwidth;
    if(used >= (1/using)){
      heavyusing++;
    }
  }
  if(totalBandwidth < MAX_BANDWIDTH / heavyusing || heavyusing < 2){
    return;
  }

  var throttled_buffer = [];
  for(var i = 0; i < trafficStats.length; i++){
    //Add throttled users
    var ip = trafficStats[i][0];
    var down = trafficStats[i][1] / 5;
    var up = trafficStats[i][2] / 5;
    var id = parseInt(ip.split(".")[3], 10) - THROTTLE_ID_OFFSET;
    if(id > 50 - THROTTLE_ID_OFFSET) continue; //Unsupported ip (router limit)
    if(id == 1) continue; //Not throttling myself lul (in the future make priority lists)
    var entry = throttled.find((a) => a.id == id) || {id:id, lists:[], timeout:0};
    if(down > THROTTLE_THRESHOLD_DOWN){
      entry.timeout += THROTTLE_TIMEOUT_CYCLES;
      if(!entry.lists.includes(THROTTLE_LIST_DOWN))
        entry.lists.push(THROTTLE_LIST_DOWN);
    }
    if(up > THROTTLE_THRESHOLD_UP){
      entry.timeout += THROTTLE_TIMEOUT_CYCLES;
      if(!entry.lists.includes(THROTTLE_LIST_UP))
        entry.lists.push(THROTTLE_LIST_UP);
    }
    if(down < THROTTLE_THRESHOLD_DOWN / 2 && entry.lists.includes(THROTTLE_LIST_DOWN)){
      entry.timeout--;
      if(entry.timeout <= 0){
        var index = entry.lists.indexOf(THROTTLE_LIST_DOWN);
        if(index != -1)
          entry.lists.splice(index, 1);
      }
    }
    if(up < THROTTLE_THRESHOLD_UP / 2 && entry.lists.includes(THROTTLE_LIST_UP)){
      entry.timeout--;
      if(entry.timeout <= 0){
        var index = entry.lists.indexOf(THROTTLE_LIST_UP);
        if(index != -1)
          entry.lists.splice(index, 1);
      }
    }
    entry.timeout = Math.min(Math.max(entry.timeout, 0), THROTTLE_MAX_TIMEOUT);
    if(entry.lists.length!=0)
      throttled_buffer.push(entry);
  }
  throttled = throttled_buffer;
  //Generating the user lists.
  var throttleUpUsers = [];
  var throttleDownUsers = [];
  var throttleBothUsers = [];
  for(var i = 0; i < throttled.length; i++){
    var up = throttled[i].lists.includes(THROTTLE_LIST_UP);
    var down = throttled[i].lists.includes(THROTTLE_LIST_DOWN);
    if(up && down){
       throttleBothUsers.push(throttled[i].id);
    }else if(up){
      throttleUpUsers.push(throttled[i].id);
    }else if(down){
      throttleDownUsers.push(throttled[i].id);
    }
  }
  var throttleUp = throttleUpUsers.join(",");
  var throttleDown = throttleDownUsers.join(",");
  var throttleBoth = throttleBothUsers.join(",");

    //Finally make the request to the server
  if(throttleUp != lastThrottleUp) setGroup(THROTTLE_LIST_UP, throttleUp);
  if(throttleDown != lastThrottleDown) setGroup(THROTTLE_LIST_DOWN, throttleDown);
  if(throttleBoth != lastThrottleBoth) setGroup(THROTTLE_LIST_BOTH, throttleBoth);

  lastThrottleUp = throttleUp;
  lastThrottleDown = throttleDown;
  lastThrottleBoth = throttleBoth;
}

function setGroup(group, list){
  if(list == "") list = "NULL";
  console.log("Throttling " + group + ": " + list);
  var formData = {
    rd_view:1,
    slt_user: 0,
    slt_group: group,
    selectgroup2: "",
    selectuser2: list,
    slt_user2: "",
    slt_group2: group
  };
  request.post({url:url + "/userRpm/Ugm_View.htm", form:formData, followAllRedirects:true, jar:cookies, headers:baseHeaders}, function(err, res, body){
    if(err) console.log(err);
    //This seems to be the only variable (outside of parsing html) that identifies a logout
    if(res.headers["set-cookie"]){
      logIn(setGroup, [group, list]);
      return;
    }
  });
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

function getDHCPClients(){
  request.get({url:url + "/userRpm/DhcpServer_ClientList.htm?slt_interface=0", followAllRedirects:true, jar:cookies, headers:baseHeaders}, function(err, res, body){
    if(err) console.log(err);
    //This seems to be the only variable (outside of parsing html) that identifies a logout
    if(res.headers["set-cookie"]){
      logIn(getDHCPClients);
      return;
    }

    var i = body.indexOf("var dhcpList = new Array(");
    i += "var dhcpList = new Array(".length;
    var j = body.indexOf("0,0 );\n</script>\n<script language=JavaScript>\nvar dhcpPara = new Array(");
    nums = body.substring(i,j);
    nums = nums.split("\"").join("").split("\n").join(""); //replace all the extra formatting nonsense

    var values = nums.split(",");
    var clients = new Array();
    var len = Math.floor(values.length / 4) * 4;
    for(var i = 0; i < len; i += 4){
      var index = i/4;
      clients[index] = {};
      clients[index].hostname = values[i];
      //clients[index].mac = values[i+2]; // Don't really care about mac address
      clients[index].ip = values[i+2];
    }
    hostnames = clients;
  });
}

function getTraffic(){
  request.get({url:url + "/userRpm/System_Statics.htm?btn_refresh=btn_refresh&comindex=9&direct=1&interface=1", followAllRedirects:true, jar:cookies, headers:baseHeaders}, function(err, res, body){
    if(err){
      return console.log(err);
    }
    //This seems to be the only variable (outside of parsing html) that identifies a logout
    if(res.headers["set-cookie"]){
      logIn(getTraffic);
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
      statistics[index][2] = values[i+8]; //current up
      statistics[index][1] = values[i+9]; //current down
    }
    trafficStats = statistics;
  });
}

exports.getStatistics = function(){
  return {traffic:trafficStats, clients:hostnames};
}

init();
