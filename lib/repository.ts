import { EventsDriver } from './eventsDriver'
import * as EVENTS from './constants/events'
import { NODE_UNREGISTRE_REASON } from './node'
import { getDateNow } from './utils/utils'

type RepositoryArgs<T extends Registre> = {
    eventsDriver: EventsDriver
    , registres: RepositoryRegistre<T>
}

type RepositoryRegistre<T extends Registre> = Map<number, T>

type Registre = {
    id: string
}

export interface Repository<T extends Registre> {
    add: (key: number, nodeRegistre: T) => void
    , remove: (key: number, nodeRegistre: T, reason?: NODE_UNREGISTRE_REASON) => void
    , clearAll: () => void
    , getOne: (key: number) => T
    , getAll: () => IterableIterator<T>
    , getOneById: (id: string) => T
    , size: () => number
}

const size = <T extends Registre>(registres: RepositoryRegistre<T>) => () => registres.size

const add = <T extends Registre>(eventsDriver: EventsDriver, registres: RepositoryRegistre<T>) => (key: number, nodeRegistre: T) => {
    registres.set(key, nodeRegistre)
    eventsDriver.emit(EVENTS.NODE_REGISTRE.ADD, {
        payload: {
            time: getDateNow()
            , nodeRegistre
        }
    })
}

const remove = <T extends Registre>(eventsDriver: EventsDriver, registres: RepositoryRegistre<T>) => (key: number, nodeRegistre: T, reason?: NODE_UNREGISTRE_REASON) => {
    registres.delete(key)
    eventsDriver.emit(EVENTS.NODE_REGISTRE.REMOVE, {
        payload: {
            time: getDateNow()
            , reason
            , nodeRegistre
        }
    })
}

const clear = <T extends Registre>(registres: RepositoryRegistre<T>) => () => registres.clear()

const getAll = <T extends Registre>(registres: RepositoryRegistre<T>) => () => registres.values()

const getOne = <T extends Registre>(registres: RepositoryRegistre<T>) => (key: number) => registres.get(key)

const getOneById = <T extends Registre>(registres: RepositoryRegistre<T>) => (id: string): T => {
    for (const n of registres.values()) {
        if (n.id === id) {
            return n
        }
    }

    return null
}

// This module is a handle the store of each node registre, or any other type of registre
const repository = <T extends Registre>({ eventsDriver, registres }: RepositoryArgs<T>): Repository<T> => {
    return {
        add: add(eventsDriver, registres)
        , remove: remove(eventsDriver, registres)
        , clearAll: clear(registres)
        , getOne: getOne(registres)
        , getAll: getAll(registres)
        , getOneById: getOneById(registres)
        , size: size(registres)
    }
}

export const createRepository = <T extends Registre>(args: RepositoryArgs<T>): Repository<T> => {
    return repository(args)
}
