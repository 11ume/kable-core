import { Repository } from './repository'
import * as os from 'os'
import * as EVENTS from './constants/events'
import * as EVENTS_TYPES from './constants/eventTypes'
import { createUuid, craateStateMachine, genRandomNumber, getDateNow, fnPatch } from './utils/utils'
import { pid } from './constants/core'
import { EventsDriver } from './eventsDriver'

export enum NODE_STATES {
    UP = 'UP'
    , DOWN = 'DOWN'
    , RUNNING = 'RUNNING'
    , STOPPED = 'STOPPED'
    , DOING_SOMETHING = 'DOING_SOMETHING'
}

export type DuplicatedNodePayload = {
    id: string
    , iid: string
    , port: number
    , address: string
}

export type NodeMetadata = {
    id?: string
    , description?: string
    , payload?: Buffer
}

export type NodeUp = {
    time: number
}

export type NodeDown = {
    code: number
    , time: number
    , signal: string
}

export type NodeDoing = {
    time?: number
    , reason?: string
}

export type NodeStart = {
    time: number
}

export type NodeStop = {
    time: number
    , reason?: string
}

export enum NODE_UNREGISTRE_REASON {
    TERMINATION = 'TERMINATION'
    , TIMEOUT = 'TIMEOUT'
}

export interface NodeMain {
    /** Node id, must be unique by network */
    id: string
    /** Node process unique idetificator */
    pid: string
    /** Node instance unique idetificator */
    iid: string
    /** Node host default 0.0.0.0 */
    host: string
    /** Node port default 3000 */
    port: number
    /** Node metadata */
    meta?: NodeMetadata
    /** Node states */
    state: NODE_STATES
    /** Unique random number used for organizate the nodes workflow, who own replicated nodes */
    index: number
    /** Node os hostname */
    hostname: string
    /** Node is replica */
    replica: NodeReplica
    /** Node registre */
    registre?: string[]
}

export interface NodeBase extends NodeMain {
    stateData: {
        up: NodeUp
        , down?: NodeDown
        , stop?: NodeStop
        , start?: NodeStart
        , doing?: NodeDoing
    }
}

export type NodeReplica = {
    is: boolean
    , of?: string
}
export interface NodeRegistre extends NodeBase {
    ensured: boolean
    , lastSeen: number
    , meta: NodeMetadata
}

export interface NodePacket extends NodeBase {
    event: EVENTS.DISCOVERY
}

export interface Node extends NodeBase {
    up: (running?: boolean) => void
    , down: () => void
    , start: () => void
    , stop: (reason?: string) => void
    , doing: (reason?: string) => void
    , stateReset: (state: NODE_STATES) => void
    , stateTransit: (newState: NODE_STATES) => void
}

export type NodeOptions = {
    id?: string
    , host?: string
    , port?: number
    , meta?: NodeMetadata
    , replica?: boolean
}

type FnTrasitState = <T extends string>(currentState: string, newState: T) => T

type Replica = {
    is: boolean
    , of?: string
}

type NodeStates = {
    up: NodeUp
    , down: NodeDown
    , stop: NodeStop
    , start: NodeStart
    , doing: NodeDoing
}

const handleId = (initReplica: Replica, initId: string) => initReplica.is ? convertToReplicaId(initId) : initId
export const convertToReplicaId = (id: string) => `${id}:${createUuid()}`
export const nodeStates = {
    [NODE_STATES.UP]: [NODE_STATES.RUNNING, NODE_STATES.DOING_SOMETHING, NODE_STATES.STOPPED, NODE_STATES.DOWN]
    , [NODE_STATES.DOWN]: [NODE_STATES.UP]
    , [NODE_STATES.RUNNING]: [NODE_STATES.DOING_SOMETHING, NODE_STATES.STOPPED, NODE_STATES.DOWN]
    , [NODE_STATES.STOPPED]: [NODE_STATES.DOING_SOMETHING, NODE_STATES.RUNNING, NODE_STATES.DOWN]
    , [NODE_STATES.DOING_SOMETHING]: [NODE_STATES.DOING_SOMETHING, NODE_STATES.RUNNING, NODE_STATES.STOPPED, NODE_STATES.DOWN]
}

const hostname = os.hostname()
const nodeOptions: NodeOptions = {
    id: hostname
    , port: 3000
    , host: '0.0.0.0'
    , meta: null
    , replica: false
}

const handleReplica = (is: boolean, id: string) => {
    const replica = {
        is
        , of: ''
    }

    replica.is ? replica.of = id : delete replica.of
    return replica
}

const stateTransit = (node: Node, smt: FnTrasitState) => (newState: NODE_STATES) => {
    node.state = smt(node.state, newState)
}

const stateReset = (initialState: NodeStates, stateData: NodeStates) => (state: NODE_STATES) => {
    if (state !== NODE_STATES.STOPPED) {
        stateData.stop = {
            ...initialState.stop
        }
    }

    if (state !== NODE_STATES.RUNNING) {
        stateData.start = {
            ...initialState.start
        }
    }

    if (state !== NODE_STATES.DOING_SOMETHING) {
        stateData.doing = {
            ...initialState.doing
        }
    }
}

const up = (node: Node) => (running: boolean) => {
    const { stateData } = node
    let state: NODE_STATES = null
    stateData.up.time = getDateNow()
    node.stateReset(state)

    if (running) {
        state = NODE_STATES.RUNNING
        node.stateTransit(NODE_STATES.UP)
        node.stateTransit(NODE_STATES.RUNNING)
        return state
    }

    state = NODE_STATES.UP
    node.stateTransit(NODE_STATES.UP)

    return state
}

