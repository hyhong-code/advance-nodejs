const mongoose = require("mongoose");
const redis = require("redis");
const util = require("util");

const redisUrl = "redis://127.0.0.1:6379";
const client = redis.createClient(redisUrl);
client.hget = util.promisify(client.hget); // Turns callback into promise

// Adds a .cache() method on Query prototype to toggle cache feature
mongoose.Query.prototype.cache = function (options = {}) {
  // 'this' refers to current query instance
  this.useCache = true; // attaches a .useCache property on query instance
  this.hashKey = JSON.stringify(options.key || "default"); // use passed in key for top level has key
  return this; // to make .cache() call chainable
};

// Gets a reference of default mongoose .exec() function
// .exec() is invoked every time a query is executed
const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.exec = async function () {
  // Inject some logic to be executed before a query is sent off to mongoDB

  // If .cache() is not invoked, use original .exec() to query
  // Use apply to pass in context and all args
  if (!this.useCache) {
    return exec.apply(this, arguments);
  }

  // Cannot direct modify this.getQuery(), it will modify the query instance
  // Copy the query object and add collection key value pair onto it
  const key = JSON.stringify(
    Object.assign({}, this.getQuery(), {
      collection: this.mongooseCollection.name,
    })
  );

  // key: { _id: '5f3e34909822d647e0c1efd6', collection: 'users' }
  // console.log({ key });

  // Check if we have a cached value for 'key' in redis
  const cacheValue = await client.hget(this.hashKey, key);

  // If we have it in Redis, return that
  if (cacheValue) {
    // cacheValue is JSON, mongoose expects .exec() to return a mongoose doc
    const doc = JSON.parse(cacheValue);
    return Array.isArray(doc)
      ? doc.map((d) => new this.model(d)) // Hydrate array of objs into mongoose docs
      : new this.model(doc); // Turn one obj into a mongoose doc
  }

  // If we do NOT have it in Redis, issue a new query with original .exec()
  // and cache the result for later
  const result = await exec.apply(this, arguments);

  // Result is a mongoose doc, turn into JSON and cache it
  client.hset(this.hashKey, key, JSON.stringify(result), "EX", 10);

  return result;
};

module.exports = {
  // Delete all caches for given top level key
  // Call this when created / updated resource
  clearHash(hashKey) {
    client.del(JSON.stringify(hashKey));
  },
};
