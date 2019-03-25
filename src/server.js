var express = require('express');
var fs = require('fs');
var jade = require('jade');

var data = require('./data');

let templates = {};


fs.readdirSync('templates').forEach(fileName => {
  templates[fileName.replace('.jade', '')] =
    jade.compileFile('templates/' + fileName, {});
});

console.log(templates);
console.log(templates.home({}));

let app = express();
let db = data.getDatabase();
db.serialize(function() {
  data.makeTables(db);
  data.makeIndices(db);
  dbStatements = data.prepareStatements(db);
});

app.get('/', (req, res) => {
  let posts = [{title: 'a', id: 1}, {title: 'b', id: 2}];
  res.send(templates.home({posts: posts}));
});

let posts = {
  1: {
    title: 'a',
    content: 'a post'
  },
  2: {
    title: 'b',
    content: 'b post'
  }
};

app.get('/post/:postId', (req, res) => {
  let id = req.params.postId;
  let post = posts[id];
  if (post == undefined) {
    res.send('post not found');
  } else {
    let comments = [
      {content: 'top',
       children: [
         {content: 'child 1', children: []},
         {content: 'child 2', children: []}]},
      {content: 'bottom', children: []}
    ];
    res.send(templates.post({post: post, comments: comments}));
  }
});

app.listen(4000, () => console.log('Express server running'));
