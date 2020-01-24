import test from 'ava'
import * as crypto from 'crypto'
import * as EVENTS from '../lib/constants/events'
import { createEventsDriver, NodeEmitter } from '../lib/eventsDriver'
import { createDgramTransport } from '../lib/transport/dgram'

interface Message extends NodeEmitter {
    foo?: string
}

test.serial('force error on send message', async (t) => {
    const dgram = createDgramTransport({ eventsDriver: createEventsDriver() })
    await dgram.bind()

    dgram.connection.socket.close()
    const err = await t.throwsAsync(() => dgram.send(null))
    t.is(err.name, 'Error')
    t.is(err.message, 'Not running')
    t.true(dgram.isClosed)
})

test.serial('send dgram message', async (t) => {
    const barEd = createEventsDriver()
    const foo = createDgramTransport({ eventsDriver: createEventsDriver() })
    const bar = createDgramTransport({ eventsDriver: barEd })
    await foo.bind()
    await bar.bind()

    const onMessage = (): Promise<Message> => new Promise((resolve) => {
        barEd.on(EVENTS.TRANSPORT.MESSAGE, (payload) => {
            resolve(payload)
        })

        foo.send({ foo: 'foo' })
    })

    const message = await onMessage()

    await foo.close()
    await bar.close()

    t.is(message.foo, 'foo')
    t.false(message.ensured)
    t.true(foo.isClosed)
    t.true(bar.isClosed)
})

test.serial('send and ensure dgram message', async (t) => {
    const key = crypto.randomBytes(32)
    const barEd = createEventsDriver()
    const foo = createDgramTransport({ eventsDriver: createEventsDriver(), options: { key } })
    const bar = createDgramTransport({ eventsDriver: barEd, options: { key } })
    await foo.bind()
    await bar.bind()

    const onMessage = (): Promise<Message> => new Promise((resolve) => {
        barEd.on(EVENTS.TRANSPORT.MESSAGE, resolve)
        foo.send({ foo: 'foo' })
    })

    const message = await onMessage()

    await foo.close()
    await bar.close()

    t.is(message.foo, 'foo')
    t.true(message.ensured)
    t.true(foo.isClosed)
    t.true(bar.isClosed)
})

// test.serial('methods: unicast', async (t) => {
//     const barEd = createEventsDriver()
//     const foo = createDgramTransport({ eventsDriver: createEventsDriver(), options: { unicast: '0.0.0.0' } })
//     const bar = createDgramTransport({ eventsDriver: barEd, options: { unicast: '0.0.0.0' } })
//     await foo.bind()
//     await bar.bind()

//     const onMessage = (): Promise<Message> => new Promise((resolve) => {
//         barEd.on(EVENTS.TRANSPORT.MESSAGE, resolve)
//         foo.send({ foo: 'foo' })
//     })

//     const message = await onMessage()

//     await foo.close()
//     await bar.close()

//     t.is(message.foo, 'foo')
//     t.false(message.ensured)
//     t.true(foo.isClosed)
//     t.true(bar.isClosed)
// })

test.serial('methods: broadcast', async (t) => {
    const barEd = createEventsDriver()
    const foo = createDgramTransport({ eventsDriver: createEventsDriver(), options: { broadcast: '255.255.255.255' } })
    const bar = createDgramTransport({ eventsDriver: barEd, options: { broadcast: '255.255.255.255' } })
    await foo.bind()
    await bar.bind()

    const onMessage = (): Promise<Message> => new Promise((resolve) => {
        barEd.on(EVENTS.TRANSPORT.MESSAGE, resolve)
        foo.send({ foo: 'foo' })
    })

    const message = await onMessage()

    await foo.close()
    await bar.close()

    t.is(message.foo, 'foo')
    t.false(message.ensured)
    t.true(foo.isClosed)
    t.true(bar.isClosed)
})