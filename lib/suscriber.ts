import { NodeEmitter } from './eventsDriver'

export type Suscriber = {
    suscribe: (fn: SuscriberFn, nodeId?: string) => void
    , unsubscribe: (fn: SuscriberFn) => void
    , fire: (payload: NodeEmitter) => void
}

export type SuscriberFn = (payload: NodeEmitter) => void

type SuscriberPayload = {
    fn: SuscriberFn
    , nodeId: string
}

type Suscribers = Map<SuscriberFn, SuscriberPayload>

const fire = (sucribers: Suscribers) => (payload: NodeEmitter) => {
    sucribers.forEach((suscriber) => {
        if (suscriber.nodeId && suscriber.nodeId !== payload.id) return
        suscriber.fn(payload)
    })
}

const unsubscribe = (sucribers: Suscribers) => (fn: SuscriberFn) => sucribers.delete(fn)

const suscribe = (sucribers: Suscribers) => (fn: SuscriberFn, nodeId: string) => {
    sucribers.set(fn, { fn, nodeId })
}

const Suscriber = (): Suscriber => {
    const sucribers: Suscribers = new Map()
    return {
        suscribe: suscribe(sucribers)
        , unsubscribe: unsubscribe(sucribers)
        , fire: fire(sucribers)
    }
}

export const createSuscriber = () => {
    return Suscriber()
}
