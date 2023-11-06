module.exports = (joi, deviceTypes) => {
  return joi.object({
    deviceType: joi.number().allow(...Object.values(deviceTypes)).required(),
    deviceId: joi.string().min(1).required(),
    versionCode: joi.string().min(1).required(),
    deviceName: joi.string().optional()
  })
}
