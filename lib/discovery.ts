import cleanDeep from 'clean-deep'
import createIntervalHandler, { IntervalHandler } from 'interval-handler'
import * as EVENTS from './constants/events'
import * as EVENTS_TYPES from './constants/eventTypes'
import { getDateNow } from './utils/utils'
import { Repository } from './repository'
import { Transport } from './transport/transport'
import { EventsDriver, NodeEmitter } from './eventsDriver'
import {
    Node
    , NodeUp
    , NodeDown
    , NodeStop
    , NodeStart
    , NodePacket
    , NodeRegistre
    , NodeDoing
    , DuplicatedNodePayload
    , NODE_STATES
    , NODE_UNREGISTRE_REASON
} from './node'

export type Discovery = {
    start: (running?: boolean) => Promise<void | Error>
    , stop: (signal: string, code?: number) => Promise<void | Error>
}

export type DiscoveryOptions = {
    ignoreProcess?: boolean
    , ignoreInstance?: boolean
}

type SendPayload = {
    state: NODE_STATES
    , up?: NodeUp
    , down?: NodeDown
    , stop?: NodeStop
    , start?: NodeStart
    , doing?: NodeDoing
}

type TodoPreview = Omit<DiscoveryOptions, 'adTime'>

const discoveryOptions: TodoPreview = {
    ignoreProcess: false
    , ignoreInstance: true
}

const wildcards = ['0.0.0.0', '::']

const onSendError = (eventsDriver: EventsDriver, event: EVENTS_TYPES.ERROR_TYPES) => (err: Error) => {
    eventsDriver.emit(EVENTS.UNIVERSAL.ERROR, {
        type: event
        , err
    })

    return err
}

const onDuplicatedIdError = (eventsDriver: EventsDriver, duplicatedId: DuplicatedNodePayload) => {
    eventsDriver.emit(EVENTS.UNIVERSAL.ERROR, {
        type: EVENTS_TYPES.CUSTOM_ERROR_TYPE.DUPLICATE_NODE_ID
        , payload: duplicatedId
    })
}

const addNodeToRepository = (nodesRepository: Repository<NodeRegistre>
    , nodeRegistre: Partial<NodeRegistre>) => {
    nodesRepository.add(nodeRegistre.index, (nodeRegistre as NodeRegistre))
}

const removeNodeFromRepository = (nodesRepository: Repository<NodeRegistre>
    , nodeRegistre: NodeRegistre
    , reason: NODE_UNREGISTRE_REASON) => {
    nodesRepository.remove(nodeRegistre.index, nodeRegistre, reason)
}

const checkNodesTimeout = (nodesRepository: Repository<NodeRegistre>
    , nodeTimeout: number) => {
    for (const node of nodesRepository.getAll()) {
        const timeElapsed = Math.abs(node.lastSeen - getDateNow())
        const timeOut = Math.abs(nodeTimeout / 1000)
        if (timeElapsed >= timeOut) {
            removeNodeFromRepository(nodesRepository
                , node
                , NODE_UNREGISTRE_REASON.TIMEOUT)
        }
    }
}

const manageDataToStoreInRegistre = ({
    id
    , port
    , host
    , pid
    , iid
    , meta = null
    , index
    , replica
    , ensured
    , hostname
    , registre
    , adTime
    , ignorable
    , stateData: {
        up
        , down = null
        , stop = null
        , start = null
        , doing = null
    }
    , state }: NodeEmitter): Partial<NodeRegistre> => {
    const lastSeen = getDateNow()
    const data: NodeRegistre = {
        id
        , port
        , host
        , pid
        , iid
        , meta
        , index
        , replica
        , ensured
        , hostname
        , registre
        , adTime
        , ignorable
        , state
        , lastSeen
        , stateData: {
            up
            , down
            , stop
            , start
            , doing
        }
    }

    return cleanDeep(data)
}

const handleNodeUnregistre = (eventsDriver: EventsDriver
    , nodesRepository: Repository<NodeRegistre>
    , payload: NodeEmitter) => {
    const {
        id
        , port
        , host
        , pid
        , iid
        , index
        , meta
        , replica
        , ensured
        , hostname
        , registre
        , adTime
        , ignorable
        , state
        , stateData: {
            up
            , down
            , stop
            , start
            , doing
        }
    } = payload

    const nodeRegistre = {
        id
        , port
        , host
        , pid
        , iid
        , meta
        , index
        , replica
        , ensured
        , hostname
        , registre
        , adTime
        , ignorable
        , state
        , lastSeen: null
        , stateData: {
            up
            , down
            , stop
            , start
            , doing
        }
    }

    eventsDriver.emit(EVENTS.NODE.EXTERNAL_ACTION, payload)
    removeNodeFromRepository(nodesRepository
        , nodeRegistre
        , NODE_UNREGISTRE_REASON.TERMINATION)
}

