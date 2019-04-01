var pandoc = require('node-pandoc');

let salt = '0rXKWHc3YoO3wrTUknuc';

function hashPassword(pass) {
  return crypto.createHmac('sha256', salt).update(pass).digest('buffer');
}

function asyncMap(xs, f, callback) {
  if (xs.length == 0) {
    callback(null, []);
    return;
  }
  var returned = false;
  var results = [];
  var nResults = 0;
  xs.forEach((x, i) => {
    results.push(null);
    f(x, (err, res) => {
      if (returned) return;
      if (err) {
        returned = true;
        callback(err);
      } else if (results[i] == null) {
        results[i] = [res];
        nResults += 1;
        if (nResults == xs.length) {
          returned = true;
          callback(null, results.map(r => r[0]));
        }
      }
    });
  });
}

function mdTexToHTML(mdtex, callback) {
  pandoc(mdtex, '-f markdown -t html --mathjax', callback);
}

function internalError(res, err) {
  res.status(500);
  res.send('internal error: ' + err);
}


module.exports = {
  hashPassword: hashPassword,
  asyncMap: asyncMap,
  mdTexToHTML: mdTexToHTML,
  internalError: internalError
}
