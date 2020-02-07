import { EventsDriver } from './eventsDriver'
import * as EVENTS from './constants/events'
import { NodeRegistre } from './node'
import { objIsFalsy } from './utils/utils'

export type DependencyManager = {
    add: (id: string) => void
    , remove: (id: string) => void
    , getAll: () => DepedencyStack
}

export type DependencyManagerOptions = {
    depedencies?: string | string[]
}

export type NodeDependency = {
    satisfied: boolean
}

type DependencyManagerArgs = {
    eventsDriver: EventsDriver
    , options: DependencyManagerOptions
}

type DepedencyStack = Map<string, NodeDependency>

const add = (depedencyStack: DepedencyStack) => (id: string) => depedencyStack.set(id, { satisfied: false })
const remove = (depedencyStack: DepedencyStack) => (id: string) => depedencyStack.delete(id)
const getAll = (depedencyStack: DepedencyStack) => () => new Map(depedencyStack)

const handleDepedencyStack = (depedencyStack: DepedencyStack, { id }: Partial<NodeRegistre>) => {
    const dependency = depedencyStack.get(id)
    if (dependency) {
        const satisfied = !dependency.satisfied
        depedencyStack.set(id, { satisfied })
        return
    }
}

const addDependeciesToStack = (depedencies: string | string[], dependecyStack: DepedencyStack) => {
    if (Array.isArray(depedencies)) depedencies.forEach((id) => {
        dependecyStack.set(id, { satisfied: false })
    })
    else dependecyStack.set(depedencies, { satisfied: false })
}

// This module contains the main logic of the management of dependencies
const dependencyManager = ({ eventsDriver, options: { depedencies = null } }: DependencyManagerArgs): DependencyManager => {
    const depedencyStack: DepedencyStack = new Map()
    const dependecyManager: DependencyManager = {
        add: add(depedencyStack)
        , remove: remove(depedencyStack)
        , getAll: getAll(depedencyStack)
    }

    if (objIsFalsy(depedencies)) return dependecyManager
    addDependeciesToStack(depedencies, depedencyStack)

    eventsDriver.on(EVENTS.NODE_REGISTRE.ADD, ({ payload }) => {
        handleDepedencyStack(depedencyStack, payload.nodeRegistre)
    })

    eventsDriver.on(EVENTS.NODE_REGISTRE.REMOVE, ({ payload }) => {
        handleDepedencyStack(depedencyStack, payload.nodeRegistre)
    })

    return dependecyManager
}

export const createdependencyManager = (args: DependencyManagerArgs) => {
    return dependencyManager(args)
}
