import * as os from 'os'
import * as EVENTS from './constants/events'
import { createUuid, craateStateMachine, genRandomNumber } from './utils/utils'
import { pid } from './constants/core'

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

export interface NodeSuper {
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
}

export interface NodeBase extends NodeSuper {
    up: NodeUp
    , down?: NodeDown
    , stop?: NodeStop
    , start?: NodeStart
    , doing?: NodeDoing
    , state: NODE_STATES
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
    resetStates: (state: NODE_STATES) => void
    , transitState: (newState: NODE_STATES) => void
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

const transitState = (node: NodeSuper, smt: FnTrasitState) => (newState: NODE_STATES) => {
    node.state = smt(node.state, newState)
}

const resetStates = (initialState: NodeStates, states: NodeStates) => (state: NODE_STATES) => {
    if (state !== NODE_STATES.STOPPED) {
        states.stop = {
            ...initialState.stop
        }
    }

    if (state !== NODE_STATES.RUNNING) {
        states.start = {
            ...initialState.start
        }
    }

    if (state !== NODE_STATES.DOING_SOMETHING) {
        states.doing = {
            ...initialState.doing
        }
    }
}

type NodeSuperArgs = {
    id: string
    , host: string
    , port: number
    , meta: NodeMetadata
    , replica: boolean
}

const NodeSuper = (args: NodeSuperArgs): NodeSuper => {
    const { host, port, meta } = args
    const iid = createUuid()
    const index = genRandomNumber()
    const replica = handleReplica(args.replica, args.id)
    const id = handleId(replica, args.id)
    let state = NODE_STATES.DOWN

    return {
        id
        , host
        , port
        , pid
        , iid
        , index
        , replica
        , hostname
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
    options?: NodeOptions
}

const Node = ({
    options: {
        id = nodeOptions.id
        , host = nodeOptions.host
        , port = nodeOptions.port
        , meta = nodeOptions.meta
        , replica = nodeOptions.replica
    } = nodeOptions }: NodeArgs): Node => {
    const stateMachineTransition = craateStateMachine(nodeStates)
    const initialState: NodeStates = Object.freeze({
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
    })

    const states = { ...initialState }
    const nodeSuper = NodeSuper({
        id
        , host
        , port
        , meta
        , replica
    })

    const node: Node = {
        ...nodeSuper
        , transitState: transitState(nodeSuper, stateMachineTransition)
        , resetStates: resetStates(initialState, states)
        , set up(value: NodeUp) {
            states.up = value
        }
        , get up() {
            return states.up
        }
        , set down(value: NodeDown) {
            states.down = value
        }
        , get down() {
            return states.down
        }
        , get stop() {
            return states.stop
        }
        , set stop(value: NodeStop) {
            states.stop = value
        }
        , get start() {
            return states.start
        }
        , set start(value: NodeStart) {
            states.start = value
        }
        , get doing() {
            return states.doing
        }
        , set doing(value: NodeDoing) {
            states.doing = value
        }
    }

    return node
}

export const createNode = (args?: NodeArgs) => {
    return Node(args)
}
