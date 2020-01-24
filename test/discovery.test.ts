import test from 'ava'
import { DISCOVERY, NODE_REGISTRE } from '../lib/constants/events'
import { createStore } from '../lib/store'
import { createDiscovery } from '../lib/discovery'
import { createRepository } from '../lib/repository'
import { createTransport, TransportTypes } from '../lib/transport/transport'
import { NodeRegistre, createNode } from './../lib/node'
import { checkEmitterData } from './utils/helpers'
import {
    createEventsDriver
    , NodeEmitter
    , NodeRegistreRemoveEmitter
    , NodeRegistreAddEmitter
} from '../lib/eventsDriver'

const create = (id: string, ignoreInstance = false) => {
    const nodesStore = createStore<NodeRegistre>()
    const eventsDriver = createEventsDriver()
    const nodesRepository = createRepository<NodeRegistre>(nodesStore)
    const node = createNode({
        options: {
            id
        }
    })
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
            ignoreInstance
        }
    })

    return {
        node
        , transport
        , discovery
        , eventsDriver
        , nodesRepository
    }
}

test.serial('get node hello event', async (t) => {
    const { node, eventsDriver, transport, discovery } = create('foo')
    const check = (): Promise<NodeEmitter> => new Promise((resolve) => {
        eventsDriver.on(DISCOVERY.HELLO, resolve)
    })

    await transport.bind()
    await discovery.start()

    const n = await check()
    checkEmitterData(t, n, node, {
        id: 'foo'
        , port: 5000
        , event: DISCOVERY.HELLO
    })

    discovery.stop('down')
    transport.close()
})

test.serial('get node advertisement event', async (t) => {
    const { node, eventsDriver, transport, discovery } = create('foo')
    const check = (): Promise<NodeEmitter> => new Promise((resolve) => {
        eventsDriver.on(DISCOVERY.ADVERTISEMENT, resolve)
    })

    await transport.bind()
    await discovery.start()

    const n = await check()
    checkEmitterData(t, n, node, {
        id: 'foo'
        , port: 5000
        , event: DISCOVERY.ADVERTISEMENT
    })

    discovery.stop('down')
    transport.close()
})

test.serial('get node unregistre event', async (t) => {
    const { node, eventsDriver, transport, discovery } = create('foo')
    const check = (): Promise<NodeEmitter> => new Promise((resolve) => {
        eventsDriver.on(DISCOVERY.UNREGISTRE, (registre) => {
            resolve(registre)
        })
    })

    await transport.bind()
    await discovery.start()
    discovery.stop('down')

    const n = await check()
    checkEmitterData(t, n, node, {
        id: 'foo'
        , port: 5000
        , event: DISCOVERY.UNREGISTRE
    })

    transport.close()
})

test.serial('check node hello event', async (t) => {
    const foo = create('foo', true)
    const bar = create('bar', true)
    const check = (): Promise<NodeEmitter> => new Promise((resolve) => {
        foo.eventsDriver.on(DISCOVERY.HELLO, (registre) => {
            resolve(registre)
        })
    })

    await bar.transport.bind()
    await foo.transport.bind()
    await bar.discovery.start()
    await foo.discovery.start()

    const n = await check()
    checkEmitterData(t, n, bar.node, {
        id: 'bar'
        , port: 5000
        , event: DISCOVERY.HELLO
    })

    foo.discovery.stop('down')
    foo.transport.close()

    bar.discovery.stop('down')
    bar.transport.close()
})

test.serial('check node remove event', async (t) => {
    const foo = create('foo', true)
    const bar = create('bar', true)
    const check = (): Promise<NodeRegistreRemoveEmitter> => new Promise((resolve) => {
        foo.eventsDriver.on(NODE_REGISTRE.REMOVE, (registre) => {
            resolve(registre)
        })
    })

    await foo.transport.bind()
    await bar.transport.bind()
    await foo.discovery.start()
    await bar.discovery.start()
    bar.discovery.stop('down')

    const n = await check()
    t.is(n.payload.nodeRegistre.id, 'bar')

    foo.discovery.stop('down')
    foo.transport.close()
    bar.transport.close()
})

test.serial('check node add event', async (t) => {
    const foo = create('foo', true)
    const bar = create('bar', true)
    const check = (): Promise<NodeRegistreAddEmitter> => new Promise((resolve) => {
        foo.eventsDriver.on(NODE_REGISTRE.ADD, (registre) => {
            resolve(registre)
        })
    })

    await foo.transport.bind()
    await bar.transport.bind()
    await foo.discovery.start()
    await bar.discovery.start()

    const n = await check()
    t.is(n.payload.nodeRegistre.id, 'bar')

    bar.discovery.stop('down')
    foo.discovery.stop('down')
    foo.transport.close()
    bar.transport.close()
})