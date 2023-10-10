require('dotenv').config()
const { initDI } = require('./di')
const config = require('./config')
const firebaseAdmin = require('firebase-admin')
const logger = require('./logger')
const middleware = require('./middleware')
const server = require('./server')
const controller = require('./controller')
const { connect } = require('./database')
const { start } = require('./cache')
const repo = require('./repo')
const redisHelper = require('./redisHelper')
const { createChannel, Publisher } = require('./rabbitMQ')
const models = require('./models')
const lang = require('./lang')
const EventEmitter = require('events').EventEmitter
const mediator = new EventEmitter()
logger.d('VTVFun User Service')
mediator.once('di.ready', async (container) => {
  console.log('di.ready, starting connect db ', config.dbSettings)
  container.registerValue('config', config)
  container.registerValue('i18n', lang('en'))
  container.registerValue('middleware', middleware)
  container.registerValue('logger', logger)
  container.registerValue('mediator', mediator)
  firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(config.firebaseConfig.serviceAccountPath),
    // databaseURL: config.firebaseConfig.databaseURL
  })
  console.log('connected firebase ', config.firebaseConfig)
  container.registerValue('firebaseAdmin', firebaseAdmin)
  // for RabbitMQ
  const channel = await createChannel(config.rabbitConfig)
  const publisher = new Publisher(channel, config.workerConfig.exchange)

  const channelMail = await createChannel(config.rabbitConfig)
  const publisherMail = new Publisher(channelMail, config.workerConfig.exchange)

  container.registerValue('publisher', publisher)
  container.registerValue('publisherMail', publisherMail)

  mediator.once('db.ready', db => {
    console.log('db.ready, starting connect cache ', config.redisConfig)
    start(container).then(redis => {
      logger.d('cache.ready, starting server')
      container.registerValue('db', db)
      container.registerValue('redis', redis)
      container.registerValue('redisHelper', redisHelper(container))
      container.registerValue('models', models(container))
      const repository = repo.connect(container)
      container.registerValue('repo', repository)
      container.registerValue('controller', controller(container))
      container.registerValue('middleware', middleware(container))
      server.start(container).then(app => {
        logger.d('Server started at port ', app.address().port)
      })
    }).catch(e => {
      logger.e(e)
    })
  })
  connect(container, mediator)
})
initDI(mediator)
