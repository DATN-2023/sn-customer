module.exports = (joi, mongoose) => {
  const sessionSchema = mongoose.Schema({
    createAt: { type: Date, default: Date.now },
    uid: { type: String },
    type: { type: Number },
    deviceName: { type: String },
    deviceId: { type: String },
    deviceType: { type: String },
    versionCode: { type: String }
  })
  return mongoose.model('history', sessionSchema)
}
