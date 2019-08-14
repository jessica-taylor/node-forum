var _ = require('underscore');

var common = require('./common');
var data = require('./data');

module.exports = function(db, templates, app) {
  var pageMod = require('./page')(db, templates, app);

  function register() {
    app.get('/newpost', (req, res) => {
      res.send(templates.newpost({}));
    });

    app.post('/newpost', (req, res) => {
      pageMod.findLoginUser(req, function(err, user) {
        if (err) {
          common.internalError(res, err); return;
        }
        let fields = _.clone(req.body);
        fields.owner = user.ID;
        data.createPost(db, fields, (err, id) => {
          if (err) {
            common.internalError(res, err);
          } else {
            console.log('id is', id);
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
      pageMod.findLoginUser(req, function(err, user) {
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
    app.get('/post/:postId', (req, res) => {
      let id = req.params.postId;
      pageMod.findLoginUser(req, function(err, loggedInUser) {
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
  }
  return {register: register};
};
