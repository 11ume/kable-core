import * as EVENTS from './constants/events'
import { Node, NodeMain, NodeOptions, NodeRegistre, createNode } from './node'
import { Transport, TransportOptionsCompose, TransportTypes, createTransport } from './transport/transport'
import { Discovery, DiscoveryOptions, createDiscovery } from './discovery'
import { DependencyManagerOptions, createdependencyManager, DependencyManager } from './dependency'
import { NodePickerOptions, PickOptions, createNodePicker, NodePicker } from './nodePicker'
import { EventsDriver, createEventsDriver } from './eventsDriver'
import { createRepository, Repository } from './repository'
import { createOrchester, Orchester } from './orchester'
import { createSuscriber, Suscriber, SuscriberFn } from './suscriber'
import { createStore } from './store'

export type KableComposedOptions = NodeOptions
    & DiscoveryOptions
    & NodePickerOptions
    & TransportOptionsCompose
    & DependencyManagerOptions

export interface Kable extends NodeMain {
    /** Start all internals processes and set that node in up state */
    up(running?: boolean): Promise<void>
    /** Terminate all internals processes and set that node in down state */
    down(): Promise<void>
    /** Set that node in running state */
    start(): void
    /** Set that node in stopped state */
    stop(reason?: string): void
    /** Set that node in doing something state */
    doing(reason?: string): void
    /**
     * Request a node by you identificator.
     * This method will wait an default time, if the requested node has not been announced yet.
     * This method can be aborted.
     */
    pick(id: string, options?: PickOptions): Promise<NodeRegistre>
    /** Start to listen only one node state update | registre | unregistred */
    suscribe(id: string, fn: SuscriberFn): void
    /** Start to listen all node state update | registre | unregistred */
    suscribeAll(fn: SuscriberFn): void
    /** Stop listen node state update | registre | unregistred */
    unsubscribe(fn: SuscriberFn): void
}

type FnShutdown = (signal: string, code?: number) => Promise<void>

const handleShutdown = (invoke: FnShutdown) => {
    const handle = (signal: NodeJS.Signals, code = null) => {
        invoke(signal, code)
            .then(() => process.exit(code))
            .catch((err) => process.exit(err ? 1 : 0))
    }

    process.on('SIGINT', handle)
    process.on('SIGTERM', handle)
    return () => {
        process.off('SIGINT', handle)
        process.off('SIGTERM', handle)
    }
}

type UpArgs = {
    node: Node
    , transport: Transport
    , discovery: Discovery
    , eventsDriver: EventsDriver
}

const up = ({
    node
    , transport
    , discovery
    , eventsDriver
}: UpArgs) => async (running = true) => {
    const { stateData } = node
    await transport.bind()
    await discovery.start(running)

    eventsDriver.emit(EVENTS.SYSTEM.UP, {
        payload: {
            time: stateData.up.time
        }
    })
}

type DownArgs = {
    node: Node
    , transport: Transport
    , discovery: Discovery
    , eventsDriver: EventsDriver
    , detachHandleShutdown: () => void  // datach events of main process, to prevent overload of events emitter
}

const down = ({
    node
    , transport
    , discovery
    , eventsDriver
    , detachHandleShutdown }: DownArgs) => async () => {
        const { stateData } = node
        detachHandleShutdown()
        await discovery.stop('down', null)
        await transport.close()

        eventsDriver.emit(EVENTS.SYSTEM.DOWN, {
            payload: {
                time: stateData.down.time
            }
        })
    }

/**
 * Terminate all process in safe way.
 * First it send unregistered event, after stop all internals functions,
 * by last close all socket connections opened.
 */
const downAbrupt = (
    node: Node
    , discovery: Discovery
    , transport: Transport
    , eventsDriver: EventsDriver) => async (signal: string, code?: number) => {
        const { stateData } = node
        await discovery.stop(signal, code)
        await transport.close()

        eventsDriver.emit(EVENTS.SYSTEM.DOWN, {
            payload: {
                time: stateData.down.time
            }
        })
    }

