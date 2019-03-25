
var sqlite = require('sqlite3').verbose();

function getDatabase() {
  return new sqlite.Database('database.sqlite3');
}

let tables = {
  "User":  ["Name tinytext not null",
            "Description mediumtext not null",
            "CreationTime timestamp not null",
            "ID bigint not null primary key autoincrement"],
  "Post": ["Owner bigint not null",
            "Title tinytext not null",
            "Content mediumtext not null",
            "CreationTime timestamp not null",
            "ID bigint not null primary key autoincrement"],
  "Comment": ["Owner bigint not null",
              "Parent bigint not null",
              "Content mediumtext not null",
              "CreationTime timestamp not null",
              "ID bigint not null primary key autoincrement"]
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
    createUser: "insert into User (Name, Description, CreationTime) values (?, ?, ?)",
    createPost: "insert into Post (Owner, Title, Content, CreationTime) values (?, ?, ?, ?)",
    createComment: "insert into Comment (Owner, Parent, Content, CreationTime) values (?, ?, ?, ?)",
    lastID: "select last_insert_rowid()",
    lookupUser: "select * from User where ID = ?",
    lookupPost: "select * from Post where ID = ?",
    lookupComment: "select * from Comment where ID = ?",
    updateUser: "update User set Name = ?, Description = ? where ID = ?",
    updatePost: "update Post set Title = ?, Content = ? where ID = ?",
    updateComment: "update Comment set Parent = ?, Content = ? where ID = ?",
    deleteUser: "delete from User where ID = ?",
    deletePost: "delete from Post where ID = ?",
    deleteComment: "delete from Comment where ID = ?",
    latestPostsBefore: "select ID from Post where CreationTime < ? order by CreationTime desc",
    latestCommentsBefore: "select ID from Comment where CreationTime < ? order by CreationTime desc",
    latestPostsByUserBefore: "select ID from Post where CreationTime < ? and Owner = ? order by CreationTime desc",
    latestCommentsByUserBefore: "select ID from Comment where CreationTime < ? and Owner = ? order by CreationTime desc",
    commentsByParent: "select ID from Comment where Parent = ?"
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
    , "IxCommentParent on Comment (Parent)"
    , "IxUserCreationTime on User (CreationTime)"
    , "IxPostCreationTime on Post (CreationTime)"
    , "IxCommentCreationTime on Comment (CreationTime)"
    ];
  ixs.forEach(ix => {
    db.run('create unique index if not exists ' + ix);
  });
}

module.exports = {
  getDatabase: getDatabase,
  makeTables: makeTables,
  makeIndices: makeIndices,
  prepareStatements: prepareStatements
}
