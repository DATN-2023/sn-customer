const joi = require('@hapi/joi')
const mongoose = require('mongoose')
module.exports = container => {
  const { ObjectId } = mongoose.Types
  container.registerValue('ObjectId', ObjectId)
  const deviceTypes = {
    ANDROID: 1,
    IOS: 2,
    BROWSER: 3
  }
  const User = require('./user.model')(joi, mongoose)
  const History = require('./history.model')(joi, mongoose)
  const Session = require('./session.model')(joi, mongoose)
  const Login = require('./joi/login.model')(joi, deviceTypes)
  const EnterGuest = require('./joi/enterGuest.model')(joi, deviceTypes)
  const SignUp = require('./joi/signup.model')(joi, deviceTypes)
  const LoginEmail = require('./joi/loginEmail.model')(joi, deviceTypes)
  const schemas = {
    mongoose: {
      User, Session, History
    },
    joi: { Login, EnterGuest, SignUp, LoginEmail }
  }
  const schemaValidator = (obj, type) => {
    const schema = schemas.joi[type]
    if (schema) {
      return schema.validate(obj, {
        allowUnknown: true
      })
    }
    return { error: `${type} not found.` }
  }
  return { schemas, schemaValidator }
}
