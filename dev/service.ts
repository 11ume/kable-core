import { DISCOVERY } from '../lib/constants/events'
import { createStore } from '../lib/store'
import { createDiscovery } from '../lib/discovery'
import { createRepository } from '../lib/repository'
import { createTransport, TransportTypes } from '../lib/transport/transport'
import { createEventsDriver, NodeEmitter } from '../lib/eventsDriver'
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
    const { eventsDriver, transport, discovery } = create('foo')
    const check = (): Promise<NodeEmitter> => new Promise((resolve) => {
        eventsDriver.on(DISCOVERY.ADVERTISEMENT, (registre) => {
            resolve(registre)
        })
    })

    await transport.bind()
    await discovery.start()
    check()
}

main()