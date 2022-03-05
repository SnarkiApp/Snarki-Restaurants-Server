const { MongoClient } = require('mongodb');
const { fetchSSMSecrets } = require('./aws/ssmSecrets');
const ssmKeys = require('./aws/ssmKeys');

let db;
async function connectToMongoServer() {
  const url = await fetchSSMSecrets(ssmKeys.mongoUrl);
  const client = new MongoClient(url);
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