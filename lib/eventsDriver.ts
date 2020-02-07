import { RemoteInfo } from 'dgram'
import events, { EventEmitter } from 'events'
import * as EVENTS from './constants/events'
import * as EVENTS_TYPES from './constants/eventTypes'
import {
    NodeBase
    , NodeMetadata
    , NodeRegistre
    , DuplicatedNodePayload
    , NODE_UNREGISTRE_REASON
} from './node'

type DRIVER_EVENTS = EVENTS_TYPES.ERROR_TYPES
    | EVENTS.NODE.UPDATE
    | EVENTS.NODE_REGISTRE
    | EVENTS.DISCOVERY
    | EVENTS.TRANSPORT
    | EVENTS.UNIVERSAL

type DRIVER_FN = ErrorEmitterFn | NodeEmitterFn | NodeUpdateEmitterFn

type NodeUpdateStartEmitter = {
    type?: EVENTS_TYPES.NODE_UPDATE_TYPES.START
    , payload: {
        time: number
    }
}

type NodeUpdateStopEmitter = {
    type?: EVENTS_TYPES.NODE_UPDATE_TYPES.STOP
    , payload: {
        time: number
        , reason?: string
    }
}

type NodeUpdateDoingEmitter = {
    type?: EVENTS_TYPES.NODE_UPDATE_TYPES.DOING
    , payload: {
        time: number
        , reason?: string
    }
}

export type NodeRegistreAddEmitter = {
    payload: {
        time: number
        , nodeRegistre: Partial<NodeRegistre>
    }
}

export type NodeRegistreRemoveEmitter = {
    payload: {
        time: number
        , nodeRegistre: Partial<NodeRegistre>
        , reason: NODE_UNREGISTRE_REASON
    }
}

type UpEmitter = {
    payload: {
        time: number
    }
}

type DownEmitter = {
    payload: {
        time: number
        , signal?: string
        , code?: number
    }
}

export interface NodeEmitter extends NodeBase {
    event: EVENTS.DISCOVERY
    , ensured: boolean
    , rinfo: RemoteInfo
    , meta?: NodeMetadata
}

type ErrorDuplicatedNodeEmitter = {
    type?: EVENTS_TYPES.CUSTOM_ERROR_TYPE.DUPLICATE_NODE_ID
    , err?: Error
    , message?: string
    , payload?: DuplicatedNodePayload
}

type NodeUpdateEmitter = NodeUpdateStartEmitter | NodeUpdateStopEmitter | NodeUpdateDoingEmitter
type ErrorEmitter = ErrorDefaultEmitter | ErrorDuplicatedNodeEmitter

type ErrorDefaultEmitter = {
    type?: EVENTS_TYPES.ERROR_TYPES
    , err?: Error
    , message?: string
}

type ErrorEmitterFn = (payload: ErrorEmitter) => void
type NodeRegistreAddEmitterFn = (payload: NodeRegistreAddEmitter) => void
type NodeRegistreRemoveEmitterFn = (payload: NodeRegistreRemoveEmitter) => void
type NodeEmitterFn = (payload: NodeEmitter) => void
type NodeEmitterUpFn = (payload: UpEmitter) => void
type NodeEmitterDownFn = (payload: DownEmitter) => void
type NodeUpdateEmitterFn = (payload: NodeUpdateEmitter) => void
type NodeExternalUpdateEmitterFn = (payload: NodeEmitter) => void

export interface EventsDriver extends EventEmitter {
    on(event: EVENTS.DISCOVERY, fn: NodeEmitterFn): this
    on(event: EVENTS.NODE.UPDATE, fn: NodeUpdateEmitterFn): this
    on(event: EVENTS.NODE.EXTERNAL_ACTION, fn: NodeExternalUpdateEmitterFn): this
    on(event: EVENTS.TRANSPORT.MESSAGE, fn: NodeEmitterFn): this
    on(event: EVENTS.UNIVERSAL.ERROR, fn: ErrorEmitterFn): this
    on(event: EVENTS.NODE_REGISTRE.ADD, fn: NodeRegistreAddEmitterFn): this
    on(event: EVENTS.NODE_REGISTRE.REMOVE, fn: NodeRegistreRemoveEmitterFn): this
    on(event: EVENTS.SYSTEM.UP, fn: NodeEmitterUpFn): this
    on(event: EVENTS.SYSTEM.DOWN, fn: NodeEmitterDownFn): this

    off(event: DRIVER_EVENTS, fn: DRIVER_FN): this

    emit(event: EVENTS.DISCOVERY, payload: NodeEmitter): boolean
    emit(event: EVENTS.UNIVERSAL.ERROR, payload: ErrorEmitter): boolean
    emit(event: EVENTS.SYSTEM.UP, payload: UpEmitter): boolean
    emit(event: EVENTS.SYSTEM.DOWN, payload: DownEmitter): boolean
    emit(event: EVENTS.NODE_REGISTRE.ADD, payload: NodeRegistreAddEmitter): boolean
    emit(event: EVENTS.NODE_REGISTRE.REMOVE, payload: NodeRegistreRemoveEmitter): boolean
    emit(event: EVENTS.NODE.UPDATE, payload: NodeUpdateEmitter): boolean
    emit(event: EVENTS.NODE.EXTERNAL_ACTION, payload: NodeEmitter): boolean
    emit(event: EVENTS.TRANSPORT.MESSAGE, payload: NodeEmitter): boolean
}

const EventsDriver = (): EventsDriver => {
    const emitter = new events.EventEmitter()
    return emitter
}

export const createEventsDriver = () => {
    return EventsDriver()
}
