import * as EVENTS from './constants/events'
import { NodeEmitter } from './eventsDriver'
import { EventsDriver } from './eventsDriver'

export type Suscriber = {
    suscribe: (fn: SuscriberFn, nodeId?: string) => void
    , unsubscribe: (fn: SuscriberFn) => void
}

export type SuscriberFn = (payload: NodeEmitter) => void

type SuscriberPayload = {
    fn: SuscriberFn
    , nodeId: string
}

type Suscribers = Map<SuscriberFn, SuscriberPayload>

const fire = (sucribers: Suscribers, payload: NodeEmitter) => {
    sucribers.forEach((suscriber) => {
        if (suscriber.nodeId && suscriber.nodeId !== payload.id) return
        suscriber.fn(payload)
    })
}

const unsubscribe = (sucribers: Suscribers) => (fn: SuscriberFn) => sucribers.delete(fn)

const suscribe = (sucribers: Suscribers) => (fn: SuscriberFn, nodeId: string) => {
    sucribers.set(fn, { fn, nodeId })
}

type SuscriberArgs = {
    eventsDriver: EventsDriver
}

const Suscriber = ({ eventsDriver }: SuscriberArgs): Suscriber => {
    const sucribers: Suscribers = new Map()
    eventsDriver.on(EVENTS.NODE.EXTERNAL_ACTION, (payload) => {
        fire(sucribers, payload)
    })

    return {
        suscribe: suscribe(sucribers)
        , unsubscribe: unsubscribe(sucribers)
    }
}

export const createSuscriber = (args: SuscriberArgs) => {
    return Suscriber(args)
}
