import test from 'ava'
import op from 'ope-abort'
import ERROR from '../lib/constants/error'
import { createNode } from '../lib/node'
import { createStore } from '../lib/store'
import { createOrchester } from '../lib/orchester'
import { createRepository } from '../lib/repository'
import { createNodeRegistre } from '../lib/utils/helpers'
import { createNodePicker, NodePickerOptions } from '../lib/nodePicker'
import { NodeRegistre, NODE_STATES } from '../lib/node'
import { createEventsDriver } from '../lib/eventsDriver'

const create = (id: string, options: NodePickerOptions = {}) => {
    const nodesStore = createStore<NodeRegistre>()
    const eventsDriver = createEventsDriver()
    const nodesRepository = createRepository<NodeRegistre>({ eventsDriver, registres: nodesStore })
    const node = createNode({ eventsDriver, options: { id } })
    const nodeStore = createStore<NodeRegistre>()
    const orchester = createOrchester({ eventsDriver, nodesRepository })
    const nodePicker = createNodePicker({
        orchester
        , options
    })

    return {
        node
        , nodeStore
        , orchester
        , nodePicker
        , nodesRepository
    }
}

test('get a node', async (t) => {
    const foo = create('foo')
    const bar = createNodeRegistre('bar', NODE_STATES.RUNNING)
    foo.nodesRepository.add(bar.index, bar)

    const pick = await foo.nodePicker.pick('bar')
    t.is(pick.id, bar.id)
})

test('get one node whit delay', async (t) => {
    const foo = create('foo')
    const bar = createNodeRegistre('bar', NODE_STATES.RUNNING)
    setTimeout(() => foo.nodesRepository.add(bar.index, bar), 500)

    const pick = await foo.nodePicker.pick('bar')
    t.is(pick.id, bar.id)
})

test('get error when pick node wait limit is exceeded', async (t) => {
    const foo = create('foo', { pickTimeoutOut: 0 })
    const pickId = 'bar'
    const pick = () => t.throwsAsync(foo.nodePicker.pick(pickId))
    const pickError = await pick()

    const err = ERROR.NODE_PICK_WAITFOR_LIMIT_EXCEEDED
    t.is(pickError.name, err.name)
    t.is(pickError.message, err.message(pickId))
})

test('abort pick', async (t) => {
    const foo = create('foo')
    const opAbort = op()
    foo.nodePicker.pick('bar', { opAbort })
    opAbort.abort()
    t.truthy(opAbort.state.aborted)
})

test('check get not avaliable node', async (t) => {
    const foo = create('foo', { pickTimeoutOut: 50 })
    const pickId = 'bar'
    const bar = createNodeRegistre(pickId, NODE_STATES.UP)
    foo.nodesRepository.add(bar.index, bar)

    const pick = () => t.throwsAsync(foo.nodePicker.pick(pickId))
    const pickError = await pick()

    const err = ERROR.NODE_PICK_WAITFOR_LIMIT_EXCEEDED
    t.is(pickError.name, err.name)
    t.is(pickError.message, err.message(pickId))
})

test('check get not avaliable whit one replica off', async (t) => {
    const { orchester, ...foo } = create('foo')
    const bar = createNodeRegistre('bar', NODE_STATES.UP, { is: false, of: null })
    const bar1 = createNodeRegistre('bar1', NODE_STATES.RUNNING, { is: true, of: 'bar' })
    const bar2 = createNodeRegistre('bar2', NODE_STATES.RUNNING, { is: true, of: 'bar' })

    foo.nodesRepository.add(bar.index, bar)
    foo.nodesRepository.add(bar1.index, bar1)
    foo.nodesRepository.add(bar2.index, bar2)
    // if I have more than one item inside node pool stack, the element that has the largest index, is the first to be taken
    const nodePoolStack = orchester.getNodePoolStack().bar
    const lastNode = Math.min(...nodePoolStack.queue)

    const pick = await foo.nodePicker.pick('bar')
    t.is(pick.index, lastNode)
    t.is(pick.state, NODE_STATES.RUNNING)
})

test('check get not avaliable node whit 2 replicas off', async (t) => {
    const foo = create('foo')
    const bar = createNodeRegistre('bar', NODE_STATES.UP, { is: false, of: null })
    const bar1 = createNodeRegistre('bar1', NODE_STATES.RUNNING, { is: true, of: 'bar' })
    const bar2 = createNodeRegistre('bar2', NODE_STATES.STOPPED, { is: true, of: 'bar' })

    foo.nodesRepository.add(bar.index, bar)
    foo.nodesRepository.add(bar1.index, bar1)
    foo.nodesRepository.add(bar2.index, bar2)

    const pick = await foo.nodePicker.pick('bar')
    t.is(pick.id, bar1.id)
    t.is(pick.state, NODE_STATES.RUNNING)
})