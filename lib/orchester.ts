import { NodeRegistre, NODE_STATES } from './node'
import { Repository } from './repository'
import {
    fnPatch
    , roundRound
    , arrIsEmpty
    , objIsFalsy
    , arrIsNotEmpty
    , arrIfCheckExist
    , arrNumbSortAc
} from './utils/utils'

export type Orchester = {
    nodePoolStack: NodePoolStack
    , getNode: (id: string) => NodeRegistre
    , getNodePoolStack: () => NodePoolStackEntries
    , addNodeAwaiterToPoolStack: (unique: symbol, id: string, invoker: FnNodeAwaiterInvoker) => void
    , removeNodeAwaiterFromPoolStack: (unique: symbol) => void
}

export type NodePoolStackEntries = {
    [x: string]: Sequencer
}

type Sequencer = {
    queue: number[]
    , next?: () => number
}

type FnNodeAwaiterInvoker = (nodeRegistre: NodeRegistre) => void

type NodeAwaitStack = {
    id: string
    , invoker: FnNodeAwaiterInvoker
}

type NodePoolStack = Map<string, Sequencer>
type NodeAwaitPool = Map<symbol, NodeAwaitStack>

const roundGetNode = (sequencer: Sequencer, nodesRepository: Repository<NodeRegistre>) => {
    return nodesRepository.getOne(sequencer.next())
}

const checkNodeIsNotAvaliable = (node: NodeRegistre) => node.state === NODE_STATES.UP
    || node.state === NODE_STATES.STOPPED
    || node.state === NODE_STATES.DOING_SOMETHING

const handleGetReplicasNodes = (sequencer: Sequencer, nodesRepository: Repository<NodeRegistre>, count = 0) => {
    const node = roundGetNode(sequencer, nodesRepository)
    const len = sequencer.queue.length
    if (checkNodeIsNotAvaliable(node)) {
        if (len > count) return handleGetReplicasNodes(sequencer, nodesRepository, ++count)
        else return null
    }

    return node
}

const handleGetNode = (sequencer: Sequencer, nodesRepository: Repository<NodeRegistre>) => {
    return nodesRepository.getOne(sequencer.queue[0])
}

const addNodeAwaiterToPoolStack = (nodeAwaitPoolStack: NodeAwaitPool) => (unique: symbol, id: string, invoker: FnNodeAwaiterInvoker) => {
    nodeAwaitPoolStack.set(unique, {
        id
        , invoker
    })
}

const removeNodeAwaiterFromPoolStack = (nodeAwaitPoolStack: NodeAwaitPool) => (unique: symbol) => {
    nodeAwaitPoolStack.delete(unique)
}

const getNode = (nodesRepository: Repository<NodeRegistre>, nodePoolStack: NodePoolStack) => (id: string) => {
    const sequencer = nodePoolStack.get(id)
    if (sequencer) {
        return arrIsNotEmpty(sequencer.queue)
            ? handleGetReplicasNodes(sequencer, nodesRepository)
            : handleGetNode(sequencer, nodesRepository)
    }

    return null
}

const addNodeToStack = (nodePoolStack: NodePoolStack, id: string, index: number) => {
    const sequencer = nodePoolStack.get(id)
    if (sequencer) {
        if (arrIfCheckExist(sequencer.queue, index)) return
        sequencer.queue.push(index)
        sequencer.queue = arrNumbSortAc(sequencer.queue)
        sequencer.next = roundRound(sequencer.queue)
        return
    }

    nodePoolStack.set(id, {
        queue: [index]
    })
}

const onRegistreHandlePoolStack = (nodePoolStack: NodePoolStack, { id, index, replica }: NodeRegistre) => {
    if (replica.of) {
        addNodeToStack(nodePoolStack, replica.of, index)
        return
    }

    addNodeToStack(nodePoolStack, id, index)
}

const onRegistreHandleAwaitPoolStack = (nodesRepository: Repository<NodeRegistre>
    , nodePoolStack: NodePoolStack
    , nodeAwaitPool: NodeAwaitPool
    , nodeRegistre: NodeRegistre) => {
    nodeAwaitPool.forEach((pool) => {
        if (nodeRegistre.id !== pool.id) return
        pool.invoker(getNode(nodesRepository, nodePoolStack)(pool.id))
    })
}

const onAddNodeRegistre = (nodesRepository: Repository<NodeRegistre>
    , nodePoolStack: NodePoolStack
    , nodeAwaitPool: NodeAwaitPool
    , nodeRegistre: NodeRegistre) => {
    onRegistreHandlePoolStack(nodePoolStack, nodeRegistre)
    onRegistreHandleAwaitPoolStack(nodesRepository, nodePoolStack, nodeAwaitPool, nodeRegistre)
}

// !check existence of sequencer, this assertion can be irrelevant
const removeNodeFromStack = (nodePoolStack: NodePoolStack, id: string, index: number) => {
    const sequencer = nodePoolStack.get(id)
    if (objIsFalsy(sequencer)) return
    const queue = sequencer.queue.filter((i) => i !== index)
    sequencer.next = roundRound(queue)
    nodePoolStack.set(id, {
        queue
        , next: sequencer.next
    })

    if (arrIsEmpty(queue)) {
        nodePoolStack.delete(id)
    }
}

const onRemoveNodeRegistre = (nodePoolStack: NodePoolStack, { id, index, replica }: NodeRegistre) => {
    if (replica.of) {
        removeNodeFromStack(nodePoolStack, replica.of, index)
        return
    }

    removeNodeFromStack(nodePoolStack, id, index)
}

const getNodePoolStack = (nodePoolStack: NodePoolStack) => () => {
    return Object.fromEntries(nodePoolStack.entries())
}

const Orchester = (nodesRepository: Repository<NodeRegistre>): Orchester => {
    const nodePoolStack: NodePoolStack = new Map()
    const nodeAwaitPoolStack: NodeAwaitPool = new Map()

    fnPatch('add', nodesRepository, (_: string, nodeRegistre: NodeRegistre) => {
        onAddNodeRegistre(nodesRepository, nodePoolStack, nodeAwaitPoolStack, nodeRegistre)
    })

    fnPatch('remove', nodesRepository, (_: string, nodeRegistre: NodeRegistre) => {
        onRemoveNodeRegistre(nodePoolStack, nodeRegistre)
    })

    return {
        get nodePoolStack() {
            return new Map(nodePoolStack)
        }
        , getNode: getNode(nodesRepository, nodePoolStack)
        , getNodePoolStack: getNodePoolStack(nodePoolStack)
        , addNodeAwaiterToPoolStack: addNodeAwaiterToPoolStack(nodeAwaitPoolStack)
        , removeNodeAwaiterFromPoolStack: removeNodeAwaiterFromPoolStack(nodeAwaitPoolStack)
    }
}

export const createOrchester = (nodesRepository: Repository<NodeRegistre>) => {
    return Orchester(nodesRepository)
}