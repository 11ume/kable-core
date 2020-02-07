import test from 'ava'
import { Orchester } from './../lib/orchester'
import { NodeRegistre } from './../lib/node'
import { createStore } from '../lib/store'
import { createOrchester } from '../lib/orchester'
import { createRepository } from '../lib/repository'
import { createNodeRegistre } from '../lib/utils/helpers'
import { convertToReplicaId, NODE_STATES } from '../lib/node'
import { createEventsDriver } from '../lib/eventsDriver'

const getNodeInStack = (index: number, { nodePoolStack }: Orchester): boolean => {
    for (const nodes of nodePoolStack.values()) {
        for (const i of nodes.queue) {
            if (index === i) return true
        }
    }

    return false
}

test('add node', async (t) => {
    const nodesStore = createStore<NodeRegistre>()
    const nodesRepository = createRepository<NodeRegistre>(nodesStore)
    const eventsDriver = createEventsDriver()
    const orchester = createOrchester({ eventsDriver, nodesRepository })
    const foo = createNodeRegistre('foo', NODE_STATES.RUNNING)

    nodesRepository.add(foo.index, foo)
    t.truthy(getNodeInStack(foo.index, orchester))
})

test('remove node', async (t) => {
    const nodesStore = createStore<NodeRegistre>()
    const nodesRepository = createRepository<NodeRegistre>(nodesStore)
    const eventsDriver = createEventsDriver()
    const orchester = createOrchester({ eventsDriver, nodesRepository })
    const foo = createNodeRegistre('foo', NODE_STATES.RUNNING)

    nodesRepository.add(foo.index, foo)
    nodesRepository.remove(foo.index, foo)
    t.falsy(getNodeInStack(foo.index, orchester))
})

test('remove all replica nodes of foo but leave bar', async (t) => {
    const nodesStore = createStore<NodeRegistre>()
    const nodesRepository = createRepository<NodeRegistre>(nodesStore)
    const eventsDriver = createEventsDriver()
    const orchester = createOrchester({ eventsDriver, nodesRepository })
    const bar = createNodeRegistre('bar', NODE_STATES.RUNNING)
    const foo = createNodeRegistre('foo', NODE_STATES.RUNNING)
    const foo1 = createNodeRegistre(convertToReplicaId('foo'), NODE_STATES.RUNNING, { is: true, of: 'foo' })

    nodesRepository.add(bar.index, bar)
    nodesRepository.add(foo.index, foo)
    nodesRepository.add(foo1.index, foo1)

    // stack -> bar, foo -> Array<2>
    t.is(orchester.nodePoolStack.size, 2)

    nodesRepository.remove(foo.index, foo)
    nodesRepository.remove(foo1.index, foo1)

    // stack -> bar
    t.is(orchester.nodePoolStack.size, 1)
})

test('remove all replica nodes of foo', async (t) => {
    const nodesStore = createStore<NodeRegistre>()
    const nodesRepository = createRepository<NodeRegistre>(nodesStore)
    const eventsDriver = createEventsDriver()
    const orchester = createOrchester({ eventsDriver, nodesRepository })
    const foo = createNodeRegistre('foo', NODE_STATES.RUNNING)
    const foo1 = createNodeRegistre(convertToReplicaId('foo'), NODE_STATES.RUNNING, { is: true, of: 'foo' })
    const foo2 = createNodeRegistre(convertToReplicaId('foo'), NODE_STATES.RUNNING, { is: true, of: 'foo' })

    // stack -> foo -> Array<3>
    nodesRepository.add(foo.index, foo)
    nodesRepository.add(foo1.index, foo1)
    nodesRepository.add(foo2.index, foo2)

    t.is(orchester.nodePoolStack.size, 1)

    // stack -> empty
    nodesRepository.remove(foo.index, foo)
    nodesRepository.remove(foo1.index, foo1)
    nodesRepository.remove(foo2.index, foo2)

    t.is(orchester.nodePoolStack.size, 0)
})

test('test round robin normal flow', async (t) => {
    const nodesStore = createStore<NodeRegistre>()
    const nodesRepository = createRepository<NodeRegistre>(nodesStore)
    const eventsDriver = createEventsDriver()
    const orchester = createOrchester({ eventsDriver, nodesRepository })
    const foo = createNodeRegistre('foo', NODE_STATES.RUNNING)
    const foo1 = createNodeRegistre(convertToReplicaId('foo'), NODE_STATES.RUNNING, { is: true, of: 'foo' })
    const foo2 = createNodeRegistre(convertToReplicaId('foo'), NODE_STATES.RUNNING, { is: true, of: 'foo' })

    nodesRepository.add(foo.index, foo)
    nodesRepository.add(foo1.index, foo1)
    nodesRepository.add(foo2.index, foo2)
    const workPoolFlow = orchester.getNodePoolStack().foo
    const max = Math.max(...workPoolFlow.queue)

    orchester.getNode('foo')
    orchester.getNode('foo')
    const lastNode = orchester.getNode('foo')
    const getLastNode = (maxIndex: number, ...nodes: NodeRegistre[]) => {
        for (const n of nodes) {
            if (n.index === maxIndex) {
                return n.index
            }
        }

        return 0
    }

    t.is(lastNode.index, getLastNode(max, foo, foo1, foo2))
})

test('test round robin flow on remove one node', async (t) => {
    const nodesStore = createStore<NodeRegistre>()
    const nodesRepository = createRepository<NodeRegistre>(nodesStore)
    const eventsDriver = createEventsDriver()
    const orchester = createOrchester({ eventsDriver, nodesRepository })
    const foo = createNodeRegistre('foo', NODE_STATES.RUNNING)
    const foo1 = createNodeRegistre(convertToReplicaId('foo'), NODE_STATES.RUNNING, { is: true, of: 'foo' })
    const foo2 = createNodeRegistre(convertToReplicaId('foo'), NODE_STATES.RUNNING, { is: true, of: 'foo' })

    nodesRepository.add(foo.index, foo)
    nodesRepository.add(foo1.index, foo1)
    nodesRepository.add(foo2.index, foo2)

    orchester.getNode('foo')
    orchester.getNode('foo')
    nodesRepository.remove(foo1.index, foo1)
    const workPoolFlow = orchester.getNodePoolStack().foo
    const max = Math.min(...workPoolFlow.queue)
    const node = orchester.getNode('foo')

    t.is(node.index, max)
})