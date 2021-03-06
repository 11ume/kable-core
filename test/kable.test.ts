import test from 'ava'
import oa from 'ope-abort'
import kable from '../lib/kable'
import ERROR from '../lib/constants/error'
import { checkPick } from '../lib/utils/helpers'
import { delay } from '../lib/utils/helpers'
import { NODE_STATES, nodeStates, NodeRegistre } from '../lib/node'
import { NodeEmitter } from '../lib/eventsDriver'

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
    delay(100, opAbort.abort)
    const pick = await foo.pick('bar', { opAbort })

    t.is(pick, null)
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
    const { stateData } = pick

    t.truthy(stateData.up.time)
    t.falsy(stateData.down)
    t.falsy(stateData.start)
    t.falsy(stateData.stop)
    t.falsy(stateData.doing)

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
    const { stateData } = pick

    t.truthy(stateData.up)
    t.truthy(stateData.start.time)
    t.falsy(stateData.down)
    t.falsy(stateData.stop)
    t.falsy(stateData.doing)

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
    const { stateData } = pick

    t.truthy(stateData.up)
    t.truthy(stateData.stop.time)
    t.is(stateData.stop.reason, reason)
    t.falsy(stateData.start)
    t.falsy(stateData.down)
    t.falsy(stateData.doing)

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
    const { stateData } = pick
    t.truthy(stateData.up)
    t.truthy(stateData.doing.time)
    t.truthy(stateData.doing.reason)
    t.falsy(stateData.stop)
    t.falsy(stateData.start)
    t.falsy(stateData.down)

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

test.serial('subscribe to all available nodes changes', async (t) => {
    const foo = kable('foo')
    const faz = kable('faz')
    const bar = kable('bar')
    await foo.up()

    const check = (): Promise<NodeEmitter[]> => new Promise((resolve) => {
        const nodes: NodeEmitter[] = []
        foo.suscribeAll((payload) => {
            if (payload.stateData.up) {
                nodes.push(payload)
            }

            if (nodes.length > 1) resolve(nodes)
        })

        faz.up()
        bar.up()
    })

    const [nFaz, nBar] = await check()
    t.truthy(nFaz.stateData.up.time)
    t.is(nFaz.id, faz.id)
    t.truthy(nBar.stateData.up.time)
    t.is(nBar.id, bar.id)

    foo.down()
    faz.down()
    bar.down()
})

test.serial('suscribe and check registred node', async (t) => {
    const foo = kable('foo')
    const bar = kable('bar')
    await foo.up()

    const check = (): Promise<NodeEmitter> => new Promise((resolve) => {
        foo.suscribe('bar', (payload) => {
            if (payload.registre) {
                resolve(payload)
            }
        })

        bar.up()
    })

    const n = await check()
    t.true(Array.isArray(n.registre))
    t.is(n.registre.length, 1)

    foo.down()
    bar.down()
})

test.serial('suscribe and call node up', async (t) => {
    const foo = kable('foo')
    const bar = kable('bar')
    await foo.up()

    const check = (): Promise<NodeEmitter> => new Promise((resolve) => {
        foo.suscribe('bar', (payload) => {
            if (payload.stateData.up) {
                resolve(payload)
            }
        })

        bar.up()
    })

    const n = await check()
    t.truthy(n.stateData.up.time)

    foo.down()
    bar.down()
})

test.serial('suscribe and call node down', async (t) => {
    const foo = kable('foo')
    const bar = kable('bar')
    await foo.up()
    await bar.up(false)

    const check = (): Promise<NodeEmitter> => new Promise((resolve) => {
        foo.suscribe('bar', (payload) => {
            if (payload.stateData.down) {
                resolve(payload)
            }
        })
        bar.down()
    })

    const n = await check()
    t.truthy(n.stateData.down.time)

    foo.down()
})

test.serial('suscribe and call node start', async (t) => {
    const foo = kable('foo')
    const bar = kable('bar')
    await foo.up()
    await bar.up(false)

    const check = (): Promise<NodeEmitter> => new Promise((resolve) => {
        foo.suscribe('bar', (payload) => {
            if (payload.stateData.start) {
                resolve(payload)
            }
        })

        bar.start()
    })

    const n = await check()
    t.truthy(n.stateData.start.time)

    foo.down()
    bar.down()
})

test.serial('suscribe and call node stop', async (t) => {
    const foo = kable('foo')
    const bar = kable('bar')
    await foo.up()
    await bar.up(false)

    const check = (): Promise<NodeEmitter> => new Promise((resolve) => {
        foo.suscribe('bar', (payload) => {
            if (payload.stateData.stop) {
                resolve(payload)
            }
        })

        bar.stop()
    })

    const n = await check()
    t.truthy(n.stateData.stop.time)

    foo.down()
    bar.down()
})

test.serial('suscribe to node doing', async (t) => {
    const foo = kable('foo')
    const bar = kable('bar')
    await foo.up()
    await bar.up(false)

    const check = (): Promise<NodeEmitter> => new Promise((resolve) => {
        foo.suscribe('bar', (payload) => {
            if (payload.stateData.doing) {
                resolve(payload)
            }
        })

        bar.doing()
    })

    const n = await check()
    t.truthy(n.stateData.doing.time)

    foo.down()
    bar.down()
})

test.serial('unsuscribe to node', async (t) => {
    const foo = kable('foo')
    const bar = kable('bar')
    await foo.up()
    await bar.up()

    const check = (): Promise<NodeEmitter> => new Promise((resolve) => {
        foo.suscribe('bar', resolve)
        foo.unsubscribe(resolve)
        setTimeout(resolve, 2000)
    })

    const n = await check()
    t.falsy(n)

    foo.down()
    bar.down()
})

test.serial('check if node is avaliable', async (t) => {
    const foo = kable('foo')
    await foo.up()
    t.is(foo.avaliable, true)
    foo.down()
})

test.serial('check if node is not avaliable', async (t) => {
    const foo = kable('foo')
    await foo.up()
    foo.stop()
    t.is(foo.avaliable, false)
    foo.down()
})
