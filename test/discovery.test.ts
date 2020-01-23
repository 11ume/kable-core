import test from 'ava'
import ip from 'ip'
import { DISCOVERY } from '../lib/constants/events'
import { createStore } from '../lib/store'
import { createDiscovery } from '../lib/discovery'
import { createRepository } from '../lib/repository'
import { NodeRegistre, createNode } from './../lib/node'
import { createTransport, TransportTypes } from '../lib/transport/transport'
import { createEventsDriver, NodeEmitter } from '../lib/eventsDriver'

test.serial('pick: get a node hello', async (t) => {
    const nodesStore = createStore<NodeRegistre>()
    const eventsDriver = createEventsDriver()
    const nodesRepository = createRepository<NodeRegistre>(nodesStore)
    const node = createNode()
    const transport = createTransport({
        type: TransportTypes.DGRAM
        , eventsDriver
    })

    const discovery = createDiscovery({
        node
        , transport
        , eventsDriver
        , nodesRepository
        , options: {
            ignoreInstance: false
        }
    })

    const check = (): Promise<NodeEmitter> => new Promise((resolve) => {
        eventsDriver.on(DISCOVERY.HELLO, resolve)
    })

    await transport.bind()
    await discovery.start()

    const n = await check()
    t.deepEqual(n.doing, { time: null })
    t.false(n.ensured)
    t.is(n.event, DISCOVERY.HELLO)
    t.truthy(n.host)
    t.is(n.hostname, node.hostname)
    t.is(n.id, node.hostname)
    t.is(n.iid, node.iid)
    t.is(n.index, node.index)
    t.is(n.pid, node.pid)
    t.is(n.port, node.port)
    t.deepEqual(n.replica, {
        is: false
    })
    t.deepEqual(n.rinfo, {
        address: ip.address()
        , family: 'IPv4'
        , port: 5000
        , size: 258
    })

    t.deepEqual(n.start, { time: null })
    t.deepEqual(n.stop, { time: null })
    t.deepEqual(n.up, { time: null })
})

test.serial('pick: get a node advertisement', async (t) => {
    const nodesStore = createStore<NodeRegistre>()
    const eventsDriver = createEventsDriver()
    const nodesRepository = createRepository<NodeRegistre>(nodesStore)
    const node = createNode()
    const transport = createTransport({
        type: TransportTypes.DGRAM
        , eventsDriver
    })

    const discovery = createDiscovery({
        node
        , transport
        , eventsDriver
        , nodesRepository
        , options: {
            ignoreInstance: false
        }
    })

    const check = (): Promise<NodeEmitter> => new Promise((resolve) => {
        eventsDriver.on(DISCOVERY.ADVERTISEMENT, resolve)
    })

    await transport.bind()
    await discovery.start()

    const n = await check()
    t.deepEqual(n.doing, { time: null })
    t.false(n.ensured)
    t.is(n.event, DISCOVERY.ADVERTISEMENT)
    t.truthy(n.host)
    t.is(n.hostname, node.hostname)
    t.is(n.id, node.hostname)
    t.is(n.iid, node.iid)
    t.is(n.index, node.index)
    t.is(n.pid, node.pid)
    t.is(n.port, node.port)
    t.deepEqual(n.replica, {
        is: false
    })
    t.deepEqual(n.rinfo, {
        address: ip.address()
        , family: 'IPv4'
        , port: 5000
        , size: 266
    })

    t.deepEqual(n.start, { time: null })
    t.deepEqual(n.stop, { time: null })
    t.deepEqual(n.up, { time: null })
})

// test.serial('pick: get node whit delay', async (t) => {
//     const foo = kable('foo')
//     const bar = kable('bar')

//     await foo.up()
//     setTimeout(bar.up, 2000)
//     const pick = await foo.pick('bar')
//     checkNodeRegistre(t, pick, bar)

//     foo.down()
//     bar.down()
// })