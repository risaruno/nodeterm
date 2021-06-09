var fs = require("fs");
var ejs = require("ejs");
var mysql = require("mysql");
var express = require("express");
var session = require("express-session");
var path = require("path");
var multipart = require("connect-multiparty");
var bodyParser = require("body-parser");

var client = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root",
  database: "social",
  port: "3306",
});
var multiclient = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root",
  database: "social",
  port: "3306",
  multipleStatements: true,
});

var folder = "/upload";

var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(multipart({ uploadDir: __dirname + folder }));
app.use("/upload", express.static(path.join(__dirname + folder)));
app.use("/css", express.static(path.join(__dirname + "/css")));
app.use("/html", express.static(path.join(__dirname + "/html")));
app.use(
  session({
    secret: "secret key",
    resave: false,
    saveUninitialized: true,
  })
);

app.get("/", function (req, res) {
  if (req.session.user) {
    res.redirect("/dashboard");
  } else {
    fs.readFile("./html/login.html", "utf8", function (err, html) {
      res.send(ejs.render(html));
    });
  }
});

app.post("/", function (req, res) {
  var body = req.body;
  client.query(
    "SELECT * FROM user WHERE username=?",
    [body.username],
    function (err, results) {
      if (err) {
        throw err;
      } else {
        var uid = results[0].uid;
        var username = results[0].username;
        var password = results[0].password;
        if (body.password == password) {
          req.session.user = {
            id: uid,
            username: username,
          };
          res.redirect("/dashboard");
        } else {
          res.end("Wrong Password");
        }
      }
    }
  );
});

