module.exports = (joi, mongoose) => {
  const userSchema = mongoose.Schema({
    username: { type: String, lowercase: true, trim: true, default: '' },
    password: { type: String, default: '' },
    passwordOld: { type: String, default: '' },
    createAt: { type: Date, default: Date.now },
    email: { type: String, unique: true },
    avatar: { type: String },
    uid: { type: String, trim: true, unique: true },
    name: { type: String },
    isLocked: { type: Number, default: 0 },
    fcmToken: { type: String },
    provider: { type: String },
    friends: [String],
    coverPage: { type: String },
    phone: { type: String, trim: true }, // ảnh bìa
    dob: { type: Date, default: Date.now() },
    address: { type: String },
    countryCode: { type: Number },
    gender: { type: Boolean },
    active: { type: Number, default: 0 }
  })
  return mongoose.model('user', userSchema)
}
