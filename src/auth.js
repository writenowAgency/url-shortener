const basicAuth = require("express-basic-auth");

const dashboardAuth = basicAuth({
  users: {
    [process.env.ADMIN_USER || "admin"]: process.env.ADMIN_PASS || "change-me"
  },
  challenge: true,
  realm: "URL Shortener Admin"
});

module.exports = {
  dashboardAuth
};
