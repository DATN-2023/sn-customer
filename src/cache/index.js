const Redis = require('ioredis')
const start = container => new Promise((resolve, reject) => {
  const { redisConfig } = container.resolve('config')
  let redis = null
  if (redisConfig.sentinel) {
    const redisSentinel = redisConfig.sentinel.split(' ')
    const sentinels = redisSentinel.map(i => {
      const [host, port] = i.split(':')
      return { host, port: port || 80 }
    })
    console.log({
      sentinels,
      name: redisConfig.clusterName,
      password: redisConfig.clusterPassword,
      db: redisConfig.db
    })
    redis = new Redis({
      sentinels,
      name: redisConfig.clusterName,
      password: redisConfig.clusterPassword,
      db: redisConfig.db
    })
  } else {
    const { host, port, db } = redisConfig
    console.log({ host, port, db })
    redis = new Redis({ host, port, db })
  }
  redis.on('ready', () => {
    resolve(redis)
  })
  redis.on('error', err => {
    reject(new Error(err))
    process.exit(0)
  })
})
module.exports = { start }
