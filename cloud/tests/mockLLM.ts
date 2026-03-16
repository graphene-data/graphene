export const flightsAgentSessionMessages: Record<string, any>[] = [
  {
    role: 'user',
    content: [{type: 'text', text: 'Latest mention: <@U999> Which airlines have the worst departure delays?'}],
  },
  {
    role: 'assistant',
    content: [{type: 'tool-call', toolCallId: 'tool-list-1', toolName: 'listDir', input: {path: ''}}],
  },
  {
    role: 'user',
    content: [{type: 'tool-result', toolCallId: 'tool-list-1', output: {paths: ['models.gsql', 'flights.md', 'delays.md']}}],
  },
  {
    role: 'assistant',
    content: [{type: 'tool-call', toolCallId: 'tool-read-1', toolName: 'readFile', input: {path: 'models.gsql'}}],
  },
  {
    role: 'user',
    content: [{type: 'tool-result', toolCallId: 'tool-read-1', output: {content: 'table flights (...)'}}],
  },
  {
    role: 'assistant',
    content: [{type: 'tool-call', toolCallId: 'tool-render-1', toolName: 'renderMd', input: {markdown: '# Worst Delayed Carriers\n\n```gsql delayed_carriers\nfrom flights select carriers.name as carrier_name, avg(dep_delay) as avg_dep_delay where dep_delay is not null group by carrier_name order by avg_dep_delay desc limit 10\n```\n\n<BarChart data=delayed_carriers x=carrier_name y=avg_dep_delay />'}}],
  },
  {
    role: 'user',
    content: [{
      type: 'tool-result',
      toolCallId: 'tool-render-1',
      output: {
        type: 'content',
        value: [
          {type: 'text', text: 'Rendered markdown id: md-delay-1'},
          {type: 'media', data: 'screenshot-1', mediaType: 'image/png'},
        ],
      },
    }],
  },
  {
    role: 'assistant',
    content: [{type: 'tool-call', toolCallId: 'tool-respond-1', toolName: 'respondToUser', input: {text: 'Here are the carriers with the highest average departure delay.', mdId: 'md-delay-1'}}],
  },
  {
    role: 'user',
    content: [{type: 'tool-result', toolCallId: 'tool-respond-1', output: {text: 'Here are the carriers with the highest average departure delay.', mdId: 'md-delay-1'}}],
  },
  {
    role: 'user',
    content: [{type: 'text', text: 'Latest mention: <@U999> Can you focus on total delays instead of average?'}],
  },
  {
    role: 'assistant',
    content: [{type: 'tool-call', toolCallId: 'tool-search-2', toolName: 'search', input: {query: 'dep_delay'}}],
  },
  {
    role: 'user',
    content: [{type: 'tool-result', toolCallId: 'tool-search-2', output: {matches: ['models.gsql: flights.dep_delay']}}],
  },
  {
    role: 'assistant',
    content: [{type: 'tool-call', toolCallId: 'tool-render-2', toolName: 'renderMd', input: {markdown: '# Failed Attempt\n\n```gsql broken_delay\nfrom flights select carrier.name as carrier_name, sum(dep_delay) as total_delay group by carrier_name order by total_delay desc limit 10\n```\n\n<BarChart data=broken_delay x=carrier_name y=total_delay />'}}],
  },
  {
    role: 'user',
    content: [{type: 'tool-result', toolCallId: 'tool-render-2', output: {success: false, error: 'Could not find "carrier" on query'}}],
  },
  {
    role: 'assistant',
    content: [{type: 'tool-call', toolCallId: 'tool-render-3', toolName: 'renderMd', input: {markdown: '# Total Carrier Delay\n\n```gsql total_carrier_delay\nfrom flights select carriers.name as carrier_name, sum(dep_delay) as total_delay where dep_delay is not null group by carrier_name order by total_delay desc limit 10\n```\n\n<BarChart data=total_carrier_delay x=carrier_name y=total_delay />'}}],
  },
  {
    role: 'user',
    content: [{
      type: 'tool-result',
      toolCallId: 'tool-render-3',
      output: {
        type: 'content',
        value: [
          {type: 'text', text: 'Rendered markdown id: md-delay-2'},
          {type: 'media', data: 'screenshot-2', mediaType: 'image/png'},
        ],
      },
    }],
  },
  {
    role: 'assistant',
    content: [{type: 'tool-call', toolCallId: 'tool-respond-2', toolName: 'respondToUser', input: {text: 'Updated to total delay. This view highlights carriers with the biggest aggregate delay impact.', mdId: 'md-delay-2'}}],
  },
  {
    role: 'user',
    content: [{type: 'tool-result', toolCallId: 'tool-respond-2', output: {text: 'Updated to total delay. This view highlights carriers with the biggest aggregate delay impact.', mdId: 'md-delay-2'}}],
  },
]
