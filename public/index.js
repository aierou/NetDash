window.onload = init;

var trafficHeaders = [
  "IP",
  "Hostname",
  "Down Speed",
  "Up Speed",
  "Pkt/s Down",
  "Pkt/s Up",
  "Total Downloaded",
  "Total Uploaded",
  "Total Packets Down",
  "Total Packets Up",
]

var trafficHeaderRow = document.createElement("tr");
for(var i = 0; i < trafficHeaders.length; i++){
  var th = document.createElement("th");
  th.textContent = trafficHeaders[i];
  if(i != 1) th.setAttribute("onclick", "orderTrafficStatistics("+i+");")
  trafficHeaderRow.appendChild(th);
}
trafficHeaderRow.setAttribute("id","trafficHeaderRow");
var trafficStats = [];
var trafficSortProperties = {type:"descend", col:2};
var wirelessData = {};
var health = [];

function init(){
  document.getElementById("b_reset").onclick = resetModem;
  document.getElementById("b_critical").onclick = criticalMode;
  document.getElementById("b_groups").onclick = clearGroups;
  setInterval(update, 2000);
  update();
}

function update(){
  getWirelessStatus();
  getTrafficStatistics();
  getHealth();
}

var resetting = false;
function resetModem(){
  if(resetting) return;
  resetting = true;
  var request = new XMLHttpRequest();
  request.open("GET", "/api/reset", true);
  request.send();

  //Now the graphical stuff
  document.getElementById("controlinfo").textContent = "Resetting...";
  document.getElementById("b_reset").setAttribute("disabled", "disabled");
  var resetDelay = setTimeout(function(){
    resetting = false;
    document.getElementById("controlinfo").textContent = "";
    document.getElementById("b_reset").removeAttribute("disabled");
  }, 2000);
}

function criticalMode(){
  var request = new XMLHttpRequest();
  request.open("GET", "/api/critical", true);
  request.send();
  request.onload = function(){
    controlLogInfo("Critical mode activated.");
  }
}

function clearGroups(){
  var request = new XMLHttpRequest();
  request.open("GET", "/api/cleargroups", true);
  request.send();
  request.onload = function(){
    controlLogInfo("Groups cleared.");
  }
}
var controlTimer;
function controlLogInfo(text){
  document.getElementById("controlinfo").textContent = text;
  clearTimeout(controlTimer);
  controlTimer = setTimeout(function(){
    document.getElementById("controlinfo").textContent = "";
  }, 3000);
}

function getWirelessStatus(){
  var request = new XMLHttpRequest();
  request.open("GET", "/api/wireless.json", true);
  request.onload = function(){
    if (request.status >= 200 && request.status < 400){
      wirelessData = JSON.parse(request.responseText);
      setWirelessData();
    }else{
      request.onerror();
    }
  };
  request.onerror = function() {
    document.getElementById("diagnostics").textContent = "Error loading wireless data";
  };
  request.send();
}
function getTrafficStatistics(){
  var request = new XMLHttpRequest();
  request.open("GET", "/api/traffic.json", true);
  request.onload = function(){
    if (request.status >= 200 && request.status < 400){
      var data = JSON.parse(request.responseText);
      trafficStats = data.traffic;
      for(var i = 0; i < trafficStats.length; i++){
        var obj = {};
        obj.hostname = data.clients.find((a) => a.ip == trafficStats[i][0]);
        obj.throttle = data.throttled.find((a) => a.ip == trafficStats[i][0]);
        obj.raw = trafficStats[i];
        obj.pretty = trafficStats[i].slice(0); //Need to make a clone
        trafficStats[i] = obj;
      }
      formatTrafficStatistics();
      orderTrafficStatistics(trafficSortProperties.col, true);
    }else{
      request.onerror();
    }
  };
  request.onerror = function(){
    document.getElementById("traffic").textContent = "Error loading traffic data";
  };
  request.send();
}
function getHealth(){
  var request = new XMLHttpRequest();
  request.open("GET", "/api/health.json", true);
  request.onload = function(){
    if (request.status >= 200 && request.status < 400){
      health = JSON.parse(request.responseText);
      setHealth();
    }else{
      request.onerror();
    }
  };
  request.onerror = function(){
    document.getElementById("health").textContent = "Error loading health data";
  };
  request.send();
}
function setHealth(){
  if(document.getElementById("health").firstChild){ //remove the table if it exists
    document.getElementById("health").removeChild(document.getElementById("health").firstChild);
  }
  var table = document.createElement("table");
  for(var i = 0; i < health.length; i++){
    var tr = document.createElement("tr");
    var label = document.createElement("td");
    var bubble = document.createElement("td");
    label.textContent = health[i].url;
    bubble.setAttribute("class", "bubble");
    bubble.textContent = Math.floor(health[i].meanlatency).toString() + "ms";
    bubble.style.backgroundColor = calculateBubbleColor(health[i].health, health[i].maxHealth, Math.ceil(health[i].maxHealth/2));

    tr.appendChild(label);
    tr.appendChild(bubble);
    table.appendChild(tr);
  }
  document.getElementById("health").appendChild(table);
}
function setWirelessData(){
  var data = wirelessData;
  document.getElementById("wireless_signal").textContent = data.wireless.signal;
  document.getElementById("wireless_signal").style.backgroundColor = calculateBubbleColor(100 + data.wireless.signal, 45, 25);

  document.getElementById("transfer_rate").textContent = data.wireless.rxrate + "/" + data.wireless.txrate;
  var total = parseInt(data.wireless.rxrate,10) + parseInt(data.wireless.txrate,10);
  document.getElementById("transfer_rate").style.backgroundColor = calculateBubbleColor(total, 600, 300);
}
function calculateBubbleColor(value, max, threshold){
  var green = Math.floor(Math.min(Math.max(255*value/max,0),255)).toString(16);
  if(green.length==1) green = "0" + green;
  var red = Math.floor(Math.min(Math.max(255*(max-value)/threshold,0),255)).toString(16);
  if(red.length==1) red = "0" + red;

  return "#" + red + green + "00";
}
function formatTrafficStatistics(){
  for(var i = 0; i < trafficStats.length; i++){
    //Convert values (where does 5 come from, wtf? Router designers lol)
    trafficStats[i].pretty[1] = trafficStats[i].pretty[1]/5;
    trafficStats[i].pretty[2] = trafficStats[i].pretty[2]/5;
    trafficStats[i].pretty[3] = Math.floor(trafficStats[i].pretty[3]/5);
    trafficStats[i].pretty[4] = Math.floor(trafficStats[i].pretty[4]/5);

    //Now we format numbers
    for(var j = 1; j < trafficStats[i].pretty.length; j++){
      var bytes = (j==1||j==2||j==5||j==6);
      var present = (j==1||j==2);
      trafficStats[i].pretty[j] = formatTrafficStat(trafficStats[i].pretty[j], bytes, present);
    }
  }
}

