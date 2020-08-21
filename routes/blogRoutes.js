const mongoose = require("mongoose");
const requireLogin = require("../middlewares/requireLogin");

const Blog = mongoose.model("Blog");

module.exports = (app) => {
  app.get("/api/blogs/:id", requireLogin, async (req, res) => {
    const blog = await Blog.findOne({
      _user: req.user.id,
      _id: req.params.id,
    });

    res.send(blog);
  });

  app.get("/api/blogs", requireLogin, async (req, res) => {
    try {
      const redis = require("redis");
      const util = require("util");
      const redisUrl = "redis://127.0.0.1:6379";
      const client = redis.createClient(redisUrl);

      // Turns any fn that accepts callback as last arg to new
      // fn that returns a promise
      client.get = util.promisify(client.get);

      // Check if has cached data in redis for this query
      const cachedBlogs = await client.get(req.user.id);

      // If yes, response and return right away
      if (cachedBlogs) {
        console.log("Serving from cache...");
        return res.send(JSON.parse(cachedBlogs));
      }

      // If no, respond to request and update cached
      const blogs = await Blog.find({ _user: req.user.id });
      console.log("Serving from MongoDB...");
      // Update cache, redis only accept string / number
      client.set(req.user.id, JSON.stringify(blogs));
      res.send(blogs);
    } catch (error) {
      console.error(error);
    }
  });

  app.post("/api/blogs", requireLogin, async (req, res) => {
    const { title, content } = req.body;

    const blog = new Blog({
      title,
      content,
      _user: req.user.id,
    });

    try {
      await blog.save();
      res.send(blog);
    } catch (err) {
      res.send(400, err);
    }
  });
};
