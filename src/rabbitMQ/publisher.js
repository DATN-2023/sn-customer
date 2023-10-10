module.exports = class Publisher {
  constructor (channel, exchange, exchangeType = 'direct') {
    this.exchange = exchange
    this.pubChannel = channel
    channel.assertExchange(exchange, exchangeType, {
      autoDelete: false,
      durable: true,
      passive: true
    })
  }

  async publish (obj, routingKey) {
    try {
      let msg = ''
      if (obj) {
        if (obj.constructor === Object) {
          msg = JSON.stringify(obj)
        } else if (obj.constructor === String) {
          msg = obj
        }
      }
      if (msg) {
        console.log('startPub', obj)
        await this.pubChannel.publish(this.exchange, routingKey, Buffer.from(msg))
        console.log('pubSuccess', msg.length)
      }
    } catch (e) {
      console.error(e)
    }
  }

  async sendToQueue (obj, queue) {
    try {
      let msg = ''
      if (obj) {
        if (obj.constructor === Object) {
          msg = JSON.stringify(obj)
        } else if (obj.constructor === String) {
          msg = obj
        }
      }
      if (msg) {
        // console.log('startPub', obj)
        await this.pubChannel.sendToQueue(this.queue || queue, Buffer.from(msg))
        // console.log('pubSuccess', msg.length)
      }
    } catch (e) {
      console.error(e)
    }
  }
}
