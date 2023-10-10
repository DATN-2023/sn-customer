module.exports = (app, container) => {
  const { checkAccessToken } = container.resolve('middleware')
  require('./sdpApi')(app, container)
  app.use(checkAccessToken)
  require('./userApi')(app, container)
}
