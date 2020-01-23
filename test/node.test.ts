import test from 'ava'
import * as os from 'os'
import { createNode, nodeStates, NODE_STATES } from '../lib/node'
import ERROR from '../lib/constants/error'

test('create node whitout options', (t) => {
    const options = {
        id: os.hostname()
        , port: 3000
        , host: '0.0.0.0'
        , meta: null
        , replica: {
            is: false
        }
        , ignoreProcess: false
        , ignoreInstance: true

    }

    const n = createNode()
    t.is(n.id, options.id)
    t.is(n.port, options.port)
    t.is(n.host, options.host)
    t.is(n.meta, options.meta)
    t.deepEqual(n.replica, {
        is: false
    })
})

test('create node whit options', (t) => {
    const metaMessage = 'foo buffer'
    const payload = Buffer.alloc(metaMessage.length)
    const options = {
        id: 'foo'
        , port: 3000
        , host: '0.0.0.0'
        , meta: {
            id: 'foo-service'
            , description: 'cool foo service'
            , payload
        }
        , replica: false
        , ignoreInstance: true
        , ignoreProcess: false
    }

    const n = createNode({ options })
    t.is(n.id, options.id)
    t.is(n.port, options.port)
    t.is(n.host, options.host)
    t.deepEqual(n.meta, options.meta)
    t.deepEqual(n.replica, {
        is: false
    })
})

test('check node legal state transition', async (t) => {
    const n = createNode()
    t.is(n.state, NODE_STATES.DOWN)
    n.transitState(NODE_STATES.UP)
    t.is(n.state, NODE_STATES.UP)
})

test('check node ilegal state transition', async (t) => {
    const n = createNode()
    const err = t.throws(() => n.transitState(NODE_STATES.DOWN))
    const customErr = ERROR.ILLEGAL_TRANSITION_STATE
    t.is(err.name, customErr.name)
    t.is(err.message, customErr.message(NODE_STATES.DOWN, NODE_STATES.DOWN, nodeStates[n.state]))
})

test('check node resetStates', async (t) => {
    const n = createNode()

    n.up.time = 1
    n.resetStates(NODE_STATES.UP)

    t.deepEqual(n.up, {
        time: n.up.time
    })
    t.deepEqual(n.down, {
        time: null
        , signal: null
        , code: null
    })
    t.deepEqual(n.stop, {
        time: null
        , reason: null
    })
    t.deepEqual(n.doing, {
        time: null
        , reason: null
    })

    n.stop.time = 1
    n.stop.reason = 'any reason'
    n.resetStates(NODE_STATES.STOPPED)

    t.deepEqual(n.up, {
        time: n.up.time
    })
    t.deepEqual(n.down, {
        time: null
        , signal: null
        , code: null
    })
    t.deepEqual(n.stop, {
        time: 1
        , reason: n.stop.reason
    })
    t.deepEqual(n.doing, {
        time: null
        , reason: null
    })
})