const handleNodeUpdate = (eventsDriver: EventsDriver
    , nodesRepository: Repository<NodeRegistre>
    , payload: NodeEmitter) => {
    eventsDriver.emit(EVENTS.NODE.EXTERNAL_ACTION, payload)
    addNodeToRepository(nodesRepository, manageDataToStoreInRegistre(payload))
}

const handleNodeAdvertisement = (eventsDriver: EventsDriver
    , nodesRepository: Repository<NodeRegistre>
    , payload: NodeEmitter) => {
    eventsDriver.emit(EVENTS.NODE.EXTERNAL_ACTION, payload)
    addNodeToRepository(nodesRepository, manageDataToStoreInRegistre(payload))
}

const recibeMessageSwitch = (nodesRepository: Repository<NodeRegistre>
    , eventsDriver: EventsDriver
    , payload: NodeEmitter) => ({
        [EVENTS.DISCOVERY.UPDATE]: () => handleNodeUpdate(eventsDriver, nodesRepository, payload)
        , [EVENTS.DISCOVERY.UNREGISTRE]: () => handleNodeUnregistre(eventsDriver, nodesRepository, payload)
        , [EVENTS.DISCOVERY.ADVERTISEMENT]: () => handleNodeAdvertisement(eventsDriver, nodesRepository, payload)
    })[payload.event]

const handleRecibedMessage = (nodesRepository: Repository<NodeRegistre>
    , eventsDriver: EventsDriver
    , payload: NodeEmitter) => {
    recibeMessageSwitch(nodesRepository, eventsDriver, payload)()
    eventsDriver.emit(payload.event, payload)
}

const checkNodeDuplicateId = (node: Node, { id, iid, port, rinfo: { address } }: NodeEmitter): DuplicatedNodePayload => {
    const ref: DuplicatedNodePayload = {
        id
        , iid
        , port
        , address
    }

    const checkIsDuplicatedNode = node.id === id && node.iid !== iid
    return checkIsDuplicatedNode ? ref : null
}

const checkNodeIgnore = (node: Node, ignoreProcess: boolean, ignoreInstance: boolean, payload: NodeEmitter) => {
    const isSameProcess = ignoreProcess && payload.pid === node.pid
    const isSameInstance = ignoreInstance && payload.iid === node.iid
    return (isSameProcess || isSameInstance) ? true : false
}

const matcWildcardAddress = (host: string, wcards: string[]) => Boolean(wcards.find((h) => h === host))

const resolvetHostResolutionAddress = (payload: NodeEmitter) => {
    const newPayload = Object.assign({}, payload)
    if (matcWildcardAddress(payload.host, wildcards)) {
        newPayload.host = newPayload.rinfo.address
    }

    return newPayload
}

const send = (transport: Transport
    , node: Node
    , event: EVENTS.DISCOVERY
    , { state
        , up
        , down = null
        , start = null
        , stop = null
        , doing = null }: SendPayload) => {

    const {
        id
        , pid
        , iid
        , port
        , host
        , meta
        , index
        , replica
        , hostname
        , registre
        , adTime
        , ignorable
    } = node

    const data = {
        id
        , pid
        , iid
        , port
        , host
        , event
        , meta
        , index
        , replica
        , hostname
        , registre
        , adTime
        , ignorable
        , state
        , stateData: {
            up
            , down
            , stop
            , start
            , doing
        }
    }

    return transport.send<NodePacket>(data)
}

const onRecibeMessage = (node: Node
    , ignoreProcess: boolean
    , ignoreInstance: boolean
    , nodesRepository: Repository<NodeRegistre>
    , eventsDriver: EventsDriver) => (payload: NodeEmitter) => {
        let newPayload = Object.assign({}, payload)
        const duplicatedNode = checkNodeDuplicateId(node, newPayload)
        if (duplicatedNode) {
            onDuplicatedIdError(eventsDriver, duplicatedNode)
            return
        }

        if (payload.ignorable) return
        if (checkNodeIgnore(node, ignoreProcess, ignoreInstance, newPayload)) return
        newPayload = resolvetHostResolutionAddress(newPayload)
        handleRecibedMessage(nodesRepository, eventsDriver, newPayload)
    }

const sendNodeAdvertisement = (transport: Transport
    , node: Node
    , eventsDriver: EventsDriver
    , payload: SendPayload) => {
    return send(transport, node, EVENTS.DISCOVERY.ADVERTISEMENT, payload)
        .catch(onSendError(eventsDriver, EVENTS_TYPES.ERROR_TYPES.DISCOVERY_SEND_ADVERTISEMENT))
}

const sendNodeUpdate = (transport: Transport
    , node: Node
    , eventsDriver: EventsDriver
    , payload: SendPayload) => {
    return send(transport, node, EVENTS.DISCOVERY.UPDATE, payload)
        .catch(onSendError(eventsDriver, EVENTS_TYPES.ERROR_TYPES.DISCOVERY_SEND_UPDATE))
}

