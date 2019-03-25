
var sqlite = require('sqlite3').verbose();

function getDatabase() {
  return new sqlite.Database(':memory:');
}

function makeTables(db) {
  let tables = {
    "User":  ["Name tinytext not null",
              "Description mediumtext not null",
              "CreationTime timestamp not null",
              "ID bigint not null primary key"],
    "Post": ["Owner bigint not null",
              "Title tinytext not null",
              "Content mediumtext not null",
              "CreationTime timestamp not null",
              "ID bigint not null primary key"],
    "Comment": ["Owner bigint not null",
                "Parent bigint not null",
                "Content mediumtext not null",
                "CreationTime timestamp not null",
                "ID bigint not null primary key"]
  };
  for (let tableName in tables) {
    db.run('create table ' + tableName + ' (' + tables[tableName].join(', ') + ')');
  }
}

function prepareStatements(db) {
  let newId = "(@ids := ifnull(@ids, 0) + 1)";
  let stmts = {
    createUser: "insert into User (Name, Description, CreationTime, ID, values (?, ?, ?, " + newId + ",",
    createPost: "insert into Post (Owner, Title, Content, CreationTime, ID, values (?, ?, ?, ?, " + newId + ",",
    createComment: "insert into Comment (Owner, Parent, Content, CreationTime, ID, values (?, ?, ?, ?, " + newId + ",",
    lastUserID: "select max(ID, from User",
    lastPostID: "select max(ID, from Post",
    lastCommentID: "select max(ID, from Comment",
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
    [ "create unique index IxUserId on User (ID)"
    , "create unique index IxPostId on Post (ID)"
    , "create unique index IxCommentId on Comment (ID)"
    , "create unique index IxCommentParent on Comment (Parent)"
    , "create unique index IxUserCreationTime on User (CreationTime)"
    , "create unique index IxPostCreationTime on Post (CreationTime)"
    , "create unique index IxCommentCreationTime on Comment (CreationTime)"
    ];
  ixs.forEach(ix => db.run(ix));
}

module.exports = {
  getDatabase: getDatabase,
  makeTables: makeTables,
  makeIndices: makeIndices,
  prepareStatements: prepareStatements
}
