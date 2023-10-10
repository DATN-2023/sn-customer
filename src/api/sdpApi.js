module.exports = (app, container) => {
  const { serverSettings } = container.resolve('config')
  const { sdpController } = container.resolve('controller')
  const { basePath } = serverSettings
  const { verifyBlockToken } = container.resolve('middleware')

  app.get(`${basePath}/sdp/users`, verifyBlockToken, sdpController.getListUserByIdsSDP)
  app.get(`${basePath}/sdp/users/:id`, verifyBlockToken, sdpController.getUserByIdSDP)
}
