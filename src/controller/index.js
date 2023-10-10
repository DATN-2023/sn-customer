module.exports = (container) => {
  const userController = require('./userController')(container)
  const sdpController = require('./sdpController')(container)
  return {  userController, sdpController }
}
