const repo = (container) => {
  const userRepo = require('./userRepo')(container)
  const blockRepo = require('./blockRepo')(container)
  return { userRepo, blockRepo }
}
const connect = (container) => {
  const dbPool = container.resolve('db')
  if (!dbPool) throw new Error('Connect DB failed')
  return repo(container)
}

module.exports = { connect }
