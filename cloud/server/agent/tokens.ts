import jwt from 'jsonwebtoken'

function getSecret () {
  return process.env.AGENT_TOKEN_SECRET || process.env.CONNECTION_ENCRYPTION_KEY || 'dev-secret-key'
}

export interface AgentTokenClaims {
  orgId: string
  repoId: string
  purpose: 'agent-render'
}

/**
 * Generate a short-lived JWT for the agent to authenticate with the dynamic endpoint.
 */
export function generateAgentToken (orgId: string, repoId: string): string {
  return jwt.sign(
    {orgId, repoId, purpose: 'agent-render'} satisfies AgentTokenClaims,
    getSecret(),
    {expiresIn: '5m'},
  )
}

/**
 * Verify an agent token and return the claims.
 */
export function verifyAgentToken (token: string): AgentTokenClaims | null {
  try {
    let claims = jwt.verify(token, getSecret()) as AgentTokenClaims
    if (claims.purpose !== 'agent-render') return null
    return claims
  } catch {
    return null
  }
}