export type Implementables = {
    node: Node
    , suscriber: Suscriber
    , discovery: Discovery
    , orchester: Orchester
    , transport: Transport
    , nodePicker: NodePicker
    , eventsDriver: EventsDriver
    , nodesRepository: Repository<NodeRegistre>
    , dependencyManager: DependencyManager
}

// injectable modules
export const implementables = (options: KableComposedOptions): Implementables => {
    const nodesStore = createStore<NodeRegistre>()
    const eventsDriver = createEventsDriver()
    const nodesRepository = createRepository<NodeRegistre>(nodesStore)
    const node = createNode({
        nodesRepository
        , eventsDriver
        , options: {
            id: options.id
            , host: options.host
            , port: options.port
            , meta: options.meta
            , replica: options.replica
            , ignorable: options.ignorable
            , advertisementTime: options.advertisementTime
        }
    })
    const orchester = createOrchester(nodesRepository)
    const transport = createTransport({
        type: TransportTypes.DGRAM
        , eventsDriver
        , options: {
            key: options.key
            , tport: options.tport
            , taddress: options.taddress
            , unicast: options.unicast
            , multicast: options.multicast
            , broadcast: options.broadcast
            , reuseAddr: options.reuseAddr
            , protocol: options.protocol
        }
    })
    const discovery = createDiscovery({
        node
        , transport
        , eventsDriver
        , nodesRepository
        , options: {
            advertisementTime: node.advertisementTime
            , ignoreProcess: options.ignoreProcess
            , ignoreInstance: options.ignoreInstance
        }
    })
    const dependencyManager = createdependencyManager({
        nodesRepository
        , options: {
            depedencies: options.depedencies
        }
    })
    const nodePicker = createNodePicker({
        orchester
        , options: {
            pickTimeoutOut: options.pickTimeoutOut
        }
    })
    const suscriber = createSuscriber({ eventsDriver })

    return {
        node
        , suscriber
        , discovery
        , orchester
        , transport
        , nodePicker
        , eventsDriver
        , nodesRepository
        , dependencyManager
    }
}

export const KableCore = (impl: Implementables): Kable => {
    const {
        node
        , suscriber
        , transport
        , discovery
        , nodePicker
        , eventsDriver
    } = impl
    const detachHandleShutdown = handleShutdown(downAbrupt(node, discovery, transport, eventsDriver))

    return {
        up: up({
            node
            , transport
            , discovery
            , eventsDriver
        })
        , down: down({
            node
            , transport
            , discovery
            , eventsDriver
            , detachHandleShutdown
        })
        , start: () => {
            node.start()
        }
        , stop: (reason?: string) => {
            node.stop(reason)
        }
        , doing: (reason?: string) => {
            node.doing(reason)
        }
        , pick: (id: string, options?: PickOptions) => {
            return nodePicker.pick(id, options)
        }
        , suscribeAll: (fn: SuscriberFn) => {
            return suscriber.suscribe(fn)
        }
        , suscribe: (id: string, fn: SuscriberFn) => {
            return suscriber.suscribe(fn, id)
        }
        , unsubscribe: (fn: SuscriberFn) => {
            return suscriber.unsubscribe(fn)
        }
        , get id() {
            return node.id
        }
        , get pid() {
            return node.pid
        }
        , get iid() {
            return node.iid
        }
        , get host() {
            return node.host
        }
        , get port() {
            return node.port
        }
        , get meta() {
            return node.meta
        }
        , get state() {
            return node.state
        }
        , get index() {
            return node.index
        }
        , get hostname() {
            return node.hostname
        }
        , get replica() {
            return node.replica
        }
        , get registre() {
            return node.registre
        }
        , get ignorable() {
            return node.ignorable
        }
        , get advertisementTime() {
            return node.advertisementTime
        }
    }
}

const createKable = (id?: string, options?: KableComposedOptions) => {
    const opts = {
        id
        , ...options
    }

    return KableCore(implementables(opts))
}

export default createKable