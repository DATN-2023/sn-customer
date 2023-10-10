module.exports = container => {
  const redisHelper = container.resolve('redisHelper')
  const logger = container.resolve('logger')
  const { serverHelper } = container.resolve('config')
  const userKey = 'userInfo'
  const guestKey = 'guestInfo'
  const blockUser = async (uid) => {
    logger.d('blockUser uid', uid)
    await setUserData(uid, { isBlocked: 1 })
  }
  const setUserData = async (uid, obj) => {
    const user = await getUserInfo(uid)
    await redisHelper.hset(userKey, uid, JSON.stringify({ ...user, ...obj }))
    return getUserInfo(uid)
  }
  const getUserInfo = async (uid) => {
    try {
      const user = await redisHelper.hget(userKey, uid)
      return user ? JSON.parse(user) : {}
    } catch (e) {
      return {}
    }
  }
  const removeBlockUser = async (uid) => {
    logger.d('removeBlockUser uid', uid)
    await setUserData(uid, { isBlocked: 0 })
  }
  const kickSession = async (token) => {
    const { uid, name } = serverHelper.decodeToken(token)
    const hash = serverHelper.generateHash(token)
    const key = `kickUser-${uid}-${hash}`
    logger.d('kickSession uid', uid, name)
    await redisHelper.set(key, '1', '2d')
  }
  const kickSessionById = async (uid, hash) => {
    const key = `kickUser-${uid}-${hash}`
    await redisHelper.set(key, '1', '2d')
  }
  const getGuestInfo = async (deviceId) => {
    try {
      const guest = await redisHelper.hget(guestKey, deviceId)
      return guest ? JSON.parse(guest) : {}
    } catch (e) {
      return {}
    }
  }
  const setLanguageGuest = async (deviceId, langs) => {
    const guest = await getGuestInfo(deviceId)
    await redisHelper.hset(guestKey, deviceId, JSON.stringify({ ...guest, languages: langs }))
    return await getGuestInfo(deviceId)
  }
  const setLanguageUser = (uid, langs) => {
    return setUserData(uid, { languages: langs })
  }
  const isKick = async (token) => {
    const user = serverHelper.decodeToken(token)
    const { uid } = user
    const hash = serverHelper.generateHash(token)
    const key = `kickUser-${uid}-${hash}`
    const block = await getUserInfo(uid)
    const kick = await redisHelper.get(key)
    return Boolean(block.isBlocked || kick)
  }

  return {
    blockUser,
    kickSession,
    removeBlockUser,
    isKick,
    kickSessionById,
    getUserInfo,
    getGuestInfo,
    setLanguageGuest,
    setLanguageUser,
    setUserData
  }
}
