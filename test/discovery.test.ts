import test from 'ava'
import ip from 'ip'
import { ExecutionContext } from 'ava'
import { DISCOVERY } from '../lib/constants/events'
import { createStore } from '../lib/store'
import { createDiscovery } from '../lib/discovery'
import { createRepository } from '../lib/repository'
import { createTransport, TransportTypes } from '../lib/transport/transport'
import { createEventsDriver, NodeEmitter } from '../lib/eventsDriver'
import { Node, NodeRegistre, createNode } from './../lib/node'

type CheckOptions = {
    id: string
    , size: number
    , port: number
    , event: DISCOVERY
}

const checkRegistre = (
    t: ExecutionContext
    , n: NodeEmitter
    , node: Node
    , opts: CheckOptions) => {
    t.false(n.ensured)
    t.is(n.event, opts.event)
    t.truthy(n.host)
    t.is(n.hostname, node.hostname)
    t.is(n.id, opts.id)
    t.is(n.iid, node.iid)
    t.is(n.index, node.index)
    t.is(n.pid, node.pid)
    t.is(n.port, node.port)
    t.deepEqual(n.replica, {
        is: false
    })
    t.is(n.rinfo.address, ip.address())
    t.is(n.rinfo.family, 'IPv4')
    t.is(n.rinfo.port, opts.port)
    t.true(typeof n.rinfo.size === 'number')
}

const create = (id: string) => {
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
            ignoreInstance: false
        }
    })

    return {
        node
        , transport
        , discovery
        , eventsDriver
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
    checkRegistre(t, n, node, {
        id: 'foo'
        , size: 198
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
    checkRegistre(t, n, node, {
        id: 'foo'
        , size: 206
        , port: 5000
        , event: DISCOVERY.ADVERTISEMENT
    })

    discovery.stop('down')
    transport.close()
})

test.serial('get node unregistre event', async (t) => {
    const { node, eventsDriver, transport, discovery } = create('foo')
    const check = (stop: () => void): Promise<NodeEmitter> => new Promise((resolve) => {
        eventsDriver.on(DISCOVERY.UNREGISTRE, (registre) => {
            resolve(registre)
            stop()
        })
    })

    await transport.bind()
    await discovery.start()
    discovery.stop('down')

    const n = await check(transport.close)
    checkRegistre(t, n, node, {
        id: 'foo'
        , size: 221
        , port: 5000
        , event: DISCOVERY.UNREGISTRE
    })
})

test.serial('check node detection', async (t) => {
    const foo = create('foo')
    const bar = create('bar')
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
    checkRegistre(t, n, bar.node, {
        id: 'bar'
        , size: 221
        , port: 5000
        , event: DISCOVERY.HELLO
    })

    foo.discovery.stop('down')
    foo.transport.close()

    bar.discovery.stop('down')
    bar.transport.close()

})