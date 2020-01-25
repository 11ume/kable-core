import test from 'ava'
import { createStore } from '../lib/store'
import { NodeRegistre, NODE_STATES } from '../lib/node'
import { createRepository } from '../lib/repository'
import { createNodeRegistre } from '../lib/utils/helpers'

test('add new registre', (t) => {
    const nodesStore = createStore<NodeRegistre>()
    const nodesRepository = createRepository<NodeRegistre>(nodesStore)
    const foo = createNodeRegistre('foo', NODE_STATES.UP)
    nodesRepository.add(foo.index, foo)

    t.deepEqual(nodesRepository.getOne(foo.index), foo)
})

test('get registre by id', (t) => {
    const nodesStore = createStore<NodeRegistre>()
    const nodesRepository = createRepository<NodeRegistre>(nodesStore)
    const foo = createNodeRegistre('foo', NODE_STATES.UP)
    nodesRepository.add(foo.index, foo)

    t.deepEqual(nodesRepository.getOneById(foo.id), foo)
})

test('get all registres', (t) => {
    const nodesStore = createStore<NodeRegistre>()
    const nodesRepository = createRepository<NodeRegistre>(nodesStore)
    const foo = createNodeRegistre('foo', NODE_STATES.UP)
    const bar = createNodeRegistre('bar', NODE_STATES.UP)
    nodesRepository.add(foo.index, foo)
    nodesRepository.add(bar.index, bar)

    const registres = nodesRepository.getAll()
    t.deepEqual(registres.next().value, foo)
    t.deepEqual(registres.next().value, bar)
})

test('remove registre', (t) => {
    const nodesStore = createStore<NodeRegistre>()
    const nodesRepository = createRepository<NodeRegistre>(nodesStore)
    const foo = createNodeRegistre('foo', NODE_STATES.UP)
    nodesRepository.add(foo.index, foo)
    nodesRepository.remove(foo.index, foo)

    t.is(nodesRepository.getOne(foo.index), undefined)
})
