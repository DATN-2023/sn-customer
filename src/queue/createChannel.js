const amqp = require('amqplib/callback_api')

function getURL ({ host, port, user, pass }) {
  return `amqp://${user}:${pass}@${host}:${port}?heartbeat=60`
}

module.exports = (options) => {
  return new Promise((resolve, reject) => {
    start()

    function start () {
      amqp.connect(getURL(options), function (err, conn) {
        if (err) {
          console.error('[AMQP]', err.message)
          return setTimeout(start, 1000)
        }
        conn.on('error', function (err) {
          process.exit(0)
          if (err.message !== 'Connection closing') {
            console.error('[AMQP] conn error', err.message)
          }
        })
        conn.on('close', function () {
          console.error('[AMQP] reconnecting')
          return setTimeout(start, 1000)
        })

        console.log('[AMQP] connected')
        whenConnected(conn)
      })
    }

    function whenConnected (conn) {
      startSub(conn)
    }

    function startSub (conn) {
      conn.createChannel(function (err, ch) {
        if (closeOnErr(conn, err)) return
        ch.on('error', function (err) {
          console.error('[AMQP] channel error', err.message)
        })
        ch.on('close', function () {
          console.log('[AMQP] channel closed sub')
          process.exit(0)
        })
        ch.prefetch(10)
        resolve(ch)
      })
    }

    function closeOnErr (conn, err) {
      if (!err) return false
      console.error('[AMQP] error', err)
      conn.close()
      reject(err)
      return true
    }
  })
}
