import { EventsDriver } from './eventsDriver'
import * as EVENTS from './constants/events'
import { NodeRegistre, NODE_STATES } from './node'
import { Repository } from './repository'
import {
    roundRound
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
    , addNodeAwaiterToStack: (unique: symbol, id: string, invoker: FnNodeAwaiterInvoker) => void
    , removeNodeAwaiterFromStack: (unique: symbol) => void
}

export type NodePoolStackEntries = {
    [x: string]: Sequencer
}

type OrchesterArgs = {
    eventsDriver: EventsDriver
    , nodesRepository: Repository<NodeRegistre>
}

type Sequencer = {
    queue: number[]
    , next?: () => number
}

type FnNodeAwaiterInvoker = (nodeRegistre: NodeRegistre) => void

type AwaitStack = {
    id: string
    , invoker: FnNodeAwaiterInvoker
}

type NodePoolStack = Map<string, Sequencer>
type NodeAwaitStack = Map<symbol, AwaitStack>

const roundGetNode = (sequencer: Sequencer, nodesRepository: Repository<NodeRegistre>) => {
    return nodesRepository.getOne(sequencer.next())
}

const checkNodeIsNotAvaliable = (node: NodeRegistre) => node.state === NODE_STATES.UP
    || node.state === NODE_STATES.STOPPED
    || node.state === NODE_STATES.DOING_SOMETHING

const handleGetReplicasNodes = (sequencer: Sequencer
    , nodesRepository: Repository<NodeRegistre>
    , count = 0) => {
    const node = roundGetNode(sequencer, nodesRepository)
    const len = sequencer.queue.length
    if (checkNodeIsNotAvaliable(node)) {
        if (len > count) return handleGetReplicasNodes(sequencer, nodesRepository, ++count)
        else return null
    }

    return node
}

const handleGetNode = (sequencer: Sequencer, nodesRepository: Repository<NodeRegistre>) => {
    const node = nodesRepository.getOne(sequencer.queue[0])
    if (node && checkNodeIsNotAvaliable(node)) {
        return null
    }

    return node
}

const addNodeAwaiterToStack = (nodeAwaitStack: NodeAwaitStack) => (unique: symbol, id: string, invoker: FnNodeAwaiterInvoker) => {
    nodeAwaitStack.set(unique, {
        id
        , invoker
    })
}

const removeNodeAwaiterFromStack = (nodeAwaitStack: NodeAwaitStack) => (unique: symbol) => {
    nodeAwaitStack.delete(unique)
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

const onRegistreHandlePoolStack = (nodePoolStack: NodePoolStack, { id, index, replica }: Partial<NodeRegistre>) => {
    if (replica.of) {
        addNodeToStack(nodePoolStack, replica.of, index)
        return
    }

    addNodeToStack(nodePoolStack, id, index)
}

const onRegistreHandleAwaitStack = (nodesRepository: Repository<NodeRegistre>
    , nodePoolStack: NodePoolStack
    , nodeAwaitStack: NodeAwaitStack
    , nodeRegistre: Partial<NodeRegistre>) => {
    nodeAwaitStack.forEach((pool) => {
        if (nodeRegistre.id !== pool.id) return
        pool.invoker(getNode(nodesRepository, nodePoolStack)(pool.id))
    })
}

const onAddNodeRegistre = (nodesRepository: Repository<NodeRegistre>
    , nodePoolStack: NodePoolStack
    , nodeAwaitStack: NodeAwaitStack
    , nodeRegistre: Partial<NodeRegistre>) => {
    onRegistreHandlePoolStack(nodePoolStack, nodeRegistre)
    onRegistreHandleAwaitStack(nodesRepository, nodePoolStack, nodeAwaitStack, nodeRegistre)
}

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

const onRemoveNodeRegistre = (nodePoolStack: NodePoolStack, { id, index, replica }: Partial<NodeRegistre>) => {
    if (replica.of) {
        removeNodeFromStack(nodePoolStack, replica.of, index)
        return
    }

    removeNodeFromStack(nodePoolStack, id, index)
}

const getNodePoolStack = (nodePoolStack: NodePoolStack) => () => {
    return Object.fromEntries(nodePoolStack.entries())
}

// This module contains the main logic of the load balancing between nodes
const orchester = ({ eventsDriver, nodesRepository }: OrchesterArgs): Orchester => {
    const nodePoolStack: NodePoolStack = new Map()
    const nodeAwaitStack: NodeAwaitStack = new Map()
    eventsDriver.on(EVENTS.NODE_REGISTRE.ADD, (emitter) => {
        onAddNodeRegistre(nodesRepository, nodePoolStack, nodeAwaitStack, emitter.payload.nodeRegistre)
    })

    eventsDriver.on(EVENTS.NODE_REGISTRE.REMOVE, (emitter) => {
        onRemoveNodeRegistre(nodePoolStack, emitter.payload.nodeRegistre)
    })

    return {
        get nodePoolStack() {
            return new Map(nodePoolStack)
        }
        , getNode: getNode(nodesRepository, nodePoolStack)
        , getNodePoolStack: getNodePoolStack(nodePoolStack)
        , addNodeAwaiterToStack: addNodeAwaiterToStack(nodeAwaitStack)
        , removeNodeAwaiterFromStack: removeNodeAwaiterFromStack(nodeAwaitStack)
    }
}

export const createOrchester = (args: OrchesterArgs) => {
    return orchester(args)
}