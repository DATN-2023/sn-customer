module.exports = (container) => {
  const logger = container.resolve('logger')
  const { httpCode } = container.resolve('config')
  const { userRepo } = container.resolve('repo')

  const getListUserByIdsSDP = async (req, res) => {
    try {
      let { ids } = req.query
      if (ids) {
        // check id.length === 24 here
        ids = ids.split(',')
        let ok = false
        ids.forEach(id => {
          if (id.length !== 24) {
            ok = true
          }
        })
        if (ok) {
          return res.status(httpCode.BAD_REQUEST).json({ msg: 'Danh sách người dùng không hợp lệ!' })
        }
        const users = await userRepo.getUserNoPaging({ _id: { $in: ids } }, { name: 1, fcmToken: 1, email: 1, avatar: 1, uid: 1, dob: 1 })
        return res.status(httpCode.SUCCESS).json(users)
      }
      return res.status(httpCode.BAD_REQUEST).json({ msg: 'BAD REQUEST' })
    } catch (e) {
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({})
    }
  }
  const getUserByIdSDP = async (req, res) => {
    try {
      const { id } = req.params
      if (id && id.length === 24) {
        const user = await userRepo.getUserByUid(id, { name: 1, fcmToken: 1, email: 1, avatar: 1, uid: 1, dob: 1 })
        if (user) {
          return res.status(httpCode.SUCCESS).json(user)
        }
      }
      return res.status(httpCode.BAD_REQUEST).json({})
    } catch (e) {
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({})
    }
  }
  return Object.create({
    getListUserByIdsSDP,
    getUserByIdSDP
  })
}
