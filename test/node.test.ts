import test from 'ava'
import * as os from 'os'
import ERROR from '../lib/constants/error'
import { createNode, nodeStates, NODE_STATES } from '../lib/node'
import { createEventsDriver } from '../lib/eventsDriver'

test('create node whitout options', (t) => {
    const eventsDriver = createEventsDriver()
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
    const n = createNode({ eventsDriver })
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

    const eventsDriver = createEventsDriver()
    const n = createNode({ eventsDriver, options })
    t.is(n.id, options.id)
    t.is(n.port, options.port)
    t.is(n.host, options.host)
    t.deepEqual(n.meta, options.meta)
    t.deepEqual(n.replica, {
        is: false
    })
})

test('check node legal state transition', async (t) => {
    const eventsDriver = createEventsDriver()
    const n = createNode({ eventsDriver })
    t.is(n.state, NODE_STATES.DOWN)
    n.stateTransit(NODE_STATES.UP)
    t.is(n.state, NODE_STATES.UP)
})

test('check node ilegal state transition', async (t) => {
    const eventsDriver = createEventsDriver()
    const n = createNode({ eventsDriver })
    const err = t.throws(() => n.stateTransit(NODE_STATES.DOWN))
    const customErr = ERROR.ILLEGAL_TRANSITION_STATE
    t.is(err.name, customErr.name)
    t.is(err.message, customErr.message(NODE_STATES.DOWN, NODE_STATES.DOWN, nodeStates[n.state]))
})

test('check node resetStates', async (t) => {
    const eventsDriver = createEventsDriver()
    const n = createNode({ eventsDriver })
    const { stateData } = n
    stateData.up.time = 1
    n.stateReset(NODE_STATES.UP)

    t.deepEqual(stateData.up, {
        time: stateData.up.time
    })
    t.deepEqual(stateData.down, {
        time: null
        , signal: null
        , code: null
    })
    t.deepEqual(stateData.stop, {
        time: null
        , reason: null
    })
    t.deepEqual(stateData.doing, {
        time: null
        , reason: null
    })

    stateData.stop.time = 1
    stateData.stop.reason = 'any reason'
    n.stateReset(NODE_STATES.STOPPED)

    t.deepEqual(stateData.up, {
        time: stateData.up.time
    })
    t.deepEqual(stateData.down, {
        time: null
        , signal: null
        , code: null
    })
    t.deepEqual(stateData.stop, {
        time: 1
        , reason: stateData.stop.reason
    })
    t.deepEqual(stateData.doing, {
        time: null
        , reason: null
    })
})

test('check if node is avaliable', async (t) => {
    const eventsDriver = createEventsDriver()
    const n = createNode({ eventsDriver })
    n.stateTransit(NODE_STATES.UP)
    n.stateTransit(NODE_STATES.RUNNING)
    t.is(n.state, NODE_STATES.RUNNING)
    t.is(n.stateIsNotAvaliable(), false)
})

test('check if node is not avaliable', async (t) => {
    const eventsDriver = createEventsDriver()
    const n = createNode({ eventsDriver })
    n.stateTransit(NODE_STATES.UP)
    n.stateTransit(NODE_STATES.STOPPED)
    t.is(n.state, NODE_STATES.STOPPED)
    t.is(n.stateIsNotAvaliable(), true)
})
