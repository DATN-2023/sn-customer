module.exports = (joi, mongoose) => {
  const sessionSchema = mongoose.Schema({
    createAt: { type: Date, default: Date.now },
    authTime: { type: Number },
    uid: { type: String },
    deviceType: { type: Number },
    deviceId: { type: String },
    hash: { type: String },
    expireAt: { type: Number },
    versionCode: { type: String },
    deviceName: { type: String },
    updateAt: { type: Date }
  })
  return mongoose.model('session', sessionSchema)
}
