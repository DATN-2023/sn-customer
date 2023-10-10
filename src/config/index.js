const config = require('./config')
const IDatabaseResult = require('./response')
const { ObjectId } = require('mongoose').Types
module.exports = { ...config, IDatabaseResult, ObjectId }
