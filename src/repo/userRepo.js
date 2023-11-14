module.exports = container => {
  const { schemas } = container.resolve('models')
  const logger = container.resolve('logger')
  const publisher = container.resolve('publisher')
  const i18n = container.resolve('i18n')
  const { serverHelper, loginType, ObjectId, historyType, workerConfig } = container.resolve('config')
  const { User, Session, History } = schemas.mongoose
  const MAX_DEVICE = +process.env.MAX_DEVICE || 2
  const addUser = async (userObj) => {
    const user = new User(userObj)
    await user.save()
    return user
  }
  const
    loginOrRegister = async ({
      versionCode,
      fcmToken,
      name,
      deviceName,
      picture: avatar,
      auth_time: authTime,
      email,
      firebase,
      uid,
      deviceType,
      deviceId,
      username,
      password,
      phone
    }) => {
      logger.d('LoginOrRegister ', uid, name, avatar)
      const sess = { uid, deviceType, deviceId, authTime, versionCode, deviceName }
      let token = ''
      let hash = ''
      let isLogin = false
      let userResponse
      const user = await checkUser(uid)
      if (user) {
        if (user.isLocked) {
          return user
        }
        isLogin = true
        const update = {}
        if (user.name) {
          update.name = user.name
        }
        if (user.avatar) {
          update.avatar = user.avatar
        }
        userResponse = await User.findOneAndUpdate({ uid }, {
          $set: {
            ...update,
            fcmToken
          }
        }, { useFindAndModify: false, returnOriginal: false })
      } else {
        let update = {}
        if (password) {
          update = {
            password: require('bcryptjs').hashSync(password, 10)
          }
        }
        userResponse = await addUser({
          avatar,
          name,
          email,
          provider: firebase.sign_in_provider,
          uid,
          fcmToken,
          phone,
          ...update
        })
        // publisher.sendToQueue(userResponse, workerConfig.queueName)
      }
      await publisher.sendToQueue({
        customerId: userResponse._id.toString(),
        avatar,
        name,
        email,
        provider: firebase.sign_in_provider,
        uid,
        fcmToken,
        phone
      }, workerConfig.queueName)
      token = serverHelper.genToken({
        _id: String(userResponse._id),
        uid,
        fcmToken,
        deviceId,
        name,
        avatar,
        versionCode,
        deviceType,
        deviceName,
        loginType: loginType.USER
      })
      hash = serverHelper.generateHash(token)
      const sessionInDevice = await Session.find({ uid, deviceId })
      // set ngon ngu sau khi dang nhap
      // const userCache = await blockRepo.getUserInfo(uid)
      // if (!userCache.languages) {
      //   const guestCache = await blockRepo.getGuestInfo(deviceId)
      //   if (guestCache.languages) {
      //     await blockRepo.setUserData(uid, guestCache.languages)
      //   }
      // }
      // neu deviceId da dang nhap thi kick het ra
      if (sessionInDevice.length > 0) {
        await kickSessions(uid, sessionInDevice)
      }
      const sessions = await Session.find({ uid }).sort({ _id: 1 })
      if (sessions.length >= MAX_DEVICE - 1) {
        const arr = []
        while (sessions.length > MAX_DEVICE - 1) {
          arr.push(sessions.shift())
        }
        if (arr.length) {
          await kickSessions(uid, arr)
          console.log('logout ', name, uid, arr.length)
        }
      }
      const { exp } = serverHelper.decodeToken(token)
      sess.hash = hash
      sess.expireAt = exp;
      (new Session(sess)).save();
      (new History({ uid, type: historyType.LOGIN, deviceName, deviceId, deviceType, versionCode })).save()
      return { token, uid, isLogin, user: userResponse }
    }
  const kickSessions = async (uid, sessions) => {
    if (sessions.length === 0) return
    const { blockRepo } = container.resolve('repo')
    await Promise.all(sessions.map(i => blockRepo.kickSessionById(i.uid, i.hash)))
    await Promise.all(sessions.map(i => {
      (new History({
        uid,
        type: historyType.KICK,
        deviceName: i.deviceName,
        deviceId: i.deviceId,
        deviceType: i.deviceType,
        versionCode: i.versionCode
      })).save()
    }))
    await Session.deleteMany({ _id: { $in: sessions } })
  }
  // 7e77be7cec4a099684c235fe7dd0440a
  const logout = async (token, uid) => {
    const hash = serverHelper.generateHash(token)
    const r = await Session.deleteOne({ uid, hash })
    const { deletedCount } = r
    const { deviceName, deviceId, deviceType, versionCode } = serverHelper.decodeToken(token)
    if (deletedCount) {
      (new History({ uid, type: historyType.LOGOUT, deviceName, deviceId, deviceType, versionCode })).save()
    }
    return r
  }

  const checkUser = async (uid) => {
    return User.findOne({ uid })
  }

  const checkExist = async (pipe) => {
    return User.findOne(pipe)
  }

  const updateUserInfo = (uid, user) => {
    return User.updateOne({ uid }, user, { useFindAndModify: false })
  }
  const checkToken = async (uid, token) => {
    const hash = serverHelper.generateHash(token)
    const sess = await Session.findOne({ uid, hash })
    if (sess) {
      return 1
    } else {
      return 0
    }
  }
  const refreshToken = async (token, uid) => {
    const hash = serverHelper.generateHash(token)
    const sess = await Session.findOne({ uid, hash })
    logger.d(uid, sess)
    if (sess) {
      const { expireAt, uid, deviceName, deviceId, deviceType, versionCode, name, avatar } = sess
      if (serverHelper.canRefreshToken(expireAt)) {
        const user = await checkUser(uid)
        if (user) {
          const token = serverHelper.genToken({
            _id: String(user._id),
            uid,
            deviceName,
            deviceId,
            versionCode,
            name: user.name,
            avatar: user.avatar,
            deviceType,
            loginType: loginType.USER
          })
          const hash = serverHelper.generateHash(token)
          const { exp } = serverHelper.decodeToken(token)
          sess.hash = hash
          sess.expireAt = exp
          sess.updateAt = new Date()
          sess.save()
          return { ok: true, data: { token, uid } }
        } else {
          return { ok: false, data: { msg: i18n.re_login } }
        }
      } else {
        return { ok: false, data: { msg: i18n.re_login } }
      }
    } else {
      return { ok: false, data: { msg: i18n.session_not_found } }
    }
  }
  const getUserNoPaging = (pipe, ...args) => {
    return User.find(pipe, ...args)
  }
  const blockUser = async (uid, isLocked) => {
    const old = await User.findOne({ uid })
    if (old && old.isLocked !== isLocked) {
      const { blockRepo } = container.resolve('repo')
      const user = await User.findOneAndUpdate({ uid }, { $set: { isLocked } }, {
        returnOriginal: false,
        useFindAndModify: false
      })
      const his = new History({
        uid,
        type: isLocked ? historyType.BLOCK : historyType.UNBLOCK,
        deviceName: 'All device',
        deviceId: 'N/A',
        versionCode: 'N/A'
      })
      his.save()
      if (isLocked === 1) {
        await blockRepo.blockUser(uid)
        const r = await Session.deleteMany({ uid })
        return { user, r }
      } else {
        await blockRepo.removeBlockUser(uid)
        return { user }
      }
    }
    return { user: old }
  }
  const getUsers = (query, limit, skip, sort = 1) => {
    const pipe = {}
    Object.keys(query).forEach(i => {
      const vl = query[i]
      if (vl.constructor === String) {
        pipe[i] = new RegExp(vl, 'gi')
      } else if (!isNaN(+vl)) {
        pipe[i] = +vl
      } else {
        pipe[i] = vl
      }
    })
    return User.find(pipe).limit(limit).skip(skip).sort({ _id: +sort ? 'desc' : 'asc' })
  }
  const getSessions = async (uid, sort) => {
    return Session.find({ uid }).sort({ _id: +sort || 1 })
  }
  const deleteSessionByUid = async (uid) => {
    const { blockRepo } = container.resolve('repo')
    const session = await Session.find({ uid })
    console.log('kick', session.uid)
    await Promise.all(session.map(i => blockRepo.kickSessionById(i.uid, i.hash)))
    return Session.remove({ uid })
  }
  const deleteSessionById = async (uid, id) => {
    const { blockRepo } = container.resolve('repo')
    const sess = await Session.findOneAndRemove({ _id: new ObjectId(id), uid }, { useFindAndModify: false })
    if (sess) {
      await blockRepo.kickSessionById(sess.uid, sess.hash)
    }
    return sess
  }
  const getHistoryByUid = (uid, limit, skip, sort) => {
    return History.find({ uid }).sort({ _id: +sort || -1 }).limit(+limit || 50).skip(+skip || 0)
  }
  const getCount = (pipe) => {
    return User.countDocuments(pipe)
  }
  const getUserById = (id, ...args) => {
    return User.findById(id, args)
  }
  const getListFriendByPhoneNum = async (phones) => {
    return User.find({ phone: { $in: phones } }, { name: 1, avatar: 1, _id: 1, phone: 1 })
  }
  const getListFriendByUid = async (friends) => {
    return User.find({ _id: { $in: friends } }, { name: 1, avatar: 1, _id: 1, phone: 1 })
  }
  const getListUser = async () => {
    return User.find({}, { name: 1, avatar: 1, _id: 1 })
  }
  const refreshFcmToken = async (uid, fcmToken) => {
    return User.findByIdAndUpdate(uid, { fcmToken: fcmToken })
  }
  const updateCoverPage = async (uid, coverPage) => {
    return User.findByIdAndUpdate(uid, { coverPage })
  }
  const checkUserByPhoneNumber = async (phone) => {
    return User.findOne({ phone })
  }
  const getUserByUid = async (id, ...args) => {
    return User.findById(id, ...args)
  }
  const updateUserById = async (id, user) => {
    return User.findByIdAndUpdate(id, user, {
      useFindAndModify: false,
      returnOriginal: false
    })
  }
  const loginUser = async ({
    email,
    deviceType,
    deviceId,
    versionCode,
    deviceName,
    auth_time: authTime,
    fcmToken,
    name,
    avatar,
    uid
  }) => {
    logger.d('User-login: ', email)
    const sess = { uid, deviceType, deviceId, authTime, versionCode, deviceName }
    let token = ''
    let hash = ''
    let isLogin = false
    const user = await checkExist({ email: email })
    if (user) {
      if (user.isLocked) {
        return user
      }
      isLogin = true
    }
    token = serverHelper.genToken({
      _id: String(user._id),
      uid,
      fcmToken,
      deviceId,
      name,
      avatar,
      versionCode,
      deviceType,
      deviceName,
      loginType: loginType.USER
    })
    hash = serverHelper.generateHash(token)
    const sessionInDevice = await Session.find({ uid, deviceId })
    // set ngon ngu sau khi dang nhap
    // const userCache = await blockRepo.getUserInfo(uid)
    // if (!userCache.languages) {
    //   const guestCache = await blockRepo.getGuestInfo(deviceId)
    //   if (guestCache.languages) {
    //     await blockRepo.setUserData(uid, guestCache.languages)
    //   }
    // }
    // neu deviceId da dang nhap thi kick het ra
    if (sessionInDevice.length > 0) {
      await kickSessions(uid, sessionInDevice)
    }
    const sessions = await Session.find({ uid }).sort({ _id: 1 })
    if (sessions.length >= MAX_DEVICE - 1) {
      const arr = []
      while (sessions.length > MAX_DEVICE - 1) {
        arr.push(sessions.shift())
      }
      if (arr.length) {
        await kickSessions(uid, arr)
        console.log('logout ', name, uid, arr.length)
      }
    }
    const { exp } = serverHelper.decodeToken(token)
    sess.hash = hash
    sess.expireAt = exp;
    (new Session(sess)).save();
    (new History({ uid, type: historyType.LOGIN, deviceName, deviceId, deviceType, versionCode })).save()
    return { token, uid, isLogin, user: user }
  }
  return {
    getCount,
    loginOrRegister,
    refreshToken,
    checkUser,
    checkExist,
    logout,
    checkToken,
    getUsers,
    updateUserInfo,
    blockUser,
    getSessions,
    deleteSessionById,
    deleteSessionByUid,
    getHistoryByUid,
    getUserById,
    getListFriendByPhoneNum,
    getListFriendByUid,
    getListUser,
    refreshFcmToken,
    updateUserById,
    updateCoverPage,
    checkUserByPhoneNumber,
    getUserNoPaging,
    getUserByUid,
    loginUser,
    addUser
  }
}
