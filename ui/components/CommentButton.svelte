<!-- Optional report-comment action. Cloud supplies the runtime bridge; LocalApp leaves it absent, so nothing renders. -->
<script lang="ts">
  import MessageCircle from '@lucide/svelte/icons/message-circle'
  import ActionButton from './ActionButton.svelte'

  let {componentId, title}: {componentId: string; title?: string} = $props()
  let enabled = $state(false)
  let count = $state(0)

  $effect(() => {
    let comments = window.$GRAPHENE.comments
    if (!comments) return
    return comments.subscribe(componentId, (state: {enabled: boolean; count: number}) => {
      enabled = state.enabled
      count = state.count
    })
  })
</script>

{#if enabled}
  {@const label = count ? `${count} ${count === 1 ? 'comment' : 'comments'} on this component` : 'Comment on this component'}
  <ActionButton
    active={count > 0}
    type="button"
    data-comment-anchor-control={componentId}
    aria-label={label}
    title={label}
    onclick={event => { event.stopPropagation(); window.$GRAPHENE.comments.open(componentId, title) }}
  >
    <MessageCircle />
    {#if count}<span>{count}</span>{/if}
  </ActionButton>
{/if}
