
var common = require('./common');
var data = require('./data');

module.exports = function(db, templates, app) {
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
  return {
    findLoginUser: findLoginUser,
    doLogin: doLogin
  };
};
