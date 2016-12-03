var exports = module.exports;

var ping = require("ping");

var LATENCY_SAMPLES = 10;

function Host(url){
  this.url = url;
  this.health = 5;
  this.maxHealth = 5;
  var latency = [];
  this.calculateLatency = function(time){
    latency.push(time);
    if(latency.length > LATENCY_SAMPLES){
      latency.shift();
    }
    this.meanlatency = latency.reduce((a, b) => a + b) / latency.length;
  }
  this.meanlatency = 0;
}
var hosts = [new Host("8.8.8.8"), new Host("google.com"), new Host("192.168.0.1"), new Host("192.168.0.3")];

function check(){
  hosts.forEach(function(host){
    ping.promise.probe(host.url).then(function(res){
      if(res.alive){
        host.health++;
        host.calculateLatency(res.time);
      }else{
        host.health--;
        if(host.health <= 0) host.meanlatency = 0;
      }
      host.health = Math.min(Math.max(host.health,0),host.maxHealth);
    });
  });
}
setInterval(check, 1000);

exports.getResults = function(){
  return hosts;
}
