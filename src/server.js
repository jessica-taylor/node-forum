var express = require('express');
var fs = require('fs');
var jade = require('jade');
var bodyParser = require('body-parser');
var _ = require('underscore');

var data = require('./data');

let templates = {};

function internalError(res, err) {
  res.status(500);
  res.send('internal error: ' + err);
}


fs.readdirSync('templates').forEach(fileName => {
  templates[fileName.replace('.jade', '')] =
    jade.compileFile('templates/' + fileName, {});
});

console.log(templates);
console.log(templates.home({}));

let app = express();
let db = data.getDatabase();

app.use(bodyParser.urlencoded({extended: true}));

app.get('/', (req, res) => {
  data.latestPostsBefore(db, 9999999999999, (err, posts) => {
    if (err) {
      internalError(res, err);
    } else {
      res.send(templates.home({posts: posts}));

    }
  });
});

app.get('/newpost', (req, res) => {
  res.send(templates.newpost({}));
});

app.post('/newpost', (req, res) => {
  let fields = _.clone(req.body);
  fields.owner = 0;
  data.createPost(db, fields, (err, id) => {
    if (err) {
      internalError(res, err);
    } else {
      res.redirect('/post/' + id);
    }
  });
});

app.get('/newuser', (req, res) => {
  res.send(templates.newuser({errors: []}));
});

app.post('/newuser', (req, res) => {
  let fields = _.clone(req.body);
  let errs = [];
  if (fields.password != fields.password2) {
    errs.push("Passwords don't match");
  }
  if (fields.password.length < 10) {
    errs.push("Password must be at least 10 characters");
  }
  if (fields.name.length < 1) {
    errs.push("Name must not be empty");
  }
  console.log('got here');
  db.statements.lookupUserByEmail.get(fields.email, function(err, existing) {
    if (err) {
      internalError(res, err);
    } else {
      if (existing != null) {
        errs.push("Email already taken");
      }
      if (errs.length > 0) {
        res.send(templates.newuser({errors: errs}));
      } else {
        fields.description = 'No description yet';
        data.createUser(db, fields, function(err, uid) {
          if (err) {
            internalError(res, err);
          } else {
            res.redirect('/newuser2');
          }
        });
      }
    }
  });
});

app.get('/newuser2', (req, res) => {
  res.send(templates.newuser2({}));
});


app.get('/post/:postId', (req, res) => {
  let id = req.params.postId;
  data.lookupPost(db, id, (err, post) => {
    if (err) {
      internalError(res, err);
    } else if (post == undefined) {
      res.send('post not found');
    } else {
      let comments = [
        {Content: 'top',
         Children: [
           {Content: 'child 1', Children: []},
           {Content: 'child 2', Children: []}]},
        {Content: 'bottom', Children: []}
      ];
      res.send(templates.post({post: post, comments: comments}));
    }
  });
});

app.listen(4000, () => console.log('Express server running'));