const down = (node: Node) => () => {
    const { stateData } = node
    const state = NODE_STATES.DOWN
    stateData.down.time = getDateNow()
    node.stateReset(state)
    node.stateTransit(state)

    return state
}

const start = (node: Node, eventsDriver: EventsDriver) => () => {
    const { stateData } = node
    const time = getDateNow()
    const state = NODE_STATES.RUNNING
    stateData.start.time = time
    node.stateReset(state)
    node.stateTransit(state)

    eventsDriver.emit(EVENTS.NODE.UPDATE, {
        type: EVENTS_TYPES.NODE_UPDATE_TYPES.START
        , payload: {
            time
        }
    })
}

const stop = (node: Node, eventsDriver: EventsDriver) => (reason: string = null) => {
    const { stateData } = node
    const time = getDateNow()
    const state = NODE_STATES.STOPPED
    stateData.stop.time = time
    stateData.stop.reason = reason
    node.stateReset(state)
    node.stateTransit(state)

    eventsDriver.emit(EVENTS.NODE.UPDATE, {
        type: EVENTS_TYPES.NODE_UPDATE_TYPES.STOP
        , payload: {
            time
            , reason
        }
    })
}

const doing = (node: Node, eventsDriver: EventsDriver) => (reason: string = null) => {
    const { stateData } = node
    const time = getDateNow()
    const state = NODE_STATES.DOING_SOMETHING
    stateData.doing.time = time
    stateData.doing.reason = reason
    node.stateReset(state)
    node.stateTransit(state)

    eventsDriver.emit(EVENTS.NODE.UPDATE, {
        type: EVENTS_TYPES.NODE_UPDATE_TYPES.DOING
        , payload: {
            time
            , reason
        }
    })
}

const onAddNodeRegistre = (nodeIdsRegistre: string[], id: string) => {
    if (nodeIdsRegistre.includes(id)) return
    nodeIdsRegistre.push(id)
}

const onRemoveNodeRegistre = (nodeIdsRegistre: string[], id: string) => {
    return nodeIdsRegistre.filter((i) => i !== id)
}

type NodeSuperArgs = {
    id: string
    , host: string
    , port: number
    , meta: NodeMetadata
    , replica: boolean
    , nodesRepository: Repository<NodeRegistre>
}

const NodeMain = (args: NodeSuperArgs): NodeMain => {
    const { host, port, meta, nodesRepository } = args
    const iid = createUuid()
    const index = genRandomNumber()
    const replica = handleReplica(args.replica, args.id)
    const id = handleId(replica, args.id)
    const nodeIdsRegistre: string[] = []
    let state = NODE_STATES.DOWN

    fnPatch('add', nodesRepository, (_: string, nodeRegistre: NodeRegistre) => {
        onAddNodeRegistre(nodeIdsRegistre, nodeRegistre.id)
    })

    fnPatch('remove', nodesRepository, (_: string, nodeRegistre: NodeRegistre) => {
        onRemoveNodeRegistre(nodeIdsRegistre, nodeRegistre.id)
    })

    return {
        id
        , host
        , port
        , pid
        , iid
        , index
        , replica
        , hostname
        , get registre() {
            return nodeIdsRegistre
        }
        , get meta() {
            return meta
        }
        , set state(value: NODE_STATES) {
            state = value
        }
        , get state() {
            return state
        }
    }
}

type NodeArgs = {
    eventsDriver: EventsDriver
    , nodesRepository: Repository<NodeRegistre>
    , options?: NodeOptions
}

const Node = ({
    eventsDriver
    , nodesRepository
    , options: {
        id = nodeOptions.id
        , host = nodeOptions.host
        , port = nodeOptions.port
        , meta = nodeOptions.meta
        , replica = nodeOptions.replica
    } = nodeOptions }: NodeArgs): Node => {
    const nodeSuper = NodeMain({
        id
        , host
        , port
        , meta
        , replica
        , nodesRepository
    })
    const initialStateData: NodeStates = {
        up: {
            time: null
        }
        , down: {
            time: null
            , signal: null
            , code: null
        }
        , start: {
            time: null
        }
        , stop: {
            time: null
            , reason: null
        }
        , doing: {
            time: null
            , reason: null
        }
    }
    const stateMachineTransition = craateStateMachine(nodeStates)
    const stateData = { ...initialStateData }
    const node: Node = {
        ...nodeSuper
        , up: null
        , down: null
        , start: null
        , stop: null
        , doing: null
        , stateTransit: null
        , stateReset: stateReset(initialStateData, stateData)
        , stateData: {
            set up(value: NodeUp) {
                stateData.up = value
            }
            , get up() {
                return stateData.up
            }
            , set down(value: NodeDown) {
                stateData.down = value
            }
            , get down() {
                return stateData.down
            }
            , get stop() {
                return stateData.stop
            }
            , set stop(value: NodeStop) {
                stateData.stop = value
            }
            , get start() {
                return stateData.start
            }
            , set start(value: NodeStart) {
                stateData.start = value
            }
            , get doing() {
                return stateData.doing
            }
            , set doing(value: NodeDoing) {
                stateData.doing = value
            }
        }
    }

    node.up = up(node)
    node.down = down(node)
    node.start = start(node, eventsDriver)
    node.stop = stop(node, eventsDriver)
    node.doing = doing(node, eventsDriver)
    node.stateTransit = stateTransit(node, stateMachineTransition)
    return node
}

export const createNode = (args: NodeArgs) => {
    return Node(args)
}
