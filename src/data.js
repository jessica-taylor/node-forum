var crypto = require('crypto');
var sqlite = require('sqlite3').verbose();
var util = require('util');

var common = require('./common');

let salt = '0rXKWHc3YoO3wrTUknuc';

function hashPassword(pass) {
  return crypto.createHmac('sha256', salt).update(pass).digest('buffer');
}

function getDatabase() {
  let db = new sqlite.Database('database.sqlite3');
  db.serialize(() => {
    makeTables(db);
    makeIndices(db);
    db.statements = prepareStatements(db);
  });
  return db;
}

let tables = {
  "User":  ["Name tinytext not null",
            "Description mediumtext not null",
            "CreationTime integer not null",
            "ID integer not null primary key autoincrement",
            "Email tinytext not null",
            "PasswordHash blob not null",
            "EmailConfirmed boolean not null",
            "LoginToken tinytext",
            "LoginTokenTime integer",
            "ResetPasswordToken tinytext",
            "ResetPasswordTokenTime integer"],
  "Post": ["Owner integer not null",
           "Title tinytext not null",
           "Content mediumtext not null",
           "CreationTime integer not null",
           "ID integer not null primary key autoincrement"],
  "Comment": ["Owner integer not null",
              "Post integer not null",
              "Parent integer",
              "Content mediumtext not null",
              "CreationTime integer not null",
              "ID integer not null primary key autoincrement"]
};

function dropTables(db) {
  for (let tableName in tables) {
    db.run('drop table ' + tableName);
  }
}

function makeTables(db) {
  for (let tableName in tables) {
    db.run('create table if not exists ' + tableName + ' (' + tables[tableName].join(', ') + ')');
  }
}

function prepareStatements(db) {
  let stmts = {
    createUser: "insert into User (Name, Description, CreationTime, Email, PasswordHash, EmailConfirmed) values (?, ?, ?, ?, ?, ?)",
    createPost: "insert into Post (Owner, Title, Content, CreationTime) values (?, ?, ?, ?)",
    createComment: "insert into Comment (Owner, Post, Parent, Content, CreationTime) values (?, ?, ?, ?, ?)",
    lastID: "select last_insert_rowid()",
    lookupUser: "select * from User where ID = ?",
    lookupUserByEmail: "select * from User where Email = ?",
    lookupUserByName: "select * from User where Name = ?",
    lookupPost: "select * from Post where ID = ?",
    lookupComment: "select Comment.*, User.Name from Comment inner join User on Comment.Owner = User.ID where Comment.ID = ?",
    updateUser: "update User set Name = ?, Description = ?, Email = ?, PasswordHash = ? where ID = ?",
    setPassword: "update User set PasswordHash = ? where ID = ?",
    setLoginToken: "update User set LoginToken = ?, LoginTokenTime = ? where ID = ?",
    setResetPasswordToken: "update User set ResetPasswordToken = ?, ResetPasswordTokenTime = ? where ID = ?",
    updatePost: "update Post set Title = ?, Content = ? where ID = ?",
    updateComment: "update Comment set Content = ? where ID = ?",
    deleteUser: "delete from User where ID = ?",
    deletePost: "delete from Post where ID = ?",
    deleteComment: "delete from Comment where ID = ?",
    latestPostsBefore: "select Post.ID, Post.Title, Post.Owner, Post.CreationTime, User.Name from Post inner join User on Post.Owner = User.Id where Post.CreationTime < ? order by Post.CreationTime desc",
    latestCommentsBefore: "select * from Comment where CreationTime < ? order by CreationTime desc",
    latestPostsByUserBefore: "select ID, Title, CreationTime from Post where CreationTime < ? and Owner = ? order by CreationTime desc",
    latestCommentsByUserBefore: "select ID, Content from Comment where CreationTime < ? and Owner = ? order by CreationTime desc",
    commentsByPost: "select Comment.*, User.Name from Comment inner join User on Comment.Owner = User.Id where Post = ? order by CreationTime asc",
    allUsers: "select ID, Name from User"
  };
  let prepared = {};
  for (let k in stmts) {
    prepared[k] = db.prepare(stmts[k]);
  }
  return prepared;
}

function makeIndices(db) {
  let ixs =
    [ "IxUserId on User (ID)"
    , "IxPostId on Post (ID)"
    , "IxCommentId on Comment (ID)"
    , "IxUserCreationTime on User (CreationTime)"
    , "IxPostCreationTime on Post (CreationTime)"
    , "IxCommentCreationTime on Comment (CreationTime)"
    ];
  ixs.forEach(ix => {
    db.serialize(() => {
      db.run('create unique index if not exists ' + ix);
    });
  });
}

function createUser(db, fields, cb) {
  db.serialize(() => {
    db.statements.createUser.run(fields.name, fields.description, Date.now(), fields.email, hashPassword(fields.password), true, err => {
      if (err) {
        cb(err, null);
      } else {
        db.statements.lastID.get((err, id) => {
          cb(err, id && id['last_insert_rowid()']);
        });
      }
    });
  });
}

function updateUser(db, id, fields, cb) {
  db.statements.updateUser.run(fields.name, fields.description, fields.email, fields.passwordHash, id, cb);
};

function createPost(db, fields, cb) {
  db.serialize(() => {
    db.statements.createPost.run(fields.owner, fields.title, fields.content, Date.now(), err => {
      if (err) {
        cb(err, null);
      } else {
        db.statements.lastID.get((err, id) => {
          cb(err, id && id['last_insert_rowid()']);
        });
      }
    });
  });
}

function createComment(db, fields, cb) {
  db.serialize(() => {
    db.statements.createComment.run(fields.owner, fields.post, fields.parent, fields.content, Date.now(), err => {
      if (err) {
        cb(err, null);
      } else {
        db.statements.lastID.get((err, id) => {
          cb(err, id && id['last_insert_rowid()']);
        });
      }
    });
  });
}


function lookupPost(db, id, cb) {
  db.statements.lookupPost.get(id, (err, row) => {
    if (err) {
      cb(err);
    } else {
      cb(null, row);
    }
  });
}

function lookupComment(db, id, cb) {
  db.statements.lookupComment.get(id, (err, row) => {
    if (err) {
      cb(err);
    } else {
      cb(null, row);
    }
  });
}

function latestPostsBefore(db, time, cb) {
  db.statements.latestPostsBefore.all(time, (err, rows) => {
    if (err) {
      cb(err);
    } else {
      cb(null, rows);
    }
  });
}

module.exports = {
  getDatabase: getDatabase,
  hashPassword: hashPassword,
  createUser: createUser,
  updateUser: updateUser,
  createPost: createPost,
  createComment: createComment,
  lookupPost: lookupPost,
  lookupComment: lookupComment,
  latestPostsBefore: latestPostsBefore
}
