var express = require('express');
var fs = require('fs');
var jade = require('jade');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var _ = require('underscore');
var uuidv5 = require('uuid/v5');

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

let app = express();
let db = data.getDatabase();

function findLoginUser(req, cont) {
  if (req.cookies.loginToken) {
    db.statements.lookupUser.get(req.cookies.userID, function(err, user) {
      if (err) {
        cont(err);
      } else if (user == null || user.LoginToken != req.cookies.loginToken) {
        cont(null, null);
      } else {
        cont(null, user);
      }
    });
  } else {
    cont(null, null);
  }
}

function doLogin(res, user, cont) {
  let token = uuidv5('jessic.at', uuidv5.DNS);
  db.statements.setLoginToken.run(token, Date.now(), user.ID, function(err) {
    if (err) {
      cont(err);
    } else {
      res.cookie('userID', user.ID);
      res.cookie('loginToken', token);
      cont(null);
    }
  });
}

app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
app.use(express.static('public'));

app.get('/', (req, res) => {
  findLoginUser(req, function(err, user) {
    if (err) {
      internalError(res, err);
    } else {
      data.latestPostsBefore(db, 9999999999999, (err, posts) => {
        if (err) {
          internalError(res, err);
        } else {
          res.send(templates.home({posts: posts, user: user}));
        }
      });
    }
  });
});

app.get('/login', (req, res) => {
  res.send(templates.login({}));
});

app.post('/login', (req, res) => {
  let fields = _.clone(req.body);
  db.statements.lookupUserByEmail.get(fields.email, function(err, user) {
    if (err) {
      internalError(res, err);
    } else if (user == null) {
      res.send('user with that email not found');
    } else if (!data.hashPassword(fields.password).equals(user.PasswordHash)) {
      console.log('passhash: ', user.PasswordHash, data.hashPassword(fields.password));
      res.send('wrong password');
    } else {
      doLogin(res, user, function(err) {
        if (err) {
          internalError(res, err);
        } else {
          res.redirect('/');
        }
      });
    }
  });
});

app.get('/signout', (req, res) => {
  findLoginUser(req, function(err, user) {
    if (err) {
      internalError(res, err);
    } else if (user == null) {
      res.send('not logged in');
    } else {
      res.clearCookie('userID');
      res.clearCookie('loginToken');
      res.redirect('/');
    }
  });
});

app.get('/newpost', (req, res) => {
  res.send(templates.newpost({}));
});

app.post('/newpost', (req, res) => {
  findLoginUser(req, function(err, user) {
    if (err) {
      internalError(res, err);
    } else {
      let fields = _.clone(req.body);
      fields.owner = user.ID;
      data.createPost(db, fields, (err, id) => {
        if (err) {
          internalError(res, err);
        } else {
          res.redirect('/post/' + id);
        }
      });
    }
  });
});

app.get('/newuser', (req, res) => {
  res.send(templates.newuser({errors: []}));
});

app.post('/newuser', (req, res) => {
  let fields = _.clone(req.body);
  fields.name = fields.name.trim();
  fields.email = fields.email.trim();
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
      db.statements.lookupUserByName.get(fields.name, function(err, existing2) {
        if (err) {
          internalError(res, err);
        } else {
          if (existing2 != null) {
            errs.push("Name already taken");
          }
          if (errs.length > 0) {
            res.send(templates.newuser({errors: errs}));
          } else {
            fields.description = 'No description yet';
            data.createUser(db, fields, function(err, uid) {
              if (err) {
                internalError(res, err);
              } else {
                res.send(templates.newuser2({uid: uid}));
              }
            });
          }
        }
      });
    }
  });
});

app.post('/newcomment', (req, res) => {
  findLoginUser(req, function(err, user) {
    if (err) {
      internalError(res, err);
    } else if (user == null) {
      res.send('user not found');
    } else {
      let fields = _.clone(req.body);
      console.log('fields', fields);
      fields.owner = user.ID;
      data.createComment(db, fields, (err, id) => {
        if (err) {
          internalError(res, err);
        } else {
          res.redirect('/post/' + fields.post);
        }
      });
    }
  });
});

app.get('/user/:userId', (req, res) => {
  let id = req.params.userId;
  db.statements.lookupUser.get(id, (err, user) => {
    if (err) {
      internalError(res, err);
    } else if (user == undefined) {
      res.send('user not found');
    } else {
      res.send(templates.user({user: user}));
    }
  });
});

app.get('/allusers', (req, res) => {
  db.statements.allUsers.all((err, users) => {
    if (err) {
      internalError(err);
    } else {
      res.send(templates.allusers({users: users}));
    }
  });
});


app.get('/post/:postId', (req, res) => {
  let id = req.params.postId;
  data.lookupPost(db, id, (err, post) => {
    if (err) {
      internalError(res, err);
    } else if (post == undefined) {
      res.send('post not found');
    } else {
      db.statements.lookupUser.get(post.Owner, function(err, owner)  {
        if (err) {
          internalError(res, err);
        } else {
          db.statements.commentsByPost.all(post.ID, function(err, comments) {
            if (err) {
              internalError(res, err);
            } else {
              let toplevel = [];
              for (var i = 0; i < comments.length; ++i) {
                comments[i].Children = [];
                var foundParent = false;
                for (var j = 0; j < i; ++j) {
                  if (comments[j].ID == comments[i].Parent) {
                    comments[j].Children.push(comments[i]);
                    foundParent = true;
                    break;
                  }
                }
                if (!foundParent) {
                  toplevel.push(comments[i]);
                }
              }
              // let comments = [
              //   {Content: 'top',
              //    Children: [
              //      {Content: 'child 1', Children: []},
              //      {Content: 'child 2', Children: []}]},
              //   {Content: 'bottom', Children: []}
              // ];
              res.send(templates.post({post: post, owner: owner, comments: comments}));
            }
          });
        }
      });
    }
  });
});

app.listen(4000, () => console.log('Express server running'));
