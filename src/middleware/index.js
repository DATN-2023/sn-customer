module.exports = (container) => {
  const { serverHelper, httpCode } = container.resolve('config')
  const verifyAccessToken = async (req, res, next) => {
    return next()
  }
  const checkAccessToken = (req, res, next) => {
    const token = req.headers['x-access-token'] || req.body.token
    if (token) {
      const user = serverHelper.decodeToken(token)
      if (user) {
        req.user = user
      }
    }
    next()
  }
  const BLOCK_TOKEN = process.env.BLOCK_TOKEN || '123'
  const verifyBlockToken = async (req, res, next) => {
    const token = req.headers['x-access-token']
    if (token !== BLOCK_TOKEN) {
      return res.status(httpCode.BAD_REQUEST).json({ msg: 'Bạn không có quyền thực hiện tác vụ này!' })
    }
    return next()
  }
  return { verifyAccessToken, checkAccessToken, verifyBlockToken }
}
