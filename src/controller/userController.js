module.exports = container => {
  const { userRepo, blockRepo } = container.resolve('repo')
  const logger = container.resolve('logger')
  const firebaseAdmin = container.resolve('firebaseAdmin')
  const i18n = container.resolve('i18n')
  const { schemaValidator } = container.resolve('models')
  const { httpCode, serverHelper, loginType, workerConfig } = container.resolve('config')
  const publisherMail = container.resolve('publisherMail')
  const loginOrRegister = async (req, res) => {
    try {
      const { error, value } = schemaValidator(req.body, 'Login')
      if (error) {
        return res.status(httpCode.BAD_REQUEST).json({ ok: false, msg: error.toString() })
      }
      if (serverHelper.isTrustSignature(value)) {
        const { token } = value
        const decodeUser = await firebaseAdmin.auth().verifyIdToken(token)
        if (+process.env.DEBUG_USER_LOGIN) {
          logger.d('User logged in', decodeUser)
        }
        if (value.name) {
          // apple chi gui name ve lan dau tien, nen phai tu gui len (khong co trong token)
          decodeUser.name = value.name
        }
        if (value.avatar) {
          decodeUser.avatar = value.avatar
        }
        const user = await userRepo.loginOrRegister({ ...value, ...decodeUser })
        if (user.isLocked) {
          return res.status(httpCode.USER_BLOCK).json({ msg: i18n.user_blocked })
        }
        res.status(user.isLogin ? httpCode.SUCCESS : httpCode.CREATED).json(user)
      } else {
        res.status(httpCode.SIGNATURE_ERROR).json({ ok: false })
      }
    } catch (e) {
      if (e.code === 'auth/id-token-expired') {
        return res.status(httpCode.BAD_REQUEST).json({ ok: false, msg: e.message })
      }
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({ ok: false, env: process.env.DISABLE_SIGNATURE })
    }
  }
  const loginOrRegisterByPhone = async (req, res, next) => {
    try {
      const { phone, password } = req.body
      if (phone && password) {
        // not standard
        const user = await userRepo.checkUserByPhoneNumber(phone)
        if (user) {
          if (require('bcryptjs').compareSync(password, user.password)) {
            return res.status(httpCode.SUCCESS).json({ msg: 'SUCCESS' })
          }
          return res.status(httpCode.SUCCESS).json({ msg: 'NOT FOUND' })
        } else {
          return res.status(httpCode.SUCCESS).json({ msg: 'NOT FOUND' })
        }
      }
      return res.status(httpCode.BAD_REQUEST).json({ msg: 'BAD REQUEST' })
    } catch (e) {
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR)
    }
  }
  const refreshToken = async (req, res) => {
    try {
      const token = req.headers['x-access-token'] || req.body.token
      if (token) {
        const user = serverHelper.decodeToken(token)
        const { ok, data } = await userRepo.refreshToken(token, user.uid)
        if (ok) {
          return res.status(httpCode.SUCCESS).json(data)
        }
        res.status(httpCode.UNAUTHORIZED).json({ ok: false })
      }
    } catch (e) {
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({ ok: false })
    }
  }
  const verifyToken = async (req, res) => {
    try {
      const token = req.headers['x-access-token']
      if (token) {
        const { uid } = (await serverHelper.verifyToken(token)) || {}
        if (uid) {
          const isValid = await userRepo.checkToken(uid, token)
          if (isValid) {
            return res.status(httpCode.SUCCESS).json({})
          }
        }
        res.status(httpCode.UNAUTHORIZED).json({})
      } else {
        res.status(httpCode.UNAUTHORIZED).json({})
      }
    } catch (e) {
      res.status(httpCode.UNKNOWN_ERROR).json({})
    }
  }
  const getUserFromCache = async (req, res) => {
    const { uid } = req.user
    const user = await blockRepo.getUserInfo(uid)
    res.status(httpCode.SUCCESS).json({ user })
  }
  const getUserDetail = async (req, res) => {
    try {
      const token = req.headers['x-access-token']
      if (token) {
        const { uid } = (await serverHelper.verifyToken(token)) || {}
        if (!uid) {
          return res.status(httpCode.UNAUTHORIZED).json({})
        }
        const user = await userRepo.checkUser(uid)
        if (user) {
          const u = user.toObject()
          delete u.password
          u.avatar = serverHelper.getAvatar(u.avatar, u.provider)
          return res.status(httpCode.SUCCESS).json(u)
        }
        return res.status(httpCode.UNAUTHORIZED).json({ msg: 'UNAUTHORIZED user' })
      } else {
        res.status(httpCode.BAD_REQUEST).json({ ok: false })
      }
    } catch (e) {
      if (e.message.includes('TokenExpiredError')) {
        return res.status(httpCode.TOKEN_EXPIRED).json({})
      }
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({ ok: false })
    }
  }
  const getListUserByIds = async (req, res) => {
    try {
      const ids = (req.query.ids || '').split(',')
      if (!ids.length) {
        res.status(httpCode.BAD_REQUEST).json({})
      }
      if (serverHelper.isTrustSignature(req.query)) {
        const users = await userRepo.getListUserByIds(ids)
        res.status(httpCode.SUCCESS).json({ data: users })
      } else {
        res.status(httpCode.SIGNATURE_ERROR).json({ ok: false })
      }
    } catch (e) {
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({ ok: false })
    }
  }
  const enterGuest = async (req, res) => {
    try {
      const { error, value } = schemaValidator(req.body, 'EnterGuest')
      if (error) {
        return res.status(httpCode.BAD_REQUEST).json({ ok: false, msg: error.toString() })
      }
      if (serverHelper.isTrustSignature(value)) {
        const { deviceType, deviceId, versionCode } = value
        const token = serverHelper.genToken({
          deviceType, versionCode, deviceId, loginType: loginType.GUEST
        })
        res.status(httpCode.SUCCESS).json({ token })
      } else {
        res.status(httpCode.SIGNATURE_ERROR).json({ ok: false })
      }
    } catch (e) {
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({ ok: false })
    }
  }
  const logout = async (req, res) => {
    try {
      const token = req.headers['x-access-token']
      const user = serverHelper.decodeToken(token)
      if (user && user.loginType === loginType.USER) {
        userRepo.logout(token, user.uid)
      }
      res.status(httpCode.SUCCESS).json({})
    } catch (e) {
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({ ok: false })
    }
  }
  const ping = async (req, res) => {
    try {
      const token = req.headers['x-access-token']
      if (token) {
        const now = (Date.now()) / 1000
        const user = serverHelper.decodeToken(token)
        if (!user) {
          return res.status(httpCode.FORBIDDEN).json({})
        }
        const { exp } = user
        if (now > exp) {
          return res.status(httpCode.TOKEN_EXPIRED).json({})
        }
        if (user.loginType === loginType.USER) {
          const isKick = await blockRepo.isKick(token)
          if (isKick) {
            return res.status(httpCode.UNAUTHORIZED).json({ msg: i18n.kick })
          }
          await blockRepo.setUserData(user.uid, { lastPing: now })
        }
        res.status(httpCode.SUCCESS).json({})
      } else {
        res.status(httpCode.UNAUTHORIZED).json({})
      }
    } catch (e) {
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({ ok: false })
    }
  }
  const getUsers = async (req, res) => {
    try {
      let { perPage, page, sort } = req.query
      page = +page || 1
      perPage = +perPage || 50
      sort = +sort === 0 ? 0 : +sort || 1
      const skip = (page - 1) * perPage
      const search = { ...req.query }
      delete search.page
      delete search.perPage
      const total = await userRepo.getCount(search)
      const data = await userRepo.getUsers(search, perPage, skip, sort)
      res.status(httpCode.SUCCESS).json({
        page, perPage, sort, data, total
      })
    } catch (e) {
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({})
    }
  }
  const updateUserInfo = async (req, res) => {
    try {
      const user = req.body
      const { uid } = req.params
      if (!uid || Object.keys(user).length === 0) {
        return res.status(httpCode.BAD_REQUEST).json({})
      }

      if (user.phone) {
        const checkPhone = await userRepo.checkExist({ phone: user.phone })
        if (checkPhone) return res.status(httpCode.UNKNOWN_ERROR).json({})
      }

      const data = await userRepo.updateUserInfo(uid, user)
      res.status(httpCode.SUCCESS).json({ ok: true, data })
    } catch (e) {
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({})
    }
  }
  const blockUser = async (req, res) => {
    try {
      const { uid } = req.params
      const { isLocked } = req.body
      if (!uid) {
        return res.status(httpCode.BAD_REQUEST).json({})
      }
      const data = await userRepo.blockUser(uid, +isLocked || 0)
      res.status(httpCode.SUCCESS).json({ ok: !!data, data, uid })
    } catch (e) {
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({})
    }
  }
  const getHistoryByUid = async (req, res) => {
    try {
      const { uid } = req.params
      const { sort, limit, offset } = req.query
      if (!uid) {
        return res.status(httpCode.BAD_REQUEST).json({})
      }
      const data = await userRepo.getHistoryByUid(uid, +limit || 50, +offset || 0, +sort || -1)
      res.status(httpCode.SUCCESS).json({ data })
    } catch (e) {
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({})
    }
  }
  const deleteSessionByUid = async (req, res) => {
    try {
      const { uid } = req.params
      if (!uid) {
        return res.status(httpCode.BAD_REQUEST).json({})
      }
      const data = await userRepo.deleteSessionByUid(uid)
      res.status(httpCode.SUCCESS).json({ ok: !!data, data, uid })
    } catch (e) {
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({})
    }
  }
  const deleteSessionById = async (req, res) => {
    try {
      const { uid, id } = req.params
      if (!uid || !id) {
        return res.status(httpCode.BAD_REQUEST).json({})
      }
      const data = await userRepo.deleteSessionById(uid, id)
      res.status(httpCode.SUCCESS).json({ ok: !!data, data, uid })
    } catch (e) {
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({})
    }
  }
  const getSessions = async (req, res) => {
    try {
      const { uid } = req.params
      const { sort } = req.query
      if (!uid) {
        return res.status(httpCode.BAD_REQUEST).json({})
      }
      const data = await userRepo.getSessions(uid, +sort || -1)
      res.status(httpCode.SUCCESS).json(data)
    } catch (e) {
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({})
    }
  }
  const getUserDetailCache = async (req, res) => {
    let data = {}
    if (req.user.loginType === loginType.USER) {
      data = await blockRepo.getUserInfo(req.user.uid)
    } else {
      data = await blockRepo.getGuestInfo(req.user.deviceId)
    }
    res.status(httpCode.SUCCESS).json(data)
  }
  const saveLanguage = async (req, res) => {
    try {
      const { languages } = req.body
      if (!languages || !languages.every(i => i.constructor === String)) {
        return res.status(httpCode.BAD_REQUEST).json({})
      }
      if (req.user.loginType === loginType.USER) {
        const data = await blockRepo.setLanguageUser(req.user.uid, languages)
        res.status(httpCode.SUCCESS).json({ ok: true, loginType: req.user.loginType, data })
      } else {
        const data = await blockRepo.setLanguageGuest(req.user.deviceId, languages)
        res.status(httpCode.SUCCESS).json({ ok: true, loginType: req.user.loginType, data })
      }
    } catch (e) {
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({})
    }
  }
  const authorization = async (req, res) => {
    try {
      const token = req.headers['x-access-token']
      if (token) {
        const { uid } = (await serverHelper.verifyToken(token)) || {}
        if (uid) {
          const isValid = await userRepo.checkToken(uid, token)
          if (isValid) {
            const user = await userRepo.getUserById(uid, { avatar: 1, name: 1, _id: 1, email: 1 })
            return res.status(httpCode.SUCCESS).json(user)
          }
        }
        res.status(httpCode.UNAUTHORIZED).json({})
      } else {
        res.status(httpCode.UNAUTHORIZED).json({})
      }
    } catch (e) {
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({})
    }
  }
  const refreshFcmToken = async (req, res, next) => {
    try {
      const token = req.headers['x-access-token']
      const { _id } = serverHelper.decodeToken(token)
      const { fcmToken } = req.body
      if (fcmToken) {
        await userRepo.refreshFcmToken(_id, fcmToken)
        return res.status(httpCode.SUCCESS).json({})
      }
      return res.status(httpCode.BAD_REQUEST).json({ msg: 'BAD REQUEST' })
    } catch (e) {
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({ msg: 'UNKNOWN ERROR' })
    }
  }
  const updateUserInforById = async (req, res, next) => {
    try {
      const info = req.body
      const { _id } = req.user

      if (_id.length === 24) {

        if (info.phone) {
          const checkPhone = await userRepo.checkExist({ phone: info.phone })
          if (checkPhone) return res.status(httpCode.UNKNOWN_ERROR).json({ msg: 'Số điện thoại tồn tại.' })
        }

        await userRepo.updateUserById(_id, info)
        return res.status(httpCode.SUCCESS).json({ msg: 'SUCCESS' })
      }
      return res.status(httpCode.BAD_REQUEST).json({ msg: 'BAD REQUEST' })
    } catch (e) {
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({ msg: 'UNKNOWN ERROR' })
    }
  }
  const updateCoverPage = async (req, res, next) => {
    try {
      const { _id } = req.user
      const { coverPage } = req.body
      if (_id) {
        await userRepo.updateCoverPage(_id, coverPage)
        return res.status(httpCode.SUCCESS).json({})
      }
      return res.status(httpCode.BAD_REQUEST).json({ msg: 'BAD REQUEST' })
    } catch (e) {
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({ msg: 'UNKNOWN ERROR' })
    }
  }

  const changePassword = async (req, res) => {
    try {
      const { _id } = req.user
      const { passwordOld, passwordNew } = req.body

      const user = await userRepo.checkExist({ _id })

      if (require('bcryptjs').compareSync(passwordOld, user.password)) {
        password = require('bcryptjs').hashSync(passwordNew, 10)
        await userRepo.updateUserById(_id, { password })
        return res.status(httpCode.SUCCESS).json({ msg: 'SUCCESS' })
      }
      res.status(httpCode.SUCCESS).json({ msg: 'Sai mật khẩu cũ.' })
    } catch (error) {
      logger.e(error)
      res.status(httpCode.UNKNOWN_ERROR).json({ msg: 'UNKNOWN ERROR' })
    }
  }

  const signUpUser = async (req, res) => {
    try {
      const { error, value } = schemaValidator(req.body, 'SignUp')
      if (error) {
        return res.status(httpCode.BAD_REQUEST).json({ ok: false, msg: error.toString() })
      }
      const userExist = await userRepo.checkExist({ email: value.email })
      if (userExist) {
        return res.status(httpCode.BAD_REQUEST).json({ ok: false, msg: 'Email đã được sử dụng bởi người dùng khác!' })
      }
      value.password = require('bcryptjs').hashSync(value.password, 10)
      value.active = 1
      value.uid = Math.floor(Date.now())
      const user = await userRepo.addUser(value)
      await userRepo.updateUserById(user._id.toString(), { uid: user._id.toString() })
      // const mail = {}
      // await publisherMail.sendToQueue(workerConfig.queueMail, mail)
      return res.status(httpCode.SUCCESS).json({ ok: true, msg: 'Tạo tài khoản thành công!' })
    } catch (e) {
      logger.e(e)
      if (e.code === 11000) {
        return res.status(httpCode.BAD_REQUEST).json({ msg: e.message })
      }
      res.status(httpCode.UNKNOWN_ERROR).json({ ok: false })
    }
  }
  const loginUser = async (req, res) => {
    try {
      const { error, value } = schemaValidator(req.body, 'LoginEmail')
      if (error) {
        return res.status(httpCode.BAD_REQUEST).json({ ok: false, msg: error.toString() })
      }
      if (serverHelper.isTrustSignature(value)) {
        const userExist = await userRepo.checkExist({ email: value.email })
        if (userExist) {
          if (require('bcryptjs').compareSync(value.password, userExist.password)) {
            const user = await userRepo.loginUser({ ...value, ...userExist.toObject(), auth_time: Math.floor(Date.now() / 1000) })
            if (user.isLocked) {
              return res.status(httpCode.USER_BLOCK).json({ msg: i18n.user_blocked })
            }
            return res.status(user.isLogin ? httpCode.SUCCESS : httpCode.CREATED).json(user)
          }
        }
        return res.status(httpCode.BAD_REQUEST).json({ ok: false, msg: 'Tài khoản hoặc mật khẩu không đúng!' })
      } else {
        res.status(httpCode.SIGNATURE_ERROR).json({ ok: false })
      }
    } catch (e) {
      if (e.code === 'auth/id-token-expired') {
        return res.status(httpCode.BAD_REQUEST).json({ ok: false, msg: e.message })
      }
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({ ok: false, env: process.env.DISABLE_SIGNATURE })
    }
  }
  return {
    loginOrRegister,
    refreshToken,
    ping,
    getUserDetail,
    enterGuest,
    logout,
    verifyToken,
    getListUserByIds,
    getUsers,
    updateUserInfo,
    blockUser,
    getSessions,
    deleteSessionByUid,
    deleteSessionById,
    getHistoryByUid,
    getUserFromCache,
    getUserDetailCache,
    saveLanguage,
    authorization,
    refreshFcmToken,
    loginOrRegisterByPhone,
    updateUserInforById,
    updateCoverPage,
    changePassword,
    signUpUser,
    loginUser
  }
}