const sendNodeUnregistre = (transport: Transport
    , node: Node
    , eventsDriver: EventsDriver
    , payload: SendPayload) => {
    return send(transport, node, EVENTS.DISCOVERY.UNREGISTRE, payload)
        .catch(onSendError(eventsDriver, EVENTS_TYPES.ERROR_TYPES.DISCOVERY_SEND_UNREGISTRE))
}

// node timeout always must be greater to advertisement Time
const setNodeTimeOut = (adTime: number, nodeDefaultTimeout: number) => adTime + nodeDefaultTimeout

const handleStateUp = ({ stateData }: Node) => {
    const up: NodeUp = {
        time: stateData.up.time
    }

    return {
        up
    }
}

const handleStateDown = ({ stateData }: Node, signal: string, code: number) => {
    const down: NodeDown = {
        signal
        , code
        , time: stateData.down.time
    }

    return {
        down
    }
}

const handleStateStop = ({ stateData }: Node) => {
    const stop: NodeStop = {
        time: stateData.stop.time
        , reason: stateData.stop.reason
    }

    return {
        stop
    }
}

const handleStateStart = ({ stateData }: Node) => {
    const start: NodeStart = {
        time: stateData.start.time
    }

    return {
        start
    }
}

const handleStateDoing = ({ stateData }: Node) => {
    const doing: NodeDoing = {
        time: stateData.doing.time
        , reason: stateData.doing.reason
    }

    return {
        doing
    }
}

const handleState = (node: Node, signal?: string, code?: number) => {
    return {
        state: node.state
        , ...handleStateUp(node)
        , ...handleStateStart(node)
        , ...handleStateStop(node)
        , ...handleStateDoing(node)
        , ...handleStateDown(node, signal, code)
    }
}

type StopArgs = {
    transport: Transport
    , node: Node
    , eventsDriver: EventsDriver
    , nodesRepository: Repository<NodeRegistre>
    , ihNodeTimeout: IntervalHandler
    , ihAdvertisamentTime: IntervalHandler
}

const stop = ({
    transport
    , node
    , eventsDriver
    , nodesRepository
    , ihNodeTimeout
    , ihAdvertisamentTime }: StopArgs) => (signal: string, code?: number) => {
        node.down()
        ihAdvertisamentTime.stop()
        ihNodeTimeout.stop()
        nodesRepository.clearAll()
        return sendNodeUnregistre(transport, node, eventsDriver, handleState(node, signal, code))
    }

type StartArgs = {
    node: Node
    , transport: Transport
    , eventsDriver: EventsDriver
    , ihNodeTimeout: IntervalHandler
    , ihAdvertisamentTime: IntervalHandler
}

const start = ({
    node
    , transport
    , eventsDriver
    , ihNodeTimeout
    , ihAdvertisamentTime }: StartArgs) => (running?: boolean) => {
        node.up(running)
        ihAdvertisamentTime.start()
        ihNodeTimeout.start()
        return sendNodeAdvertisement(transport, node, eventsDriver, handleState(node))
    }

type DiscoveryArgs = {
    node: Node
    , transport: Transport
    , eventsDriver: EventsDriver
    , nodesRepository: Repository<NodeRegistre>
    , adTime: number
    , options?: DiscoveryOptions
}

// This module contains the main logic of the service discovery
const discovery = ({
    node
    , transport
    , eventsDriver
    , nodesRepository
    , adTime
    , options: {
        ignoreProcess = discoveryOptions.ignoreProcess
        , ignoreInstance = discoveryOptions.ignoreInstance
    } = discoveryOptions }: DiscoveryArgs): Discovery => {
    const nodeDefaultTimeout = 1000
    const nodeTimeout = setNodeTimeOut(adTime, nodeDefaultTimeout)
    const ihNodeTimeout = createIntervalHandler(nodeTimeout, () => checkNodesTimeout(nodesRepository, nodeTimeout))
    const ihAdvertisamentTime = createIntervalHandler(adTime, () => sendNodeAdvertisement(transport, node, eventsDriver, handleState(node)))

    eventsDriver.on(EVENTS.TRANSPORT.MESSAGE, onRecibeMessage(node
        , ignoreProcess
        , ignoreInstance
        , nodesRepository
        , eventsDriver))

    eventsDriver.on(EVENTS.NODE.UPDATE, () => sendNodeUpdate(transport
        , node
        , eventsDriver
        , handleState(node)))

    return {
        start: start({
            node
            , transport
            , eventsDriver
            , ihNodeTimeout
            , ihAdvertisamentTime
        })
        , stop: stop({
            node
            , transport
            , eventsDriver
            , nodesRepository
            , ihNodeTimeout
            , ihAdvertisamentTime
        })
    }
}

export const createDiscovery = (args: DiscoveryArgs) => discovery(args)
