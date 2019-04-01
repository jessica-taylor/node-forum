var _ = require('underscore');

var common = require('./common');
var data = require('./data');

module.exports = function(db, templates, app) {
  var pageMod = require('./page')(db, templates, app);
  function register() {
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
              pageMod.doLogin(res, {ID: uid}, function(err) {
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
        } else if (!data.hashPassword(fields.password).equals(user.PasswordHash)) {
          res.send('wrong password');
        } else {
          pageMod.doLogin(res, user, function(err) {
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
      pageMod.findLoginUser(req, function(err, user) {
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



    app.get('/edituser', (req, res) => {
      pageMod.findLoginUser(req, function(err, user) {
        if (err) {
          common.internalError(res, err); return;
        }
        res.send(templates.edituser({user: user}));
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
          pageMod.findLoginUser(req, function(err, login) {
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
  }
  return {register: register};
};
