var _ = require('underscore');

var common = require('./common');
var data = require('./data');

module.exports = function(db, templates, app) {
  var pageMod = require('./page')(db, templates, app);

  function register() {
    app.post('/newcomment', (req, res) => {
      pageMod.findLoginUser(req, function(err, user) {
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
      pageMod.findLoginUser(req, function(err, user) {
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
              res.redirect('/post/' + comment.Post);
            });
          }
        });
      });
    });
  }
  return {register: register};
};