app.get("/dashboard", function (req, res) {
  if (req.session.user) {
    fs.readFile("./html/dashboard.html", "utf8", function (err, html) {
      client.query(
        "SELECT * FROM post, user WHERE uid = id_user ORDER BY id DESC",
        function (err, results) {
          if (err) {
            throw err;
          } else {
            res.send(
              ejs.render(html, { data: results, session: req.session.user })
            );
          }
        }
      );
    });
  } else {
    res.redirect("/");
  }
});
app.post("/dashboard", function (req, res) {
  if (req.session.user) {
    var body = req.body;
    function insert(filename) {
      client.query(
        "INSERT INTO post (id_user,content,image,created_at,edited_at) VALUES (?,?,?,now(),now());",
        [req.session.user.id, body.content, filename],
        function (err) {
          if (err) {
            throw err;
          } else {
            res.redirect("/dashboard");
          }
        }
      );
    }
    var img = req.files.image;
    if (img && img.size > 0) {
      var name = img.name;
      var path = img.path;
      var type = img.type;
      if (type.indexOf("image") != -1) {
        var filename = Date.now() + "_" + name;
        var output = __dirname + "/upload/" + filename;
        fs.rename(path, output, function (err) {
          insert(filename);
        });
      } else {
        fs.unlink(path, function (err) {
          console.log("deleted");
          res.sendStatus(400);
        });
      }
    } else {
      var filename = null;
      insert(filename);
    }
  } else {
    res.redirect("/");
  }
});
app.get("/read/:id", function (req, res) {
  if (req.session.user) {
    fs.readFile("./html/read.html", "utf8", function (err, html) {
      multiclient.query(
        "SELECT * FROM post, user WHERE id = ? AND uid = id_user;" +
          "SELECT * FROM comment, user WHERE id_post = ? AND uid = id_user",
        [req.params.id, req.params.id],
        function (err, results) {
          if (err) {
            throw err;
          } else {
            res.send(
              ejs.render(html, {
                data: results[0][0],
                comment: results[1],
                session: req.session.user,
              })
            );
          }
        }
      );
    });
  } else {
    res.redirect("/");
  }
});
app.post("/read/:id", function (req, res) {
  if (req.session.user) {
    var body = req.body;
    client.query(
      "INSERT INTO comment (id_post, id_user, comment, created_at) VALUES (?,?,?,now())",
      [req.params.id, req.session.user.id, body.comment],
      function (err) {
        if (err) {
          throw err;
        } else {
          res.redirect("/read/" + req.params.id);
        }
      }
    );
  } else {
    res.redirect("/");
  }
});
app.get("/edit/:id", function (req, res) {
  if (req.session.user) {
    var sid = req.session.user.id;
    var param = parseInt(req.params.id);
    function edit() {
      fs.readFile("./html/edit.html", "utf8", function (err, html) {
        client.query(
          "SELECT * FROM post, user WHERE id = ? AND uid = id_user",
          [param],
          function (err, results) {
            if (err) {
              throw err;
            } else {
              res.send(ejs.render(html, { data: results[0] }));
            }
          }
        );
      });
    }
    client.query(
      "SELECT * FROM user WHERE uid = ?",
      [sid],
      function (err, results) {
        if (err) {
          throw err;
        } else {
          if (results[0].uid == sid) {
            edit();
          } else {
            res.end("Wrong Password");
          }
        }
      }
    );
  } else {
    res.redirect("/dashboard");
  }
});
app.post("/edit/:id", function (req, res) {
  if (req.session.user) {
    var sid = req.session.user.id;
    var param = parseInt(req.params.id);
    var body = req.body;
    function update(filename) {
      client.query(
        "UPDATE post SET content = ?, image = ?, edited_at = now() WHERE id = ?",
        [body.content, filename, param],
        function (err) {
          if (err) {
            throw err;
          } else {
            res.redirect("/read/" + req.params.id);
          }
        }
      );
    }
    client.query(
      "SELECT * FROM user WHERE uid = ?",
      [sid],
      function (err, results) {
        if (err) {
          throw err;
        } else {
          if (results[0].uid == sid) {
            var img = req.files.image;
            if (img && img.size > 0) {
              var name = img.name;
              var path = img.path;
              var type = img.type;
              if (type.indexOf("image") != -1) {
                var filename = Date.now() + "_" + name;
                var output = __dirname + "/upload/" + filename;
                fs.rename(path, output, function (err) {
                  update(filename);
                });
              } else {
                fs.unlink(path, function (err) {
                  console.log("deleted");
                  res.sendStatus(400);
                });
              }
            } else {
              var filename = body.prev_image;
              update(filename);
            }
          } else {
            res.end("Wrong Password");
          }
        }
      }
    );
  } else {
    res.redirect("/dashboard");
  }
});
app.get("/delete/:id", function (req, res) {
  if (req.session.user) {
    var sid = req.session.user.id;
    var param = parseInt(req.params.id);
    function del() {
      multiclient.query(
        "DELETE FROM comment WHERE id_post = ?;" +
          "DELETE FROM post WHERE id = ?;",
        [param, param],
        function (err) {
          if (err) {
            throw err;
          } else {
            res.redirect("/");
          }
        }
      );
    }
    client.query(
      "SELECT * FROM user WHERE uid = ?",
      [sid],
      function (err, results) {
        if (err) {
          throw err;
        } else {
          if (results[0].uid == sid) {
            del();
          } else {
            res.end("Wrong Password");
          }
        }
      }
    );
  } else {
    res.redirect("/dashboard");
  }
});
app.get("/profile/:id", function (req, res) {
  if (req.session.user) {
    var param = parseInt(req.params.id);
    fs.readFile("./html/profile.html", "utf8", function (err, html) {
      multiclient.query(
        "SELECT * FROM user WHERE uid = ?;" +
          "SELECT * FROM post, user WHERE id_user = ? AND id_user = uid ORDER BY id DESC",
        [param, param],
        function (err, results) {
          if (err) {
            throw err;
          } else {
            res.send(
              ejs.render(html, {
                profile: results[0][0],
                data: results[1],
                session: req.session.user,
              })
            );
          }
        }
      );
    });
  } else {
    res.redirect("/dashboard");
  }
});
app.get("/pass", function (req, res) {
  if (req.session.user) {
    var sid = req.session.user.id;
    fs.readFile("./html/pass.html", "utf8", function (err, html) {
      client.query(
        "SELECT * FROM user WHERE uid = ?",
        [sid],
        function (err, results) {
          if (err) {
            throw err;
          } else {
            res.send(
              ejs.render(html, { data: results[0], session: req.session.user })
            );
          }
        }
      );
    });
  } else {
    res.redirect("/dashboard");
  }
});
app.post("/pass", function (req, res) {
  if (req.session.user) {
    var sid = req.session.user.id;
    var body = req.body;
    function change() {
      client.query(
        "UPDATE user SET password = ? WHERE uid = ?",
        [body.new_password, sid],
        function (err) {
          if (err) {
            throw err;
          } else {
            res.redirect("/profile/" + sid);
          }
        }
      );
    }
    client.query(
      "SELECT * FROM user WHERE uid = ?",
      [sid],
      function (err, results) {
        if (err) {
          throw err;
        } else {
          if (results[0].password == body.old_password) {
            change();
          } else {
            res.end("Wrong Password");
          }
        }
      }
    );
  } else {
    res.redirect("/dashboard");
  }
});
app.get("/logout", function (req, res) {
  if (req.session.user) {
    req.session.destroy(function (err) {
      if (err) {
        throw err;
      }
      res.redirect("/");
    });
  } else {
    res.redirect("/dashboard");
  }
});
app.listen(52273, function () {
  console.log("Express Server in port 52273");
});
