module.exports = class Subscriber {
  constructor (channel, queueName, exchange, exchangeType = 'direct', pattern = '') {
    console.log(queueName, exchange, exchangeType)
    this.channel = channel
    this.exchange = exchange
    this.pattern = pattern
    this.queueName = queueName
    this.listeners = new Map()
    this.onceListeners = new Map()
    // eslint-disable-next-line no-useless-call
    channel.assertExchange(exchange, exchangeType, { durable: true })
    // eslint-disable-next-line no-useless-call
    this.onStart.call(this)
  }

  onStart () {
    this.channel.prefetch(10)
    this.channel.assertQueue(this.queueName, { durable: true }, (err, _ok) => {
      if (err) console.log(err)
      this.channel.bindQueue(this.queueName, this.exchange, this.pattern)
      this.channel.consume(this.queueName, this.processMsg.bind(this), {})
      // chu y noack: if noack true, the broker won't expect an acknowledgement of messages delivered to this consumer;
      // i.e., it will dequeue messages as soon as they've been sent down the wire. Defaults to false (i.e., you will be expected to acknowledge messages).
      console.log('Worker is started in exchange:', this.exchange, 'queue:', this.queueName)
    })
  }

  on (label, callback) {
    this.listeners.has(label) || this.listeners.set(label, [])
    this.listeners.get(label).push(callback)
  }

  once (label, callback) {
    this.onceListeners.has(label) || this.onceListeners.set(label, [])
    this.onceListeners.get(label).push(callback)
  }

  trigger (label, ...args) {
    let res = false
    const _trigger = (inListener, label, ...args) => {
      const listeners = inListener.get(label)
      if (listeners && listeners.length) {
        listeners.forEach((listener) => {
          listener(...args)
        })
        res = true
      }
    }
    _trigger(this.onceListeners, label, ...args)
    _trigger(this.listeners, label, ...args)
    this.onceListeners.delete(label)
    return res
  }

  remove (label) {
    this.listeners.delete(label)
    this.onceListeners.delete(label)
  }

  processMsg (msg) {
    this.trigger('message', msg)
    // cac label khac dua vao msg de ban ra, ma cung khong can
  }

  ack (msg) {
    this.channel.ack(msg)
  }
}
