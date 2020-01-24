import * as EVENTS from '../lib/constants/events'
import { createEventsDriver, NodeEmitter } from '../lib/eventsDriver'
import { createDgramTransport } from '../lib/transport/dgram'

interface Message extends NodeEmitter {
    foo?: string
}

const main = async () => {
    const barEd = createEventsDriver()
    const foo = createDgramTransport({ eventsDriver: createEventsDriver(), options: { unicast: '0.0.0.0' } })
    const bar = createDgramTransport({ eventsDriver: barEd })
    await foo.bind()
    await bar.bind()

    const onMessage = (): Promise<Message> => new Promise((resolve) => {
        barEd.on(EVENTS.TRANSPORT.MESSAGE, (data) => {
            resolve(data)
        })

        foo.send({ foo: 'foo' })
    })

    const message = await onMessage()
    console.log(message)
    foo.close()
    bar.close()
}

main()