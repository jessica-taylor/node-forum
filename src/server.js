var express = require('express');
var fs = require('fs');
var jade = require('jade');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var _ = require('underscore');

var common = require('./common');
var data = require('./data');


let db = data.getDatabase();
let templates = {};

let templatesDir = __dirname + '/../templates';
fs.readdirSync(templatesDir).forEach(fileName => {
  templates[fileName.replace('.jade', '')] =
    jade.compileFile(templatesDir + '/' + fileName, {});
});

let app = express();

app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
app.use(express.static(__dirname + '/../public'));

var pageMod = require('./page')(db, templates, app);
var postMod = require('./post')(db, templates, app);
postMod.register();
var commentMod = require('./comment')(db, templates, app);
commentMod.register();
var userMod = require('./user')(db, templates, app);
userMod.register();


app.get('/', (req, res) => {
  pageMod.findLoginUser(req, function(err, user) {
    if (err) {
      common.internalError(res, err); return;
    }
    data.latestPostsBefore(db, 9999999999999, (err, posts) => {
      if (err) {
        common.internalError(res, err); return;
      }
      res.send(templates.home({
        forumTitle: data.config.forumTitle || 'Forum',
        posts: posts,
        user: user}));
    });
  });
});



app.listen(4000, () => console.log('Express server running'));

// TODO:
//   - comment permalink
//   - big frontpage
//   - user profile posts and comments
//   - inbox
//   - pm
