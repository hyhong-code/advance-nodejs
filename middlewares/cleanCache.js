const { clearHash } = require("../services/cache");

module.exports = async (req, res, next) => {
  // allow route handler (& other middlewares) to execute first
  await next(); // ***

  // then the execution comes back to this middleware
  // then clear the hash
  clearHash(req.user.id);
};
