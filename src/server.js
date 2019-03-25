var express = require('express');

var data = require('./data');


var app = express();

app.get('/', (req, res) => {
  res.send('Hello, world!');
});

app.listen(4000, () => console.log('Express server running'));
