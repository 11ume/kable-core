import os from 'os'
import * as EVENTS from '../lib/constants/events'
import { createEventsDriver, NodeEmitter } from '../lib/eventsDriver'
import { createDgramTransport } from '../lib/transport/dgram'

interface Message extends NodeEmitter {
    foo?: string
}

const getMulticastAddress = () => {
    const networkInterfaces = os.networkInterfaces()
    const broadcastAddresses = []

    Object.keys(networkInterfaces).forEach((ifname) => {
        networkInterfaces[ifname].forEach((iface) => {
            if ('IPv4' !== iface.family || iface.internal !== false) {
                // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                return
            }

            const tabytes = (iface.address).split('.').map(parseInt)
            const tsbytes = (iface.netmask).split('.').map(parseInt)

            // Calculate Broadcast address
            const tbaddr = ((tabytes[0] & tsbytes[0]) | (255 ^ tsbytes[0])) + '.'
                + ((tabytes[1] & tsbytes[1]) | (255 ^ tsbytes[1])) + '.'
                + ((tabytes[2] & tsbytes[2]) | (255 ^ tsbytes[2])) + '.'
                + ((tabytes[3] & tsbytes[3]) | (255 ^ tsbytes[3]))

            broadcastAddresses.push(tbaddr)
        })
    })

    return broadcastAddresses
}

const main = async () => {
    getMulticastAddress()
    const barEd = createEventsDriver()
    const foo = createDgramTransport({ eventsDriver: createEventsDriver(), options: { multicast: '239.255.255.250' } })
    const bar = createDgramTransport({ eventsDriver: barEd, options: { multicast: '239.255.255.250' } })
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