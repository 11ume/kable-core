import test from 'ava'
import oa from 'ope-abort'
import kable from '../lib/kable'
import ERROR from '../lib/constants/error'
import { checkPick, delay } from '../lib/utils/helpers'
import { NODE_STATES, nodeStates, NodeRegistre } from '../lib/node'

test.serial('get a node', async (t) => {
    const foo = kable('foo')
    const bar = kable('bar')

    await foo.up()
    await bar.up()
    const pick = await foo.pick('bar')
    checkPick(t, bar, pick)

    foo.down()
    bar.down()
})

test.serial('get node whit delay', async (t) => {
    const foo = kable('foo')
    const bar = kable('bar')

    await foo.up()
    delay(2000, bar.up)
    const pick = await foo.pick('bar')
    checkPick(t, bar, pick)

    foo.down()
    bar.down()
})

test.serial('get a node but abort', async (t) => {
    const foo = kable('foo')
    const opAbort = oa()

    await foo.up()
    foo.pick('bar', { opAbort })
    await delay(1000, opAbort.abort)

    t.true(opAbort.state.aborted)
    foo.down()
})

test.serial('state transition, up - down', async (t) => {
    const foo = kable('foo')
    t.is(foo.state, NODE_STATES.DOWN)
    await foo.up()
    t.is(foo.state, NODE_STATES.RUNNING)
    await foo.down()
    t.is(foo.state, NODE_STATES.DOWN)
})

test.serial('state transition, down - running - stop - start - down', async (t) => {
    const foo = kable('foo')
    t.is(foo.state, NODE_STATES.DOWN)
    await foo.up()
    t.is(foo.state, NODE_STATES.RUNNING)
    foo.stop()
    t.is(foo.state, NODE_STATES.STOPPED)
    foo.start()
    t.is(foo.state, NODE_STATES.RUNNING)
    await foo.down()
    t.is(foo.state, NODE_STATES.DOWN)
})

test.serial('state transition, up not running, up - down', async (t) => {
    const foo = kable('foo')
    t.is(foo.state, NODE_STATES.DOWN)
    await foo.up(false)
    t.is(foo.state, NODE_STATES.UP)
    await foo.down()
    t.is(foo.state, NODE_STATES.DOWN)
})

test.serial('state transition, emit error when intent call up method, before up', async (t) => {
    const foo = kable('foo')
    await foo.up()
    const up = t.throwsAsync(foo.up)
    const err = await up
    const customErr = ERROR.ILLEGAL_TRANSITION_STATE
    t.is(err.name, customErr.name)
    t.is(err.message, customErr.message(NODE_STATES.RUNNING, NODE_STATES.UP, nodeStates[foo.state]))
    foo.down()
})

test.serial('state transition, emit error when intent call down method, before down', async (t) => {
    const foo = kable('foo')
    await foo.up()
    await foo.down()
    const down = t.throwsAsync(foo.down)
    const err = await down
    const customErr = ERROR.ILLEGAL_TRANSITION_STATE
    t.is(err.name, customErr.name)
    t.is(err.message, customErr.message(NODE_STATES.DOWN, NODE_STATES.DOWN, nodeStates[foo.state]))
})

test.serial('state transition, emit error when intent call start method, before up', async (t) => {
    const foo = kable('foo')
    const err = t.throws(foo.start)
    const customErr = ERROR.ILLEGAL_TRANSITION_STATE
    t.is(err.name, customErr.name)
    t.is(err.message, customErr.message(NODE_STATES.DOWN, NODE_STATES.RUNNING, nodeStates[foo.state]))
})

test.serial('state transition, check node registre only up', async (t) => {
    const foo = kable('foo')
    const bar = kable('bar')
    await foo.up()
    await bar.up()

    const pick = await foo.pick('bar')

    t.truthy(pick.up.time)
    t.falsy(pick.down)
    t.falsy(pick.start)
    t.falsy(pick.stop)
    t.falsy(pick.doing)

    bar.down()
    foo.down()
})

test.serial('state transition, check node registre on start', async (t) => {
    const foo = kable('foo')
    const bar = kable('bar')
    await foo.up(false)
    await bar.up(false)
    bar.start()

    const check = (): Promise<NodeRegistre> => new Promise(async (resolve) => {
        await delay(200)
        resolve(foo.pick('bar'))
    })

    const pick = await check()

    t.truthy(pick.up)
    t.truthy(pick.start.time)
    t.falsy(pick.down)
    t.falsy(pick.stop)
    t.falsy(pick.doing)

    foo.down()
    bar.down()
})

test.serial('state transition, check node registre on stop', async (t) => {
    const foo = kable('foo')
    const bar = kable('bar')
    const reason = 'any reason'

    await foo.up()
    await bar.up()
    bar.stop(reason)

    const check = (): Promise<NodeRegistre> => new Promise(async (resolve) => {
        await delay(200)
        resolve(foo.pick('bar'))
    })

    const pick = await check()

    t.truthy(pick.up)
    t.truthy(pick.stop.time)
    t.is(pick.stop.reason, reason)
    t.falsy(pick.start)
    t.falsy(pick.down)
    t.falsy(pick.doing)

    foo.down()
    bar.down()
})

test.serial('state transition, check node registre on doing', async (t) => {
    const foo = kable('foo')
    const bar = kable('bar')
    const reason = 'any reason'

    await foo.up()
    await bar.up()
    bar.doing(reason)

    const check = (): Promise<NodeRegistre> => new Promise(async (resolve) => {
        await delay(200)
        resolve(foo.pick('bar'))
    })

    const pick = await check()

    t.truthy(pick.up)
    t.truthy(pick.doing.time)
    t.truthy(pick.doing.reason)
    t.falsy(pick.stop)
    t.falsy(pick.start)
    t.falsy(pick.down)

    foo.down()
    bar.down()
})

test.serial('create send and recibe node whit metadata', async (t) => {
    const foo = kable('foo')
    const bar = kable('bar', { meta: { id: 'foo', description: 'im foo' } })
    await foo.up()
    await bar.up()

    const check = (): Promise<NodeRegistre> => new Promise(async (resolve) => {
        resolve(foo.pick('bar'))
    })

    const pick = await check()
    t.deepEqual(pick.meta, { id: 'foo', description: 'im foo' })

    foo.down()
    bar.down()
})