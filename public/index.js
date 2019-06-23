window.onload = init;

const trafficHeaders = [
  'IP',
  'Hostname',
  'Down Speed',
  'Up Speed',
  'Pkt/s Down',
  'Pkt/s Up',
  'Total Downloaded',
  'Total Uploaded',
  'Total Packets Down',
  'Total Packets Up',
];

const trafficHeaderRow = document.createElement('tr');
for (let i = 0; i < trafficHeaders.length; i += 1) {
  const th = document.createElement('th');
  th.textContent = trafficHeaders[i];
  if (i !== 1) th.setAttribute('onclick', `orderTrafficStatistics(${i});`);
  trafficHeaderRow.appendChild(th);
}
trafficHeaderRow.setAttribute('id', 'trafficHeaderRow');
let trafficStats = [];
const trafficSortProperties = { type: 'descend', col: 2 };
let wirelessData = {};
let health = [];

function init() {
  document.getElementById('b_reset').onclick = resetModem;
  document.getElementById('b_critical').onclick = criticalMode;
  document.getElementById('b_groups').onclick = clearGroups;
  setInterval(update, 2000);
  update();
}

function update() {
  getWirelessStatus();
  getTrafficStatistics();
  getHealth();
}

let resetting = false;
function resetModem() {
  if (resetting) return;
  resetting = true;
  const request = new XMLHttpRequest();
  request.open('GET', '/api/reset', true);
  request.send();

  // Now the graphical stuff
  document.getElementById('controlinfo').textContent = 'Resetting...';
  document.getElementById('b_reset').setAttribute('disabled', 'disabled');
  const resetDelay = setTimeout(() => {
    resetting = false;
    document.getElementById('controlinfo').textContent = '';
    document.getElementById('b_reset').removeAttribute('disabled');
  }, 2000);
}

function criticalMode() {
  const request = new XMLHttpRequest();
  request.open('GET', '/api/critical', true);
  request.send();
  request.onload = function () {
    controlLogInfo('Critical mode activated.');
  };
}

function clearGroups() {
  const request = new XMLHttpRequest();
  request.open('GET', '/api/cleargroups', true);
  request.send();
  request.onload = function () {
    controlLogInfo('Groups cleared.');
  };
}
let controlTimer;
function controlLogInfo(text) {
  document.getElementById('controlinfo').textContent = text;
  clearTimeout(controlTimer);
  controlTimer = setTimeout(() => {
    document.getElementById('controlinfo').textContent = '';
  }, 3000);
}

function getWirelessStatus() {
  const request = new XMLHttpRequest();
  request.open('GET', '/api/wireless.json', true);
  request.onload = function () {
    if (request.status >= 200 && request.status < 400) {
      wirelessData = JSON.parse(request.responseText);
      setWirelessData();
    } else {
      request.onerror();
    }
  };
  request.onerror = function () {
    document.getElementById('diagnostics').textContent = 'Error loading wireless data';
  };
  request.send();
}
function getTrafficStatistics() {
  const request = new XMLHttpRequest();
  request.open('GET', '/api/traffic.json', true);
  request.onload = function () {
    if (request.status >= 200 && request.status < 400) {
      const data = JSON.parse(request.responseText);
      trafficStats = data.traffic;
      for (var i = 0; i < trafficStats.length; i++) {
        const obj = {};
        obj.hostname = data.clients.find(a => a.ip == trafficStats[i][0]);
        obj.throttle = data.throttled.find(a => a.ip == trafficStats[i][0]);
        obj.raw = trafficStats[i];
        obj.pretty = trafficStats[i].slice(0); // Need to make a clone
        trafficStats[i] = obj;
      }
      formatTrafficStatistics();
      orderTrafficStatistics(trafficSortProperties.col, true);
    } else {
      request.onerror();
    }
  };
  request.onerror = function () {
    document.getElementById('traffic').textContent = 'Error loading traffic data';
  };
  request.send();
}
function getHealth() {
  const request = new XMLHttpRequest();
  request.open('GET', '/api/health.json', true);
  request.onload = function () {
    if (request.status >= 200 && request.status < 400) {
      health = JSON.parse(request.responseText);
      setHealth();
    } else {
      request.onerror();
    }
  };
  request.onerror = function () {
    document.getElementById('health').textContent = 'Error loading health data';
  };
  request.send();
}
function setHealth() {
  if (document.getElementById('health').firstChild) { // remove the table if it exists
    document.getElementById('health').removeChild(document.getElementById('health').firstChild);
  }
  const table = document.createElement('table');
  for (let i = 0; i < health.length; i++) {
    const tr = document.createElement('tr');
    const label = document.createElement('td');
    const bubble = document.createElement('td');
    label.textContent = health[i].url;
    bubble.setAttribute('class', 'bubble');
    bubble.textContent = `${Math.floor(health[i].meanlatency).toString()}ms`;
    bubble.style.backgroundColor = calculateBubbleColor(health[i].health, health[i].maxHealth, Math.ceil(health[i].maxHealth / 2));

    tr.appendChild(label);
    tr.appendChild(bubble);
    table.appendChild(tr);
  }
  document.getElementById('health').appendChild(table);
}
function setWirelessData() {
  const data = wirelessData;
  document.getElementById('wireless_signal').textContent = data.wireless.signal;
  document.getElementById('wireless_signal').style.backgroundColor = calculateBubbleColor(100 + data.wireless.signal, 45, 25);

  document.getElementById('transfer_rate').textContent = `${Math.floor(data.wireless.rxrate)}/${Math.floor(data.wireless.txrate)}`;
  const total = parseInt(data.wireless.rxrate, 10) + parseInt(data.wireless.txrate, 10);
  document.getElementById('transfer_rate').style.backgroundColor = calculateBubbleColor(total, 144.444 * 2, 144.444);
}
function calculateBubbleColor(value, max, threshold) {
  let green = Math.floor(Math.min(Math.max(255 * value / max, 0), 255)).toString(16);
  if (green.length == 1) green = `0${green}`;
  let red = Math.floor(Math.min(Math.max(255 * (max - value) / threshold, 0), 255)).toString(16);
  if (red.length == 1) red = `0${red}`;

  return `#${red}${green}00`;
}
function formatTrafficStatistics() {
  for (let i = 0; i < trafficStats.length; i++) {
    // Convert values (where does 5 come from, wtf? Router designers lol)
    trafficStats[i].pretty[1] = trafficStats[i].pretty[1] / 5;
    trafficStats[i].pretty[2] = trafficStats[i].pretty[2] / 5;
    trafficStats[i].pretty[3] = Math.floor(trafficStats[i].pretty[3] / 5);
    trafficStats[i].pretty[4] = Math.floor(trafficStats[i].pretty[4] / 5);

    // Now we format numbers
    for (let j = 1; j < trafficStats[i].pretty.length; j++) {
      const bytes = (j == 1 || j == 2 || j == 5 || j == 6);
      const present = (j == 1 || j == 2);
      trafficStats[i].pretty[j] = formatTrafficStat(trafficStats[i].pretty[j], bytes, present);
    }
  }
}

const trafficFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });
function formatTrafficStat(stat, bytes, present) {
  let ret = trafficFormat.format(stat);
  if (bytes) {
    if (stat > 1e12) {
      ret = `${trafficFormat.format(stat / (1e9))} TB`;
    } else if (stat > 1e9) {
      ret = `${trafficFormat.format(stat / (1e9))} GB`;
    } else if (stat > 1e6) {
      ret = `${trafficFormat.format(stat / (1e6))} MB`;
    } else if (stat > 1e3) {
      ret = `${trafficFormat.format(stat / (1e3))} KB`;
    } else {
      ret = `${Math.floor(stat)} B`;
    }
  }
  if (present) {
    ret += '/s';
  }
  return ret;
}

function orderTrafficStatistics(col, update) {
  if (col === trafficSortProperties.col) { // Change sorting type
    if (!update) {
      if (trafficSortProperties.type == 'ascend') {
        trafficSortProperties.type = 'descend';
      } else {
        trafficSortProperties.type = 'ascend';
      }
    }
  } else {
    trafficSortProperties.type = 'descend';
    trafficHeaderRow.children[trafficSortProperties.col].removeAttribute('class');
  }
  trafficSortProperties.col = col;
  if (document.getElementById('traffic').firstChild) { // remove the table if it exists
    document.getElementById('traffic').removeChild(document.getElementById('traffic').firstChild);
  }
  if (col == 0) { // ip
    trafficStats.sort((a, b) => {
      let ret;
      a = a.raw[col].split('.').reduce((x, y) => parseInt(x, 10) + parseInt(y, 10));
      b = b.raw[col].split('.').reduce((x, y) => parseInt(x, 10) + parseInt(y, 10));
      ret = b - a;
      if (trafficSortProperties.type == 'ascend') ret *= -1;
      return ret;
    });
  } else {
    trafficStats.sort((a, b) => {
      let ret;
      a = parseInt(a.raw[col - 1], 10);
      b = parseInt(b.raw[col - 1], 10);
      ret = b - a;
      if (trafficSortProperties.type == 'ascend') ret *= -1;
      return ret;
    });
  }
  const table = document.createElement('table');
  table.appendChild(trafficHeaderRow);
  for (let i = 0; i < trafficStats.length; i++) {
    const tr = document.createElement('tr');
    for (let j = 0; j < trafficStats[i].pretty.length; j++) {
      var td = document.createElement('td');
      td.textContent = trafficStats[i].pretty[j];
      tr.appendChild(td);
      const ip = trafficStats[i].raw[0];
      if (j == 0) { // Handle hostname column
        if (trafficStats[i].throttle) {
          td.textContent += ` - throttled (${trafficStats[i].throttle.timeout})`;
          tr.style.backgroundColor = 'crimson';
        }
        let hostname = '';
        if (trafficStats[i].hostname) {
          hostname = trafficStats[i].hostname.hostname;
        }
        var td = document.createElement('td');
        td.textContent = hostname;
        tr.appendChild(td);
      }
    }
    table.appendChild(tr);
  }
  document.getElementById('traffic').appendChild(table);
  if (trafficSortProperties.type == 'ascend') {
    trafficHeaderRow.children[col].setAttribute('class', 'sortascend');
  } else {
    trafficHeaderRow.children[col].setAttribute('class', 'sortdescend');
  }
}
