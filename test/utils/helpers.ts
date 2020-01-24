import ip from 'ip'
import { ExecutionContext } from 'ava'
import { pid } from '../../lib/constants/core'
import { DISCOVERY } from './../../lib/constants/events'
import { NodeEmitter } from '../../lib/eventsDriver'
import { createUuid, genRandomNumber } from '../../lib/utils'
import { Node, NodeRegistre, NodeReplica, NODE_STATES } from '../../lib/node'

type CheckOptions = {
    id: string
    , port: number
    , event: DISCOVERY
}

export const checkEmitterData = (
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
        , state
        , up: {
            time: 0
        }
    }
}