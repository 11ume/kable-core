import test from 'ava'
import * as crypto from 'crypto'
import * as EVENTS from '../lib/constants/events'
import { createEventsDriver, NodeEmitter } from '../lib/eventsDriver'
import { createDgramTransport } from '../lib/transport/dgram'

interface Message extends NodeEmitter {
    foo?: string
}

test.serial('force error when send message', async (t) => {
    const eventsDriver = createEventsDriver()
    const dgram = createDgramTransport({ eventsDriver })
    await dgram.bind()

    try {
        await dgram.connection.socket.close()
        await dgram.send({})
    } catch (err) {
        t.is(err.name, 'Error')
        t.is(err.message, 'Not running')
    }

    t.true(dgram.isClosed)
})

test.serial('send dgram message', async (t) => {
    const barEventDriver = createEventsDriver()
    const foo = createDgramTransport({ eventsDriver: createEventsDriver() })
    const bar = createDgramTransport({ eventsDriver: barEventDriver })
    await foo.bind()
    await bar.bind()

    const onMessage = (): Promise<Message> => new Promise((resolve) => {
        barEventDriver.on(EVENTS.TRANSPORT.MESSAGE, (payload) => {
            resolve(payload)
        })
    })

    await foo.send({ foo: 'foo' })
    const message = await onMessage()

    t.is(message.foo, 'foo')
    t.false(message.ensured)
    t.true(foo.isClosed)
    t.true(bar.isClosed)
})

test.serial('send and ensure dgram message', async (t) => {
    const key = crypto.randomBytes(32)
    const barEventDriver = createEventsDriver()
    const foo = createDgramTransport({ eventsDriver: createEventsDriver(), options: { key } })
    const bar = createDgramTransport({ eventsDriver: barEventDriver, options: { key } })
    await foo.bind()
    await bar.bind()

    const onMessage = (): Promise<Message> => new Promise((resolve) => {
        barEventDriver.on(EVENTS.TRANSPORT.MESSAGE, resolve)
    })

    await foo.send(null)
    const message = await onMessage()

    t.true(message.ensured)
    t.true(foo.isClosed)
    t.true(bar.isClosed)
})
