const { MongoClient } = require('mongodb');
const url = 'mongodb://127.0.0.1:27017';

let db;
const client = new MongoClient(url);

async function connectToMongoServer() {
  await client.connect();
  db = client.db('Snarki');
  console.log("Connected to Snarki db");
  return;
}

const getDb = () => {
  return db;
};

module.exports = {
  getDb,
  connectToMongoServer
};