const exports = module.exports;

exports.log = function (text) {
  console.log(`${new Date().toLocaleString()} ${text}`);
};
