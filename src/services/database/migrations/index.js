import * as m001 from './001_initial_schema'

export const migrations = [m001].sort((a, b) => a.version - b.version)
