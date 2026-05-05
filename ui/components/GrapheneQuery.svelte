<script lang="ts">
  import {onMount} from 'svelte'

  interface Props {
    name?: string
    code?: string
    encodedName?: string
    encodedCode?: string
  }

  let {name = '', code = '', encodedName, encodedCode}: Props = $props()

  // Fenced markdown queries are base64-encoded so SQL syntax never has to survive Svelte's HTML parser.
  function decodeBase64QueryAttr(value: string) {
    let binary = atob(value)
    let bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  }

  onMount(() => {
    if (typeof window !== 'undefined' && window.$GRAPHENE) {
      window.$GRAPHENE.registerQuery(encodedName ? decodeBase64QueryAttr(encodedName) : name, encodedCode ? decodeBase64QueryAttr(encodedCode) : code)
    }
  })
</script>
