window.onload = function(){
  //Do the things
  setInterval(update, 2000);
  update();
}

var trafficHeaders = [
  "IP",
  "Down Speed",
  "Up Speed",
  "Pkt/s Down",
  "Pkt/s Up",
  "Total Bytes Down",
  "Total Bytes Up",
  "Total Packets Down",
  "Total Packets Up",
]

var trafficHeaderRow = document.createElement("tr");
for(var i = 0; i < trafficHeaders.length; i++){
  var th = document.createElement("th");
  th.textContent = trafficHeaders[i];
  th.setAttribute("onclick", "orderTrafficStatistics("+i+");")
  trafficHeaderRow.appendChild(th);
}
trafficHeaderRow.setAttribute("id","trafficHeaderRow");
var trafficStats = [];
var trafficSortProperties = {type:"descend", col:1};
var wirelessData = {};
var health = [];

function update(){
  getWirelessStatus();
  getTrafficStatistics();
  getHealth();
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
      trafficStats = JSON.parse(request.responseText);
      for(var i = 0; i < trafficStats.length; i++){
        var obj = {};
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
    //B/s KiB/s, MB/s, GB/s
    if(stat > 1000 * 1000 * 1000){ //I wish
      ret = trafficFormat.format(stat/(1000*1000*1000)) + " GB";
    }else if(stat > 1000 * 1000){
      ret = trafficFormat.format(stat/(1000*1000)) + " MB";
    }else if(stat > 1000){
      ret = trafficFormat.format(stat/(1000)) + " KB";
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
  if(col==0){ //ip
    trafficStats.sort(function(a, b){
      var ret = 0;
      a = a.raw[col].split(".").reduce((x, y) => parseInt(x,10) + parseInt(y,10));
      b = b.raw[col].split(".").reduce((x, y) => parseInt(x,10) + parseInt(y,10));
      ret = b - a;
      if(trafficSortProperties.type == "ascend") ret *= -1;
      return ret;
    });
  }else{
    trafficStats.sort(function(a, b){
      var ret = 0;
      a = parseInt(a.raw[col], 10);
      b = parseInt(b.raw[col], 10);
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
