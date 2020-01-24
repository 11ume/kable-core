import { NODE_REGISTRE } from '../lib/constants/events'
import { createStore } from '../lib/store'
import { createDiscovery } from '../lib/discovery'
import { createRepository } from '../lib/repository'
import { createTransport, TransportTypes } from '../lib/transport/transport'
import { createEventsDriver, NodeRegistreRemoveEmitter } from '../lib/eventsDriver'
import { NodeRegistre, createNode } from './../lib/node'

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

const main = async () => {
    const foo = create('foo')
    const bar = create('bar')
    const check = (): Promise<NodeRegistreRemoveEmitter> => new Promise((resolve) => {
        foo.eventsDriver.on(NODE_REGISTRE.REMOVE, (registre) => {
            resolve(registre)
        })
    })

    await bar.transport.bind()
    await foo.transport.bind()
    await bar.discovery.start()

    bar.discovery.stop('down')

    const n = await check()
    console.log(n)
    foo.discovery.stop('down')
    foo.transport.close()
    bar.transport.close()
}

main()