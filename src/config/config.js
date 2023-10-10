const DEFAULT_GOOGLE_APPLICATION_CREDENTIALS = require.resolve('./test-1a4cc-firebase-adminsdk-zwpu2-9f7d13e585.json')
const serverSettings = {
  port: process.env.PORT || 8003,
  basePath: process.env.BASE_PATH || '',
  signature: process.env.SECRET_SIGNATURE || '#123Ag'
}
const userConfig = {
  pingInterval: +process.env.PING_INTERVAL || 60
}
const redisConfig = {
  sentinel: process.env.REDIS_SENTINEL || '',
  clusterName: process.env.REDIS_CLUSTER_NAME || '',
  clusterPassword: process.env.REDIS_CLUSTER_PASSWORD || 'QDCJM446bJ4K',
  db: process.env.REDIS_DB || 5,
  port: process.env.REDIS_PORT || 6379, // Redis port
  host: process.env.REDIS_HOST || '127.0.0.1', // Redis host
  expire: +process.env.EXPIRE_CACHE_SECOND || 1,
  expireSearch: process.env.EXPIRE_SEARCH || 24 * 7 * 60 * 60
}
const historyType = {
  LOGIN: 1,
  LOGOUT: 2,
  BLOCK: 3,
  UNBLOCK: 4,
  KICK: 5
}
const httpCode = {
  SUCCESS: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  TOKEN_EXPIRED: 409,
  UNKNOWN_ERROR: 520,
  FORBIDDEN: 403,
  ADMIN_REQUIRE: 406,
  SIGNATURE_ERROR: 411,
  UNAUTHORIZED: 401,
  USER_BLOCK: 412,
  DEVICE_BLOCK: 413
}
const loginType = {
  USER: 1,
  GUEST: 2
}
const userType = {
  BROKER: 1,
  INVESTOR: 2,
  CUSTOMER: 3
}
const firebaseConfig = {
 // databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://vtvfun-467b4.firebaseio.com/',
  serviceAccountPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || DEFAULT_GOOGLE_APPLICATION_CREDENTIALS
}

const dbSettings = {
  db: process.env.DB || 'sc-user',
  user: process.env.DB_USER || '',
  pass: process.env.DB_PASS || '',
  repl: process.env.DB_REPLS || '',
  servers: (process.env.DB_SERVERS) ? process.env.DB_SERVERS.split(',') : [
    'localhost:27017'
  ]
}

const serverHelper = function () {
  const jwt = require('jsonwebtoken')
  const crypto = require('crypto')
  const request = require('request-promise')
  const ms = require('ms')
  const secretKey = process.env.SECRET_KEY || '123'

  function decodeToken (token) {
    return jwt.decode(token)
  }

  function getAvatar (url, provider) {
    switch (provider) {
      case 'facebook.com':
        return `${url}?width=100&height=100`
      case 'twitter.com':
        return `${url.replace('_normal', '')}`
    }
    return url
  }

  function genToken (obj) {
    return jwt.sign(obj, secretKey, { expiresIn: process.env.EXPIRE_TOKEN || '100y' })
  }

  function verifyToken (token) {
    return new Promise((resolve, reject) => {
      jwt.verify(token, secretKey, (err, decoded) => {
        err ? reject(new Error(err)) : resolve(decoded)
      })
    })
  }

  function getRandomInt (lower, upper) {
    return Math.floor(lower + (Math.random() * (upper - lower + 1)))
  }

  function generateHash (str) {
    return crypto.createHash('md5').update(str).digest('hex')
  }

  function isValidToken (token) {
    const user = decodeToken(token)
    const now = Date.now() / 1000
    if (user && (user.uid || user.deviceId) && user.exp > now) {
      return user
    }
    return null
  }

  function encryptPassword (password) {
    password = password || getRandomInt(100000, 999999)
    return crypto.createHash('sha256').update(password, 'binary').digest('base64')
  }

  function canRefreshToken (expDate) {
    const now = (Date.now()) / 1000
    const maxExp = ms(process.env.MAX_EXP_REFESH_TOKEN || '30d') / 1000
    return now - expDate < maxExp
  }

  function isTrustSignature (obj) {
    if (+process.env.DISABLE_SIGNATURE|| 1 ) {
      return true
    }
    const { signature } = obj
    delete obj.signature
    const token = getSignature(obj)
    return signature === token
  }

  const getSignature = (obj) => {
    obj = sortObjectByKey(obj)
    const str = `${Object.values(obj).join('$')}$${serverSettings.signature}`
    return crypto.createHash('md5').update(str).digest('hex')
  }
  const sortObjectByKey = (unordered) => {
    const ordered = {}
    Object.keys(unordered).sort().forEach(function (key) {
      if (unordered[key]) ordered[key] = unordered[key]
    })
    return ordered
  }
  const handleDataBeforeCache = (data) => {
    return {
      data: data instanceof String ? JSON.parse(data) : data,
      dateCreated: Date.now() / 1000
    }
  }
  const isTrustCacheData = ({ data, dateCreated }) => {
    const now = Date.now() / 1000
    if (Math.abs(now - dateCreated) <= redisConfig.expire) {
      return data
    } else {
      return null
    }
  }

  const shipLog = obj => {
    const uri = process.env.SHIPLOG_SERVICE_URL || 'http://vtvfun-shiplog-develop/shiplog/log'
    const options = {
      method: 'POST',
      uri,
      json: true,
      body: obj
    }
    return request(options)
  }
  return {
    generateHash,
    decodeToken,
    canRefreshToken,
    encryptPassword,
    verifyToken,
    genToken,
    isTrustSignature,
    getAvatar,
    isValidToken,
    shipLog,
    handleDataBeforeCache,
    isTrustCacheData
  }
}
module.exports = {
  dbSettings,
  serverHelper: serverHelper(),
  serverSettings,
  httpCode,
  firebaseConfig,
  loginType,
  historyType,
  redisConfig,
  userConfig,
  userType
}
