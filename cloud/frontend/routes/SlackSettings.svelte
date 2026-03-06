<script lang="ts">
  import {onMount} from 'svelte'

  type SlackStatus = {
    connected: boolean
    teamId?: string
    teamName?: string
  }

  let loading = $state(true)
  let error = $state('')
  let slackConnected = $state(false)
  let slackTeamName = $state('')

  onMount(async() => {
    try {
      let slackRes = await fetch('/_api/slack/status')
      if (!slackRes.ok) throw new Error('Failed to fetch Slack status')

      let slackData = await slackRes.json() as SlackStatus
      slackConnected = !!slackData.connected
      slackTeamName = slackData.teamName || slackData.teamId || ''
    } catch(e: any) {
      error = e.message
    } finally {
      loading = false
    }
  })

  function connectSlack() {
    window.location.href = '/_api/slack/install'
  }
</script>

<section class="slack-page">
  <h1>Slack</h1>

  {#if loading}
    <p>Loading Slack status...</p>
  {:else if error}
    <p class="error">{error}</p>
  {:else}
    <div class="integration-card">
      <div>
        {#if slackConnected}
          <p>Connected to {slackTeamName || 'your workspace'}.</p>
        {:else}
          <p>Connect Slack to let your team ask Graphene questions in channels and threads.</p>
        {/if}
      </div>
      <button class="connect-btn" onclick={connectSlack}>{slackConnected ? 'Reconnect Slack' : 'Connect Slack'}</button>
    </div>
  {/if}
</section>

<style>
  .slack-page {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  h1 {
    font-size: 24px;
    font-weight: 600;
    margin: 0;
  }

  .integration-card {
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }

  .integration-card p {
    margin: 0;
    color: #444;
  }

  .connect-btn {
    background: #24292f;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
  }

  .connect-btn:hover {
    background: #32383f;
  }

  .error {
    color: #dc3545;
    margin: 0;
  }

  @media (max-width: 760px) {
    .integration-card {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
