import test from 'ava'
import * as EVENTS from '../lib/constants/events'
import { createStore } from '../lib/store'
import { createDiscovery } from '../lib/discovery'
import { createRepository } from '../lib/repository'
import { createTransport, TransportTypes } from '../lib/transport/transport'
import { NodeRegistre, createNode } from './../lib/node'
import { checkEmitterData } from '../lib/utils/helpers'
import {
    createEventsDriver
    , NodeEmitter
    , NodeRegistreRemoveEmitter
    , NodeRegistreAddEmitter
} from '../lib/eventsDriver'

type CreateOptions = {
    ignorable?: boolean
    , ignoreInstance?: boolean
}

const create = (id: string, options: CreateOptions = { ignorable: false, ignoreInstance: false }) => {
    const eventsDriver = createEventsDriver()
    const nodesStore = createStore<NodeRegistre>()
    const nodesRepository = createRepository<NodeRegistre>(nodesStore)
    const node = createNode({
        nodesRepository
        , eventsDriver
        , options: {
            id
            , ignorable: options.ignorable
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
            ignoreInstance: options.ignoreInstance
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

test.serial('get node advertisement event', async (t) => {
    const { node, eventsDriver, transport, discovery } = create('foo')
    const check = (): Promise<NodeEmitter> => new Promise((resolve) => {
        eventsDriver.on(EVENTS.DISCOVERY.ADVERTISEMENT, resolve)
    })

    await transport.bind()
    await discovery.start()

    const n = await check()
    checkEmitterData(t, node, n, {
        id: 'foo'
        , port: 5000
        , event: EVENTS.DISCOVERY.ADVERTISEMENT
    })

    discovery.stop('down')
    transport.close()
})

test.serial('get node unregistre event', async (t) => {
    const { node, eventsDriver, transport, discovery } = create('foo')
    const check = (): Promise<NodeEmitter> => new Promise((resolve) => {
        eventsDriver.on(EVENTS.DISCOVERY.UNREGISTRE, resolve)
    })

    await transport.bind()
    await discovery.start()
    discovery.stop('down')

    const n = await check()
    checkEmitterData(t, node, n, {
        id: 'foo'
        , port: 5000
        , event: EVENTS.DISCOVERY.UNREGISTRE
    })

    transport.close()
})

test.serial('check node remove event', async (t) => {
    const foo = create('foo', { ignoreInstance: true })
    const bar = create('bar', { ignoreInstance: true })
    const check = (): Promise<NodeRegistreRemoveEmitter> => new Promise((resolve) => {
        foo.eventsDriver.on(EVENTS.NODE_REGISTRE.REMOVE, resolve)
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
    const foo = create('foo', { ignoreInstance: true })
    const bar = create('bar', { ignoreInstance: true })
    const check = (): Promise<NodeRegistreAddEmitter> => new Promise((resolve) => {
        foo.eventsDriver.on(EVENTS.NODE_REGISTRE.ADD, resolve)
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

test.serial('check ingnorable', async (t) => {
    const fNode = create('foo', { ignoreInstance: true })
    const bNode = create('bar', { ignorable: true })
    const check = (): Promise<NodeEmitter> => new Promise((resolve) => {
        fNode.eventsDriver.on(EVENTS.DISCOVERY.ADVERTISEMENT, resolve)
        setTimeout(resolve, 2000)
    })

    await fNode.transport.bind()
    await fNode.discovery.start()
    await bNode.transport.bind()
    await bNode.discovery.start()

    const n = await check()
    t.falsy(n)

    fNode.discovery.stop('down')
    fNode.transport.close()
    bNode.discovery.stop('down')
    bNode.transport.close()
})