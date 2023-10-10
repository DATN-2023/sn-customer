module.exports = (joi, deviceTypes) => {
  return joi.object({
    deviceType: joi.number().allow(...Object.values(deviceTypes)).required(),
    token: joi.string().min(1).required(),
    deviceId: joi.string().min(1).required(),
    versionCode: joi.string().min(1).required(),
    name: joi.string().optional(),
    avatar: joi.string().optional(),
    deviceName: joi.string().optional(),
    fcmToken: joi.string().allow(''),
    signature: joi.string().min(1).required(),
    phone: joi.string().optional()
  })
}
