window.onload = function(){
  //Do the things
  getWirelessStatus();
  getTrafficStatistics();
}

function getWirelessStatus(){
  var request = new XMLHttpRequest();
  request.open("GET", "/api/wireless.json", true);
  request.onload = function() {
    if (request.status >= 200 && request.status < 400) {
      var data = JSON.parse(request.responseText);
      console.log(data);
      document.getElementById("wireless_signal").textContent = data.wireless.signal;
      //Coloring the box
      var red = Math.floor(Math.min(Math.max(255*((55+parseInt(data.wireless.signal,10))/(-45)),0),255)).toString(16);
      if(red.length==1) red = "0" + red;
      var green = Math.floor(Math.min(Math.max(255*((100+parseInt(data.wireless.signal,10))/(45)),0),255)).toString(16);
      if(green.length==1) red = "0" + green;
      document.getElementById("wireless_signal").style.backgroundColor = "#" + red + green + "00";

      document.getElementById("transfer_rate").textContent = data.wireless.rxrate + "/" + data.wireless.txrate;
      //Coloring the box
      var total = parseInt(data.wireless.rxrate,10) + parseInt(data.wireless.txrate,10);
      var red = Math.floor(Math.min(Math.max(255*((600-total)/(300)),0),255)).toString(16);
      if(red.length==1) red = "0" + red;
      var green = Math.floor(Math.min(Math.max(255*((total-300)/300),0),255)).toString(16);
      if(green.length==1) red = "0" + green;
      document.getElementById("transfer_rate").style.backgroundColor = "#" + red + green + "00";
    } else {
      document.getElementById("wireless_signal").textContent = "Error loading data";
    }
  };
  request.onerror = function() {
    // There was a connection error of some sort
  };
  request.send();
}

function getTrafficStatistics(){
  var request = new XMLHttpRequest();
  request.open("GET", "/api/traffic.json", true);
  request.onload = function() {
    if (request.status >= 200 && request.status < 400) {
      var data = JSON.parse(request.responseText);
    } else {
      //failed to load
    }
  };
  request.onerror = function() {
    // There was a connection error of some sort
  };
  request.send();
}
