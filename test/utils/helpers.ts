import { pid } from '../../lib/constants/core'
import { createUuid, genRandomNumber } from '../../lib/utils'
import { NodeRegistre, NODE_STATES } from '../../lib/node'

export const createNodeRegistre = (id: string
    , state: NODE_STATES
    , replica: { is: boolean, of: string } = {
        is: false
        , of: null
    }): NodeRegistre => {
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
        , up: null
        , down: null
        , stop: null
    }
}
