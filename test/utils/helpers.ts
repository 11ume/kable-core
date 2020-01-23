import { pid } from '../../lib/constants/core'
import { createUuid, genRandomNumber } from '../../lib/utils'
import { NodeRegistre, NodeReplica, NODE_STATES } from '../../lib/node'

export const createNodeRegistre = (id: string
    , state: NODE_STATES
    , replica: NodeReplica = { is: false }): NodeRegistre => {
    return {
        id
        , port: 5000
        , host: ''
        , pid
        , iid: createUuid()
        , meta: null
        , index: genRandomNumber()
        , replica
        , hostname: ''
        , ensured: false
        , lastSeen: 0
        , state
        , up: {
            time: 0
        }
    }
}