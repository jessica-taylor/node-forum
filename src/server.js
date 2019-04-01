var express = require('express');
var fs = require('fs');
var jade = require('jade');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var _ = require('underscore');
var uuidv5 = require('uuid/v5');

var common = require('./common');
var data = require('./data');


let templates = {};

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
      cont(err); return;
    }
    res.cookie('userID', user.ID);
    res.cookie('loginToken', token);
    cont(null);
  });
}

app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
app.use(express.static('public'));

app.get('/', (req, res) => {
  findLoginUser(req, function(err, user) {
    if (err) {
      common.internalError(res, err); return;
    }
    data.latestPostsBefore(db, 9999999999999, (err, posts) => {
      if (err) {
        common.internalError(res, err); return;
      }
      res.send(templates.home({posts: posts, user: user}));
    });
  });
});

app.get('/login', (req, res) => {
  res.send(templates.login({}));
});

app.post('/login', (req, res) => {
  let fields = _.clone(req.body);
  fields.name = fields.name.trim();
  db.statements.lookupUserByName.get(fields.name, function(err, user) {
    if (err) {
      common.internalError(res, err);
    } else if (user == null) {
      res.send('user with that name not found');
    } else if (!common.hashPassword(fields.password).equals(user.PasswordHash)) {
      res.send('wrong password');
    } else {
      doLogin(res, user, function(err) {
        if (err) {
          common.internalError(res, err);
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
      common.internalError(res, err);
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
      common.internalError(res, err); return;
    }
    let fields = _.clone(req.body);
    fields.owner = user.ID;
    data.createPost(db, fields, (err, id) => {
      if (err) {
        common.internalError(res, err);
      } else {
        res.redirect('/post/' + id);
      }
    });
  });
});

app.get('/editpost/:postId', (req, res) => {
  let id = req.params.postId;
  data.lookupPost(db, id, (err, post) => {
    if (err) {
      common.internalError(res, err);
    } else if (post == null) {
      res.send('post not found');
    } else {
      res.send(templates.editpost({post: post}));
    }
  });
});

app.post('/editpost/:postId', (req, res) => {
  let id = req.params.postId;
  findLoginUser(req, function(err, user) {
    if (err) {
      common.internalError(res, err); return;
    }
    data.lookupPost(db, id, (err, post) => {
      if (err) {
        common.internalError(res, err);
      } else if (post == null) {
        res.send('post not found');
      } else if (post.Owner != user.ID) {
        res.send("you don't own that post");
      } else {
        let fields = _.clone(req.body);
        db.statements.updatePost.run(fields.title, fields.content, id, err => {
          if (err) {
            common.internalError(res, err);
          } else {
            res.redirect('/post/' + id);
          }
        });
      }
    });
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
  if (!/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(fields.email)) {
    errs.push("Invalid email address");
  }
  if (fields.name.length < 1) {
    errs.push("Name must not be empty");
  }
  for (var i = 0; i < fields.name.length; ++i) {
    if (fields.name.charCodeAt(i) < 128 && !/[-a-zA-Z0-9_ ]/.test(fields.name[i])) {
      errs.push("Name must consist of alphanumeric characters, -, _, or space.");
      break;
    }
  }
  for (var i = 0; i < fields.name.length - 1; ++i) {
    if (fields.name[i] == ' ' && fields.name[i+1] == ' ') {
      errs.push("Name must not have two spaces in a row.");
      break;
    }
  }
  db.statements.lookupUserByEmail.get(fields.email, function(err, existing) {
    if (err) {
      common.internalError(res, err); return;
    }
    if (existing != null) {
      errs.push("Email already taken");
    }
    db.statements.lookupUserByName.get(fields.name, function(err, existing2) {
      if (err) {
        common.internalError(res, err); return;
      }
      if (existing2 != null) {
        errs.push("Name already taken");
      }
      if (errs.length > 0) {
        res.send(templates.newuser({errors: errs}));
      } else {
        fields.description = 'No description yet';
        data.createUser(db, fields, function(err, uid) {
          if (err) {
            common.internalError(res, err); return;
          }
          doLogin(res, {ID: uid}, function(err) {
            if (err) {
              common.internalError(res, err); return;
            }
            res.send(templates.newuser2({uid: uid}));
          });
        });
      }
    });
  });
});

app.get('/edituser', (req, res) => {
  findLoginUser(req, function(err, user) {
    if (err) {
      common.internalError(res, err); return;
    }
    res.send(templates.edituser({user: user}));
  });
});

app.post('/newcomment', (req, res) => {
  findLoginUser(req, function(err, user) {
    if (err) {
      common.internalError(res, err);
    } else if (user == null) {
      res.send('user not found');
    } else {
      let fields = _.clone(req.body);
      fields.owner = user.ID;
      data.createComment(db, fields, (err, id) => {
        if (err) {
          common.internalError(res, err);
        } else {
          res.redirect('/post/' + fields.post);
        }
      });
    }
  });
});

app.get('/editcomment/:commentId', (req, res) => {
  let id = req.params.commentId;
  data.lookupComment(db, id, (err, comment) => {
    if (err) {
      common.internalError(res, err);
    } else if (comment == null) {
      res.send('comment not found');
    } else {
      res.send(templates.editcomment({comment: comment}));
    }
  });
});

app.post('/editcomment/:commentId', (req, res) => {
  let id = req.params.commentId;
  findLoginUser(req, function(err, user) {
    if (err) {
      common.internalError(res, err); return;
    }
    data.lookupComment(db, id, (err, comment) => {
      if (err) {
        common.internalError(res, err);
      } else if (comment == null) {
        res.send('comment not found');
      } else if (comment.Owner != user.ID) {
        res.send("you don't own that comment");
      } else {
        let fields = _.clone(req.body);
        db.statements.updateComment.run(fields.content, id, err => {
          if (err) {
            common.internalError(res, err); return;
          }
        });
      }
    });
  });
});

app.get('/user/:userId', (req, res) => {
  let id = req.params.userId;
  db.statements.lookupUser.get(id, (err, user) => {
    if (err) {
      common.internalError(res, err);
    } else if (user == undefined) {
      res.send('user not found');
    } else {
      findLoginUser(req, function(err, login) {
        if (err) {
          common.internalError(res, err); return;
        }
        common.mdTexToHTML(user.Description, (err, desc) => {
          if (err) {
            common.internalError(res, err); return;
          }
          user.Description = desc;
          res.send(templates.user({user: user, login: login}));
        })
      });
    }
  });
});

app.get('/allusers', (req, res) => {
  db.statements.allUsers.all((err, users) => {
    if (err) {
      common.internalError(err); return;
    }
    res.send(templates.allusers({users: users}));
  });
});


app.get('/post/:postId', (req, res) => {
  let id = req.params.postId;
  findLoginUser(req, function(err, loggedInUser) {
    if (err) {
      common.internalError(res, err); return;
    }
    data.lookupPost(db, id, (err, post) => {
      if (err) {
        common.internalError(res, err);
      } else if (post == undefined) {
        res.send('post not found');
      } else {
        db.statements.lookupUser.get(post.Owner, function(err, owner)  {
          if (err) {
            common.internalError(res, err); return;
          }
          db.statements.commentsByPost.all(post.ID, function(err, comments) {
            if (err) {
              common.internalError(res, err); return;
            }
            let toConvertMarkdown = _.clone(comments);
            toConvertMarkdown.push(post);
            common.asyncMap(toConvertMarkdown, (obj, cb) => {
              common.mdTexToHTML(obj.Content, (err, res) => {
                if (err) {
                  cb(err);
                } else {
                  obj.Content = res;
                  cb(null, null);
                }
              });
            }, function(err) {
              if (err) {
                common.internalError(res, err); return;
              }
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
              res.send(templates.post({
                post: post,
                owner: owner,
                user: loggedInUser,
                comments: toplevel
              }));
            });
          });
        });
      }
    });
  });
});

app.listen(4000, () => console.log('Express server running'));

// TODO:
//   - comment permalink
//   - reset password
//   - change password
//   - change description
//   - change name
//   - big frontpage
