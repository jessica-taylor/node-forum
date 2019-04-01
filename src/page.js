
var common = require('./common');
var data = require('./data');
var uuidv5 = require('uuid/v5');

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

  function getUUID() {
    return uuidv5('jessic.at', uuidv5.DNS);
  }

  function doLogin(res, user, cont) {
    let token = getUUID();
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
    getUUID: getUUID,
    findLoginUser: findLoginUser,
    doLogin: doLogin
  };
};
