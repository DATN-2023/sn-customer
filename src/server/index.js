const express = require('express')
const morgan = require('morgan')
const helmet = require('helmet')
const cors = require('cors')
const bodyParser = require('body-parser')
const api = require('../api')
const start = (container) => {
  return new Promise((resolve, reject) => {
    const { serverSettings } = container.resolve('config')
    const { port } = serverSettings
    const repo = container.resolve('repo')
    const logger = container.resolve('logger')
    const { checkAccessToken } = container.resolve('middleware')
    if (!repo) {
      reject(new Error('The server must be started with a connected repository'))
    }
    if (!port) {
      reject(new Error('The server must be started with an available port'))
    }
    const app = express()
    morgan.token('body', function (req) { return JSON.stringify(req.body) })
    app.use(morgan(':date :method :url :remote-addr :status :response-time ms - :res[content-length] :body - :req[content-length]'))
    app.disable('etag')
    app.use(cors())
    app.use(bodyParser.urlencoded({ extended: false }))
    app.use(bodyParser.json())
    app.get(`${serverSettings.basePath}/health`, (req, res) => {
      res.status(200).json({})
    })
    app.get('/health', (req, res) => {
      res.status(200).json({})
    })
    app.use(checkAccessToken)
    app.use(helmet())
    app.use((err, req, res, next) => {
      logger.e(err)
      reject(new Error('Something went wrong!, err:' + err))
      return res.status(500).send('Something went wrong!')
    })
    api(app, container)
    const server = app.listen(port, () => resolve(server))
  })
}
module.exports = { start }