var trafficFormat = new Intl.NumberFormat("en", {maximumFractionDigits:1});
function formatTrafficStat(stat, bytes, present){
  var ret = trafficFormat.format(stat);
  if(bytes){
    if(stat > 1e12){
      ret = trafficFormat.format(stat/(1e9)) + " TB";
    }else if(stat > 1e9){
      ret = trafficFormat.format(stat/(1e9)) + " GB";
    }else if(stat > 1e6){
      ret = trafficFormat.format(stat/(1e6)) + " MB";
    }else if(stat > 1e3){
      ret = trafficFormat.format(stat/(1e3)) + " KB";
    }else{
      ret = Math.floor(stat) + " B";
    }
  }
  if(present){
    ret += "/s";
  }
  return ret;
}

function orderTrafficStatistics(col, update){
  if(col === trafficSortProperties.col){ //Change sorting type
    if(!update){
      if(trafficSortProperties.type == "ascend"){
        trafficSortProperties.type = "descend";
      }else{
        trafficSortProperties.type = "ascend";
      }
    }
  }else{
    trafficSortProperties.type = "descend";
    trafficHeaderRow.children[trafficSortProperties.col].removeAttribute("class");
  }
  trafficSortProperties.col = col;
  if(document.getElementById("traffic").firstChild){ //remove the table if it exists
    document.getElementById("traffic").removeChild(document.getElementById("traffic").firstChild);
  }
  if(col == 0){ //ip
    trafficStats.sort(function(a, b){
      var ret;
      a = a.raw[col].split(".").reduce((x, y) => parseInt(x,10) + parseInt(y,10));
      b = b.raw[col].split(".").reduce((x, y) => parseInt(x,10) + parseInt(y,10));
      ret = b - a;
      if(trafficSortProperties.type == "ascend") ret *= -1;
      return ret;
    });
  }else{
    trafficStats.sort(function(a, b){
      var ret;
      a = parseInt(a.raw[col-1], 10);
      b = parseInt(b.raw[col-1], 10);
      ret = b - a;
      if(trafficSortProperties.type == "ascend") ret *= -1;
      return ret;
    });
  }
  var table = document.createElement("table");
  table.appendChild(trafficHeaderRow);
  for(var i = 0; i < trafficStats.length; i++){
    var tr = document.createElement("tr");
    for(var j = 0; j < trafficStats[i].pretty.length; j++){
      var td = document.createElement("td");
      td.textContent = trafficStats[i].pretty[j];
      tr.appendChild(td);
      var ip = trafficStats[i].raw[0];
      if(j == 0){ //Handle hostname column
        if(trafficStats[i].throttle){
          td.textContent += " - throttled ("+trafficStats[i].throttle.timeout+")";
          tr.style.backgroundColor = "crimson";
        }
        var hostname = "";
        if(trafficStats[i].hostname){
          hostname = trafficStats[i].hostname.hostname;
        }
        var td = document.createElement("td");
        td.textContent = hostname;
        tr.appendChild(td);
      }
    }
    table.appendChild(tr);
  }
  document.getElementById("traffic").appendChild(table);
  if(trafficSortProperties.type == "ascend"){
    trafficHeaderRow.children[col].setAttribute("class","sortascend");
  }else{
    trafficHeaderRow.children[col].setAttribute("class","sortdescend");
  }
}
