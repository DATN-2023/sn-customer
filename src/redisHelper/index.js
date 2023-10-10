const ms = require('ms')
module.exports = container => {
  const redis = container.resolve('redis')
  const prefix = process.env.PREFIX_REDIS || 'vtvfunUser'
  const exprire = process.env.EXPIRE_DEFAULT || '1d'
  const get = (key) => {
    return redis.get(`${prefix}-${key}`)
  }
  const set = (key, value, exp = exprire) => {
    return redis.set(`${prefix}-${key}`, value, 'ex', ms(exp))
  }
  const hset = (hKey, key, value) => {
    return redis.hset(`${prefix}-${hKey}`, key, value)
  }
  const hget = (hKey, key, value) => {
    return redis.hget(`${prefix}-${hKey}`, key)
  }
  const hdel = (hKey, key, value) => {
    return redis.hdel(`${prefix}-${hKey}`, key)
  }
  const del = (key) => {
    return redis.del(`${prefix}-${key}`)
  }
  return { get, set, del, hget, hset, hdel }
}
