import * as EVENTS from '../constants/events'
import { ExecutionContext } from 'ava'
import { pid } from '../constants/core'
import { Kable } from '../kable'
import { NodeEmitter } from '../eventsDriver'
import { createUuid, genRandomNumber } from './utils'
import {
    Node
    , NodeRegistre
    , NodeReplica
    , NODE_STATES
} from '../node'

type CheckEmitterOptions = {
    id: string
    , port: number
    , event: EVENTS.DISCOVERY
}

const isValidIp = (value: string) => (/^(?:(?:^|\.)(?:2(?:5[0-5]|[0-4]\d)|1?\d?\d)){4}$/.test(value) ? true : false)

export const checkPick = (
    t: ExecutionContext
    , element: Kable
    , target: NodeRegistre) => {
    t.false(target.ensured)
    t.is(element.hostname, target.hostname)
    t.is(element.id, target.id)
    t.is(element.iid, target.iid)
    t.is(element.index, target.index)
    t.truthy(target.lastSeen)
    t.is(element.pid, target.pid)
    t.is(element.port, target.port)
    t.true(Object.values(NODE_STATES).includes(target.state))
    t.truthy(target.stateData.up.time)
    t.deepEqual(target.replica, {
        is: false
    })
}

export const checkEmitterData = (
    t: ExecutionContext
    , element: Node
    , target: NodeEmitter
    , opts: CheckEmitterOptions) => {
    t.false(target.ensured)
    t.is(target.event, opts.event)
    t.truthy(target.host)
    t.is(target.hostname, element.hostname)
    t.is(target.id, opts.id)
    t.is(target.iid, element.iid)
    t.is(target.index, element.index)
    t.is(target.pid, element.pid)
    t.is(target.port, element.port)
    t.is(target.adTime, element.adTime)
    t.deepEqual(target.replica, {
        is: false
    })
    t.true(isValidIp(target.rinfo.address))
    t.is(target.rinfo.family, 'IPv4')
    t.is(target.rinfo.port, opts.port)
    t.true(typeof target.rinfo.size === 'number')
}

export const createNodeRegistre = (id: string
    , state: NODE_STATES
    , replica: NodeReplica = { is: false }): NodeRegistre => {
    return {
        id
        , port: 5000
        , host: ''
        , pid
        , iid: createUuid()
        , meta: null
        , index: genRandomNumber()
        , replica
        , hostname: ''
        , ensured: false
        , lastSeen: 0
        , registre: ['bar']
        , adTime: 2000
        , state
        , ignorable: false
        , stateData: {
            up: {
                time: 0
            }
        }
    }
}

export const delay = (time: number, fn?: (...args: any[]) => any) => new Promise((r) => setTimeout(() => {
    fn && fn()
    r()
}, time))
