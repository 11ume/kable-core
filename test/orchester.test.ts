import test from 'ava'
import { Orchester } from './../lib/orchester'
import { NodeRegistre } from './../lib/node'
import { createStore } from '../lib/store'
import { createOrchester } from '../lib/orchester'
import { createRepository } from '../lib/repository'
import { createNodeRegistre } from '../lib/utils/helpers'
import { convertToReplicaId, NODE_STATES } from '../lib/node'
import { createEventsDriver } from '../lib/eventsDriver'

const createOrchesterMock = () => {
    const nodesStore = createStore<NodeRegistre>()
    const eventsDriver = createEventsDriver()
    const nodesRepository = createRepository<NodeRegistre>({ eventsDriver, registres: nodesStore })
    const orchester = createOrchester({ eventsDriver, nodesRepository })
    return {
        orchester
        , nodesRepository
    }
}

const getNodeInStack = (index: number, { nodePoolStack }: Orchester): boolean => {
    for (const nodes of nodePoolStack.values()) {
        for (const i of nodes.queue) {
            if (index === i) return true
        }
    }

    return false
}

const getFirstNode = (minIndex: number, ...nodes: NodeRegistre[]) => {
    for (const n of nodes) {
        if (n.index === minIndex) {
            return n.index
        }
    }

    return 0
}

const getMiddleNode = (minIndex: number, maxIndex: number, ...nodes: NodeRegistre[]) => {
    for (const n of nodes) {
        if (n.index !== minIndex && n.index !== maxIndex) {
            return n.index
        }
    }

    return 0
}

const getLastNode = (maxIndex: number, ...nodes: NodeRegistre[]) => {
    for (const n of nodes) {
        if (n.index === maxIndex) {
            return n.index
        }
    }

    return 0
}

test('add node', async (t) => {
    const { nodesRepository, orchester } = createOrchesterMock()
    const foo = createNodeRegistre('foo', NODE_STATES.RUNNING)

    nodesRepository.add(foo.index, foo)
    t.truthy(getNodeInStack(foo.index, orchester))
})

test('remove node', async (t) => {
    const { nodesRepository, orchester } = createOrchesterMock()
    const foo = createNodeRegistre('foo', NODE_STATES.RUNNING)

    nodesRepository.add(foo.index, foo)
    nodesRepository.remove(foo.index, foo)
    t.falsy(getNodeInStack(foo.index, orchester))
})

test('remove all replica nodes of foo but leave bar', async (t) => {
    const { nodesRepository, orchester } = createOrchesterMock()
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
    const { nodesRepository, orchester } = createOrchesterMock()
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

test('round robin get first node', async (t) => {
    const { nodesRepository, orchester } = createOrchesterMock()
    const foo = createNodeRegistre('foo', NODE_STATES.RUNNING)
    const foo1 = createNodeRegistre(convertToReplicaId('foo'), NODE_STATES.RUNNING, { is: true, of: 'foo' })
    const foo2 = createNodeRegistre(convertToReplicaId('foo'), NODE_STATES.RUNNING, { is: true, of: 'foo' })

    nodesRepository.add(foo.index, foo)
    nodesRepository.add(foo1.index, foo1)
    nodesRepository.add(foo2.index, foo2)
    const nodePoolStack = orchester.getNodePoolStack().foo
    const min = Math.min(...nodePoolStack.queue)

    const firstNode = orchester.getNode('foo')
    t.is(firstNode.index, getFirstNode(min, foo, foo1, foo2))
})

test('round robin get last node', async (t) => {
    const { nodesRepository, orchester } = createOrchesterMock()
    const foo = createNodeRegistre('foo', NODE_STATES.RUNNING)
    const foo1 = createNodeRegistre(convertToReplicaId('foo'), NODE_STATES.RUNNING, { is: true, of: 'foo' })
    const foo2 = createNodeRegistre(convertToReplicaId('foo'), NODE_STATES.RUNNING, { is: true, of: 'foo' })

    nodesRepository.add(foo.index, foo)
    nodesRepository.add(foo1.index, foo1)
    nodesRepository.add(foo2.index, foo2)
    const nodePoolStack = orchester.getNodePoolStack().foo
    const max = Math.max(...nodePoolStack.queue)

    orchester.getNode('foo')
    orchester.getNode('foo')
    const lastNode = orchester.getNode('foo')
    t.is(lastNode.index, getLastNode(max, foo, foo1, foo2))
})

test('round robin get middle node', async (t) => {
    const { nodesRepository, orchester } = createOrchesterMock()
    const foo = createNodeRegistre('foo', NODE_STATES.RUNNING)
    const foo1 = createNodeRegistre(convertToReplicaId('foo'), NODE_STATES.RUNNING, { is: true, of: 'foo' })
    const foo2 = createNodeRegistre(convertToReplicaId('foo'), NODE_STATES.RUNNING, { is: true, of: 'foo' })

    nodesRepository.add(foo.index, foo)
    nodesRepository.add(foo1.index, foo1)
    nodesRepository.add(foo2.index, foo2)
    const nodePoolStack = orchester.getNodePoolStack().foo
    const max = Math.max(...nodePoolStack.queue)
    const min = Math.min(...nodePoolStack.queue)

    orchester.getNode('foo')
    const middleNode = orchester.getNode('foo')

    t.is(middleNode.index, getMiddleNode(min, max, foo, foo1, foo2))
})

test('round robin flow on remove one node', async (t) => {
    const { nodesRepository, orchester } = createOrchesterMock()
    const foo = createNodeRegistre('foo', NODE_STATES.RUNNING)
    const foo1 = createNodeRegistre(convertToReplicaId('foo'), NODE_STATES.RUNNING, { is: true, of: 'foo' })
    const foo2 = createNodeRegistre(convertToReplicaId('foo'), NODE_STATES.RUNNING, { is: true, of: 'foo' })

    nodesRepository.add(foo.index, foo)
    nodesRepository.add(foo1.index, foo1)
    nodesRepository.add(foo2.index, foo2)

    orchester.getNode('foo')
    orchester.getNode('foo')
    nodesRepository.remove(foo1.index, foo1)
    const nodePoolStack = orchester.getNodePoolStack().foo
    const max = Math.min(...nodePoolStack.queue)
    const node = orchester.getNode('foo')

    t.is(node.index, max)
})

test('check ignore not avaliable node', async (t) => {
    const { nodesRepository, orchester } = createOrchesterMock()
    const foo = createNodeRegistre('foo', NODE_STATES.RUNNING)
    const bar = createNodeRegistre('bar', NODE_STATES.UP)

    nodesRepository.add(foo.index, bar)
    t.falsy(getNodeInStack(bar.index, orchester))
})